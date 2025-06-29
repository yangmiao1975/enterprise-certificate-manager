/**
 * AI Service Tests
 * Tests for AI router and provider logic
 */

import { jest } from '@jest/globals';

// Mock database
const mockDb = {
  getAsync: jest.fn(),
  allAsync: jest.fn(),
  query: jest.fn()
};

jest.unstable_mockModule('../src/database/flexible-init.js', () => ({
  getDatabase: () => mockDb,
  getDatabaseProvider: () => 'sqlite'
}));

// Import after mocking
const { AIRouter } = await import('../src/services/ai/aiRouter.js');

describe('AI Service', () => {
  let aiRouter;

  beforeEach(() => {
    aiRouter = new AIRouter();
    jest.clearAllMocks();
  });

  describe('AIRouter', () => {
    describe('getUserAIConfig', () => {
      it('should return user AI configuration', async () => {
        const mockConfig = {
          provider_configs: '{"openai": {"model": "gpt-4"}}',
          primary_provider: 'openai',
          fallback_provider: 'claude',
          use_personal_keys: 1
        };

        mockDb.getAsync.mockResolvedValue(mockConfig);

        const result = await aiRouter.getUserAIConfig(123);

        expect(result).toEqual({
          primaryProvider: 'openai',
          fallbackProvider: 'claude',
          usePersonalKeys: true,
          providerConfigs: { openai: { model: 'gpt-4' } }
        });

        expect(mockDb.getAsync).toHaveBeenCalledWith(
          'SELECT provider_configs, primary_provider, fallback_provider, use_personal_keys FROM user_ai_settings WHERE user_id = ?',
          [123]
        );
      });

      it('should return defaults when no config exists', async () => {
        mockDb.getAsync.mockResolvedValue(null);

        const result = await aiRouter.getUserAIConfig(123);

        expect(result).toEqual({
          primaryProvider: null,
          fallbackProvider: null,
          usePersonalKeys: false,
          providerConfigs: {}
        });
      });

      it('should handle database errors gracefully', async () => {
        mockDb.getAsync.mockRejectedValue(new Error('Database error'));

        const result = await aiRouter.getUserAIConfig(123);

        expect(result).toEqual({
          primaryProvider: null,
          fallbackProvider: null,
          usePersonalKeys: false,
          providerConfigs: {}
        });
      });
    });

    describe('getAvailableUserProviders', () => {
      it('should return list of user configured providers', async () => {
        const mockProviders = [
          { provider: 'openai' },
          { provider: 'claude' }
        ];

        mockDb.allAsync.mockResolvedValue(mockProviders);

        const result = await aiRouter.getAvailableUserProviders(123);

        expect(result).toEqual(['openai', 'claude']);
        expect(mockDb.allAsync).toHaveBeenCalledWith(
          'SELECT provider FROM user_ai_providers WHERE user_id = ?',
          [123]
        );
      });

      it('should return empty array on database error', async () => {
        mockDb.allAsync.mockRejectedValue(new Error('Database error'));

        const result = await aiRouter.getAvailableUserProviders(123);

        expect(result).toEqual([]);
      });
    });

    describe('containsSensitiveData', () => {
      it('should detect certificate content', () => {
        const content = '-----BEGIN CERTIFICATE-----\nMIIBkTCB...';
        
        const result = aiRouter.containsSensitiveData(content);
        
        expect(result).toBe(true);
      });

      it('should detect private keys', () => {
        const content = '-----BEGIN PRIVATE KEY-----\nMIIEvQ...';
        
        const result = aiRouter.containsSensitiveData(content);
        
        expect(result).toBe(true);
      });

      it('should detect PEM content references', () => {
        const content = 'Please analyze this pem_content for issues';
        
        const result = aiRouter.containsSensitiveData(content);
        
        expect(result).toBe(true);
      });

      it('should not detect regular text', () => {
        const content = 'Hello, how are you today?';
        
        const result = aiRouter.containsSensitiveData(content);
        
        expect(result).toBe(false);
      });
    });

    describe('createProvider', () => {
      it('should create OpenAI provider', () => {
        const provider = aiRouter.createProvider('openai', 'sk-test-key');
        
        expect(provider).toBeDefined();
        expect(provider.constructor.name).toBe('OpenAIProvider');
      });

      it('should create Claude provider', () => {
        const provider = aiRouter.createProvider('claude', 'sk-ant-test-key');
        
        expect(provider).toBeDefined();
        expect(provider.constructor.name).toBe('ClaudeProvider');
      });

      it('should throw error for unknown provider', () => {
        expect(() => {
          aiRouter.createProvider('unknown', 'test-key');
        }).toThrow('Unknown provider: unknown');
      });
    });

    describe('getAvailableProviders', () => {
      it('should return available system providers', () => {
        // Mock some system providers
        process.env.GEMINI_API_KEY = 'test-gemini-key';
        process.env.OPENAI_API_KEY = 'test-openai-key';
        
        const newRouter = new AIRouter();
        const result = newRouter.getAvailableProviders();
        
        expect(result.system).toBeDefined();
        expect(result.system.length).toBeGreaterThan(0);
        
        // Cleanup
        delete process.env.GEMINI_API_KEY;
        delete process.env.OPENAI_API_KEY;
      });
    });
  });

  describe('Provider Integration', () => {
    it('should route certificate analysis to user provider', async () => {
      const mockUserConfig = {
        primaryProvider: 'openai',
        fallbackProvider: 'claude',
        usePersonalKeys: true,
        providerConfigs: {}
      };

      const mockApiKey = 'sk-user-key';
      const mockProvider = {
        analyzeCertificate: jest.fn().mockResolvedValue({
          analysis: 'Certificate is valid',
          recommendations: []
        })
      };

      jest.spyOn(aiRouter, 'getUserAIConfig').mockResolvedValue(mockUserConfig);
      jest.spyOn(aiRouter, 'getUserApiKey').mockResolvedValue(mockApiKey);
      jest.spyOn(aiRouter, 'createProvider').mockReturnValue(mockProvider);
      jest.spyOn(aiRouter, 'getAvailableUserProviders').mockResolvedValue(['openai']);

      const result = await aiRouter.routeCertificateAnalysis(
        123,
        '-----BEGIN CERTIFICATE-----\ntest',
        { certId: '456' }
      );

      expect(result.success).toBe(true);
      expect(result.metadata.usingPersonalKey).toBe(true);
      expect(mockProvider.analyzeCertificate).toHaveBeenCalledWith(
        '-----BEGIN CERTIFICATE-----\ntest',
        { certId: '456' }
      );
    });

    it('should require personal keys for certificate analysis', async () => {
      jest.spyOn(aiRouter, 'getAvailableUserProviders').mockResolvedValue([]);

      const result = await aiRouter.routeCertificateAnalysis(
        123,
        '-----BEGIN CERTIFICATE-----\ntest'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('personal AI keys');
    });
  });
});