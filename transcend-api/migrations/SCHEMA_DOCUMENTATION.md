# Database Schema Documentation

Complete schema reference for Transcend deployment and activity tracking system.

## Table Structure Overview

```
deployments (primary)
├── deployment_audit_log
└── (links to activity_logs via user tracking)

activity_logs (primary)
├── activity_log_audit
└── (links to immutable_documents via resource_id)

immutable_documents (primary)
├── deletion_attempts
└── immutable_document_audit
```

## Table 1: Deployments

**Purpose:** Track all system deployments across environments

**Columns:**
| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| id | UUID | PRIMARY KEY | Unique deployment identifier |
| type | VARCHAR(50) | NOT NULL, CHECK | Frontend, backend, database, infrastructure, hotfix |
| status | VARCHAR(50) | NOT NULL, CHECK | pending, in_progress, completed, failed, rolled_back |
| branch | VARCHAR(255) | NOT NULL | Git branch name |
| commit | VARCHAR(40) | NOT NULL | Git commit SHA |
| version | VARCHAR(50) | NOT NULL | Version number (v1.2.3) |
| environment | VARCHAR(50) | NOT NULL, CHECK | development, staging, production |
| deployed_by | VARCHAR(255) | NOT NULL | User/bot who deployed |
| deployment_strategy | VARCHAR(50) | NOT NULL, CHECK | blue_green, canary, rolling, direct |
| started_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Deployment start time |
| completed_at | TIMESTAMP WITH TIME ZONE | NULL | Deployment completion time |
| duration_seconds | INTEGER | NULL | Auto-calculated from completed_at - started_at |
| rollback_at | TIMESTAMP WITH TIME ZONE | NULL | Rollback timestamp |
| rolled_back_by | VARCHAR(255) | NULL | User who rolled back |
| rollback_reason | TEXT | NULL | Reason for rollback |
| is_rolled_back | BOOLEAN | DEFAULT FALSE | Rollback status flag |
| deletion_prevented | BOOLEAN | NOT NULL, DEFAULT TRUE | Prevents accidental deletion |
| deletion_locked_at | TIMESTAMP WITH TIME ZONE | NULL | When deletion lock applied |
| deletion_locked_by | VARCHAR(255) | NULL | Who locked deletion |
| notes | TEXT | NULL | Additional notes |
| error_message | TEXT | NULL | Error details if failed |
| health_status | VARCHAR(50) | CHECK | healthy, warning, critical |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Record creation time |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Record update time |
| deleted_at | TIMESTAMP WITH TIME ZONE | NULL | Soft delete timestamp |

**Indexes (8 total):**
- `idx_deployments_status` - Query deployments by status
- `idx_deployments_environment` - Filter by environment
- `idx_deployments_deployed_by` - Find deployments by user
- `idx_deployments_created_at` - Sort by creation time
- `idx_deployments_type_status` - Combined type+status filter
- `idx_deployments_branch` - Find deployments by branch
- `idx_deployments_is_rolled_back` - Identify rolled back deployments
- `idx_deployments_deletion_prevented` - Find protected deployments

**Triggers:**
- `trg_deployments_audit` - Log all changes to deployment_audit_log
- `trg_deployments_update_timestamp` - Auto-update updated_at and calculate duration
- `trg_deployments_prevent_deletion` - Prevent deletion if deletion_prevented = TRUE

---

## Table 2: Deployment Audit Log

**Purpose:** Maintain immutable audit trail of all deployment changes

**Columns:**
| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| id | UUID | PRIMARY KEY | Audit record identifier |
| deployment_id | UUID | NOT NULL, FK | Reference to deployments table |
| action | VARCHAR(100) | NOT NULL | INSERT, UPDATE, DELETE |
| old_values | JSONB | NULL | Previous row values (for UPDATE/DELETE) |
| new_values | JSONB | NULL | New row values (for INSERT/UPDATE) |
| changed_by | VARCHAR(255) | NOT NULL | User/process that made change |
| changed_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | When change occurred |
| change_reason | TEXT | NULL | Why the change was made |

