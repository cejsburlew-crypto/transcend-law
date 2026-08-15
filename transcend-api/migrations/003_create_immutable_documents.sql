-- Migration 003: Create immutable documents and deletion prevention tables
-- Description: Enforces document immutability, tracks deletion attempts, and maintains audit trail
-- Created: 2024-08-15
-- Status: PRODUCTION

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop tables if they exist (for development)
DROP TABLE IF EXISTS immutable_document_audit CASCADE;
DROP TABLE IF EXISTS deletion_attempts CASCADE;
DROP TABLE IF EXISTS immutable_documents CASCADE;

-- ============================================================================
-- 1. IMMUTABLE DOCUMENTS TABLE
-- ============================================================================
-- Stores documents that cannot be modified after creation
CREATE TABLE immutable_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id VARCHAR(255) NOT NULL UNIQUE,

    -- Document content and metadata
    title VARCHAR(500) NOT NULL,
    location VARCHAR(1000) NOT NULL,  -- File path or storage location
    content_type VARCHAR(100),
    file_size BIGINT,

    -- Content integrity
    content_hash VARCHAR(128) NOT NULL,  -- SHA-256 hash of document content
    hash_algorithm VARCHAR(50) DEFAULT 'SHA-256',
    content_signature VARCHAR(2048),  -- Digital signature for authenticity verification

    -- Immutability enforcement
    locked BOOLEAN NOT NULL DEFAULT TRUE,  -- Prevents any modifications
    locked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_by VARCHAR(255) NOT NULL,
    lock_reason VARCHAR(500),

    -- Version and history
    version_number INTEGER DEFAULT 1,
    is_latest_version BOOLEAN DEFAULT TRUE,
    superseded_by_id UUID REFERENCES immutable_documents(id),

    -- Access control
    owner_id VARCHAR(255) NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    access_level VARCHAR(50) CHECK (access_level IN ('public', 'internal', 'confidential', 'restricted', 'classified')),

    -- Classification and retention
    document_classification VARCHAR(100),
    retention_period_days INTEGER,
    retention_expires_at TIMESTAMP WITH TIME ZONE,
    must_retain_until TIMESTAMP WITH TIME ZONE,

    -- Compliance tracking
    compliance_category VARCHAR(100),
    regulatory_reference VARCHAR(500),
    compliance_checked BOOLEAN DEFAULT FALSE,
    compliance_checked_at TIMESTAMP WITH TIME ZONE,
    compliance_checked_by VARCHAR(255),

    -- Deletion prevention
    deletion_prevented BOOLEAN NOT NULL DEFAULT TRUE,
    deletion_locked_reason TEXT,
    deletion_lock_expires_at TIMESTAMP WITH TIME ZONE,

    -- Additional metadata
    description TEXT,
    keywords TEXT,
    related_documents JSONB,
    metadata JSONB,
    custom_fields JSONB,

    -- System tracking
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- 2. DELETION ATTEMPTS TABLE
-- ============================================================================
-- Tracks all attempts to delete or modify immutable documents
CREATE TABLE deletion_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_id UUID NOT NULL REFERENCES immutable_documents(id) ON DELETE CASCADE,
    document_id VARCHAR(255) NOT NULL,

    -- Attempt information
    attempt_type VARCHAR(50) NOT NULL CHECK (attempt_type IN ('delete', 'modify', 'archive', 'unlock', 'force_delete')),
    attempted_by VARCHAR(255) NOT NULL,
    attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Request details
    request_method VARCHAR(10),
    request_path VARCHAR(1000),
    request_ip_address INET,
    request_user_agent TEXT,

    -- Outcome
    status VARCHAR(50) NOT NULL CHECK (status IN ('blocked', 'denied', 'approved', 'escalated', 'failed')),
    denial_reason VARCHAR(500),
    error_message TEXT,

    -- Escalation tracking
    escalated_to VARCHAR(255),
    escalation_reason TEXT,
    escalation_timestamp TIMESTAMP WITH TIME ZONE,
    escalation_resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,

    -- Compliance and audit
    requires_investigation BOOLEAN DEFAULT TRUE,
    investigation_started_at TIMESTAMP WITH TIME ZONE,
    investigation_completed_at TIMESTAMP WITH TIME ZONE,
    investigation_findings TEXT,
    investigated_by VARCHAR(255),

    -- Detailed audit trail
    context JSONB,  -- Full request context
    payload JSONB,  -- What was requested to be changed
    audit_trail JSONB,  -- Detailed audit information

    -- System fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. IMMUTABLE DOCUMENT AUDIT LOG
