import { GoogleGenAI } from "@google/genai";
import { getDatabase } from '../database/init.js';
import { promisify } from 'util';

const API_KEY = process.env.GEMINI_API_KEY || "";

if (!API_KEY) {
  console.warn("GEMINI_API_KEY is not set. AI features will be disabled.");
}

const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

/**
 * Get certificate data from database for Gemini context
 */
async function getCertificateContext() {
  if (!ai) return null;
  
  try {
    const db = getDatabase();
    
    // Get certificate summary
    const certificates = await db.allAsync(`
      SELECT 
        id,
        common_name,
        issuer,
        subject,
        valid_from,
        valid_to,
        algorithm,
        serial_number,
        status,
        folder_id,
        uploaded_at,
        gcp_certificate_name
      FROM certificates 
      ORDER BY uploaded_at DESC
    `);

    // Get folder information
    const folders = await db.allAsync(`
      SELECT id, name, description, type, permissions
      FROM folders
    `);

    // Get user information (without sensitive data)
    const users = await db.allAsync(`
      SELECT id, username, email, display_name, role, active, created_at
      FROM users
    `);

    // Get system metadata
    const metadata = await db.allAsync(`
      SELECT key, value, updated_at
      FROM metadata
    `);

    return {
      certificates,
      folders,
      users,
      metadata,
      summary: {
        totalCertificates: certificates.length,
        activeCertificates: certificates.filter(c => c.status === 'active').length,
        expiringSoon: certificates.filter(c => {
          const validTo = new Date(c.valid_to);
          const now = new Date();
          const daysUntilExpiry = (validTo - now) / (1000 * 60 * 60 * 24);
          return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
        }).length,
        expired: certificates.filter(c => new Date(c.valid_to) < new Date()).length
      }
    };
  } catch (error) {
    console.error('Error getting certificate context:', error);
    return null;
  }
}

/**
 * Enhanced chat response with database context
 */
export async function getChatResponseWithDB(messages, newMessage, userId) {
  if (!ai) {
    return {
      success: false,
      message: "AI service is unavailable. Please check GEMINI_API_KEY configuration."
    };
  }

  try {
    // Get current database context
    const dbContext = await getCertificateContext();
    
    // Build system instruction with database context
    let systemInstruction = `You are an expert certificate management assistant for an Enterprise Certificate Manager system.

CURRENT DATABASE CONTEXT:
`;

    if (dbContext) {
      systemInstruction += `
CERTIFICATE SUMMARY:
- Total certificates: ${dbContext.summary.totalCertificates}
- Active certificates: ${dbContext.summary.activeCertificates}
- Expiring soon (within 30 days): ${dbContext.summary.expiringSoon}
- Expired: ${dbContext.summary.expired}

CERTIFICATES IN DATABASE:
${dbContext.certificates.map(cert => `
- ID: ${cert.id}
  Common Name: ${cert.common_name}
  Issuer: ${cert.issuer}
  Valid From: ${cert.valid_from}
  Valid To: ${cert.valid_to}
  Status: ${cert.status}
  Algorithm: ${cert.algorithm}
  Serial Number: ${cert.serial_number}
  Folder: ${cert.folder_id}
  GCP Name: ${cert.gcp_certificate_name || 'N/A'}
`).join('\n')}

FOLDERS:
${dbContext.folders.map(folder => `
- ID: ${folder.id}
  Name: ${folder.name}
  Description: ${folder.description}
  Type: ${folder.type}
`).join('\n')}

SYSTEM METADATA:
${dbContext.metadata.map(meta => `
- ${meta.key}: ${meta.value}
`).join('\n')}
`;
    } else {
      systemInstruction += "Database context unavailable - providing general certificate management assistance.";
    }

    systemInstruction += `

CAPABILITIES:
- Analyze certificate data from the database
- Provide certificate management recommendations
- Help with certificate lifecycle management
- Explain certificate security best practices
- Parse and interpret certificate details
- Monitor certificate expiration and renewal needs
- Assist with GCP Certificate Manager integration

INSTRUCTIONS:
- Use the database context to answer specific questions about certificates
- Provide actionable recommendations based on current certificate status
- Alert about expired or soon-to-expire certificates
- Suggest certificate management improvements
- Keep responses professional and concise
- If asked about specific certificates, reference the database data
- For security advice, provide industry best practices`;

    // Convert chat history to Gemini format
    const geminiHistory = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // Create chat session
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 2048,
      },
      history: geminiHistory
    });

    // Send message
    const response = await chat.sendMessage({
      message: newMessage
    });

    return {
      success: true,
      message: response.text || "I apologize, but I couldn't generate a response. Please try again.",
      context: dbContext ? {
        certificateCount: dbContext.summary.totalCertificates,
        expiringSoon: dbContext.summary.expiringSoon,
        expired: dbContext.summary.expired
      } : null
    };

  } catch (error) {
    console.error('Error in getChatResponseWithDB:', error);
    return {
      success: false,
      message: `I encountered an error: ${error.message}. Please try again.`
    };
  }
}

