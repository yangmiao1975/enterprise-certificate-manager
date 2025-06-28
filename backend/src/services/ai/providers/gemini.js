/**
 * Google Gemini AI Provider
 * Implements the AIAdapter interface for Gemini models
 */

import { GoogleGenAI } from "@google/genai";
import { AIAdapter } from '../aiAdapter.js';

export class GeminiProvider extends AIAdapter {
  constructor(apiKey, config = {}) {
    super(apiKey, config);
    this.providerName = 'gemini';
    this.client = apiKey ? new GoogleGenAI({ apiKey }) : null;
    this.currentModel = config.model || 'gemini-1.5-flash';
    
    if (!this.client) {
      console.warn('Gemini API key not provided');
    }
  }

  async generateChatResponse(messages, systemPrompt, options = {}) {
    if (!this.client) {
      throw new Error('Gemini client not initialized');
    }

    try {
      const model = options.model || this.currentModel;
      const contents = [];
      
      // Add system instruction
      if (systemPrompt) {
        contents.push({
          role: 'user',
          parts: [{ text: systemPrompt }]
        });
        
        contents.push({
          role: 'model',
          parts: [{ text: 'I understand. I am ready to help based on this context.' }]
        });
      }

      // Add chat history
      messages.forEach(msg => {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        });
      });

      const response = await this.client.models.generateContent({
        model: model,
        contents: contents,
        config: {
          temperature: options.temperature || 0.7,
          topP: options.topP || 0.8,
          topK: options.topK || 40,
          maxOutputTokens: options.maxTokens || 2048,
        }
      });

      return {
        content: response.text || "I apologize, but I couldn't generate a response.",
        model: model,
        usage: {
          promptTokens: 0, // Gemini doesn't provide token counts in response
          completionTokens: 0,
          totalTokens: 0
        }
      };

    } catch (error) {
      console.error('Gemini chat error:', error);
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }

  async analyzeCertificate(pemContent, context = {}) {
    if (!this.client) {
      throw new Error('Gemini client not initialized');
    }

    try {
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
5. GCP integration status
6. Any concerns or recommendations

Format your response in clear sections with actionable insights.`;

      const response = await this.client.models.generateContent({
        model: this.currentModel,
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        config: {
          temperature: 0.3,
          topP: 0.8,
          maxOutputTokens: 1500,
        }
      });

      return {
        analysis: response.text || "Analysis could not be completed.",
        model: this.currentModel
      };

    } catch (error) {
      console.error('Gemini certificate analysis error:', error);
      throw new Error(`Certificate analysis failed: ${error.message}`);
    }
  }

  async parseCertificate(pemContent) {
    if (!this.client) {
      throw new Error('Gemini client not initialized');
    }

    try {
      const prompt = `Parse this X.509 certificate and extract all relevant information:

CERTIFICATE DATA:
${pemContent}

Please extract and return as JSON:
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

If the certificate is invalid, return:
{
  "isValid": false,
  "error": "description of the error"
}`;

      const response = await this.client.models.generateContent({
        model: this.currentModel,
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
          topP: 0.8,
          maxOutputTokens: 1500,
        }
      });

      const jsonResponse = response.text?.trim();
      
      try {
        const parsed = JSON.parse(jsonResponse);
        return parsed;
      } catch (parseError) {
        throw new Error("Failed to parse certificate analysis response");
      }

    } catch (error) {
      console.error('Gemini certificate parsing error:', error);
      throw new Error(`Certificate parsing failed: ${error.message}`);
    }
  }

  async generateInsights(dbContext) {
    if (!this.client) {
      throw new Error('Gemini client not initialized');
    }

    try {
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
6. GCP integration optimization
7. Compliance and best practices assessment

Format as actionable insights with priorities (High/Medium/Low).`;

      const response = await this.client.models.generateContent({
        model: this.currentModel,
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        config: {
          temperature: 0.4,
          topP: 0.9,
          maxOutputTokens: 2000,
        }
      });

      return {
        insights: response.text || "Insights could not be generated.",
        summary: dbContext.summary,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Gemini insights error:', error);
      throw new Error(`Insights generation failed: ${error.message}`);
    }
  }

  async validateApiKey() {
    if (!this.client) {
      return false;
    }

    try {
      // Test with a simple request
      const response = await this.client.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [{
          role: 'user',
          parts: [{ text: 'Hello' }]
        }],
        config: {
          maxOutputTokens: 10,
        }
      });

      return !!response.text;
    } catch (error) {
      console.error('Gemini API key validation failed:', error);
      return false;
    }
  }

  getProviderInfo() {
    return {
      name: 'Google Gemini',
      provider: 'gemini',
      models: [
        {
          id: 'gemini-1.5-pro',
          name: 'Gemini 1.5 Pro',
          maxTokens: 2097152,
          cost: 'medium',
          capabilities: ['chat', 'analysis', 'reasoning']
        },
        {
          id: 'gemini-1.5-flash',
          name: 'Gemini 1.5 Flash',
          maxTokens: 1048576,
          cost: 'low',
          capabilities: ['chat', 'analysis', 'fast-response']
        }
      ],
      capabilities: ['chat', 'certificate-analysis', 'json-parsing', 'insights'],
      maxTokens: 1048576,
      supportsStreaming: false,
      requiresApiKey: true
    };
  }
}