-- ============================================================================
CREATE TABLE immutable_document_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES immutable_documents(id) ON DELETE CASCADE,
    audit_type VARCHAR(100) NOT NULL,
    action VARCHAR(255) NOT NULL,

    -- Modification attempt details
    attempted_changes JSONB,
    blocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    blocked_by VARCHAR(255),
    block_reason VARCHAR(500),

    -- Audit information
    event_details JSONB,
    request_context JSONB,
    system_info JSONB,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. INDEXES FOR IMMUTABLE DOCUMENTS
-- ============================================================================
CREATE INDEX idx_immutable_documents_document_id ON immutable_documents(document_id);
CREATE INDEX idx_immutable_documents_locked ON immutable_documents(locked);
CREATE INDEX idx_immutable_documents_owner_id ON immutable_documents(owner_id);
CREATE INDEX idx_immutable_documents_created_at ON immutable_documents(created_at DESC);
CREATE INDEX idx_immutable_documents_deletion_prevented ON immutable_documents(deletion_prevented);
CREATE INDEX idx_immutable_documents_is_latest_version ON immutable_documents(is_latest_version);
CREATE INDEX idx_immutable_documents_content_hash ON immutable_documents(content_hash);
CREATE INDEX idx_immutable_documents_retention_expires ON immutable_documents(retention_expires_at)
    WHERE retention_expires_at IS NOT NULL;
CREATE INDEX idx_immutable_documents_compliance_category ON immutable_documents(compliance_category);

-- ============================================================================
-- 5. INDEXES FOR DELETION ATTEMPTS
-- ============================================================================
CREATE INDEX idx_deletion_attempts_record_id ON deletion_attempts(record_id);
CREATE INDEX idx_deletion_attempts_attempted_by ON deletion_attempts(attempted_by);
CREATE INDEX idx_deletion_attempts_status ON deletion_attempts(status);
CREATE INDEX idx_deletion_attempts_attempted_at ON deletion_attempts(attempted_at DESC);
CREATE INDEX idx_deletion_attempts_document_id ON deletion_attempts(document_id);
CREATE INDEX idx_deletion_attempts_requires_investigation ON deletion_attempts(requires_investigation)
    WHERE requires_investigation = TRUE;
CREATE INDEX idx_deletion_attempts_attempt_type_status ON deletion_attempts(attempt_type, status);

-- ============================================================================
-- 6. INDEXES FOR IMMUTABLE DOCUMENT AUDIT
-- ============================================================================
CREATE INDEX idx_immutable_document_audit_document_id ON immutable_document_audit(document_id);
CREATE INDEX idx_immutable_document_audit_blocked_at ON immutable_document_audit(blocked_at DESC);
CREATE INDEX idx_immutable_document_audit_audit_type ON immutable_document_audit(audit_type);