/**
 * Analyze certificate with database context
 */
export async function analyzeCertificateWithDB(certificateId) {
  if (!ai) {
    return {
      success: false,
      message: "AI service is unavailable."
    };
  }

  try {
    const db = getDatabase();
    
    // Get certificate details
    const certificate = await db.getAsync(`
      SELECT 
        c.*,
        f.name as folder_name,
        u.username as uploaded_by_user
      FROM certificates c
      LEFT JOIN folders f ON c.folder_id = f.id
      LEFT JOIN users u ON c.uploaded_by = u.id
      WHERE c.id = ?
    `, [certificateId]);

    if (!certificate) {
      return {
        success: false,
        message: "Certificate not found in database."
      };
    }

    // Get related certificates (same issuer or similar common name)
    const relatedCerts = await db.allAsync(`
      SELECT id, common_name, issuer, valid_to, status
      FROM certificates 
      WHERE (issuer = ? OR common_name LIKE ?) AND id != ?
      LIMIT 5
    `, [certificate.issuer, `%${certificate.common_name}%`, certificateId]);

    const prompt = `Analyze this certificate from our database and provide insights:

CERTIFICATE DETAILS:
- ID: ${certificate.id}
- Common Name: ${certificate.common_name}
- Subject: ${certificate.subject}
- Issuer: ${certificate.issuer}
- Valid From: ${certificate.valid_from}
- Valid To: ${certificate.valid_to}
- Algorithm: ${certificate.algorithm}
- Serial Number: ${certificate.serial_number}
- Status: ${certificate.status}
- Folder: ${certificate.folder_name || 'Unassigned'}
- Uploaded By: ${certificate.uploaded_by_user || 'Unknown'}
- Uploaded At: ${certificate.uploaded_at}
- GCP Certificate Name: ${certificate.gcp_certificate_name || 'Not in GCP'}

RELATED CERTIFICATES:
${relatedCerts.map(cert => `- ${cert.common_name} (${cert.issuer}) - Expires: ${cert.valid_to} - Status: ${cert.status}`).join('\n')}

Please provide:
1. Certificate health analysis
2. Security recommendations
3. Expiration status and renewal timeline
4. Comparison with related certificates
5. GCP integration status
6. Any concerns or recommendations

Format your response in clear sections with actionable insights.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.3,
        topP: 0.8,
        maxOutputTokens: 1500,
      }
    });

    return {
      success: true,
      certificate: certificate,
      analysis: response.text || "Analysis could not be completed.",
      relatedCertificates: relatedCerts
    };

  } catch (error) {
    console.error('Error in analyzeCertificateWithDB:', error);
    return {
      success: false,
      message: `Analysis failed: ${error.message}`
    };
  }
}

/**
 * Get database insights and recommendations
 */
export async function getDatabaseInsights() {
  if (!ai) {
    return {
      success: false,
      message: "AI service is unavailable."
    };
  }

  try {
    const dbContext = await getCertificateContext();
    
    if (!dbContext) {
      return {
        success: false,
        message: "Could not access database context."
      };
    }

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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.4,
        topP: 0.9,
        maxOutputTokens: 2000,
      }
    });

    return {
      success: true,
      insights: response.text || "Insights could not be generated.",
      summary: dbContext.summary,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error in getDatabaseInsights:', error);
    return {
      success: false,
      message: `Insights generation failed: ${error.message}`
    };
  }
}

/**
 * Parse certificate content with Gemini
 */
export async function parseCertificateWithGemini(pemContent, fileName = 'certificate') {
  if (!ai) {
    return {
      success: false,
      message: "AI service is unavailable."
    };
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
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
      return {
        success: true,
        certificate: parsed
      };
    } catch (parseError) {
      return {
        success: false,
        message: "Failed to parse certificate analysis response."
      };
    }

  } catch (error) {
    console.error('Error in parseCertificateWithGemini:', error);
    return {
      success: false,
      message: `Certificate parsing failed: ${error.message}`
    };
  }
}