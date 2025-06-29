import { AIProvider, AIUserSettings, AIProviderConfig } from '../types';
import { apiService } from './apiService';

export const AI_PROVIDER_INFO = {
  [AIProvider.OPENAI]: {
    name: 'OpenAI',
    description: 'GPT-4, ChatGPT, and other OpenAI models',
    website: 'https://platform.openai.com/api-keys',
    keyFormat: 'sk-...',
    keyExample: 'sk-proj-1234567890abcdef...'
  },
  [AIProvider.CLAUDE]: {
    name: 'Anthropic Claude',
    description: 'Claude 3.5 Sonnet and other Anthropic models',
    website: 'https://console.anthropic.com/keys',
    keyFormat: 'sk-ant-...',
    keyExample: 'sk-ant-api03-1234567890abcdef...'
  },
  [AIProvider.GEMINI]: {
    name: 'Google Gemini',
    description: 'Gemini Pro and other Google AI models',
    website: 'https://makersuite.google.com/app/apikey',
    keyFormat: 'AIza...',
    keyExample: 'AIzaSy1234567890abcdef...'
  },
  [AIProvider.GROK]: {
    name: 'xAI Grok',
    description: 'Grok and other xAI models',
    website: 'https://console.x.ai/keys',
    keyFormat: 'xai-...',
    keyExample: 'xai-1234567890abcdef...'
  },
  [AIProvider.DEEPSEEK]: {
    name: 'DeepSeek',
    description: 'DeepSeek Coder and other DeepSeek models',
    website: 'https://platform.deepseek.com/api_keys',
    keyFormat: 'sk-...',
    keyExample: 'sk-1234567890abcdef...'
  }
};

class AIService {
  /**
   * Get user's AI settings
   */
  async getUserAISettings(): Promise<AIUserSettings> {
    try {
      const response = await apiService.get('/api/ai/settings');
      return response.data;
    } catch (error) {
      console.error('Failed to get AI settings:', error);
      return {
        primaryProvider: null,
        fallbackProvider: null,
        usePersonalKeys: false,
        providers: []
      };
    }
  }

  /**
   * Update user's AI settings
   */
  async updateUserAISettings(settings: Partial<AIUserSettings>): Promise<void> {
    try {
      await apiService.put('/api/ai/settings', settings);
    } catch (error) {
      console.error('Failed to update AI settings:', error);
      throw error;
    }
  }

  /**
   * Add or update an AI provider API key
   */
  async addOrUpdateProvider(provider: AIProvider, apiKey: string): Promise<void> {
    try {
      await apiService.post('/api/ai/providers', {
        provider,
        apiKey
      });
    } catch (error) {
      console.error('Failed to add/update AI provider:', error);
      throw error;
    }
  }

  /**
   * Remove an AI provider
   */
  async removeProvider(provider: AIProvider): Promise<void> {
    try {
      await apiService.delete(`/api/ai/providers/${provider}`);
    } catch (error) {
      console.error('Failed to remove AI provider:', error);
      throw error;
    }
  }

  /**
   * Test an AI provider API key
   */
  async testProvider(provider: AIProvider, apiKey?: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiService.post('/api/ai/test', {
        provider,
        apiKey
      });
      return response.data;
    } catch (error) {
      console.error('Failed to test AI provider:', error);
      return {
        success: false,
        message: 'Failed to test provider connection'
      };
    }
  }

  /**
   * Get available system providers
   */
  async getAvailableProviders(): Promise<{ system: AIProvider[] }> {
    try {
      const response = await apiService.get('/api/ai/providers/available');
      return response.data;
    } catch (error) {
      console.error('Failed to get available providers:', error);
      return { system: [] };
    }
  }

  /**
   * Validate API key format
   */
  validateApiKey(provider: AIProvider, apiKey: string): { valid: boolean; message?: string } {
    const info = AI_PROVIDER_INFO[provider];
    const trimmedKey = apiKey.trim();

    if (!trimmedKey) {
      return { valid: false, message: 'API key cannot be empty' };
    }

    if (trimmedKey.length < 10) {
      return { valid: false, message: 'API key is too short' };
    }

    // Basic format validation
    switch (provider) {
      case AIProvider.OPENAI:
        if (!trimmedKey.startsWith('sk-')) {
          return { valid: false, message: 'OpenAI API keys must start with "sk-"' };
        }
        break;
      case AIProvider.CLAUDE:
        if (!trimmedKey.startsWith('sk-ant-')) {
          return { valid: false, message: 'Claude API keys must start with "sk-ant-"' };
        }
        break;
      case AIProvider.GEMINI:
        if (!trimmedKey.startsWith('AIza')) {
          return { valid: false, message: 'Gemini API keys must start with "AIza"' };
        }
        break;
      case AIProvider.GROK:
        if (!trimmedKey.startsWith('xai-')) {
          return { valid: false, message: 'Grok API keys must start with "xai-"' };
        }
        break;
      case AIProvider.DEEPSEEK:
        if (!trimmedKey.startsWith('sk-')) {
          return { valid: false, message: 'DeepSeek API keys must start with "sk-"' };
        }
        break;
    }

    return { valid: true };
  }

  /**
   * Get provider info
   */
  getProviderInfo(provider: AIProvider) {
    return AI_PROVIDER_INFO[provider];
  }

  /**
   * Get all provider info
   */
  getAllProviderInfo() {
    return AI_PROVIDER_INFO;
  }
}

export const aiService = new AIService();