// Complete Audit Logging Integration Example
// Shows how to integrate the audit logging system into a production Express application

import express, { Request, Response } from 'express';
import {
  auditLoggingMiddleware,
  auditAuthMiddleware,
  auditDataChangeMiddleware,
  auditPermissionMiddleware,
  auditSensitiveDataMiddleware,
} from './services/auditMiddleware';
import {
  initializeAuditTables,
  applyDefaultRetentionPolicies,
  generateAuditReport,
  searchAuditLogs,
  detectAnomalies,
  archiveOldLogs,
  getAuditLogHealthCheck,
} from './services/auditLogger';
import cron from 'node-cron';

// ============================================
// APPLICATION SETUP
// ============================================

const app = express();

// Parse JSON bodies
app.use(express.json());

// ============================================
// AUDIT MIDDLEWARE INSTALLATION
// ============================================

// 1. Core audit logging middleware (logs all requests)
app.use(auditLoggingMiddleware());

// 2. Authentication event logging
app.use(auditAuthMiddleware());

// 3. Data modification tracking for key entities
app.use(
  '/api/cases',
  auditDataChangeMiddleware('case', (req) => req.params.id || 'unknown')
);

app.use(
  '/api/attorneys',
  auditDataChangeMiddleware('attorney', (req) => req.params.id || 'unknown')
);

app.use(
  '/api/users',
  auditDataChangeMiddleware('user', (req) => req.params.id || 'unknown')
);

app.use(
  '/api/payments',
  auditDataChangeMiddleware('payment', (req) => req.params.id || 'unknown')
);

// 4. Permission change tracking
app.use(auditPermissionMiddleware());

// 5. Sensitive data access logging
const sensitiveEndpoints = new Map([
  ['/api/users/\\d+/profile', { entityType: 'user', classification: 'confidential' }],
  ['/api/users/\\d+/documents', { entityType: 'user', classification: 'confidential' }],
  ['/api/cases/\\d+/documents', { entityType: 'document', classification: 'confidential' }],
  ['/api/payments/\\d+', { entityType: 'payment', classification: 'restricted' }],
  ['/api/cases/\\d+/communications', { entityType: 'communication', classification: 'confidential' }],
]);

app.use(auditSensitiveDataMiddleware(sensitiveEndpoints));

// ============================================
// ADMIN AUDIT ENDPOINTS
// ============================================

/**
 * GET /api/admin/audit/logs
 * Search and filter audit logs
 */
