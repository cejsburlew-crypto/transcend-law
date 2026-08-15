/**
 * INTEGRATION EXAMPLE
 * How to integrate the Deployment System into your Express.js application
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { initializeDatabase, closePool } from './src/database/connection';
import { authMiddleware, requireUserType } from './src/middleware/authMiddleware';
import deploymentRouter from './src/routes/deployment';

// ============================================
// BASIC SETUP
// ============================================

/**
 * Setup 1: Complete Integration in Main App
 */
export async function setupDeploymentSystem(app: Express) {
  // Initialize database with deployment schema
  await initializeDatabase();

  // Mount deployment routes with auth middleware
  app.use('/api/admin', authMiddleware);
  app.use('/api/admin', deploymentRouter);

  // Optional: Add specific role-based routes
  app.get('/api/admin/dashboard', requireUserType('admin'), (req: Request, res: Response) => {
    res.json({ message: 'Admin dashboard' });
  });

  console.log('✅ Deployment system initialized');
}

/**
 * Setup 2: Modular Integration with Versioning
 */
export function setupDeploymentV2Router(app: Express) {
  // v2 API with deployment system
  const v2Router = express.Router();

  v2Router.use(authMiddleware);
  v2Router.use('/deployments', deploymentRouter);

  app.use('/api/v2', v2Router);
}

// ============================================
// MIDDLEWARE INTEGRATION
// ============================================

/**
 * Enhanced error handler for deployment routes
 */
export function deploymentErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('[Deployment Error]', {
    message: err.message,
    path: req.path,
    method: req.method,
    userId: req.userId,
    timestamp: new Date().toISOString(),
  });

  // Specific error handling
  if (err.message.includes('Deployment not found')) {
    return res.status(404).json({
      error: 'Deployment not found',
      statusCode: 404,
    });
  }

  if (err.message.includes('No previous deployment')) {
    return res.status(400).json({
      error: 'No previous deployment found for rollback',
      statusCode: 400,
    });
  }

  // Generic error
  res.status(500).json({
    error: 'Deployment operation failed',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    statusCode: 500,
  });
}

/**
 * Activity logging middleware
 */
export function deploymentActivityLogger(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Capture response
  const originalJson = res.json;

  res.json = function (data: any) {
    // Log successful operations
    if (res.statusCode < 400 && req.userId) {
      const isWriteOperation = ['POST', 'PUT', 'DELETE'].includes(req.method);

      if (isWriteOperation) {
        console.log('[Deployment Activity]', {
          userId: req.userId,
          action: req.method,
          path: req.path,
          status: res.statusCode,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return originalJson.call(this, data);
  };

  next();
}

/**
 * Rate limiting for deployment endpoints
 */
export function deploymentRateLimit(req: Request, res: Response, next: NextFunction) {
  // In production, use express-rate-limit
  // Example: 10 deployments/hour per admin user
  next();
}

// ============================================
// EXAMPLE: COMPLETE EXPRESS APP
// ============================================

export async function createDeploymentApp(): Promise<Express> {
  const app = express();

  // Standard middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    next();
  });

  // Custom middleware
  app.use(deploymentActivityLogger);
  app.use(deploymentRateLimit);

  // Initialize database
  await initializeDatabase();

  // Mount deployment routes
  app.use('/api/admin', authMiddleware);
  app.use('/api/admin', deploymentRouter);

  // Health check
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'deployment-system' });
  });

  // Error handling
  app.use(deploymentErrorHandler);

  return app;
}

// ============================================
// USAGE EXAMPLES IN APPLICATION
// ============================================

/**
 * Example 1: Trigger deployment from within app
 */
export async function triggerDeployment() {
  const fetch = (await import('node-fetch')).default;

  const response = await fetch('http://localhost:3000/api/admin/deployment-request', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.ADMIN_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      environmentId: 'production',
      deploymentType: 'feature',
      description: 'Deploy new feature X',
      scheduledAt: new Date(Date.now() + 3600000), // 1 hour from now
    }),
  });

  const deployment = await response.json();
  return deployment;
}

/**
 * Example 2: Monitor deployment status
 */
export async function monitorDeployment(deploymentId: string) {
  const fetch = (await import('node-fetch')).default;

  const interval = setInterval(async () => {
    const response = await fetch(
      `http://localhost:3000/api/admin/deployments/${deploymentId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.ADMIN_TOKEN}`,
        },
      }
    );

    const { deployment } = await response.json();

    console.log(`[Deployment ${deploymentId}]`, {
      status: deployment.status,
      completed_at: deployment.completed_at,
      error_message: deployment.error_message,
    });

    if (['completed', 'failed', 'rolled_back'].includes(deployment.status)) {
      clearInterval(interval);

      // Handle completion
      if (deployment.status === 'failed') {
        // Trigger rollback
        await rollbackDeployment(deploymentId, 'Deployment failed');
      }
    }
  }, 30000); // Check every 30 seconds
}

