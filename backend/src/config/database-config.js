/**
 * Multi-Cloud Database Configuration
 * Supports SQLite (dev), Cloud SQL PostgreSQL (GCP), RDS PostgreSQL (AWS), Azure Database for PostgreSQL
 * Enterprise-grade configuration with high availability and failover support
 */

class DatabaseConfig {
  constructor() {
    this.provider = process.env.DATABASE_PROVIDER || 'sqlite';
    this.environment = process.env.NODE_ENV || 'development';
    this.configurations = this.initializeConfigurations();
  }

  initializeConfigurations() {
    return {
      // Development - SQLite (local)
      sqlite: {
        type: 'sqlite',
        database: process.env.SQLITE_DATABASE || './data/certificates.db',
        synchronize: false,
        logging: this.environment === 'development',
        options: {
          enableWAL: true,
          busyTimeout: 30000,
          pragma: {
            journal_mode: 'WAL',
            synchronous: 'NORMAL',
            cache_size: -64000,
            temp_store: 'MEMORY'
          }
        }
      },

      // GCP Cloud SQL PostgreSQL
      'gcp-cloudsql': {
        type: 'postgresql',
        host: process.env.CLOUDSQL_HOST || '/cloudsql/' + process.env.CLOUDSQL_CONNECTION_NAME,
        port: process.env.CLOUDSQL_PORT || 5432,
        username: process.env.CLOUDSQL_USERNAME || process.env.DB_USER,
        password: process.env.CLOUDSQL_PASSWORD || process.env.DB_PASS,
        database: process.env.CLOUDSQL_DATABASE || process.env.DB_NAME || 'certificate_manager',
        
        // Cloud SQL SSL Configuration 
        // When using Cloud SQL Auth Proxy (Unix socket), SSL is handled by the proxy
        ssl: false,
        
        // Connection Pooling for Enterprise Scale
        extra: {
          max: parseInt(process.env.DB_CONNECTION_POOL_MAX) || 20,
          min: parseInt(process.env.DB_CONNECTION_POOL_MIN) || 5,
          idle: parseInt(process.env.DB_CONNECTION_IDLE_TIMEOUT) || 10000,
          acquire: parseInt(process.env.DB_CONNECTION_ACQUIRE_TIMEOUT) || 60000,
          evict: parseInt(process.env.DB_CONNECTION_EVICT_TIMEOUT) || 1000,
          handleDisconnects: true,
          charset: 'utf8mb4'
        },

        // Enterprise Features
        logging: ['error', 'warn'],
        synchronize: false, // Use migrations in production
        migrationsRun: true,
        dropSchema: false,
        
        // High Availability
        replication: {
          master: {
            host: process.env.CLOUDSQL_HOST,
            port: process.env.CLOUDSQL_PORT || 5432,
            username: process.env.CLOUDSQL_USERNAME,
            password: process.env.CLOUDSQL_PASSWORD,
            database: process.env.CLOUDSQL_DATABASE
          },
          slaves: process.env.CLOUDSQL_READ_REPLICAS ? 
            process.env.CLOUDSQL_READ_REPLICAS.split(',').map(replica => ({
              host: replica.trim(),
              port: process.env.CLOUDSQL_PORT || 5432,
              username: process.env.CLOUDSQL_USERNAME,
              password: process.env.CLOUDSQL_PASSWORD,
              database: process.env.CLOUDSQL_DATABASE
            })) : []
        }
      },

      // AWS RDS PostgreSQL (Version 2.0)
      'aws-rds': {
        type: 'postgresql',
        host: process.env.RDS_ENDPOINT || process.env.AWS_RDS_HOST,
        port: process.env.RDS_PORT || 5432,
        username: process.env.RDS_USERNAME || process.env.AWS_RDS_USER,
        password: process.env.RDS_PASSWORD || process.env.AWS_RDS_PASSWORD,
        database: process.env.RDS_DATABASE || process.env.AWS_RDS_DATABASE || 'certificate_manager',
        
        // AWS RDS SSL Configuration
        ssl: {
          rejectUnauthorized: true,
          ca: process.env.AWS_RDS_CA_CERT || undefined
        },
        
        // RDS Connection Pooling
        extra: {
          max: parseInt(process.env.AWS_RDS_CONNECTION_POOL_MAX) || 20,
          min: parseInt(process.env.AWS_RDS_CONNECTION_POOL_MIN) || 5,
          idle: parseInt(process.env.AWS_RDS_CONNECTION_IDLE_TIMEOUT) || 10000,
          acquire: parseInt(process.env.AWS_RDS_CONNECTION_ACQUIRE_TIMEOUT) || 60000,
          evict: parseInt(process.env.AWS_RDS_CONNECTION_EVICT_TIMEOUT) || 1000,
          handleDisconnects: true
        },

        logging: ['error', 'warn'],
        synchronize: false,
        migrationsRun: true,
        
        // AWS Multi-AZ for High Availability
        replication: {
          master: {
            host: process.env.RDS_ENDPOINT,
            port: process.env.RDS_PORT || 5432,
            username: process.env.RDS_USERNAME,
            password: process.env.RDS_PASSWORD,
            database: process.env.RDS_DATABASE
          },
          slaves: process.env.AWS_RDS_READ_REPLICAS ?
            process.env.AWS_RDS_READ_REPLICAS.split(',').map(replica => ({
              host: replica.trim(),
              port: process.env.RDS_PORT || 5432,
              username: process.env.RDS_USERNAME,
              password: process.env.RDS_PASSWORD,
              database: process.env.RDS_DATABASE
            })) : []
        }
      },

      // Azure Database for PostgreSQL (Version 2.0)
      'azure-postgresql': {
        type: 'postgresql',
        host: process.env.AZURE_POSTGRESQL_HOST,
        port: process.env.AZURE_POSTGRESQL_PORT || 5432,
        username: process.env.AZURE_POSTGRESQL_USERNAME + '@' + process.env.AZURE_POSTGRESQL_SERVER_NAME,
        password: process.env.AZURE_POSTGRESQL_PASSWORD,
        database: process.env.AZURE_POSTGRESQL_DATABASE || 'certificate_manager',
        
        // Azure SSL Configuration
        ssl: {
          rejectUnauthorized: true,
          ca: process.env.AZURE_POSTGRESQL_SSL_CERT || undefined
        },
        
        extra: {
          max: parseInt(process.env.AZURE_POSTGRESQL_CONNECTION_POOL_MAX) || 20,
          min: parseInt(process.env.AZURE_POSTGRESQL_CONNECTION_POOL_MIN) || 5,
          idle: parseInt(process.env.AZURE_POSTGRESQL_CONNECTION_IDLE_TIMEOUT) || 10000,
          acquire: parseInt(process.env.AZURE_POSTGRESQL_CONNECTION_ACQUIRE_TIMEOUT) || 60000,
          evict: parseInt(process.env.AZURE_POSTGRESQL_CONNECTION_EVICT_TIMEOUT) || 1000,
          handleDisconnects: true
        },

        logging: ['error', 'warn'],
        synchronize: false,
        migrationsRun: true
      }
    };
  }

