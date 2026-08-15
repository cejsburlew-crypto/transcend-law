-- Comprehensive Audit Logging Schema
-- Production-ready PostgreSQL schema for immutable audit logging
-- Supports 7-year legal retention requirements
-- Last Updated: 2026-08-15

-- ============================================
-- IMMUTABLE AUDIT LOGS TABLE
-- ============================================
-- Primary table for all action logging
-- Enforces append-only, immutable record creation

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL CHECK (action IN ('create', 'read', 'update', 'delete', 'export', 'access', 'admin', 'auth', 'permission')),
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  entity_name VARCHAR(500),
  changes JSONB,  -- {before: {...}, after: {...}, fields_modified: [...]}
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  ip_address INET NOT NULL,
  user_agent TEXT,
  location JSONB,  -- {country, city, latitude, longitude}
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failure', 'pending')),
  error_message TEXT,
  session_id UUID,
  request_id UUID,
  metadata JSONB,  -- Additional context
  data_classification VARCHAR(50) DEFAULT 'internal' CHECK (data_classification IN ('public', 'internal', 'confidential', 'restricted')),
  sensitive_data_accessed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,

  -- Immutability enforcement
  CONSTRAINT audit_logs_immutable CHECK (created_at = CURRENT_TIMESTAMP)
);

-- Performance indexes for search and filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_audit_logs_data_classification ON audit_logs(data_classification);
CREATE INDEX IF NOT EXISTS idx_audit_logs_sensitive_data ON audit_logs(sensitive_data_accessed);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON audit_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_composite ON audit_logs(user_id, action, timestamp DESC);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_search ON audit_logs(
  data_classification, timestamp DESC, status
);

-- ============================================
-- AUDIT LOGS ARCHIVE TABLE
-- ============================================
-- Long-term storage for archived audit logs
-- Complies with 7-year legal retention requirements

