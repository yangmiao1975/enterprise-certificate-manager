-- Migration: Add updated_at and renewal_count columns to certificates table (SQLite & Postgres)

-- SQLite: Use DATETIME and INTEGER types
-- These statements will error if the column exists, so wrap in a transaction and ignore errors
BEGIN TRANSACTION;
  -- Add updated_at column if it does not exist
  ALTER TABLE certificates ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;
  -- Add renewal_count column if it does not exist
  ALTER TABLE certificates ADD COLUMN renewal_count INTEGER DEFAULT 0;
COMMIT;

-- Postgres: Use TIMESTAMP and INTEGER types
-- These statements use IF NOT EXISTS (Postgres 9.6+)
-- Uncomment and run in Postgres if needed:
-- ALTER TABLE certificates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
-- ALTER TABLE certificates ADD COLUMN IF NOT EXISTS renewal_count INTEGER DEFAULT 0;
