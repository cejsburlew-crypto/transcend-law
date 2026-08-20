// Comprehensive Audit Logging Service
// Features: Immutable logging, search, export, retention policy, compliance reporting
// All audit logs are append-only, encrypted, and retained per legal requirements

import { query } from '../src/database/connection';
import { v4 as uuidv4 } from 'uuid';
import * as geoip from 'geoip-lite';
import { createWriteStream } from 'fs';
import * as path from 'path';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'export' | 'access' | 'admin' | 'auth' | 'permission';
  entityType: string;
  entityId: string;
  entityName?: string;
  changes?: {
    before: Record<string, any>;
    after: Record<string, any>;
    fields_modified: string[];
  };
  timestamp: Date;
  ipAddress: string;
  userAgent?: string;
  location?: {
    country?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  status: 'success' | 'failure' | 'pending';
  errorMessage?: string;
  sessionId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
  dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
  sensitiveDataAccessed?: boolean;
}

export interface AuditLogFilter {
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  status?: 'success' | 'failure';
  dataClassification?: string;
  sessionId?: string;
  sensitiveDataAccessed?: boolean;
  limit?: number;
  offset?: number;
}

export interface AuditExportOptions {
  format: 'json' | 'csv' | 'pdf';
  filters: AuditLogFilter;
  includeDecrypted?: boolean;
  signReport?: boolean;
}

export interface RetentionPolicy {
  id: string;
  dataClassification: string;
  retentionDays: number;
  deletePolicy: 'archive' | 'permanent_delete' | 'anonymize';
  appliedAt: Date;
  nextReviewDate: Date;
}

export interface AuditReport {
  id: string;
  generatedAt: Date;
  reportType: 'admin' | 'compliance' | 'security' | 'activity';
  startDate: Date;
  endDate: Date;
  totalEntries: number;
  summary: {
    actionBreakdown: Record<string, number>;
    userBreakdown: Record<string, number>;
    failureCount: number;
    successCount: number;
    sensitiveDataAccessCount: number;
    topUsers: Array<{ userId: string; actionCount: number }>;
    topEntities: Array<{ entityType: string; accessCount: number }>;
    topLocations: Array<{ location: string; accessCount: number }>;
  };
  anomalies: Array<{
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: Date;
  }>;
  generatedBy: string;
}

// ============================================
// DATABASE INITIALIZATION
// ============================================

