// Audit Logging Middleware
// Integrates with Express to automatically log all requests and data modifications
// Captures request context, response status, and tracks data changes

import { Request, Response, NextFunction } from 'express';
import { logAction, logAuthEvent, logPermissionChange } from './auditLogger';
import { v4 as uuidv4 } from 'uuid';
import { routeParam } from '../src/utils/httpParams';

// Extended Request interface with audit context
export interface AuditRequest extends Request {
  auditContext?: {
    sessionId: string;
    requestId: string;
    userId?: string;
    startTime: number;
  };
}

// ============================================
// MIDDLEWARE FACTORIES
// ============================================

/**
 * Main audit logging middleware
 * Logs all HTTP requests and captures response details
 */
export function auditLoggingMiddleware() {
  return (req: AuditRequest, res: Response, next: NextFunction) => {
    // Initialize audit context
    const sessionId = (req.headers['x-session-id'] as string) || uuidv4();
    const requestId = uuidv4();
    const userId = (req.user as any)?.id;

    req.auditContext = {
      sessionId,
      requestId,
      userId,
      startTime: Date.now(),
    };

    // Store original json/send methods to capture response
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    let responseBody: any;

    res.json = function (body: any) {
      responseBody = body;
      return originalJson(body);
    };

    res.send = function (body: any) {
      responseBody = body;
      return originalSend(body);
    };

    // Log on response finish
    res.on('finish', async () => {
      const duration = Date.now() - req.auditContext!.startTime;
      const ipAddress = getClientIp(req);

      try {
        // Determine entity type and action from route
        const { action, entityType, entityId } = parseRoute(req);

        if (action && entityType) {
          await logAction(
            userId || 'anonymous',
            action,
            entityType,
            entityId || 'unknown',
            {
              ipAddress,
              userAgent: req.headers['user-agent'],
              sessionId,
              requestId,
              status: res.statusCode >= 400 ? 'failure' : 'success',
              errorMessage: res.statusCode >= 400 ? `HTTP ${res.statusCode}` : undefined,
              metadata: {
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                durationMs: duration,
                queryParams: req.query,
              },
              dataClassification: getDataClassification(req.path),
            }
          );
        }
      } catch (error) {
        console.error('Error logging audit trail:', error);
      }
    });

    next();
  };
}

/**
 * Authentication event logging middleware
 * Logs login, logout, and authentication failures
 */
export function auditAuthMiddleware() {
  return (req: AuditRequest, res: Response, next: NextFunction) => {
    const ipAddress = getClientIp(req);

    // Capture login attempts
    if (req.path === '/api/auth/login') {
      const originalSend = res.send.bind(res);

      // Express types res.send as synchronous returning Response. The audit
      // write is fire-and-forget so the signature is preserved - awaiting here
      // would also delay the response to the client.
      res.send = function (body: any) {
        // Fire-and-forget: audit failures must neither delay nor break the
        // response. Errors are surfaced in logs.
        void (async () => {
          try {
            const userId = req.body.email || 'unknown';
            const success = res.statusCode === 200;

            await logAuthEvent(userId, 'login', ipAddress, req.headers['user-agent'], success);

            if (success) {
              const user = typeof body === 'string' ? JSON.parse(body) : body;
              await logAuthEvent(user.id, 'login', ipAddress, req.headers['user-agent'], true);
            }
          } catch (error) {
            console.error('Error logging auth event:', error);
          }
        })();

        return originalSend(body);
      };
    }

    // Capture logout
    if (req.path === '/api/auth/logout') {
      const userId = (req.user as any)?.id;
      if (userId) {
        logAuthEvent(userId, 'logout', ipAddress, req.headers['user-agent'], true).catch(
          error => console.error('Error logging logout:', error)
        );
      }
    }

    next();
  };
}

/**
 * Data modification tracking middleware
 * Captures before/after states for create, update, delete operations
 */
