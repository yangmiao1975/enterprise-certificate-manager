import jwt from 'jsonwebtoken';
import { getDatabase } from '../database/flexible-init.js';

export const authMiddleware = async (req, res, next) => {
  try {
    console.log('=== AUTH MIDDLEWARE DEBUG ===');
    console.log('Request URL:', req.url);
    console.log('Request Method:', req.method);
    
    const authHeader = req.headers.authorization;
    console.log('Auth Header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('AUTH FAIL: No Bearer token');
      return res.status(401).json({ error: 'Access token required' });
    }

    const token = authHeader.substring(7);
    console.log('Token length:', token.length);
    console.log('JWT_SECRET available:', !!process.env.JWT_SECRET);
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('JWT decoded successfully, user ID:', decoded.id);
    } catch (jwtError) {
      console.log('JWT verification failed:', jwtError.message);
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token' });
      }
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      throw jwtError;
    }
    
    let db;
    try {
      db = getDatabase();
      console.log('Database connection obtained');
    } catch (dbError) {
      console.log('Database connection failed:', dbError.message);
      return res.status(500).json({ error: 'Database connection error' });
    }
    
    // Debug: Check all users first
    try {
      const allUsers = await db.allAsync('SELECT id, email, active FROM users');
      console.log('Total users in DB:', allUsers.length);
      console.log('User IDs in DB:', allUsers.map(u => u.id));
      console.log('Looking for user ID:', decoded.id, 'type:', typeof decoded.id);
    } catch (allUsersError) {
      console.log('Failed to query all users:', allUsersError.message);
    }
    
    // Main user lookup with detailed logging
    let user;
    try {
      console.log('Querying user with ID:', decoded.id, 'and active:', 1);
      user = await db.getAsync('SELECT * FROM users WHERE id = ? AND active = ?', [decoded.id, 1]);
      console.log('User found:', !!user);
      if (user) {
        console.log('User details:', { id: user.id, username: user.username, email: user.email, active: user.active });
      } else {
        console.log('No user found - trying different active values...');
        // Try with boolean true for PostgreSQL
        const userWithBoolActive = await db.getAsync('SELECT * FROM users WHERE id = ? AND active = true', [decoded.id]);
        console.log('User with active=true:', !!userWithBoolActive);
        
        // Try without active constraint
        const userAnyActive = await db.getAsync('SELECT * FROM users WHERE id = ?', [decoded.id]);
        console.log('User without active constraint:', !!userAnyActive);
        if (userAnyActive) {
          console.log('User active value:', userAnyActive.active, 'type:', typeof userAnyActive.active);
        }
      }
    } catch (userQueryError) {
      console.log('User query failed:', userQueryError.message);
      return res.status(500).json({ error: 'User lookup error' });
    }
    
    if (!user) {
      console.log('AUTH FAIL: User not found or inactive');
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user role and permissions
    try {
      const role = await db.getAsync('SELECT * FROM roles WHERE id = ?', [user.role]);
      console.log('User role found:', !!role, 'role ID:', user.role);
      const permissions = (role && role.permissions && typeof role.permissions === 'string') ? JSON.parse(role.permissions) : [];
      console.log('User permissions:', permissions);

      req.user = {
        ...user,
        id: user.id,
        permissions
      };

      console.log('AUTH SUCCESS: User authenticated, ID:', user.id);
      console.log('=== END AUTH DEBUG ===');
      next();
    } catch (roleError) {
      console.log('Role lookup failed:', roleError.message);
      return res.status(500).json({ error: 'Role lookup error' });
    }
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