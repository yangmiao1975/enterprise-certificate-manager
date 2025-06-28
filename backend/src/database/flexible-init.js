const DatabaseConfig = require('../config/database');
const PasswordService = require('../services/passwordService');
const fs = require('fs');
const { dirname, join } = require('path');

let dbInstance;
let dbConfig;
let passwordService;

/**
 * Initialize database with flexible configuration
 */
async function initializeDatabase() {
  try {
    dbConfig = new DatabaseConfig();
    passwordService = new PasswordService();
    
    console.log(`Initializing database: ${dbConfig.config.type}`);
    
    // Create database connection
    dbInstance = await dbConfig.createConnection();
    
    // Create tables based on database type
    await createTables();
    
    // Insert default data
    await insertDefaultData();
    
    console.log('Database initialized successfully');
    return dbInstance;
    
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

/**
 * Create tables with database-specific SQL
 */
async function createTables() {
  const dialect = dbConfig.getDialectSpecificSQL();
  
  // Users table
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id ${dialect.autoIncrement},
      google_id ${dialect.textType} UNIQUE,
      username ${dialect.textType} UNIQUE,
      email ${dialect.textType} UNIQUE NOT NULL,
      password_hash ${dialect.textType},
      display_name ${dialect.textType},
      avatar ${dialect.textType},
      role ${dialect.textType} NOT NULL DEFAULT 'viewer',
      active ${dialect.boolean} DEFAULT true,
      created_at ${dialect.timestamp},
      updated_at ${dialect.timestamp}
    )
  `;

  // Roles table
  const createRolesTable = `
    CREATE TABLE IF NOT EXISTS roles (
      id ${dialect.textType} PRIMARY KEY,
      name ${dialect.textType} NOT NULL,
      description ${dialect.textType}
    )
  `;

  // Role permissions table
  const createRolePermissionsTable = `
    CREATE TABLE IF NOT EXISTS role_permissions (
      id ${dialect.autoIncrement},
      role_id ${dialect.textType} NOT NULL,
      permission ${dialect.textType} NOT NULL,
      UNIQUE(role_id, permission)
    )
  `;

  // Certificates table
  const createCertificatesTable = `
    CREATE TABLE IF NOT EXISTS certificates (
      id ${dialect.textType} PRIMARY KEY,
      common_name ${dialect.textType} NOT NULL,
      issuer ${dialect.textType},
      subject ${dialect.textType},
      valid_from ${dialect.textType} NOT NULL,
      valid_to ${dialect.textType} NOT NULL,
      algorithm ${dialect.textType},
      serial_number ${dialect.textType},
      pem_content ${dialect.textType} NOT NULL,
      status ${dialect.textType} DEFAULT 'active',
      folder_id ${dialect.textType},
      uploaded_by ${dialect.textType},
      uploaded_at ${dialect.timestamp},
      gcp_certificate_name ${dialect.textType},
      is_temp ${dialect.boolean} DEFAULT false,
      created_at ${dialect.timestamp},
      updated_at ${dialect.timestamp}
    )
  `;

  // Folders table
  const createFoldersTable = `
    CREATE TABLE IF NOT EXISTS folders (
      id ${dialect.textType} PRIMARY KEY,
      name ${dialect.textType} NOT NULL,
      parent_id ${dialect.textType},
      created_by ${dialect.textType},
      created_at ${dialect.timestamp},
      updated_at ${dialect.timestamp}
    )
  `;

  // Execute table creation
  const tables = [
    { name: 'users', sql: createUsersTable },
    { name: 'roles', sql: createRolesTable },
    { name: 'role_permissions', sql: createRolePermissionsTable },
    { name: 'certificates', sql: createCertificatesTable },
    { name: 'folders', sql: createFoldersTable }
  ];

  for (const table of tables) {
    try {
      await dbInstance.runAsync(table.sql);
      console.log(`✓ Created/verified ${table.name} table`);
    } catch (error) {
      console.error(`✗ Error creating ${table.name} table:`, error);
      throw error;
    }
  }
}

/**
 * Insert default data (roles, permissions, admin user)
 */
async function insertDefaultData() {
  try {
    // Insert default roles
    await insertDefaultRoles();
    
    // Insert default role permissions
    await insertDefaultRolePermissions();
    
    // Insert default admin user
    await insertDefaultAdminUser();
    
    console.log('✓ Default data inserted successfully');
  } catch (error) {
    console.error('✗ Error inserting default data:', error);
    throw error;
  }
}

/**
 * Insert default roles
 */
async function insertDefaultRoles() {
  const roles = [
    { id: 'admin', name: 'Administrator', description: 'Full system access' },
    { id: 'manager', name: 'Certificate Manager', description: 'Can manage certificates and folders' },
    { id: 'viewer', name: 'Certificate Viewer', description: 'Read-only access to certificates' }
  ];

  for (const role of roles) {
    try {
      // Use INSERT OR IGNORE for SQLite, ON CONFLICT DO NOTHING for PostgreSQL
      let sql;
      if (dbConfig.config.type === 'sqlite') {
        sql = 'INSERT OR IGNORE INTO roles (id, name, description) VALUES (?, ?, ?)';
      } else {
        sql = 'INSERT INTO roles (id, name, description) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING';
      }
      
      await dbInstance.runAsync(sql, [role.id, role.name, role.description]);
    } catch (error) {
      // Ignore duplicate key errors
      if (!error.message.includes('UNIQUE') && !error.message.includes('duplicate')) {
        throw error;
      }
    }
  }
}

/**
 * Insert default role permissions
 */
async function insertDefaultRolePermissions() {
  const rolePermissions = [
    // Admin permissions
    { role_id: 'admin', permission: 'certificates:read' },
    { role_id: 'admin', permission: 'certificates:write' },
    { role_id: 'admin', permission: 'certificates:delete' },
    { role_id: 'admin', permission: 'certificates:renew' },
    { role_id: 'admin', permission: 'folders:read' },
    { role_id: 'admin', permission: 'folders:write' },
    { role_id: 'admin', permission: 'folders:delete' },
    { role_id: 'admin', permission: 'system:settings' },
    { role_id: 'admin', permission: 'notifications:manage' },
    
    // Manager permissions
    { role_id: 'manager', permission: 'certificates:read' },
    { role_id: 'manager', permission: 'certificates:write' },
    { role_id: 'manager', permission: 'certificates:renew' },
    { role_id: 'manager', permission: 'folders:read' },
    { role_id: 'manager', permission: 'folders:write' },
    { role_id: 'manager', permission: 'notifications:view' },
    
    // Viewer permissions
    { role_id: 'viewer', permission: 'certificates:read' },
    { role_id: 'viewer', permission: 'folders:read' }
  ];

  for (const perm of rolePermissions) {
    try {
      let sql;
      if (dbConfig.config.type === 'sqlite') {
        sql = 'INSERT OR IGNORE INTO role_permissions (role_id, permission) VALUES (?, ?)';
      } else {
        sql = 'INSERT INTO role_permissions (role_id, permission) VALUES (?, ?) ON CONFLICT (role_id, permission) DO NOTHING';
      }
      
      await dbInstance.runAsync(sql, [perm.role_id, perm.permission]);
    } catch (error) {
      // Ignore duplicate key errors
      if (!error.message.includes('UNIQUE') && !error.message.includes('duplicate')) {
        throw error;
      }
    }
  }
}

/**
 * Insert default admin user with secure password storage
 */
async function insertDefaultAdminUser() {
  try {
    // Check if admin user already exists
    const existingAdmin = await dbInstance.getAsync(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      ['admin', 'admin@example.com']
    );

    if (existingAdmin) {
      console.log('✓ Default admin user already exists');
      return;
    }

    // Create secure password hash
    const defaultPassword = 'admin123';
    const passwordRef = await passwordService.hashAndStorePassword('admin', defaultPassword);

    // Insert default admin user
    await dbInstance.runAsync(
      'INSERT INTO users (username, email, password_hash, role, active) VALUES (?, ?, ?, ?, ?)',
      ['admin', 'admin@example.com', passwordRef, 'admin', true]
    );

    console.log('✓ Default admin user created with secure password storage');
    console.log('  Username: admin');
    console.log('  Password: admin123');
    console.log('  Note: Change this password in production!');
    
  } catch (error) {
    console.error('✗ Error creating default admin user:', error);
    throw error;
  }
}

/**
 * Get database instance
 */
function getDatabase() {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return dbInstance;
}

/**
 * Get password service instance
 */
function getPasswordService() {
  if (!passwordService) {
    passwordService = new PasswordService();
  }
  return passwordService;
}

/**
 * Close database connection
 */
async function closeDatabase() {
  if (dbInstance) {
    if (typeof dbInstance.close === 'function') {
      await dbInstance.close();
    } else if (typeof dbInstance.end === 'function') {
      await dbInstance.end();
    }
    dbInstance = null;
  }
}

module.exports = {
  initializeDatabase,
  getDatabase,
  getPasswordService,
  closeDatabase
};