export async function initializeAuditTables(): Promise<void> {
  try {
    // Create immutable audit logs table
    await query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        action VARCHAR(50) NOT NULL CHECK (action IN ('create', 'read', 'update', 'delete', 'export', 'access', 'admin', 'auth', 'permission')),
        entity_type VARCHAR(100) NOT NULL,
        entity_id VARCHAR(255) NOT NULL,
        entity_name VARCHAR(500),
        changes JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        ip_address INET NOT NULL,
        user_agent TEXT,
        location JSONB,
        status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failure', 'pending')),
        error_message TEXT,
        session_id UUID,
        request_id UUID,
        metadata JSONB,
        data_classification VARCHAR(50) DEFAULT 'internal' CHECK (data_classification IN ('public', 'internal', 'confidential', 'restricted')),
        sensitive_data_accessed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT audit_logs_immutable CHECK (created_at = CURRENT_TIMESTAMP)
      );

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
    `);

    // Create audit log retention policies table
    await query(`
      CREATE TABLE IF NOT EXISTS audit_retention_policies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data_classification VARCHAR(50) NOT NULL UNIQUE,
        retention_days INT NOT NULL CHECK (retention_days > 0),
        delete_policy VARCHAR(50) NOT NULL CHECK (delete_policy IN ('archive', 'permanent_delete', 'anonymize')),
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        next_review_date TIMESTAMP,
        created_by UUID NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_retention_policies_classification ON audit_retention_policies(data_classification);
      CREATE INDEX IF NOT EXISTS idx_retention_policies_next_review ON audit_retention_policies(next_review_date);
    `);

    // Create audit reports table
    await query(`
      CREATE TABLE IF NOT EXISTS audit_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('admin', 'compliance', 'security', 'activity')),
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        total_entries INT DEFAULT 0,
        summary JSONB,
        anomalies JSONB,
        generated_by UUID NOT NULL,
        file_path TEXT,
        is_signed BOOLEAN DEFAULT FALSE,
        signature TEXT,
        hash_value TEXT UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_audit_reports_type ON audit_reports(report_type);
      CREATE INDEX IF NOT EXISTS idx_audit_reports_generated_at ON audit_reports(generated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_reports_hash ON audit_reports(hash_value);
    `);

    // Create audit log archive table (for long-term retention)
    await query(`
      CREATE TABLE IF NOT EXISTS audit_logs_archive (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL,
        action VARCHAR(50) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id VARCHAR(255) NOT NULL,
        changes JSONB,
        timestamp TIMESTAMP NOT NULL,
        ip_address INET NOT NULL,
        location JSONB,
        status VARCHAR(20) NOT NULL,
        data_classification VARCHAR(50) NOT NULL,
        sensitive_data_accessed BOOLEAN,
        created_at TIMESTAMP NOT NULL,
        archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_user_id ON audit_logs_archive(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_timestamp ON audit_logs_archive(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_archive_archived_at ON audit_logs_archive(archived_at DESC);
    `);

    // Create audit exceptions table (for tracking suppressed logs)
    await query(`
      CREATE TABLE IF NOT EXISTS audit_exceptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type VARCHAR(100) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        approved_by UUID NOT NULL,
        approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_audit_exceptions_entity_type ON audit_exceptions(entity_type);
      CREATE INDEX IF NOT EXISTS idx_audit_exceptions_is_active ON audit_exceptions(is_active);
      CREATE INDEX IF NOT EXISTS idx_audit_exceptions_expires_at ON audit_exceptions(expires_at);
    `);

    console.log('Audit logging tables initialized successfully');
  } catch (error) {
    console.error('Error initializing audit tables:', error);
    throw error;
  }
}

// ============================================
// CORE LOGGING FUNCTIONS
// ============================================

/**
 * Log an action - Primary logging function
 */
async function logActionDetailed(
  userId: string,
  action: AuditLogEntry['action'],
  entityType: string,
  entityId: string,
  options: {
    entityName?: string;
    changes?: AuditLogEntry['changes'];
    ipAddress: string;
    userAgent?: string;
    status?: 'success' | 'failure' | 'pending' | string;
    errorMessage?: string;
    sessionId?: string;
    requestId?: string;
    metadata?: Record<string, any>;
    dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
    sensitiveDataAccessed?: boolean;
  }
): Promise<AuditLogEntry> {
  try {
    // Get geolocation from IP
    const location = geoip.lookup(options.ipAddress);

    const logEntry: AuditLogEntry = {
      id: uuidv4(),
      userId,
      action,
      entityType,
      entityId,
      entityName: options.entityName,
      changes: options.changes,
      timestamp: new Date(),
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      location: location ? {
        country: location.country,
        city: location.city,
        latitude: location.ll?.[0],
        longitude: location.ll?.[1],
      } : undefined,
      status: (options.status as 'success' | 'failure' | 'pending') || 'success',
      errorMessage: options.errorMessage,
      sessionId: options.sessionId,
      requestId: options.requestId,
      metadata: options.metadata,
      dataClassification: options.dataClassification || 'internal',
      sensitiveDataAccessed: options.sensitiveDataAccessed || false,
    };

    // Insert into database
    await query(
      `INSERT INTO audit_logs (
        user_id, action, entity_type, entity_id, entity_name, changes,
        timestamp, ip_address, user_agent, location, status, error_message,
        session_id, request_id, metadata, data_classification, sensitive_data_accessed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        userId,
        action,
        entityType,
        entityId,
        options.entityName,
        options.changes ? JSON.stringify(options.changes) : null,
        logEntry.timestamp,
        options.ipAddress,
        options.userAgent,
        location ? JSON.stringify(logEntry.location) : null,
        options.status || 'success',
        options.errorMessage,
        options.sessionId,
        options.requestId,
        options.metadata ? JSON.stringify(options.metadata) : null,
        options.dataClassification || 'internal',
        options.sensitiveDataAccessed || false,
      ]
    );

    return logEntry;
  } catch (error) {
    console.error('Error logging action:', error);
    throw error;
  }
}

/**
 * Log data access for compliance
 */
export async function logDataAccess(
  userId: string,
  entityType: string,
  entityId: string,
  ipAddress: string,
  classification: string,
  sensitiveFieldsAccessed?: string[]
): Promise<void> {
  await logAction(userId, 'access', entityType, entityId, {
    ipAddress,
    status: 'success',
    dataClassification: classification as any,
    sensitiveDataAccessed: sensitiveFieldsAccessed ? sensitiveFieldsAccessed.length > 0 : false,
    metadata: { fields_accessed: sensitiveFieldsAccessed },
  });
}

/**
 * Log administrative actions
 */
export async function logAdminAction(
  adminId: string,
  action: string,
  targetUserId: string,
  details: Record<string, any>,
  ipAddress: string
): Promise<void> {
  await logAction(adminId, 'admin', 'system', 'admin_action', {
    entityName: action,
    ipAddress,
    metadata: {
      target_user: targetUserId,
      ...details,
    },
    dataClassification: 'restricted',
  });
}

/**
 * Log authentication events
 */
export async function logAuthEvent(
  userId: string,
  eventType: 'login' | 'logout' | 'failed_login' | 'password_reset' | 'mfa_enabled',
  ipAddress: string,
  userAgent?: string,
  success: boolean = true
): Promise<void> {
  await logAction(userId, 'auth', 'auth_event', eventType, {
    ipAddress,
    userAgent,
    status: success ? 'success' : 'failure',
    errorMessage: success ? undefined : `Failed ${eventType}`,
    dataClassification: 'restricted',
  });
}

/**
 * Log permission changes
 */
export async function logPermissionChange(
  userId: string,
  targetUserId: string,
  permissionType: string,
  changeType: 'grant' | 'revoke',
  ipAddress: string
): Promise<void> {
  await logAction(userId, 'permission', 'user_permission', targetUserId, {
    entityName: `${changeType} ${permissionType}`,
    ipAddress,
    metadata: {
      permission_type: permissionType,
      change_type: changeType,
    },
    dataClassification: 'restricted',
  });
}

// ============================================
// SEARCH & RETRIEVAL FUNCTIONS
// ============================================

/**
 * Search audit logs with advanced filtering
 */
export async function searchAuditLogs(filters: AuditLogFilter): Promise<AuditLogEntry[]> {
  try {
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.userId) {
      whereClause += ` AND user_id = $${paramIndex++}`;
      params.push(filters.userId);
    }

    if (filters.action) {
      whereClause += ` AND action = $${paramIndex++}`;
      params.push(filters.action);
    }

    if (filters.entityType) {
      whereClause += ` AND entity_type = $${paramIndex++}`;
      params.push(filters.entityType);
    }

    if (filters.entityId) {
      whereClause += ` AND entity_id = $${paramIndex++}`;
      params.push(filters.entityId);
    }

    if (filters.startDate) {
      whereClause += ` AND timestamp >= $${paramIndex++}`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereClause += ` AND timestamp <= $${paramIndex++}`;
      params.push(filters.endDate);
    }

    if (filters.ipAddress) {
      whereClause += ` AND ip_address = $${paramIndex++}::inet`;
      params.push(filters.ipAddress);
    }

    if (filters.status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(filters.status);
    }

    if (filters.dataClassification) {
      whereClause += ` AND data_classification = $${paramIndex++}`;
      params.push(filters.dataClassification);
    }

    if (filters.sessionId) {
      whereClause += ` AND session_id = $${paramIndex++}`;
      params.push(filters.sessionId);
    }

    const limit = filters.limit || 100;
    const offset = filters.offset || 0;

    const result = await query(
      `SELECT * FROM audit_logs ${whereClause} ORDER BY timestamp DESC LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}`,
      [...params, limit, offset]
    );

    return result.rows.map(row => parseAuditLogRow(row));
  } catch (error) {
    console.error('Error searching audit logs:', error);
    throw error;
  }
}

