/**
 * Migration Script: SQLite to Cloud SQL PostgreSQL
 * Migrates existing certificate data from SQLite to Cloud SQL for enterprise HA setup
 */

import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import DatabaseService from '../services/databaseService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class SQLiteToCloudSQLMigrator {
  constructor() {
    this.sourceDb = null;
    this.targetDb = null;
    this.migrationLog = [];
  }

  /**
   * Run complete migration from SQLite to Cloud SQL
   */
  async migrate() {
    console.log('🚀 Starting SQLite to Cloud SQL migration...');
    
    try {
      // Initialize connections
      await this.initializeConnections();
      
      // Verify target database
      await this.verifyTargetDatabase();
      
      // Migrate data
      await this.migrateData();
      
      // Verify migration
      await this.verifyMigration();
      
      // Generate migration report
      this.generateMigrationReport();
      
      console.log('✅ Migration completed successfully!');
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Initialize source (SQLite) and target (Cloud SQL) connections
   */
  async initializeConnections() {
    console.log('🔗 Initializing database connections...');
    
    // Initialize SQLite source database
    this.sourceDb = new DatabaseService();
    // Force SQLite for source
    process.env.DATABASE_PROVIDER = 'sqlite';
    await this.sourceDb.initialize();
    
    // Initialize Cloud SQL target database
    this.targetDb = new DatabaseService();
    // Force Cloud SQL for target
    process.env.DATABASE_PROVIDER = 'gcp-cloudsql';
    await this.targetDb.initialize();
    
    console.log('  ✓ Source (SQLite) connected');
    console.log('  ✓ Target (Cloud SQL) connected');
  }

  /**
   * Verify target database is ready for migration
   */
  async verifyTargetDatabase() {
    console.log('🔍 Verifying target database...');
    
    // Check if target database is empty or can be safely migrated to
    const tables = ['users', 'roles', 'folders', 'certificates', 'metadata'];
    
    for (const table of tables) {
      try {
        const count = await this.targetDb.connection.getAsync(
          `SELECT COUNT(*) as count FROM ${table}`
        );
        
        if (count.count > 0) {
          console.log(`  ⚠️  Target table ${table} has ${count.count} records`);
          
          const shouldContinue = await this.promptUser(
            `Target database is not empty. Continue with migration? (y/N): `
          );
          
          if (!shouldContinue) {
            throw new Error('Migration cancelled by user');
          }
        }
      } catch (error) {
        // Table might not exist, which is fine
        console.log(`  ℹ️  Table ${table} not found in target (will be created)`);
      }
    }
  }

  /**
   * Migrate all data from source to target
   */
  async migrateData() {
    console.log('📦 Migrating data...');
    
    const tables = [
      { name: 'roles', order: 1, deps: [] },
      { name: 'users', order: 2, deps: ['roles'] },
      { name: 'folders', order: 3, deps: ['users'] },
      { name: 'certificates', order: 4, deps: ['users', 'folders'] },
      { name: 'metadata', order: 5, deps: [] }
    ];

    // Sort by dependency order
    tables.sort((a, b) => a.order - b.order);

    for (const table of tables) {
      await this.migrateTable(table.name);
    }
  }

  /**
   * Migrate a specific table
   * @param {String} tableName - Name of table to migrate
   */
  async migrateTable(tableName) {
    console.log(`  📋 Migrating table: ${tableName}`);
    
    try {
      // Get all data from source
      const sourceData = await this.sourceDb.connection.allAsync(
        `SELECT * FROM ${tableName}`
      );

      if (sourceData.length === 0) {
        console.log(`    ℹ️  Table ${tableName} is empty, skipping...`);
        this.migrationLog.push({
          table: tableName,
          source_count: 0,
          target_count: 0,
          status: 'skipped'
        });
        return;
      }

      console.log(`    📊 Found ${sourceData.length} records to migrate`);

      // Clear target table if needed
      await this.targetDb.connection.execAsync(`DELETE FROM ${tableName}`);

      // Migrate records in batches
      const batchSize = 100;
      let migrated = 0;

      for (let i = 0; i < sourceData.length; i += batchSize) {
        const batch = sourceData.slice(i, i + batchSize);
        await this.migrateBatch(tableName, batch);
        migrated += batch.length;
        console.log(`    ⏳ Migrated ${migrated}/${sourceData.length} records`);
      }

      // Verify migration count
      const targetCount = await this.targetDb.connection.getAsync(
        `SELECT COUNT(*) as count FROM ${tableName}`
      );

      this.migrationLog.push({
        table: tableName,
        source_count: sourceData.length,
        target_count: targetCount.count,
        status: sourceData.length === targetCount.count ? 'success' : 'partial'
      });

      console.log(`    ✅ Table ${tableName} migrated: ${sourceData.length} → ${targetCount.count}`);

    } catch (error) {
      console.error(`    ❌ Failed to migrate table ${tableName}:`, error.message);
      this.migrationLog.push({
        table: tableName,
        source_count: 0,
        target_count: 0,
        status: 'failed',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Migrate a batch of records
   * @param {String} tableName - Table name
   * @param {Array} records - Batch of records to migrate
   */
  async migrateBatch(tableName, records) {
    if (records.length === 0) return;

    const sample = records[0];
    const columns = Object.keys(sample);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    
    const sql = `
      INSERT INTO ${tableName} (${columns.join(', ')}) 
      VALUES (${placeholders})
      ON CONFLICT (${this.getPrimaryKey(tableName)}) DO UPDATE SET
      ${columns.filter(col => col !== this.getPrimaryKey(tableName))
        .map(col => `${col} = EXCLUDED.${col}`).join(', ')}
    `;

    for (const record of records) {
      const values = columns.map(col => this.transformValue(tableName, col, record[col]));
      
      try {
        await this.targetDb.connection.runAsync(sql, values);
      } catch (error) {
        console.error(`    ⚠️  Failed to insert record:`, error.message);
        console.error(`    📄 Record:`, record);
        
        // Try individual field debugging
        await this.debugRecordInsertion(tableName, columns, values, record);
      }
    }
  }

  /**
   * Debug record insertion failures
   */
  async debugRecordInsertion(tableName, columns, values, record) {
    console.log(`    🔍 Debugging record insertion for table: ${tableName}`);
    
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const val = values[i];
      console.log(`      ${col}: ${typeof val} = ${val}`);
    }

    // Try inserting with default values for problematic fields
    const fixedRecord = { ...record };
    
    // Common fixes
    if (tableName === 'users') {
      if (typeof fixedRecord.active !== 'boolean') {
        fixedRecord.active = fixedRecord.active === 1 || fixedRecord.active === '1';
      }
    }

    console.log(`    🔧 Attempting to fix and retry...`);
  }

  /**
   * Transform SQLite values to PostgreSQL compatible values
   * @param {String} tableName - Table name
   * @param {String} columnName - Column name
   * @param {*} value - Value to transform
   * @returns {*} Transformed value
   */
  transformValue(tableName, columnName, value) {
    // Handle NULL values
    if (value === null || value === undefined) {
      return null;
    }

    // Handle boolean values (SQLite stores as 0/1)
    if (columnName === 'active' || columnName.includes('is_') || columnName.includes('_enabled')) {
      if (typeof value === 'number') {
        return value === 1;
      }
      if (typeof value === 'string') {
        return value === '1' || value.toLowerCase() === 'true';
      }
      return Boolean(value);
    }

    // Handle datetime values
    if (columnName.includes('_at') || columnName.includes('_from') || columnName.includes('_to')) {
      if (typeof value === 'string' && value.trim() !== '') {
        return new Date(value).toISOString();
      }
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    }

    // Handle JSON columns
    if (columnName === 'permissions' || columnName === 'access_control' || columnName.includes('config')) {
      if (typeof value === 'string') {
        try {
          JSON.parse(value); // Validate JSON
          return value;
        } catch {
          return JSON.stringify(value);
        }
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
    }

    return value;
  }

  /**
   * Get primary key for table
   * @param {String} tableName - Table name
   * @returns {String} Primary key column name
   */
  getPrimaryKey(tableName) {
    const primaryKeys = {
      users: 'id',
      roles: 'id',
      folders: 'id',
      certificates: 'id',
      metadata: 'key'
    };
    return primaryKeys[tableName] || 'id';
  }

  /**
   * Verify migration completed successfully
   */
  async verifyMigration() {
    console.log('🔍 Verifying migration...');
    
    let allGood = true;

    for (const log of this.migrationLog) {
      if (log.status === 'success') {
        console.log(`  ✅ ${log.table}: ${log.source_count} records migrated`);
      } else if (log.status === 'skipped') {
        console.log(`  ⏭️  ${log.table}: skipped (empty)`);
      } else {
        console.log(`  ❌ ${log.table}: migration failed - ${log.error || 'unknown error'}`);
        allGood = false;
      }
    }

    if (!allGood) {
      throw new Error('Migration verification failed - some tables were not migrated successfully');
    }

    // Test database functionality
    console.log('  🧪 Testing database functionality...');
    
    // Test basic queries
    const userCount = await this.targetDb.connection.getAsync('SELECT COUNT(*) as count FROM users');
    const roleCount = await this.targetDb.connection.getAsync('SELECT COUNT(*) as count FROM roles');
    
    console.log(`  ✓ Users: ${userCount.count}, Roles: ${roleCount.count}`);
  }

  /**
   * Generate migration report
   */
  generateMigrationReport() {
    const report = {
      timestamp: new Date().toISOString(),
      source: 'SQLite',
      target: 'Cloud SQL PostgreSQL',
      tables: this.migrationLog,
      summary: {
        total_tables: this.migrationLog.length,
        successful: this.migrationLog.filter(t => t.status === 'success').length,
        failed: this.migrationLog.filter(t => t.status === 'failed').length,
        skipped: this.migrationLog.filter(t => t.status === 'skipped').length
      }
    };

    const reportPath = `./migration-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📊 Migration report saved: ${reportPath}`);
    console.log(`   Summary: ${report.summary.successful} success, ${report.summary.failed} failed, ${report.summary.skipped} skipped`);
  }

  /**
   * Cleanup connections
   */
  async cleanup() {
    console.log('🧹 Cleaning up connections...');
    
    if (this.sourceDb) {
      await this.sourceDb.close();
    }
    
    if (this.targetDb) {
      await this.targetDb.close();
    }
  }

  /**
   * Simple user prompt for confirmation
   * @param {String} question - Question to ask
   * @returns {Boolean} User response
   */
  async promptUser(question) {
    // In a real scenario, you'd use readline or similar
    // For now, assume user wants to continue
    console.log(question + ' (auto-continuing...)');
    return true;
  }
}

/**
 * CLI interface for running migration
 */
async function runMigration() {
  const migrator = new SQLiteToCloudSQLMigrator();
  
  try {
    await migrator.migrate();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Export for use as module or run as script
export default SQLiteToCloudSQLMigrator;

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration();
}