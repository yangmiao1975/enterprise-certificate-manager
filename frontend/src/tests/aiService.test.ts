/**
 * AI Service Tests
 * Tests for the AI service API client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { aiService, AI_PROVIDER_INFO } from '../services/aiService';
import { AIProvider } from '../types';
import * as apiService from '../services/apiService';

// Mock the API service
vi.mock('../services/apiService');
const mockApiService = vi.mocked(apiService);

describe('aiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserAISettings', () => {
    it('should return user AI settings', async () => {
      const mockSettings = {
        primaryProvider: AIProvider.OPENAI,
        fallbackProvider: AIProvider.CLAUDE,
        usePersonalKeys: true,
        providers: [
          {
            provider: AIProvider.OPENAI,
            apiKey: 'sk-test-key',
            isActive: true,
            addedAt: '2024-01-01T00:00:00Z'
          }
        ]
      };

      mockApiService.apiService.get.mockResolvedValue({ data: mockSettings });

      const result = await aiService.getUserAISettings();

      expect(result).toEqual(mockSettings);
      expect(mockApiService.apiService.get).toHaveBeenCalledWith('/api/ai/settings');
    });

    it('should return defaults on error', async () => {
      mockApiService.apiService.get.mockRejectedValue(new Error('API Error'));

      const result = await aiService.getUserAISettings();

      expect(result).toEqual({
        primaryProvider: null,
        fallbackProvider: null,
        usePersonalKeys: false,
        providers: []
      });
    });
  });

  describe('updateUserAISettings', () => {
    it('should update user AI settings', async () => {
      const settings = {
        primaryProvider: AIProvider.OPENAI,
        fallbackProvider: AIProvider.CLAUDE,
        usePersonalKeys: true
      };

      mockApiService.apiService.put.mockResolvedValue({});

      await aiService.updateUserAISettings(settings);

      expect(mockApiService.apiService.put).toHaveBeenCalledWith('/api/ai/settings', settings);
    });

    it('should throw on API error', async () => {
      mockApiService.apiService.put.mockRejectedValue(new Error('Update failed'));

      await expect(aiService.updateUserAISettings({})).rejects.toThrow('Update failed');
    });
  });

  describe('addOrUpdateProvider', () => {
    it('should add a new provider', async () => {
      mockApiService.apiService.post.mockResolvedValue({});

      await aiService.addOrUpdateProvider(AIProvider.OPENAI, 'sk-test-key');

      expect(mockApiService.apiService.post).toHaveBeenCalledWith('/api/ai/providers', {
        provider: AIProvider.OPENAI,
        apiKey: 'sk-test-key'
      });
    });

    it('should throw on API error', async () => {
      mockApiService.apiService.post.mockRejectedValue(new Error('Add failed'));

      await expect(
        aiService.addOrUpdateProvider(AIProvider.OPENAI, 'sk-test-key')
      ).rejects.toThrow('Add failed');
    });
  });

  describe('removeProvider', () => {
    it('should remove a provider', async () => {
      mockApiService.apiService.delete.mockResolvedValue({});

      await aiService.removeProvider(AIProvider.OPENAI);

      expect(mockApiService.apiService.delete).toHaveBeenCalledWith('/api/ai/providers/openai');
    });

    it('should throw on API error', async () => {
      mockApiService.apiService.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(aiService.removeProvider(AIProvider.OPENAI)).rejects.toThrow('Delete failed');
    });
  });

  describe('testProvider', () => {
    it('should test provider with API key', async () => {
      const mockResponse = { success: true, message: 'Test successful' };
      mockApiService.apiService.post.mockResolvedValue({ data: mockResponse });

      const result = await aiService.testProvider(AIProvider.OPENAI, 'sk-test-key');

      expect(result).toEqual(mockResponse);
      expect(mockApiService.apiService.post).toHaveBeenCalledWith('/api/ai/test', {
        provider: AIProvider.OPENAI,
        apiKey: 'sk-test-key'
      });
    });

    it('should test provider without API key', async () => {
      const mockResponse = { success: true, message: 'Test successful' };
      mockApiService.apiService.post.mockResolvedValue({ data: mockResponse });

      const result = await aiService.testProvider(AIProvider.OPENAI);

      expect(result).toEqual(mockResponse);
      expect(mockApiService.apiService.post).toHaveBeenCalledWith('/api/ai/test', {
        provider: AIProvider.OPENAI
      });
    });

    it('should return failure on error', async () => {
      mockApiService.apiService.post.mockRejectedValue(new Error('Test failed'));

      const result = await aiService.testProvider(AIProvider.OPENAI);

      expect(result).toEqual({
        success: false,
        message: 'Failed to test provider connection'
      });
    });
  });

  describe('getAvailableProviders', () => {
    it('should return available providers', async () => {
      const mockProviders = { system: [AIProvider.GEMINI, AIProvider.OPENAI] };
      mockApiService.apiService.get.mockResolvedValue({ data: mockProviders });

      const result = await aiService.getAvailableProviders();

      expect(result).toEqual(mockProviders);
      expect(mockApiService.apiService.get).toHaveBeenCalledWith('/api/ai/providers/available');
    });

    it('should return empty array on error', async () => {
      mockApiService.apiService.get.mockRejectedValue(new Error('API Error'));

      const result = await aiService.getAvailableProviders();

      expect(result).toEqual({ system: [] });
    });
  });

  describe('validateApiKey', () => {
    it('should validate OpenAI API key format', () => {
      const result = aiService.validateApiKey(AIProvider.OPENAI, 'sk-test-key-123');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid OpenAI API key format', () => {
      const result = aiService.validateApiKey(AIProvider.OPENAI, 'invalid-key');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('OpenAI API keys must start with "sk-"');
    });

    it('should validate Claude API key format', () => {
      const result = aiService.validateApiKey(AIProvider.CLAUDE, 'sk-ant-test-key-123');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid Claude API key format', () => {
      const result = aiService.validateApiKey(AIProvider.CLAUDE, 'sk-invalid-key');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Claude API keys must start with "sk-ant-"');
    });

    it('should validate Gemini API key format', () => {
      const result = aiService.validateApiKey(AIProvider.GEMINI, 'AIzaSyTest123');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid Gemini API key format', () => {
      const result = aiService.validateApiKey(AIProvider.GEMINI, 'invalid-key');
      expect(result.valid).toBe(false);
      expect(result.message).toContain('Gemini API keys must start with "AIza"');
    });

    it('should validate Grok API key format', () => {
      const result = aiService.validateApiKey(AIProvider.GROK, 'xai-test-key-123');
      expect(result.valid).toBe(true);
    });

    it('should validate DeepSeek API key format', () => {
      const result = aiService.validateApiKey(AIProvider.DEEPSEEK, 'sk-test-key-123');
      expect(result.valid).toBe(true);
    });

    it('should reject empty API keys', () => {
      const result = aiService.validateApiKey(AIProvider.OPENAI, '');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('API key cannot be empty');
    });

    it('should reject very short API keys', () => {
      const result = aiService.validateApiKey(AIProvider.OPENAI, 'sk-123');
      expect(result.valid).toBe(false);
      expect(result.message).toBe('API key is too short');
    });

    it('should trim whitespace from API keys', () => {
      const result = aiService.validateApiKey(AIProvider.OPENAI, '  sk-test-key-123  ');
      expect(result.valid).toBe(true);
    });
  });

  describe('getProviderInfo', () => {
    it('should return OpenAI provider info', () => {
      const info = aiService.getProviderInfo(AIProvider.OPENAI);
      
      expect(info).toEqual({
        name: 'OpenAI',
        description: 'GPT-4, ChatGPT, and other OpenAI models',
        website: 'https://platform.openai.com/api-keys',
        keyFormat: 'sk-...',
        keyExample: 'sk-proj-1234567890abcdef...'
      });
    });

    it('should return Claude provider info', () => {
      const info = aiService.getProviderInfo(AIProvider.CLAUDE);
      
      expect(info.name).toBe('Anthropic Claude');
      expect(info.keyFormat).toBe('sk-ant-...');
    });

    it('should return Gemini provider info', () => {
      const info = aiService.getProviderInfo(AIProvider.GEMINI);
      
      expect(info.name).toBe('Google Gemini');
      expect(info.keyFormat).toBe('AIza...');
    });
  });

  describe('getAllProviderInfo', () => {
    it('should return all provider information', () => {
      const allInfo = aiService.getAllProviderInfo();
      
      expect(allInfo).toEqual(AI_PROVIDER_INFO);
      expect(Object.keys(allInfo)).toEqual([
        AIProvider.OPENAI,
        AIProvider.CLAUDE,
        AIProvider.GEMINI,
        AIProvider.GROK,
        AIProvider.DEEPSEEK
      ]);
    });
  });

  describe('Provider Information Constants', () => {
    it('should have correct OpenAI information', () => {
      const openaiInfo = AI_PROVIDER_INFO[AIProvider.OPENAI];
      
      expect(openaiInfo.name).toBe('OpenAI');
      expect(openaiInfo.website).toBe('https://platform.openai.com/api-keys');
      expect(openaiInfo.keyFormat).toBe('sk-...');
    });

    it('should have information for all providers', () => {
      const providers = Object.values(AIProvider);
      
      providers.forEach(provider => {
        const info = AI_PROVIDER_INFO[provider];
        expect(info).toBeDefined();
        expect(info.name).toBeTruthy();
        expect(info.description).toBeTruthy();
        expect(info.website).toBeTruthy();
        expect(info.keyFormat).toBeTruthy();
        expect(info.keyExample).toBeTruthy();
      });
    });
  });
});