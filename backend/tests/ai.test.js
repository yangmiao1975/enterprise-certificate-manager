/**
 * AI Settings API Tests
 * Tests for AI provider management and configuration endpoints
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';

// Mock dependencies
const mockDb = {
  allAsync: jest.fn(),
  runAsync: jest.fn(),
  getAsync: jest.fn()
};

const mockAIRouter = {
  getUserAIConfig: jest.fn(),
  getUserApiKey: jest.fn(),
  createProvider: jest.fn(),
  getAvailableProviders: jest.fn(),
  getAvailableUserProviders: jest.fn()
};

// Mock modules before importing the app
jest.unstable_mockModule('../src/database/flexible-init.js', () => ({
  getDatabase: () => mockDb
}));

jest.unstable_mockModule('../src/services/ai/aiRouter.js', () => ({
  aiRouter: mockAIRouter
}));

// Import the app after mocking
const { default: app } = await import('../src/index.js');

describe('AI Settings API', () => {
  let authToken;
  const testUserId = 123;
  const testUser = {
    id: testUserId,
    username: 'testuser',
    email: 'test@example.com',
    role: 'admin'
  };

  beforeAll(() => {
    // Create a valid JWT token for testing
    authToken = jwt.sign(testUser, process.env.JWT_SECRET || 'test-secret');
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Default mock responses
    mockAIRouter.getUserAIConfig.mockResolvedValue({
      primaryProvider: null,
      fallbackProvider: null,
      usePersonalKeys: false,
      providerConfigs: {}
    });
    
    mockAIRouter.getAvailableProviders.mockReturnValue({
      system: [
        { provider: 'gemini', info: { name: 'Google Gemini' } },
        { provider: 'openai', info: { name: 'OpenAI' } }
      ]
    });
    
    mockDb.allAsync.mockResolvedValue([]);
    mockDb.runAsync.mockResolvedValue({ changes: 1 });
    mockDb.getAsync.mockResolvedValue(null);
  });

  describe('GET /api/ai/settings', () => {
    it('should return user AI settings', async () => {
      const mockProviders = [
        {
          provider: 'openai',
          api_key_encrypted: 'encrypted_key_data',
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      mockDb.allAsync.mockResolvedValue(mockProviders);
      mockAIRouter.getUserAIConfig.mockResolvedValue({
        primaryProvider: 'openai',
        fallbackProvider: 'gemini',
        usePersonalKeys: true,
        providerConfigs: {}
      });

      const response = await request(app)
        .get('/api/ai/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({
        primaryProvider: 'openai',
        fallbackProvider: 'gemini',
        usePersonalKeys: true,
        providers: [
          {
            provider: 'openai',
            apiKey: '***encrypted***',
            isActive: true,
            addedAt: '2024-01-01T00:00:00Z'
          }
        ]
      });

      expect(mockDb.allAsync).toHaveBeenCalledWith(
        'SELECT provider, api_key_encrypted, created_at FROM user_ai_providers WHERE user_id = ?',
        [testUserId]
      );
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/ai/settings')
        .expect(401);
    });

    it('should handle database errors', async () => {
      mockDb.allAsync.mockRejectedValue(new Error('Database error'));

      await request(app)
        .get('/api/ai/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);
    });
  });

  describe('PUT /api/ai/settings', () => {
    it('should update user AI settings', async () => {
      const settingsUpdate = {
        primaryProvider: 'openai',
        fallbackProvider: 'claude',
        usePersonalKeys: true
      };

      const response = await request(app)
        .put('/api/ai/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send(settingsUpdate)
        .expect(200);

      expect(response.body).toEqual({ success: true });

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO user_ai_settings'),
        [testUserId, 'openai', 'claude', 1]
      );
    });

    it('should handle missing fields gracefully', async () => {
      const response = await request(app)
        .put('/api/ai/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(200);

      expect(response.body).toEqual({ success: true });
    });
  });

  describe('POST /api/ai/providers', () => {
    it('should add a new AI provider', async () => {
      const providerData = {
        provider: 'openai',
        apiKey: 'sk-test-key-123'
      };

      const response = await request(app)
        .post('/api/ai/providers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(providerData)
        .expect(200);

      expect(response.body).toEqual({ success: true });

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO user_ai_providers'),
        expect.arrayContaining([testUserId, 'openai', expect.any(String)])
      );
    });

    it('should require provider and apiKey', async () => {
      await request(app)
        .post('/api/ai/providers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ provider: 'openai' })
        .expect(400);

      await request(app)
        .post('/api/ai/providers')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ apiKey: 'sk-test' })
        .expect(400);
    });

    it('should encrypt API keys', async () => {
      const providerData = {
        provider: 'openai',
        apiKey: 'sk-test-key-123'
      };

      await request(app)
        .post('/api/ai/providers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(providerData)
        .expect(200);

      // Verify that the API key was encrypted (not stored in plain text)
      const dbCall = mockDb.runAsync.mock.calls[0];
      const encryptedKey = dbCall[1][2];
      expect(encryptedKey).not.toBe('sk-test-key-123');
      expect(encryptedKey).toMatch(/^[a-f0-9]+$/); // Should be hex-encoded
    });
  });

  describe('DELETE /api/ai/providers/:provider', () => {
    it('should remove an AI provider', async () => {
      const response = await request(app)
        .delete('/api/ai/providers/openai')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({ success: true });

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'DELETE FROM user_ai_providers WHERE user_id = ? AND provider = ?',
        [testUserId, 'openai']
      );
    });
  });

  describe('POST /api/ai/test', () => {
    it('should test an AI provider with provided API key', async () => {
      const mockProvider = {
        generateChatResponse: jest.fn().mockResolvedValue({
          content: 'test successful'
        })
      };

      mockAIRouter.createProvider.mockReturnValue(mockProvider);

      const testData = {
        provider: 'openai',
        apiKey: 'sk-test-key'
      };

      const response = await request(app)
        .post('/api/ai/test')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Connection test successful'
      });

      expect(mockAIRouter.createProvider).toHaveBeenCalledWith('openai', 'sk-test-key');
      expect(mockProvider.generateChatResponse).toHaveBeenCalled();
    });

    it('should test with stored API key if none provided', async () => {
      mockAIRouter.getUserApiKey.mockResolvedValue('stored-api-key');
      
      const mockProvider = {
        generateChatResponse: jest.fn().mockResolvedValue({
          content: 'test successful'
        })
      };

      mockAIRouter.createProvider.mockReturnValue(mockProvider);

      const response = await request(app)
        .post('/api/ai/test')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ provider: 'openai' })
        .expect(200);

      expect(mockAIRouter.getUserApiKey).toHaveBeenCalledWith(testUserId, 'openai');
      expect(mockAIRouter.createProvider).toHaveBeenCalledWith('openai', 'stored-api-key');
    });

    it('should handle test failures', async () => {
      const mockProvider = {
        generateChatResponse: jest.fn().mockRejectedValue(new Error('API error'))
      };

      mockAIRouter.createProvider.mockReturnValue(mockProvider);

      const response = await request(app)
        .post('/api/ai/test')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ provider: 'openai', apiKey: 'sk-test' })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Test failed');
    });

    it('should require provider parameter', async () => {
      await request(app)
        .post('/api/ai/test')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('GET /api/ai/providers/available', () => {
    it('should return available system providers', async () => {
      const response = await request(app)
        .get('/api/ai/providers/available')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({
        system: ['gemini', 'openai']
      });
    });
  });

  describe('Authentication', () => {
    it('should reject requests without authorization header', async () => {
      await request(app)
        .get('/api/ai/settings')
        .expect(401);
    });

    it('should reject requests with invalid tokens', async () => {
      await request(app)
        .get('/api/ai/settings')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject requests with expired tokens', async () => {
      const expiredToken = jwt.sign(
        { ...testUser, exp: Math.floor(Date.now() / 1000) - 3600 }, // Expired 1 hour ago
        process.env.JWT_SECRET || 'test-secret'
      );

      await request(app)
        .get('/api/ai/settings')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection failures', async () => {
      mockDb.allAsync.mockRejectedValue(new Error('Connection failed'));

      await request(app)
        .get('/api/ai/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);
    });

    it('should handle malformed request data', async () => {
      await request(app)
        .post('/api/ai/providers')
        .set('Authorization', `Bearer ${authToken}`)
        .send('invalid-json')
        .expect(400);
    });
  });
});