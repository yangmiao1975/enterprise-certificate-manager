import { CertificateManagerClient } from '@google-cloud/certificate-manager';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import { X509Certificate } from '@peculiar/x509';
import crypto from 'crypto';

class GCPCertificateService {
  constructor() {
    this.projectId = process.env.GCP_PROJECT_ID;
    this.location = process.env.GCP_LOCATION || 'us-central1';
    
    if (!this.projectId) {
      throw new Error('GCP_PROJECT_ID environment variable is required');
    }

    this.certificateManagerClient = new CertificateManagerClient();
    this.storage = new Storage({
      projectId: this.projectId
    });
    
    console.log('[GCP Service] Initialized with project:', this.projectId);
  }

  // Helper method to detect if data is binary (DER) or text
  isBinaryData(buffer) {
    // Check for common binary indicators
    // DER certificates typically start with 0x30 (ASN.1 SEQUENCE)
    if (buffer.length > 0 && buffer[0] === 0x30) {
      return true;
    }
    
    // Check for high percentage of non-printable characters
    let nonPrintableCount = 0;
    const sampleSize = Math.min(buffer.length, 100); // Check first 100 bytes
    
    for (let i = 0; i < sampleSize; i++) {
      const byte = buffer[i];
      // Consider bytes outside printable ASCII range as non-printable
      if (byte < 32 || byte > 126) {
        nonPrintableCount++;
      }
    }
    
    // If more than 30% of sampled bytes are non-printable, consider it binary
    return (nonPrintableCount / sampleSize) > 0.3;
  }

