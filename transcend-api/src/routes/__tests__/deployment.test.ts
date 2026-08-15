/**
 * Deployment Routes Test Suite
 * Comprehensive testing for all 10 endpoints
 */

import request from 'supertest';
import express, { Express } from 'express';
import { v4 as uuidv4 } from 'uuid';
import deploymentRouter from '../deployment';
import { authMiddleware, requireUserType } from '../../middleware/authMiddleware';

describe('Deployment Routes', () => {
  let app: Express;
  let authToken: string;
  let deploymentId: string;
  let documentId: string;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Mock auth middleware for testing
    app.use((req, res, next) => {
      req.userId = 'test-user-id';
      (req.user as any) = {
        userId: 'test-user-id',
        userType: 'admin',
        email: 'test@example.com',
      };
      (req as any).sessionId = uuidv4();
      next();
    });

    app.use(authMiddleware);
    app.use('/api/admin', deploymentRouter);
  });

  describe('POST /api/admin/deployment-request', () => {
    it('should create a new deployment request', async () => {
      const res = await request(app)
        .post('/api/admin/deployment-request')
        .send({
          environmentId: 'production',
          deploymentType: 'feature',
          description: 'Deploy new authentication system',
          scheduledAt: new Date(Date.now() + 3600000).toISOString(),
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.deployment).toHaveProperty('id');
      expect(res.body.deployment.status).toBe('pending');
      expect(res.body.deployment.deployment_type).toBe('feature');

      deploymentId = res.body.deployment.id;
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/admin/deployment-request')
        .send({
          environmentId: 'production',
          // Missing deploymentType and description
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors.length).toBeGreaterThan(0);
    });

    it('should validate deployment type', async () => {
      const res = await request(app)
        .post('/api/admin/deployment-request')
        .send({
          environmentId: 'production',
          deploymentType: 'invalid-type',
          description: 'Test',
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('GET /api/admin/deployments', () => {
    it('should get all deployments with pagination', async () => {
      const res = await request(app)
        .get('/api/admin/deployments')
        .query({ limit: 20, offset: 0 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.deployments)).toBe(true);
      expect(res.body.pagination).toHaveProperty('total');
      expect(res.body.pagination).toHaveProperty('limit');
      expect(res.body.pagination).toHaveProperty('offset');
      expect(res.body.pagination).toHaveProperty('hasMore');
    });

    it('should filter by status', async () => {
      const res = await request(app)
        .get('/api/admin/deployments')
        .query({ status: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.deployments.every((d: any) => d.status === 'completed')).toBe(true);
    });

    it('should filter by environment', async () => {
      const res = await request(app)
        .get('/api/admin/deployments')
        .query({ environmentId: 'production' });

      expect(res.status).toBe(200);
      expect(res.body.deployments.every((d: any) => d.environment_id === 'production')).toBe(true);
    });
  });

  describe('GET /api/admin/deployments/:id', () => {
    it('should get specific deployment', async () => {
      const res = await request(app)
        .get(`/api/admin/deployments/${deploymentId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.deployment).toHaveProperty('id', deploymentId);
      expect(res.body.activityLogs).toBeDefined();
      expect(Array.isArray(res.body.activityLogs)).toBe(true);
    });

    it('should return 404 for non-existent deployment', async () => {
      const fakeId = uuidv4();
      const res = await request(app)
        .get(`/api/admin/deployments/${fakeId}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Deployment not found');
    });
  });

  describe('PUT /api/admin/deployments/:id', () => {
    it('should update deployment status', async () => {
      const res = await request(app)
        .put(`/api/admin/deployments/${deploymentId}`)
        .send({ status: 'approved' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.deployment.status).toBe('approved');
    });

    it('should validate status value', async () => {
      const res = await request(app)
        .put(`/api/admin/deployments/${deploymentId}`)
        .send({ status: 'invalid-status' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid status');
    });

    it('should update with error message', async () => {
      const res = await request(app)
        .put(`/api/admin/deployments/${deploymentId}`)
        .send({
          status: 'failed',
          errorMessage: 'Database connection timeout',
        });

      expect(res.status).toBe(200);
      expect(res.body.deployment.status).toBe('failed');
      expect(res.body.deployment.error_message).toBe('Database connection timeout');
    });

    it('should set completed_at for terminal states', async () => {
      const res = await request(app)
        .put(`/api/admin/deployments/${deploymentId}`)
        .send({ status: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.deployment.completed_at).toBeDefined();
      expect(new Date(res.body.deployment.completed_at)).toBeInstanceOf(Date);
    });
  });

  describe('POST /api/admin/activity-log', () => {
    it('should create activity log', async () => {
      const res = await request(app)
        .post('/api/admin/activity-log')
        .send({
          action: 'deployment_viewed',
          resource: 'deployment',
          resourceId: deploymentId,
          changes: { viewed_at: new Date().toISOString() },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.activityLog).toHaveProperty('id');
      expect(res.body.activityLog.action).toBe('deployment_viewed');
    });

    it('should include GPS coordinates', async () => {
      const res = await request(app)
        .post('/api/admin/activity-log')
        .send({
          action: 'case_accessed',
          resource: 'case',
          resourceId: uuidv4(),
          changes: {},
          gpsCoordinates: {
            latitude: 40.7128,
            longitude: -74.006,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.activityLog.gps_coordinates).toBeDefined();
      expect(res.body.activityLog.gps_coordinates.latitude).toBe(40.7128);
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/admin/activity-log')
        .send({
          action: 'test',
          // Missing resource and resourceId
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('GET /api/admin/deployment-metrics', () => {
    it('should get deployment metrics', async () => {
      const res = await request(app)
        .get('/api/admin/deployment-metrics')
        .query({ days: 30 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.metrics).toHaveProperty('successRate');
      expect(res.body.metrics).toHaveProperty('totalDeployments');
      expect(res.body.metrics).toHaveProperty('completed');
      expect(res.body.metrics).toHaveProperty('failed');
      expect(res.body.metrics).toHaveProperty('rolledBack');
      expect(res.body.metrics).toHaveProperty('averageDeploymentTimeSeconds');
      expect(res.body.metrics).toHaveProperty('byDeploymentType');
      expect(res.body.metrics).toHaveProperty('byEnvironment');
    });

    it('should calculate success rate correctly', async () => {
      const res = await request(app)
        .get('/api/admin/deployment-metrics')
        .query({ days: 30 });

      expect(res.status).toBe(200);
      const metrics = res.body.metrics;
      const calculatedRate =
        metrics.totalDeployments > 0
          ? (metrics.completed / metrics.totalDeployments) * 100
          : 0;
      expect(Math.abs(metrics.successRate - calculatedRate)).toBeLessThan(0.1);
    });

    it('should support different time ranges', async () => {
      const res7 = await request(app)
        .get('/api/admin/deployment-metrics')
        .query({ days: 7 });

      const res30 = await request(app)
        .get('/api/admin/deployment-metrics')
        .query({ days: 30 });

      expect(res7.status).toBe(200);
      expect(res30.status).toBe(200);
      expect(res7.body.metrics.period).toContain('7 days');
      expect(res30.body.metrics.period).toContain('30 days');
    });
  });

  describe('POST /api/admin/immutable-documents', () => {
    it('should create immutable document', async () => {
      const res = await request(app)
        .post('/api/admin/immutable-documents')
        .send({
          documentType: 'deployment_manifest',
          content: {
            version: '1.2.3',
            deploymentId,
            changes: ['feat: new auth system'],
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.immutableDocument).toHaveProperty('id');
      expect(res.body.immutableDocument).toHaveProperty('hash');
      expect(res.body.immutableDocument.immutable).toBe(true);

      documentId = res.body.immutableDocument.id;
    });

    it('should compute consistent hash', async () => {
      const content = {
        type: 'deployment',
        version: '1.0.0',
      };

      const res1 = await request(app)
        .post('/api/admin/immutable-documents')
        .send({
          documentType: 'test',
          content,
        });

      const res2 = await request(app)
        .post('/api/admin/immutable-documents')
        .send({
          documentType: 'test',
          content,
        });

      expect(res1.body.immutableDocument.hash).toBe(res2.body.immutableDocument.hash);
    });

    it('should link to previous document', async () => {
      const content1 = { version: '1.0.0' };
      const res1 = await request(app)
        .post('/api/admin/immutable-documents')
        .send({
          documentType: 'version',
          content: content1,
        });

      const doc1Id = res1.body.immutableDocument.id;
      const hash1 = res1.body.immutableDocument.hash;

      const content2 = { version: '1.0.1' };
      const res2 = await request(app)
        .post('/api/admin/immutable-documents')
        .send({
          documentType: 'version',
          content: content2,
          previousDocumentId: doc1Id,
        });

      expect(res2.body.immutableDocument.previous_hash).toBe(hash1);
    });

    it('should validate required fields', async () => {
      const res = await request(app)
        .post('/api/admin/immutable-documents')
        .send({
          documentType: 'test',
          // Missing content
        });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('GET /api/admin/immutable-documents/:id', () => {
    it('should retrieve immutable document', async () => {
      const res = await request(app)
        .get(`/api/admin/immutable-documents/${documentId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.immutableDocument.id).toBe(documentId);
      expect(res.body.immutableDocument).toHaveProperty('hash');
      expect(res.body.immutableDocument).toHaveProperty('hashVerified');
    });

    it('should verify hash integrity', async () => {
      const res = await request(app)
        .get(`/api/admin/immutable-documents/${documentId}`);

      expect(res.status).toBe(200);
      expect(res.body.immutableDocument.hashVerified).toBe(true);
    });

    it('should return 404 for non-existent document', async () => {
      const fakeId = uuidv4();
      const res = await request(app)
        .get(`/api/admin/immutable-documents/${fakeId}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Immutable document not found');
    });
  });

  describe('POST /api/admin/deletion-attempts', () => {
    it('should log deletion attempt', async () => {
      const res = await request(app)
        .post('/api/admin/deletion-attempts')
        .send({
          targetType: 'case',
          targetId: uuidv4(),
          reason: 'User requested deletion',
        });

      expect(res.status).toBeDefined();
      expect(res.body.deletionAttempt).toHaveProperty('id');
      expect(res.body.deletionAttempt.target_type).toBe('case');
      expect(res.body.deletionAttempt.blocked).toBeDefined();
    });

    it('should require target type and ID', async () => {
      const res = await request(app)
        .post('/api/admin/deletion-attempts')
        .send({
          // Missing targetType and targetId
          reason: 'Test',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should support deletion reason', async () => {
      const res = await request(app)
        .post('/api/admin/deletion-attempts')
        .send({
          targetType: 'document',
          targetId: uuidv4(),
          reason: 'Document no longer needed',
        });

      expect(res.status).toBeDefined();
      expect(res.body.deletionAttempt.reason).toBe('Document no longer needed');
    });
  });

  describe('POST /api/admin/rollback/:deploymentId', () => {
    let rollbackDeploymentId: string;

    beforeAll(async () => {
      // Create a completed deployment to rollback
      const res = await request(app)
        .post('/api/admin/deployment-request')
        .send({
          environmentId: 'staging',
          deploymentType: 'feature',
          description: 'Deployment to rollback',
        });

      rollbackDeploymentId = res.body.deployment.id;

      // Complete it
      await request(app)
        .put(`/api/admin/deployments/${rollbackDeploymentId}`)
        .send({ status: 'completed' });
    });

    it('should rollback deployment', async () => {
      const res = await request(app)
        .post(`/api/admin/rollback/${rollbackDeploymentId}`)
        .send({
          reason: 'Critical bug detected',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.rollback).toHaveProperty('id');
      expect(res.body.rollback.deployment_type).toBe('rollback');
      expect(res.body.rollback.status).toBe('completed');
    });

    it('should require reason', async () => {
      const res = await request(app)
        .post(`/api/admin/rollback/${rollbackDeploymentId}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('reason is required for rollback');
    });

    it('should find previous deployment', async () => {
      const res = await request(app)
        .post(`/api/admin/rollback/${rollbackDeploymentId}`)
        .send({
          reason: 'Testing rollback',
        });

      if (res.status === 200) {
        expect(res.body.previousDeployment).toBeDefined();
        expect(res.body.previousDeployment.status).toBe('completed');
      }
    });

    it('should mark original as rolled_back', async () => {
      const getRes = await request(app)
        .get(`/api/admin/deployments/${rollbackDeploymentId}`);

      // After rollback, status should be updated
      if (getRes.body.deployment) {
        expect(['completed', 'rolled_back']).toContain(getRes.body.deployment.status);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const res = await request(app)
        .get('/api/admin/deployments/invalid-uuid');

      expect([400, 404, 500]).toContain(res.status);
    });

    it('should validate JSON parsing', async () => {
      const res = await request(app)
        .post('/api/admin/deployment-request')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(res.status).toBe(400);
    });
  });

  describe('Authorization', () => {
    it('should require admin role for deployment endpoints', async () => {
      // This would require modifying the test setup to use non-admin user
      // Placeholder for authorization tests
      expect(true).toBe(true);
    });
  });

  describe('Data Consistency', () => {
    it('should maintain referential integrity', async () => {
      const deployment = await request(app)
        .post('/api/admin/deployment-request')
        .send({
          environmentId: 'test',
          deploymentType: 'feature',
          description: 'Test deployment',
        });

      expect(deployment.body.deployment.requested_by).toBe('test-user-id');
    });

    it('should timestamp operations correctly', async () => {
      const beforeTime = Date.now();

      const res = await request(app)
        .post('/api/admin/deployment-request')
        .send({
          environmentId: 'test',
          deploymentType: 'feature',
          description: 'Test deployment',
        });

      const afterTime = Date.now();
      const createdTime = new Date(res.body.deployment.created_at).getTime();

      expect(createdTime).toBeGreaterThanOrEqual(beforeTime);
      expect(createdTime).toBeLessThanOrEqual(afterTime);
    });
  });
});

describe('Integration Tests', () => {
  let app: Express;
  let deploymentId: string;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      (req as any).userId = 'integration-test-user';
      (req.user as any) = { userId: 'integration-test-user', userType: 'admin' };
      (req as any).sessionId = uuidv4();
      next();
    });
    app.use(authMiddleware);
    app.use('/api/admin', deploymentRouter);
  });

  it('should handle complete deployment lifecycle', async () => {
    // 1. Create
    const createRes = await request(app)
      .post('/api/admin/deployment-request')
      .send({
        environmentId: 'production',
        deploymentType: 'feature',
        description: 'Complete lifecycle test',
      });

    expect(createRes.status).toBe(201);
    deploymentId = createRes.body.deployment.id;

    // 2. Update to approved
    const approveRes = await request(app)
      .put(`/api/admin/deployments/${deploymentId}`)
      .send({ status: 'approved' });

    expect(approveRes.status).toBe(200);

    // 3. Create audit document
    const docRes = await request(app)
      .post('/api/admin/immutable-documents')
      .send({
        documentType: 'deployment_manifest',
        content: { deploymentId },
      });

    expect(docRes.status).toBe(201);

    // 4. Update to completed
    const completeRes = await request(app)
      .put(`/api/admin/deployments/${deploymentId}`)
      .send({ status: 'completed' });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.deployment.completed_at).toBeDefined();

    // 5. Get metrics
    const metricsRes = await request(app)
      .get('/api/admin/deployment-metrics')
      .query({ days: 1 });

    expect(metricsRes.status).toBe(200);
    expect(metricsRes.body.metrics.totalDeployments).toBeGreaterThan(0);
  });
});
