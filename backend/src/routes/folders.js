import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/init.js';
import { validateFolder, validateId } from '../middleware/validation.js';
import { requirePermission } from '../middleware/auth.js';

const router = express.Router();

// Get all folders
router.get('/', async (req, res, next) => {
  try {
    const db = getDatabase();
    const { type } = req.query;
    
    let query = `
      SELECT f.*, u.username as created_by_username,
             (SELECT COUNT(*) FROM certificates WHERE folder_id = f.id) as certificate_count
      FROM folders f
      LEFT JOIN users u ON f.created_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (type) {
      query += ' AND f.type = ?';
      params.push(type);
    }

    query += ' ORDER BY f.created_at DESC';

    const folders = await db.allAsync(query, params);
    res.json(folders);
  } catch (error) {
    next(error);
  }
});

// Get folder by ID
router.get('/:id', validateId, async (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    const folder = await db.getAsync(`
      SELECT f.*, u.username as created_by_username,
             (SELECT COUNT(*) FROM certificates WHERE folder_id = f.id) as certificate_count
      FROM folders f
      LEFT JOIN users u ON f.created_by = u.id
      WHERE f.id = ?
    `, [id]);

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    res.json(folder);
  } catch (error) {
    next(error);
  }
});

// Create folder
router.post('/', validateFolder, requirePermission('folders:write'), async (req, res, next) => {
  try {
    const db = getDatabase();
    const { name, description, permissions, accessControl } = req.body;
    const userId = req.user.id;

    // Check if folder name already exists
    const existingFolder = await db.getAsync('SELECT id FROM folders WHERE name = ?', [name]);
    if (existingFolder) {
      return res.status(400).json({ error: 'Folder with this name already exists' });
    }

    const folderId = uuidv4();
    const now = new Date().toISOString();

    await db.runAsync(`
      INSERT INTO folders (id, name, description, type, permissions, created_by, created_at, access_control)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      folderId,
      name,
      description || null,
      'custom',
      JSON.stringify(permissions || ['read']),
      userId,
      now,
      accessControl ? JSON.stringify(accessControl) : null
    ]);

    const folder = await db.getAsync(`
      SELECT f.*, u.username as created_by_username
      FROM folders f
      LEFT JOIN users u ON f.created_by = u.id
      WHERE f.id = ?
    `, [folderId]);

    res.status(201).json(folder);
  } catch (error) {
    next(error);
  }
});

// Update folder
router.put('/:id', validateId, validateFolder, requirePermission('folders:write'), async (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { name, description, permissions, accessControl } = req.body;

    // Check if folder exists
    const existingFolder = await db.getAsync('SELECT * FROM folders WHERE id = ?', [id]);
    if (!existingFolder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Check if new name conflicts with existing folder
    if (name !== existingFolder.name) {
      const nameConflict = await db.getAsync('SELECT id FROM folders WHERE name = ? AND id != ?', [name, id]);
      if (nameConflict) {
        return res.status(400).json({ error: 'Folder with this name already exists' });
      }
    }

    await db.runAsync(`
      UPDATE folders 
      SET name = ?, description = ?, permissions = ?, access_control = ?
      WHERE id = ?
    `, [
      name,
      description || null,
      JSON.stringify(permissions || ['read']),
      accessControl ? JSON.stringify(accessControl) : null,
      id
    ]);

    const updatedFolder = await db.getAsync(`
      SELECT f.*, u.username as created_by_username
      FROM folders f
      LEFT JOIN users u ON f.created_by = u.id
      WHERE f.id = ?
    `, [id]);

    res.json(updatedFolder);
  } catch (error) {
    next(error);
  }
});

// Delete folder
router.delete('/:id', validateId, requirePermission('folders:delete'), async (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    // Check if folder exists
    const folder = await db.getAsync('SELECT * FROM folders WHERE id = ?', [id]);
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Check if it's a system folder
    if (folder.type === 'system') {
      return res.status(400).json({ error: 'Cannot delete system folders' });
    }

    // Check if folder has certificates
    const certificateCount = await db.getAsync('SELECT COUNT(*) as count FROM certificates WHERE folder_id = ?', [id]);
    if (certificateCount.count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete folder with certificates',
        details: `Folder contains ${certificateCount.count} certificate(s)`
      });
    }

    await db.runAsync('DELETE FROM folders WHERE id = ?', [id]);

    res.json({ message: 'Folder deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Get certificates in folder
router.get('/:id/certificates', validateId, async (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { status, search } = req.query;

    let query = `
      SELECT c.*, f.name as folder_name, u.username as uploaded_by_username
      FROM certificates c
      LEFT JOIN folders f ON c.folder_id = f.id
      LEFT JOIN users u ON c.uploaded_by = u.id
      WHERE c.folder_id = ?
    `;
    const params = [id];

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

export default router; 