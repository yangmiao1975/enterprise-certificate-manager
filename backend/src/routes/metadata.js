import express from 'express';
import { getDatabase } from '../database/init.js';
import { requirePermission } from '../middleware/auth.js';

const router = express.Router();

// Get system metadata
router.get('/', async (req, res, next) => {
  try {
    const db = getDatabase();
    
    const metadata = await db.get('SELECT value FROM metadata WHERE key = ?', ['system_config']);
    const config = metadata ? JSON.parse(metadata.value) : {};

    // Get additional system info
    const stats = await db.get(`
      SELECT 
        (SELECT COUNT(*) FROM certificates) as total_certificates,
        (SELECT COUNT(*) FROM certificates WHERE status = 'EXPIRED') as expired_certificates,
        (SELECT COUNT(*) FROM certificates WHERE status = 'EXPIRING_SOON') as expiring_soon_certificates,
        (SELECT COUNT(*) FROM folders) as total_folders,
        (SELECT COUNT(*) FROM users) as total_users
    `);

    res.json({
      ...config,
      stats
    });
  } catch (error) {
    next(error);
  }
});

// Update system metadata
router.put('/', requirePermission('system:settings'), async (req, res, next) => {
  try {
    const db = getDatabase();
    const { tempFolder, system } = req.body;

    const currentMetadata = await db.get('SELECT value FROM metadata WHERE key = ?', ['system_config']);
    const currentConfig = currentMetadata ? JSON.parse(currentMetadata.value) : {};

    const updatedConfig = {
      ...currentConfig,
      tempFolder: tempFolder || currentConfig.tempFolder,
      system: system || currentConfig.system
    };

    await db.run(
      'INSERT OR REPLACE INTO metadata (key, value, updated_at) VALUES (?, ?, ?)',
      ['system_config', JSON.stringify(updatedConfig), new Date().toISOString()]
    );

    res.json(updatedConfig);
  } catch (error) {
    next(error);
  }
});

// Get system statistics
router.get('/stats', async (req, res, next) => {
  try {
    const db = getDatabase();
    
    const stats = await db.get(`
      SELECT 
        (SELECT COUNT(*) FROM certificates) as total_certificates,
        (SELECT COUNT(*) FROM certificates WHERE status = 'VALID') as valid_certificates,
        (SELECT COUNT(*) FROM certificates WHERE status = 'EXPIRED') as expired_certificates,
        (SELECT COUNT(*) FROM certificates WHERE status = 'EXPIRING_SOON') as expiring_soon_certificates,
        (SELECT COUNT(*) FROM folders WHERE type = 'custom') as custom_folders,
        (SELECT COUNT(*) FROM folders WHERE type = 'system') as system_folders,
        (SELECT COUNT(*) FROM users WHERE active = 1) as active_users,
        (SELECT COUNT(*) FROM users WHERE active = 0) as inactive_users
    `);

    // Get certificates by status for chart
    const statusBreakdown = await db.all(`
      SELECT status, COUNT(*) as count
      FROM certificates
      GROUP BY status
    `);

    // Get certificates by month for trend
    const monthlyTrend = await db.all(`
      SELECT 
        strftime('%Y-%m', uploaded_at) as month,
        COUNT(*) as count
      FROM certificates
      WHERE uploaded_at >= date('now', '-12 months')
      GROUP BY month
      ORDER BY month
    `);

    res.json({
      ...stats,
      statusBreakdown,
      monthlyTrend
    });
  } catch (error) {
    next(error);
  }
});

// Get system health
router.get('/health', async (req, res, next) => {
  try {
    const db = getDatabase();
    
    // Check database connectivity
    const dbHealth = await db.get('SELECT 1 as health');
    
    // Check for expired certificates
    const expiredCount = await db.get('SELECT COUNT(*) as count FROM certificates WHERE status = "EXPIRED"');
    
    // Check for certificates expiring soon
    const expiringSoonCount = await db.get('SELECT COUNT(*) as count FROM certificates WHERE status = "EXPIRING_SOON"');

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: dbHealth ? 'connected' : 'disconnected',
      certificates: {
        expired: expiredCount.count,
        expiringSoon: expiringSoonCount.count
      }
    };

    if (!dbHealth || expiredCount.count > 10 || expiringSoonCount.count > 20) {
      health.status = 'warning';
    }

    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

export default router; 