-- Migration: Add user external skills preferences and execution tracking
-- Description: Allows users to enable/disable external skills and tracks their usage

-- Table: user_external_skills
-- Stores which external skills each user has enabled
CREATE TABLE IF NOT EXISTS user_external_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  canonical_id VARCHAR(255) NOT NULL REFERENCES external_skills(canonical_id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  custom_config JSONB DEFAULT '{}',
  enabled_at TIMESTAMP DEFAULT NOW(),
  disabled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Ensure one record per user per skill
  UNIQUE(user_id, canonical_id)
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_user_external_skills_user_id 
  ON user_external_skills(user_id);

-- Index for fast lookups by skill
CREATE INDEX IF NOT EXISTS idx_user_external_skills_canonical_id 
  ON user_external_skills(canonical_id);

-- Index for enabled skills
CREATE INDEX IF NOT EXISTS idx_user_external_skills_enabled 
  ON user_external_skills(user_id, enabled) WHERE enabled = true;

-- Table: external_skill_executions
-- Tracks execution history for analytics and debugging
CREATE TABLE IF NOT EXISTS external_skill_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_id VARCHAR(255) NOT NULL REFERENCES external_skills(canonical_id),
  user_id UUID,
  session_id VARCHAR(255),
  workspace_id VARCHAR(255),
  
  -- Input/output
  input JSONB NOT NULL,
  parameters JSONB DEFAULT '{}',
  output JSONB,
  
  -- Execution details
  status VARCHAR(50) NOT NULL, -- 'success', 'error', 'timeout', 'cancelled'
  error_message TEXT,
  execution_time_ms INTEGER,
  invocation_pattern VARCHAR(50),
  
  -- Tools used
  tools_used TEXT[],
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for user history
CREATE INDEX IF NOT EXISTS idx_external_skill_executions_user_id 
  ON external_skill_executions(user_id, created_at DESC);

-- Index for skill analytics
CREATE INDEX IF NOT EXISTS idx_external_skill_executions_canonical_id 
  ON external_skill_executions(canonical_id, created_at DESC);

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_external_skill_executions_status 
  ON external_skill_executions(status, created_at DESC);

-- Index for session tracking
CREATE INDEX IF NOT EXISTS idx_external_skill_executions_session_id 
  ON external_skill_executions(session_id) WHERE session_id IS NOT NULL;

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update updated_at on user_external_skills
CREATE TRIGGER update_user_external_skills_updated_at
  BEFORE UPDATE ON user_external_skills
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function: Track enable/disable timestamps
CREATE OR REPLACE FUNCTION track_skill_toggle_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.enabled = true AND OLD.enabled = false THEN
    NEW.enabled_at = NOW();
    NEW.disabled_at = NULL;
  ELSIF NEW.enabled = false AND OLD.enabled = true THEN
    NEW.disabled_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Track when skills are enabled/disabled
CREATE TRIGGER track_user_external_skill_toggle
  BEFORE UPDATE ON user_external_skills
  FOR EACH ROW
  WHEN (OLD.enabled IS DISTINCT FROM NEW.enabled)
  EXECUTE FUNCTION track_skill_toggle_timestamp();

-- View: Skill usage statistics
CREATE OR REPLACE VIEW external_skill_usage_stats AS
SELECT
  ese.canonical_id,
  es.name,
  es.category,
  COUNT(*) as total_executions,
  COUNT(DISTINCT ese.user_id) as unique_users,
  COUNT(*) FILTER (WHERE ese.status = 'success') as successful_executions,
  COUNT(*) FILTER (WHERE ese.status = 'error') as failed_executions,
  AVG(ese.execution_time_ms) FILTER (WHERE ese.status = 'success') as avg_execution_time_ms,
  MAX(ese.created_at) as last_executed_at
FROM external_skill_executions ese
JOIN external_skills es ON ese.canonical_id = es.canonical_id
GROUP BY ese.canonical_id, es.name, es.category;

-- View: User skill preferences with metadata
CREATE OR REPLACE VIEW user_skills_with_details AS
SELECT
  ues.id,
  ues.user_id,
  ues.canonical_id,
  ues.enabled,
  ues.custom_config,
  ues.enabled_at,
  ues.disabled_at,
  es.name,
  es.description,
  es.version,
  es.category,
  es.invocation_pattern,
  es.capability_level,
  es.execution_scope,
  es.is_protected
FROM user_external_skills ues
JOIN external_skills es ON ues.canonical_id = es.canonical_id;

-- Sample queries for analytics

-- Most popular external skills
-- SELECT * FROM external_skill_usage_stats ORDER BY total_executions DESC LIMIT 10;

-- User's execution history
-- SELECT * FROM external_skill_executions WHERE user_id = '[user-id]' ORDER BY created_at DESC LIMIT 20;

-- Skills with highest success rate
-- SELECT 
--   canonical_id,
--   name,
--   successful_executions,
--   failed_executions,
--   ROUND(100.0 * successful_executions / NULLIF(total_executions, 0), 2) as success_rate_pct
-- FROM external_skill_usage_stats
-- WHERE total_executions >= 10
-- ORDER BY success_rate_pct DESC;

-- Average execution time by skill
-- SELECT 
--   canonical_id,
--   name,
--   ROUND(avg_execution_time_ms::numeric, 2) as avg_ms
-- FROM external_skill_usage_stats
-- ORDER BY avg_execution_time_ms DESC;

COMMENT ON TABLE user_external_skills IS 'Stores user preferences for external skills';
COMMENT ON TABLE external_skill_executions IS 'Tracks execution history for external skills';
COMMENT ON VIEW external_skill_usage_stats IS 'Aggregated usage statistics for external skills';
COMMENT ON VIEW user_skills_with_details IS 'User skill preferences with full skill metadata';