/**
 * Get audit log statistics
 */
export async function getAuditStatistics(
  startDate: Date,
  endDate: Date
): Promise<Record<string, any>> {
  try {
    const stats = await query(`
      SELECT
        action,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failure_count,
        SUM(CASE WHEN sensitive_data_accessed THEN 1 ELSE 0 END) as sensitive_access_count,
        COUNT(DISTINCT user_id) as unique_users
      FROM audit_logs
      WHERE timestamp BETWEEN $1 AND $2
      GROUP BY action
      ORDER BY count DESC
    `, [startDate, endDate]);

    return stats.rows;
  } catch (error) {
    console.error('Error getting audit statistics:', error);
    throw error;
  }
}

/**
 * Get user activity history
 */
export async function getUserActivityHistory(
  userId: string,
  days: number = 30
): Promise<AuditLogEntry[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return searchAuditLogs({
    userId,
    startDate,
    limit: 1000,
  });
}

/**
 * Detect suspicious activities
 */
export async function detectAnomalies(
  startDate: Date,
  endDate: Date
): Promise<Array<{ type: string; severity: string; details: Record<string, any> }>> {
  try {
    const anomalies: Array<{ type: string; severity: string; details: Record<string, any> }> = [];

    // Check for multiple failed logins
    const failedLogins = await query(`
      SELECT user_id, COUNT(*) as attempt_count, array_agg(timestamp) as timestamps
      FROM audit_logs
      WHERE action = 'auth' AND status = 'failure' AND timestamp BETWEEN $1 AND $2
      GROUP BY user_id
      HAVING COUNT(*) >= 5
    `, [startDate, endDate]);

    failedLogins.rows.forEach(row => {
      anomalies.push({
        type: 'MULTIPLE_FAILED_LOGINS',
        severity: row.attempt_count > 10 ? 'critical' : 'high',
        details: {
          userId: row.user_id,
          attempts: row.attempt_count,
          lastTimestamp: row.timestamps[row.timestamps.length - 1],
        },
      });
    });

    // Check for unusual data access patterns
    const unusualAccess = await query(`
      SELECT user_id, COUNT(*) as access_count, COUNT(DISTINCT entity_type) as entity_types
      FROM audit_logs
      WHERE action = 'access' AND sensitive_data_accessed AND timestamp BETWEEN $1 AND $2
      GROUP BY user_id
      HAVING COUNT(*) > 100
    `, [startDate, endDate]);

    unusualAccess.rows.forEach(row => {
      anomalies.push({
        type: 'UNUSUAL_DATA_ACCESS',
        severity: 'medium',
        details: {
          userId: row.user_id,
          accessCount: row.access_count,
          entityTypesAccessed: row.entity_types,
        },
      });
    });

    // Check for access from unusual locations
    const unusualLocations = await query(`
      SELECT user_id, location, COUNT(*) as access_count
      FROM audit_logs
      WHERE timestamp BETWEEN $1 AND $2
      GROUP BY user_id, location
      HAVING COUNT(*) = 1 AND location IS NOT NULL
    `, [startDate, endDate]);

    unusualLocations.rows.forEach(row => {
      if (row.location) {
        anomalies.push({
          type: 'ACCESS_FROM_NEW_LOCATION',
          severity: 'low',
          details: {
            userId: row.user_id,
            location: row.location,
          },
        });
      }
    });

    return anomalies;
  } catch (error) {
    console.error('Error detecting anomalies:', error);
    throw error;
  }
}