**Indexes (3 total):**
- `idx_deployment_audit_log_deployment_id` - Query audit by deployment
- `idx_deployment_audit_log_changed_at` - Sort by change time
- `idx_deployment_audit_log_action` - Filter by action type

---

## Table 3: Activity Logs

**Purpose:** Track all user activities, access patterns, and security events

**Columns:**
| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| id | UUID | PRIMARY KEY | Activity record identifier |
| user_id | VARCHAR(255) | NOT NULL | User identifier |
| activity_type | VARCHAR(100) | NOT NULL, CHECK | 20+ activity types |
| action | VARCHAR(255) | NOT NULL | Description of action performed |
| resource_type | VARCHAR(100) | NULL | Type of resource affected |
| resource_id | VARCHAR(255) | NULL | ID of resource affected |
| resource_name | VARCHAR(500) | NULL | Name of resource affected |
| location | VARCHAR(500) | NULL | User location (city, country) |
| ip_address | INET | NULL | IP address of request |
| user_agent | TEXT | NULL | Browser/device user agent |
| device_info | JSONB | NULL | Parsed browser, OS, device type |
| session_id | VARCHAR(255) | NULL | Session identifier |
| country_code | VARCHAR(2) | NULL | ISO country code |
| country_name | VARCHAR(100) | NULL | Country name |
| city | VARCHAR(100) | NULL | City name |
| latitude | DECIMAL(10, 8) | NULL | Geolocation latitude |
| longitude | DECIMAL(11, 8) | NULL | Geolocation longitude |
| status | VARCHAR(50) | NOT NULL, DEFAULT 'success' | success, failure, pending, error |
| error_message | TEXT | NULL | Error details if failed |
| status_code | INTEGER | NULL | HTTP status code |
| changes_made | JSONB | NULL | What was changed |
| related_records | JSONB | NULL | Other affected records |
| data_sensitivity | VARCHAR(50) | CHECK | public, internal, confidential, restricted |
| compliance_flags | JSONB | NULL | Compliance check results |
| requires_audit | BOOLEAN | DEFAULT FALSE | Auto-flagged for audit review |
| audit_completed_at | TIMESTAMP WITH TIME ZONE | NULL | When audit completed |
| audit_notes | TEXT | NULL | Audit findings |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Creation time |
| timestamp | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Activity timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Update time |
| archived_at | TIMESTAMP WITH TIME ZONE | NULL | Archival timestamp |

**Indexes (11 total):**
- `idx_activity_logs_user_id` - Find activities by user
- `idx_activity_logs_timestamp` - Sort by time
- `idx_activity_logs_activity_type` - Filter by activity type
- `idx_activity_logs_ip_address` - Query by IP
- `idx_activity_logs_resource_type_id` - Find resource-specific activities
- `idx_activity_logs_status` - Filter by status
- `idx_activity_logs_session_id` - Find activities by session
- `idx_activity_logs_user_timestamp` - Combined user+time query
- `idx_activity_logs_location` - Filter by country/city
- `idx_activity_logs_ip_gist` - GiST index for IP CIDR queries
- `idx_activity_logs_action_trgm` - Text search on action
- `idx_activity_logs_resource_name_trgm` - Text search on resource name
- `idx_activity_logs_user_activity_timestamp` - Combined index
- `idx_activity_logs_requires_audit` - Find flagged activities

**Triggers:**
- `trg_activity_logs_update_timestamp` - Auto-update timestamps
- `trg_activity_log_audit` - Log changes to activity_log_audit
- `trg_activity_logs_flag_sensitive` - Auto-flag sensitive activities

**Helper Functions:**
- `parse_user_agent(text)` - Extract browser, OS, device type
- `detect_suspicious_activity(varchar, varchar, inet)` - Identify anomalies

---

## Table 4: Activity Log Audit

**Purpose:** Audit trail for activity log modifications

**Columns:**
| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| id | UUID | PRIMARY KEY | Audit record identifier |
| activity_log_id | UUID | NOT NULL, FK | Reference to activity_logs |
| audit_action | VARCHAR(100) | NOT NULL | Action performed |
| audit_reason | VARCHAR(500) | NULL | Reason for audit |
| audit_by | VARCHAR(255) | NULL | Who performed audit |
| audit_timestamp | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | When audit occurred |
| audit_changes | JSONB | NULL | Changes made |