-- ============================================================================
-- 7. CONSTRAINT: PREVENT MODIFICATIONS TO LOCKED DOCUMENTS
-- ============================================================================
CREATE OR REPLACE FUNCTION prevent_locked_document_modification()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if document is locked
    IF OLD.locked = TRUE AND TG_OP IN ('UPDATE', 'DELETE') THEN
        -- Record deletion attempt
        INSERT INTO deletion_attempts (
            record_id,
            document_id,
            attempt_type,
            attempted_by,
            status,
            denial_reason
        ) VALUES (
            OLD.id,
            OLD.document_id,
            CASE WHEN TG_OP = 'DELETE' THEN 'delete' ELSE 'modify' END,
            CURRENT_USER,
            'blocked',
            'Document is locked and immutable'
        );

        -- Log to audit
        INSERT INTO immutable_document_audit (
            document_id,
            audit_type,
            action,
            blocked_by,
            block_reason,
            blocked_at
        ) VALUES (
            OLD.id,
            'MODIFICATION_ATTEMPT',
            TG_OP,
            CURRENT_USER,
            'Locked document cannot be modified',
            CURRENT_TIMESTAMP
        );

        RAISE EXCEPTION 'Cannot modify locked document: %', OLD.document_id;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_locked_document_modification
BEFORE UPDATE OR DELETE ON immutable_documents
FOR EACH ROW
EXECUTE FUNCTION prevent_locked_document_modification();

-- ============================================================================
-- 8. CONSTRAINT: PREVENT DELETION OF DELETION-PREVENTED DOCUMENTS
-- ============================================================================
CREATE OR REPLACE FUNCTION prevent_deletion_prevented_document_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.deletion_prevented = TRUE AND TG_OP = 'DELETE' THEN
        INSERT INTO deletion_attempts (
            record_id,
            document_id,
            attempt_type,
            attempted_by,
            status,
            denial_reason
        ) VALUES (
            OLD.id,
            OLD.document_id,
            'force_delete',
            CURRENT_USER,
            'blocked',
            'Document has deletion prevention enabled'
        );

        RAISE EXCEPTION 'Cannot delete document with deletion prevention: %', OLD.document_id;
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_deletion_prevented_document_deletion
BEFORE DELETE ON immutable_documents
FOR EACH ROW
EXECUTE FUNCTION prevent_deletion_prevented_document_deletion();

-- ============================================================================
-- 9. TRIGGER: AUTO-UPDATE TIMESTAMP
-- ============================================================================
CREATE OR REPLACE FUNCTION update_immutable_document_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    -- Prevent modification if locked
    IF OLD.locked = TRUE AND TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Cannot update locked document';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_immutable_documents_update_timestamp
BEFORE UPDATE ON immutable_documents
FOR EACH ROW
EXECUTE FUNCTION update_immutable_document_timestamp();

-- ============================================================================
-- 10. TRIGGER: VALIDATE CONTENT INTEGRITY
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_content_integrity()
RETURNS TRIGGER AS $$
BEGIN
    -- Verify that content_hash matches expected format (SHA-256 is 64 hex chars)
    IF NOT (NEW.content_hash ~ '^[a-f0-9]{64}$' OR NEW.content_hash ~ '^[A-F0-9]{64}$') THEN
        RAISE EXCEPTION 'Invalid SHA-256 hash format for document: %', NEW.document_id;
    END IF;

    -- Ensure hash_algorithm is properly set
    IF NEW.hash_algorithm IS NULL THEN
        NEW.hash_algorithm := 'SHA-256';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_content_integrity
BEFORE INSERT OR UPDATE ON immutable_documents
FOR EACH ROW
EXECUTE FUNCTION validate_content_integrity();

-- ============================================================================
-- 11. TRIGGER: AUTO-UPDATE RETENTION EXPIRY
-- ============================================================================
CREATE OR REPLACE FUNCTION update_retention_expiry()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.retention_period_days IS NOT NULL THEN
        NEW.retention_expires_at := CURRENT_TIMESTAMP + (NEW.retention_period_days || ' days')::INTERVAL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_retention_expiry
BEFORE INSERT ON immutable_documents
FOR EACH ROW
EXECUTE FUNCTION update_retention_expiry();