/**
 * Example 3: Automatic rollback on failure
 */
export async function rollbackDeployment(deploymentId: string, reason: string) {
  const fetch = (await import('node-fetch')).default;

  const response = await fetch(
    `http://localhost:3000/api/admin/rollback/${deploymentId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason }),
    }
  );

  const rollback = await response.json();
  console.log('🔄 Rollback completed:', rollback);
  return rollback;
}

/**
 * Example 4: Log user activity
 */
export async function logUserActivity(
  userId: string,
  token: string,
  action: string,
  resource: string,
  resourceId: string,
  changes: Record<string, any>
) {
  const fetch = (await import('node-fetch')).default;

  const response = await fetch('http://localhost:3000/api/admin/activity-log', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action,
      resource,
      resourceId,
      changes,
      // Optionally include GPS if available
      gpsCoordinates: {
        latitude: 40.7128,
        longitude: -74.006,
      },
    }),
  });

  const activityLog = await response.json();
  return activityLog;
}

/**
 * Example 5: Get deployment metrics
 */
export async function getDeploymentMetrics(token: string, days: number = 30) {
  const fetch = (await import('node-fetch')).default;

  const response = await fetch(
    `http://localhost:3000/api/admin/deployment-metrics?days=${days}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );

  const metrics = await response.json();
  return metrics;
}

/**
 * Example 6: Create audit document
 */
export async function createAuditDocument(
  token: string,
  deploymentId: string,
  manifest: Record<string, any>
) {
  const fetch = (await import('node-fetch')).default;

  const response = await fetch('http://localhost:3000/api/admin/immutable-documents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      documentType: 'deployment_manifest',
      content: {
        ...manifest,
        deploymentId,
        timestamp: new Date().toISOString(),
      },
    }),
  });

  const document = await response.json();
  return document;
}

// ============================================
// SERVER STARTUP
// ============================================

/**
 * Start deployment system server
 */
export async function startDeploymentServer() {
  try {
    const app = await createDeploymentApp();
    const PORT = process.env.PORT || 3000;

    const server = app.listen(PORT, () => {
      console.log(`🚀 Deployment system running on port ${PORT}`);
      console.log(`📊 Metrics available at http://localhost:${PORT}/api/admin/deployment-metrics`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down gracefully...');
      server.close(async () => {
        await closePool();
        process.exit(0);
      });
    });

    return server;
  } catch (error) {
    console.error('❌ Failed to start deployment system:', error);
    process.exit(1);
  }
}

// ============================================
// ENV VARIABLES NEEDED
// ============================================

/**
 * Required environment variables:
 *
 * Database:
 * - DB_USER: PostgreSQL user
 * - DB_PASSWORD: PostgreSQL password
 * - DB_HOST: PostgreSQL host
 * - DB_PORT: PostgreSQL port (default 5432)
 * - DB_NAME: Database name
 *
 * Server:
 * - PORT: Server port (default 3000)
 * - NODE_ENV: 'development' or 'production'
 * - ADMIN_TOKEN: JWT token for admin operations
 *
 * CORS:
 * - ALLOWED_ORIGINS: Comma-separated list of allowed origins
 */

// ============================================
// TESTING
// ============================================

/**
 * Test the deployment system
 */
export async function testDeploymentSystem() {
  console.log('\n🧪 Testing Deployment System...\n');

  const token = process.env.ADMIN_TOKEN || 'test-token';

  // Test 1: Create deployment
  console.log('Test 1: Creating deployment...');
  const deployment = await triggerDeployment();
  console.log('✅ Deployment created:', deployment.deployment?.id);

  // Test 2: Get deployment
  if (deployment.deployment?.id) {
    console.log('\nTest 2: Getting deployment...');
    // await monitorDeployment(deployment.deployment.id);
    console.log('✅ Deployment retrieved');
  }

  // Test 3: Get metrics
  console.log('\nTest 3: Getting metrics...');
  const metrics = await getDeploymentMetrics(token);
  console.log('✅ Metrics:', metrics.metrics?.successRate + '%');

  // Test 4: Create audit document
  console.log('\nTest 4: Creating audit document...');
  if (deployment.deployment?.id) {
    const doc = await createAuditDocument(token, deployment.deployment.id, {
      version: '1.0.0',
      changes: ['feat: new feature'],
    });
    console.log('✅ Audit document created:', doc.immutableDocument?.id);
  }

  console.log('\n✅ All tests completed!\n');
}

// Run if executed directly
if (require.main === module) {
  startDeploymentServer().catch(console.error);
}

export default setupDeploymentSystem;
