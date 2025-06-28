/**
 * Base AI Adapter Interface
 * Provides unified interface for all AI providers
 */

export class AIAdapter {
  constructor(apiKey, config = {}) {
    this.apiKey = apiKey;
    this.config = config;
    this.providerName = 'base';
  }

  /**
   * Generate chat response
   * @param {Array} messages - Chat history
   * @param {string} systemPrompt - System instruction
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Response object
   */
  async generateChatResponse(messages, systemPrompt, options = {}) {
    throw new Error('generateChatResponse must be implemented by provider');
  }

  /**
   * Analyze certificate content
   * @param {string} pemContent - Certificate PEM content
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeCertificate(pemContent, context = {}) {
    throw new Error('analyzeCertificate must be implemented by provider');
  }

  /**
   * Parse certificate and extract structured data
   * @param {string} pemContent - Certificate PEM content
   * @returns {Promise<Object>} Parsed certificate data
   */
  async parseCertificate(pemContent) {
    throw new Error('parseCertificate must be implemented by provider');
  }

  /**
   * Generate database insights
   * @param {Object} dbContext - Database context
   * @returns {Promise<Object>} Insights and recommendations
   */
  async generateInsights(dbContext) {
    throw new Error('generateInsights must be implemented by provider');
  }

  /**
   * Check if API key is valid
   * @returns {Promise<boolean>} True if valid
   */
  async validateApiKey() {
    throw new Error('validateApiKey must be implemented by provider');
  }

  /**
   * Get provider-specific configuration
   * @returns {Object} Provider configuration
   */
  getProviderInfo() {
    return {
      name: this.providerName,
      models: [],
      capabilities: [],
      maxTokens: 0,
      supportsStreaming: false
    };
  }

  /**
   * Check if content contains sensitive data
   * @param {string} content - Content to check
   * @returns {boolean} True if sensitive
   */
  containsSensitiveData(content) {
    const sensitivePatterns = [
      /-----BEGIN CERTIFICATE-----/,
      /-----BEGIN PRIVATE KEY-----/,
      /-----BEGIN RSA PRIVATE KEY-----/,
      /-----BEGIN ENCRYPTED PRIVATE KEY-----/,
      /BEGIN CERTIFICATE REQUEST/,
      /password/i,
      /secret/i,
      /token/i,
      /api[_-]?key/i
    ];

    return sensitivePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Sanitize content for logging
   * @param {string} content - Content to sanitize
   * @returns {string} Sanitized content
   */
  sanitizeForLogging(content) {
    let sanitized = content;
    
    // Replace PEM blocks with placeholders
    sanitized = sanitized.replace(/-----BEGIN[^-]+-----[\s\S]*?-----END[^-]+-----/g, '[PEM_CONTENT_REDACTED]');
    
    // Replace potential secrets
    sanitized = sanitized.replace(/[a-zA-Z0-9]{20,}/g, '[POTENTIAL_SECRET_REDACTED]');
    
    return sanitized;
  }
}

/**
 * Standard response format for all providers
 */
export class AIResponse {
  constructor(success, data, error = null, metadata = {}) {
    this.success = success;
    this.data = data;
    this.error = error;
    this.metadata = {
      timestamp: new Date().toISOString(),
      provider: metadata.provider || 'unknown',
      model: metadata.model || 'unknown',
      tokensUsed: metadata.tokensUsed || 0,
      ...metadata
    };
  }

  static success(data, metadata = {}) {
    return new AIResponse(true, data, null, metadata);
  }

  static error(error, metadata = {}) {
    return new AIResponse(false, null, error, metadata);
  }
}

/**
 * AI Provider Types
 */
export const AI_PROVIDERS = {
  OPENAI: 'openai',
  CLAUDE: 'claude', 
  GEMINI: 'gemini',
  GROK: 'grok',
  DEEPSEEK: 'deepseek'
};

/**
 * Standard models for each provider
 */
export const AI_MODELS = {
  [AI_PROVIDERS.OPENAI]: {
    'gpt-4': { maxTokens: 8192, cost: 'high' },
    'gpt-4-turbo': { maxTokens: 128000, cost: 'high' },
    'gpt-3.5-turbo': { maxTokens: 4096, cost: 'low' }
  },
  [AI_PROVIDERS.CLAUDE]: {
    'claude-3-5-sonnet-20241022': { maxTokens: 200000, cost: 'high' },
    'claude-3-haiku-20240307': { maxTokens: 200000, cost: 'low' }
  },
  [AI_PROVIDERS.GEMINI]: {
    'gemini-1.5-pro': { maxTokens: 2097152, cost: 'medium' },
    'gemini-1.5-flash': { maxTokens: 1048576, cost: 'low' }
  },
  [AI_PROVIDERS.GROK]: {
    'grok-2': { maxTokens: 131072, cost: 'medium' },
    'grok-2-mini': { maxTokens: 131072, cost: 'low' }
  },
  [AI_PROVIDERS.DEEPSEEK]: {
    'deepseek-chat': { maxTokens: 64000, cost: 'low' },
    'deepseek-coder': { maxTokens: 64000, cost: 'low' }
  }
};