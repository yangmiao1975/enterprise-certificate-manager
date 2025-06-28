import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import SecretManagerService from './secretManagerService.js';

class PasswordService {
  constructor() {
    this.useSecretManager = process.env.USE_SECRET_MANAGER_PASSWORDS === 'true';
    
    if (this.useSecretManager) {
      try {
        this.secretManager = new SecretManagerService();
      } catch (error) {
        console.log('Secret Manager not available, falling back to traditional hashing:', error.message);
        this.useSecretManager = false;
      }
    }
    
    // Fallback to traditional password hashing if Secret Manager is disabled
    if (!this.useSecretManager) {
      console.log('Using traditional password hashing (not Secret Manager)');
    }
  }

  /**
   * Hash and store password securely
   * @param {string} userId - User ID
   * @param {string} password - Plain text password
   * @returns {Promise<string>} - Password reference/hash
   */
  async hashAndStorePassword(userId, password) {
    if (!this.useSecretManager) {
      // Traditional bcrypt hashing for local development
      return await bcrypt.hash(password, 12);
    }

    try {
      // Generate strong password hash
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      
      // Create unique secret name for this user
      const secretName = `user-password-${userId}-${Date.now()}`;
      
      // Store hashed password in Secret Manager
      await this.secretManager.createSecret(secretName, passwordHash, {
        type: 'user-password',
        userId: userId.toString(),
        createdAt: Date.now().toString(),
        description: `Password for user ${userId}`
      });

      console.log(`Password stored securely for user ${userId}: ${secretName}`);
      
      // Return the secret reference instead of the hash
      const provider = this.secretManager.provider || 'gcp';
      return `${provider}-secret:${secretName}`;
      
    } catch (error) {
      console.error('Error storing password in Secret Manager:', error);
      // Fallback to traditional hashing
      console.log('Falling back to traditional password hashing');
      return await bcrypt.hash(password, 12);
    }
  }

  /**
   * Verify password against stored hash
   * @param {string} password - Plain text password to verify
   * @param {string} storedPasswordRef - Password reference or hash from database
   * @returns {Promise<boolean>} - True if password matches
   */
  async verifyPassword(password, storedPasswordRef) {
    if (!storedPasswordRef) {
      return false;
    }

    // Check if this is a Secret Manager reference (multi-cloud support)
    if (storedPasswordRef.includes('-secret:')) {
      return await this.verifyPasswordFromSecretManager(password, storedPasswordRef);
    }
    
    // Traditional bcrypt verification
    try {
      return await bcrypt.compare(password, storedPasswordRef);
    } catch (error) {
      console.error('Error verifying password:', error);
      return false;
    }
  }

  /**
   * Verify password from Secret Manager
   * @param {string} password - Plain text password
   * @param {string} secretRef - Secret Manager reference
   * @returns {Promise<boolean>} - True if password matches
   */
  async verifyPasswordFromSecretManager(password, secretRef) {
    try {
      // Extract provider and secret name (e.g., "gcp-secret:user-password-1-123456")
      const [provider, secretName] = secretRef.split('-secret:');
      
      const passwordHash = await this.secretManager.getSecret(secretName);
      return await bcrypt.compare(password, passwordHash);
      
    } catch (error) {
      console.error('Error verifying password from Secret Manager:', error);
      return false;
    }
  }

  /**
   * Update user password
   * @param {string} userId - User ID
   * @param {string} newPassword - New plain text password
   * @param {string} oldPasswordRef - Old password reference
   * @returns {Promise<string>} - New password reference
   */
  async updatePassword(userId, newPassword, oldPasswordRef) {
    // Store new password
    const newPasswordRef = await this.hashAndStorePassword(userId, newPassword);
    
    // Clean up old password from Secret Manager if it exists
    if (oldPasswordRef && oldPasswordRef.startsWith('gcp-secret:')) {
      await this.deletePasswordFromSecretManager(oldPasswordRef);
    }
    
    return newPasswordRef;
  }

  /**
   * Delete password from Secret Manager
   * @param {string} secretRef - Secret Manager reference
   */
  async deletePasswordFromSecretManager(secretRef) {
    try {
      const secretName = secretRef.replace('gcp-secret:', '');
      const name = `projects/${this.projectId}/secrets/${secretName}`;
      
      await this.client.deleteSecret({
        name: name,
      });
      
      console.log(`Deleted password secret: ${secretName}`);
    } catch (error) {
      console.error('Error deleting password from Secret Manager:', error);
    }
  }

  /**
   * Clean up old password secrets for a user (housekeeping)
   * @param {string} userId - User ID
   * @param {number} keepRecent - Number of recent passwords to keep (default: 1)
   */
  async cleanupOldPasswords(userId, keepRecent = 1) {
    try {
      const parent = `projects/${this.projectId}`;
      const [secrets] = await this.client.listSecrets({
        parent: parent,
        filter: `labels.type="user-password" AND labels.userId="${userId}"`,
      });

      // Sort by creation time (newest first)
      const userSecrets = secrets
        .filter(secret => secret.labels && secret.labels.userId === userId.toString())
        .sort((a, b) => {
          const timeA = parseInt(a.labels.createdAt) || 0;
          const timeB = parseInt(b.labels.createdAt) || 0;
          return timeB - timeA;
        });

      // Delete old passwords (keep only the most recent ones)
      const secretsToDelete = userSecrets.slice(keepRecent);
      
      for (const secret of secretsToDelete) {
        await this.client.deleteSecret({
          name: secret.name,
        });
        console.log(`Cleaned up old password secret: ${secret.name}`);
      }
      
    } catch (error) {
      console.error('Error cleaning up old passwords:', error);
    }
  }

  /**
   * Generate secure random password
   * @param {number} length - Password length (default: 16)
   * @returns {string} - Generated password
   */
  generateSecurePassword(length = 16) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomBytes(1)[0] % charset.length;
      password += charset[randomIndex];
    }
    
    return password;
  }

  /**
   * Check if Secret Manager is available and configured
   * @returns {Promise<boolean>} - True if Secret Manager is available
   */
  async isSecretManagerAvailable() {
    try {
      if (!this.useSecretManager || !this.projectId) {
        return false;
      }
      
      const parent = `projects/${this.projectId}`;
      await this.client.listSecrets({
        parent: parent,
        pageSize: 1,
      });
      
      return true;
    } catch (error) {
      console.error('Secret Manager not available:', error.message);
      return false;
    }
  }
}

export default PasswordService;