-- Migration 002: Create activity logs tables
-- Description: Tracks all user activities, device information, and access patterns
-- Created: 2024-08-15
-- Status: PRODUCTION

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For full-text search

-- Drop tables if they exist (for development)
DROP TABLE IF EXISTS activity_log_audit CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;

-- ============================================================================
-- 1. ACTIVITY LOGS TABLE
-- ============================================================================
-- Core table for logging user activities with comprehensive tracking
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL,

    -- Activity information
    activity_type VARCHAR(100) NOT NULL CHECK (activity_type IN (
        'login', 'logout', 'create', 'read', 'update', 'delete',
        'download', 'upload', 'export', 'import', 'verify', 'approve',
        'deny', 'access_denied', 'permission_denied', 'error', 'deployment',
        'configuration_change', 'security_event'
    )),
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    resource_name VARCHAR(500),

    -- Location and device information
    location VARCHAR(500),
    ip_address INET,
    user_agent TEXT,
    device_info JSONB,  -- Stores browser, OS, device type, screen resolution, etc.
    session_id VARCHAR(255),

    -- Geolocation (derived from IP)
    country_code VARCHAR(2),
    country_name VARCHAR(100),
    city VARCHAR(100),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),

    -- Result information
    status VARCHAR(50) NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failure', 'pending', 'error')),
    error_message TEXT,
    status_code INTEGER,

    -- Audit trail
    changes_made JSONB,  -- What was changed in the action
    related_records JSONB,  -- Any related records affected
    data_sensitivity VARCHAR(50) CHECK (data_sensitivity IN ('public', 'internal', 'confidential', 'restricted', NULL)),

    -- Compliance tracking
    compliance_flags JSONB,  -- For regulatory compliance checks
    requires_audit BOOLEAN DEFAULT FALSE,
    audit_completed_at TIMESTAMP WITH TIME ZONE,
    audit_notes TEXT,

    -- System fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- 2. INDEXES FOR ACTIVITY LOGS
-- ============================================================================
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_timestamp ON activity_logs(timestamp DESC);
CREATE INDEX idx_activity_logs_activity_type ON activity_logs(activity_type);
CREATE INDEX idx_activity_logs_ip_address ON activity_logs(ip_address);
CREATE INDEX idx_activity_logs_resource_type_id ON activity_logs(resource_type, resource_id);
CREATE INDEX idx_activity_logs_status ON activity_logs(status);
CREATE INDEX idx_activity_logs_session_id ON activity_logs(session_id);
CREATE INDEX idx_activity_logs_user_timestamp ON activity_logs(user_id, timestamp DESC);
CREATE INDEX idx_activity_logs_location ON activity_logs(country_code, city);

-- GiST index for IP CIDR operations
CREATE INDEX idx_activity_logs_ip_gist ON activity_logs USING GIST (ip_address inet_ops);

-- Text search index on action and resource_name
CREATE INDEX idx_activity_logs_action_trgm ON activity_logs USING gin (action gin_trgm_ops);
CREATE INDEX idx_activity_logs_resource_name_trgm ON activity_logs USING gin (resource_name gin_trgm_ops);

-- Composite indexes for common queries
CREATE INDEX idx_activity_logs_user_activity_timestamp ON activity_logs(user_id, activity_type, timestamp DESC);
CREATE INDEX idx_activity_logs_requires_audit ON activity_logs(requires_audit) WHERE requires_audit = TRUE;

-- ============================================================================
-- 3. ACTIVITY LOG AUDIT TABLE
-- ============================================================================
CREATE TABLE activity_log_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_log_id UUID NOT NULL REFERENCES activity_logs(id) ON DELETE CASCADE,
    audit_action VARCHAR(100) NOT NULL,
    audit_reason VARCHAR(500),
    audit_by VARCHAR(255),
    audit_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    audit_changes JSONB
);

CREATE INDEX idx_activity_log_audit_log_id ON activity_log_audit(activity_log_id);
CREATE INDEX idx_activity_log_audit_timestamp ON activity_log_audit(audit_timestamp DESC);

-- ============================================================================
-- 4. TRIGGER FOR AUTO-UPDATE TIMESTAMP
-- ============================================================================
CREATE OR REPLACE FUNCTION update_activity_log_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    IF NEW.timestamp IS NULL THEN
        NEW.timestamp = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_activity_logs_update_timestamp
BEFORE UPDATE ON activity_logs
FOR EACH ROW
EXECUTE FUNCTION update_activity_log_timestamp();

