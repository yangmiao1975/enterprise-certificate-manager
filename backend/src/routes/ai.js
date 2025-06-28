/**
 * Multi-AI Provider Routes
 * Handles chat, certificate analysis, and AI provider management
 */

import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { aiRouter } from '../services/ai/aiRouter.js';
import { sensitivityDetector } from '../services/ai/sensitivityDetector.js';
import { getDatabase } from '../database/flexible-init.js';
import crypto from 'crypto';

const router = express.Router();

// All AI routes require authentication
router.use(authMiddleware);

/**
 * POST /api/ai/chat
 * Chat with AI using user's preferred provider
 */
router.post('/chat', async (req, res) => {
  try {
    const { messages = [], message, provider, options = {} } = req.body;
    const userId = req.user.id;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Message is required and must be a string'
      });
    }

    // Analyze message for sensitive content
    const content = JSON.stringify(messages) + message;
    const sensitivity = sensitivityDetector.analyze(content, { userId, type: 'chat' });

    // Log chat attempt
    await logAIUsage(userId, provider || 'auto', null, 'chat', {
      sensitiveDataDetected: sensitivity.hasSensitiveData,
      sensitivity: sensitivity.sensitivity
    });

    // Store chat message in database for history
    const db = getDatabase();
    const chatHistory = { 
      messages: [...messages, { role: 'user', content: message }], 
      timestamp: new Date().toISOString(),
      sensitivity: sensitivity.sensitivity
    };
    
    await db.runAsync(
      'INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)',
      [`chat_history_${userId}`, JSON.stringify(chatHistory)]
    );

    // Route request to appropriate AI provider
    const result = await aiRouter.routeChatRequest(
      userId, 
      messages, 
      await buildSystemPrompt(),
      { provider, ...options }
    );

    // Log successful usage
    if (result.success) {
      await logAIUsage(
        userId, 
        result.metadata.provider, 
        result.metadata.model, 
        'chat',
        {
          tokensUsed: result.metadata.tokensUsed || 0,
          sensitiveDataDetected: sensitivity.hasSensitiveData,
          usingPersonalKey: result.metadata.usingPersonalKey
        }
      );
    }

    // Add sensitivity info to response
    result.sensitivity = {
      detected: sensitivity.hasSensitiveData,
      level: sensitivity.sensitivity,
      recommendation: sensitivity.recommendation,
      tips: sensitivity.getSecurityTips(sensitivity)
    };
    
    res.json(result);
  } catch (error) {
    console.error('Error in /ai/chat:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/ai/analyze-certificate/:id
 * Analyze a specific certificate with AI
 */
router.post('/analyze-certificate/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { provider } = req.body;
    const userId = req.user.id;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Certificate ID is required'
      });
    }

    // Get certificate from database
    const db = getDatabase();
    const certificate = await db.getAsync(`
      SELECT 
        c.*,
        f.name as folder_name,
        u.username as uploaded_by_user
      FROM certificates c
      LEFT JOIN folders f ON c.folder_id = f.id
      LEFT JOIN users u ON c.uploaded_by = u.id
      WHERE c.id = ?
    `, [id]);

    if (!certificate) {
      return res.status(404).json({
        success: false,
        error: 'Certificate not found'
      });
    }

    // Get related certificates for context
    const relatedCerts = await db.allAsync(`
      SELECT id, common_name, issuer, valid_to, status
      FROM certificates 
      WHERE (issuer = ? OR common_name LIKE ?) AND id != ?
      LIMIT 5
    `, [certificate.issuer, `%${certificate.common_name}%`, id]);

    const context = {
      certificate,
      relatedCertificates: relatedCerts,
      folder: certificate.folder_name,
      uploadedBy: certificate.uploaded_by_user
    };

    // Route to AI provider (certificate analysis always uses personal keys if available)
    const result = await aiRouter.routeCertificateAnalysis(
      userId,
      certificate.pem_content || '',
      context
    );

    // Log usage
    if (result.success) {
      await logAIUsage(
        userId,
        result.metadata.provider,
        result.metadata.model,
        'certificate_analysis',
        {
          certificateId: id,
          usingPersonalKey: result.metadata.usingPersonalKey
        }
      );
    }

    res.json(result);
  } catch (error) {
    console.error('Error in /ai/analyze-certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/ai/database-insights
 * Get AI insights about the entire certificate database
 */
router.get('/database-insights', async (req, res) => {
  try {
    const { provider } = req.query;
    const userId = req.user.id;

    // Check if user has admin or manager role
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions. Admin or Manager role required.'
      });
    }

    // Get database context
    const dbContext = await getCertificateContext();
    if (!dbContext) {
      return res.status(500).json({
        success: false,
        error: 'Could not access database context'
      });
    }

    // Route to AI provider
    const userConfig = await aiRouter.getUserAIConfig(userId);
    const targetProvider = provider || userConfig.primaryProvider || 'gemini';
    
    const providerInstance = await aiRouter.getProviderForUser(userId, targetProvider);
    if (!providerInstance) {
      return res.status(500).json({
        success: false,
        error: `Provider ${targetProvider} not available`
      });
    }

    const result = await providerInstance.generateInsights(dbContext);

    // Log usage
    await logAIUsage(
      userId,
      targetProvider,
      providerInstance.currentModel,
      'insights',
      {
        certificateCount: dbContext.summary.totalCertificates
      }
    );

    res.json({
      success: true,
      ...result,
      provider: targetProvider
    });
  } catch (error) {
    console.error('Error in /ai/database-insights:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/ai/parse-certificate
 * Parse certificate content with AI
 */
router.post('/parse-certificate', async (req, res) => {
  try {
    const { pemContent, fileName, provider } = req.body;
    const userId = req.user.id;
    
    if (!pemContent || typeof pemContent !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'PEM content is required and must be a string'
      });
    }

    // Analyze for sensitive content
    const sensitivity = sensitivityDetector.analyze(pemContent, { type: 'certificate_parsing' });

    // This is sensitive data - require personal keys
    if (!sensitivity.hasSensitiveData) {
      // If no certificate content detected, warn user
      return res.status(400).json({
        success: false,
        error: 'No valid certificate content detected in provided data'
      });
    }

    // Route to AI provider
    const result = await aiRouter.routeCertificateAnalysis(userId, pemContent, { fileName });

    // Log usage
    if (result.success) {
      await logAIUsage(
        userId,
        result.metadata.provider,
        result.metadata.model,
        'certificate_parsing',
        {
          fileName,
          usingPersonalKey: result.metadata.usingPersonalKey
        }
      );
    }

    res.json(result);
  } catch (error) {
    console.error('Error in /ai/parse-certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/ai/providers
 * Get available AI providers and user configuration
 */
router.get('/providers', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get available system providers
    const availableProviders = aiRouter.getAvailableProviders();
    
    // Get user configuration
    const userConfig = await aiRouter.getUserAIConfig(userId);
    
    // Get user's configured providers
    const userProviders = await aiRouter.getAvailableUserProviders(userId);

    res.json({
      success: true,
      system: availableProviders.system,
      user: {
        configured: userProviders,
        primaryProvider: userConfig.primaryProvider,
        fallbackProvider: userConfig.fallbackProvider,
        usePersonalKeys: userConfig.usePersonalKeys
      }
    });
  } catch (error) {
    console.error('Error in /ai/providers:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/ai/providers/configure
 * Configure user's AI provider settings
 */
router.post('/providers/configure', async (req, res) => {
  try {
    const { 
      primaryProvider, 
      fallbackProvider, 
      usePersonalKeys,
      apiKeys = {} 
    } = req.body;
    const userId = req.user.id;

    const db = getDatabase();

    // Update user settings
    await db.runAsync(`
      INSERT OR REPLACE INTO user_ai_settings 
      (user_id, primary_provider, fallback_provider, use_personal_keys, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [userId, primaryProvider, fallbackProvider, usePersonalKeys ? 1 : 0]);

    // Update API keys
    for (const [provider, apiKey] of Object.entries(apiKeys)) {
      if (apiKey && apiKey.trim()) {
        // Encrypt API key
        const encryptionKey = process.env.AI_KEY_ENCRYPTION_SECRET || 'default-key-change-in-production';
        const cipher = crypto.createCipher('aes192', encryptionKey);
        let encrypted = cipher.update(apiKey.trim(), 'utf8', 'hex');
        encrypted += cipher.final('hex');

        // Store encrypted key
        await db.runAsync(`
          INSERT OR REPLACE INTO user_ai_providers 
          (user_id, provider, api_key_encrypted, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `, [userId, provider, encrypted]);
      }
    }

    res.json({
      success: true,
      message: 'AI provider configuration updated successfully'
    });
  } catch (error) {
    console.error('Error in /ai/providers/configure:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update AI provider configuration'
    });
  }
});

/**
 * DELETE /api/ai/providers/:provider
 * Remove user's API key for a specific provider
 */
router.delete('/providers/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const userId = req.user.id;

    const db = getDatabase();
    await db.runAsync(
      'DELETE FROM user_ai_providers WHERE user_id = ? AND provider = ?',
      [userId, provider]
    );

    res.json({
      success: true,
      message: `API key for ${provider} removed successfully`
    });
  } catch (error) {
    console.error('Error removing provider API key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove API key'
    });
  }
});

/**
 * GET /api/ai/usage
 * Get user's AI usage statistics
 */
router.get('/usage', async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 7 } = req.query;

    const db = getDatabase();
    const usage = await db.allAsync(`
      SELECT 
        provider,
        model,
        request_type,
        COUNT(*) as request_count,
        SUM(tokens_used) as total_tokens,
        AVG(response_time_ms) as avg_response_time,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_requests,
        DATE(created_at) as date
      FROM ai_usage_logs 
      WHERE user_id = ? AND created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY provider, model, request_type, DATE(created_at)
      ORDER BY created_at DESC
    `, [userId, days]);

    const summary = await db.getAsync(`
      SELECT 
        COUNT(*) as total_requests,
        SUM(tokens_used) as total_tokens,
        COUNT(DISTINCT provider) as providers_used,
        AVG(response_time_ms) as avg_response_time,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate
      FROM ai_usage_logs 
      WHERE user_id = ? AND created_at >= datetime('now', '-' || ? || ' days')
    `, [userId, days]);

    res.json({
      success: true,
      usage,
      summary: summary || {},
      period: `${days} days`
    });
  } catch (error) {
    console.error('Error getting AI usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get usage statistics'
    });
  }
});

// Helper functions

async function getCertificateContext() {
  try {
    const db = getDatabase();
    
    // Get certificate summary
    const certificates = await db.allAsync(`
      SELECT 
        id, common_name, issuer, subject, valid_from, valid_to,
        algorithm, serial_number, status, folder_id, uploaded_at,
        gcp_certificate_name
      FROM certificates 
      ORDER BY uploaded_at DESC
    `);

    // Get folder information
    const folders = await db.allAsync(`
      SELECT id, name, description, type, permissions
      FROM folders
    `);

    // Get system metadata
    const metadata = await db.allAsync(`
      SELECT key, value, updated_at
      FROM metadata
    `);

    return {
      certificates,
      folders,
      metadata,
      summary: {
        totalCertificates: certificates.length,
        activeCertificates: certificates.filter(c => c.status === 'active').length,
        expiringSoon: certificates.filter(c => {
          const validTo = new Date(c.valid_to);
          const now = new Date();
          const daysUntilExpiry = (validTo - now) / (1000 * 60 * 60 * 24);
          return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
        }).length,
        expired: certificates.filter(c => new Date(c.valid_to) < new Date()).length
      }
    };
  } catch (error) {
    console.error('Error getting certificate context:', error);
    return null;
  }
}

async function buildSystemPrompt() {
  const dbContext = await getCertificateContext();
  
  let systemPrompt = `You are an expert certificate management assistant for an Enterprise Certificate Manager system.

CURRENT DATABASE CONTEXT:
`;

  if (dbContext) {
    systemPrompt += `
CERTIFICATE SUMMARY:
- Total certificates: ${dbContext.summary.totalCertificates}
- Active certificates: ${dbContext.summary.activeCertificates}
- Expiring soon (within 30 days): ${dbContext.summary.expiringSoon}
- Expired: ${dbContext.summary.expired}

CAPABILITIES:
- Analyze certificate data from the database
- Provide certificate management recommendations
- Help with certificate lifecycle management
- Explain certificate security best practices
- Parse and interpret certificate details
- Monitor certificate expiration and renewal needs
- Assist with multi-cloud certificate management

INSTRUCTIONS:
- Use the database context to answer specific questions about certificates
- Provide actionable recommendations based on current certificate status
- Alert about expired or soon-to-expire certificates
- Suggest certificate management improvements
- Keep responses professional and concise
- If asked about specific certificates, reference the database data
- For security advice, provide industry best practices`;
  } else {
    systemPrompt += "Database context unavailable - providing general certificate management assistance.";
  }

  return systemPrompt;
}

async function logAIUsage(userId, provider, model, requestType, metadata = {}) {
  try {
    const db = getDatabase();
    await db.runAsync(`
      INSERT INTO ai_usage_logs 
      (user_id, provider, model, request_type, tokens_used, response_time_ms, success, 
       sensitive_data_detected, used_personal_key, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      userId,
      provider,
      model,
      requestType,
      metadata.tokensUsed || 0,
      metadata.responseTime || 0,
      metadata.success !== false ? 1 : 0,
      metadata.sensitiveDataDetected ? 1 : 0,
      metadata.usingPersonalKey ? 1 : 0
    ]);
  } catch (error) {
    console.error('Error logging AI usage:', error);
  }
}

export default router;