-- Migration: Add AI Provider Support
-- Date: 2024-12-28
-- Description: Add tables to support multiple AI providers and user API key management

-- User AI settings table
CREATE TABLE IF NOT EXISTS user_ai_settings (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    primary_provider TEXT,  -- 'openai', 'claude', 'gemini', 'grok', 'deepseek'
    fallback_provider TEXT,
    use_personal_keys BOOLEAN DEFAULT 0,
    provider_configs TEXT DEFAULT '{}',  -- JSON config for each provider
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- User API keys table (encrypted)
CREATE TABLE IF NOT EXISTS user_ai_providers (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,  -- 'openai', 'claude', 'gemini', 'grok', 'deepseek'
    api_key_encrypted TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    last_used DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, provider)
);

-- AI usage tracking table
CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    model TEXT,
    request_type TEXT,  -- 'chat', 'certificate_analysis', 'parsing', 'insights'
    tokens_used INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    success BOOLEAN DEFAULT 1,
    error_message TEXT,
    sensitive_data_detected BOOLEAN DEFAULT 0,
    used_personal_key BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AI provider status table (system-wide)
CREATE TABLE IF NOT EXISTS ai_provider_status (
    provider TEXT PRIMARY KEY,
    is_available BOOLEAN DEFAULT 1,
    last_health_check DATETIME,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default provider status
INSERT OR IGNORE INTO ai_provider_status (provider, is_available) VALUES
('openai', 1),
('claude', 1),
('gemini', 1),
('grok', 1),
('deepseek', 1);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_ai_settings_user_id ON user_ai_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ai_providers_user_id ON user_ai_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ai_providers_provider ON user_ai_providers(provider);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_provider ON ai_usage_logs(provider);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON ai_usage_logs(created_at);

-- Create triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_user_ai_settings_timestamp 
    AFTER UPDATE ON user_ai_settings
    FOR EACH ROW 
BEGIN
    UPDATE user_ai_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_user_ai_providers_timestamp 
    AFTER UPDATE ON user_ai_providers
    FOR EACH ROW 
BEGIN
    UPDATE user_ai_providers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_ai_provider_status_timestamp 
    AFTER UPDATE ON ai_provider_status
    FOR EACH ROW 
BEGIN
    UPDATE ai_provider_status SET updated_at = CURRENT_TIMESTAMP WHERE provider = NEW.provider;
END;