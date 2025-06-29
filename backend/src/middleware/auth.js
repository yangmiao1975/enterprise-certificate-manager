import jwt from 'jsonwebtoken';
import { getDatabase } from '../database/flexible-init.js';

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // console.log('Decoded JWT:', decoded);
    
    const db = getDatabase();
    const allUsers = await db.allAsync('SELECT id, email, active FROM users');
    // console.log('All users in DB:', allUsers);
    const user = await db.getAsync('SELECT * FROM users WHERE id = ? AND active = ?', [decoded.id, 1]);
    // console.log('User from DB:', user);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user role and permissions
    const role = await db.getAsync('SELECT * FROM roles WHERE id = ?', [user.role]);
    const permissions = (role && role.permissions && typeof role.permissions === 'string') ? JSON.parse(role.permissions) : [];

    req.user = {
      ...user,
      id: user.id,
      permissions
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    next(error);
  }
};

export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user || !Array.isArray(req.user.permissions) || !req.user.permissions.includes(permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

export const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'Insufficient role' });
    }
    next();
  };
}; 