export function auditDataChangeMiddleware(
  entityType: string,
  getEntityId: (req: Request) => string
) {
  return async (req: AuditRequest, res: Response, next: NextFunction) => {
    const ipAddress = getClientIp(req);
    const userId = (req.user as any)?.id;

    // Only track POST, PUT, PATCH, DELETE
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }

    try {
      let beforeState: any;

      // For updates and deletes, fetch current state
      if (['PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const entityId = getEntityId(req);
        beforeState = await fetchEntityState(entityType, entityId);
      }

      // Capture response
      const originalJson = res.json.bind(res);
      let afterState: any;

      res.json = function (body: any) {
        afterState = body;
        return originalJson(body);
      };

      res.on('finish', async () => {
        try {
          const entityId = getEntityId(req);
          const action = mapHttpMethodToAction(req.method);

          if (action === 'create' || action === 'update') {
            const changes = {
              before: beforeState || {},
              after: afterState || {},
              fields_modified: calculateModifiedFields(beforeState, afterState),
            };

            await logAction(
              userId,
              action,
              entityType,
              entityId,
              {
                ipAddress,
                changes,
                status: res.statusCode >= 400 ? 'failure' : 'success',
                sessionId: req.auditContext?.sessionId,
                requestId: req.auditContext?.requestId,
              }
            );
          } else if (action === 'delete') {
            await logAction(
              userId,
              action,
              entityType,
              entityId,
              {
                ipAddress,
                changes: {
                  before: beforeState,
                  // Deletion: no 'after' state. Empty object rather than null,
                  // which the audit schema does not accept.
                  after: {},
                  fields_modified: [],
                },
                status: res.statusCode >= 400 ? 'failure' : 'success',
                sessionId: req.auditContext?.sessionId,
              }
            );
          }
        } catch (error) {
          console.error('Error logging data change:', error);
        }
      });

      next();
    } catch (error) {
      console.error('Error in data change middleware:', error);
      next();
    }
  };
}

/**
 * Permission change tracking middleware
 */
export function auditPermissionMiddleware() {
  return (req: AuditRequest, res: Response, next: NextFunction) => {
    if (req.path.includes('/permissions') && ['POST', 'DELETE'].includes(req.method)) {
      const originalJson = res.json.bind(res);
      const ipAddress = getClientIp(req);
      const userId = (req.user as any)?.id;

      res.json = function (body: any) {
        // Fire-and-forget, as with the login hook above.
        void (async () => {
          try {
            const targetUserId = req.body.userId || routeParam(req.params.userId);
            const permissionType = req.body.permission || routeParam(req.params.permission);
            const changeType = req.method === 'POST' ? 'grant' : 'revoke';

            await logPermissionChange(
              userId,
              targetUserId,
              permissionType,
              changeType,
              ipAddress
            );
          } catch (error) {
            console.error('Error logging permission change:', error);
          }
        })();

        return originalJson(body);
      };
    }

    next();
  };
}

/**
 * Sensitive data access logging middleware
 * Logs access to restricted or confidential data
 */
