// Key Rotation API Routes
// Admin endpoints for managing encryption key rotation

import express, { Request, Response } from 'express';
import {
  executeKeyRotation,
  rollbackKeyRotation,
  testKeyRotation,
  getRotationJobStatus,
  getRotationHistory,
  getRotationStats,
  getAllEncryptionKeys,
} from '../services/keyRotationService';
import {
  initializeScheduler,
  startScheduler,
  stopScheduler,
  isSchedulerRunning,
  getSchedulerStatus,
  getJobStatus,
  triggerJob,
  setJobEnabled,
  updateConfig,
  getSchedulerHealth,
  getExecutionHistory,
} from '../services/keyRotationScheduler';
import { logAuditEvent } from '../services/securityService';
import { queryParam, routeParam } from '../utils/httpParams';

const router = express.Router();

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Require admin role
 */
async function requireAdmin(req: Request, res: Response, next: any) {
  // In production, verify JWT token and check admin role
  const userType = req.headers['x-user-type'] || 'user';

  if (userType !== 'admin' && userType !== 'system') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  // Store user info for logging
  (req as any).userId = req.headers['x-user-id'];
  (req as any).userAgent = req.headers['user-agent'];
  (req as any).ip = req.ip;

  next();
}

router.use(requireAdmin);

// ============================================
// KEY ROTATION MANUAL OPERATIONS
// ============================================

/**
 * POST /api/key-rotation/rotate
 * Manually trigger immediate key rotation
 */
