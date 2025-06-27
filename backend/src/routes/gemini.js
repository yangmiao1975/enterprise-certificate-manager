import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getChatResponseWithDB, analyzeCertificateWithDB, getDatabaseInsights, parseCertificateWithGemini } from '../services/geminiService.js';
import { getDatabase } from '../database/init.js';

const router = express.Router();

// All Gemini routes require authentication
router.use(authMiddleware);

/**
 * POST /api/gemini/chat
 * Chat with Gemini AI with database context
 */
router.post('/chat', async (req, res) => {
  try {
    const { messages = [], message } = req.body;
    const userId = req.user.id;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Message is required and must be a string'
      });
    }

    // Store chat message in database for history
    const db = getDatabase();
    await db.runAsync(
      'INSERT OR IGNORE INTO metadata (key, value) VALUES (?, ?)',
      [`chat_history_${userId}`, JSON.stringify({ messages, timestamp: new Date().toISOString() })]
    );

    const result = await getChatResponseWithDB(messages, message, userId);
    
    res.json(result);
  } catch (error) {
    console.error('Error in /gemini/chat:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/gemini/analyze-certificate/:id
 * Analyze a specific certificate with AI
 */
router.post('/analyze-certificate/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Certificate ID is required'
      });
    }

    const result = await analyzeCertificateWithDB(id);
    res.json(result);
  } catch (error) {
    console.error('Error in /gemini/analyze-certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/gemini/database-insights
 * Get AI insights about the entire certificate database
 */
router.get('/database-insights', async (req, res) => {
  try {
    // Check if user has admin or manager role
    if (!['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions. Admin or Manager role required.'
      });
    }

    const result = await getDatabaseInsights();
    res.json(result);
  } catch (error) {
    console.error('Error in /gemini/database-insights:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/gemini/parse-certificate
 * Parse certificate content with AI
 */
router.post('/parse-certificate', async (req, res) => {
  try {
    const { pemContent, fileName } = req.body;
    
    if (!pemContent || typeof pemContent !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'PEM content is required and must be a string'
      });
    }

    const result = await parseCertificateWithGemini(pemContent, fileName);
    res.json(result);
  } catch (error) {
    console.error('Error in /gemini/parse-certificate:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/gemini/chat-history
 * Get user's chat history
 */
router.get('/chat-history', async (req, res) => {
  try {
    const userId = req.user.id;
    const db = getDatabase();
    
    const history = await db.getAsync(
      'SELECT value FROM metadata WHERE key = ?',
      [`chat_history_${userId}`]
    );
    
    if (history) {
      res.json({
        success: true,
        history: JSON.parse(history.value)
      });
    } else {
      res.json({
        success: true,
        history: { messages: [], timestamp: new Date().toISOString() }
      });
    }
  } catch (error) {
    console.error('Error in /gemini/chat-history:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/gemini/chat-history
 * Clear user's chat history
 */
router.delete('/chat-history', async (req, res) => {
  try {
    const userId = req.user.id;
    const db = getDatabase();
    
    await db.runAsync(
      'DELETE FROM metadata WHERE key = ?',
      [`chat_history_${userId}`]
    );
    
    res.json({
      success: true,
      message: 'Chat history cleared'
    });
  } catch (error) {
    console.error('Error in /gemini/chat-history DELETE:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/gemini/certificate-recommendations
 * Get AI recommendations for certificate management
 */
router.get('/certificate-recommendations', async (req, res) => {
  try {
    const db = getDatabase();
    
    // Get certificates expiring soon
    const expiringCerts = await db.allAsync(`
      SELECT id, common_name, valid_to, status
      FROM certificates 
      WHERE datetime(valid_to) <= datetime('now', '+30 days')
      AND datetime(valid_to) > datetime('now')
      ORDER BY valid_to ASC
    `);

    // Get expired certificates
    const expiredCerts = await db.allAsync(`
      SELECT id, common_name, valid_to, status
      FROM certificates 
      WHERE datetime(valid_to) <= datetime('now')
      ORDER BY valid_to DESC
    `);

    const recommendations = [];

    if (expiredCerts.length > 0) {
      recommendations.push({
        priority: 'High',
        type: 'renewal',
        title: 'Expired Certificates Detected',
        description: `${expiredCerts.length} certificate(s) have expired and need immediate attention.`,
        certificates: expiredCerts.map(c => c.id),
        action: 'Renew or replace expired certificates immediately'
      });
    }

    if (expiringCerts.length > 0) {
      recommendations.push({
        priority: 'Medium',
        type: 'renewal',
        title: 'Certificates Expiring Soon',
        description: `${expiringCerts.length} certificate(s) will expire within 30 days.`,
        certificates: expiringCerts.map(c => c.id),
        action: 'Schedule renewal for certificates expiring soon'
      });
    }

    res.json({
      success: true,
      recommendations,
      summary: {
        expired: expiredCerts.length,
        expiringSoon: expiringCerts.length,
        totalIssues: expiredCerts.length + expiringCerts.length
      }
    });
  } catch (error) {
    console.error('Error in /gemini/certificate-recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;