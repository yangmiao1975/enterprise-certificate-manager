/**
 * Flexible Database Initialization
 * Replaces the old init.js with multi-cloud database support
 * Automatically switches between SQLite, Cloud SQL, RDS, etc.
 */

import DatabaseService from '../services/databaseService.js';
import PasswordService from '../services/passwordService.js';

let databaseService = null;
let passwordService = null;

/**
 * Initialize database with flexible provider support
 * @returns {Promise<Object>} Database connection
 */
export async function initializeDatabase() {
  try {
    console.log('🚀 Initializing flexible database system...');
    
    // Create database service instance
    databaseService = new DatabaseService();
    
    // Initialize the database connection
    const connection = await databaseService.initialize();
    
    // Initialize password service
    passwordService = new PasswordService();
    
    // Run AI provider migration
    try {
      const { runAIProviderMigration } = await import('./runMigration.js');
      await runAIProviderMigration();
    } catch (migrationError) {
      console.warn('⚠️ AI provider migration skipped:', migrationError.message);
    }
    
    console.log(`✅ Database system initialized: ${databaseService.provider.toUpperCase()}`);
    
    return connection;
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    
    // If Cloud SQL fails, fallback to SQLite for development
    if (process.env.NODE_ENV === 'development' && databaseService?.provider !== 'sqlite') {
      console.log('🔄 Falling back to SQLite for development...');
      
      try {
        // Switch to SQLite fallback
        process.env.DATABASE_PROVIDER = 'sqlite';
        databaseService = new DatabaseService();
        const connection = await databaseService.initialize();
        
        console.log('✅ Fallback to SQLite successful');
        return connection;
        
      } catch (fallbackError) {
        console.error('❌ SQLite fallback also failed:', fallbackError);
        throw fallbackError;
      }
    }
    
    throw error;
  }
}

/**
 * Get database connection
 * @returns {Object} Database connection
 */
export function getDatabase() {
  if (!databaseService || !databaseService.isConnected) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  
  return databaseService.getConnection();
}

/**
 * Get password service instance
 * @returns {PasswordService} Password service
 */
export function getPasswordService() {
  if (!passwordService) {
    passwordService = new PasswordService();
  }
  
  return passwordService;
}

/**
 * Get database service instance (for advanced operations)
 * @returns {DatabaseService} Database service
 */
export function getDatabaseService() {
  return databaseService;
}

/**
 * Switch database provider at runtime
 * @param {String} newProvider - New database provider
 * @returns {Promise<Object>} New database connection
 */
export async function switchDatabaseProvider(newProvider) {
  if (!databaseService) {
    throw new Error('Database service not initialized');
  }
  
  console.log(`🔄 Switching database provider to: ${newProvider}`);
  
  try {
    await databaseService.switchProvider(newProvider);
    return databaseService.getConnection();
  } catch (error) {
    console.error(`❌ Failed to switch to ${newProvider}:`, error);
    throw error;
  }
}

/**
 * Get database health status
 * @returns {Promise<Object>} Health status
 */
export async function getDatabaseHealth() {
  if (!databaseService) {
    return {
      status: 'not_initialized',
      provider: null,
      connected: false
    };
  }
  
  try {
    await databaseService.healthCheck();
    
    return {
      status: 'healthy',
      provider: databaseService.provider,
      connected: databaseService.isConnected,
      features: databaseService.config.getSupportedProviders()
    };
    
  } catch (error) {
    return {
      status: 'unhealthy',
      provider: databaseService.provider,
      connected: false,
      error: error.message
    };
  }
}

/**
 * Gracefully close database connections
 * @returns {Promise<void>}
 */
export async function closeDatabaseConnections() {
  if (databaseService) {
    console.log('🔌 Closing database connections...');
    await databaseService.close();
    databaseService = null;
  }
  
  passwordService = null;
}

/**
 * Database migration utilities
 */
export const migration = {
  /**
   * Migrate from SQLite to Cloud SQL
   */
  async migrateToCloudSQL() {
    const { default: SQLiteToCloudSQLMigrator } = await import('./migrate-to-cloudsql.js');
    const migrator = new SQLiteToCloudSQLMigrator();
    await migrator.migrate();
  },
  
  /**
   * Check if migration is needed
   * @returns {Promise<Boolean>} True if migration is recommended
   */
  async isMigrationNeeded() {
    if (!databaseService) return false;
    
    // If running in production with SQLite, migration is recommended
    if (process.env.NODE_ENV === 'production' && databaseService.provider === 'sqlite') {
      return true;
    }
    
    // If Cloud SQL is configured but not being used
    if (process.env.CLOUDSQL_CONNECTION_NAME && databaseService.provider !== 'gcp-cloudsql') {
      return true;
    }
    
    return false;
  },
  
  /**
   * Get migration status
   * @returns {Promise<Object>} Migration status
   */
  async getStatus() {
    const isNeeded = await this.isMigrationNeeded();
    
    return {
      migration_needed: isNeeded,
      current_provider: databaseService?.provider || 'none',
      recommended_provider: process.env.NODE_ENV === 'production' ? 'gcp-cloudsql' : 'sqlite',
      available_providers: databaseService?.config?.getSupportedProviders() || []
    };
  }
};

/**
 * Database configuration utilities
 */
export const config = {
  /**
   * Get current database configuration
   * @returns {Object} Current configuration
   */
  getCurrentConfig() {
    return databaseService?.config?.getCurrentConfig() || null;
  },
  
  /**
   * Get all supported providers
   * @returns {Array} List of supported providers
   */
  getSupportedProviders() {
    return databaseService?.config?.getSupportedProviders() || [];
  },
  
  /**
   * Check if provider supports specific feature
   * @param {String} feature - Feature to check
   * @returns {Boolean} True if supported
   */
  supportsFeature(feature) {
    return databaseService?.config?.supportsFeature(feature) || false;
  },
  
  /**
   * Validate configuration for provider
   * @param {String} provider - Provider to validate
   * @returns {Boolean} True if valid
   */
  validateProvider(provider) {
    if (!databaseService?.config) return false;
    
    const originalProvider = databaseService.config.provider;
    databaseService.config.provider = provider;
    
    const isValid = databaseService.config.validateConfig();
    
    databaseService.config.provider = originalProvider;
    return isValid;
  }
};

/**
 * Setup graceful shutdown
 */
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, closing database connections...');
  await closeDatabaseConnections();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, closing database connections...');
  await closeDatabaseConnections();
  process.exit(0);
});

export default {
  initializeDatabase,
  getDatabase,
  getPasswordService,
  getDatabaseService,
  switchDatabaseProvider,
  getDatabaseHealth,
  closeDatabaseConnections,
  migration,
  config
};