CREATE TABLE IF NOT EXISTS audit_logs_archive (
  id UUID PRIMARY KEY,
  user_id UUID,  -- May be anonymized
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  changes JSONB,
  timestamp TIMESTAMP NOT NULL,
  ip_address INET,  -- May be anonymized
  location JSONB,
  status VARCHAR(20) NOT NULL,
  data_classification VARCHAR(50) NOT NULL,
  sensitive_data_accessed BOOLEAN,
  created_at TIMESTAMP NOT NULL,
  archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_anonymized BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_user_id ON audit_logs_archive(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_timestamp ON audit_logs_archive(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_archived_at ON audit_logs_archive(archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_classification ON audit_logs_archive(data_classification);

-- ============================================
-- AUDIT RETENTION POLICIES TABLE
-- ============================================
-- Defines retention periods per data classification
-- Complies with legal and regulatory requirements

CREATE TABLE IF NOT EXISTS audit_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_classification VARCHAR(50) NOT NULL UNIQUE,
  retention_days INT NOT NULL CHECK (retention_days > 0),
  -- public: 365 days (1 year)
  -- internal: 1095 days (3 years)
  -- confidential: 2555 days (7 years)
  -- restricted: 2555 days (7 years)
  delete_policy VARCHAR(50) NOT NULL CHECK (delete_policy IN ('archive', 'permanent_delete', 'anonymize')),
  -- archive: Move to audit_logs_archive
  -- permanent_delete: Irreversibly delete after retention period
  -- anonymize: Remove personally identifiable information
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  next_review_date TIMESTAMP,
  created_by UUID NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT valid_retention_days CHECK (
    (data_classification = 'public' AND retention_days = 365) OR
    (data_classification = 'internal' AND retention_days = 1095) OR
    (data_classification = 'confidential' AND retention_days = 2555) OR
    (data_classification = 'restricted' AND retention_days = 2555)
  )
);

CREATE INDEX IF NOT EXISTS idx_retention_policies_classification ON audit_retention_policies(data_classification);
CREATE INDEX IF NOT EXISTS idx_retention_policies_next_review ON audit_retention_policies(next_review_date);

-- Insert default retention policies
INSERT INTO audit_retention_policies (data_classification, retention_days, delete_policy, next_review_date, created_by)
VALUES
  ('public', 365, 'permanent_delete', CURRENT_TIMESTAMP + INTERVAL '1 year', '00000000-0000-0000-0000-000000000000'),
  ('internal', 1095, 'archive', CURRENT_TIMESTAMP + INTERVAL '1 year', '00000000-0000-0000-0000-000000000000'),
  ('confidential', 2555, 'archive', CURRENT_TIMESTAMP + INTERVAL '1 year', '00000000-0000-0000-0000-000000000000'),
  ('restricted', 2555, 'archive', CURRENT_TIMESTAMP + INTERVAL '1 year', '00000000-0000-0000-0000-000000000000')
ON CONFLICT DO NOTHING;

-- ============================================
-- AUDIT REPORTS TABLE
-- ============================================
-- Stores generated audit reports for compliance
-- Supports signing and verification

CREATE TABLE IF NOT EXISTS audit_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('admin', 'compliance', 'security', 'activity')),
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  total_entries INT DEFAULT 0,
  summary JSONB,  -- Contains actionBreakdown, userBreakdown, topUsers, topLocations
  anomalies JSONB,  -- Array of detected anomalies
  generated_by UUID NOT NULL,
  file_path TEXT,
  is_signed BOOLEAN DEFAULT FALSE,
  signature TEXT,  -- Digital signature for integrity
  hash_value TEXT UNIQUE,  -- SHA-256 hash for verification
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_reports_type ON audit_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_audit_reports_generated_at ON audit_reports(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_reports_hash ON audit_reports(hash_value);
CREATE INDEX IF NOT EXISTS idx_audit_reports_date_range ON audit_reports(start_date, end_date);

-- ============================================
-- AUDIT EXCEPTIONS TABLE
-- ============================================
-- Tracks approved exceptions for audit log suppression
-- Used for debugging or sensitive system operations

CREATE TABLE IF NOT EXISTS audit_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(100) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  approved_by UUID NOT NULL,
  approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT valid_expiration CHECK (expires_at > approved_at)
);

CREATE INDEX IF NOT EXISTS idx_audit_exceptions_entity_type ON audit_exceptions(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_exceptions_is_active ON audit_exceptions(is_active);
CREATE INDEX IF NOT EXISTS idx_audit_exceptions_expires_at ON audit_exceptions(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_exceptions_active_and_unexpired ON audit_exceptions(is_active, expires_at)
  WHERE is_active = TRUE AND expires_at > CURRENT_TIMESTAMP;

-- ============================================
-- AUDIT LOG HASHES TABLE
-- ============================================
-- Maintains integrity chain for tamper detection
-- Hash of current log + previous log hash

CREATE TABLE IF NOT EXISTS audit_log_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_log_id UUID NOT NULL UNIQUE REFERENCES audit_logs(id) ON DELETE CASCADE,
  previous_hash TEXT,  -- Hash of previous log
  current_hash TEXT NOT NULL,  -- Hash of this log + previous_hash
  computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_hashes_audit_log_id ON audit_log_hashes(audit_log_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_hashes_current_hash ON audit_log_hashes(current_hash);

-- ============================================
-- AUDIT STATISTICS VIEW
-- ============================================
-- Real-time statistics for audit monitoring

CREATE OR REPLACE VIEW audit_stats_v1 AS
SELECT
  COUNT(*) as total_logs,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT DATE(timestamp)) as days_with_activity,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_actions,
  SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failed_actions,
  SUM(CASE WHEN sensitive_data_accessed THEN 1 ELSE 0 END) as sensitive_accesses,
  MIN(timestamp) as oldest_log,
  MAX(timestamp) as latest_log,
  ROUND(100.0 * SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) / COUNT(*), 2) as failure_rate
FROM audit_logs;

-- ============================================
-- AUDIT LOG FUNCTIONS
-- ============================================

-- Function to check retention policy compliance
CREATE OR REPLACE FUNCTION check_retention_policy_compliance()
RETURNS TABLE(
  classification VARCHAR,
  logs_older_than_policy INT,
  action_required VARCHAR
) AS $$
SELECT
  data_classification,
  COUNT(*) as logs_count,
  CASE
    WHEN COUNT(*) > 0 THEN 'Archive or delete per policy'
    ELSE 'Compliant'
  END as action
FROM audit_logs al
JOIN audit_retention_policies arp ON al.data_classification = arp.data_classification
WHERE al.timestamp < CURRENT_TIMESTAMP - (arp.retention_days || ' days')::INTERVAL
GROUP BY al.data_classification;
$$ LANGUAGE SQL;

-- Function to anonymize sensitive audit logs
CREATE OR REPLACE FUNCTION anonymize_audit_log(p_log_id UUID)
RETURNS VOID AS $$
UPDATE audit_logs
SET
  user_id = 'ANONYMIZED'::UUID,
  ip_address = '0.0.0.0'::INET,
  location = NULL,
  metadata = jsonb_set(metadata, '{anonymized_at}', to_jsonb(CURRENT_TIMESTAMP))
WHERE id = p_log_id;
$$ LANGUAGE SQL;

-- Function to generate audit trail for entity
CREATE OR REPLACE FUNCTION get_entity_audit_trail(
  p_entity_type VARCHAR,
  p_entity_id VARCHAR,
  p_limit INT DEFAULT 100
)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  action VARCHAR,
  timestamp TIMESTAMP,
  status VARCHAR,
  changes JSONB
) AS $$
SELECT
  audit_logs.id,
  audit_logs.user_id,
  audit_logs.action,
  audit_logs.timestamp,
  audit_logs.status,
  audit_logs.changes
FROM audit_logs
WHERE
  entity_type = p_entity_type AND
  entity_id = p_entity_id
ORDER BY timestamp DESC
LIMIT p_limit;
$$ LANGUAGE SQL;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Partial index for active failed authentications
CREATE INDEX IF NOT EXISTS idx_audit_logs_active_failures ON audit_logs(user_id, timestamp DESC)
WHERE status = 'failure' AND action = 'auth';

-- Partial index for sensitive data access
CREATE INDEX IF NOT EXISTS idx_audit_logs_sensitive_access ON audit_logs(user_id, timestamp DESC)
WHERE sensitive_data_accessed = TRUE;

-- Partial index for restricted classification
CREATE INDEX IF NOT EXISTS idx_audit_logs_restricted ON audit_logs(user_id, action, timestamp DESC)
WHERE data_classification = 'restricted';

-- GIN index for metadata search
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata ON audit_logs USING GIN(metadata);

-- ============================================
-- PARTITIONING (Optional for large datasets)
-- ============================================
-- Partition audit_logs by month for better performance

-- Create table with partitions (uncomment for large-scale deployments)
/*
CREATE TABLE audit_logs_partitioned (
  LIKE audit_logs
) PARTITION BY RANGE (EXTRACT(YEAR FROM timestamp), EXTRACT(MONTH FROM timestamp));

-- Create partitions (example)
CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs_partitioned
  FOR VALUES FROM (2026, 1) TO (2026, 2);

CREATE TABLE audit_logs_2026_02 PARTITION OF audit_logs_partitioned
  FOR VALUES FROM (2026, 2) TO (2026, 3);
*/

-- ============================================
-- GRANTS & PERMISSIONS
-- ============================================
-- Configure as needed for your security model

-- Example: Audit logs should be read-only for most users
-- GRANT SELECT ON audit_logs TO audit_reader_role;
-- GRANT ALL ON audit_logs TO audit_admin_role;
-- REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;
