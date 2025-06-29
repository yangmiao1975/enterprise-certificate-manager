import express from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/flexible-init.js';
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
  console.log('=== CERTIFICATE UPLOAD DEBUG ===');
  console.log('Request headers authorization:', req.headers.authorization ? 'Present' : 'Missing');
  console.log('Request user:', req.user ? { id: req.user.id, username: req.user.username } : 'No user');
  console.log('Request body:', req.body);
  console.log('Request file:', req.file ? {
    originalname: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype,
    hasBuffer: !!req.file.buffer
  } : 'No file');
  
  try {
    const db = getDatabase();
    const { folderId } = req.body || {};
    const file = req.file;
    const userId = req.user?.id;
    
    console.log('Extracted values:', { folderId, userId, hasFile: !!file });

    if (!file) {
      console.log('UPLOAD FAIL: No file provided');
      console.log('=== END CERTIFICATE UPLOAD DEBUG ===');
      return res.status(400).json({ error: 'Certificate file is required' });
    }
    
    if (!userId) {
      console.log('UPLOAD FAIL: No user ID (authentication failed)');
      console.log('=== END CERTIFICATE UPLOAD DEBUG ===');
      return res.status(401).json({ error: 'User authentication required' });
    }

    // Parse certificate (pass buffer and originalname)
    console.log('[Route] Parsing certificate file:', file.originalname, 'Size:', file.buffer.length, 'bytes');
    const certificateData = await parseCertificate(file.buffer, file.originalname);
    console.log('[Route] Certificate parsed successfully. CN:', certificateData.commonName);
    
    // Pass raw buffer to GCP service (don't convert to UTF-8 for binary files)
    console.log('[Route] Calling GCP service for certificate upload...');
    const gcpResult = await gcpCertificateService.createCertificate(certificateData, file.buffer);
    console.log('[Route] GCP service upload successful. ID:', gcpResult.id);

    // Save to database
    console.log('[Route] Saving to database...');
    const certificateId = uuidv4();
    const now = new Date().toISOString();
    
    // Get the normalized PEM content from GCP result or convert buffer to string for storage
    let pemContentForDb;
    if (gcpResult.normalizedPem) {
      pemContentForDb = gcpResult.normalizedPem;
    } else {
      // Fallback: try to convert to string, but handle binary gracefully
      try {
        pemContentForDb = file.buffer.toString('utf8');
      } catch (err) {
        pemContentForDb = file.buffer.toString('base64'); // Store as base64 if UTF-8 fails
      }
    }
    
    try {
    await db.runAsync(`
      INSERT INTO certificates (
        id, common_name, issuer, subject, valid_from, valid_to, 
        algorithm, serial_number, status, pem_content, folder_id, 
        uploaded_by, uploaded_at, updated_at, renewal_count, gcp_certificate_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      pemContentForDb,
      folderId || null,
      userId,
      now,
      now, // Set updated_at same as uploaded_at initially
      0,   // Initial renewal count is 0
      gcpResult.gcpCertificateName
    ]);
    console.log('[Route] Database insert successful');
    } catch (insertError) {
      console.error('[Route] Database insert error:', insertError);
      throw insertError;
    }

    console.log('[Route] Querying database for inserted certificate...');
    const certificate = await db.getAsync(`
      SELECT c.*, f.name as folder_name, u.username as uploaded_by_username
      FROM certificates c
      LEFT JOIN folders f ON c.folder_id = f.id
      LEFT JOIN users u ON c.uploaded_by = u.id
      WHERE c.id = ?
    `, [certificateId]);
    console.log('[Route] Database query successful, sending response...');
    res.status(201).json(certificate);
  } catch (error) {
    console.error('[Route] Certificate upload error:', error);
    
    // Provide specific error messages based on error type
    let errorMessage = 'Certificate upload failed';
    let statusCode = 400;
    
    if (error.message.includes('Cloud Storage')) {
      errorMessage = `GCP Cloud Storage error: ${error.message}`;
      statusCode = 503; // Service unavailable
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Upload timed out. Please try again with a smaller file or check your connection.';
      statusCode = 408; // Request timeout
    } else if (error.message.includes('permission') || error.message.includes('auth')) {
      errorMessage = 'Authentication error. Please check GCP credentials.';
      statusCode = 401; // Unauthorized
    } else if (error.message.includes('certificate') && error.message.includes('invalid')) {
      errorMessage = `Invalid certificate: ${error.message}`;
      statusCode = 400; // Bad request
    } else if (error.message.includes('database') || error.message.includes('Database')) {
      errorMessage = 'Database error. Please try again.';
      statusCode = 500; // Internal server error
    } else {
      errorMessage = error.message || 'Unknown error during certificate upload';
    }
    
    res.status(statusCode).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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

    // Update renewal metadata in database
    const currentRenewalCount = certificate.renewal_count || 0;
    const now = new Date().toISOString();
    
    await db.runAsync(
      'UPDATE certificates SET updated_at = ?, renewal_count = ? WHERE id = ?',
      [now, currentRenewalCount + 1, id]
    );

    // Get updated certificate data
    const updatedCertificate = await db.getAsync(`
      SELECT c.*, f.name as folder_name, u.username as uploaded_by_username
      FROM certificates c
      LEFT JOIN folders f ON c.folder_id = f.id
      LEFT JOIN users u ON c.uploaded_by = u.id
      WHERE c.id = ?
    `, [id]);

    res.json({ 
      message: 'Certificate renewal initiated',
      certificate: updatedCertificate
    });
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