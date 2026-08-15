# Comprehensive Audit Logging Implementation Guide

## Overview

The Transcend Law Platform implements a production-grade audit logging system that satisfies legal and regulatory compliance requirements including 7-year retention mandates. This system logs every action with immutable, append-only records.

**Key Features:**
- Immutable, append-only logging (prevents tampering)
- 7-year legal retention for restricted/confidential data
- Searchable with advanced filtering
- Export capability (JSON, CSV, PDF)
- Anomaly detection and security monitoring
- Admin audit reports with compliance summaries
- Geographic IP tracking and location analysis
- Sensitive data access monitoring

---

## Architecture

### Database Schema

The audit logging system consists of 6 primary tables:

1. **audit_logs** - Main immutable append-only log table
2. **audit_logs_archive** - Long-term storage (7-year retention)
3. **audit_retention_policies** - Data retention rules per classification
4. **audit_reports** - Generated compliance reports
5. **audit_log_hashes** - Integrity verification chain
6. **audit_exceptions** - Approved logging exceptions

### Data Classifications

Logs are classified into 4 categories with different retention periods:

| Classification | Retention | Delete Policy | Examples |
|---|---|---|---|
| `public` | 1 year (365 days) | Permanent delete | Public directory listings |
| `internal` | 3 years (1,095 days) | Archive | Internal API calls, system logs |
| `confidential` | 7 years (2,555 days) | Archive | Case data, user profiles |
| `restricted` | 7 years (2,555 days) | Archive | Payments, auth, permissions |

---

## Installation & Setup

### 1. Initialize Database Tables

```typescript
import { initializeAuditTables } from './services/auditLogger';

// Run once during application initialization
await initializeAuditTables();
```

Or run the SQL schema directly:

```bash
psql -U postgres -d transcend_law -f transcend-api/src/database/audit-schema.sql
```

### 2. Apply Default Retention Policies

```typescript
import { applyDefaultRetentionPolicies } from './services/auditLogger';

const adminUserId = 'admin-user-uuid';
await applyDefaultRetentionPolicies(adminUserId);
```

### 3. Set Up Express Middleware

```typescript
import express from 'express';
import {
  auditLoggingMiddleware,
  auditAuthMiddleware,
  auditDataChangeMiddleware,
  auditSensitiveDataMiddleware,
} from './services/auditMiddleware';

const app = express();

// Add audit middleware early in the chain
app.use(auditLoggingMiddleware());
app.use(auditAuthMiddleware());

// Track data changes on cases endpoint
app.use(
  '/api/cases',
  auditDataChangeMiddleware('case', (req) => req.params.id || 'unknown')
);

// Track sensitive data access
const sensitiveEndpoints = new Map([
  ['/api/users/:id/profile', { entityType: 'user', classification: 'confidential' }],
  ['/api/payments/:id', { entityType: 'payment', classification: 'restricted' }],
  ['/api/cases/:id/documents', { entityType: 'document', classification: 'confidential' }],
]);

app.use(auditSensitiveDataMiddleware(sensitiveEndpoints));
```

---

## Core Functions

### Logging Actions

#### logAction() - Primary Logging Function

```typescript
import { logAction } from './services/auditLogger';

// Log a data modification
await logAction(
  userId,           // UUID of user performing action
  'update',         // Action: 'create' | 'read' | 'update' | 'delete' | 'export' | 'access' | 'admin' | 'auth' | 'permission'
  'case',           // Entity type
  caseId,           // Entity ID
  {
    entityName: 'Case #12345: Smith v. Jones',
    changes: {
      before: { status: 'open', budget_max: 5000 },
      after: { status: 'matched', budget_max: 7500 },
      fields_modified: ['status', 'budget_max']
    },
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0...',
    status: 'success',
    dataClassification: 'confidential',
    sensitiveDataAccessed: false,
    metadata: { 
      caseType: 'personal_injury',
      clientId: '...', 
    }
  }
);
```

#### logDataAccess() - Compliance Tracking

```typescript
import { logDataAccess } from './services/auditLogger';

// Log access to sensitive data
await logDataAccess(
  userId,
  'case',
  caseId,
  ipAddress,
  'confidential',
  ['document_urls', 'client_ssn']  // Sensitive fields accessed
);
```