app.get('/api/admin/audit/logs', async (req: Request, res: Response) => {
  try {
    // Verify admin privileges
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const filters = {
      userId: req.query.userId as string,
      action: req.query.action as string,
      entityType: req.query.entityType as string,
      entityId: req.query.entityId as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      ipAddress: req.query.ipAddress as string,
      status: req.query.status as any,
      dataClassification: req.query.dataClassification as string,
      limit: Math.min(parseInt(req.query.limit as string) || 100, 1000),
      offset: parseInt(req.query.offset as string) || 0,
    };

    const logs = await searchAuditLogs(filters);

    res.json({
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error('Error retrieving audit logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/audit/user/:userId/activity
 * Get user's activity history
 */
app.get('/api/admin/audit/user/:userId/activity', async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const days = parseInt(req.query.days as string) || 30;
    const logs = await searchAuditLogs({
      userId: req.params.userId,
      startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      limit: 1000,
    });

    res.json({
      userId: req.params.userId,
      period: `${days} days`,
      activityCount: logs.length,
      activity: logs,
    });
  } catch (error) {
    console.error('Error retrieving user activity:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/audit/entity/:entityType/:entityId
 * Get complete audit trail for an entity
 */
app.get('/api/admin/audit/entity/:entityType/:entityId', async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const logs = await searchAuditLogs({
      entityType: req.params.entityType,
      entityId: req.params.entityId,
      limit: 1000,
    });

    res.json({
      entityType: req.params.entityType,
      entityId: req.params.entityId,
      auditTrailCount: logs.length,
      auditTrail: logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
    });
  } catch (error) {
    console.error('Error retrieving entity audit trail:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/audit/anomalies
 * Get recent security anomalies
 */
app.get('/api/admin/audit/anomalies', async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const days = parseInt(req.query.days as string) || 7;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const anomalies = await detectAnomalies(startDate, endDate);

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    anomalies.sort((a, b) =>
      severityOrder[a.severity as keyof typeof severityOrder] -
      severityOrder[b.severity as keyof typeof severityOrder]
    );

    res.json({
      period: `${days} days`,
      anomalyCount: anomalies.length,
      anomalies,
    });
  } catch (error) {
    console.error('Error detecting anomalies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/audit/report
 * Generate comprehensive audit report
 */
app.post('/api/admin/audit/report', async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { reportType, startDate, endDate, sign } = req.body;

    if (!reportType || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const report = await generateAuditReport(
      reportType,
      new Date(startDate),
      new Date(endDate),
      (req.user as any).id,
      sign === true
    );

    res.json(report);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/audit/stats
 * Get audit statistics for a period
 */
app.get('/api/admin/audit/stats', async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const days = parseInt(req.query.days as string) || 30;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    const logs = await searchAuditLogs({
      startDate,
      endDate,
      limit: 100000,
    });

    // Calculate statistics
    const stats = {
      period: `${days} days`,
      totalLogs: logs.length,
      successCount: logs.filter(l => l.status === 'success').length,
      failureCount: logs.filter(l => l.status === 'failure').length,
      sensitiveDataAccessCount: logs.filter(l => l.sensitiveDataAccessed).length,
      actionBreakdown: {} as Record<string, number>,
      userBreakdown: {} as Record<string, number>,
      locationBreakdown: {} as Record<string, number>,
    };

    logs.forEach(log => {
      stats.actionBreakdown[log.action] = (stats.actionBreakdown[log.action] || 0) + 1;
      stats.userBreakdown[log.userId] = (stats.userBreakdown[log.userId] || 0) + 1;

      if (log.location?.city) {
        const location = `${log.location.city}, ${log.location.country}`;
        stats.locationBreakdown[location] = (stats.locationBreakdown[location] || 0) + 1;
      }
    });

    res.json(stats);
  } catch (error) {
    console.error('Error calculating statistics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/audit/health
 * System health check
 */
app.get('/api/admin/audit/health', async (req: Request, res: Response) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const health = await getAuditLogHealthCheck();

    res.json({
      status: 'healthy',
      health,
    });
  } catch (error) {
    console.error('Error checking audit system health:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================
// SCHEDULED TASKS
// ============================================

/**
 * Daily archival task
 * Runs at 2 AM every day
 * Archives old logs according to retention policies
 */
cron.schedule('0 2 * * *', async () => {
  try {
    console.log('Starting daily audit log archival...');
    const result = await archiveOldLogs();
    console.log(`Archived ${result.archived} logs, deleted ${result.deleted} logs`);
  } catch (error) {
    console.error('Error during daily archival:', error);
  }
});

/**
 * Weekly security report
 * Runs every Monday at 9 AM
 * Generates comprehensive security report
 */
cron.schedule('0 9 * * 1', async () => {
  try {
    console.log('Generating weekly security report...');
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    const report = await generateAuditReport(
      'security',
      startDate,
      endDate,
      'system-job',
      true  // sign report
    );

    console.log(`Security report generated: ${report.id}`);
    // TODO: Send report to security team via email
  } catch (error) {
    console.error('Error generating weekly security report:', error);
  }
});

/**
 * Hourly anomaly check
 * Detects suspicious activities in real-time
 */
cron.schedule('0 * * * *', async () => {
  try {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 60 * 60 * 1000);  // Last hour

    const anomalies = await detectAnomalies(startDate, endDate);

    // Filter for critical and high severity
    const severeAnomalies = anomalies.filter(a =>
      a.severity === 'critical' || a.severity === 'high'
    );

    if (severeAnomalies.length > 0) {
      console.warn(`SECURITY ALERT: Detected ${severeAnomalies.length} anomalies`);
      severeAnomalies.forEach(anomaly => {
        console.warn(`  - ${anomaly.type}: ${anomaly.severity}`);
      });
      // TODO: Send alert notification to security team
    }
  } catch (error) {
    console.error('Error during hourly anomaly check:', error);
  }
});

// ============================================
// APPLICATION INITIALIZATION
// ============================================

async function initializeApplication() {
  try {
    // Initialize audit logging tables
    await initializeAuditTables();
    console.log('Audit logging tables initialized');

    // Apply default retention policies
    const adminId = process.env.SYSTEM_ADMIN_ID || 'system-admin';
    await applyDefaultRetentionPolicies(adminId);
    console.log('Audit retention policies applied');

  } catch (error) {
    console.error('Error initializing application:', error);
    process.exit(1);
  }
}

// ============================================
// EXAMPLE ENDPOINTS (for testing)
// ============================================

/**
 * POST /api/cases
 * Create a new case (will be automatically audited)
 */
app.post('/api/cases', (req: Request, res: Response) => {
  try {
    // Your case creation logic here
    const caseData = {
      id: 'case-' + Date.now(),
      title: req.body.title,
      status: 'open',
      createdAt: new Date(),
    };

    // This is automatically logged by auditDataChangeMiddleware
    res.status(201).json(caseData);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/cases/:id
 * Update a case (will be automatically audited)
 */
app.put('/api/cases/:id', (req: Request, res: Response) => {
  try {
    // Your case update logic here
    const updatedCase = {
      id: req.params.id,
      ...req.body,
      updatedAt: new Date(),
    };

    // This is automatically logged by auditDataChangeMiddleware with before/after state
    res.json(updatedCase);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/cases/:id
 * Delete a case (will be automatically audited)
 */
app.delete('/api/cases/:id', (req: Request, res: Response) => {
  try {
    // Your case deletion logic here

    // This is automatically logged by auditDataChangeMiddleware
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/auth/login
 * Login endpoint (will be automatically audited)
 */
app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Your authentication logic here
    const user = {
      id: 'user-123',
      email,
      token: 'jwt-token',
    };

    // This is automatically logged by auditAuthMiddleware
    res.json(user);
  } catch (error) {
    // Failed login is also automatically logged
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((error: any, req: Request, res: Response, next: any) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function isAdmin(req: Request): boolean {
  // Implement your admin check logic
  return (req.user as any)?.role === 'admin';
}

// ============================================
// SERVER STARTUP
// ============================================

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await initializeApplication();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Audit logging enabled and running`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export default app;

// ============================================
// USAGE EXAMPLES
// ============================================

/*

SEARCH LOGS:
GET /api/admin/audit/logs?userId=user-123&action=update&limit=50

GET /api/admin/audit/logs?entityType=case&entityId=case-456&limit=100

GET /api/admin/audit/logs?dataClassification=restricted&limit=50

GET /api/admin/audit/logs?status=failure&startDate=2026-08-01&endDate=2026-08-15


USER ACTIVITY:
GET /api/admin/audit/user/user-123/activity?days=30


ENTITY AUDIT TRAIL:
GET /api/admin/audit/entity/case/case-456


ANOMALIES:
GET /api/admin/audit/anomalies?days=7


GENERATE REPORT:
POST /api/admin/audit/report
{
  "reportType": "compliance",
  "startDate": "2026-07-15T00:00:00Z",
  "endDate": "2026-08-15T23:59:59Z",
  "sign": true
}


STATISTICS:
GET /api/admin/audit/stats?days=30


HEALTH CHECK:
GET /api/admin/audit/health

*/