-- ============================================================================
-- 5. TRIGGER FOR AUDIT LOGGING
-- ============================================================================
CREATE OR REPLACE FUNCTION audit_activity_log_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO activity_log_audit (
        activity_log_id,
        audit_action,
        audit_by,
        audit_timestamp,
        audit_changes
    ) VALUES (
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CURRENT_USER,
        CURRENT_TIMESTAMP,
        CASE WHEN TG_OP = 'UPDATE' THEN jsonb_object_agg(key, COALESCE(NEW, OLD))
             ELSE NULL
        END
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_activity_log_audit
AFTER INSERT OR UPDATE OR DELETE ON activity_logs
FOR EACH ROW
EXECUTE FUNCTION audit_activity_log_changes();

-- ============================================================================
-- 6. TRIGGER FOR HIGH-SENSITIVITY DATA FLAGGING
-- ============================================================================
CREATE OR REPLACE FUNCTION flag_sensitive_activities()
RETURNS TRIGGER AS $$
BEGIN
    -- Flag activities that require audit
    IF NEW.activity_type IN ('delete', 'export', 'permission_denied', 'access_denied', 'security_event')
       OR (NEW.data_sensitivity IN ('confidential', 'restricted') AND NEW.activity_type = 'download')
    THEN
        NEW.requires_audit = TRUE;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_activity_logs_flag_sensitive
BEFORE INSERT OR UPDATE ON activity_logs
FOR EACH ROW
EXECUTE FUNCTION flag_sensitive_activities();

-- ============================================================================
-- 7. HELPER FUNCTION FOR DEVICE INFO PARSING
-- ============================================================================
CREATE OR REPLACE FUNCTION parse_user_agent(user_agent TEXT)
RETURNS JSONB AS $$
DECLARE
    browser VARCHAR;
    os VARCHAR;
    device_type VARCHAR;
BEGIN
    -- Basic parsing (production code would use a more sophisticated library)
    browser := CASE
        WHEN user_agent LIKE '%Chrome%' THEN 'Chrome'
        WHEN user_agent LIKE '%Firefox%' THEN 'Firefox'
        WHEN user_agent LIKE '%Safari%' THEN 'Safari'
        WHEN user_agent LIKE '%Edge%' THEN 'Edge'
        ELSE 'Unknown'
    END;

    os := CASE
        WHEN user_agent LIKE '%Windows%' THEN 'Windows'
        WHEN user_agent LIKE '%Macintosh%' THEN 'macOS'
        WHEN user_agent LIKE '%iPhone%' THEN 'iOS'
        WHEN user_agent LIKE '%Android%' THEN 'Android'
        WHEN user_agent LIKE '%Linux%' THEN 'Linux'
        ELSE 'Unknown'
    END;

    device_type := CASE
        WHEN user_agent LIKE '%Mobile%' OR user_agent LIKE '%Android%' THEN 'Mobile'
        WHEN user_agent LIKE '%Tablet%' OR user_agent LIKE '%iPad%' THEN 'Tablet'
        ELSE 'Desktop'
    END;

    RETURN jsonb_build_object(
        'browser', browser,
        'os', os,
        'device_type', device_type,
        'raw_user_agent', user_agent
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. HELPER FUNCTION FOR SUSPICIOUS ACTIVITY DETECTION
-- ============================================================================
CREATE OR REPLACE FUNCTION detect_suspicious_activity(
    p_user_id VARCHAR,
    p_activity_type VARCHAR,
    p_ip_address INET
)
RETURNS BOOLEAN AS $$
DECLARE
    v_last_activity TIMESTAMP;
    v_different_ips INTEGER;
    v_failed_attempts INTEGER;
BEGIN
    -- Check for rapid successive activities (within 1 second)
    SELECT MAX(timestamp) INTO v_last_activity
    FROM activity_logs
    WHERE user_id = p_user_id
      AND timestamp > NOW() - INTERVAL '10 seconds';

    IF v_last_activity IS NOT NULL
       AND EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - v_last_activity)) < 1
    THEN
        RETURN TRUE;  -- Suspicious: too rapid
    END IF;

    -- Check for multiple IPs from same user in 5 minutes
    SELECT COUNT(DISTINCT ip_address) INTO v_different_ips
    FROM activity_logs
    WHERE user_id = p_user_id
      AND timestamp > NOW() - INTERVAL '5 minutes';

    IF v_different_ips > 5 THEN
        RETURN TRUE;  -- Suspicious: too many IPs
    END IF;

    -- Check for multiple failed login attempts
    IF p_activity_type = 'login' THEN
        SELECT COUNT(*) INTO v_failed_attempts
        FROM activity_logs
        WHERE user_id = p_user_id
          AND activity_type = 'login'
          AND status = 'failure'
          AND timestamp > NOW() - INTERVAL '1 hour';

        IF v_failed_attempts > 5 THEN
            RETURN TRUE;  -- Suspicious: too many failed logins
        END IF;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. SAMPLE QUERIES FOR ACTIVITY LOGS
-- ============================================================================
/*

-- Get all activities for a specific user in last 24 hours
SELECT id, activity_type, action, resource_name, status, timestamp
FROM activity_logs
WHERE user_id = '<user_id>'
  AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

-- Find all failed login attempts
SELECT user_id, COUNT(*) as failed_count, MAX(timestamp) as last_attempt
FROM activity_logs
WHERE activity_type = 'login'
  AND status = 'failure'
  AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY user_id
HAVING COUNT(*) > 3
ORDER BY failed_count DESC;

-- Get access from unusual locations
SELECT DISTINCT user_id, ip_address, country_name, city, COUNT(*) as access_count
FROM activity_logs
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY user_id, ip_address, country_name, city
ORDER BY access_count DESC;

-- Find activities requiring audit
SELECT id, user_id, activity_type, resource_name, timestamp
FROM activity_logs
WHERE requires_audit = TRUE
  AND audit_completed_at IS NULL
ORDER BY timestamp ASC;

-- Get data sensitivity breakdown
SELECT data_sensitivity, activity_type, COUNT(*) as count
FROM activity_logs
WHERE timestamp > NOW() - INTERVAL '30 days'
GROUP BY data_sensitivity, activity_type
ORDER BY count DESC;

-- Identify suspicious activity patterns
SELECT user_id, ip_address, COUNT(*) as rapid_actions
FROM activity_logs
WHERE timestamp > NOW() - INTERVAL '10 seconds'
GROUP BY user_id, ip_address
HAVING COUNT(*) > 10;

-- Get activity audit trail
SELECT action, audit_reason, audit_by, audit_timestamp
FROM activity_log_audit
WHERE activity_log_id = '<log_id>'
ORDER BY audit_timestamp ASC;

-- Compliance report: all restricted data access
SELECT user_id, resource_type, resource_name, activity_type, timestamp
FROM activity_logs
WHERE data_sensitivity = 'restricted'
  AND activity_type IN ('read', 'download', 'export')
  AND timestamp > NOW() - INTERVAL '30 days'
ORDER BY timestamp DESC;

*/