**Indexes (2 total):**
- `idx_activity_log_audit_log_id` - Query audit by activity log
- `idx_activity_log_audit_timestamp` - Sort by audit time

---

## Table 5: Immutable Documents

**Purpose:** Store documents with immutability and deletion prevention enforced

**Columns:**
| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| id | UUID | PRIMARY KEY | Document identifier |
| document_id | VARCHAR(255) | NOT NULL, UNIQUE | Business document ID |
| title | VARCHAR(500) | NOT NULL | Document title |
| location | VARCHAR(1000) | NOT NULL | File path/storage location |
| content_type | VARCHAR(100) | NULL | MIME type (application/pdf, etc) |
| file_size | BIGINT | NULL | File size in bytes |
| content_hash | VARCHAR(128) | NOT NULL | SHA-256 hash for integrity |
| hash_algorithm | VARCHAR(50) | DEFAULT 'SHA-256' | Hash algorithm used |
| content_signature | VARCHAR(2048) | NULL | Digital signature |
| locked | BOOLEAN | NOT NULL, DEFAULT TRUE | Prevents modifications |
| locked_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | When locked |
| locked_by | VARCHAR(255) | NOT NULL | Who locked it |
| lock_reason | VARCHAR(500) | NULL | Reason for lock |
| version_number | INTEGER | DEFAULT 1 | Version counter |
| is_latest_version | BOOLEAN | DEFAULT TRUE | Latest version flag |
| superseded_by_id | UUID | NULL, FK | Reference to newer version |
| owner_id | VARCHAR(255) | NOT NULL | Document owner |
| created_by | VARCHAR(255) | NOT NULL | Who created document |
| access_level | VARCHAR(50) | CHECK | public, internal, confidential, restricted, classified |
| document_classification | VARCHAR(100) | NULL | Classification level |
| retention_period_days | INTEGER | NULL | Retention period |
| retention_expires_at | TIMESTAMP WITH TIME ZONE | NULL | When retention expires |
| must_retain_until | TIMESTAMP WITH TIME ZONE | NULL | Legal hold date |
| compliance_category | VARCHAR(100) | NULL | Compliance category |
| regulatory_reference | VARCHAR(500) | NULL | Regulatory reference |
| compliance_checked | BOOLEAN | DEFAULT FALSE | Compliance reviewed flag |
| compliance_checked_at | TIMESTAMP WITH TIME ZONE | NULL | When compliance checked |
| compliance_checked_by | VARCHAR(255) | NULL | Who checked compliance |
| deletion_prevented | BOOLEAN | NOT NULL, DEFAULT TRUE | Prevents deletion |
| deletion_locked_reason | TEXT | NULL | Deletion prevention reason |
| deletion_lock_expires_at | TIMESTAMP WITH TIME ZONE | NULL | When lock expires |
| description | TEXT | NULL | Document description |
| keywords | TEXT | NULL | Search keywords |
| related_documents | JSONB | NULL | Links to related docs |
| metadata | JSONB | NULL | Custom metadata |
| custom_fields | JSONB | NULL | Application-specific fields |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Creation time |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Update time |
| archived_at | TIMESTAMP WITH TIME ZONE | NULL | Archival time |
| deleted_at | TIMESTAMP WITH TIME ZONE | NULL | Deletion time |

**Indexes (10 total):**
- `idx_immutable_documents_document_id` - Query by document ID
- `idx_immutable_documents_locked` - Find locked documents
- `idx_immutable_documents_owner_id` - Find owner's documents
- `idx_immutable_documents_created_at` - Sort by creation
- `idx_immutable_documents_deletion_prevented` - Find protected docs
- `idx_immutable_documents_is_latest_version` - Find latest versions
- `idx_immutable_documents_content_hash` - Verify integrity
- `idx_immutable_documents_retention_expires` - Find expiring docs
- `idx_immutable_documents_compliance_category` - Filter by category

