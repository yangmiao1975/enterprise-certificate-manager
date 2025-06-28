/**
 * DeepSeek Provider
 * Implements the AIAdapter interface for DeepSeek models
 */

import { AIAdapter } from '../aiAdapter.js';

export class DeepSeekProvider extends AIAdapter {
  constructor(apiKey, config = {}) {
    super(apiKey, config);
    this.providerName = 'deepseek';
    this.baseURL = config.baseURL || 'https://api.deepseek.com/v1';
    this.currentModel = config.model || 'deepseek-chat';
  }

  async generateChatResponse(messages, systemPrompt, options = {}) {
    if (!this.apiKey) {
      throw new Error('DeepSeek API key not provided');
    }

    try {
      const model = options.model || this.currentModel;
      const requestMessages = [];

      // Add system prompt
      if (systemPrompt) {
        requestMessages.push({
          role: 'system',
          content: systemPrompt
        });
      }

      // Add chat history
      requestMessages.push(...messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })));

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: requestMessages,
          temperature: options.temperature || 0.7,
          max_tokens: options.maxTokens || 2048,
          top_p: options.topP || 1,
          stream: false
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`DeepSeek API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const choice = data.choices?.[0];

      if (!choice) {
        throw new Error('No response from DeepSeek');
      }

      return {
        content: choice.message.content,
        model: model,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0
        }
      };

    } catch (error) {
      console.error('DeepSeek chat error:', error);
      throw new Error(`DeepSeek API error: ${error.message}`);
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
      'You are an expert certificate security analyst. Provide detailed technical analysis.',
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
        'You are a certificate parsing expert. Return only valid JSON responses.',
        { model: 'deepseek-coder', temperature: 0.1, maxTokens: 1500 }
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
      'You are an expert certificate management consultant. Provide strategic insights and actionable recommendations.',
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
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 10
        })
      });

      return response.ok;
    } catch (error) {
      console.error('DeepSeek API key validation failed:', error);
      return false;
    }
  }

  getProviderInfo() {
    return {
      name: 'DeepSeek',
      provider: 'deepseek',
      models: [
        {
          id: 'deepseek-chat',
          name: 'DeepSeek Chat',
          maxTokens: 64000,
          cost: 'low',
          capabilities: ['chat', 'analysis', 'reasoning']
        },
        {
          id: 'deepseek-coder',
          name: 'DeepSeek Coder',
          maxTokens: 64000,
          cost: 'low',
          capabilities: ['chat', 'code-analysis', 'json-parsing']
        }
      ],
      capabilities: ['chat', 'certificate-analysis', 'json-parsing', 'insights', 'code-understanding'],
      maxTokens: 64000,
      supportsStreaming: true,
      requiresApiKey: true
    };
  }
}