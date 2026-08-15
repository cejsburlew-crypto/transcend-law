// Master Deployment System Routes
// Admin deployment management, activity logging, immutable records, and rollback functionality

import { Router, Request, Response, NextFunction } from 'express';
import { query, transaction, getConnection } from '../database/connection';
import { authMiddleware, requireUserType } from '../middleware/authMiddleware';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ============================================
// TYPE DEFINITIONS
// ============================================

interface DeploymentRequest {
  id: string;
  environmentId: string;
  deploymentType: 'feature' | 'bugfix' | 'hotfix' | 'rollback';
  description: string;
  requestedBy: string;
  status: 'pending' | 'approved' | 'deploying' | 'completed' | 'failed' | 'rolled_back';
  scheduledAt?: Date;
  createdAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  changes: Record<string, any>;
  ipAddress?: string;
  gpsCoordinates?: { latitude: number; longitude: number };
  userAgent?: string;
  timestamp: Date;
  sessionId: string;
}

interface ImmutableDocument {
  id: string;
  documentType: string;
  content: Record<string, any>;
  hash: string;
  previousHash?: string;
  createdBy: string;
  createdAt: Date;
  immutable: boolean;
}

interface DeletionAttempt {
  id: string;
  targetType: string;
  targetId: string;
  attemptedBy: string;
  reason?: string;
  timestamp: Date;
  blocked: boolean;
  blockReason?: string;
}

// ============================================
// INPUT VALIDATION UTILITIES
// ============================================

function validateDeploymentRequest(body: any) {
  const errors: string[] = [];

  if (!body.environmentId) errors.push('environmentId is required');
  if (!body.deploymentType) errors.push('deploymentType is required');
  if (!['feature', 'bugfix', 'hotfix', 'rollback'].includes(body.deploymentType)) {
    errors.push('Invalid deploymentType');
  }
  if (!body.description || body.description.length === 0) {
    errors.push('description is required');
  }

  return errors;
}

function validateActivityLog(body: any) {
  const errors: string[] = [];

  if (!body.action) errors.push('action is required');
  if (!body.resource) errors.push('resource is required');
  if (!body.resourceId) errors.push('resourceId is required');

  return errors;
}

