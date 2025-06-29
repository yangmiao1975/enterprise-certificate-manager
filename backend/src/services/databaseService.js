/**
 * Multi-Cloud Database Service
 * Handles connections to SQLite, Cloud SQL PostgreSQL, AWS RDS, Azure PostgreSQL
 * Provides unified interface with automatic failover and connection pooling
 */

import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import DatabaseConfig from '../config/database-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class DatabaseService {
  constructor() {
    this.config = new DatabaseConfig();
    this.connection = null;
    this.isConnected = false;
    this.connectionPool = null;
    this.healthCheckInterval = null;
    this.provider = this.config.provider;
    
    console.log(`🗄️  Initializing Database Service: ${this.provider.toUpperCase()}`);
  }

  /**
   * Initialize database connection based on provider
   * @returns {Promise<Object>} Database connection
   */
  async initialize() {
    try {
      const dbConfig = this.config.getCurrentConfig();
      
      if (!this.config.validateConfig()) {
        throw new Error(`Invalid configuration for database provider: ${this.provider}`);
      }

      switch (this.provider) {
        case 'sqlite':
          await this.initializeSQLite(dbConfig);
          break;
        case 'gcp-cloudsql':
          await this.initializePostgreSQL(dbConfig);
          break;
        case 'aws-rds':
          await this.initializePostgreSQL(dbConfig);
          break;
        case 'azure-postgresql':
          await this.initializePostgreSQL(dbConfig);
          break;
        default:
          throw new Error(`Unsupported database provider: ${this.provider}`);
      }

      await this.createTables();
      await this.initializeDefaultData();
      this.startHealthCheck();
      
      console.log(`✅ Database initialized successfully: ${this.provider}`);
      return this.connection;
      
    } catch (error) {
      console.error(`❌ Database initialization failed:`, error);
      throw error;
    }
  }

  /**
   * Initialize SQLite connection (development/local)
   * @param {Object} config - SQLite configuration
   */
  async initializeSQLite(config) {
    try {
      const sqlite3 = (await import('sqlite3')).default;
      
      const dbPath = config.database;
      
      // Ensure data directory exists
      const dataDir = dirname(dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.connection = new sqlite3.Database(dbPath);
    } catch (error) {
      throw new Error('SQLite support requires "sqlite3" package. Install with: npm install sqlite3');
    }
    
    // Add promisified helpers first
    this.connection.getAsync = promisify(this.connection.get).bind(this.connection);
    this.connection.allAsync = promisify(this.connection.all).bind(this.connection);
    this.connection.runAsync = promisify(this.connection.run).bind(this.connection);
    this.connection.execAsync = promisify(this.connection.exec).bind(this.connection);
    
    // Enable WAL mode for better concurrency
    if (config.options?.enableWAL) {
      await this.connection.execAsync('PRAGMA journal_mode=WAL');
    }
    
    // Apply pragma settings
    if (config.options?.pragma) {
      for (const [key, value] of Object.entries(config.options.pragma)) {
        await this.connection.execAsync(`PRAGMA ${key}=${value}`);
      }
    }

    this.isConnected = true;
  }

  /**
   * Initialize PostgreSQL connection (Cloud SQL, RDS, Azure)
   * @param {Object} config - PostgreSQL configuration
   */
  async initializePostgreSQL(config) {
    try {
      // Dynamic import to handle optional dependency
      const { Pool } = await import('pg');
      
      // Create connection pool
      this.connectionPool = new Pool({
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: config.database,
        ssl: config.ssl,
        max: config.extra?.max || 20,
        min: config.extra?.min || 5,
        idleTimeoutMillis: config.extra?.idle || 10000,
        connectionTimeoutMillis: config.extra?.acquire || 60000,
        application_name: 'certificate-manager'
      });

      // Test connection
      const client = await this.connectionPool.connect();
      await client.query('SELECT NOW()');
      client.release();

      // Create unified interface similar to SQLite
      this.connection = {
        getAsync: async (sql, params = []) => {
          const client = await this.connectionPool.connect();
          try {
            const result = await client.query(this.convertSQLiteToPostgreSQL(sql), params);
            return result.rows[0] || null;
          } finally {
            client.release();
          }
        },
        
        allAsync: async (sql, params = []) => {
          const client = await this.connectionPool.connect();
          try {
            const result = await client.query(this.convertSQLiteToPostgreSQL(sql), params);
            return result.rows;
          } finally {
            client.release();
          }
        },
        
        runAsync: async (sql, params = []) => {
          const client = await this.connectionPool.connect();
          try {
            const result = await client.query(this.convertSQLiteToPostgreSQL(sql), params);
            return {
              lastID: result.rows[0]?.id || null,
              changes: result.rowCount
            };
          } finally {
            client.release();
          }
        },
        
        execAsync: async (sql) => {
          const client = await this.connectionPool.connect();
          try {
            await client.query(sql);
          } finally {
            client.release();
          }
        }
      };

      this.isConnected = true;
      console.log(`🐘 PostgreSQL connected: ${config.host}:${config.port}/${config.database}`);
      
    } catch (error) {
      console.error('PostgreSQL connection failed:', error);
      
      // Fallback to SQLite if PostgreSQL fails
      if (this.provider !== 'sqlite') {
        console.log('⚠️  Falling back to SQLite...');
        this.provider = 'sqlite';
        this.config.switchProvider('sqlite');
        await this.initializeSQLite(this.config.getCurrentConfig());
      } else {
        throw error;
      }
    }
  }

  /**
   * Convert SQLite SQL to PostgreSQL SQL
   * @param {String} sql - SQLite SQL query
   * @returns {String} PostgreSQL compatible SQL
   */
  convertSQLiteToPostgreSQL(sql) {
    return sql
      // Convert AUTOINCREMENT to SERIAL
      .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
      // Convert DATETIME to TIMESTAMP
      .replace(/DATETIME/gi, 'TIMESTAMP')
      // Convert BOOLEAN DEFAULT to proper PostgreSQL syntax
      .replace(/BOOLEAN DEFAULT (\d+)/gi, 'BOOLEAN DEFAULT $1::boolean')
      // Convert INSERT OR IGNORE to INSERT ... ON CONFLICT DO NOTHING
      .replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO')
      // Convert IF NOT EXISTS for CREATE INDEX (PostgreSQL doesn't support it)
      .replace(/CREATE INDEX IF NOT EXISTS/gi, 'CREATE INDEX')
      // Convert IF NOT EXISTS for CREATE TRIGGER (PostgreSQL doesn't support it)
      .replace(/CREATE TRIGGER IF NOT EXISTS/gi, 'CREATE OR REPLACE FUNCTION')
      // Convert SQLite parameter placeholders ? to PostgreSQL $1, $2, etc.
      .replace(/\?/g, (match, offset, string) => {
        const beforeMatch = string.substring(0, offset);
        const paramCount = (beforeMatch.match(/\$/g) || []).length + 1;
        return `$${paramCount}`;
      })
      // Convert AND active = 1 to AND active = true
      .replace(/active\s*=\s*1/gi, 'active = true')
      .replace(/active\s*=\s*0/gi, 'active = false')
      // Handle CURRENT_TIMESTAMP
      .replace(/DEFAULT CURRENT_TIMESTAMP/gi, 'DEFAULT CURRENT_TIMESTAMP');
  }

  /**
   * Create database tables based on provider
   */
  async createTables() {
    console.log('📋 Creating database tables...');
    
    if (this.provider === 'sqlite') {
      await this.createSQLiteTables();
    } else {
      await this.createPostgreSQLTables();
    }
  }

  /**
   * Create SQLite tables
   */
  async createSQLiteTables() {
    const tables = this.getSQLiteTableDefinitions();
    
    for (const [tableName, sql] of Object.entries(tables)) {
      try {
        await this.connection.execAsync(sql);
        console.log(`  ✓ Created table: ${tableName}`);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.error(`  ❌ Failed to create table ${tableName}:`, error.message);
          throw error;
        }
      }
    }

    // Create indexes
    await this.createIndexes();
  }

  /**
   * Create PostgreSQL tables
   */
  async createPostgreSQLTables() {
    const tables = this.getPostgreSQLTableDefinitions();
    
    for (const [tableName, sql] of Object.entries(tables)) {
      try {
        await this.connection.execAsync(sql);
        console.log(`  ✓ Created table: ${tableName}`);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.error(`  ❌ Failed to create table ${tableName}:`, error.message);
          throw error;
        }
      }
    }

    // Create indexes
    await this.createIndexes();
  }

  /**
   * Get SQLite table definitions
   * @returns {Object} Table definitions
   */
  getSQLiteTableDefinitions() {
    return {
      users: `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          google_id TEXT UNIQUE,
          username TEXT UNIQUE,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT,
          display_name TEXT,
          avatar TEXT,
          role TEXT NOT NULL DEFAULT 'viewer',
          active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
      
      roles: `
        CREATE TABLE IF NOT EXISTS roles (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          description TEXT,
          permissions TEXT NOT NULL
        )
      `,
      
      folders: `
        CREATE TABLE IF NOT EXISTS folders (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          type TEXT NOT NULL,
          permissions TEXT NOT NULL,
          created_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          access_control TEXT
        )
      `,
      
      certificates: `
        CREATE TABLE IF NOT EXISTS certificates (
          id TEXT PRIMARY KEY,
          common_name TEXT NOT NULL,
          issuer TEXT NOT NULL,
          subject TEXT NOT NULL,
          valid_from DATETIME NOT NULL,
          valid_to DATETIME NOT NULL,
          algorithm TEXT NOT NULL,
          serial_number TEXT NOT NULL,
          status TEXT NOT NULL,
          pem_content TEXT,
          folder_id TEXT,
          uploaded_by TEXT,
          uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_temp BOOLEAN DEFAULT 0,
          gcp_certificate_name TEXT,
          FOREIGN KEY (folder_id) REFERENCES folders (id),
          FOREIGN KEY (uploaded_by) REFERENCES users (id)
        )
      `,
      
      metadata: `
        CREATE TABLE IF NOT EXISTS metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `
    };
  }

  /**
   * Get PostgreSQL table definitions
   * @returns {Object} Table definitions
   */
  getPostgreSQLTableDefinitions() {
    return {
      // Create tables without foreign keys first
      users: `
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          google_id VARCHAR(255) UNIQUE,
          username VARCHAR(255) UNIQUE,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash TEXT,
          display_name VARCHAR(255),
          avatar TEXT,
          role VARCHAR(50) NOT NULL DEFAULT 'viewer',
          active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
      
      roles: `
        CREATE TABLE IF NOT EXISTS roles (
          id VARCHAR(50) PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          description TEXT,
          permissions TEXT NOT NULL
        )
      `,
      
      folders: `
        CREATE TABLE IF NOT EXISTS folders (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          type VARCHAR(50) NOT NULL,
          permissions TEXT NOT NULL,
          created_by VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          access_control TEXT
        )
      `,
      
      metadata: `
        CREATE TABLE IF NOT EXISTS metadata (
          key VARCHAR(255) PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
      
      // Create tables with foreign keys last (removed constraints for now to fix syntax error)
      certificates: `
        CREATE TABLE IF NOT EXISTS certificates (
          id VARCHAR(255) PRIMARY KEY,
          common_name VARCHAR(255) NOT NULL,
          issuer TEXT NOT NULL,
          subject TEXT NOT NULL,
          valid_from TIMESTAMP NOT NULL,
          valid_to TIMESTAMP NOT NULL,
          algorithm VARCHAR(100) NOT NULL,
          serial_number VARCHAR(255) NOT NULL,
          status VARCHAR(50) NOT NULL,
          pem_content TEXT,
          folder_id VARCHAR(255),
          uploaded_by INTEGER,
          uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_temp BOOLEAN DEFAULT false,
          gcp_certificate_name VARCHAR(255)
        )
      `
    };
  }

  /**
   * Create database indexes for performance
   */
  async createIndexes() {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_certificates_folder ON certificates(folder_id)',
      'CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status)',
      'CREATE INDEX IF NOT EXISTS idx_certificates_valid_to ON certificates(valid_to)',
      'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_folders_type ON folders(type)'
    ];

    for (const indexSql of indexes) {
      try {
        await this.connection.execAsync(indexSql);
      } catch (error) {
        // Ignore "already exists" errors
        if (!error.message.includes('already exists')) {
          console.error('Index creation error:', error.message);
        }
      }
    }
  }

  /**
   * Initialize default data (roles, admin user, folders)
   */
  async initializeDefaultData() {
    console.log('🏗️  Initializing default data...');
    
    // Insert default roles
    await this.insertDefaultRoles();
    
    // Insert default admin user
    await this.insertDefaultAdmin();
    
    // Insert default folders
    await this.insertDefaultFolders();
    
    // Insert default metadata
    await this.insertDefaultMetadata();
  }

  async insertDefaultRoles() {
    const roles = [
      {
        id: 'admin',
        name: 'Administrator',
        description: 'Full system access',
        permissions: JSON.stringify([
          'certificates:read', 'certificates:write', 'certificates:delete', 'certificates:renew',
          'folders:read', 'folders:write', 'folders:delete', 'system:settings', 'notifications:manage'
        ])
      },
      {
        id: 'manager',
        name: 'Certificate Manager',
        description: 'Can manage certificates and folders',
        permissions: JSON.stringify([
          'certificates:read', 'certificates:write', 'certificates:renew',
          'folders:read', 'folders:write', 'notifications:view'
        ])
      },
      {
        id: 'viewer',
        name: 'Certificate Viewer',
        description: 'Read-only access to certificates',
        permissions: JSON.stringify(['certificates:read', 'folders:read'])
      }
    ];

    for (const role of roles) {
      try {
        if (this.provider === 'sqlite') {
          await this.connection.runAsync(
            'INSERT OR IGNORE INTO roles (id, name, description, permissions) VALUES (?, ?, ?, ?)',
            [role.id, role.name, role.description, role.permissions]
          );
        } else {
          // PostgreSQL: INSERT ... ON CONFLICT DO NOTHING
          await this.connection.runAsync(
            'INSERT INTO roles (id, name, description, permissions) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
            [role.id, role.name, role.description, role.permissions]
          );
        }
      } catch (error) {
        console.error(`Error inserting role ${role.id}:`, error.message);
      }
    }
  }

  async insertDefaultAdmin() {
    try {
      // Check if admin user exists
      const existingAdmin = await this.connection.getAsync(
        'SELECT id FROM users WHERE username = ?',
        ['admin']
      );

      if (!existingAdmin) {
        const bcrypt = await import('bcryptjs');
        const passwordHash = await bcrypt.default.hash('admin123', 10);
        
        if (this.provider === 'sqlite') {
          await this.connection.runAsync(
            'INSERT INTO users (username, email, password_hash, role, active) VALUES (?, ?, ?, ?, ?)',
            ['admin', 'admin@example.com', passwordHash, 'admin', 1]
          );
        } else {
          await this.connection.runAsync(
            'INSERT INTO users (username, email, password_hash, role, active) VALUES ($1, $2, $3, $4, $5)',
            ['admin', 'admin@example.com', passwordHash, 'admin', true]
          );
        }
        console.log('  ✓ Default admin user created');
      }
    } catch (error) {
      console.error('Error creating default admin:', error.message);
    }
  }

  async insertDefaultFolders() {
    const folders = [
      {
        id: 'all-certificates',
        name: 'All Certificates',
        description: 'System folder containing all certificates',
        type: 'system',
        permissions: JSON.stringify(['read']),
        created_by: 'admin-user'
      },
      {
        id: 'temp-uploads',
        name: 'Temporary Uploads',
        description: 'Temporary storage for uploaded certificates pending review',
        type: 'system',
        permissions: JSON.stringify(['read', 'write', 'delete']),
        created_by: 'admin-user'
      },
      {
        id: 'prod-servers',
        name: 'Production Servers',
        description: 'Certificates for production servers',
        type: 'custom',
        permissions: JSON.stringify(['read', 'write']),
        created_by: 'admin-user',
        access_control: JSON.stringify({
          roles: ['admin', 'manager'],
          users: ['admin-user']
        })
      }
    ];

    for (const folder of folders) {
      try {
        if (this.provider === 'sqlite') {
          await this.connection.runAsync(
            'INSERT OR IGNORE INTO folders (id, name, description, type, permissions, created_by, access_control) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [folder.id, folder.name, folder.description, folder.type, folder.permissions, folder.created_by, folder.access_control]
          );
        } else {
          await this.connection.runAsync(
            'INSERT INTO folders (id, name, description, type, permissions, created_by, access_control) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
            [folder.id, folder.name, folder.description, folder.type, folder.permissions, folder.created_by, folder.access_control]
          );
        }
      } catch (error) {
        console.error(`Error inserting folder ${folder.id}:`, error.message);
      }
    }
  }

  async insertDefaultMetadata() {
    const defaultMetadata = {
      tempFolder: {
        enabled: true,
        path: './temp_certs',
        maxSize: '100MB',
        cleanupInterval: 3600000,
        retentionDays: 7
      },
      system: {
        name: 'Enterprise Certificate Manager',
        description: 'A Venafi-like application to manage enterprise certificates',
        version: '1.0.0',
        provider: this.provider
      }
    };

    try {
      if (this.provider === 'sqlite') {
        await this.connection.runAsync(
          'INSERT OR IGNORE INTO metadata (key, value) VALUES (?, ?)',
          ['system_config', JSON.stringify(defaultMetadata)]
        );
      } else {
        await this.connection.runAsync(
          'INSERT INTO metadata (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
          ['system_config', JSON.stringify(defaultMetadata)]
        );
      }
    } catch (error) {
      console.error('Error inserting metadata:', error.message);
    }
  }

  /**
   * Start health check monitoring
   */
  startHealthCheck() {
    const healthConfig = this.config.getHealthCheckConfig();
    if (!healthConfig.enabled) return;

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.healthCheck();
      } catch (error) {
        console.error('❌ Database health check failed:', error.message);
        // Attempt reconnection logic here if needed
      }
    }, healthConfig.interval);

    console.log(`🔍 Database health check started (${healthConfig.interval}ms)`);
  }

  /**
   * Perform database health check
   */
  async healthCheck() {
    if (this.provider === 'sqlite') {
      await this.connection.getAsync('SELECT 1');
    } else {
      const client = await this.connectionPool.connect();
      try {
        await client.query('SELECT 1');
      } finally {
        client.release();
      }
    }
  }

  /**
   * Get database connection
   * @returns {Object} Database connection
   */
  getConnection() {
    if (!this.isConnected) {
      throw new Error('Database not connected. Call initialize() first.');
    }
    return this.connection;
  }

  /**
   * Switch to different database provider
   * @param {String} newProvider - New provider name
   */
  async switchProvider(newProvider) {
    console.log(`🔄 Switching database provider from ${this.provider} to ${newProvider}`);
    
    // Close current connection
    await this.close();
    
    // Switch provider
    this.provider = newProvider;
    this.config.switchProvider(newProvider);
    
    // Reinitialize with new provider
    await this.initialize();
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.connectionPool) {
      await this.connectionPool.end();
      this.connectionPool = null;
    }

    if (this.connection && this.provider === 'sqlite') {
      await new Promise((resolve) => {
        this.connection.close(resolve);
      });
    }

    this.connection = null;
    this.isConnected = false;
    console.log('🔌 Database connection closed');
  }

  /**
   * Execute raw SQL (for compatibility)
   */
  async execAsync(sql) {
    return await this.connection.execAsync(sql);
  }
}

export default DatabaseService;