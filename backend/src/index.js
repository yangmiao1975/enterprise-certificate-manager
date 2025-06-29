console.log('TOP LEVEL LOG: index.js is running');

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import routes
import authRoutes from './routes/auth.js';
import certificateRoutes from './routes/certificates.js';
import folderRoutes from './routes/folders.js';
import metadataRoutes from './routes/metadata.js';
import userRoutes from './routes/users.js';
import geminiRoutes from './routes/gemini.js';
import aiRoutes from './routes/ai.js';
import gcpDiagnosticsRoutes from './routes/gcp-diagnostics.js';
import healthRoutes from './routes/health.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';

// Import flexible database initialization
import { initializeDatabase } from './database/flexible-init.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://certificate-manager-frontend-1044697249626.us-central1.run.app',
    process.env.CORS_ORIGIN
  ].filter(Boolean),
  credentials: true
}));

// Logging middleware
app.use(morgan('combined'));

// Static files
app.use('/uploads', express.static(join(__dirname, '../uploads')));

// Body parsing middleware (must come before routes that need req.body)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoints
app.use('/api/health', healthRoutes);
app.get('/health', (req, res) => {
  console.log('HIT /health route');
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes (body parsers must come before these)
app.use('/api/auth', authRoutes);
app.use('/api/certificates', authMiddleware, certificateRoutes);
app.use('/api/folders', authMiddleware, folderRoutes);
app.use('/api/metadata', authMiddleware, metadataRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/gemini', geminiRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/gcp-diagnostics', gcpDiagnosticsRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize database and start server
async function startServer() {
  try {
    await initializeDatabase();
    console.log('Database initialized successfully');
    
    console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID);
    
    // Environment variable checks for debugging
    console.log('=== ENVIRONMENT VARIABLE CHECK ===');
    console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET (length: ' + process.env.JWT_SECRET.length + ')' : 'MISSING');
    console.log('GCP_PROJECT_ID:', process.env.GCP_PROJECT_ID ? 'SET' : 'MISSING');
    console.log('DATABASE_TYPE:', process.env.DATABASE_TYPE || 'NOT SET');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'MISSING');
    console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
    console.log('CORS_ORIGIN:', process.env.CORS_ORIGIN || 'NOT SET');
    console.log('=== END ENVIRONMENT CHECK ===');
    
    // Startup check for GOOGLE_CALLBACK_URL
    if (!process.env.GOOGLE_CALLBACK_URL) {
      console.error('ERROR: GOOGLE_CALLBACK_URL is not set!');
      process.exit(1);
    }
    if (!process.env.GOOGLE_CALLBACK_URL.includes('/api/auth/google/callback')) {
      console.warn('WARNING: GOOGLE_CALLBACK_URL may be incorrect:', process.env.GOOGLE_CALLBACK_URL);
    }
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    
    // In production, try to start server anyway for debugging
    if (process.env.NODE_ENV === 'production') {
      console.log('🚨 Starting server despite database error for debugging...');
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT} (DATABASE ERROR MODE)`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      });
    } else {
      process.exit(1);
    }
  }
}

startServer();

export default app; 