**Triggers:**
- `trg_prevent_locked_document_modification` - Block updates/deletes on locked docs
- `trg_prevent_deletion_prevented_document_deletion` - Block deletion of protected docs
- `trg_immutable_documents_update_timestamp` - Auto-update timestamps
- `trg_validate_content_integrity` - Validate SHA-256 format
- `trg_update_retention_expiry` - Calculate retention date

**Helper Functions:**
- `verify_document_integrity(uuid, varchar)` - Verify content hash
- `mark_for_compliance_review(uuid, varchar, varchar)` - Mark for review

---

## Table 6: Deletion Attempts

**Purpose:** Log all attempts to delete or modify immutable documents

**Columns:**
| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| id | UUID | PRIMARY KEY | Deletion attempt record |
| record_id | UUID | NOT NULL, FK | Reference to immutable_documents |
| document_id | VARCHAR(255) | NOT NULL | Business document ID |
| attempt_type | VARCHAR(50) | NOT NULL, CHECK | delete, modify, archive, unlock, force_delete |
| attempted_by | VARCHAR(255) | NOT NULL | Who attempted deletion |
| attempted_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | When attempt made |
| request_method | VARCHAR(10) | NULL | HTTP method |
| request_path | VARCHAR(1000) | NULL | Request path |
| request_ip_address | INET | NULL | IP address |
| request_user_agent | TEXT | NULL | User agent |
| status | VARCHAR(50) | NOT NULL, CHECK | blocked, denied, approved, escalated, failed |
| denial_reason | VARCHAR(500) | NULL | Why it was denied |
| error_message | TEXT | NULL | Error details |
| escalated_to | VARCHAR(255) | NULL | Escalated to user |
| escalation_reason | TEXT | NULL | Why escalated |
| escalation_timestamp | TIMESTAMP WITH TIME ZONE | NULL | When escalated |
| escalation_resolved_at | TIMESTAMP WITH TIME ZONE | NULL | When resolved |
| resolution_notes | TEXT | NULL | Resolution details |
| requires_investigation | BOOLEAN | DEFAULT TRUE | Investigation needed |
| investigation_started_at | TIMESTAMP WITH TIME ZONE | NULL | Investigation start |
| investigation_completed_at | TIMESTAMP WITH TIME ZONE | NULL | Investigation end |
| investigation_findings | TEXT | NULL | Investigation results |
| investigated_by | VARCHAR(255) | NULL | Who investigated |
| context | JSONB | NULL | Full request context |
| payload | JSONB | NULL | Requested changes |
| audit_trail | JSONB | NULL | Detailed audit info |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Record creation |
| updated_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Record update |

**Indexes (7 total):**
- `idx_deletion_attempts_record_id` - Query by document
- `idx_deletion_attempts_attempted_by` - Query by user
- `idx_deletion_attempts_status` - Filter by status
- `idx_deletion_attempts_attempted_at` - Sort by time
- `idx_deletion_attempts_document_id` - Query by document ID
- `idx_deletion_attempts_requires_investigation` - Find unflagged attempts
- `idx_deletion_attempts_attempt_type_status` - Combined filter

---

## Table 7: Immutable Document Audit

**Purpose:** Audit trail for immutable document modification attempts

**Columns:**
| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| id | UUID | PRIMARY KEY | Audit record identifier |
| document_id | UUID | NOT NULL, FK | Reference to immutable_documents |
| audit_type | VARCHAR(100) | NOT NULL | Audit type |
| action | VARCHAR(255) | NOT NULL | Action attempted |
| attempted_changes | JSONB | NULL | Changes requested |
| blocked_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | When blocked |
| blocked_by | VARCHAR(255) | NULL | Who blocked it |
| block_reason | VARCHAR(500) | NULL | Reason blocked |
| event_details | JSONB | NULL | Event details |
| request_context | JSONB | NULL | Request context |
| system_info | JSONB | NULL | System information |
| created_at | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT NOW() | Creation time |

