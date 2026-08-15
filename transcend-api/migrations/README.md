# Database Migrations

Complete PostgreSQL migration scripts for the Transcend deployment and activity tracking system.

## Migration Files

### 001_create_deployment_tables.sql (214 lines)
Creates core deployment tracking infrastructure with comprehensive audit capabilities.

**Tables:**
- `deployments` - Main deployment records with status, branch, commit, environment, and rollback tracking
- `deployment_audit_log` - Audit trail for all deployment changes

**Features:**
- Deployment status tracking (pending, in_progress, completed, failed, rolled_back)
- Deployment strategies (blue_green, canary, rolling, direct)
- Automatic duration calculation
- Rollback tracking and reasoning
- Deletion prevention with locking
- 8 optimized indexes for fast queries
- Audit triggers for all changes
- Auto-update timestamps
- Constraint triggers for data integrity

**Key Constraints:**
- `deletion_prevented NOT NULL` - Prevents accidental deletion of critical deployments
- Type validation (frontend, backend, database, infrastructure, hotfix)
- Status validation with complete lifecycle
- Environment validation (development, staging, production)

### 002_create_activity_logs.sql (344 lines)
Tracks all user activities, device information, and access patterns with compliance support.

**Tables:**
- `activity_logs` - Comprehensive user activity tracking with device and location info
- `activity_log_audit` - Audit trail for modifications to activity logs

**Features:**
- 20+ activity types (login, logout, create, read, update, delete, export, import, verify, etc.)
- Device information extraction (browser, OS, device type)
- Geolocation tracking from IP address
- Activity status tracking (success, failure, pending, error)
- Data sensitivity classification (public, internal, confidential, restricted)
- Compliance flagging and audit tracking
- Suspicious activity detection
- Session tracking
- Full-text search on actions and resource names
- 11 optimized indexes including GiST for IP operations
- Helper functions for user agent parsing and suspicious activity detection

**Key Functions:**
- `parse_user_agent()` - Extracts browser, OS, device type from user agent
- `detect_suspicious_activity()` - Identifies rapid actions, IP changes, failed attempts
- `flag_sensitive_activities()` - Auto-flags high-risk activities for audit
- `update_activity_log_timestamp()` - Maintains accurate timestamps

### 003_create_immutable_documents.sql (461 lines)
Enforces document immutability, prevents deletion, and maintains complete audit trail.

**Tables:**
- `immutable_documents` - Immutable document storage with integrity verification
- `deletion_attempts` - Complete log of all attempts to delete or modify documents
- `immutable_document_audit` - Audit trail for document modifications

**Features:**
- Immutability enforcement with `locked NOT NULL` constraint
- Content integrity verification with SHA-256 hashing
- Digital signature support for authenticity
- Version tracking with supersession history
- Access level classification
- Document classification and retention policies
- Compliance category tracking with review status
- Deletion prevention with lock expiry management
- Deletion attempt logging and investigation tracking
- 10 optimized indexes for fast queries
- Multiple constraint triggers to prevent unauthorized modifications
- Audit triggers for all modification attempts

**Key Constraints:**
- `locked NOT NULL` - All documents locked by default
- `deletion_prevented NOT NULL` - All documents deletion-protected by default
- Content hash validation (SHA-256 format)
- Prevents modification of locked documents
- Prevents deletion of deletion-prevented documents

**Key Functions:**
- `prevent_locked_document_modification()` - Blocks all updates/deletes to locked docs
- `prevent_deletion_prevented_document_deletion()` - Blocks deletion of protected docs
- `validate_content_integrity()` - Validates SHA-256 hash format
- `update_retention_expiry()` - Auto-calculates retention expiry date
- `verify_document_integrity()` - Verifies document hash matches expected value
- `mark_for_compliance_review()` - Marks documents for compliance checking

## Deployment Instructions

### Prerequisites
- PostgreSQL 12.0+
- Database user with CREATE TABLE, CREATE INDEX, CREATE FUNCTION permissions
- psql CLI or database management tool

### Step 1: Connect to Database
```bash
psql -U postgres -h localhost -d your_database
```

### Step 2: Run Migrations in Order
```bash
-- Migration 1: Core deployment tables
\i 001_create_deployment_tables.sql

-- Migration 2: Activity logging
\i 002_create_activity_logs.sql

-- Migration 3: Immutable documents
\i 003_create_immutable_documents.sql
```

### Alternative: Single Command
```bash
psql -U postgres -h localhost -d your_database -f 001_create_deployment_tables.sql
psql -U postgres -h localhost -d your_database -f 002_create_activity_logs.sql
psql -U postgres -h localhost -d your_database -f 003_create_immutable_documents.sql
```

### Step 3: Verify Installation
```sql
-- Check deployment tables
SELECT tablename FROM pg_tables 
WHERE tablename LIKE 'deployment%' OR tablename LIKE 'activity%' 
   OR tablename LIKE 'immutable%' OR tablename LIKE 'deletion%';

-- Verify indexes created
SELECT indexname FROM pg_indexes 
WHERE tablename LIKE 'deployment%' OR tablename LIKE 'activity%' 
   OR tablename LIKE 'immutable%' OR tablename LIKE 'deletion%';

-- Verify triggers created
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_schema = 'public';

-- Verify functions created
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION';
```

## Key Features Summary

### Data Integrity
- ✓ Immutable documents with SHA-256 content verification
- ✓ Digital signature support for authenticity
- ✓ Content hash validation on insert/update
- ✓ Locked document enforcement via triggers

