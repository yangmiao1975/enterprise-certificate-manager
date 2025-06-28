/**
 * Anthropic Claude Provider
 * Implements the AIAdapter interface for Claude models
 */

import { AIAdapter } from '../aiAdapter.js';

export class ClaudeProvider extends AIAdapter {
  constructor(apiKey, config = {}) {
    super(apiKey, config);
    this.providerName = 'claude';
    this.baseURL = config.baseURL || 'https://api.anthropic.com/v1';
    this.currentModel = config.model || 'claude-3-5-sonnet-20241022';
    this.version = '2023-06-01';
  }

  async generateChatResponse(messages, systemPrompt, options = {}) {
    if (!this.apiKey) {
      throw new Error('Claude API key not provided');
    }

    try {
      const model = options.model || this.currentModel;
      const requestMessages = [];

      // Claude expects alternating user/assistant messages
      messages.forEach(msg => {
        requestMessages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });

      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': this.version,
        },
        body: JSON.stringify({
          model: model,
          messages: requestMessages,
          system: systemPrompt || undefined,
          max_tokens: options.maxTokens || 2048,
          temperature: options.temperature || 0.7,
          top_p: options.topP || 1,
          stream: false
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Claude API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
        throw new Error('No response from Claude');
      }

      const textContent = data.content.find(c => c.type === 'text');
      if (!textContent) {
        throw new Error('No text content in Claude response');
      }

      return {
        content: textContent.text,
        model: model,
        usage: {
          promptTokens: data.usage?.input_tokens || 0,
          completionTokens: data.usage?.output_tokens || 0,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
        }
      };

    } catch (error) {
      console.error('Claude chat error:', error);
      throw new Error(`Claude API error: ${error.message}`);
    }
  }

  async analyzeCertificate(pemContent, context = {}) {
    const prompt = `Analyze this X.509 certificate and provide comprehensive insights:

CERTIFICATE DATA:
${pemContent}

CONTEXT:
${JSON.stringify(context, null, 2)}

Please provide:
1. Certificate health analysis
2. Security recommendations
3. Expiration status and renewal timeline
4. Comparison with related certificates (if provided in context)
5. Integration status and compatibility
6. Any concerns or recommendations

Format your response in clear sections with actionable insights.`;

    const response = await this.generateChatResponse(
      [{ role: 'user', content: prompt }],
      'You are an expert certificate security analyst. Provide detailed technical analysis with clear recommendations.',
      { model: this.currentModel, temperature: 0.3, maxTokens: 1500 }
    );

    return {
      analysis: response.content,
      model: this.currentModel
    };
  }

  async parseCertificate(pemContent) {
    const prompt = `Parse this X.509 certificate and extract all relevant information. Return only valid JSON:

CERTIFICATE DATA:
${pemContent}

Extract and return as JSON:
{
  "isValid": boolean,
  "commonName": "string",
  "subject": "string", 
  "issuer": "string",
  "serialNumber": "string",
  "validFrom": "ISO date string",
  "validTo": "ISO date string",
  "algorithm": "string",
  "keySize": "string",
  "fingerprint": "string",
  "subjectAlternativeNames": ["array of SANs"],
  "keyUsage": ["array of key usage"],
  "extendedKeyUsage": ["array of extended key usage"],
  "isExpired": boolean,
  "daysUntilExpiry": number,
  "issuerDetails": {
    "organizationName": "string",
    "countryName": "string"
  },
  "securityAssessment": {
    "rating": "High/Medium/Low",
    "concerns": ["array of concerns"],
    "recommendations": ["array of recommendations"]
  }
}

If invalid, return: {"isValid": false, "error": "description"}`;

    try {
      const response = await this.generateChatResponse(
        [{ role: 'user', content: prompt }],
        'You are a certificate parsing expert. Return only valid JSON responses without any markdown formatting or explanations.',
        { model: this.currentModel, temperature: 0.1, maxTokens: 1500 }
      );

      const jsonResponse = response.content.trim();
      // Try to extract JSON if wrapped in markdown
      const jsonMatch = jsonResponse.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, jsonResponse];
      
      return JSON.parse(jsonMatch[1]);
    } catch (error) {
      throw new Error(`Certificate parsing failed: ${error.message}`);
    }
  }

  async generateInsights(dbContext) {
    const prompt = `Analyze this certificate management database and provide strategic insights:

DATABASE SUMMARY:
- Total Certificates: ${dbContext.summary.totalCertificates}
- Active Certificates: ${dbContext.summary.activeCertificates}
- Expiring Soon (30 days): ${dbContext.summary.expiringSoon}
- Expired: ${dbContext.summary.expired}

CERTIFICATE DETAILS:
${dbContext.certificates.map(cert => `
- ${cert.common_name} (${cert.issuer})
  Status: ${cert.status}
  Expires: ${cert.valid_to}
  Algorithm: ${cert.algorithm}
  Folder: ${cert.folder_id}
`).join('\n')}

FOLDERS:
${dbContext.folders.map(f => `- ${f.name}: ${f.description}`).join('\n')}

Please provide:
1. Overall certificate health assessment
2. Critical actions needed (renewals, updates)
3. Security posture analysis
4. Certificate lifecycle management recommendations
5. Organizational and folder structure suggestions
6. Integration optimization opportunities
7. Compliance and best practices assessment

Format as actionable insights with priorities (High/Medium/Low).`;

    const response = await this.generateChatResponse(
      [{ role: 'user', content: prompt }],
      'You are an expert certificate management consultant. Provide strategic insights and actionable recommendations based on industry best practices.',
      { model: this.currentModel, temperature: 0.4, maxTokens: 2000 }
    );

    return {
      insights: response.content,
      summary: dbContext.summary,
      timestamp: new Date().toISOString()
    };
  }

  async validateApiKey() {
    if (!this.apiKey) {
      return false;
    }

    try {
      // Test with a minimal request
      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': this.version,
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 10
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Claude API key validation failed:', error);
      return false;
    }
  }

  getProviderInfo() {
    return {
      name: 'Anthropic Claude',
      provider: 'claude',
      models: [
        {
          id: 'claude-3-5-sonnet-20241022',
          name: 'Claude 3.5 Sonnet',
          maxTokens: 200000,
          cost: 'high',
          capabilities: ['chat', 'analysis', 'reasoning', 'large-context']
        },
        {
          id: 'claude-3-haiku-20240307',
          name: 'Claude 3 Haiku',
          maxTokens: 200000,
          cost: 'low',
          capabilities: ['chat', 'fast-response']
        }
      ],
      capabilities: ['chat', 'certificate-analysis', 'json-parsing', 'insights', 'detailed-analysis'],
      maxTokens: 200000,
      supportsStreaming: true,
      requiresApiKey: true
    };
  }
}