function validateImmutableDocument(body: any) {
  const errors: string[] = [];

  if (!body.documentType) errors.push('documentType is required');
  if (!body.content) errors.push('content is required');
  if (typeof body.content !== 'object') errors.push('content must be an object');

  return errors;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function computeHash(data: any): string {
  const crypto = require('crypto');
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
}

function extractGPS(body: any): { latitude: number; longitude: number } | undefined {
  if (body.gpsCoordinates && body.gpsCoordinates.latitude && body.gpsCoordinates.longitude) {
    return {
      latitude: parseFloat(body.gpsCoordinates.latitude),
      longitude: parseFloat(body.gpsCoordinates.longitude),
    };
  }
  return undefined;
}

// ============================================
// ENDPOINTS
// ============================================

/**
 * POST /api/admin/deployment-request
 * Submit a new deployment request
 */
router.post(
  '/deployment-request',
  authMiddleware,
  requireUserType('admin'),
  async (req: Request, res: Response) => {
    try {
      const { environmentId, deploymentType, description, scheduledAt } = req.body;

      // Validate input
      const validationErrors = validateDeploymentRequest(req.body);
      if (validationErrors.length > 0) {
        return res.status(400).json({ errors: validationErrors });
      }

      const deploymentId = uuidv4();
      const now = new Date();

      const result = await query(
        `INSERT INTO deployments (
          id, environment_id, deployment_type, description, requested_by,
          status, scheduled_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          deploymentId,
          environmentId,
          deploymentType,
          description,
          req.userId,
          'pending',
          scheduledAt ? new Date(scheduledAt) : null,
          now,
        ]
      );

      // Log the deployment request
      await query(
        `INSERT INTO activity_logs (
          id, user_id, action, resource, resource_id, changes,
          ip_address, user_agent, session_id, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          uuidv4(),
          req.userId,
          'deployment_requested',
          'deployment',
          deploymentId,
          JSON.stringify({ deploymentType, environmentId }),
          req.ip || null,
          req.get('user-agent') || null,
          req.sessionID || uuidv4(),
          now,
        ]
      );

      res.status(201).json({
        success: true,
        deployment: result.rows[0],
      });
    } catch (error: any) {
      console.error('Error creating deployment request:', error);
      res.status(500).json({
        error: 'Failed to create deployment request',
        details: error.message,
      });
    }
  }
);

/**
 * GET /api/admin/deployments
 * Get all deployments with filtering and pagination
 */
router.get(
  '/deployments',
  authMiddleware,
  requireUserType('admin'),
  async (req: Request, res: Response) => {
    try {
      const { status, environmentId, limit = 20, offset = 0 } = req.query;

      let baseQuery = 'SELECT * FROM deployments WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      if (status) {
        baseQuery += ` AND status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }

      if (environmentId) {
        baseQuery += ` AND environment_id = $${paramIndex}`;
        params.push(environmentId);
        paramIndex++;
      }

      baseQuery += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(parseInt(limit as string), parseInt(offset as string));

      const result = await query(baseQuery, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) as total FROM deployments WHERE 1=1';
      const countParams: any[] = [];
      let countIndex = 1;

      if (status) {
        countQuery += ` AND status = $${countIndex}`;
        countParams.push(status);
        countIndex++;
      }

      if (environmentId) {
        countQuery += ` AND environment_id = $${countIndex}`;
        countParams.push(environmentId);
        countIndex++;
      }

      const countResult = await query(countQuery, countParams);

      res.json({
        success: true,
        deployments: result.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore: parseInt(offset as string) + parseInt(limit as string) < parseInt(countResult.rows[0].total),
        },
      });
    } catch (error: any) {
      console.error('Error fetching deployments:', error);
      res.status(500).json({
        error: 'Failed to fetch deployments',
        details: error.message,
      });
    }
  }
);

/**
 * GET /api/admin/deployments/:id
 * Get specific deployment details
 */
router.get(
  '/deployments/:id',
  authMiddleware,
  requireUserType('admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const result = await query('SELECT * FROM deployments WHERE id = $1', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Deployment not found' });
      }

      const deployment = result.rows[0];

      // Get associated activity logs
      const logsResult = await query(
        `SELECT * FROM activity_logs
         WHERE resource = 'deployment' AND resource_id = $1
         ORDER BY timestamp DESC`,
        [id]
      );

      res.json({
        success: true,
        deployment,
        activityLogs: logsResult.rows,
      });
    } catch (error: any) {
      console.error('Error fetching deployment:', error);
      res.status(500).json({
        error: 'Failed to fetch deployment',
        details: error.message,
      });
    }
  }
);

/**
 * PUT /api/admin/deployments/:id
 * Update deployment status
 */
router.put(
  '/deployments/:id',
  authMiddleware,
  requireUserType('admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, errorMessage } = req.body;

      if (!status) {
        return res.status(400).json({ error: 'status is required' });
      }

      const validStatuses = ['pending', 'approved', 'deploying', 'completed', 'failed', 'rolled_back'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      // Get current deployment for audit
      const currentResult = await query('SELECT * FROM deployments WHERE id = $1', [id]);

      if (currentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Deployment not found' });
      }

      const currentDeployment = currentResult.rows[0];
      const now = new Date();
      const completedAt = ['completed', 'failed', 'rolled_back'].includes(status) ? now : null;

      const updateResult = await query(
        `UPDATE deployments
         SET status = $1, error_message = $2, completed_at = $3, updated_at = $4
         WHERE id = $5
         RETURNING *`,
        [status, errorMessage || null, completedAt, now, id]
      );

      // Log the status change
      await query(
        `INSERT INTO activity_logs (
          id, user_id, action, resource, resource_id, changes,
          ip_address, user_agent, session_id, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          uuidv4(),
          req.userId,
          'deployment_status_updated',
          'deployment',
          id,
          JSON.stringify({
            oldStatus: currentDeployment.status,
            newStatus: status,
            errorMessage: errorMessage || null,
          }),
          req.ip || null,
          req.get('user-agent') || null,
          req.sessionID || uuidv4(),
          now,
        ]
      );

      res.json({
        success: true,
        deployment: updateResult.rows[0],
      });
    } catch (error: any) {
      console.error('Error updating deployment:', error);
      res.status(500).json({
        error: 'Failed to update deployment',
        details: error.message,
      });
    }
  }
);

/**
 * POST /api/admin/activity-log
 * Log user activities with GPS coordinates
 */