### Audit & Compliance
- ✓ Complete audit trail for all changes
- ✓ Activity logging with device and location tracking
- ✓ Deletion attempt logging with investigation tracking
- ✓ Compliance category classification
- ✓ Data sensitivity tracking
- ✓ Suspicious activity detection

### Deletion Prevention
- ✓ Deletion prevention flags with NOT NULL constraints
- ✓ Lock expiry management
- ✓ Multiple layers of deletion protection
- ✓ Comprehensive deletion attempt logging
- ✓ Escalation and investigation workflow

### Performance
- ✓ 30+ optimized indexes across all tables
- ✓ Composite indexes for common queries
- ✓ Partial indexes for filtered queries
- ✓ GiST index for IP CIDR operations
- ✓ Text search indexes for full-text search

### Audit Triggers
- ✓ Automatic change logging
- ✓ Auto-timestamp updates
- ✓ Suspicious activity flagging
- ✓ Content integrity validation
- ✓ Retention expiry calculation

## Sample Usage

### Record a Deployment
```sql
INSERT INTO deployments (
    type, status, branch, commit, version, environment, 
    deployed_by, deployment_strategy
) VALUES (
    'frontend', 'completed', 'main', 'a1b2c3d4', 'v1.2.0',
    'production', 'deployment_bot', 'rolling'
);
```

### Log User Activity
```sql
INSERT INTO activity_logs (
    user_id, activity_type, action, resource_type, resource_id,
    location, ip_address, user_agent, status, data_sensitivity
) VALUES (
    'user123', 'download', 'Downloaded contract', 'document', 'doc456',
    'San Francisco, CA', '192.168.1.1'::inet, 
    'Mozilla/5.0...', 'success', 'restricted'
);
```

### Create Immutable Document
```sql
INSERT INTO immutable_documents (
    document_id, title, location, content_type, file_size,
    content_hash, locked, locked_by, owner_id, created_by,
    access_level, retention_period_days
) VALUES (
    'doc123', 'Legal Contract', '/docs/contract.pdf', 'application/pdf', 125000,
    'abc123def456...', true, 'system', 'user123', 'admin',
    'restricted', 2555
);
```

### Query Deletion Attempts
```sql
SELECT * FROM deletion_attempts 
WHERE status = 'blocked' 
  AND attempted_at > NOW() - INTERVAL '7 days'
ORDER BY attempted_at DESC;
```

### Verify Document Integrity
```sql
SELECT * FROM verify_document_integrity(
    '<document_uuid>', 
    '<expected_sha256_hash>'
);
```

## Monitoring & Maintenance

### Check for Failed Deployments
```sql
SELECT * FROM deployments 
WHERE status = 'failed' 
ORDER BY started_at DESC LIMIT 10;
```

### Find Suspicious Activities
```sql
SELECT user_id, COUNT(*) as failed_logins
FROM activity_logs
WHERE activity_type = 'login' AND status = 'failure'
  AND timestamp > NOW() - INTERVAL '1 hour'
GROUP BY user_id HAVING COUNT(*) > 5;
```

### Monitor Deletion Attempts
```sql
SELECT * FROM deletion_attempts 
WHERE requires_investigation = TRUE
  AND investigation_completed_at IS NULL
ORDER BY attempted_at ASC;
```

### Check Retention Expiry
```sql
SELECT document_id, title, retention_expires_at
FROM immutable_documents
WHERE retention_expires_at < NOW() + INTERVAL '30 days'
  AND retention_expires_at > NOW()
ORDER BY retention_expires_at ASC;
```

## Rollback Procedures

If you need to rollback a migration:

```sql
-- Drop all objects created by migration 3
DROP TRIGGER IF EXISTS trg_prevent_locked_document_modification ON immutable_documents CASCADE;
DROP TRIGGER IF EXISTS trg_prevent_deletion_prevented_document_deletion ON immutable_documents CASCADE;
DROP TRIGGER IF EXISTS trg_immutable_documents_update_timestamp ON immutable_documents CASCADE;
DROP TRIGGER IF EXISTS trg_validate_content_integrity ON immutable_documents CASCADE;
DROP TRIGGER IF EXISTS trg_update_retention_expiry ON immutable_documents CASCADE;
DROP FUNCTION IF EXISTS prevent_locked_document_modification() CASCADE;
DROP FUNCTION IF EXISTS prevent_deletion_prevented_document_deletion() CASCADE;
DROP FUNCTION IF EXISTS validate_content_integrity() CASCADE;
DROP FUNCTION IF EXISTS update_retention_expiry() CASCADE;
DROP FUNCTION IF EXISTS verify_document_integrity(UUID, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS mark_for_compliance_review(UUID, VARCHAR, VARCHAR) CASCADE;
DROP TABLE IF EXISTS immutable_document_audit CASCADE;
DROP TABLE IF EXISTS deletion_attempts CASCADE;
DROP TABLE IF EXISTS immutable_documents CASCADE;
```

## Notes

- All migrations use `IF NOT EXISTS` or check before creating objects
- Audit triggers log all changes for compliance
- Deletion prevention is enforced at the database level, not just application level
- Content integrity is validated on insert/update
- All timestamps use `TIMESTAMP WITH TIME ZONE` for timezone awareness
- Sensitive operations log detailed audit trails
- Indexes are designed for common query patterns in the application

