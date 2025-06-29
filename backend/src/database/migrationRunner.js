/**
 * General Database Migration Runner
 * Automatically applies all SQL migrations in chronological order
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDatabase, getDatabaseProvider } from './flexible-init.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Create migrations tracking table
 */
async function createMigrationsTable() {
  const db = getDatabase();
  const provider = getDatabaseProvider();
  
  try {
    if (provider === 'sqlite') {
      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filename VARCHAR(255) UNIQUE NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } else {
      // PostgreSQL
      await db.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          filename VARCHAR(255) UNIQUE NOT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }
    console.log('✓ Migrations tracking table ready');
  } catch (error) {
    console.error('❌ Failed to create migrations table:', error.message);
    throw error;
  }
}

/**
 * Get list of already applied migrations
 */
async function getAppliedMigrations() {
  const db = getDatabase();
  const provider = getDatabaseProvider();
  
  try {
    let rows;
    if (provider === 'sqlite') {
      rows = await db.allAsync('SELECT filename FROM migrations ORDER BY filename');
    } else {
      const result = await db.query('SELECT filename FROM migrations ORDER BY filename');
      rows = result.rows;
    }
    return rows.map(row => row.filename);
  } catch (error) {
    console.warn('⚠️ Could not get applied migrations (table may not exist yet):', error.message);
    return [];
  }
}

/**
 * Mark migration as applied
 */
async function markMigrationApplied(filename) {
  const db = getDatabase();
  const provider = getDatabaseProvider();
  
  try {
    if (provider === 'sqlite') {
      await db.runAsync('INSERT OR IGNORE INTO migrations (filename) VALUES (?)', [filename]);
    } else {
      await db.query('INSERT INTO migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING', [filename]);
    }
    console.log(`✓ Marked migration as applied: ${filename}`);
  } catch (error) {
    console.error(`❌ Failed to mark migration as applied: ${filename}`, error.message);
    throw error;
  }
}

/**
 * Get all migration files from the migrations directory
 */
function getAllMigrationFiles() {
  try {
    const migrationsDir = join(__dirname, 'migrations');
    const files = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Chronological order by filename
    
    console.log(`Found ${files.length} migration files:`, files);
    return files;
  } catch (error) {
    console.warn('⚠️ No migrations directory found or error reading it:', error.message);
    return [];
  }
}

/**
 * Execute a single migration file
 */
async function executeMigration(filename) {
  const db = getDatabase();
  const provider = getDatabaseProvider();
  
  try {
    console.log(`🔄 Applying migration: ${filename}`);
    
    // Read migration SQL
    const migrationPath = join(__dirname, 'migrations', filename);
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    // For PostgreSQL, we need to handle transactions differently
    if (provider === 'postgresql' || provider === 'gcp-cloudsql') {
      // Split into individual statements and execute them
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      for (const statement of statements) {
        if (statement.toUpperCase().includes('BEGIN') || statement.toUpperCase().includes('COMMIT')) {
          // Skip transaction statements - we'll handle transactions ourselves
          continue;
        }
        
        try {
          await db.query(statement);
          console.log(`  ✓ Executed: ${statement.substring(0, 60)}...`);
        } catch (stmtError) {
          if (stmtError.message.includes('already exists') || 
              stmtError.message.includes('duplicate') ||
              stmtError.message.includes('does not exist')) {
            console.log(`  ⚠ Skipped (already exists/handled): ${statement.substring(0, 60)}...`);
          } else {
            console.error(`  ❌ Statement failed: ${statement}`);
            throw stmtError;
          }
        }
      }
    } else {
      // SQLite - can handle multiple statements
      try {
        await db.execAsync(migrationSQL);
        console.log('  ✓ Migration executed successfully');
      } catch (error) {
        // If batch execution fails, try statement by statement
        console.log('  Batch execution failed, trying individual statements...');
        
        const statements = migrationSQL
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        for (const statement of statements) {
          try {
            await db.runAsync(statement);
            console.log(`  ✓ Executed: ${statement.substring(0, 60)}...`);
          } catch (stmtError) {
            if (stmtError.message.includes('already exists') || 
                stmtError.message.includes('duplicate')) {
              console.log(`  ⚠ Skipped (already exists): ${statement.substring(0, 60)}...`);
            } else {
              console.error(`  ❌ Statement failed: ${statement}`);
              throw stmtError;
            }
          }
        }
      }
    }
    
    console.log(`✅ Migration completed: ${filename}`);
    return true;
  } catch (error) {
    console.error(`❌ Migration failed: ${filename}`, error.message);
    throw error;
  }
}

/**
 * Run all pending migrations
 */
async function runAllMigrations() {
  try {
    console.log('🚀 Starting database migrations...');
    
    // Ensure migrations table exists
    await createMigrationsTable();
    
    // Get applied migrations
    const appliedMigrations = await getAppliedMigrations();
    console.log(`Applied migrations: ${appliedMigrations.length}`);
    
    // Get all migration files
    const allMigrationFiles = getAllMigrationFiles();
    
    // Find pending migrations
    const pendingMigrations = allMigrationFiles.filter(file => !appliedMigrations.includes(file));
    
    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations - database is up to date');
      return true;
    }
    
    console.log(`📋 Found ${pendingMigrations.length} pending migrations:`, pendingMigrations);
    
    // Apply each pending migration
    for (const migration of pendingMigrations) {
      try {
        await executeMigration(migration);
        await markMigrationApplied(migration);
      } catch (error) {
        console.error(`❌ Failed to apply migration: ${migration}`);
        throw error;
      }
    }
    
    console.log('🎉 All migrations completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Migration process failed:', error.message);
    throw error;
  }
}

/**
 * Run migrations if called directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  await runAllMigrations();
  process.exit(0);
}

export { runAllMigrations };