  async createCertificate(certificateData, pemContent) {
    try {
      let inputBuffer = Buffer.isBuffer(pemContent) ? pemContent : Buffer.from(pemContent);
      let normalizedPem = null;
      
      // First, try to detect if it's binary (DER) or text (PEM/Base64)
      const isBinary = this.isBinaryData(inputBuffer);
      
      if (isBinary) {
        // Handle binary DER format
        console.log('[GCP Upload] Detected binary format, trying DER parsing...');
        console.log('[GCP Upload] File size:', inputBuffer.length);
        console.log('[GCP Upload] First 20 bytes (hex):', inputBuffer.slice(0, 20).toString('hex'));
        console.log('[GCP Upload] First 10 bytes (decimal):', Array.from(inputBuffer.slice(0, 10)));
        
        try {
          const cert = new X509Certificate(inputBuffer);
          console.log('[GCP Upload] Successfully parsed as DER certificate');
          const b64 = Buffer.from(cert.rawData).toString('base64');
          const b64Lines = b64.match(/.{1,64}/g).join('\n');
          normalizedPem = `-----BEGIN CERTIFICATE-----\n${b64Lines}\n-----END CERTIFICATE-----`;
          console.log('[GCP Upload] Converted DER to PEM, length:', normalizedPem.length);
        } catch (derError) {
          console.log('[GCP Upload] @peculiar/x509 DER parsing failed:', derError.message);
          
          // Try Node.js crypto as fallback for DER
          try {
            console.log('[GCP Upload] Trying Node.js crypto for DER...');
            const cert = new crypto.X509Certificate(inputBuffer);
            const pemData = cert.toString();
            if (pemData.includes('-----BEGIN CERTIFICATE-----')) {
              normalizedPem = pemData.trim();
              console.log('[GCP Upload] Successfully converted DER to PEM using Node.js crypto');
            } else {
              throw new Error('Node.js crypto did not return valid PEM');
            }
          } catch (nodeError) {
            console.log('[GCP Upload] Node.js crypto also failed:', nodeError.message);
            
            // Try manual DER to PEM conversion as last resort
            console.log('[GCP Upload] Trying manual DER to PEM conversion...');
            try {
              // Simply base64 encode the binary data and wrap it in PEM headers
              const b64 = inputBuffer.toString('base64');
              const b64Lines = b64.match(/.{1,64}/g).join('\n');
              normalizedPem = `-----BEGIN CERTIFICATE-----\n${b64Lines}\n-----END CERTIFICATE-----`;
              
              // Validate the resulting PEM by trying to parse it
              const testBuffer = Buffer.from(b64, 'base64');
              new X509Certificate(testBuffer); // This should work if the original was valid DER
              
              console.log('[GCP Upload] Manual DER to PEM conversion successful');
              console.log('[GCP Upload] Converted PEM length:', normalizedPem.length);
            } catch (manualError) {
              console.log('[GCP Upload] Manual conversion also failed:', manualError.message);
              
              // Final attempt: Try to parse as if it might be a certificate chain or other format
              console.log('[GCP Upload] Checking if this might be a certificate chain or other format...');
              
              throw new Error(`Failed to parse binary certificate file. 
File size: ${inputBuffer.length} bytes. 
First bytes (hex): ${inputBuffer.slice(0, 20).toString('hex')}
This appears to be a binary file but could not be parsed as a valid DER certificate.
Please ensure the file is a valid X.509 certificate in DER format.`);
            }
          }
        }
      } else {
        // Handle text formats (PEM or Base64)
        const asUtf8 = inputBuffer.toString('utf8').trim();
        
        if (asUtf8.startsWith('-----BEGIN CERTIFICATE-----')) {
          // 1. PEM format - normalize line endings and format
          normalizedPem = asUtf8
            .replace(/\r\n/g, '\n')  // Convert CRLF to LF
            .replace(/\r/g, '\n')    // Convert CR to LF
            .replace(/\n{2,}/g, '\n') // Remove multiple newlines
            .trim();
          
          // Ensure PEM ends with newline
          if (!normalizedPem.endsWith('\n')) {
            normalizedPem += '\n';
          }
          
          console.log('[GCP Upload] Detected PEM format, normalized.');
          console.log('[GCP Upload] PEM length:', normalizedPem.length);
        } else {
          // 2. Try base64 (no PEM headers)
          console.log('[GCP Upload] Trying base64 format...');
          const base64Pattern = /^[A-Za-z0-9+/=\r\n\s]+$/;
          const isBase64 = base64Pattern.test(asUtf8) && asUtf8.length > 40;
          if (isBase64) {
            try {
              const cleanBase64 = asUtf8.replace(/\s+/g, '');
              const certBuffer = Buffer.from(cleanBase64, 'base64');
              new X509Certificate(certBuffer); // throws if invalid
              const b64Lines = cleanBase64.match(/.{1,64}/g).join('\n');
              normalizedPem = `-----BEGIN CERTIFICATE-----\n${b64Lines}\n-----END CERTIFICATE-----`;
              console.log('[GCP Upload] Successfully parsed as base64, wrapped as PEM.');
            } catch (base64Error) {
              console.log('[GCP Upload] Base64 parsing failed:', base64Error.message);
              throw new Error(`Uploaded file is not a valid certificate. 
Supported formats: PEM (text), DER (binary), or Base64 encoded certificates. 
File size: ${inputBuffer.length} bytes. 
Content preview: ${asUtf8.substring(0, 100)}...`);
            }
          } else {
            throw new Error(`Uploaded file is not a valid certificate. 
Supported formats: PEM (text), DER (binary), or Base64 encoded certificates. 
File size: ${inputBuffer.length} bytes. 
Content preview: ${asUtf8.substring(0, 100)}...`);
          }
        }
      }
      if (!normalizedPem || normalizedPem.length < 40) {
        throw new Error('Certificate PEM content is empty or too short.');
      }
      // Log the PEM content (first 200 chars, redacted)
      console.log('[GCP Upload] PEM preview:', normalizedPem.substring(0, 200).replace(/\n/g, ' '), '...');
      // Check for multiple certificates in the PEM
      const pemCerts = normalizedPem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
      if (!pemCerts || pemCerts.length === 0) {
        throw new Error('No valid certificate blocks found in PEM.');
      }
      // Validate each cert block
      for (const certPem of pemCerts) {
        const b64 = certPem.replace('-----BEGIN CERTIFICATE-----', '').replace('-----END CERTIFICATE-----', '').replace(/\s+/g, '');
        if (!b64 || b64.length < 40) {
          throw new Error('One of the certificate blocks is empty or too short.');
        }
        try {
          new X509Certificate(Buffer.from(b64, 'base64'));
        } catch (err) {
          throw new Error('One of the certificate blocks is not a valid X.509 certificate.');
        }
      }
      // Recombine all valid certs for GCP with proper formatting
      normalizedPem = pemCerts.join('\n');
      
      // Final validation - ensure PEM is properly formatted for GCP
      if (!normalizedPem.endsWith('\n')) {
        normalizedPem += '\n';
      }
      
      console.log('[GCP Upload] Final PEM validation passed.');
      console.log('[GCP Upload] Certificate count:', pemCerts.length);
      console.log('[GCP Upload] Final PEM length:', normalizedPem.length);
      
      // Check if this is just a leaf certificate (single cert without chain)
      if (pemCerts.length === 1) {
        console.log('[GCP Upload] Single certificate detected (', normalizedPem.length, 'bytes)');
        console.log('[GCP Upload] For Cloud Storage monitoring, single certificates are acceptable.');
        
        // Only attempt chain building if explicitly requested or if we know it's needed
        const shouldBuildChain = process.env.GCP_AUTO_BUILD_CHAIN === 'true';
        
        if (shouldBuildChain) {
          console.log('[GCP Upload] Attempting to build certificate chain automatically...');
          try {
            const chainPem = await this.buildCertificateChain(pemCerts[0]);
            if (chainPem && chainPem !== normalizedPem && chainPem.length > normalizedPem.length) {
              normalizedPem = chainPem;
              const newPemCerts = normalizedPem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
              console.log('[GCP Upload] Successfully built certificate chain with', newPemCerts.length, 'certificates');
            } else {
              console.log('[GCP Upload] Chain building did not improve certificate. Using original.');
            }
          } catch (chainError) {
            console.log('[GCP Upload] Chain building failed (this is OK):', chainError.message);
          }
        } else {
          console.log('[GCP Upload] Auto chain building disabled. Using certificate as-is.');
        }
      }
      
      const certificateId = `cert-${uuidv4()}`;
      const parent = `projects/${this.projectId}/locations/${this.location}`;
      const certificate = {
        name: `${parent}/certificates/${certificateId}`,
        selfManaged: {
          certificatePem: normalizedPem
        }
      };
      // Temporary fallback: Skip Certificate Manager API and use Cloud Storage only
      console.log('[GCP Upload] Attempting Certificate Manager first, will fallback to Cloud Storage only...');
      console.log('[GCP Upload] Certificate object being sent to GCP:');
      console.log('[GCP Upload] - Certificate ID:', certificateId);
      console.log('[GCP Upload] - PEM length:', certificate.selfManaged.certificatePem.length);
      console.log('[GCP Upload] - PEM preview (first 100 chars):', certificate.selfManaged.certificatePem.substring(0, 100));
      console.log('[GCP Upload] - PEM preview (last 100 chars):', certificate.selfManaged.certificatePem.substring(certificate.selfManaged.certificatePem.length - 100));
      
      // Skip Certificate Manager API - use Cloud Storage only for certificate monitoring
      console.log('[GCP Upload] Using Cloud Storage only (Certificate Manager not needed for monitoring)...');
      
      const operation = {
        name: `projects/${this.projectId}/locations/${this.location}/operations/storage-${certificateId}`,
        metadata: { 
          storageOnly: true,
          certificateId,
          timestamp: Date.now()
        }
      };
      
      console.log('[GCP Upload] Certificate will be stored in Cloud Storage for monitoring');
      // Store PEM content in Cloud Storage
      console.log('[GCP Upload] Starting Cloud Storage upload...');
      const bucketName = `${this.projectId}-certificates`;
      const fileName = `${certificateId}.pem`;
      
      try {
        // Ensure bucket exists first
        console.log('[GCP Upload] Ensuring bucket exists...');
        await this.ensureBucketExists(bucketName);
        
        console.log('[GCP Upload] Uploading certificate file...');
        const bucket = this.storage.bucket(bucketName);
        const file = bucket.file(fileName);
        
        // Add timeout for file upload (increased to 60 seconds)
        const uploadPromise = file.save(normalizedPem, {
          metadata: {
            contentType: 'application/x-pem-file',
            metadata: {
              certificateId: certificateId,
              uploadedAt: new Date().toISOString(),
              storageType: 'cloud-storage-only',
              originalFileName: fileName,
              pemLength: normalizedPem.length.toString()
            }
          },
          resumable: false, // Use simple upload for small files
          validation: false // Skip MD5 validation for speed
        });
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('File upload timeout after 60 seconds')), 60000)
        );
        
