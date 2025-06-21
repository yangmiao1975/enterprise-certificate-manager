
import { GoogleGenAI, GenerateContentResponse, Content } from "@google/genai";
import { AIChatMessage, Certificate } from '../types'; // Added Certificate import

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("API_KEY for Gemini is not set. AI features will be disabled or use mock data.");
}

const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

const MOCK_INSIGHTS = `
Here are some certificate management best practices:

1.  **Maintain a Comprehensive Inventory:** Keep an accurate, up-to-date inventory of all your SSL/TLS certificates. This includes details like expiration dates, issuing CAs, key strengths, and associated applications. Automated discovery tools can be invaluable here.

2.  **Implement Proactive Renewal Strategies:** Don't wait until the last minute to renew certificates. Establish automated renewal processes and set up alerts for certificates expiring within 30, 60, and 90 days. This minimizes the risk of unexpected outages due to expired certificates.

3.  **Standardize Certificate Types and CAs:** Limit the number of Certificate Authorities (CAs) you use and standardize on specific certificate types and key algorithms (e.g., RSA 2048-bit or ECDSA P-256). This simplifies management and reduces the attack surface.

4.  **Secure Private Keys:** Private keys are the cornerstone of your certificate security. Store them securely, restrict access, and use hardware security modules (HSMs) for high-value certificates. Regularly audit access and rotate keys according to policy.

5.  **Automate Lifecycle Management:** Where possible, automate the entire certificate lifecycle, from request and issuance to deployment, renewal, and revocation. This reduces manual effort, minimizes errors, and improves security posture.
`;

export const getCertificateManagementInsights = async (): Promise<string> => {
  if (!ai) {
    // console.log("Using mock AI insights as API key is not available.");
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
    return MOCK_INSIGHTS;
  }

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
      contents: `Provide 3-5 concise, actionable best practices for enterprise certificate management. 
      Focus on security, renewal strategies, and inventory management. 
      Present each practice as a short paragraph starting with a bolded title (e.g., "**Practice Title:** Message.").
      Ensure the output is plain text suitable for direct display in a web UI.`,
    });
    return response.text;
  } catch (error) {
    console.error("Error fetching insights from Gemini API:", error);
    return "Failed to load AI-powered insights. Please check your API key and network connection. Using fallback advice:\n\n" + MOCK_INSIGHTS;
  }
};

export const getChatResponse = async (
    history: AIChatMessage[], 
    newMessage: string,
    managedCertificates: Certificate[] // New parameter
): Promise<string> => {
    if (!ai) {
        await new Promise(resolve => setTimeout(resolve, 500));
        return "AI Chat is unavailable (API key missing). If you asked about a certificate, please ensure it's valid and not expired.";
    }

    let certificateContext = "The user is managing the following certificates:\n";
    if (managedCertificates && managedCertificates.length > 0) {
        managedCertificates.forEach(cert => {
            certificateContext += `- CN: ${cert.commonName}, Issuer: ${cert.issuer}, Valid To: ${new Date(cert.validTo).toLocaleDateString()}, Status: ${cert.status}\n`;
        });
    } else {
        certificateContext += "No certificates are currently being managed or provided in context.\n";
    }
    certificateContext += "\nRefer to this list when answering questions about specific certificates or their status. If a certificate is mentioned by the user but not in this list, state that you don't have information on it for this session.\n";


    const systemInstruction = `You are a helpful assistant for an enterprise certificate management platform.
${certificateContext}
Users might ask about certificate best practices, specific certificate details (based on the provided list), or general security advice related to PKI.
Keep responses concise and professional.
For example, if a user says "Tell me about my cert CN=prod.example.com", and 'prod.example.com' is in the list you were provided, you can use its details from the list to answer.
Do not make up certificate details if not provided in the list.
If asked for general advice, provide it.
If asked for information that requires external lookup beyond general knowledge (e.g. current vulnerabilities for specific software), state that you cannot provide real-time threat intelligence.`;

    try {
        const geminiHistory: Content[] = history.map(h => ({role: h.role, parts: [{text: h.text}]}));

        // Create chat session with dynamic system instruction and history for each call
        const chat = ai.chats.create({
            model: 'gemini-2.5-flash-preview-04-17',
            config: {
                systemInstruction: systemInstruction,
            },
            history: geminiHistory, 
        });
        
        const response: GenerateContentResponse = await chat.sendMessage({
            message: newMessage,
            // History is managed by the chat object, no need to pass it here again
        });

        return response.text;

    } catch (error) {
        console.error("Error getting chat response from Gemini API:", error);
        return "Sorry, I encountered an error trying to process your request. Please try again.";
    }
};


