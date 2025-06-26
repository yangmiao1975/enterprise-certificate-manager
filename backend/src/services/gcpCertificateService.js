import { CertificateManagerClient } from '@google-cloud/certificate-manager';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';

class GCPCertificateService {
  constructor() {
    this.projectId = process.env.GCP_PROJECT_ID;
    this.location = process.env.GCP_LOCATION || 'us-central1';
    
    if (!this.projectId) {
      throw new Error('GCP_PROJECT_ID environment variable is required');
    }

    this.certificateManagerClient = new CertificateManagerClient();
    this.storage = new Storage();
  }

  async createCertificate(certificateData, pemContent) {
    try {
      const certificateId = `cert-${uuidv4()}`;
      const parent = `projects/${this.projectId}/locations/${this.location}`;
      
      const certificate = {
        name: `${parent}/certificates/${certificateId}`,
        managed: {
          domains: [certificateData.commonName],
          dnsAuthorizations: [],
          issuanceConfig: `projects/${this.projectId}/locations/${this.location}/certificateIssuanceConfigs/default`
        }
      };

      const [operation] = await this.certificateManagerClient.createCertificate({
        parent,
        certificateId,
        certificate
      });

      // Store PEM content in Cloud Storage
      const bucketName = `${this.projectId}-certificates`;
      await this.ensureBucketExists(bucketName);
      
      const fileName = `${certificateId}.pem`;
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(fileName);
      
      await file.save(pemContent, {
        metadata: {
          contentType: 'application/x-pem-file',
          metadata: {
            commonName: certificateData.commonName,
            issuer: certificateData.issuer,
            validFrom: certificateData.validFrom,
            validTo: certificateData.validTo
          }
        }
      });

      return {
        id: certificateId,
        gcpCertificateName: certificate.name,
        status: 'CREATING'
      };
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
      const name = `projects/${this.projectId}/locations/${this.location}/certificates/${certificateId}`;
      const [operation] = await this.certificateManagerClient.deleteCertificate({ name });
      
      // Also delete from Cloud Storage
      const bucketName = `${this.projectId}-certificates`;
      const fileName = `${certificateId}.pem`;
      const bucket = this.storage.bucket(bucketName);
      const file = bucket.file(fileName);
      
      try {
        await file.delete();
      } catch (storageError) {
        console.warn('Failed to delete certificate from storage:', storageError);
      }

      return operation;
    } catch (error) {
      console.error('Error deleting certificate from GCP:', error);
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
      const bucket = this.storage.bucket(bucketName);
      const [exists] = await bucket.exists();
      
      if (!exists) {
        await bucket.create({
          location: this.location,
          uniformBucketLevelAccess: {
            enabled: true
          }
        });
        // console.log(`Created bucket: ${bucketName}`);
      }
    } catch (error) {
      console.error('Error ensuring bucket exists:', error);
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
}

export default new GCPCertificateService(); 