#### logAuthEvent() - Authentication Events

```typescript
import { logAuthEvent } from './services/auditLogger';

// Log login
await logAuthEvent(
  userId,
  'login',
  ipAddress,
  userAgent,
  true  // success
);

// Log failed login
await logAuthEvent(
  email,
  'failed_login',
  ipAddress,
  userAgent,
  false  // failure
);

// Log password reset
await logAuthEvent(
  userId,
  'password_reset',
  ipAddress,
  userAgent,
  true
);

// Log MFA activation
await logAuthEvent(
  userId,
  'mfa_enabled',
  ipAddress,
  userAgent,
  true
);
```

#### logAdminAction() - Administrative Changes

```typescript
import { logAdminAction } from './services/auditLogger';

// Log admin disabling a user account
await logAdminAction(
  adminId,
  'disable_user_account',
  targetUserId,
  { reason: 'Policy violation', notified: true },
  ipAddress
);

// Log admin role assignment
await logAdminAction(
  adminId,
  'assign_role',
  targetUserId,
  { newRole: 'attorney', oldRole: 'client' },
  ipAddress
);
```

#### logPermissionChange() - Permission Tracking

```typescript
import { logPermissionChange } from './services/auditLogger';

// Log permission grant
await logPermissionChange(
  adminId,
  userId,
  'can_view_attorney_directory',
  'grant',
  ipAddress
);

// Log permission revocation
await logPermissionChange(
  adminId,
  userId,
  'can_export_data',
  'revoke',
  ipAddress
);
```

---

## Search & Analysis

### searchAuditLogs() - Advanced Filtering

```typescript
import { searchAuditLogs } from './services/auditLogger';

// Find all failed login attempts for a user in the last 24 hours
const failedLogins = await searchAuditLogs({
  userId: 'user-123',
  action: 'auth',
  status: 'failure',
  startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
  endDate: new Date(),
  limit: 100
});

// Find all data access from a specific IP address
const ipActivity = await searchAuditLogs({
  ipAddress: '192.168.1.100',
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  endDate: new Date(),
  limit: 500
});

// Find all updates to a specific case
const caseHistory = await searchAuditLogs({
  entityType: 'case',
  entityId: 'case-456',
  action: 'update',
  limit: 1000
});

// Find all restricted data access
const restrictedAccess = await searchAuditLogs({
  dataClassification: 'restricted',
  sensitiveDataAccessed: true,
  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  limit: 1000
});
```

### getUserActivityHistory() - User Profile

```typescript
import { getUserActivityHistory } from './services/auditLogger';

// Get a user's 30-day activity history
const userActivity = await getUserActivityHistory(userId, 30);

userActivity.forEach(log => {
  console.log(`${log.timestamp}: ${log.action} on ${log.entityType}`);
});
```

### getAuditStatistics() - Period Analysis

```typescript
import { getAuditStatistics } from './services/auditLogger';

const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
const endDate = new Date();

const stats = await getAuditStatistics(startDate, endDate);

// Output format:
// [
//   { action: 'read', count: 15230, success_count: 15200, failure_count: 30, sensitive_access_count: 456, unique_users: 234 },
//   { action: 'update', count: 1240, success_count: 1230, failure_count: 10, sensitive_access_count: 0, unique_users: 45 },
//   ...
// ]
```

### detectAnomalies() - Security Monitoring

```typescript
import { detectAnomalies } from './services/auditLogger';

const anomalies = await detectAnomalies(startDate, endDate);

// Example output:
// [
//   {
//     type: 'MULTIPLE_FAILED_LOGINS',
//     severity: 'critical',
//     details: {
//       userId: 'user-123',
//       attempts: 12,
//       lastTimestamp: 2026-08-15T10:30:00Z
//     }
//   },
//   {
//     type: 'UNUSUAL_DATA_ACCESS',
//     severity: 'medium',
//     details: {
//       userId: 'user-456',
//       accessCount: 250,
//       entityTypesAccessed: 8
//     }
//   },
//   ...
// ]
```

---

## Reporting & Compliance

### generateAuditReport() - Comprehensive Reports

