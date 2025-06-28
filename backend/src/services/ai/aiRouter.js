/**
 * AI Router - Routes requests to appropriate AI providers
 * Handles user preferences, fallbacks, and sensitive data detection
 */

import { AIResponse, AI_PROVIDERS } from './aiAdapter.js';
import { OpenAIProvider } from './providers/openai.js';
import { ClaudeProvider } from './providers/claude.js';
import { GeminiProvider } from './providers/gemini.js';
import { GrokProvider } from './providers/grok.js';
import { DeepSeekProvider } from './providers/deepseek.js';
import { getDatabase } from '../../database/flexible-init.js';
import crypto from 'crypto';

export class AIRouter {
  constructor() {
    this.providers = new Map();
    this.systemProviders = new Map();
    this.initializeSystemProviders();
  }

  /**
   * Initialize system providers with environment variables
   */
  initializeSystemProviders() {
    // System API keys from environment
    if (process.env.OPENAI_API_KEY) {
      this.systemProviders.set(AI_PROVIDERS.OPENAI, new OpenAIProvider(process.env.OPENAI_API_KEY));
    }
    if (process.env.CLAUDE_API_KEY) {
      this.systemProviders.set(AI_PROVIDERS.CLAUDE, new ClaudeProvider(process.env.CLAUDE_API_KEY));
    }
    if (process.env.GEMINI_API_KEY) {
      this.systemProviders.set(AI_PROVIDERS.GEMINI, new GeminiProvider(process.env.GEMINI_API_KEY));
    }
    if (process.env.GROK_API_KEY) {
      this.systemProviders.set(AI_PROVIDERS.GROK, new GrokProvider(process.env.GROK_API_KEY));
    }
    if (process.env.DEEPSEEK_API_KEY) {
      this.systemProviders.set(AI_PROVIDERS.DEEPSEEK, new DeepSeekProvider(process.env.DEEPSEEK_API_KEY));
    }
  }

  /**
   * Get user's AI provider configuration
   */
  async getUserAIConfig(userId) {
    try {
      const db = getDatabase();
      const config = await db.getAsync(
        'SELECT provider_configs, primary_provider, fallback_provider, use_personal_keys FROM user_ai_settings WHERE user_id = ?',
        [userId]
      );

      if (!config) {
        return {
          primaryProvider: null,
          fallbackProvider: null,
          usePersonalKeys: false,
          providerConfigs: {}
        };
      }

      return {
        primaryProvider: config.primary_provider,
        fallbackProvider: config.fallback_provider,
        usePersonalKeys: config.use_personal_keys === 1,
        providerConfigs: JSON.parse(config.provider_configs || '{}')
      };
    } catch (error) {
      console.error('Error getting user AI config:', error);
      return {
        primaryProvider: null,
        fallbackProvider: null,
        usePersonalKeys: false,
        providerConfigs: {}
      };
    }
  }

