import express from 'express';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../database/init.js';
import { requirePermission } from '../middleware/auth.js';

const router = express.Router();

// Get all users (admin only)
router.get('/', requirePermission('system:settings'), async (req, res, next) => {
  try {
    const db = getDatabase();
    
    const users = await db.allAsync(`
      SELECT u.id, u.username, u.email, u.role, u.active, u.created_at,
             r.name as role_name, r.description as role_description
      FROM users u
      LEFT JOIN roles r ON u.role = r.id
      ORDER BY u.created_at DESC
    `);

    res.json(users);
  } catch (error) {
    next(error);
  }
});

// Get user by ID
router.get('/:id', requirePermission('system:settings'), async (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    const user = await db.getAsync(`
      SELECT u.id, u.username, u.email, u.role, u.active, u.created_at,
             r.name as role_name, r.description as role_description
      FROM users u
      LEFT JOIN roles r ON u.role = r.id
      WHERE u.id = ?
    `, [id]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

// Create user (admin only)
router.post('/', requirePermission('system:settings'), async (req, res, next) => {
  try {
    const db = getDatabase();
    const { username, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await db.getAsync('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user (let SQLite auto-generate the ID)
    const result = await db.runAsync(
      'INSERT INTO users (username, email, password_hash, role, active) VALUES (?, ?, ?, ?, ?)',
      [username, email, passwordHash, role || 'viewer', 1]
    );

    const newUser = await db.getAsync(`
      SELECT u.id, u.username, u.email, u.role, u.active, u.created_at,
             r.name as role_name, r.description as role_description
      FROM users u
      LEFT JOIN roles r ON u.role = r.id
      WHERE u.id = ?
    `, [result.lastID]);

    res.status(201).json(newUser);
  } catch (error) {
    next(error);
  }
});

// Update user (admin only)
router.put('/:id', requirePermission('system:settings'), async (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { username, email, role, active } = req.body;

    // Check if user exists
    const existingUser = await db.getAsync('SELECT * FROM users WHERE id = ?', [id]);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if new username/email conflicts
    if (username !== existingUser.username || email !== existingUser.email) {
      const conflict = await db.getAsync(
        'SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?',
        [username, email, id]
      );
      if (conflict) {
        return res.status(400).json({ error: 'Username or email already exists' });
      }
    }

    // Update user
    await db.runAsync(
      'UPDATE users SET username = ?, email = ?, role = ?, active = ? WHERE id = ?',
      [username, email, role, active ? 1 : 0, id]
    );

    const updatedUser = await db.getAsync(`
      SELECT u.id, u.username, u.email, u.role, u.active, u.created_at,
             r.name as role_name, r.description as role_description
      FROM users u
      LEFT JOIN roles r ON u.role = r.id
      WHERE u.id = ?
    `, [id]);

    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
});

// Delete user (admin only)
router.delete('/:id', requirePermission('system:settings'), async (req, res, next) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    // Check if user exists
    const user = await db.getAsync('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting admin user
    if (user.role === 'admin') {
      return res.status(400).json({ error: 'Cannot delete admin user' });
    }

    // Check if user has uploaded certificates
    const certificateCount = await db.getAsync('SELECT COUNT(*) as count FROM certificates WHERE uploaded_by = ?', [id]);
    if (certificateCount.count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete user with uploaded certificates',
        details: `User has uploaded ${certificateCount.count} certificate(s)`
      });
    }

    await db.runAsync('DELETE FROM users WHERE id = ?', [id]);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Get all roles
router.get('/roles/list', async (req, res, next) => {
  try {
    const db = getDatabase();
    
    const roles = await db.allAsync('SELECT * FROM roles ORDER BY name');
    res.json(roles);
  } catch (error) {
    next(error);
  }
});

// Get user permissions
router.get('/me/permissions', async (req, res, next) => {
  try {
    const db = getDatabase();
    
    const role = await db.getAsync('SELECT * FROM roles WHERE id = ?', [req.user.role]);
    const permissions = role ? JSON.parse(role.permissions) : [];

    res.json({
      role: req.user.role,
      permissions
    });
  } catch (error) {
    next(error);
  }
});

export default router; 