```typescript
import { generateAuditReport } from './services/auditLogger';

// Generate compliance report
const report = await generateAuditReport(
  'compliance',  // Type: 'admin' | 'compliance' | 'security' | 'activity'
  startDate,
  endDate,
  adminUserId,
  true  // Sign report with digital signature
);

// Report structure:
// {
//   id: UUID,
//   generatedAt: Date,
//   reportType: 'compliance',
//   startDate: Date,
//   endDate: Date,
//   totalEntries: 45230,
//   summary: {
//     actionBreakdown: { read: 40000, update: 3000, create: 1500, delete: 300, auth: 430 },
//     userBreakdown: { 'user-1': 5000, 'user-2': 3200, ... },
//     failureCount: 45,
//     successCount: 45185,
//     sensitiveDataAccessCount: 1230,
//     topUsers: [...],
//     topEntities: [...],
//     topLocations: [...]
//   },
//   anomalies: [...],
//   generatedBy: UUID
// }
```

### exportAuditLogs() - Data Export

```typescript
import { exportAuditLogs } from './services/auditLogger';

// Export to JSON
await exportAuditLogs(
  {
    userId: 'user-123',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
  },
  'json',
  '/exports/audit-logs-user-123.json'
);

// Export to CSV (compliance-friendly format)
await exportAuditLogs(
  {
    dataClassification: 'restricted',
    startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
  },
  'csv',
  '/exports/restricted-data-access.csv'
);

// Export to PDF (for printing/archiving)
await exportAuditLogs(
  {
    entityType: 'case',
    entityId: 'case-456',
  },
  'pdf',
  '/exports/case-456-audit-trail.pdf'
);
```

### getComplianceReport() - Legal Holds

```typescript
import { getComplianceReport } from './services/auditLogger';

const report = await getComplianceReport(startDate, endDate);

// Output:
// {
//   reportId: UUID,
//   period: { start: Date, end: Date },
//   totalActionsLogged: 45230,
//   userCount: 234,
//   failureRate: "0.10%",
//   sensitiveDataAccessCount: 1230,
//   anomalies: [...],
//   generatedAt: Date
// }
```

---

## Retention & Archival

### setRetentionPolicy() - Custom Policies

```typescript
import { setRetentionPolicy } from './services/auditLogger';

// Set 5-year retention for internal data
await setRetentionPolicy(
  'internal',
  1825,  // days
  'archive',
  adminUserId
);

// Set permanent deletion for public data after 6 months
await setRetentionPolicy(
  'public',
  180,  // days
  'permanent_delete',
  adminUserId
);

// Set anonymization for old confidential data
await setRetentionPolicy(
  'confidential',
  1095,  // 3 years
  'anonymize',
  adminUserId
);
```

### archiveOldLogs() - Automated Archival

```typescript
import { archiveOldLogs } from './services/auditLogger';

// Run nightly or as a scheduled task
const result = await archiveOldLogs();

console.log(`Archived ${result.archived} logs, deleted ${result.deleted} logs`);

// Schedule using node-cron
import cron from 'node-cron';

// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  try {
    const result = await archiveOldLogs();
    console.log('Daily archive task completed', result);
  } catch (error) {
    console.error('Archive task failed:', error);
  }
});
```

---

## Entity Audit Trails

### getEntityAuditTrail() - Complete History

```typescript
import { getEntityAuditTrail } from './services/auditLogger';

// Get complete audit trail for a case
const caseTrail = await getEntityAuditTrail('case', 'case-456');

// Output: Array of all actions affecting this case
// [
//   { timestamp: Date, userId: UUID, action: 'create', status: 'success', changes: {...} },
//   { timestamp: Date, userId: UUID, action: 'update', status: 'success', changes: {...} },
//   { timestamp: Date, userId: UUID, action: 'access', status: 'success', ... },
//   ...
// ]

// Display timeline
caseTrail.forEach(log => {
  const change = log.action === 'update' ? ` (${log.changes?.fields_modified?.join(', ')})` : '';
  console.log(`${log.timestamp.toISOString()} | ${log.action}${change} | ${log.status}`);
});
```

---

## Admin Dashboard Integration

