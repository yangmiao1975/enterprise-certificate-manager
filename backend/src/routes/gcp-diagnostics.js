/**
 * GCP Diagnostics Routes
 * Endpoints to help troubleshoot GCP certificate upload issues
 */

import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import gcpCertificateService from '../services/gcpCertificateService.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/gcp-diagnostics/status
 * Check GCP service status and configuration
 */
router.get('/status', async (req, res) => {
  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        gcpProjectId: process.env.GCP_PROJECT_ID || 'NOT_SET',
        gcpLocation: process.env.GCP_LOCATION || 'us-central1',
        gcpAutoBuildChain: process.env.GCP_AUTO_BUILD_CHAIN || 'false'
      },
      services: {}
    };

    // Test Cloud Storage connectivity
    try {
      const bucketName = `${process.env.GCP_PROJECT_ID}-certificates`;
      await gcpCertificateService.ensureBucketExists(bucketName);
      diagnostics.services.cloudStorage = {
        status: 'healthy',
        bucketName: bucketName,
        message: 'Cloud Storage bucket accessible'
      };
    } catch (storageError) {
      diagnostics.services.cloudStorage = {
        status: 'error',
        message: storageError.message,
        suggestion: 'Check GCP credentials and project permissions'
      };
    }

    // Check GCP project configuration
    try {
      if (!process.env.GCP_PROJECT_ID) {
        throw new Error('GCP_PROJECT_ID environment variable not set');
      }
      
      diagnostics.services.configuration = {
        status: 'healthy',
        message: 'GCP configuration appears valid'
      };
    } catch (configError) {
      diagnostics.services.configuration = {
        status: 'error',
        message: configError.message,
        suggestion: 'Set GCP_PROJECT_ID environment variable'
      };
    }

    // Overall health status
    const hasErrors = Object.values(diagnostics.services).some(service => service.status === 'error');
    diagnostics.overallStatus = hasErrors ? 'degraded' : 'healthy';

    res.json(diagnostics);
  } catch (error) {
    res.status(500).json({
      error: 'Diagnostics check failed',
      message: error.message
    });
  }
});

/**
 * POST /api/gcp-diagnostics/test-upload
 * Test certificate upload with a sample certificate
 */
router.post('/test-upload', async (req, res) => {
  try {
    // Sample self-signed certificate for testing
    const testCertPem = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKZlNjJgI8FTMA0GCSqGSIb3DQEBCwUAMBQxEjAQBgNVBAMMCXRl
c3QtY2VydDAeFw0yNDEyMjgwMDAwMDBaFw0yNTEyMjgwMDAwMDBaMBQxEjAQBgNV
BAMMCXRlc3QtY2VydDBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABKZlNjJgI8FT
MA0GCSqGSIb3DQEBCwUAMBQxEjAQBgNVBAMMCXRlc3QtY2VydDAeFw0yNDEyMjgw
MDAwMDBaFw0yNTEyMjgwMDAwMDBaMBQxEjAQBgNVBAMMCXRlc3QtY2VydDBZMBMG
ByqGSM49AgEGCCqGSM49AwEHA0IABKZlNjJgI8FTMA0GCSqGSIb3DQEBCwUAMBQx
EjAQBgNVBAMMCXRlc3QtY2VydDAeFw0yNDEyMjgwMDAwMDBa
-----END CERTIFICATE-----`;

    console.log('[Diagnostics] Testing certificate upload...');
    
    const testResult = await gcpCertificateService.createCertificate(
      {
        commonName: 'test-cert',
        issuer: 'Test CA',
        subject: 'CN=test-cert',
        validFrom: '2024-12-28T00:00:00Z',
        validTo: '2025-12-28T00:00:00Z',
        algorithm: 'sha256WithRSAEncryption',
        serialNumber: '123456789',
        status: 'Valid'
      },
      Buffer.from(testCertPem)
    );

    // Clean up test certificate immediately
    try {
      await gcpCertificateService.deleteCertificate(testResult.id);
      console.log('[Diagnostics] Test certificate cleaned up');
    } catch (cleanupError) {
      console.warn('[Diagnostics] Failed to clean up test certificate:', cleanupError.message);
    }

    res.json({
      status: 'success',
      message: 'Test certificate upload completed successfully',
      testResult: {
        certificateId: testResult.id,
        gcpLocation: testResult.gcpCertificateName,
        uploadedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[Diagnostics] Test upload failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Test certificate upload failed',
      error: error.message,
      suggestions: [
        'Check GCP credentials are properly configured',
        'Verify GCP project ID is correct',
        'Ensure Cloud Storage API is enabled',
        'Check network connectivity to GCP services'
      ]
    });
  }
});

/**
 * GET /api/gcp-diagnostics/bucket-info
 * Get information about the GCP storage bucket
 */
router.get('/bucket-info', async (req, res) => {
  try {
    const bucketName = `${process.env.GCP_PROJECT_ID}-certificates`;
    
    // Get bucket metadata
    const storage = gcpCertificateService.storage;
    const bucket = storage.bucket(bucketName);
    
    const [metadata] = await bucket.getMetadata();
    const [files] = await bucket.getFiles({ maxResults: 10 });
    
    res.json({
      bucketName: bucketName,
      location: metadata.location,
      created: metadata.timeCreated,
      storageClass: metadata.storageClass,
      fileCount: files.length,
      recentFiles: files.map(file => ({
        name: file.name,
        size: file.metadata.size,
        created: file.metadata.timeCreated,
        updated: file.metadata.updated
      }))
    });

  } catch (error) {
    res.status(500).json({
      error: 'Failed to get bucket information',
      message: error.message
    });
  }
});

export default router;