export interface GeminiCertificateAnalysis {
  isCertificate: boolean;
  commonName?: string;
  subject?: string;
  issuer?: string;
  serialNumber?: string; // Hex, colon-separated
  validFrom?: string;    // ISO 8601
  validTo?: string;      // ISO 8601
  algorithm?: string;    // OID or friendly name
  pemRepresentation?: string;
  errorReason?: string;
}

export const analyzeCertificateWithGemini = async (base64CertificateData: string, fileName?: string): Promise<GeminiCertificateAnalysis> => {
  if (!ai) {
    await new Promise(resolve => setTimeout(resolve, 300)); // Simulate delay
    // Simulate an error if AI is not available
    return {
      isCertificate: false,
      errorReason: "AI service is unavailable. Certificate analysis could not be performed.",
    };
  }

  const prompt = `You are an expert X.509 certificate analyzer. I am providing you with base64 encoded data which represents the content of a file named '${fileName || 'uploaded_file'}'. This data could be a PEM-encoded certificate, a DER-encoded certificate, or other file data.

First, determine if the provided data is a valid X.509 certificate.

If it is a valid X.509 certificate, extract the following information:
- commonName: The Common Name (CN) from the Subject. If not present, use a relevant part of the Subject or indicate absence.
- subject: The full Subject Distinguished Name (DN) as a string (e.g., "CN=example.com, O=My Org, C=US").
- issuer: The full Issuer Distinguished Name (DN) as a string.
- serialNumber: The certificate serial number as a hexadecimal string, with octets separated by colons (e.g., "0A:1B:2C:3D:4E:5F"). Ensure leading zeros for each octet if necessary.
- validFrom: The 'notBefore' validity date in ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ).
- validTo: The 'notAfter' validity date in ISO 8601 format (YYYY-MM-DDTHH:mm:ssZ).
- algorithm: The signature algorithm OID or a common friendly name (e.g., "sha256WithRSAEncryption" or "1.2.840.113549.1.1.11").
- pemRepresentation: The full PEM representation of the certificate, including "-----BEGIN CERTIFICATE-----" and "-----END CERTIFICATE-----" markers and line breaks. If the input data appears to be DER, convert it to this PEM format. If the input data is already PEM, re-format it consistently.
- isCertificate: A boolean indicating if the input was successfully parsed as a valid X.509 certificate.
- errorReason: If 'isCertificate' is false, provide a brief, user-friendly reason (e.g., "Not a certificate", "Corrupted data", "Input appears to be a Certificate Signing Request (CSR)", "Input appears to be a private key"). If 'isCertificate' is true, this should be null or an empty string.

Return this information strictly as a JSON object. Do not include any explanatory text, greetings, or markdown formatting outside the JSON structure itself.

Example of successful JSON output:
{
  "isCertificate": true,
  "commonName": "example.com",
  "subject": "CN=example.com, O=My Org, C=US",
  "issuer": "CN=My CA, O=My Org, C=US",
  "serialNumber": "01:23:45:67:89:AB:CD:EF",
  "validFrom": "2023-01-01T00:00:00Z",
  "validTo": "2024-01-01T00:00:00Z",
  "algorithm": "sha256WithRSAEncryption",
  "pemRepresentation": "-----BEGIN CERTIFICATE-----\\nMIIC...\\n-----END CERTIFICATE-----",
  "errorReason": null
}

Example of error JSON output:
{
  "isCertificate": false,
  "errorReason": "Input data does not appear to be a valid X.509 certificate."
}

The base64 encoded certificate data to analyze is:
${base64CertificateData}
`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });
    
    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }

    try {
      const parsedData = JSON.parse(jsonStr) as GeminiCertificateAnalysis;
      // Basic validation of the parsed structure
      if (typeof parsedData.isCertificate !== 'boolean') {
          console.error("Gemini response missing 'isCertificate' boolean:", parsedData);
          return { isCertificate: false, errorReason: "AI analysis returned an unexpected format (missing isCertificate)." };
      }
      return parsedData;
    } catch (e) {
      console.error("Failed to parse JSON response from Gemini:", e, "\nRaw response:", jsonStr);
      return { isCertificate: false, errorReason: "AI analysis returned invalid JSON." };
    }

  } catch (error) {
    console.error("Error analyzing certificate with Gemini API:", error);
    return { 
        isCertificate: false, 
        errorReason: `AI service request failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
};
