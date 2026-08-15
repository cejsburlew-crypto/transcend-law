// Comprehensive Audit Logging Tests
// Unit and integration tests for the audit logging system

import {
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
  getEntityAuditTrail,
  getAuditLogHealthCheck,
} from './auditLogger';

describe('Audit Logger Service', () => {
  const testUserId = 'test-user-123';
  const testAdminId = 'admin-456';
  const testIpAddress = '192.168.1.100';
  const testUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

  beforeAll(async () => {
    // Initialize database tables
    await initializeAuditTables();
  });

  describe('Core Logging Functions', () => {
    test('logAction - Create action', async () => {
      const result = await logAction(
        testUserId,
        'create',
        'case',
        'case-001',
        {
          entityName: 'Smith v. Jones',
          ipAddress: testIpAddress,
          userAgent: testUserAgent,
          status: 'success',
          dataClassification: 'confidential',
        }
      );

      expect(result.id).toBeDefined();
      expect(result.userId).toBe(testUserId);
      expect(result.action).toBe('create');
      expect(result.entityType).toBe('case');
      expect(result.status).toBe('success');
    });

    test('logAction - Update action with changes', async () => {
      const result = await logAction(
        testUserId,
        'update',
        'case',
        'case-001',
        {
          ipAddress: testIpAddress,
          changes: {
            before: { status: 'open', budget_max: 5000 },
            after: { status: 'matched', budget_max: 7500 },
            fields_modified: ['status', 'budget_max'],
          },
          status: 'success',
        }
      );

      expect(result.changes).toBeDefined();
      expect(result.changes?.fields_modified).toContain('status');
    });

    test('logAction - Delete action', async () => {
      const result = await logAction(
        testUserId,
        'delete',
        'case',
        'case-002',
        {
          ipAddress: testIpAddress,
          status: 'success',
        }
      );

      expect(result.action).toBe('delete');
    });

    test('logAction - Failed action', async () => {
      const result = await logAction(
        testUserId,
        'access',
        'case',
        'case-003',
        {
          ipAddress: testIpAddress,
          status: 'failure',
          errorMessage: 'Unauthorized access attempt',
        }
      );

      expect(result.status).toBe('failure');
      expect(result.errorMessage).toBeDefined();
    });
  });

  describe('Specialized Logging Functions', () => {
    test('logDataAccess - Sensitive field tracking', async () => {
      await logDataAccess(
        testUserId,
        'user',
        'user-789',
        testIpAddress,
        'confidential',
        ['ssn', 'credit_card', 'bank_account']
      );

      // Search for the log
      const logs = await searchAuditLogs({
        userId: testUserId,
        action: 'access',
        sensitiveDataAccessed: true,
      });

      expect(logs.length).toBeGreaterThan(0);
    });

    test('logAuthEvent - Login success', async () => {
      await logAuthEvent(
        testUserId,
        'login',
        testIpAddress,
        testUserAgent,
        true
      );

      const logs = await searchAuditLogs({
        userId: testUserId,
        action: 'auth',
        status: 'success',
      });

      expect(logs.length).toBeGreaterThan(0);
    });

    test('logAuthEvent - Login failure', async () => {
      await logAuthEvent(
        'unknown-user@example.com',
        'failed_login',
        testIpAddress,
        testUserAgent,
        false
      );

      const logs = await searchAuditLogs({
        action: 'auth',
        status: 'failure',
      });

      expect(logs.length).toBeGreaterThan(0);
    });

    test('logAdminAction - User suspension', async () => {
      await logAdminAction(
        testAdminId,
        'suspend_user',
        testUserId,
        { reason: 'Policy violation', duration: 7 },
        testIpAddress
      );

      const logs = await searchAuditLogs({
        userId: testAdminId,
        action: 'admin',
      });

      expect(logs.length).toBeGreaterThan(0);
    });

    test('logPermissionChange - Grant permission', async () => {
      await logPermissionChange(
        testAdminId,
        testUserId,
        'can_export_data',
        'grant',
        testIpAddress
      );

      const logs = await searchAuditLogs({
        userId: testAdminId,
        action: 'permission',
      });

      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('Search & Retrieval', () => {
    beforeAll(async () => {
      // Create test data
      for (let i = 0; i < 10; i++) {
        await logAction(
          testUserId,
          'read',
          'case',
          `case-${i}`,
          { ipAddress: testIpAddress }
        );
      }
    });

    test('searchAuditLogs - By userId', async () => {
      const logs = await searchAuditLogs({
        userId: testUserId,
        limit: 100,
      });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.every(log => log.userId === testUserId)).toBe(true);
    });

    test('searchAuditLogs - By action', async () => {
      const logs = await searchAuditLogs({
        action: 'read',
        limit: 100,
      });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.every(log => log.action === 'read')).toBe(true);
    });

    test('searchAuditLogs - By entity', async () => {
      const logs = await searchAuditLogs({
        entityType: 'case',
        limit: 100,
      });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.every(log => log.entityType === 'case')).toBe(true);
    });

    test('searchAuditLogs - By date range', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const logs = await searchAuditLogs({
        startDate: yesterday,
        endDate: now,
        limit: 100,
      });

      expect(logs.length).toBeGreaterThanOrEqual(0);
      expect(logs.every(log => log.timestamp >= yesterday && log.timestamp <= now)).toBe(true);
    });

    test('searchAuditLogs - By IP address', async () => {
      const logs = await searchAuditLogs({
        ipAddress: testIpAddress,
        limit: 100,
      });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.every(log => log.ipAddress === testIpAddress)).toBe(true);
    });

    test('getUserActivityHistory', async () => {
      const history = await getUserActivityHistory(testUserId, 30);

      expect(history.length).toBeGreaterThan(0);
      expect(history[0].userId).toBe(testUserId);
    });

    test('getAuditStatistics', async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const stats = await getAuditStatistics(thirtyDaysAgo, now);

      expect(Array.isArray(stats)).toBe(true);
      expect(stats.length).toBeGreaterThan(0);
      expect(stats[0]).toHaveProperty('action');
      expect(stats[0]).toHaveProperty('count');
      expect(stats[0]).toHaveProperty('success_count');
    });
  });

  describe('Anomaly Detection', () => {
    test('detectAnomalies - Multiple failed logins', async () => {
      const ipAddress = '10.0.0.100';

      // Simulate multiple failed login attempts
      for (let i = 0; i < 6; i++) {
        await logAuthEvent(
          'suspicious-user@example.com',
          'failed_login',
          ipAddress,
          testUserAgent,
          false
        );
      }

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const anomalies = await detectAnomalies(oneDayAgo, now);

      const multipleFailures = anomalies.find(
        a => a.type === 'MULTIPLE_FAILED_LOGINS'
      );

      expect(multipleFailures).toBeDefined();
      expect(multipleFailures?.severity).toMatch(/high|critical/);
    });

    test('detectAnomalies - Unusual data access', async () => {
      const userId = `anomaly-test-${Date.now()}`;

      // Simulate heavy data access
      for (let i = 0; i < 101; i++) {
        await logDataAccess(
          userId,
          'case',
          `case-${i}`,
          testIpAddress,
          'confidential'
        );
      }

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const anomalies = await detectAnomalies(oneDayAgo, now);

      const unusualAccess = anomalies.find(
        a => a.type === 'UNUSUAL_DATA_ACCESS'
      );

      expect(unusualAccess).toBeDefined();
      expect(unusualAccess?.severity).toBe('medium');
    });
  });

  describe('Reports & Export', () => {
    test('generateAuditReport - Activity report', async () => {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const report = await generateAuditReport(
        'activity',
        sevenDaysAgo,
        now,
        testAdminId,
        false
      );

      expect(report.id).toBeDefined();
      expect(report.reportType).toBe('activity');
      expect(report.summary).toBeDefined();
      expect(report.summary.actionBreakdown).toBeDefined();
      expect(report.totalEntries).toBeGreaterThanOrEqual(0);
    });

    test('generateAuditReport - Compliance report with signature', async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const report = await generateAuditReport(
        'compliance',
        thirtyDaysAgo,
        now,
        testAdminId,
        true  // signed
      );

      expect(report.reportType).toBe('compliance');
      expect(report.summary).toBeDefined();
      expect(report.anomalies).toBeDefined();
    });

    test('getComplianceReport', async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const complianceReport = await getComplianceReport(thirtyDaysAgo, now);

      expect(complianceReport.reportId).toBeDefined();
      expect(complianceReport.totalActionsLogged).toBeGreaterThanOrEqual(0);
      expect(complianceReport.userCount).toBeGreaterThanOrEqual(0);
      expect(complianceReport.failureRate).toBeDefined();
    });
  });

  describe('Retention & Archival', () => {
    test('setRetentionPolicy - Custom policy', async () => {
      const policy = await setRetentionPolicy(
        'internal',
        1095,
        'archive',
        testAdminId
      );

      expect(policy.id).toBeDefined();
      expect(policy.data_classification).toBe('internal');
      expect(policy.retention_days).toBe(1095);
      expect(policy.delete_policy).toBe('archive');
    });

    test('applyDefaultRetentionPolicies', async () => {
      await applyDefaultRetentionPolicies(testAdminId);

      // Verify policies were set
      const policies = await searchAuditLogs({
        limit: 1000,
      });

      // Should not throw error
      expect(policies).toBeDefined();
    });
  });

  describe('Entity Audit Trails', () => {
    test('getEntityAuditTrail - Case timeline', async () => {
      const caseId = 'case-audit-trail-test';
      const userId1 = 'user-1';
      const userId2 = 'user-2';

      // Create sequence of actions
      await logAction(userId1, 'create', 'case', caseId, {
        ipAddress: testIpAddress,
        entityName: 'Test Case',
      });

      await logAction(userId2, 'update', 'case', caseId, {
        ipAddress: testIpAddress,
        changes: {
          before: { status: 'open' },
          after: { status: 'matched' },
          fields_modified: ['status'],
        },
      });

      const trail = await getEntityAuditTrail('case', caseId);

      expect(trail.length).toBeGreaterThanOrEqual(2);
      expect(trail[0].entityId).toBe(caseId);
      expect(trail.map(t => t.action)).toContain('create');
      expect(trail.map(t => t.action)).toContain('update');
    });
  });

  describe('Health Check', () => {
    test('getAuditLogHealthCheck', async () => {
      const health = await getAuditLogHealthCheck();

      expect(health).toBeDefined();
      expect(health.total_logs).toBeGreaterThanOrEqual(0);
      expect(health.unique_users).toBeGreaterThanOrEqual(0);
      expect(health.oldest_log).toBeDefined();
      expect(health.latest_log).toBeDefined();
    });
  });

  describe('Data Classification', () => {
    test('Log with different classifications', async () => {
      const classifications = ['public', 'internal', 'confidential', 'restricted'];

      for (const classification of classifications) {
        await logAction(
          testUserId,
          'read',
          'data',
          `data-${classification}`,
          {
            ipAddress: testIpAddress,
            dataClassification: classification as any,
          }
        );
      }

      // Verify each was logged
      for (const classification of classifications) {
        const logs = await searchAuditLogs({
          dataClassification: classification,
          limit: 100,
        });

        expect(logs.length).toBeGreaterThan(0);
        expect(logs.every(log => log.dataClassification === classification)).toBe(
          true
        );
      }
    });
  });

  describe('Sensitive Data Tracking', () => {
    test('Log with sensitive data flag', async () => {
      await logAction(
        testUserId,
        'access',
        'user',
        'user-sensitive',
        {
          ipAddress: testIpAddress,
          sensitiveDataAccessed: true,
          metadata: {
            fields: ['ssn', 'credit_card', 'bank_account'],
          },
        }
      );

      const logs = await searchAuditLogs({
        sensitiveDataAccessed: true,
      });

      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    test('searchAuditLogs with pagination', async () => {
      const logs1 = await searchAuditLogs({
        limit: 10,
        offset: 0,
      });

      const logs2 = await searchAuditLogs({
        limit: 10,
        offset: 10,
      });

      expect(logs1.length).toBeLessThanOrEqual(10);
      expect(logs2.length).toBeLessThanOrEqual(10);

      // Verify no overlapping IDs
      const ids1 = logs1.map(l => l.id);
      const ids2 = logs2.map(l => l.id);
      const overlap = ids1.filter(id => ids2.includes(id));
      expect(overlap.length).toBe(0);
    });
  });
});