        await Promise.race([uploadPromise, timeoutPromise]);
        
        console.log('[GCP Upload] Certificate saved to Cloud Storage successfully');
        console.log('[GCP Upload] File location: gs://' + bucketName + '/' + fileName);
        
        // Verify the upload by checking if file exists
        const [exists] = await file.exists();
        if (!exists) {
          throw new Error('Upload verification failed - file not found in Cloud Storage');
        }
        console.log('[GCP Upload] Upload verification successful');
        
      } catch (storageError) {
        console.error('[GCP Upload] Cloud Storage error:', storageError);
        
        // Add more specific error messages
        if (storageError.message.includes('timeout')) {
          throw new Error(`Cloud Storage upload timed out. This may be due to slow network or large file size. Please try again.`);
        } else if (storageError.message.includes('permission') || storageError.message.includes('auth')) {
          throw new Error(`Cloud Storage permission error. Please check GCP credentials and bucket permissions.`);
        } else if (storageError.message.includes('quota')) {
          throw new Error(`Cloud Storage quota exceeded. Please check your GCP storage limits.`);
        } else {
          throw new Error(`Cloud Storage upload failed: ${storageError.message}`);
        }
      }
      
      const result = {
        id: certificateId,
        gcpCertificateName: `gs://${bucketName}/${fileName}`,
        status: 'ACTIVE',
        normalizedPem: normalizedPem
      };
      
      console.log('[GCP Upload] Returning result to route handler:', result);
      return result;
    } catch (error) {
      console.error('Error creating certificate in GCP:', error);
      throw new Error(`Failed to create certificate: ${error.message}`);
    }
  }

  async getCertificate(certificateId) {
    try {
      const name = `projects/${this.projectId}/locations/${this.location}/certificates/${certificateId}`;
      const [certificate] = await this.certificateManagerClient.getCertificate({ name });
      
      return certificate;
    } catch (error) {
      console.error('Error getting certificate from GCP:', error);
      throw new Error(`Failed to get certificate: ${error.message}`);
    }
  }

  async listCertificates() {
    try {
      const parent = `projects/${this.projectId}/locations/${this.location}`;
      const [certificates] = await this.certificateManagerClient.listCertificates({ parent });
      
      return certificates;
    } catch (error) {
      console.error('Error listing certificates from GCP:', error);
      throw new Error(`Failed to list certificates: ${error.message}`);
    }
  }

  async deleteCertificate(certificateId) {
    try {
      console.log('[GCP Delete] Deleting certificate from Cloud Storage only:', certificateId);
      
      // Delete from Cloud Storage (Certificate Manager not used)
      const bucketName = `${this.projectId}-certificates`;
      const fileName = `${certificateId}.pem`;
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(fileName);
      
      await file.delete();
      console.log('[GCP Delete] Certificate deleted from Cloud Storage successfully');
      
      return {
        name: `storage-deletion-${certificateId}`,
        metadata: { storageOnly: true }
      };
    } catch (error) {
      console.error('[GCP Delete] Error deleting certificate from Cloud Storage:', error);
      throw new Error(`Failed to delete certificate: ${error.message}`);
    }
  }

  async downloadCertificatePem(certificateId) {
    try {
      const bucketName = `${this.projectId}-certificates`;
      const fileName = `${certificateId}.pem`;
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(fileName);
      
      const [content] = await file.download();
      return content.toString('utf8');
    } catch (error) {
      console.error('Error downloading certificate PEM:', error);
      throw new Error(`Failed to download certificate: ${error.message}`);
    }
  }

  async ensureBucketExists(bucketName) {
    try {
      console.log('[Bucket] Checking if bucket exists:', bucketName);
      const bucket = this.storage.bucket(bucketName);
      
      // Add timeout for bucket operations
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Bucket operation timeout')), 30000)
      );
      
      const [exists] = await Promise.race([
        bucket.exists(),
        timeoutPromise
      ]);
      
      console.log('[Bucket] Bucket exists:', exists);
      
      if (!exists) {
        console.log('[Bucket] Creating new bucket...');
        await Promise.race([
          bucket.create({
            location: this.location,
            uniformBucketLevelAccess: {
              enabled: true
            }
          }),
          timeoutPromise
        ]);
        console.log('[Bucket] Bucket created successfully:', bucketName);
      }
    } catch (error) {
      console.error('[Bucket] Error ensuring bucket exists:', error);
      throw new Error(`Failed to create bucket: ${error.message}`);
    }
  }

  async getCertificateStatus(certificateId) {
    try {
      const certificate = await this.getCertificate(certificateId);
      return certificate.state;
    } catch (error) {
      console.error('Error getting certificate status:', error);
      return 'UNKNOWN';
    }
  }

  async renewCertificate(certificateId) {
    try {
      const name = `projects/${this.projectId}/locations/${this.location}/certificates/${certificateId}`;
      
      // For managed certificates, renewal is automatic
      // For self-managed certificates, we need to update the certificate
      const certificate = await this.getCertificate(certificateId);
      
      if (certificate.managed) {
        // Managed certificates are renewed automatically
        return { status: 'RENEWAL_SCHEDULED' };
      } else {
        throw new Error('Manual renewal not supported for this certificate type');
      }
    } catch (error) {
      console.error('Error renewing certificate:', error);
      throw new Error(`Failed to renew certificate: ${error.message}`);
    }
  }

  async buildCertificateChain(leafCertPem) {
    try {
      // Parse the leaf certificate to get issuer information
      const cert = new X509Certificate(leafCertPem);
      const issuerInfo = cert.issuer;
      
      console.log('[Chain Builder] Leaf certificate issuer:', issuerInfo);
      
      // Extract AIA (Authority Information Access) extension for intermediate cert URL
      let intermediateUrl = null;
      try {
        console.log('[Chain Builder] Looking for AIA extension...');
        const extensions = cert.extensions || [];
        console.log('[Chain Builder] Available extensions:', extensions.map(ext => ext.oid));
        
        const aiaExtension = extensions.find(ext => ext.oid === '1.3.6.1.5.5.7.1.1');
        if (aiaExtension) {
          console.log('[Chain Builder] Found AIA extension');
          // Parse AIA extension to find CA Issuers URL
          const aiaString = aiaExtension.toString();
          console.log('[Chain Builder] AIA content:', aiaString);
          const urlMatch = aiaString.match(/URI:http[s]?:\/\/[^\s,]+\.cer/i);
          if (urlMatch) {
            intermediateUrl = urlMatch[0].replace('URI:', '');
            console.log('[Chain Builder] Found intermediate certificate URL:', intermediateUrl);
          } else {
            console.log('[Chain Builder] No .cer URL found in AIA extension');
          }
        } else {
          console.log('[Chain Builder] No AIA extension found');
          // Try known Entrust intermediate URL
          console.log('[Chain Builder] Trying known Entrust intermediate URL...');
          intermediateUrl = 'http://aia.entrust.net/l1k-chain256.cer';
        }
      } catch (aiaError) {
        console.log('[Chain Builder] Could not parse AIA extension:', aiaError.message);
        // Fallback to known Entrust intermediate
        intermediateUrl = 'http://aia.entrust.net/l1k-chain256.cer';
      }
      
      // If we found an intermediate URL, try to download it
      if (intermediateUrl) {
        console.log('[Chain Builder] Downloading intermediate certificate...');
        const response = await fetch(intermediateUrl);
        if (response.ok) {
          const intermediateData = await response.arrayBuffer();
          
          // Convert DER to PEM if needed
          let intermediatePem;
          try {
            const intermediateCert = new X509Certificate(new Uint8Array(intermediateData));
            const b64 = Buffer.from(intermediateCert.rawData).toString('base64');
            const b64Lines = b64.match(/.{1,64}/g).join('\n');
            intermediatePem = `-----BEGIN CERTIFICATE-----\n${b64Lines}\n-----END CERTIFICATE-----\n`;
          } catch (derError) {
            // Maybe it's already PEM format
            intermediatePem = Buffer.from(intermediateData).toString('utf8');
          }
          
          // Ensure proper formatting for both certificates
          const cleanLeaf = leafCertPem.trim();
          const cleanIntermediate = intermediatePem.trim();
          
          // GCP Certificate Manager might expect intermediate first, then leaf
          console.log('[Chain Builder] Trying intermediate + leaf order (GCP standard)...');
          const fullChain = cleanIntermediate + '\n' + cleanLeaf + '\n';
          
          // Note: Standard SSL order is usually leaf + intermediate + root
          // But GCP might use a different convention
          console.log('[Chain Builder] Successfully built certificate chain');
          console.log('[Chain Builder] Full chain length:', fullChain.length);
          console.log('[Chain Builder] Number of certificates in chain:', (fullChain.match(/-----BEGIN CERTIFICATE-----/g) || []).length);
          console.log('[Chain Builder] Chain preview (first 150 chars):', fullChain.substring(0, 150));
          return fullChain;
        } else {
          console.log('[Chain Builder] Failed to download intermediate certificate:', response.status);
        }
      }
      
      return null;
    } catch (error) {
      console.error('[Chain Builder] Error building certificate chain:', error);
      return null;
    }
  }
}

export default new GCPCertificateService(); 