### getAuditLogHealthCheck() - System Status

```typescript
import { getAuditLogHealthCheck } from './services/auditLogger';

const health = await getAuditLogHealthCheck();

// Output:
// {
//   total_logs: 1250000,
//   unique_users: 450,
//   oldest_log: 2019-08-15T00:00:00Z,
//   latest_log: 2026-08-15T14:30:00Z,
//   total_failures: 230,
//   archived_logs: 850000,
//   policies_count: 4
// }
```

---

## API Endpoints (Recommended)

Create the following REST endpoints for admin access:

```typescript
// GET /api/admin/audit/logs - Search logs
// Query: userId, action, entityType, startDate, endDate, limit, offset

// GET /api/admin/audit/logs/:id - Get specific log

// GET /api/admin/audit/user/:userId/activity - User activity

// GET /api/admin/audit/entity/:entityType/:entityId - Entity audit trail

// GET /api/admin/audit/anomalies - Recent anomalies

// POST /api/admin/audit/report - Generate report
// Body: { reportType, startDate, endDate, signReport }

// POST /api/admin/audit/export - Export logs
// Body: { filters, format: 'json'|'csv'|'pdf' }

// GET /api/admin/audit/stats - Statistics

// GET /api/admin/audit/health - System health
```

---

## Security Best Practices

### 1. Access Control
- Restrict audit log access to admins/compliance teams
- Use role-based access control (RBAC)
- Implement IP whitelisting for audit dashboard

### 2. Immutability
- The database constraint ensures logs cannot be updated/deleted
- Archive to immutable storage after retention period
- Consider write-once storage (WORM) for long-term archival

### 3. Encryption
- Encrypt logs in transit (TLS)
- Consider encrypting sensitive fields at rest
- Use encrypted backups

### 4. Monitoring
- Set up alerts for anomalies
- Monitor failed authentication attempts
- Track unusual data access patterns
- Alert on permission changes

### 5. Retention
- Automatically archive logs after 7 years
- Maintain legal holds on specific logs
- Document retention policy approvals
- Regular compliance audits

---

## Performance Optimization

### Indexes
All performance-critical paths are indexed:
- User ID lookups
- Timestamp range queries
- Entity type and ID searches
- Composite indexes for common patterns

### Archival
- Archive old logs to separate table for faster main table queries
- Compress archive data for storage efficiency
- Consider partitioning by date for very large deployments

### Retention
Run archival jobs during off-peak hours:
```typescript
// Nightly archival
cron.schedule('0 2 * * *', () => archiveOldLogs());
```

---

## Troubleshooting

### High Disk Usage
- Check if archival jobs are running
- Review retention policies
- Consider permanent deletion for non-critical logs

### Slow Queries
- Verify indexes are created
- Use EXPLAIN ANALYZE on slow queries
- Consider log partitioning for tables over 1GB

### Missing Logs
- Verify middleware is properly installed
- Check database connection
- Review anomaly detection for unusual patterns

---

## Compliance Checklists

### HIPAA Compliance (if handling health data)
- [x] Audit logs capture all PHI access
- [x] Immutable logging prevents tampering
- [x] 6-year retention policy (extended to 7 for legal)
- [x] Export capability for breach investigation
- [x] Anomaly detection for unusual access

### GDPR Compliance (if handling EU data)
- [x] User can request their audit logs
- [x] Right to be forgotten support (anonymization)
- [x] Data access logs for transparency
- [x] Breach notification support via anomaly detection

### SOC 2 Compliance
- [x] Comprehensive action logging
- [x] Tamper-proof audit trail
- [x] Access control verification
- [x] Regular compliance reports

---

## Support & Maintenance

### Regular Tasks
- Weekly: Review anomaly reports
- Monthly: Generate compliance reports
- Quarterly: Audit retention policy compliance
- Annually: Review retention policies with legal

### Testing
```bash
# Test audit logging
npm run test -- services/auditLogger.test.ts

# Load test
npm run test:load -- --duration 3600 --requests-per-second 1000
```

---

## Questions?

Contact the security/compliance team for:
- Retention policy questions
- Anomaly investigation support
- Export requests
- Compliance reporting needs
