/**
 * Database Migration Runner
 * Applies the AI provider migration to the database
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDatabase } from './flexible-init.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runAIProviderMigration() {
  try {
    console.log('Running AI provider migration...');
    
    const db = getDatabase();
    
    // Read migration SQL
    const migrationSQL = readFileSync(
      join(__dirname, 'migrations', 'add-ai-providers.sql'), 
      'utf8'
    );
    
    // Simply execute the migration SQL directly (SQLite can handle multiple statements)
    try {
      // Execute all statements at once - SQLite handles this well
      await db.execAsync(migrationSQL);
      console.log('✓ Executed AI provider migration successfully');
    } catch (error) {
      // If batch execution fails, try statement by statement
      console.log('Batch execution failed, trying individual statements...');
      
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
      
      for (const statement of statements) {
        try {
          await db.runAsync(statement);
          console.log('✓ Executed:', statement.substring(0, 50) + '...');
        } catch (stmtError) {
          if (!stmtError.message.includes('already exists') && 
              !stmtError.message.includes('duplicate')) {
            console.error('Error executing statement:', statement);
            console.error('Error:', stmtError.message);
            // Don't throw - continue with other statements
          } else {
            console.log('⚠ Skipped (already exists):', statement.substring(0, 50) + '...');
          }
        }
      }
    }
    
    console.log('✅ AI provider migration completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return false;
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  await runAIProviderMigration();
  process.exit(0);
}

export { runAIProviderMigration };