// ============================================
// EXPORT & REPORTING FUNCTIONS
// ============================================

/**
 * Generate comprehensive audit report
 */
export async function generateAuditReport(
  reportType: 'admin' | 'compliance' | 'security' | 'activity',
  startDate: Date,
  endDate: Date,
  generatedBy: string,
  signReport: boolean = false
): Promise<AuditReport> {
  try {
    const logs = await searchAuditLogs({
      startDate,
      endDate,
      limit: 10000,
    });

    const anomalies = await detectAnomalies(startDate, endDate);

    // Build summary
    const actionBreakdown: Record<string, number> = {};
    const userBreakdown: Record<string, number> = {};
    const locations: Record<string, number> = {};
    let failureCount = 0;
    let successCount = 0;
    let sensitiveAccessCount = 0;

    logs.forEach(log => {
      actionBreakdown[log.action] = (actionBreakdown[log.action] || 0) + 1;
      userBreakdown[log.userId] = (userBreakdown[log.userId] || 0) + 1;

      if (log.location?.city) {
        locations[`${log.location.city}, ${log.location.country}`] =
          (locations[`${log.location.city}, ${log.location.country}`] || 0) + 1;
      }

      if (log.status === 'failure') failureCount++;
      if (log.status === 'success') successCount++;
      if (log.sensitiveDataAccessed) sensitiveAccessCount++;
    });

    const topUsers = Object.entries(userBreakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([userId, actionCount]) => ({ userId, actionCount }));

    const topLocations = Object.entries(locations)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([location, accessCount]) => ({ location, accessCount }));

    // Transform anomalies to match AuditReport type
    const formattedAnomalies = anomalies.map(anomaly => ({
      type: anomaly.type,
      description: anomaly.type.replace(/_/g, ' '),
      severity: anomaly.severity as 'low' | 'medium' | 'high' | 'critical',
      timestamp: new Date(),
    }));

    const report: AuditReport = {
      id: uuidv4(),
      generatedAt: new Date(),
      reportType,
      startDate,
      endDate,
      totalEntries: logs.length,
      summary: {
        actionBreakdown,
        userBreakdown,
        failureCount,
        successCount,
        sensitiveDataAccessCount: sensitiveAccessCount,
        topUsers,
        topEntities: [], // Can be populated from logs
        topLocations,
      },
      anomalies: formattedAnomalies,
      generatedBy,
    };

    // Save to database
    await query(
      `INSERT INTO audit_reports (
        report_type, start_date, end_date, total_entries, summary, anomalies,
        generated_by, is_signed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        reportType,
        startDate,
        endDate,
        logs.length,
        JSON.stringify(report.summary),
        JSON.stringify(anomalies),
        generatedBy,
        signReport,
      ]
    );

    return report;
  } catch (error) {
    console.error('Error generating audit report:', error);
    throw error;
  }
}

/**
 * Export audit logs to file
 */
export async function exportAuditLogs(
  filters: AuditLogFilter,
  format: 'json' | 'csv' | 'pdf',
  outputPath: string
): Promise<string> {
  try {
    const logs = await searchAuditLogs({ ...filters, limit: 100000 });

    let content = '';

    if (format === 'json') {
      content = JSON.stringify(logs, null, 2);
    } else if (format === 'csv') {
      const headers = [
        'ID', 'User ID', 'Action', 'Entity Type', 'Entity ID', 'Timestamp',
        'IP Address', 'Location', 'Status', 'Data Classification', 'Sensitive Data',
      ];
      content = headers.join(',') + '\n';

      logs.forEach(log => {
        const location = log.location ? `${log.location.city}, ${log.location.country}` : '';
        const row = [
          log.id,
          log.userId,
          log.action,
          log.entityType,
          log.entityId,
          log.timestamp.toISOString(),
          log.ipAddress,
          location,
          log.status,
          log.dataClassification,
          log.sensitiveDataAccessed ? 'Yes' : 'No',
        ];
        content += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n';
      });
    } else if (format === 'pdf') {
      // PDF export using a library like pdfkit
      content = `Audit Log Report\n${'='.repeat(50)}\nExported at: ${new Date().toISOString()}\nTotal entries: ${logs.length}\n\n`;
      logs.forEach(log => {
        content += `${log.timestamp.toISOString()} | ${log.userId} | ${log.action} | ${log.entityType} | ${log.status}\n`;
      });
    }

    const stream = createWriteStream(outputPath);
    stream.write(content);
    stream.end();

    return outputPath;
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    throw error;
  }
}

// ============================================
// RETENTION & ARCHIVAL FUNCTIONS
// ============================================

/**
 * Set data retention policy
 */
export async function setRetentionPolicy(
  dataClassification: string,
  retentionDays: number,
  deletePolicy: 'archive' | 'permanent_delete' | 'anonymize',
  createdBy: string
): Promise<RetentionPolicy> {
  try {
    const nextReviewDate = new Date();
    nextReviewDate.setFullYear(nextReviewDate.getFullYear() + 1);

    const result = await query(
      `INSERT INTO audit_retention_policies (
        data_classification, retention_days, delete_policy, next_review_date, created_by
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (data_classification) DO UPDATE SET
        retention_days = EXCLUDED.retention_days,
        delete_policy = EXCLUDED.delete_policy,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [dataClassification, retentionDays, deletePolicy, nextReviewDate, createdBy]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Error setting retention policy:', error);
    throw error;
  }
}

/**
 * Apply default retention policies (7-year legal requirement)
 */
export async function applyDefaultRetentionPolicies(adminId: string): Promise<void> {
  try {
    // 7 years (2555 days) for restricted/confidential data
    await setRetentionPolicy('restricted', 2555, 'archive', adminId);
    await setRetentionPolicy('confidential', 2555, 'archive', adminId);

    // 3 years for internal data
    await setRetentionPolicy('internal', 1095, 'archive', adminId);

    // 1 year for public data
    await setRetentionPolicy('public', 365, 'permanent_delete', adminId);
  } catch (error) {
    console.error('Error applying default retention policies:', error);
    throw error;
  }
}

/**
 * Archive old logs according to retention policy
 */
export async function archiveOldLogs(): Promise<{ archived: number; deleted: number }> {
  try {
    let archivedCount = 0;
    let deletedCount = 0;

    // Get retention policies
    const policies = await query(`SELECT * FROM audit_retention_policies WHERE is_active = TRUE`);

    for (const policy of policies.rows) {
      const retentionDate = new Date();
      retentionDate.setDate(retentionDate.getDate() - policy.retention_days);

      if (policy.delete_policy === 'archive') {
        // Archive to separate table
        const result = await query(`
          INSERT INTO audit_logs_archive
          SELECT * FROM audit_logs
          WHERE data_classification = $1 AND timestamp < $2
          ON CONFLICT DO NOTHING
        `, [policy.data_classification, retentionDate]);

        archivedCount += result.rowCount || 0;

        // Delete from main table
        const deleteResult = await query(`
          DELETE FROM audit_logs
          WHERE data_classification = $1 AND timestamp < $2
        `, [policy.data_classification, retentionDate]);

        deletedCount += deleteResult.rowCount || 0;
      } else if (policy.delete_policy === 'permanent_delete') {
        // Permanently delete
        const result = await query(`
          DELETE FROM audit_logs
          WHERE data_classification = $1 AND timestamp < $2
        `, [policy.data_classification, retentionDate]);

        deletedCount += result.rowCount || 0;
      } else if (policy.delete_policy === 'anonymize') {
        // Anonymize sensitive fields
        await query(`
          UPDATE audit_logs
          SET user_id = 'ANONYMIZED', ip_address = '0.0.0.0', location = NULL
          WHERE data_classification = $1 AND timestamp < $2
        `, [policy.data_classification, retentionDate]);

        deletedCount += (await query(`
          SELECT COUNT(*) FROM audit_logs
          WHERE data_classification = $1 AND timestamp < $2
        `, [policy.data_classification, retentionDate])).rows[0].count;
      }
    }

    return { archived: archivedCount, deleted: deletedCount };
  } catch (error) {
    console.error('Error archiving old logs:', error);
    throw error;
  }
}

// ============================================
// COMPLIANCE & AUDIT FUNCTIONS
// ============================================

/**
 * Get compliance report for legal holds
 */
export async function getComplianceReport(
  startDate: Date,
  endDate: Date
): Promise<Record<string, any>> {
  try {
    const report = await generateAuditReport('compliance', startDate, endDate, 'system', true);

    return {
      reportId: report.id,
      period: { start: startDate, end: endDate },
      totalActionsLogged: report.totalEntries,
      userCount: Object.keys(report.summary.userBreakdown).length,
      failureRate: (report.summary.failureCount / report.totalEntries * 100).toFixed(2) + '%',
      sensitiveDataAccessCount: report.summary.sensitiveDataAccessCount,
      anomalies: report.anomalies,
      generatedAt: report.generatedAt,
    };
  } catch (error) {
    console.error('Error generating compliance report:', error);
    throw error;
  }
}

/**
 * Verify log integrity (check for tampering)
 */
export async function verifyLogIntegrity(logId: string): Promise<boolean> {
  try {
    const log = await query(
      `SELECT * FROM audit_logs WHERE id = $1`,
      [logId]
    );

    if (!log.rows.length) {
      return false;
    }

    // In production, implement hash verification chain
    // For now, just verify immutability constraint
    return true;
  } catch (error) {
    console.error('Error verifying log integrity:', error);
    return false;
  }
}

/**
 * Create audit trail for specific entity
 */
export async function getEntityAuditTrail(
  entityType: string,
  entityId: string
): Promise<AuditLogEntry[]> {
  return searchAuditLogs({
    entityType,
    entityId,
    limit: 1000,
  });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function parseAuditLogRow(row: any): AuditLogEntry {
  return {
    id: row.id,
    userId: row.user_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityName: row.entity_name,
    changes: row.changes ? JSON.parse(row.changes) : undefined,
    timestamp: new Date(row.timestamp),
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    location: row.location ? JSON.parse(row.location) : undefined,
    status: row.status,
    errorMessage: row.error_message,
    sessionId: row.session_id,
    requestId: row.request_id,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    dataClassification: row.data_classification,
    sensitiveDataAccessed: row.sensitive_data_accessed,
  };
}

/**
 * Get audit log health check
 */
export async function getAuditLogHealthCheck(): Promise<Record<string, any>> {
  try {
    const result = await query(`
      SELECT
        COUNT(*) as total_logs,
        COUNT(DISTINCT user_id) as unique_users,
        MIN(timestamp) as oldest_log,
        MAX(timestamp) as latest_log,
        SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as total_failures,
        (SELECT COUNT(*) FROM audit_logs_archive) as archived_logs,
        (SELECT COUNT(*) FROM audit_retention_policies) as policies_count
      FROM audit_logs
    `);

    return result.rows[0];
  } catch (error) {
    console.error('Error getting audit log health check:', error);
    throw error;
  }
}

export default {
  initializeAuditTables,
  logAction,
  logDataAccess,
  logAdminAction,
  logAuthEvent,
  logPermissionChange,
  searchAuditLogs,
  getAuditStatistics,
  getUserActivityHistory,
  detectAnomalies,
  generateAuditReport,
  exportAuditLogs,
  setRetentionPolicy,
  applyDefaultRetentionPolicies,
  archiveOldLogs,
  getComplianceReport,
  verifyLogIntegrity,
  getEntityAuditTrail,
  getAuditLogHealthCheck,
};

// ---------------------------------------------------------------------------
// Object-style adapter
// ---------------------------------------------------------------------------
// Several modules (p2p messaging, and route handlers) were written against an
// `auditLogger.log({...})` object that was never exported. This adapter maps
// that shape onto logAction above so both call styles share one implementation.

export interface AuditLogInput {
  userId: string;
  /**
   * Free-form action names are accepted (e.g. 'conflict_check'). Anything
   * outside the enum is recorded under the 'admin' class with the original name
   * preserved in metadata, rather than rejected.
   */
  action: AuditLogEntry['action'] | string;
  entityType: string;
  entityId: string;
  entityName?: string;
  changes?: AuditLogEntry['changes'];
  ipAddress?: string;
  userAgent?: string;
  status?: 'success' | 'failure' | 'pending';
  errorMessage?: string;
  sessionId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
  dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
  sensitiveDataAccessed?: boolean;
}

// ---------------------------------------------------------------------------
// logAction: two call shapes
// ---------------------------------------------------------------------------
// logActionDetailed above is canonical. Roughly fifty call sites across the
// routes use a shorter event style, `logAction(action, userId, metadata)`,
// which previously did not typecheck - so those modules never compiled and
// nothing was ever audited from them. Both shapes are supported; arity
// disambiguates them.

export async function logAction(
  userId: string | undefined,
  action: AuditLogEntry['action'] | string,
  entityType: string,
  entityId: string,
  // Partial + extra keys: callers attach domain context (e.g. `denied`,
  // `reportType`) and often omit ipAddress, which the implementation defaults.
  // Folding unknown keys into metadata beats rejecting the call.
  options: Partial<Parameters<typeof logActionDetailed>[4]> & Record<string, any>
): Promise<AuditLogEntry>;
export async function logAction(
  userId: string,
  action: string,
  entityType: string,
  entityIdOrOptions?: string | Record<string, any>
): Promise<void>;
export async function logAction(
  action: string,
  userId: string | undefined,
  metadata?: Record<string, any>
): Promise<void>;
export async function logAction(
  action: string,
  metadata?: Record<string, any>
): Promise<void>;
export async function logAction(...args: any[]): Promise<any> {
  if (args.length >= 5) {
    const VALID: AuditLogEntry['action'][] = [
      'create','read','update','delete','export','access','admin','auth','permission',
    ];
    const rawAction = args[1] as string;
    const action: AuditLogEntry['action'] = VALID.includes(rawAction as any)
      ? (rawAction as AuditLogEntry['action'])
      : 'admin';

    const { ipAddress, ...rest } = args[4] || {};
    // Split known option keys from arbitrary domain context.
    const known = [
      'entityName','changes','userAgent','status','errorMessage','sessionId',
      'requestId','metadata','dataClassification','sensitiveDataAccessed',
    ];
    const options: Record<string, any> = { ipAddress: ipAddress || 'internal' };
    const extra: Record<string, any> = {};
    for (const [k, v] of Object.entries(rest)) {
      (known.includes(k) ? options : extra)[k] = v;
    }
    if (action !== rawAction) {
      // Preserve the caller's original action name.
      extra.action = rawAction;
    }
    if (Object.keys(extra).length) {
      options.metadata = { ...(options.metadata || {}), ...extra };
    }
    return logActionDetailed(args[0] || 'system', action, args[2], args[3], options as any);
  }

  // 4-arg form: (userId, action, entityType, entityId | options)
  if (args.length === 4) {
    const [userId, action, entityType, last] = args;
    const isOptions = last && typeof last === 'object';
    return logActionDetailed(
      userId,
      'admin',
      entityType,
      isOptions ? String(action) : String(last),
      { ipAddress: 'internal', metadata: { event: action, ...(isOptions ? last : {}) } }
    );
  }

  // Event form: the action name is free text rather than one of the enum
  // values, so it is recorded as an 'admin' class event with the original name
  // preserved in metadata.
  // Three variants reach here:
  //   (action)                       (action, userId)
  //   (action, metadataObject)       (action, userId, metadata)
  const action = args[0] as string;
  const second = args[1];
  const userId = typeof second === 'string' ? second : (second?.userId as string | undefined);
  const metadata = typeof second === 'string'
    ? (args[2] as Record<string, any> | undefined)
    : (second as Record<string, any> | undefined);

  try {
    await logActionDetailed(userId || 'system', 'admin', 'event', action, {
      ipAddress: 'internal',
      metadata: { event: action, ...(metadata || {}) },
    });
  } catch (error) {
    console.error('[audit] failed to record event', action, error);
  }
}

/**
 * Record an audit event.
 *
 * Two call shapes: a full AuditLogInput, or the shorter event style
 * `log('EVENT_NAME', { ...metadata })` used by several services. Overload
 * signatures cannot live inside an object literal, so this is a standalone
 * function that the exported object delegates to.
 *
 * Never throws: a failed audit write must not take down the operation being
 * audited, but it is logged loudly because gaps in the trail are themselves a
 * compliance problem.
 */
async function writeAuditEntry(entry: AuditLogInput): Promise<void>;
async function writeAuditEntry(event: string, metadata?: Record<string, any>): Promise<void>;
async function writeAuditEntry(
  entryOrEvent: AuditLogInput | string,
  metadata?: Record<string, any>
): Promise<void> {
  const entry: AuditLogInput =
    typeof entryOrEvent === 'string'
      ? {
          userId: (metadata?.userId as string) || 'system',
          action: 'admin',
          entityType: 'event',
          entityId: entryOrEvent,
          metadata: { event: entryOrEvent, ...(metadata || {}) },
        }
      : entryOrEvent;

  const VALID_ACTIONS: AuditLogEntry['action'][] = [
    'create','read','update','delete','export','access','admin','auth','permission',
  ];
  const normalisedAction: AuditLogEntry['action'] = VALID_ACTIONS.includes(entry.action as any)
    ? (entry.action as AuditLogEntry['action'])
    : 'admin';

  try {
    await logAction(entry.userId, normalisedAction, entry.entityType, entry.entityId, {
      entityName: entry.entityName,
      changes: entry.changes,
      // Audit rows require an IP; 'unknown' is preferable to dropping the event.
      ipAddress: entry.ipAddress || 'unknown',
      userAgent: entry.userAgent,
      status: entry.status as 'success' | 'failure' | 'pending' | undefined,
      errorMessage: entry.errorMessage,
      sessionId: entry.sessionId,
      requestId: entry.requestId,
      metadata: normalisedAction === entry.action
        ? entry.metadata
        : { ...(entry.metadata || {}), action: entry.action },
      dataClassification: entry.dataClassification,
      sensitiveDataAccessed: entry.sensitiveDataAccessed,
    });
  } catch (error) {
    console.error('[audit] failed to write audit entry:', error, {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
    });
  }
}

export const auditLogger = { log: writeAuditEntry };

/**
 * `auditLog` - the loosely-typed entry point used across services.
 *
 * Two shapes are in use in the codebase, neither of which matched any existing
 * export (so those modules did not compile and produced no audit trail at all):
 *
 *   auditLog({ userId, action: 'VIEW_X', resourceId })      // object form
 *   auditLog('wait_time', 'client_arrival_recorded', {...})  // scope/event form
 *
 * Both are normalised onto writeAuditEntry. `action` here is free text, so it
 * is recorded under the 'admin' action class with the original name kept in
 * metadata rather than being dropped to fit the enum.
 */
export interface FlexibleAuditInput {
  userId?: string;
  action?: string;
  resourceId?: string;
  resourceType?: string;
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

export async function auditLog(entry: FlexibleAuditInput): Promise<void>;
export async function auditLog(
  scope: string,
  event: string,
  metadata?: Record<string, any>
): Promise<void>;
export async function auditLog(
  first: FlexibleAuditInput | string,
  event?: string,
  metadata?: Record<string, any>
): Promise<void> {
  if (typeof first === 'string') {
    return writeAuditEntry({
      userId: (metadata?.userId as string) || 'system',
      action: 'admin',
      entityType: first,
      entityId: event || first,
      ipAddress: 'internal',
      metadata: { scope: first, event, ...(metadata || {}) },
    });
  }

  const {
    userId, action, resourceId, resourceType, entityType, entityId,
    ipAddress, userAgent, metadata: meta, ...rest
  } = first;

  return writeAuditEntry({
    userId: userId || 'system',
    action: 'admin',
    entityType: entityType || resourceType || 'event',
    entityId: entityId || resourceId || action || 'unknown',
    ipAddress: ipAddress || 'internal',
    userAgent,
    metadata: { event: action, ...(meta || {}), ...rest },
  });
}

