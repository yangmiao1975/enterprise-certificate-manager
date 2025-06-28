import 'dotenv/config';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../database/init.js';
// TODO: Update to use flexible database and password service
// import { getDatabase, getPasswordService } from '../database/flexible-init.js';

import PasswordService from '../services/passwordService.js';
import { validateLogin, validateRegister } from '../middleware/validation.js';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);

router.get('/test-log', (req, res) => {
  process.stderr.write('HIT /api/auth/test-log route (stderr)\n');
  res.json({ ok: true });
});

// --- Google OAuth Passport Setup ---
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const db = getDatabase();
    const googleId = profile.id;
    const email = profile.emails?.[0]?.value;
    const displayName = profile.displayName;
    const avatar = profile.photos?.[0]?.value;
    let user = await db.getAsync('SELECT * FROM users WHERE google_id = ?', [googleId]);
    if (!user) {
      // Create new user
      await db.runAsync(
        'INSERT INTO users (google_id, email, display_name, avatar, role, active) VALUES (?, ?, ?, ?, ?, ?)',
        [googleId, email, displayName, avatar, 'viewer', 1]
      );
      user = await db.getAsync('SELECT * FROM users WHERE google_id = ?', [googleId]);
    } else if (user.avatar !== avatar) {
      // Update avatar if it has changed
      await db.runAsync('UPDATE users SET avatar = ? WHERE google_id = ?', [avatar, googleId]);
      user.avatar = avatar;
    }
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

// Google OAuth entry point
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth callback
router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/login' }), async (req, res) => {
  // console.log('Google OAuth callback hit');
  if (!req.user) {
    // console.log('No user found after Google OAuth');
    return res.redirect('/login');
  }
  const user = req.user;
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      googleId: user.google_id
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  // console.log('Redirecting to:', `${process.env.FRONTEND_URL}/oauth-success?token=${token}`);
  res.redirect(`${process.env.FRONTEND_URL}/oauth-success?token=${token}`);
});

// Login
router.post('/login', validateLogin, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const db = getDatabase();

    const user = await db.getAsync('SELECT * FROM users WHERE username = ? AND active = 1', [username]);
    // console.log('Login attempt:', { username });
    // console.log('User from DB:', user);
    // if (user) {
    //   console.log('Password hash:', user.password_hash);
    // }
    // Find user
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    // console.log('Password valid:', isValidPassword);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get user role and permissions
    const role = await db.getAsync('SELECT * FROM roles WHERE id = ?', [user.role]);
    const permissions = (role && role.permissions && role.permissions !== 'undefined') ? JSON.parse(role.permissions) : [];

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
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
    const existingUser = await db.getAsync('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create user with generated ID (compatible with current DB schema)
    const userId = `user-${Date.now()}`;

    // Hash password securely (will use Secret Manager if enabled)
    const passwordService = new PasswordService();
    let passwordHash;
    
    if (passwordService.useSecretManager) {
      passwordHash = await passwordService.hashAndStorePassword(userId, password);
    } else {
      passwordHash = await bcrypt.hash(password, 10);
    }

    // Insert user into database
    await db.runAsync(
      'INSERT INTO users (id, username, email, password_hash, role, active) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, username, email, passwordHash, role || 'viewer', 1]
    );

    const newUser = await db.getAsync('SELECT id, username, email, role FROM users WHERE id = ?', [userId]);

    res.status(201).json({
      message: 'User created successfully',
      user: newUser
    });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', authMiddleware, async (req, res, next) => {
  // console.log('HIT /api/auth/me route');
  try {
    const db = getDatabase();
    // console.log('req.user:', req.user);
    const user = await db.getAsync('SELECT id, username, email, role, avatar FROM users WHERE id = ?', [req.user.id]);
    // console.log('Queried user:', user);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const role = await db.getAsync('SELECT * FROM roles WHERE id = ?', [user.role]);
    const permissions = (role && role.permissions && role.permissions !== 'undefined') ? JSON.parse(role.permissions) : [];
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
    const user = await db.getAsync('SELECT * FROM users WHERE id = ?', [req.user.id]);
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
    await db.runAsync('UPDATE users SET password_hash = ? WHERE id = ?', [newPasswordHash, req.user.id]);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
});

export default router; 