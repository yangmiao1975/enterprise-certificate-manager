/**
 * Multi-Cloud Secret Manager Service
 * Supports GCP Secret Manager and AWS Secrets Manager
 * Designed for easy switching between cloud providers
 */

class SecretManagerService {
  constructor() {
    this.provider = process.env.SECRET_MANAGER_PROVIDER || 'gcp';
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT;
    this.region = process.env.AWS_REGION || 'us-east-1';
    
    console.log(`Initializing Secret Manager: ${this.provider.toUpperCase()}`);
    
    // Initialize the appropriate client
    this.initializeClient();
  }

  initializeClient() {
    switch (this.provider.toLowerCase()) {
      case 'gcp':
      case 'google':
        this.initializeGCPClient();
        break;
      case 'aws':
        this.initializeAWSClient();
        break;
      case 'azure':
        this.initializeAzureClient();
        break;
      default:
        throw new Error(`Unsupported secret manager provider: ${this.provider}`);
    }
  }

  initializeGCPClient() {
    try {
      const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
      this.client = new SecretManagerServiceClient();
      this.isAvailable = true;
      console.log('✓ GCP Secret Manager initialized');
    } catch (error) {
      console.log('⚠ GCP Secret Manager not available:', error.message);
      this.isAvailable = false;
    }
  }

  initializeAWSClient() {
    try {
      const AWS = require('aws-sdk');
      this.client = new AWS.SecretsManager({ region: this.region });
      this.isAvailable = true;
      console.log('✓ AWS Secrets Manager initialized');
    } catch (error) {
      console.log('⚠ AWS Secrets Manager not available:', error.message);
      this.isAvailable = false;
    }
  }

  initializeAzureClient() {
    try {
      const { SecretClient } = require('@azure/keyvault-secrets');
      const { DefaultAzureCredential } = require('@azure/identity');
      
      const vaultName = process.env.AZURE_KEYVAULT_NAME;
      if (!vaultName) {
        throw new Error('AZURE_KEYVAULT_NAME environment variable required');
      }
      
      const url = `https://${vaultName}.vault.azure.net`;
      const credential = new DefaultAzureCredential();
      this.client = new SecretClient(url, credential);
      this.isAvailable = true;
      console.log('✓ Azure Key Vault initialized');
    } catch (error) {
      console.log('⚠ Azure Key Vault not available:', error.message);
      this.isAvailable = false;
    }
  }

  /**
   * Create a new secret
   * @param {string} secretName - Name of the secret
   * @param {string} secretValue - Value to store
   * @param {Object} labels - Optional labels/metadata
   * @returns {Promise<string>} - Secret identifier
   */
  async createSecret(secretName, secretValue, labels = {}) {
    if (!this.isAvailable) {
      throw new Error(`${this.provider} Secret Manager not available`);
    }

    switch (this.provider.toLowerCase()) {
      case 'gcp':
      case 'google':
        return this.createGCPSecret(secretName, secretValue, labels);
      case 'aws':
        return this.createAWSSecret(secretName, secretValue, labels);
      case 'azure':
        return this.createAzureSecret(secretName, secretValue, labels);
    }
  }

  async createGCPSecret(secretName, secretValue, labels) {
    const parent = `projects/${this.projectId}`;
    
    try {
      // Create the secret
      const [secret] = await this.client.createSecret({
        parent: parent,
        secretId: secretName,
        secret: {
          replication: { automatic: {} },
          labels: labels
        },
      });

      // Add the secret value
      const [version] = await this.client.addSecretVersion({
        parent: secret.name,
        payload: { data: Buffer.from(secretValue) },
      });

      console.log(`✓ GCP Secret created: ${secretName}`);
      return version.name;
    } catch (error) {
      if (error.code === 6) { // ALREADY_EXISTS
        // Add new version to existing secret
        const [version] = await this.client.addSecretVersion({
          parent: `${parent}/secrets/${secretName}`,
          payload: { data: Buffer.from(secretValue) },
        });
        console.log(`✓ GCP Secret updated: ${secretName}`);
        return version.name;
      }
      throw error;
    }
  }

  async createAWSSecret(secretName, secretValue, labels) {
    const params = {
      Name: secretName,
      SecretString: secretValue,
      Description: labels.description || `Created by Certificate Manager`,
      Tags: Object.entries(labels).map(([key, value]) => ({ Key: key, Value: value }))
    };

    try {
      const result = await this.client.createSecret(params).promise();
      console.log(`✓ AWS Secret created: ${secretName}`);
      return result.ARN;
    } catch (error) {
      if (error.code === 'ResourceExistsException') {
        // Update existing secret
        const updateParams = {
          SecretId: secretName,
          SecretString: secretValue
        };
        const result = await this.client.updateSecret(updateParams).promise();
        console.log(`✓ AWS Secret updated: ${secretName}`);
        return result.ARN;
      }
      throw error;
    }
  }