router.post('/rotate', async (req: Request, res: Response) => {
  try {
    const { force } = req.body;

    console.log('🔄 Manual key rotation requested');

    const result = await executeKeyRotation(
      (req as any).userId,
      (req as any).userAgent,
      (req as any).ip
    );

    if (!result && !force) {
      return res.status(400).json({
        error: 'Key rotation not yet needed',
        message: 'Keys are rotated monthly. Use force: true to override.',
      });
    }

    res.json({
      success: true,
      jobId: result?.jobId,
      status: result?.status,
      message: 'Key rotation initiated',
    });
  } catch (error) {
    console.error('Manual key rotation failed:', error);

    res.status(500).json({
      error: 'Key rotation failed',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/key-rotation/rollback/:jobId
 * Rollback a key rotation job
 */
router.post('/rollback/:jobId', async (req: Request, res: Response) => {
  try {
    const jobId = routeParam(req.params.jobId);
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Rollback reason required' });
    }

    console.log(`⏮️ Rolling back key rotation: ${jobId}`);

    await rollbackKeyRotation(
      jobId,
      reason,
      (req as any).userId,
      (req as any).userAgent,
      (req as any).ip
    );

    res.json({
      success: true,
      jobId,
      message: 'Key rotation rolled back successfully',
    });
  } catch (error) {
    console.error('Rollback failed:', error);

    res.status(500).json({
      error: 'Rollback failed',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/key-rotation/test
 * Test key rotation process without committing
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    console.log('🧪 Testing key rotation process');

    const result = await testKeyRotation();

    await logAuditEvent({
      userId: (req as any).userId,
      action: 'key_rotation_test',
      ip: (req as any).ip,
      userAgent: (req as any).userAgent,
      details: result,
    });

    res.json({
      success: result.success,
      testDuration: result.testDuration,
      message: result.message,
      oldKeyVersion: result.oldKeyVersion,
      newKeyVersion: result.newKeyVersion,
    });
  } catch (error) {
    console.error('Key rotation test failed:', error);

    res.status(500).json({
      error: 'Test failed',
      message: (error as Error).message,
    });
  }
});

// ============================================
// KEY ROTATION STATUS AND HISTORY
// ============================================

/**
 * GET /api/key-rotation/status/:jobId
 * Get status of a specific rotation job
 */
router.get('/status/:jobId', async (req: Request, res: Response) => {
  try {
    const jobId = routeParam(req.params.jobId);
    const job = await getRotationJobStatus(jobId);

    res.json({
      success: true,
      job,
    });
  } catch (error) {
    console.error('Failed to get job status:', error);

    res.status(404).json({
      error: 'Job not found',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/key-rotation/history
 * Get rotation job history
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const limit = queryParam(req.query.limit);
    const history = await getRotationHistory(parseInt(limit as string));

    res.json({
      success: true,
      count: history.length,
      history,
    });
  } catch (error) {
    console.error('Failed to get rotation history:', error);

    res.status(500).json({
      error: 'Failed to retrieve history',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/key-rotation/stats
 * Get key rotation statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getRotationStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Failed to get rotation stats:', error);

    res.status(500).json({
      error: 'Failed to retrieve stats',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/key-rotation/keys
 * Get all encryption keys
 */
router.get('/keys', async (req: Request, res: Response) => {
  try {
    const keys = await getAllEncryptionKeys();

    // Don't expose the actual encrypted key data
    const sanitized = keys.map((key) => ({
      keyId: key.keyId,
      version: key.version,
      algorithm: key.algorithm,
      status: key.status,
      createdAt: key.createdAt,
      rotatedAt: key.rotatedAt,
      archivedAt: key.archivedAt,
    }));

    res.json({
      success: true,
      count: sanitized.length,
      keys: sanitized,
    });
  } catch (error) {
    console.error('Failed to get encryption keys:', error);

    res.status(500).json({
      error: 'Failed to retrieve keys',
      message: (error as Error).message,
    });
  }
});

// ============================================
// SCHEDULER MANAGEMENT
// ============================================

/**
 * POST /api/key-rotation/scheduler/initialize
 * Initialize the scheduler
 */
router.post('/scheduler/initialize', async (req: Request, res: Response) => {
  try {
    const { config } = req.body;

    console.log('📋 Initializing scheduler with config:', config);

    await initializeScheduler(config);

    await logAuditEvent({
      userId: (req as any).userId,
      action: 'scheduler_initialized',
      ip: (req as any).ip,
      userAgent: (req as any).userAgent,
      details: { config },
    });

    res.json({
      success: true,
      message: 'Scheduler initialized',
      status: getSchedulerStatus(),
    });
  } catch (error) {
    console.error('Scheduler initialization failed:', error);

    res.status(500).json({
      error: 'Initialization failed',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/key-rotation/scheduler/start
 * Start the scheduler
 */
router.post('/scheduler/start', (req: Request, res: Response) => {
  try {
    if (isSchedulerRunning()) {
      return res.status(400).json({
        error: 'Scheduler is already running',
      });
    }

    startScheduler();

    logAuditEvent({
      userId: (req as any).userId,
      action: 'scheduler_started',
      ip: (req as any).ip,
      userAgent: (req as any).userAgent,
    }).catch(console.error);

    res.json({
      success: true,
      message: 'Scheduler started',
      status: getSchedulerStatus(),
    });
  } catch (error) {
    console.error('Failed to start scheduler:', error);

    res.status(500).json({
      error: 'Failed to start scheduler',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/key-rotation/scheduler/stop
 * Stop the scheduler
 */
router.post('/scheduler/stop', (req: Request, res: Response) => {
  try {
    if (!isSchedulerRunning()) {
      return res.status(400).json({
        error: 'Scheduler is not running',
      });
    }

    stopScheduler();

    logAuditEvent({
      userId: (req as any).userId,
      action: 'scheduler_stopped',
      ip: (req as any).ip,
      userAgent: (req as any).userAgent,
    }).catch(console.error);

    res.json({
      success: true,
      message: 'Scheduler stopped',
      status: getSchedulerStatus(),
    });
  } catch (error) {
    console.error('Failed to stop scheduler:', error);

    res.status(500).json({
      error: 'Failed to stop scheduler',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/key-rotation/scheduler/status
 * Get scheduler status
 */
router.get('/scheduler/status', (req: Request, res: Response) => {
  try {
    const status = getSchedulerStatus();

    res.json({
      success: true,
      running: isSchedulerRunning(),
      ...status,
    });
  } catch (error) {
    console.error('Failed to get scheduler status:', error);

    res.status(500).json({
      error: 'Failed to retrieve status',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/key-rotation/scheduler/health
 * Get scheduler health status
 */
router.get('/scheduler/health', async (req: Request, res: Response) => {
  try {
    const health = await getSchedulerHealth();

    const statusCode = health.recentErrors > 5 ? 503 : 200;

    res.status(statusCode).json({
      success: statusCode === 200,
      ...health,
    });
  } catch (error) {
    console.error('Failed to get scheduler health:', error);

    res.status(500).json({
      error: 'Failed to retrieve health status',
      message: (error as Error).message,
    });
  }
});

/**
 * POST /api/key-rotation/scheduler/trigger/:jobName
 * Manually trigger a scheduler job
 */
router.post('/scheduler/trigger/:jobName', async (req: Request, res: Response) => {
  try {
    const jobName = routeParam(req.params.jobName);

    console.log(`⚡ Manually triggering job: ${jobName}`);

    await triggerJob(jobName);

    await logAuditEvent({
      userId: (req as any).userId,
      action: 'scheduler_job_triggered',
      resourceId: jobName,
      ip: (req as any).ip,
      userAgent: (req as any).userAgent,
    });

    res.json({
      success: true,
      jobName,
      message: `Job ${jobName} triggered`,
    });
  } catch (error) {
    console.error('Failed to trigger job:', error);

    res.status(400).json({
      error: 'Failed to trigger job',
      message: (error as Error).message,
    });
  }
});

/**
 * PUT /api/key-rotation/scheduler/job/:jobName
 * Enable/disable a scheduler job
 */
router.put('/scheduler/job/:jobName', (req: Request, res: Response) => {
  try {
    const jobName = routeParam(req.params.jobName);
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'enabled must be a boolean',
      });
    }

    setJobEnabled(jobName, enabled);

    const jobStatus = getJobStatus(jobName);

    res.json({
      success: true,
      jobName,
      enabled,
      job: jobStatus,
    });
  } catch (error) {
    console.error('Failed to update job:', error);

    res.status(400).json({
      error: 'Failed to update job',
      message: (error as Error).message,
    });
  }
});

/**
 * PUT /api/key-rotation/scheduler/config
 * Update scheduler configuration
 */
router.put('/scheduler/config', (req: Request, res: Response) => {
  try {
    const { config } = req.body;

    updateConfig(config);

    await logAuditEvent({
      userId: (req as any).userId,
      action: 'scheduler_config_updated',
      ip: (req as any).ip,
      userAgent: (req as any).userAgent,
      details: { config },
    }).catch(console.error);

    res.json({
      success: true,
      message: 'Scheduler configuration updated',
      status: getSchedulerStatus(),
    });
  } catch (error) {
    console.error('Failed to update scheduler config:', error);

    res.status(500).json({
      error: 'Failed to update configuration',
      message: (error as Error).message,
    });
  }
});

/**
 * GET /api/key-rotation/scheduler/execution-history
 * Get execution history
 */
router.get('/scheduler/execution-history', (req: Request, res: Response) => {
  try {
    const limit = queryParam(req.query.limit); const job = queryParam(req.query.job);

    const history = getExecutionHistory(
      parseInt(limit as string),
      job as string
    );

    res.json({
      success: true,
      count: history.length,
      history,
    });
  } catch (error) {
    console.error('Failed to get execution history:', error);

    res.status(500).json({
      error: 'Failed to retrieve history',
      message: (error as Error).message,
    });
  }
});

// ============================================
// ERROR HANDLING
// ============================================

router.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Key rotation API error:', err);

  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

export default router;