router.post(
  '/activity-log',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { action, resource, resourceId, changes, gpsCoordinates } = req.body;

      // Validate input
      const validationErrors = validateActivityLog(req.body);
      if (validationErrors.length > 0) {
        return res.status(400).json({ errors: validationErrors });
      }

      const logId = uuidv4();
      const now = new Date();
      const gps = extractGPS({ gpsCoordinates });

      let gpsJSON = null;
      if (gps) {
        gpsJSON = JSON.stringify(gps);
      }

      const result = await query(
        `INSERT INTO activity_logs (
          id, user_id, action, resource, resource_id, changes,
          gps_coordinates, ip_address, user_agent, session_id, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          logId,
          req.userId,
          action,
          resource,
          resourceId,
          JSON.stringify(changes || {}),
          gpsJSON,
          req.ip || null,
          req.get('user-agent') || null,
          req.sessionID || uuidv4(),
          now,
        ]
      );

      res.status(201).json({
        success: true,
        activityLog: result.rows[0],
      });
    } catch (error: any) {
      console.error('Error logging activity:', error);
      res.status(500).json({
        error: 'Failed to log activity',
        details: error.message,
      });
    }
  }
);

/**
 * GET /api/admin/deployment-metrics
 * Get deployment metrics (success rate, average time, etc)
 */
router.get(
  '/deployment-metrics',
  authMiddleware,
  requireUserType('admin'),
  async (req: Request, res: Response) => {
    try {
      const { days = 30 } = req.query;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days as string));

      // Get success rate
      const successRateResult = await query(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'rolled_back' THEN 1 ELSE 0 END) as rolled_back
         FROM deployments
         WHERE created_at >= $1`,
        [startDate]
      );

      // Get average deployment time
      const avgTimeResult = await query(
        `SELECT
          AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_seconds
         FROM deployments
         WHERE created_at >= $1 AND completed_at IS NOT NULL`,
        [startDate]
      );

      // Get deployments by type
      const byTypeResult = await query(
        `SELECT
          deployment_type,
          COUNT(*) as count,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful
         FROM deployments
         WHERE created_at >= $1
         GROUP BY deployment_type`,
        [startDate]
      );

      // Get deployments by environment
      const byEnvResult = await query(
        `SELECT
          environment_id,
          COUNT(*) as count,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful
         FROM deployments
         WHERE created_at >= $1
         GROUP BY environment_id
         ORDER BY count DESC`,
        [startDate]
      );

      const metrics = successRateResult.rows[0];
      const successRate = metrics.total > 0 ? (metrics.completed / metrics.total) * 100 : 0;

      res.json({
        success: true,
        metrics: {
          period: `Last ${days} days`,
          successRate: parseFloat(successRate.toFixed(2)),
          totalDeployments: parseInt(metrics.total),
          completed: parseInt(metrics.completed),
          failed: parseInt(metrics.failed),
          rolledBack: parseInt(metrics.rolled_back),
          averageDeploymentTimeSeconds: Math.round(
            parseFloat(avgTimeResult.rows[0].avg_seconds || 0)
          ),
          byDeploymentType: byTypeResult.rows,
          byEnvironment: byEnvResult.rows,
        },
      });
    } catch (error: any) {
      console.error('Error fetching deployment metrics:', error);
      res.status(500).json({
        error: 'Failed to fetch deployment metrics',
        details: error.message,
      });
    }
  }
);

/**
 * POST /api/admin/immutable-documents
 * Create an immutable document record with cryptographic hash
 */
