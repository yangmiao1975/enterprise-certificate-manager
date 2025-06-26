import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/init.js';
import gcpCertificateService from '../services/gcpCertificateService.js';
import { parseCertificate } from '../utils/certificateParser.js';
import { validateCertificateUpload } from '../middleware/validation.js';

const router = express.Router();

// Configure multer for file uploads
const allowedExtensions = [
  '.pem', '.crt', '.cer', '.key', '.ca-bundle',
  '.der', '.pfx', '.p12', '.p7b', '.p7c', '.csr'
];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
  },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only certificate files (.pem, .crt, .cer, .key, .ca-bundle, .der, .pfx, .p12, .p7b, .p7c, .csr) are allowed'), false);
    }
  }
});

// Get all certificates
router.get('/', async (req, res, next) => {
  try {
    const db = getDatabase();
    const { folderId, status, search } = req.query;
    
    let query = `
      SELECT c.*, f.name as folder_name, u.username as uploaded_by_username
      FROM certificates c
      LEFT JOIN folders f ON c.folder_id = f.id
      LEFT JOIN users u ON c.uploaded_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (folderId && folderId !== 'all-certificates') {
      query += ' AND c.folder_id = ?';
      params.push(folderId);
    }

    if (status) {
      query += ' AND c.status = ?';
      params.push(status);
    }

    if (search) {
      query += ' AND (c.common_name LIKE ? OR c.issuer LIKE ? OR c.subject LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ' ORDER BY c.uploaded_at DESC';

    const certificates = await db.allAsync(query, params);
    res.json(certificates);
  } catch (error) {
    next(error);
  }
});

// Get certificate by ID
router.get('/:id', async (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    const certificate = await db.getAsync(`
      SELECT c.*, f.name as folder_name, u.username as uploaded_by_username
      FROM certificates c
      LEFT JOIN folders f ON c.folder_id = f.id
      LEFT JOIN users u ON c.uploaded_by = u.id
      WHERE c.id = ?
    `, [id]);

    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    res.json(certificate);
  } catch (error) {
    next(error);
  }
});

// Upload certificate
router.post('/', upload.single('certificate'), validateCertificateUpload, async (req, res, next) => {
  try {
    const db = getDatabase();
    const { folderId } = req.body || {};
    const file = req.file;
    const userId = req.user.id;

    if (!file) {
      return res.status(400).json({ error: 'Certificate file is required' });
    }

    // Parse certificate (pass buffer and originalname)
    const certificateData = await parseCertificate(file.buffer, file.originalname);
    const pemContent = file.buffer.toString('utf8');

    // Create certificate in GCP
    const gcpResult = await gcpCertificateService.createCertificate(certificateData, pemContent);

    // Save to database
    const certificateId = uuidv4();
    const now = new Date().toISOString();
    try {
    await db.runAsync(`
      INSERT INTO certificates (
        id, common_name, issuer, subject, valid_from, valid_to, 
        algorithm, serial_number, status, pem_content, folder_id, 
        uploaded_by, uploaded_at, gcp_certificate_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      certificateId,
      certificateData.commonName,
      certificateData.issuer,
      certificateData.subject,
      certificateData.validFrom,
      certificateData.validTo,
      certificateData.algorithm,
      certificateData.serialNumber,
      certificateData.status,
      pemContent,
      folderId || null,
      userId,
      now,
      gcpResult.gcpCertificateName
    ]);
    } catch (insertError) {
    }

    const certificate = await new Promise((resolve, reject) => {
      db.getAsync(`
      SELECT c.*, f.name as folder_name, u.username as uploaded_by_username
      FROM certificates c
      LEFT JOIN folders f ON c.folder_id = f.id
      LEFT JOIN users u ON c.uploaded_by = u.id
      WHERE c.id = ?
      `, [certificateId], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
    res.status(201).json(certificate);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Unknown error during certificate upload' });
  }
});

// Download certificate PEM
router.get('/:id/download', async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const certificate = await db.getAsync('SELECT * FROM certificates WHERE id = ?', [id]);
    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    // Try to get from GCP first, fallback to database
    let pemContent;
    try {
      pemContent = await gcpCertificateService.downloadCertificatePem(certificate.gcp_certificate_name);
    } catch (gcpError) {
      console.warn('Failed to get certificate from GCP, using database copy:', gcpError);
      pemContent = certificate.pem_content;
    }

    if (!pemContent) {
      return res.status(404).json({ error: 'Certificate content not found' });
    }

    res.setHeader('Content-Type', 'application/x-pem-file');
    res.setHeader('Content-Disposition', `attachment; filename="${certificate.common_name}.pem"`);
    res.send(pemContent);
  } catch (error) {
    next(error);
  }
});

// Delete certificate
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const certificate = await db.getAsync('SELECT * FROM certificates WHERE id = ?', [id]);
    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    // Delete from GCP
    if (certificate.gcp_certificate_name) {
      try {
        await gcpCertificateService.deleteCertificate(certificate.gcp_certificate_name);
      } catch (gcpError) {
        console.warn('Failed to delete certificate from GCP:', gcpError);
      }
    }

    // Delete from database
    await db.runAsync('DELETE FROM certificates WHERE id = ?', [id]);

    res.json({ message: 'Certificate deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Renew certificate
router.post('/:id/renew', async (req, res, next) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const certificate = await db.getAsync('SELECT * FROM certificates WHERE id = ?', [id]);
    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    // Renew in GCP
    if (certificate.gcp_certificate_name) {
      try {
        await gcpCertificateService.renewCertificate(certificate.gcp_certificate_name);
      } catch (gcpError) {
        console.warn('Failed to renew certificate in GCP:', gcpError);
      }
    }

    res.json({ message: 'Certificate renewal initiated' });
  } catch (error) {
    next(error);
  }
});

// Assign certificate to folder
router.patch('/:id/folder', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { folderId } = req.body;
    const db = getDatabase();
    
    const certificate = await db.getAsync('SELECT * FROM certificates WHERE id = ?', [id]);
    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }

    await db.runAsync('UPDATE certificates SET folder_id = ? WHERE id = ?', [folderId, id]);

    const updatedCertificate = await db.getAsync(`
      SELECT c.*, f.name as folder_name, u.username as uploaded_by_username
      FROM certificates c
      LEFT JOIN folders f ON c.folder_id = f.id
      LEFT JOIN users u ON c.uploaded_by = u.id
      WHERE c.id = ?
    `, [id]);

    res.json(updatedCertificate);
  } catch (error) {
    next(error);
  }
});

export default router; 