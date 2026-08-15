-- Migration 001: Create deployment tables
-- Description: Creates core deployment tracking tables with audit capabilities
-- Created: 2024-08-15
-- Status: PRODUCTION

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop tables if they exist (for development; use proper migration strategy in production)
DROP TABLE IF EXISTS deployment_audit_log CASCADE;
DROP TABLE IF EXISTS deployments CASCADE;

-- ============================================================================
-- 1. DEPLOYMENTS TABLE
-- ============================================================================
-- Stores all deployment records with comprehensive tracking
CREATE TABLE deployments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL CHECK (type IN ('frontend', 'backend', 'database', 'infrastructure', 'hotfix')),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'rolled_back')),
    branch VARCHAR(255) NOT NULL,
    commit VARCHAR(40) NOT NULL,
    version VARCHAR(50) NOT NULL,

    -- Deployment metadata
    environment VARCHAR(50) NOT NULL CHECK (environment IN ('development', 'staging', 'production')),
    deployed_by VARCHAR(255) NOT NULL,
    deployment_strategy VARCHAR(50) NOT NULL CHECK (deployment_strategy IN ('blue_green', 'canary', 'rolling', 'direct')),

    -- Timing information
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,

    -- Rollback tracking
    rollback_at TIMESTAMP WITH TIME ZONE,
    rolled_back_by VARCHAR(255),
    rollback_reason TEXT,
    is_rolled_back BOOLEAN DEFAULT FALSE,

    -- Deletion prevention
    deletion_prevented BOOLEAN NOT NULL DEFAULT TRUE,
    deletion_locked_at TIMESTAMP WITH TIME ZONE,
    deletion_locked_by VARCHAR(255),

    -- Additional metadata
    notes TEXT,
    error_message TEXT,
    health_status VARCHAR(50) CHECK (health_status IN ('healthy', 'warning', 'critical', NULL)),

    -- System fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- 2. INDEXES FOR DEPLOYMENTS TABLE
-- ============================================================================
CREATE INDEX idx_deployments_status ON deployments(status);
CREATE INDEX idx_deployments_environment ON deployments(environment);
CREATE INDEX idx_deployments_deployed_by ON deployments(deployed_by);
CREATE INDEX idx_deployments_created_at ON deployments(created_at DESC);
CREATE INDEX idx_deployments_type_status ON deployments(type, status);
CREATE INDEX idx_deployments_branch ON deployments(branch);
CREATE INDEX idx_deployments_is_rolled_back ON deployments(is_rolled_back);
CREATE INDEX idx_deployments_deletion_prevented ON deployments(deletion_prevented);

-- ============================================================================
-- 3. AUDIT LOG TABLE FOR DEPLOYMENTS
-- ============================================================================
CREATE TABLE deployment_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    changed_by VARCHAR(255) NOT NULL,
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    change_reason TEXT
);

CREATE INDEX idx_deployment_audit_log_deployment_id ON deployment_audit_log(deployment_id);
CREATE INDEX idx_deployment_audit_log_changed_at ON deployment_audit_log(changed_at DESC);
CREATE INDEX idx_deployment_audit_log_action ON deployment_audit_log(action);

-- ============================================================================
-- 4. AUDIT TRIGGER FOR DEPLOYMENTS
-- ============================================================================
CREATE OR REPLACE FUNCTION log_deployment_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO deployment_audit_log (
        deployment_id,
        action,
        old_values,
        new_values,
        changed_by,
        changed_at,
        change_reason
    ) VALUES (
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END,
        CURRENT_USER,
        CURRENT_TIMESTAMP,
        current_setting('app.change_reason', true)
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deployments_audit
AFTER INSERT OR UPDATE OR DELETE ON deployments
FOR EACH ROW
EXECUTE FUNCTION log_deployment_change();

-- ============================================================================
-- 5. AUTO-UPDATE TIMESTAMP TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION update_deployment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;

    -- Auto-calculate duration if deployment is completed
    IF NEW.status = 'completed' AND NEW.completed_at IS NOT NULL THEN
        NEW.duration_seconds = EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at))::INTEGER;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deployments_update_timestamp
BEFORE UPDATE ON deployments
FOR EACH ROW
EXECUTE FUNCTION update_deployment_timestamp();

-- ============================================================================
-- 6. CONSTRAINT TRIGGER FOR DELETION PREVENTION
-- ============================================================================
CREATE OR REPLACE FUNCTION prevent_deployment_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.deletion_prevented = TRUE AND TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Cannot delete deployment with deletion_prevented = TRUE';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deployments_prevent_deletion
BEFORE DELETE ON deployments
FOR EACH ROW
EXECUTE FUNCTION prevent_deployment_deletion();

-- ============================================================================
-- 7. SAMPLE QUERIES FOR DEPLOYMENT TABLE
-- ============================================================================
/*

-- Get all recent deployments by environment
SELECT id, type, status, environment, deployed_by, started_at, completed_at
FROM deployments
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY started_at DESC;

-- Get failed deployments
SELECT id, type, branch, deployed_by, error_message, started_at
FROM deployments
WHERE status = 'failed'
ORDER BY started_at DESC
LIMIT 10;

-- Get rollback history
SELECT id, type, rolled_back_by, rollback_at, rollback_reason, is_rolled_back
FROM deployments
WHERE is_rolled_back = TRUE
ORDER BY rollback_at DESC;

-- Get deployment count by status for current environment
SELECT status, COUNT(*) as count
FROM deployments
WHERE environment = 'production'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY status;

-- Get average deployment duration by type
SELECT type,
       AVG(duration_seconds) as avg_duration,
       MIN(duration_seconds) as min_duration,
       MAX(duration_seconds) as max_duration
FROM deployments
WHERE status = 'completed'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY type;

-- Get audit trail for specific deployment
SELECT action, old_values, new_values, changed_by, changed_at
FROM deployment_audit_log
WHERE deployment_id = '<deployment_id>'
ORDER BY changed_at ASC;

-- Identify deployments with deletion locks
SELECT id, type, deployment_locked_by, deletion_locked_at
FROM deployments
WHERE deletion_prevented = TRUE
  AND deletion_locked_at IS NOT NULL;

*/
