// Deployment Service
// Business logic for deployment operations, validation, and orchestration

import { query, transaction, getConnection } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// ============================================
// TYPES
// ============================================

export interface CreateDeploymentInput {
  environmentId: string;
  deploymentType: 'feature' | 'bugfix' | 'hotfix' | 'rollback';
  description: string;
  requestedBy: string;
  scheduledAt?: Date;
}

export interface UpdateDeploymentInput {
  status: string;
  errorMessage?: string;
}

export interface DeploymentMetrics {
  successRate: number;
  totalDeployments: number;
  completed: number;
  failed: number;
  rolledBack: number;
  averageDeploymentTimeSeconds: number;
  byDeploymentType: any[];
  byEnvironment: any[];
}

export interface ImmutableDocumentInput {
  documentType: string;
  content: Record<string, any>;
  previousDocumentId?: string;
}

// ============================================
// DEPLOYMENT SERVICE
// ============================================

export class DeploymentService {
  /**
   * Create a new deployment request
   */
  static async createDeployment(input: CreateDeploymentInput) {
    const deploymentId = uuidv4();
    const now = new Date();

    const result = await query(
      `INSERT INTO deployments (
        id, environment_id, deployment_type, description, requested_by,
        status, scheduled_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        deploymentId,
        input.environmentId,
        input.deploymentType,
        input.description,
        input.requestedBy,
        'pending',
        input.scheduledAt || null,
        now,
        now,
      ]
    );

    return result.rows[0];
  }

  /**
   * Get deployment by ID
   */
  static async getDeployment(deploymentId: string) {
    const result = await query(
      'SELECT * FROM deployments WHERE id = $1',
      [deploymentId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get deployments with filters
   */
  static async getDeployments(
    filters: {
      status?: string;
      environmentId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const { status, environmentId, limit = 20, offset = 0 } = filters;

    let query_string = 'SELECT * FROM deployments WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query_string += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (environmentId) {
      query_string += ` AND environment_id = $${paramIndex}`;
      params.push(environmentId);
      paramIndex++;
    }

    query_string += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(query_string, params);
    return result.rows;
  }

  /**
   * Update deployment status
   */
  static async updateDeploymentStatus(
    deploymentId: string,
    input: UpdateDeploymentInput
  ) {
    const now = new Date();
    const completedAt = ['completed', 'failed', 'rolled_back'].includes(input.status)
      ? now
      : null;

    const result = await query(
      `UPDATE deployments
       SET status = $1, error_message = $2, completed_at = $3, updated_at = $4
       WHERE id = $5
       RETURNING *`,
      [input.status, input.errorMessage || null, completedAt, now, deploymentId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get deployment metrics
   */
  static async getMetrics(days: number = 30): Promise<DeploymentMetrics> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Success rate
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

    // Average deployment time
    const avgTimeResult = await query(
      `SELECT
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_seconds
       FROM deployments
       WHERE created_at >= $1 AND completed_at IS NOT NULL`,
      [startDate]
    );

    // By type
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

    // By environment
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
    const successRate =
      metrics.total > 0 ? (parseInt(metrics.completed) / parseInt(metrics.total)) * 100 : 0;

    return {
      successRate: parseFloat(successRate.toFixed(2)),
      totalDeployments: parseInt(metrics.total),
      completed: parseInt(metrics.completed),
      failed: parseInt(metrics.failed),
      rolledBack: parseInt(metrics.rolled_back),
      averageDeploymentTimeSeconds: Math.round(
        parseFloat(avgTimeResult.rows[0]?.avg_seconds || 0)
      ),
      byDeploymentType: byTypeResult.rows,
      byEnvironment: byEnvResult.rows,
    };
  }

  /**
   * Rollback a deployment
   */
  static async rollbackDeployment(deploymentId: string, reason: string, requestedBy: string) {
    return transaction(async (client) => {
      // Get deployment
      const deploymentResult = await client.query(
        'SELECT * FROM deployments WHERE id = $1',
        [deploymentId]
      );

      if (deploymentResult.rows.length === 0) {
        throw new Error('Deployment not found');
      }

      const deployment = deploymentResult.rows[0];

      // Find previous deployment
      const previousResult = await client.query(
        `SELECT * FROM deployments
         WHERE environment_id = $1
         AND created_at < $2
         AND status = 'completed'
         ORDER BY created_at DESC
         LIMIT 1`,
        [deployment.environment_id, deployment.created_at]
      );

      if (previousResult.rows.length === 0) {
        throw new Error('No previous deployment found to rollback to');
      }

      const now = new Date();
      const rollbackId = uuidv4();

      // Create rollback deployment
      const rollbackResult = await client.query(
        `INSERT INTO deployments (
          id, environment_id, deployment_type, description, requested_by,
          status, rollback_from_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          rollbackId,
          deployment.environment_id,
          'rollback',
          `Rollback: ${reason}`,
          requestedBy,
          'completed',
          deploymentId,
          now,
          now,
        ]
      );

      // Update original deployment
      await client.query(
        `UPDATE deployments
         SET status = 'rolled_back', updated_at = $1
         WHERE id = $2`,
        [now, deploymentId]
      );

      return {
        rollback: rollbackResult.rows[0],
        previousDeployment: previousResult.rows[0],
      };
    });
  }

  /**
   * Log activity
   */
  static async logActivity(
    userId: string,
    action: string,
    resource: string,
    resourceId: string,
    changes: Record<string, any>,
    options?: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
      gpsCoordinates?: { latitude: number; longitude: number };
    }
  ) {
    const logId = uuidv4();
    const now = new Date();

    let gpsJSON = null;
    if (options?.gpsCoordinates) {
      gpsJSON = JSON.stringify(options.gpsCoordinates);
    }

    const result = await query(
      `INSERT INTO activity_logs (
        id, user_id, action, resource, resource_id, changes,
        gps_coordinates, ip_address, user_agent, session_id, timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        logId,
        userId,
        action,
        resource,
        resourceId,
        JSON.stringify(changes),
        gpsJSON,
        options?.ipAddress || null,
        options?.userAgent || null,
        options?.sessionId || uuidv4(),
        now,
      ]
    );

    return result.rows[0];
  }

  /**
   * Get activity logs for resource
   */
  static async getActivityLogs(
    resource: string,
    resourceId: string,
    limit: number = 50,
    offset: number = 0
  ) {
    const result = await query(
      `SELECT * FROM activity_logs
       WHERE resource = $1 AND resource_id = $2
       ORDER BY timestamp DESC
       LIMIT $3 OFFSET $4`,
      [resource, resourceId, limit, offset]
    );

    return result.rows;
  }

  /**
   * Get activity logs by user
   */
  static async getActivityLogsByUser(userId: string, limit: number = 50, offset: number = 0) {
    const result = await query(
      `SELECT * FROM activity_logs
       WHERE user_id = $1
       ORDER BY timestamp DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  }

  /**
   * Create immutable document
   */
  static async createImmutableDocument(
    input: ImmutableDocumentInput,
    createdBy: string
  ) {
    const documentId = uuidv4();
    const now = new Date();
    const hash = this.computeHash(input.content);

    let previousHash = null;
    if (input.previousDocumentId) {
      const prevResult = await query(
        'SELECT hash FROM immutable_documents WHERE id = $1',
        [input.previousDocumentId]
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
        input.documentType,
        JSON.stringify(input.content),
        hash,
        previousHash,
        createdBy,
        now,
        true,
      ]
    );

    return result.rows[0];
  }

  /**
   * Get immutable document and verify
   */
  static async getImmutableDocument(documentId: string) {
    const result = await query(
      'SELECT * FROM immutable_documents WHERE id = $1',
      [documentId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const document = result.rows[0];
    const content =
      typeof document.content === 'string'
        ? JSON.parse(document.content)
        : document.content;

    const computedHash = this.computeHash(content);
    const isVerified = computedHash === document.hash;

    return {
      ...document,
      content,
      hashVerified: isVerified,
    };
  }

  /**
   * Log deletion attempt
   */
  static async logDeletionAttempt(
    targetType: string,
    targetId: string,
    attemptedBy: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const attemptId = uuidv4();
    const now = new Date();
    const blocked = true; // Default to blocking

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
        attemptedBy,
        reason || null,
        now,
        blocked,
        'Deletion attempt logged and blocked for audit trail',
      ]
    );

    return result.rows[0];
  }

  /**
   * Get deletion attempts
   */
  static async getDeletionAttempts(
    filters: {
      targetType?: string;
      blockedOnly?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const { targetType, blockedOnly = true, limit = 50, offset = 0 } = filters;

    let query_string = 'SELECT * FROM deletion_attempts WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    if (targetType) {
      query_string += ` AND target_type = $${paramIndex}`;
      params.push(targetType);
      paramIndex++;
    }

    if (blockedOnly) {
      query_string += ` AND blocked = true`;
    }

    query_string += ` ORDER BY timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(query_string, params);
    return result.rows;
  }

  /**
   * Compute SHA256 hash of data
   */
  private static computeHash(data: any): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  /**
   * Verify immutable document chain
   */
  static async verifyDocumentChain(documentId: string): Promise<boolean> {
    const documents: any[] = [];
    let currentId = documentId;

    while (currentId) {
      const result = await query(
        'SELECT * FROM immutable_documents WHERE id = $1',
        [currentId]
      );

      if (result.rows.length === 0) {
        break;
      }

      const doc = result.rows[0];
      documents.unshift(doc);

      // Verify hash
      const content =
        typeof doc.content === 'string'
          ? JSON.parse(doc.content)
          : doc.content;
      const computedHash = this.computeHash(content);

      if (computedHash !== doc.hash) {
        return false;
      }

      // Find previous
      const previousResult = await query(
        'SELECT id FROM immutable_documents WHERE hash = $1',
        [doc.previous_hash]
      );

      currentId = previousResult.rows[0]?.id || null;
    }

    // Verify chain continuity
    for (let i = 1; i < documents.length; i++) {
      const prevDoc = documents[i - 1];
      const currentDoc = documents[i];

      if (prevDoc.hash !== currentDoc.previous_hash) {
        return false;
      }
    }

    return true;
  }
}

export default DeploymentService;
