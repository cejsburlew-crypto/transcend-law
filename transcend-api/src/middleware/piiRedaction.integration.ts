/**
 * PII Redaction Integration Guide
 * Complete integration example for Express application
 */

import { Express, Request, Response, NextFunction } from 'express';
import {
  redactionEngine,
  piiRedactionMiddleware,
  piiRedactionLoggingMiddleware,
  LogRedactor,
  PiiRedactionEngine,
  getPiiRedactionStats,
  exportAuditLog,
} from './piiRedaction';

// ============================================================================
// INITIALIZATION FUNCTION
// ============================================================================

/**
 * Initialize PII redaction for the application
 * Call this in your main app.ts or server.ts file
 */
export function initializePiiRedaction(
  app: Express,
  options: {
    verbose?: boolean;
    enableResponseRedaction?: boolean;
    enableConsoleInterception?: boolean;
    customPatterns?: any[];
  } = {}
): void {
  const {
    verbose = process.env.NODE_ENV === 'development',
    enableResponseRedaction = true,
    enableConsoleInterception = true,
    customPatterns = [],
  } = options;

  console.log('[PII Redaction] Initializing PII redaction middleware...');

  // ========================================================================
  // 1. Add Custom Patterns
  // ========================================================================
  if (customPatterns.length > 0) {
    customPatterns.forEach(pattern => {
      redactionEngine.addCustomPattern(pattern);
      console.log(`[PII Redaction] Added custom pattern: ${pattern.name}`);
    });
  }

  // ========================================================================
  // 2. Apply Middleware in Correct Order
  // ========================================================================

  // Core PII redaction middleware - must be early in the chain
  app.use(piiRedactionMiddleware({ enableResponseRedaction }));
  if (verbose) {
    console.log('[PII Redaction] Applied core redaction middleware');
  }

  // Logging middleware
  app.use(piiRedactionLoggingMiddleware({ verbose }));
  if (verbose) {
    console.log('[PII Redaction] Applied logging middleware');
  }

  // ========================================================================
  // 3. Console Interception
  // ========================================================================
  if (enableConsoleInterception) {
    const logRedactor = new LogRedactor(redactionEngine);
    logRedactor.interceptConsole();
    console.log('[PII Redaction] Console logging intercepted');
  }

  // ========================================================================
  // 4. Add Health Check Endpoint
  // ========================================================================
  app.get('/api/health/pii-redaction', (req: Request, res: Response) => {
    const stats = getPiiRedactionStats();
    res.json({
      status: 'ok',
      redaction: {
        totalRedactions: stats.totalRedactions,
        auditEntries: stats.totalAuditEntries,
        searchableLogs: stats.searchableLogs,
        piiTypes: stats.piiTypes,
      },
    });
  });

  // ========================================================================
  // 5. Add Audit Log Export Endpoint (Admin Only)
  // ========================================================================
  app.get('/api/admin/audit-logs/export', (req: Request, res: Response) => {
    // TODO: Add authentication check here
    // if (!isAdmin(req.user)) {
    //   return res.status(403).json({ error: 'Unauthorized' });
    // }

    const { userId, piiType, startTime, endTime } = req.query;

    const auditLogs = exportAuditLog({
      userId: userId as string,
      piiType: piiType as string,
      startTime: startTime ? new Date(startTime as string) : undefined,
      endTime: endTime ? new Date(endTime as string) : undefined,
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.json"`);
    res.send(auditLogs);
  });

  // ========================================================================
  // 6. Add Statistics Endpoint (Admin Only)
  // ========================================================================
  app.get('/api/admin/pii-redaction/stats', (req: Request, res: Response) => {
    // TODO: Add authentication check here
    const stats = getPiiRedactionStats();
    res.json({
      stats,
      timestamp: new Date().toISOString(),
    });
  });

  // ========================================================================
  // 7. Add Redaction Test Endpoint (Dev Only)
  // ========================================================================
  if (process.env.NODE_ENV === 'development') {
    app.post('/api/dev/test-redaction', (req: Request, res: Response) => {
      const { data } = req.body;

      if (!data) {
        return res.status(400).json({ error: 'No data provided' });
      }

      const result = redactionEngine.redact(data);

      res.json({
        original: data,
        redacted: result.redacted,
        redactionCount: result.redactionCount,
        detectedPii: result.detectedPii,
      });
    });
  }

  console.log('[PII Redaction] Initialization complete');
}

// ============================================================================
// MIDDLEWARE FOR REQUEST CONTEXT TRACKING
// ============================================================================

/**
 * Attach request context for better audit logging
 */
export function attachRequestContext(req: Request, res: Response, next: NextFunction): void {
  (req as any).piiRedactionContext = {
    requestId: req.headers['x-request-id'] || `${Date.now()}-${Math.random()}`,
    userId: (req as any).userId,
    userRole: (req as any).userRole,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString(),
  };

  next();
}

// ============================================================================
// ERROR HANDLING WITH PII REDACTION
// ============================================================================

/**
 * Error handler that redacts PII from error messages
 */
export function errorHandlerWithRedaction(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const logRedactor = new LogRedactor(redactionEngine);

  // Redact error message
  const redactedMessage = logRedactor.redactLog(err.message || 'Unknown error');

  // Log redacted error
  console.error({
    error: redactedMessage,
    status: err.status || 500,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Send response
  res.status(err.status || 500).json({
    error: 'An error occurred',
    message: process.env.NODE_ENV === 'development' ? redactedMessage : undefined,
  });
}

// ============================================================================
// REQUEST/RESPONSE LOGGING WITH REDACTION
// ============================================================================

/**
 * Log requests and responses with PII redaction
 */
export function logRequestWithRedaction(req: Request, res: Response, next: NextFunction): void {
  const logRedactor = new LogRedactor(redactionEngine);
  const startTime = Date.now();

  // Intercept response to log it
  const originalSend = res.send;
  res.send = function (data: any) {
    const duration = Date.now() - startTime;

    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.headers['user-agent'],
    };

    // Redact before logging
    const redactedLog = logRedactor.redactLog(JSON.stringify(logEntry));

    if (process.env.NODE_ENV === 'development') {
      console.log(redactedLog);
    }

    return originalSend.call(this, data);
  };

  next();
}

// ============================================================================
// USAGE EXAMPLE IN MAIN APP
// ============================================================================

/**
 * Example of how to use in your Express app initialization
 */
export function setupExampleApp(app: Express): void {
  // Import necessary middleware
  import('express-json').then(() => {
    // Parse JSON bodies
    app.use(express.json());

    // Attach request context
    app.use(attachRequestContext);

    // Initialize PII redaction with custom patterns
    initializePiiRedaction(app, {
      verbose: process.env.NODE_ENV === 'development',
      enableResponseRedaction: true,
      enableConsoleInterception: true,
      customPatterns: [
        {
          name: 'Case Number',
          regex: /CASE-\d{4}-\d{6}/g,
          redactionFormat: '[CASE_REDACTED]',
          dataType: 'custom',
        },
        {
          name: 'Client ID',
          regex: /CLT-\d{6}/g,
          redactionFormat: '[CLIENT_ID_REDACTED]',
          dataType: 'custom',
        },
      ],
    });

    // Add request logging
    app.use(logRequestWithRedaction);

    // Your routes here
    app.post('/api/register', (req: Request, res: Response) => {
      // PII in request body is already redacted
      console.log('Request:', req.body);

      res.json({
        success: true,
        message: 'Registration successful',
      });
    });

    // Error handling
    app.use(errorHandlerWithRedaction);
  });
}

// ============================================================================
// SCHEDULED CLEANUP (Run periodically)
// ============================================================================

/**
 * Schedule periodic cleanup of audit logs
 * Call this in your application startup
 */
export function scheduleAuditLogCleanup(intervalMs: number = 86400000): NodeJS.Timeout {
  console.log(
    `[PII Redaction] Scheduling audit log cleanup every ${Math.round(intervalMs / 1000 / 60)} minutes`
  );

  return setInterval(() => {
    const stats = redactionEngine.getStats();

    if (stats.totalAuditEntries > 5000) {
      console.log(
        `[PII Redaction] Clearing audit logs. Current count: ${stats.totalAuditEntries}`
      );
      redactionEngine.clearAuditLog();
      console.log('[PII Redaction] Audit logs cleared');
    }
  }, intervalMs);
}

// ============================================================================
// MONITORING & METRICS
// ============================================================================

/**
 * Get current redaction metrics for monitoring
 */
export function getRedactionMetrics() {
  const stats = getPiiRedactionStats();

  return {
    metrics: {
      total_redactions: stats.totalRedactions,
      audit_entries: stats.totalAuditEntries,
      searchable_logs: stats.searchableLogs,
      pii_breakdown: stats.piiTypes,
    },
    timestamp: new Date().toISOString(),
  };
}

// ============================================================================
// COMPLIANCE REPORTING
// ============================================================================

/**
 * Generate compliance report for auditing purposes
 */
export function generateComplianceReport(period: 'daily' | 'weekly' | 'monthly' = 'daily') {
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case 'daily':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case 'weekly':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'monthly':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  const auditLog = redactionEngine.getAuditLog({
    startTime: startDate,
    endTime: now,
  });

  const stats = getPiiRedactionStats();

  return {
    report: {
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      summary: {
        totalRedactions: stats.totalRedactions,
        periodRedactions: auditLog.length,
        piiTypesDetected: Object.keys(stats.piiTypes),
      },
      breakdown: stats.piiTypes,
      auditLog: auditLog.slice(-100), // Last 100 entries
    },
    generated: new Date().toISOString(),
  };
}

// ============================================================================
// ENVIRONMENT-BASED CONFIGURATION
// ============================================================================

/**
 * Get configuration based on environment
 */
export function getEnvironmentConfig(): {
  verbose: boolean;
  enableResponseRedaction: boolean;
  enableConsoleInterception: boolean;
  enableMetrics: boolean;
  cleanupInterval: number;
} {
  switch (process.env.NODE_ENV) {
    case 'production':
      return {
        verbose: false,
        enableResponseRedaction: true,
        enableConsoleInterception: true,
        enableMetrics: true,
        cleanupInterval: 86400000, // 24 hours
      };
    case 'staging':
      return {
        verbose: true,
        enableResponseRedaction: true,
        enableConsoleInterception: true,
        enableMetrics: true,
        cleanupInterval: 3600000, // 1 hour
      };
    case 'development':
    default:
      return {
        verbose: true,
        enableResponseRedaction: true,
        enableConsoleInterception: true,
        enableMetrics: true,
        cleanupInterval: 600000, // 10 minutes
      };
  }
}

export default {
  initializePiiRedaction,
  attachRequestContext,
  errorHandlerWithRedaction,
  logRequestWithRedaction,
  setupExampleApp,
  scheduleAuditLogCleanup,
  getRedactionMetrics,
  generateComplianceReport,
  getEnvironmentConfig,
};