describe('Audit Logger Edge Cases', () => {
  test('Handle null/undefined changes', async () => {
    const result = await logAction(
      'test-user',
      'delete',
      'entity',
      'id-123',
      {
        ipAddress: '127.0.0.1',
        changes: undefined,
      }
    );

    expect(result.changes).toBeUndefined();
  });

  test('Handle missing optional fields', async () => {
    const result = await logAction(
      'test-user',
      'read',
      'entity',
      'id-456',
      {
        ipAddress: '127.0.0.1',
        // No userAgent, sessionId, metadata, etc.
      }
    );

    expect(result.id).toBeDefined();
    expect(result.userAgent).toBeUndefined();
  });

  test('Handle special characters in entityName', async () => {
    const specialName = "O'Brien's \"Case\" & Associates <Ltd>";

    const result = await logAction(
      'test-user',
      'create',
      'entity',
      'id-789',
      {
        entityName: specialName,
        ipAddress: '127.0.0.1',
      }
    );

    expect(result.entityName).toBe(specialName);
  });

  test('Handle very large metadata', async () => {
    const largeMetadata = {};
    for (let i = 0; i < 1000; i++) {
      (largeMetadata as any)[`field_${i}`] = `value_${i}`.repeat(10);
    }

    const result = await logAction(
      'test-user',
      'update',
      'entity',
      'id-large',
      {
        ipAddress: '127.0.0.1',
        metadata: largeMetadata,
      }
    );

    expect(result.metadata).toBeDefined();
  });
});