router.post(
  '/immutable-documents',
  authMiddleware,
  requireUserType('admin'),
  async (req: Request, res: Response) => {
    try {
      const { documentType, content, previousDocumentId } = req.body;

      // Validate input
      const validationErrors = validateImmutableDocument(req.body);
      if (validationErrors.length > 0) {
        return res.status(400).json({ errors: validationErrors });
      }

      const documentId = uuidv4();
      const now = new Date();
      const hash = computeHash(content);

      let previousHash = null;
      if (previousDocumentId) {
        const prevResult = await query(
          'SELECT hash FROM immutable_documents WHERE id = $1',
          [previousDocumentId]
        );
        if (prevResult.rows.length > 0) {
          previousHash = prevResult.rows[0].hash;
        }
      }

      const result = await query(
        `INSERT INTO immutable_documents (
          id, document_type, content, hash, previous_hash,
          created_by, created_at, immutable
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          documentId,
          documentType,
          JSON.stringify(content),
          hash,
          previousHash,
          req.userId,
          now,
          true,
        ]
      );

      res.status(201).json({
        success: true,
        immutableDocument: result.rows[0],
      });
    } catch (error: any) {
      console.error('Error creating immutable document:', error);
      res.status(500).json({
        error: 'Failed to create immutable document',
        details: error.message,
      });
    }
  }
);

/**
 * GET /api/admin/immutable-documents/:id
 * Get immutable document with verification
 */
router.get(
  '/immutable-documents/:id',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const result = await query(
        'SELECT * FROM immutable_documents WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Immutable document not found' });
      }

      const document = result.rows[0];
      const content = typeof document.content === 'string'
        ? JSON.parse(document.content)
        : document.content;

      // Verify hash
      const computedHash = computeHash(content);
      const isVerified = computedHash === document.hash;

      res.json({
        success: true,
        immutableDocument: {
          ...document,
          content,
          hashVerified: isVerified,
        },
      });
    } catch (error: any) {
      console.error('Error fetching immutable document:', error);
      res.status(500).json({
        error: 'Failed to fetch immutable document',
        details: error.message,
      });
    }
  }
);

/**
 * POST /api/admin/deletion-attempts
 * Log deletion attempts (prevents unauthorized deletion)
 */
router.post(
  '/deletion-attempts',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { targetType, targetId, reason } = req.body;

      if (!targetType || !targetId) {
        return res.status(400).json({
          error: 'targetType and targetId are required',
        });
      }

      const attemptId = uuidv4();
      const now = new Date();

      // Check if user has permission to delete
      let hasPermission = false;
      let blockReason = null;

      if (req.user?.userType === 'admin') {
        hasPermission = true;
      } else {
        hasPermission = false;
        blockReason = 'Insufficient permissions for deletion';
      }

      const result = await query(
        `INSERT INTO deletion_attempts (
          id, target_type, target_id, attempted_by, reason,
          timestamp, blocked, block_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          attemptId,
          targetType,
          targetId,
          req.userId,
          reason || null,
          now,
          !hasPermission,
          blockReason,
        ]
      );

      // Log the deletion attempt
      await query(
        `INSERT INTO activity_logs (
          id, user_id, action, resource, resource_id, changes,
          ip_address, user_agent, session_id, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          uuidv4(),
          req.userId,
          'deletion_attempted',
          'deletion_attempt',
          attemptId,
          JSON.stringify({
            targetType,
            targetId,
            blocked: !hasPermission,
            reason: blockReason,
          }),
          req.ip || null,
          req.get('user-agent') || null,
          req.sessionID || uuidv4(),
          now,
        ]
      );

      const statusCode = hasPermission ? 201 : 403;

      res.status(statusCode).json({
        success: hasPermission,
        deletionAttempt: result.rows[0],
        message: hasPermission
          ? 'Deletion authorized'
          : 'Deletion blocked - insufficient permissions',
      });
    } catch (error: any) {
      console.error('Error logging deletion attempt:', error);
      res.status(500).json({
        error: 'Failed to log deletion attempt',
        details: error.message,
      });
    }
  }
);

/**
 * POST /api/admin/rollback/:deploymentId
 * Rollback a deployment to previous version
 */
router.post(
  '/rollback/:deploymentId',
  authMiddleware,
  requireUserType('admin'),
  async (req: Request, res: Response) => {
    try {
      const { deploymentId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({ error: 'reason is required for rollback' });
      }

      // Get the deployment to rollback
      const deploymentResult = await query(
        'SELECT * FROM deployments WHERE id = $1',
        [deploymentId]
      );

      if (deploymentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Deployment not found' });
      }

      const deployment = deploymentResult.rows[0];

      // Find previous deployment
      const previousResult = await query(
        `SELECT * FROM deployments
         WHERE environment_id = $1
         AND created_at < $2
         AND status = 'completed'
         ORDER BY created_at DESC
         LIMIT 1`,
        [deployment.environment_id, deployment.created_at]
      );

      if (previousResult.rows.length === 0) {
        return res.status(404).json({
          error: 'No previous deployment found to rollback to',
        });
      }

      const now = new Date();
      const rollbackId = uuidv4();

      // Create rollback record
      const rollbackResult = await query(
        `INSERT INTO deployments (
          id, environment_id, deployment_type, description, requested_by,
          status, rollback_from_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          rollbackId,
          deployment.environment_id,
          'rollback',
          `Rollback: ${reason}`,
          req.userId,
          'completed',
          deploymentId,
          now,
        ]
      );

      // Update original deployment status
      await query(
        `UPDATE deployments
         SET status = 'rolled_back', updated_at = $1
         WHERE id = $2`,
        [now, deploymentId]
      );

      // Log the rollback
      await query(
        `INSERT INTO activity_logs (
          id, user_id, action, resource, resource_id, changes,
          ip_address, user_agent, session_id, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          uuidv4(),
          req.userId,
          'deployment_rolled_back',
          'deployment',
          deploymentId,
          JSON.stringify({
            reason,
            rolledBackTo: previousResult.rows[0].id,
            rollbackId: rollbackId,
          }),
          req.ip || null,
          req.get('user-agent') || null,
          req.sessionID || uuidv4(),
          now,
        ]
      );

      res.json({
        success: true,
        rollback: rollbackResult.rows[0],
        previousDeployment: previousResult.rows[0],
        message: 'Deployment rolled back successfully',
      });
    } catch (error: any) {
      console.error('Error rolling back deployment:', error);
      res.status(500).json({
        error: 'Failed to rollback deployment',
        details: error.message,
      });
    }
  }
);

// ============================================
// ERROR HANDLING
// ============================================

router.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Deployment route error:', err);
  res.status(500).json({
    error: 'Internal server error',
    details: err.message,
  });
});

export default router;
