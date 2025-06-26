import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db;

export async function initializeDatabase() {
  const dbPath = join(__dirname, '../../data/certificates.db');
  
  // Ensure data directory exists
  const dataDir = dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new sqlite3.Database(dbPath);

  // Create tables
  await createTables();
  
  // Initialize default data
  await initializeDefaultData();
  
  return db;
}

export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  // Add promisified helpers
  db.getAsync = promisify(db.get).bind(db);
  db.allAsync = promisify(db.all).bind(db);
  db.runAsync = promisify(db.run).bind(db);
  return db;
}

async function createTables() {
  // Users table (hybrid: supports Google OAuth and password login)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_id TEXT UNIQUE,                -- For Google OAuth users (nullable for password users)
      username TEXT UNIQUE,                 -- For password users (nullable for Google users)
      email TEXT UNIQUE NOT NULL,           -- Always required
      password_hash TEXT,                   -- For password users (nullable for Google users)
      display_name TEXT,
      avatar TEXT,
      role TEXT NOT NULL DEFAULT 'viewer',
      active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Roles table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      permissions TEXT NOT NULL
    )
  `);

  // Folders table
  await db.exec(`
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
  `);

  // Certificates table
  await db.exec(`
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
  `);

  // Metadata table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes
  await db.exec('CREATE INDEX IF NOT EXISTS idx_certificates_folder ON certificates(folder_id)');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status)');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_certificates_valid_to ON certificates(valid_to)');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_folders_type ON folders(type)');
}

async function initializeDefaultData() {
  // Insert default roles
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
    await db.run(
      'INSERT OR IGNORE INTO roles (id, name, description, permissions) VALUES (?, ?, ?, ?)',
      [role.id, role.name, role.description, role.permissions]
    );
  }

  // Insert default admin user (password: admin123)
  const bcrypt = await import('bcryptjs');
  const passwordHash = await bcrypt.default.hash('admin123', 10);
  
  await db.run(
    'INSERT OR IGNORE INTO users (username, email, password_hash, role, active) VALUES (?, ?, ?, ?, ?)',
    ['admin', 'admin@example.com', passwordHash, 'admin', 1]
  );

  // Insert default folders
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
    await db.run(
      'INSERT OR IGNORE INTO folders (id, name, description, type, permissions, created_by, access_control) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [folder.id, folder.name, folder.description, folder.type, folder.permissions, folder.created_by, folder.access_control]
    );
  }

  // Insert default metadata
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
      description: 'A Venafi-like application to manage enterprise certificates'
    }
  };

  await db.run(
    'INSERT OR IGNORE INTO metadata (key, value) VALUES (?, ?)',
    ['system_config', JSON.stringify(defaultMetadata)]
  );
} 