-- ============================================================================
-- 12. FUNCTION: VERIFY DOCUMENT INTEGRITY
-- ============================================================================
CREATE OR REPLACE FUNCTION verify_document_integrity(
    p_document_id UUID,
    p_expected_hash VARCHAR(128)
)
RETURNS TABLE (
    is_valid BOOLEAN,
    stored_hash VARCHAR(128),
    expected_hash VARCHAR(128),
    verification_timestamp TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (doc.content_hash = p_expected_hash),
        doc.content_hash,
        p_expected_hash,
        CURRENT_TIMESTAMP
    FROM immutable_documents doc
    WHERE doc.id = p_document_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 13. FUNCTION: MARK DOCUMENT FOR COMPLIANCE REVIEW
-- ============================================================================
CREATE OR REPLACE FUNCTION mark_for_compliance_review(
    p_document_id UUID,
    p_reviewed_by VARCHAR(255),
    p_compliance_category VARCHAR(100)
)
RETURNS VOID AS $$
BEGIN
    UPDATE immutable_documents
    SET
        compliance_checked = TRUE,
        compliance_checked_at = CURRENT_TIMESTAMP,
        compliance_checked_by = p_reviewed_by,
        compliance_category = p_compliance_category
    WHERE id = p_document_id;

    INSERT INTO immutable_document_audit (
        document_id,
        audit_type,
        action,
        blocked_by,
        blocked_at
    ) VALUES (
        p_document_id,
        'COMPLIANCE_REVIEW',
        'MARKED_FOR_COMPLIANCE',
        p_reviewed_by,
        CURRENT_TIMESTAMP
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 14. SAMPLE QUERIES FOR IMMUTABLE DOCUMENTS
-- ============================================================================
/*

-- Get all immutable documents for a user
SELECT id, document_id, title, location, locked, created_at
FROM immutable_documents
WHERE owner_id = '<user_id>'
  AND locked = TRUE
ORDER BY created_at DESC;

-- Get all deletion attempts in last 7 days
SELECT record_id, document_id, attempt_type, attempted_by, status, attempted_at
FROM deletion_attempts
WHERE attempted_at > NOW() - INTERVAL '7 days'
ORDER BY attempted_at DESC;

-- Find documents requiring compliance review
SELECT id, document_id, title, compliance_category, compliance_checked
FROM immutable_documents
WHERE compliance_checked = FALSE
  AND compliance_category IS NOT NULL
ORDER BY created_at ASC;

-- Get content integrity verification report
SELECT doc.document_id, doc.title, doc.content_hash, doc.locked,
       COUNT(da.id) as audit_events
FROM immutable_documents doc
LEFT JOIN immutable_document_audit da ON doc.id = da.document_id
WHERE doc.locked = TRUE
GROUP BY doc.id, doc.document_id, doc.title, doc.content_hash, doc.locked
ORDER BY doc.created_at DESC;

-- Find deletion attempts by specific user
SELECT attempted_at, attempt_type, document_id, status, denial_reason
FROM deletion_attempts
WHERE attempted_by = '<user_id>'
ORDER BY attempted_at DESC;

-- Get audit trail for specific document
SELECT audit_type, action, blocked_by, blocked_at
FROM immutable_document_audit
WHERE document_id = '<document_id>'
ORDER BY blocked_at DESC;

-- Find documents approaching retention expiry
SELECT document_id, title, retention_expires_at
FROM immutable_documents
WHERE retention_expires_at IS NOT NULL
  AND retention_expires_at < NOW() + INTERVAL '30 days'
  AND retention_expires_at > NOW()
ORDER BY retention_expires_at ASC;

-- Get all suspicious deletion attempts requiring investigation
SELECT id, document_id, attempted_by, attempt_type, attempted_at
FROM deletion_attempts
WHERE requires_investigation = TRUE
  AND investigation_completed_at IS NULL
ORDER BY attempted_at ASC;

-- Verify document integrity
SELECT * FROM verify_document_integrity('<document_id>', '<expected_hash>');

*/