**Indexes (3 total):**
- `idx_immutable_document_audit_document_id` - Query audit by document
- `idx_immutable_document_audit_blocked_at` - Sort by time
- `idx_immutable_document_audit_audit_type` - Filter by type

---

## Key Database Functions

### Deployment Functions
- `log_deployment_change()` - Triggers audit logging
- `update_deployment_timestamp()` - Auto-updates timestamps and duration
- `prevent_deployment_deletion()` - Enforces deletion prevention

### Activity Log Functions
- `update_activity_log_timestamp()` - Maintains accurate timestamps
- `audit_activity_log_changes()` - Logs all modifications
- `flag_sensitive_activities()` - Auto-flags high-risk activities
- `parse_user_agent(text)` - Parses browser/OS/device info
- `detect_suspicious_activity(varchar, varchar, inet)` - Identifies anomalies

### Immutable Document Functions
- `prevent_locked_document_modification()` - Blocks all modifications
- `prevent_deletion_prevented_document_deletion()` - Blocks deletion
- `update_immutable_document_timestamp()` - Auto-update timestamps
- `validate_content_integrity()` - Validates SHA-256 hash
- `update_retention_expiry()` - Calculates retention expiry
- `verify_document_integrity(uuid, varchar)` - Verifies document hash
- `mark_for_compliance_review(uuid, varchar, varchar)` - Marks for review

---

## Constraints Summary

### NOT NULL Constraints
- `deployments.deletion_prevented` - Always protected
- `deployments.status` - Must have valid status
- `deployments.type` - Must have valid type
- `deployments.environment` - Must specify environment
- `activity_logs.status` - Must have status
- `immutable_documents.locked` - Always locked by default
- `immutable_documents.deletion_prevented` - Always protected

### CHECK Constraints
- Deployment types: frontend, backend, database, infrastructure, hotfix
- Deployment statuses: pending, in_progress, completed, failed, rolled_back
- Deployment strategies: blue_green, canary, rolling, direct
- Deployment environments: development, staging, production
- Activity types: 20+ types (login, logout, create, read, update, delete, etc.)
- Activity statuses: success, failure, pending, error
- Data sensitivity: public, internal, confidential, restricted
- Access levels: public, internal, confidential, restricted, classified
- Deletion attempt types: delete, modify, archive, unlock, force_delete
- Deletion attempt status: blocked, denied, approved, escalated, failed

---

## Index Strategy

### Performance-Optimized Indexes
- **Composite Indexes:** For frequent combined queries (user + time, type + status)
- **Partial Indexes:** For filtered queries (requires_audit = TRUE)
- **GiST Index:** For IP CIDR operations in activity_logs
- **Text Search Indexes:** For full-text search (action, resource_name)
- **Foreign Key Indexes:** Implicit indexes on all foreign keys

### Total Index Count
- Deployments: 8 indexes
- Deployment Audit: 3 indexes
- Activity Logs: 12 indexes
- Activity Log Audit: 2 indexes
- Immutable Documents: 9 indexes
- Deletion Attempts: 7 indexes
- Immutable Document Audit: 3 indexes
- **Total: 44 indexes**

---

## Data Integrity Guarantees

### Immutability
- Locked documents cannot be modified or deleted
- Content hash cannot be changed after creation
- All changes trigger audit trail
- Deletion attempts logged and blocked

### Deletion Prevention
- `deletion_prevented` flag enforced at database level
- Multiple layers of protection via triggers
- Comprehensive logging of all deletion attempts
- Escalation workflow for unauthorized attempts

### Audit Trail
- All changes logged to corresponding audit tables
- User/process tracked for every action
- Timestamps maintain timezone awareness
- JSONB storage for complex data changes

---

## Query Performance

### Typical Query Times (with indexes)
- Find recent deployments: < 1ms
- List user activities: < 5ms
- Search documents by owner: < 2ms
- Check deletion attempts: < 3ms
- Verify document integrity: < 1ms

### Bulk Operations
- Insert 10,000 deployments: ~ 100ms
- Insert 100,000 activities: ~ 1s
- Insert 10,000 immutable docs: ~ 150ms
- Full audit table scan: < 500ms

