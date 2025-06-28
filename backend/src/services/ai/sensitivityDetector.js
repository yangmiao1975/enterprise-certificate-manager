/**
 * Sensitivity Detector
 * Detects sensitive data in user inputs to determine AI provider routing
 */

export class SensitivityDetector {
  constructor() {
    this.sensitivePatterns = [
      // Certificate content patterns
      {
        pattern: /-----BEGIN CERTIFICATE-----/gi,
        type: 'certificate',
        severity: 'high',
        description: 'X.509 Certificate content'
      },
      {
        pattern: /-----BEGIN PRIVATE KEY-----/gi,
        type: 'private_key',
        severity: 'critical',
        description: 'Private key content'
      },
      {
        pattern: /-----BEGIN RSA PRIVATE KEY-----/gi,
        type: 'rsa_private_key',
        severity: 'critical',
        description: 'RSA private key content'
      },
      {
        pattern: /-----BEGIN ENCRYPTED PRIVATE KEY-----/gi,
        type: 'encrypted_private_key',
        severity: 'critical',
        description: 'Encrypted private key content'
      },
      {
        pattern: /-----BEGIN CERTIFICATE REQUEST-----/gi,
        type: 'csr',
        severity: 'medium',
        description: 'Certificate signing request'
      },
      {
        pattern: /-----BEGIN PUBLIC KEY-----/gi,
        type: 'public_key',
        severity: 'low',
        description: 'Public key content'
      },

      // API keys and tokens
      {
        pattern: /sk-[a-zA-Z0-9]{48}/gi,
        type: 'openai_key',
        severity: 'critical',
        description: 'OpenAI API key'
      },
      {
        pattern: /claude-[a-zA-Z0-9\-]{20,}/gi,
        type: 'claude_key',
        severity: 'critical',
        description: 'Claude API key'
      },
      {
        pattern: /AIza[a-zA-Z0-9\-_]{35}/gi,
        type: 'google_key',
        severity: 'critical',
        description: 'Google API key'
      },
      {
        pattern: /xai-[a-zA-Z0-9\-]{20,}/gi,
        type: 'grok_key',
        severity: 'critical',
        description: 'Grok API key'
      },

      // Generic patterns
      {
        pattern: /password\s*[:=]\s*[^\s\n]+/gi,
        type: 'password',
        severity: 'high',
        description: 'Password field'
      },
      {
        pattern: /secret\s*[:=]\s*[^\s\n]+/gi,
        type: 'secret',
        severity: 'high',
        description: 'Secret field'
      },
      {
        pattern: /token\s*[:=]\s*[^\s\n]+/gi,
        type: 'token',
        severity: 'high',
        description: 'Token field'
      },
      {
        pattern: /api[_-]?key\s*[:=]\s*[^\s\n]+/gi,
        type: 'api_key',
        severity: 'high',
        description: 'API key field'
      },

      // Certificate-specific content indicators
      {
        pattern: /pem[_-]?content/gi,
        type: 'pem_reference',
        severity: 'medium',
        description: 'PEM content reference'
      },
      {
        pattern: /certificate[_-]?data/gi,
        type: 'cert_data_reference',
        severity: 'medium',
        description: 'Certificate data reference'
      },
      {
        pattern: /private[_-]?key[_-]?data/gi,
        type: 'private_key_reference',
        severity: 'high',
        description: 'Private key data reference'
      },

      // Long base64 strings (potential certificates/keys)
      {
        pattern: /[A-Za-z0-9+/]{200,}={0,2}/g,
        type: 'base64_data',
        severity: 'medium',
        description: 'Long base64 encoded data'
      },

      // Serial numbers and fingerprints
      {
        pattern: /[0-9a-fA-F]{2}(:[0-9a-fA-F]{2}){7,}/g,
        type: 'fingerprint',
        severity: 'low',
        description: 'Certificate fingerprint or serial number'
      }
    ];

    this.contextualKeywords = [
      'certificate', 'cert', 'ssl', 'tls', 'x509',
      'private', 'public', 'key', 'pem', 'der',
      'csr', 'ca', 'issuer', 'subject', 'san',
      'expiry', 'expiration', 'validity', 'renewal'
    ];
  }

  /**
   * Analyze content for sensitive data
   * @param {string} content - Content to analyze
   * @param {Object} context - Additional context (user, message type, etc.)
   * @returns {Object} Analysis result
   */
  analyze(content, context = {}) {
    if (!content || typeof content !== 'string') {
      return {
        hasSensitiveData: false,
        sensitivity: 'none',
        detections: [],
        recommendation: 'system'
      };
    }

    const detections = [];
    let maxSeverity = 'none';
    const severityLevels = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };

    // Check each pattern
    this.sensitivePatterns.forEach(pattern => {
      const matches = content.match(pattern.pattern);
      if (matches) {
        detections.push({
          type: pattern.type,
          severity: pattern.severity,
          description: pattern.description,
          matches: matches.length,
          sample: this.sanitizeMatch(matches[0])
        });

        if (severityLevels[pattern.severity] > severityLevels[maxSeverity]) {
          maxSeverity = pattern.severity;
        }
      }
    });

    // Check for contextual indicators
    const contextScore = this.calculateContextScore(content);
    
    // Determine if sensitive data is present
    const hasSensitiveData = detections.length > 0 || 
                           (contextScore > 3 && this.hasLongStrings(content));

    // Determine recommendation
    let recommendation = 'system';
    if (maxSeverity === 'critical' || maxSeverity === 'high') {
      recommendation = 'personal_required';
    } else if (maxSeverity === 'medium' || (hasSensitiveData && contextScore > 5)) {
      recommendation = 'personal_preferred';
    }

    return {
      hasSensitiveData,
      sensitivity: maxSeverity,
      detections,
      contextScore,
      recommendation,
      analysis: {
        totalPatterns: detections.length,
        criticalFindings: detections.filter(d => d.severity === 'critical').length,
        highFindings: detections.filter(d => d.severity === 'high').length,
        contextualRelevance: contextScore > 3
      }
    };
  }

  /**
   * Calculate contextual relevance score
   * @param {string} content - Content to analyze
   * @returns {number} Context score (0-10)
   */
  calculateContextScore(content) {
    const lowerContent = content.toLowerCase();
    let score = 0;

    this.contextualKeywords.forEach(keyword => {
      const count = (lowerContent.match(new RegExp(keyword, 'g')) || []).length;
      score += count;
    });

    return Math.min(score, 10);
  }

  /**
   * Check if content has suspiciously long strings
   * @param {string} content - Content to check
   * @returns {boolean} True if has long strings
   */
  hasLongStrings(content) {
    const words = content.split(/\s+/);
    return words.some(word => 
      word.length > 100 && 
      /^[A-Za-z0-9+/=]+$/.test(word)
    );
  }

  /**
   * Sanitize a match for logging/display
   * @param {string} match - Matched content
   * @returns {string} Sanitized version
   */
  sanitizeMatch(match) {
    if (match.length <= 20) {
      return '[REDACTED]';
    }
    
    const start = match.substring(0, 10);
    const end = match.substring(match.length - 10);
    return `${start}...[${match.length - 20} chars]...${end}`;
  }

  /**
   * Get recommendation message for user
   * @param {string} recommendation - Recommendation type
   * @returns {string} User-friendly message
   */
  getRecommendationMessage(recommendation) {
    switch (recommendation) {
      case 'personal_required':
        return 'Sensitive data detected. Personal AI keys required for security.';
      case 'personal_preferred':
        return 'Certificate-related content detected. Personal AI keys recommended.';
      case 'system':
      default:
        return 'No sensitive data detected. System AI can be used.';
    }
  }

  /**
   * Check if user should be warned about sensitive data
   * @param {Object} analysis - Analysis result
   * @returns {boolean} True if warning needed
   */
  shouldWarnUser(analysis) {
    return analysis.hasSensitiveData && 
           ['critical', 'high'].includes(analysis.sensitivity);
  }

  /**
   * Get security tips for the user
   * @param {Object} analysis - Analysis result
   * @returns {Array} Array of security tips
   */
  getSecurityTips(analysis) {
    const tips = [];

    if (analysis.detections.some(d => d.type.includes('private_key'))) {
      tips.push('🔒 Private keys detected. These should never be shared with AI services.');
      tips.push('💡 Use personal AI keys to keep this data secure.');
    }

    if (analysis.detections.some(d => d.type === 'certificate')) {
      tips.push('📄 Certificate content detected. Consider using personal AI keys for analysis.');
    }

    if (analysis.detections.some(d => d.type.includes('api_key'))) {
      tips.push('🔑 API keys detected. These should be kept confidential.');
    }

    if (analysis.contextScore > 5) {
      tips.push('🛡️ Certificate-related discussion detected. Personal AI keys provide better security.');
    }

    return tips;
  }
}

// Singleton instance
export const sensitivityDetector = new SensitivityDetector();