export function auditSensitiveDataMiddleware(
  sensitiveEndpoints: Map<string, { entityType: string; classification: string }>
) {
  return (req: AuditRequest, res: Response, next: NextFunction) => {
    const ipAddress = getClientIp(req);
    const userId = (req.user as any)?.id;

    if (req.method === 'GET') {
      for (const [pattern, config] of sensitiveEndpoints) {
        const regex = new RegExp(pattern);
        if (regex.test(req.path)) {
          res.on('finish', async () => {
            if (res.statusCode === 200) {
              try {
                const entityId = extractIdFromPath(req.path, pattern);
                await logAction(
                  userId,
                  'access',
                  config.entityType,
                  entityId,
                  {
                    ipAddress,
                    sessionId: req.auditContext?.sessionId,
                    dataClassification: config.classification as any,
                    sensitiveDataAccessed: true,
                    metadata: { endpoint: req.path },
                  }
                );
              } catch (error) {
                console.error('Error logging sensitive data access:', error);
              }
            }
          });
          break;
        }
      }
    }

    next();
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '0.0.0.0';
}

/**
 * Parse route to determine action and entity type
 */
function parseRoute(req: Request): {
  action?: string;
  entityType?: string;
  entityId?: string;
} {
  const path = req.path.toLowerCase();
  const method = req.method.toUpperCase();

  // Pattern matching for common REST endpoints
  const patterns: Record<string, Record<string, string>> = {
    cases: {
      'POST /api/cases': 'create',
      'GET /api/cases': 'read',
      'PUT /api/cases/:id': 'update',
      'DELETE /api/cases/:id': 'delete',
    },
    attorneys: {
      'POST /api/attorneys': 'create',
      'GET /api/attorneys': 'read',
      'PUT /api/attorneys/:id': 'update',
      'DELETE /api/attorneys/:id': 'delete',
    },
    users: {
      'POST /api/users': 'create',
      'GET /api/users': 'read',
      'PUT /api/users/:id': 'update',
      'DELETE /api/users/:id': 'delete',
    },
  };

  // Simple pattern matching
  if (path.includes('/cases')) return { action: method === 'POST' ? 'create' : 'read', entityType: 'case' };
  if (path.includes('/attorneys')) return { action: method === 'POST' ? 'create' : 'read', entityType: 'attorney' };
  if (path.includes('/users')) return { action: method === 'POST' ? 'create' : 'read', entityType: 'user' };
  if (path.includes('/documents')) return { action: 'read', entityType: 'document' };
  if (path.includes('/payments')) return { action: 'read', entityType: 'payment' };

  return {};
}

/**
 * Get data classification based on endpoint
 */
function getDataClassification(path: string): 'public' | 'internal' | 'confidential' | 'restricted' {
  if (path.includes('/payments') || path.includes('/escrow')) return 'restricted';
  if (path.includes('/users') || path.includes('/profile')) return 'confidential';
  if (path.includes('/cases') || path.includes('/documents')) return 'confidential';
  return 'internal';
}

/**
 * Map HTTP methods to audit actions
 */
function mapHttpMethodToAction(method: string): 'create' | 'read' | 'update' | 'delete' {
  switch (method) {
    case 'POST':
      return 'create';
    case 'GET':
      return 'read';
    case 'PUT':
    case 'PATCH':
      return 'update';
    case 'DELETE':
      return 'delete';
    default:
      return 'read';
  }
}

/**
 * Fetch entity state for comparison
 */
async function fetchEntityState(entityType: string, entityId: string): Promise<any> {
  // This would query the database to fetch current state
  // Implement based on your data model
  try {
    const { query } = require('../database/connection');

    const mapping: Record<string, string> = {
      'case': 'cases',
      'attorney': 'attorneys',
      'user': 'users',
      'payment': 'payments',
    };

    const table = mapping[entityType];
    if (!table) return null;

    const result = await query(`SELECT * FROM ${table} WHERE id = $1`, [entityId]);
    return result.rows[0];
  } catch (error) {
    console.error('Error fetching entity state:', error);
    return null;
  }
}

/**
 * Calculate which fields were modified
 */
function calculateModifiedFields(before: any, after: any): string[] {
  if (!before || !after) return [];

  const modified: string[] = [];
  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

  for (const key of allKeys) {
    if (before[key] !== after[key]) {
      modified.push(key);
    }
  }

  return modified;
}

/**
 * Extract entity ID from path
 */
function extractIdFromPath(path: string, pattern: string): string {
  const regex = new RegExp(pattern);
  const match = path.match(regex);
  return match ? match[1] : 'unknown';
}

// ============================================
// EXPORT
// ============================================

export default {
  auditLoggingMiddleware,
  auditAuthMiddleware,
  auditDataChangeMiddleware,
  auditPermissionMiddleware,
  auditSensitiveDataMiddleware,
};
