import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../database/init.js';
import { validateLogin, validateRegister } from '../middleware/validation.js';

const router = express.Router();

// Login
router.post('/login', validateLogin, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const db = getDatabase();

    // Find user
    const user = await db.get('SELECT * FROM users WHERE username = ? AND active = 1', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get user role and permissions
    const role = await db.get('SELECT * FROM roles WHERE id = ?', [user.role]);
    const permissions = role ? JSON.parse(role.permissions) : [];

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions
      }
    });
  } catch (error) {
    next(error);
  }
});

// Register (admin only)
router.post('/register', validateRegister, async (req, res, next) => {
  try {
    const { username, email, password, role } = req.body;
    const db = getDatabase();

    // Check if user already exists
    const existingUser = await db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const userId = `user-${Date.now()}`;
    await db.run(
      'INSERT INTO users (id, username, email, password_hash, role, active) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, username, email, passwordHash, role || 'viewer', 1]
    );

    const newUser = await db.get('SELECT id, username, email, role FROM users WHERE id = ?', [userId]);

    res.status(201).json({
      message: 'User created successfully',
      user: newUser
    });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', async (req, res, next) => {
  try {
    const db = getDatabase();
    const user = await db.get('SELECT id, username, email, role FROM users WHERE id = ?', [req.user.id]);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const role = await db.get('SELECT * FROM roles WHERE id = ?', [user.role]);
    const permissions = role ? JSON.parse(role.permissions) : [];

    res.json({
      ...user,
      permissions
    });
  } catch (error) {
    next(error);
  }
});

// Change password
router.post('/change-password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const db = getDatabase();

    // Get current user with password hash
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newPasswordHash, req.user.id]);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
});

export default router; 