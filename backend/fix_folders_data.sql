-- Fix folders table data for PostgreSQL compatibility
-- This script can be run safely in debug phase

-- Option 1: Clean slate approach (recommended for debug)
DROP TABLE IF EXISTS folders CASCADE;
CREATE TABLE folders (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL,
  permissions TEXT NOT NULL,
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  access_control TEXT,
  parent_id VARCHAR(255)
);

-- Insert default folders with proper integer created_by values
INSERT INTO folders (id, name, description, type, permissions, created_by, access_control) VALUES
('all-certificates', 'All Certificates', 'System folder containing all certificates', 'system', '["read"]', 1, NULL),
('temp-uploads', 'Temporary Uploads', 'Temporary storage for uploaded certificates pending review', 'system', '["read", "write", "delete"]', 1, NULL),
('prod-servers', 'Production Servers', 'Certificates for production servers', 'custom', '["read", "write"]', 1, '{"roles": ["admin", "manager"], "users": ["admin-user"]}');

-- Option 2: Alternative - Just fix existing data (if you prefer to keep existing data)
-- UPDATE folders SET created_by = 1 WHERE created_by ~ '^[a-zA-Z]';
-- UPDATE folders SET created_by = 1 WHERE created_by = 'admin-user' OR created_by = 'admin';
-- ALTER TABLE folders ALTER COLUMN created_by TYPE INTEGER USING created_by::INTEGER;