  /**
   * Get current database configuration based on provider
   * @returns {Object} Database configuration object
   */
  getCurrentConfig() {
    const config = this.configurations[this.provider];
    if (!config) {
      throw new Error(`Unsupported database provider: ${this.provider}`);
    }

    // Add environment-specific overrides
    return {
      ...config,
      ...this.getEnvironmentOverrides()
    };
  }

  /**
   * Get environment-specific configuration overrides
   * @returns {Object} Environment overrides
   */
  getEnvironmentOverrides() {
    const overrides = {};

    // Production optimizations
    if (this.environment === 'production') {
      overrides.logging = ['error'];
      overrides.synchronize = false;
      overrides.dropSchema = false;
    }

    // Development optimizations
    if (this.environment === 'development') {
      overrides.logging = true;
      overrides.synchronize = false; // Use migrations even in dev
    }

    // Test environment
    if (this.environment === 'test') {
      overrides.logging = false;
      overrides.synchronize = true;
      overrides.dropSchema = true;
    }

    return overrides;
  }

  /**
   * Validate configuration for current provider
   * @returns {Boolean} True if configuration is valid
   */
  validateConfig() {
    const config = this.getCurrentConfig();
    
    switch (this.provider) {
      case 'sqlite':
        return this.validateSQLiteConfig(config);
      case 'gcp-cloudsql':
        return this.validateCloudSQLConfig(config);
      case 'aws-rds':
        return this.validateRDSConfig(config);
      case 'azure-postgresql':
        return this.validateAzureConfig(config);
      default:
        return false;
    }
  }

  validateSQLiteConfig(config) {
    return !!config.database;
  }

  validateCloudSQLConfig(config) {
    const required = ['host', 'username', 'password', 'database'];
    return required.every(field => config[field]);
  }

  validateRDSConfig(config) {
    const required = ['host', 'username', 'password', 'database'];
    return required.every(field => config[field]);
  }

  validateAzureConfig(config) {
    const required = ['host', 'username', 'password', 'database'];
    return required.every(field => config[field]);
  }

  /**
   * Get connection string for current provider (for compatibility)
   * @returns {String} Connection string
   */
  getConnectionString() {
    const config = this.getCurrentConfig();
    
    switch (this.provider) {
      case 'sqlite':
        return config.database;
      case 'gcp-cloudsql':
      case 'aws-rds':
      case 'azure-postgresql':
        return `postgresql://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;
      default:
        throw new Error(`Connection string not supported for provider: ${this.provider}`);
    }
  }

  /**
   * Get migration configuration
   * @returns {Object} Migration settings
   */
  getMigrationConfig() {
    return {
      directory: './src/database/migrations',
      tableName: 'migrations',
      disableTransactions: false,
      loadExtensions: ['.js'],
      sortDirsSeparately: false
    };
  }

  /**
   * Get health check configuration
   * @returns {Object} Health check settings
   */
  getHealthCheckConfig() {
    return {
      enabled: true,
      interval: 30000, // 30 seconds
      timeout: 5000,   // 5 seconds
      retries: 3,
      gracefulShutdownTimeout: 10000 // 10 seconds
    };
  }

  /**
   * Switch database provider (for runtime switching)
   * @param {String} newProvider - New database provider
   */
  switchProvider(newProvider) {
    if (!this.configurations[newProvider]) {
      throw new Error(`Unsupported database provider: ${newProvider}`);
    }
    
    console.log(`Switching database provider from ${this.provider} to ${newProvider}`);
    this.provider = newProvider;
    
    return this.getCurrentConfig();
  }

  /**
   * Get all supported providers
   * @returns {Array} List of supported providers
   */
  getSupportedProviders() {
    return Object.keys(this.configurations);
  }

  /**
   * Check if provider supports specific feature
   * @param {String} feature - Feature to check
   * @returns {Boolean} True if feature is supported
   */
  supportsFeature(feature) {
    const features = {
      'sqlite': ['local', 'file-based', 'embedded'],
      'gcp-cloudsql': ['managed', 'ha', 'backup', 'scaling', 'monitoring'],
      'aws-rds': ['managed', 'ha', 'backup', 'scaling', 'monitoring', 'multi-az'],
      'azure-postgresql': ['managed', 'ha', 'backup', 'scaling', 'monitoring']
    };

    return features[this.provider]?.includes(feature) || false;
  }
}

export default DatabaseConfig;