  /**
   * Get user's decrypted API key for a provider
   */
  async getUserApiKey(userId, provider) {
    try {
      const db = getDatabase();
      const result = await db.getAsync(
        'SELECT api_key_encrypted FROM user_ai_providers WHERE user_id = ? AND provider = ?',
        [userId, provider]
      );

      if (!result || !result.api_key_encrypted) {
        return null;
      }

      // Decrypt API key (using simple encryption for demo - use proper encryption in production)
      const encryptionKey = process.env.AI_KEY_ENCRYPTION_SECRET || 'default-key-change-in-production';
      const decipher = crypto.createDecipher('aes192', encryptionKey);
      let decrypted = decipher.update(result.api_key_encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Error decrypting user API key:', error);
      return null;
    }
  }

  /**
   * Get provider instance for user
   */
  async getProviderForUser(userId, provider, content = '') {
    const userConfig = await this.getUserAIConfig(userId);
    const targetProvider = provider;

    // Check if user wants to use personal keys or if content is sensitive
    if (userConfig.usePersonalKeys || this.containsSensitiveData(content)) {
      const userApiKey = await this.getUserApiKey(userId, targetProvider);
      if (userApiKey) {
        return this.createProvider(targetProvider, userApiKey);
      }
    }

    // Fall back to system provider
    return this.systemProviders.get(targetProvider);
  }

  /**
   * Create provider instance
   */
  createProvider(providerType, apiKey) {
    switch (providerType) {
      case AI_PROVIDERS.OPENAI:
        return new OpenAIProvider(apiKey);
      case AI_PROVIDERS.CLAUDE:
        return new ClaudeProvider(apiKey);
      case AI_PROVIDERS.GEMINI:
        return new GeminiProvider(apiKey);
      case AI_PROVIDERS.GROK:
        return new GrokProvider(apiKey);
      case AI_PROVIDERS.DEEPSEEK:
        return new DeepSeekProvider(apiKey);
      default:
        throw new Error(`Unknown provider: ${providerType}`);
    }
  }

  /**
   * Route chat request to appropriate provider
   */
  async routeChatRequest(userId, messages, systemPrompt, options = {}) {
    const userConfig = await this.getUserAIConfig(userId);
    const content = JSON.stringify(messages) + systemPrompt;
    
    // Determine which provider to use
    let targetProvider = options.provider || userConfig.primaryProvider;
    
    // Auto-detect sensitive data and force user's personal key
    const hasSensitiveData = this.containsSensitiveData(content);
    if (hasSensitiveData && !userConfig.usePersonalKeys) {
      // If sensitive data detected but user doesn't have personal keys configured,
      // try to use their key if available, otherwise warn
      const availableUserProviders = await this.getAvailableUserProviders(userId);
      if (availableUserProviders.length > 0) {
        targetProvider = availableUserProviders[0];
      } else {
        return AIResponse.error(
          'Sensitive data detected but no personal AI keys configured. Please add your API keys in settings.',
          { 
            provider: 'none',
            sensitiveDataDetected: true,
            availableSystemProviders: Array.from(this.systemProviders.keys())
          }
        );
      }
    }

    // Default to first available system provider if no preference
    if (!targetProvider) {
      targetProvider = Array.from(this.systemProviders.keys())[0];
    }

    if (!targetProvider) {
      return AIResponse.error('No AI providers available');
    }

    try {
      const provider = await this.getProviderForUser(userId, targetProvider);
      if (!provider) {
        return AIResponse.error(`Provider ${targetProvider} not available`);
      }

      const result = await provider.generateChatResponse(messages, systemPrompt, options);
      
      return AIResponse.success(result, {
        provider: targetProvider,
        model: provider.currentModel || 'unknown',
        sensitiveDataDetected: hasSensitiveData,
        usingPersonalKey: hasSensitiveData || userConfig.usePersonalKeys
      });

    } catch (error) {
      // Try fallback provider
      if (userConfig.fallbackProvider && userConfig.fallbackProvider !== targetProvider) {
        try {
          const fallbackProvider = await this.getProviderForUser(userId, userConfig.fallbackProvider);
          if (fallbackProvider) {
            const result = await fallbackProvider.generateChatResponse(messages, systemPrompt, options);
            return AIResponse.success(result, {
              provider: userConfig.fallbackProvider,
              model: fallbackProvider.currentModel || 'unknown',
              usedFallback: true,
              originalError: error.message
            });
          }
        } catch (fallbackError) {
          console.error('Fallback provider also failed:', fallbackError);
        }
      }

      return AIResponse.error(`AI request failed: ${error.message}`, {
        provider: targetProvider,
        originalError: error.message
      });
    }
  }

  /**
   * Route certificate analysis request
   */
  async routeCertificateAnalysis(userId, pemContent, context = {}) {
    const userConfig = await this.getUserAIConfig(userId);
    
    // Certificate data is always sensitive - force user's personal key
    const availableUserProviders = await this.getAvailableUserProviders(userId);
    if (availableUserProviders.length === 0) {
      return AIResponse.error(
        'Certificate analysis requires personal AI keys for security. Please configure your API keys in settings.',
        { 
          sensitiveDataDetected: true,
          requiresPersonalKey: true 
        }
      );
    }

    const targetProvider = userConfig.primaryProvider || availableUserProviders[0];
    
    try {
      const provider = await this.getProviderForUser(userId, targetProvider);
      const result = await provider.analyzeCertificate(pemContent, context);
      
      return AIResponse.success(result, {
        provider: targetProvider,
        usingPersonalKey: true,
        dataType: 'certificate'
      });
    } catch (error) {
      return AIResponse.error(`Certificate analysis failed: ${error.message}`);
    }
  }

  /**
   * Get available user providers
   */
  async getAvailableUserProviders(userId) {
    try {
      const db = getDatabase();
      const providers = await db.allAsync(
        'SELECT provider FROM user_ai_providers WHERE user_id = ?',
        [userId]
      );
      return providers.map(p => p.provider);
    } catch (error) {
      console.error('Error getting user providers:', error);
      return [];
    }
  }

  /**
   * Check if content contains sensitive data
   */
  containsSensitiveData(content) {
    const sensitivePatterns = [
      /-----BEGIN CERTIFICATE-----/,
      /-----BEGIN PRIVATE KEY-----/,
      /-----BEGIN RSA PRIVATE KEY-----/,
      /-----BEGIN ENCRYPTED PRIVATE KEY-----/,
      /BEGIN CERTIFICATE REQUEST/,
      /pem[_-]?content/i,
      /private[_-]?key/i,
      /certificate[_-]?data/i
    ];

    return sensitivePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Get available providers info
   */
  getAvailableProviders() {
    const system = Array.from(this.systemProviders.keys()).map(provider => ({
      provider,
      type: 'system',
      info: this.systemProviders.get(provider).getProviderInfo()
    }));

    return { system };
  }
}

// Singleton instance
export const aiRouter = new AIRouter();