  async createAzureSecret(secretName, secretValue, labels) {
    try {
      const result = await this.client.setSecret(secretName, secretValue, {
        tags: labels
      });
      console.log(`✓ Azure Secret created: ${secretName}`);
      return result.name;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get a secret value
   * @param {string} secretName - Name of the secret
   * @returns {Promise<string>} - Secret value
   */
  async getSecret(secretName) {
    if (!this.isAvailable) {
      throw new Error(`${this.provider} Secret Manager not available`);
    }

    switch (this.provider.toLowerCase()) {
      case 'gcp':
      case 'google':
        return this.getGCPSecret(secretName);
      case 'aws':
        return this.getAWSSecret(secretName);
      case 'azure':
        return this.getAzureSecret(secretName);
    }
  }

  async getGCPSecret(secretName) {
    const name = `projects/${this.projectId}/secrets/${secretName}/versions/latest`;
    const [version] = await this.client.accessSecretVersion({ name });
    return version.payload.data.toString();
  }

  async getAWSSecret(secretName) {
    const params = { SecretId: secretName };
    const result = await this.client.getSecretValue(params).promise();
    return result.SecretString;
  }

  async getAzureSecret(secretName) {
    const result = await this.client.getSecret(secretName);
    return result.value;
  }

  /**
   * Delete a secret
   * @param {string} secretName - Name of the secret
   * @returns {Promise<void>}
   */
  async deleteSecret(secretName) {
    if (!this.isAvailable) {
      throw new Error(`${this.provider} Secret Manager not available`);
    }

    switch (this.provider.toLowerCase()) {
      case 'gcp':
      case 'google':
        return this.deleteGCPSecret(secretName);
      case 'aws':
        return this.deleteAWSSecret(secretName);
      case 'azure':
        return this.deleteAzureSecret(secretName);
    }
  }

  async deleteGCPSecret(secretName) {
    const name = `projects/${this.projectId}/secrets/${secretName}`;
    await this.client.deleteSecret({ name });
    console.log(`✓ GCP Secret deleted: ${secretName}`);
  }

  async deleteAWSSecret(secretName) {
    const params = { SecretId: secretName, ForceDeleteWithoutRecovery: true };
    await this.client.deleteSecret(params).promise();
    console.log(`✓ AWS Secret deleted: ${secretName}`);
  }

  async deleteAzureSecret(secretName) {
    await this.client.beginDeleteSecret(secretName);
    console.log(`✓ Azure Secret deleted: ${secretName}`);
  }

  /**
   * List secrets with optional filtering
   * @param {Object} filter - Filter criteria
   * @returns {Promise<Array>} - List of secrets
   */
  async listSecrets(filter = {}) {
    if (!this.isAvailable) {
      return [];
    }

    switch (this.provider.toLowerCase()) {
      case 'gcp':
      case 'google':
        return this.listGCPSecrets(filter);
      case 'aws':
        return this.listAWSSecrets(filter);
      case 'azure':
        return this.listAzureSecrets(filter);
    }
  }

  async listGCPSecrets(filter) {
    const parent = `projects/${this.projectId}`;
    const request = { parent };
    
    if (filter.labelFilter) {
      request.filter = filter.labelFilter;
    }

    const [secrets] = await this.client.listSecrets(request);
    return secrets.map(secret => ({
      name: secret.name.split('/').pop(),
      fullName: secret.name,
      labels: secret.labels || {},
      created: secret.createTime
    }));
  }

  async listAWSSecrets(filter) {
    const params = {};
    if (filter.nameFilter) {
      params.Filters = [{ Key: 'name', Values: [filter.nameFilter] }];
    }

    const result = await this.client.listSecrets(params).promise();
    return result.SecretList.map(secret => ({
      name: secret.Name,
      arn: secret.ARN,
      tags: secret.Tags || [],
      created: secret.CreatedDate
    }));
  }

  async listAzureSecrets(filter) {
    const secrets = [];
    for await (const secret of this.client.listPropertiesOfSecrets()) {
      if (!filter.nameFilter || secret.name.includes(filter.nameFilter)) {
        secrets.push({
          name: secret.name,
          tags: secret.tags || {},
          created: secret.createdOn
        });
      }
    }
    return secrets;
  }

  /**
   * Check if the secret manager is available and properly configured
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    if (!this.isAvailable) {
      return false;
    }

    try {
      // Try to list secrets to verify connectivity
      await this.listSecrets();
      return true;
    } catch (error) {
      console.error(`Secret Manager health check failed:`, error.message);
      return false;
    }
  }

  /**
   * Get provider-specific configuration info
   * @returns {Object}
   */
  getInfo() {
    return {
      provider: this.provider,
      isAvailable: this.isAvailable,
      projectId: this.projectId,
      region: this.region,
      client: !!this.client
    };
  }
}

export default SecretManagerService;