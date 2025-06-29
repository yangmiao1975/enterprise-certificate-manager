/**
 * Health Check Routes for Database and System Monitoring
 * Provides endpoints for monitoring database connectivity and system health
 */

import express from 'express';
import { getDatabaseHealth, migration } from '../database/flexible-init.js';

const router = express.Router();

/**
 * Overall system health check
 */
router.get('/', async (req, res) => {
  try {
    const dbHealth = await getDatabaseHealth();
    const systemHealth = {
      status: dbHealth.status === 'healthy' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: dbHealth
    };

    const statusCode = systemHealth.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(systemHealth);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * Database specific health check
 */
router.get('/database', async (req, res) => {
  try {
    const startTime = Date.now();
    const health = await getDatabaseHealth();
    const responseTime = Date.now() - startTime;

    const response = {
      ...health,
      response_time: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    };

    // Add additional database info if healthy
    if (health.status === 'healthy') {
      response.configuration = {
        provider: health.provider,
        supported_providers: config.getSupportedProviders(),
        features: {
          ha: config.supportsFeature('ha'),
          backup: config.supportsFeature('backup'),
          scaling: config.supportsFeature('scaling'),
          monitoring: config.supportsFeature('monitoring')
        }
      };
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(response);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * Database configuration endpoint
 */
router.get('/database/config', async (req, res) => {
  try {
    const currentConfig = config.getCurrentConfig();
    const supportedProviders = config.getSupportedProviders();
    
    // Remove sensitive information
    const sanitizedConfig = {
      type: currentConfig?.type,
      provider: currentConfig?.provider,
      host: currentConfig?.host?.replace(/\/cloudsql\/.*/, '/cloudsql/***'),
      port: currentConfig?.port,
      database: currentConfig?.database,
      ssl: !!currentConfig?.ssl,
      pooling: {
        enabled: !!currentConfig?.extra,
        max: currentConfig?.extra?.max,
        min: currentConfig?.extra?.min
      }
    };

    res.json({
      current: sanitizedConfig,
      supported_providers: supportedProviders,
      features_by_provider: {
        sqlite: ['local', 'file-based', 'embedded'],
        'gcp-cloudsql': ['managed', 'ha', 'backup', 'scaling', 'monitoring'],
        'aws-rds': ['managed', 'ha', 'backup', 'scaling', 'monitoring', 'multi-az'],
        'azure-postgresql': ['managed', 'ha', 'backup', 'scaling', 'monitoring']
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get database configuration',
      message: error.message
    });
  }
});

/**
 * Migration status endpoint
 */
router.get('/database/migration', async (req, res) => {
  try {
    const migrationStatus = await migration.getStatus();
    
    res.json({
      ...migrationStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get migration status',
      message: error.message
    });
  }
});

/**
 * Trigger database migration (admin only)
 */
router.post('/database/migrate', async (req, res) => {
  try {
    // Check if migration is needed
    const migrationStatus = await migration.getStatus();
    
    if (!migrationStatus.migration_needed) {
      return res.json({
        message: 'No migration needed',
        current_provider: migrationStatus.current_provider,
        status: 'up_to_date'
      });
    }

    // Start migration (this should be done asynchronously in production)
    console.log('🚀 Starting database migration...');
    
    // For now, just return status - actual migration should be triggered manually
    res.json({
      message: 'Migration can be triggered',
      instructions: [
        '1. Ensure Cloud SQL instance is created and configured',
        '2. Set CLOUDSQL_* environment variables',
        '3. Run: node src/database/migrate-to-cloudsql.js',
        '4. Update DATABASE_PROVIDER environment variable',
        '5. Restart the application'
      ],
      current_provider: migrationStatus.current_provider,
      recommended_provider: migrationStatus.recommended_provider
    });
  } catch (error) {
    res.status(500).json({
      error: 'Migration failed',
      message: error.message
    });
  }
});

/**
 * Database provider validation
 */
router.get('/database/validate/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const isValid = config.validateProvider(provider);
    const supportedProviders = config.getSupportedProviders();
    
    if (!supportedProviders.includes(provider)) {
      return res.status(400).json({
        valid: false,
        error: `Unsupported provider: ${provider}`,
        supported_providers: supportedProviders
      });
    }

    res.json({
      provider,
      valid: isValid,
      supported: true,
      features: {
        ha: config.supportsFeature('ha'),
        backup: config.supportsFeature('backup'),
        scaling: config.supportsFeature('scaling'),
        monitoring: config.supportsFeature('monitoring')
      }
    });
  } catch (error) {
    res.status(500).json({
      valid: false,
      error: error.message
    });
  }
});

/**
 * Readiness probe (for Kubernetes/Cloud Run)
 */
router.get('/ready', async (req, res) => {
  try {
    const health = await getDatabaseHealth();
    
    if (health.status === 'healthy') {
      res.status(200).json({ status: 'ready' });
    } else {
      res.status(503).json({ status: 'not_ready', reason: health.error });
    }
  } catch (error) {
    res.status(503).json({ status: 'not_ready', reason: error.message });
  }
});

/**
 * Liveness probe (for Kubernetes/Cloud Run)
 */
router.get('/live', (req, res) => {
  // Simple liveness check - if we can respond, we're alive
  res.status(200).json({ 
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * Metrics endpoint (basic application metrics)
 */
router.get('/metrics', async (req, res) => {
  try {
    const health = await getDatabaseHealth();
    const memUsage = process.memoryUsage();
    
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime_seconds: process.uptime(),
      memory: {
        rss_bytes: memUsage.rss,
        heap_used_bytes: memUsage.heapUsed,
        heap_total_bytes: memUsage.heapTotal,
        external_bytes: memUsage.external
      },
      database: {
        status: health.status,
        provider: health.provider,
        connected: health.connected
      },
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0'
    };

    res.json(metrics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to collect metrics',
      message: error.message
    });
  }
});

export default router;