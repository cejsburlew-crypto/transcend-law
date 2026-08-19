// Status Page API Routes
// Public endpoints for system status, incidents, and maintenance

import express, { Router, Request, Response } from 'express';
import Redis from 'ioredis';
import { createStatusPageService } from '../services/statusPage';
import { logger } from '../utils/logger';
import { routeParam } from '../utils/httpParams';

// Initialize Redis client
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

// Create status page service
const statusPageService = createStatusPageService(redisClient, {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS,
});

const router: Router = express.Router();

// ============================================================================
// Public Endpoints (No Authentication)
// ============================================================================

/**
 * GET /api/v2/status/system
 * Get overall system status
 */
router.get('/system', async (req: Request, res: Response) => {
  try {
    const status = await statusPageService.getSystemStatus();
    res.json(status);
  } catch (error) {
    logger.error('Failed to get system status:', error);
    res.status(500).json({ error: 'Failed to retrieve system status' });
  }
});

/**
 * GET /api/v2/status/components
 * Get all system components
 */
router.get('/components', async (req: Request, res: Response) => {
  try {
    const components = await statusPageService.getAllComponents();
    res.json(components);
  } catch (error) {
    logger.error('Failed to get components:', error);
    res.status(500).json({ error: 'Failed to retrieve components' });
  }
});

/**
 * GET /api/v2/status/components/:id
 * Get specific component status
 */
router.get('/components/:id', async (req: Request, res: Response) => {
  try {
    const id = routeParam(req.params.id);
    const component = await statusPageService.getComponent(id);

    if (!component) {
      return res.status(404).json({ error: 'Component not found' });
    }

    res.json(component);
  } catch (error) {
    logger.error('Failed to get component:', error);
    res.status(500).json({ error: 'Failed to retrieve component' });
  }
});

/**
 * GET /api/v2/status/incidents
 * Get incident history (limit 50 by default)
 */
router.get('/incidents', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const incidents = await statusPageService.getIncidentHistory(limit);
    res.json(incidents);
  } catch (error) {
    logger.error('Failed to get incidents:', error);
    res.status(500).json({ error: 'Failed to retrieve incidents' });
  }
});

/**
 * GET /api/v2/status/incidents/active
 * Get active incidents only
 */
router.get('/incidents/active', async (req: Request, res: Response) => {
  try {
    const incidents = await statusPageService.getActiveIncidents();
    res.json(incidents);
  } catch (error) {
    logger.error('Failed to get active incidents:', error);
    res.status(500).json({ error: 'Failed to retrieve active incidents' });
  }
});

/**
 * GET /api/v2/status/maintenance
 * Get scheduled maintenance
 */
router.get('/maintenance', async (req: Request, res: Response) => {
  try {
    const maintenance = await statusPageService.getUpcomingMaintenance();
    res.json(maintenance);
  } catch (error) {
    logger.error('Failed to get maintenance:', error);
    res.status(500).json({ error: 'Failed to retrieve maintenance' });
  }
});

/**
 * GET /api/v2/status/metrics
 * Get status page metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await statusPageService.getMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('Failed to get metrics:', error);
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
});

/**
 * POST /api/v2/status/subscribe
 * Subscribe to status notifications
 */
router.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const { email, notifyAll, notifyIncidents, notifyMaintenance } = req.body;

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const subscription = await statusPageService.subscribeToNotifications(
      email,
      notifyAll !== false,
      notifyIncidents !== false,
      notifyMaintenance !== false
    );

    res.status(201).json({
      message: 'Subscription created. Check your email to verify.',
      subscriptionId: subscription.id,
    });
  } catch (error) {
    logger.error('Failed to create subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

/**
 * GET /api/v2/status/verify/:subscriptionId
 * Verify subscription email
 */
router.get('/verify/:subscriptionId', async (req: Request, res: Response) => {
  try {
    const subscriptionId = routeParam(req.params.subscriptionId);

    await statusPageService.verifySubscription(subscriptionId);

    res.json({
      message: 'Subscription verified successfully!',
      status: 'verified',
    });
  } catch (error) {
    logger.error('Failed to verify subscription:', error);
    res.status(500).json({ error: 'Failed to verify subscription' });
  }
});

// ============================================================================
// Admin Endpoints (Would need authentication in production)
// ============================================================================

/**
 * PUT /api/v2/status/components/:id
 * Update component status (Admin only)
 */
router.put('/components/:id', async (req: Request, res: Response) => {
  try {
    // TODO: Add authentication middleware
    const id = routeParam(req.params.id);
    const { status, uptime, responseTime, description } = req.body;

    const component = await statusPageService.getComponent(id);
    if (!component) {
      return res.status(404).json({ error: 'Component not found' });
    }

    if (status) component.status = status;
    if (uptime !== undefined) component.uptime = uptime;
    if (responseTime !== undefined) component.responseTime = responseTime;
    if (description) component.description = description;
    component.lastUpdate = new Date();

    await statusPageService.updateComponent(component);

    res.json({
      message: 'Component updated',
      component,
    });
  } catch (error) {
    logger.error('Failed to update component:', error);
    res.status(500).json({ error: 'Failed to update component' });
  }
});

/**
 * POST /api/v2/status/incidents
 * Create a new incident (Admin only)
 */
router.post('/incidents', async (req: Request, res: Response) => {
  try {
    // TODO: Add authentication middleware
    const { title, description, severity, affectedComponents } = req.body;

    // Validate required fields
    if (!title || !description || !severity || !affectedComponents) {
      return res.status(400).json({
        error: 'Missing required fields: title, description, severity, affectedComponents',
      });
    }

    const incident = await statusPageService.createIncident(
      title,
      description,
      severity,
      affectedComponents
    );

    res.status(201).json({
      message: 'Incident created',
      incident,
    });
  } catch (error) {
    logger.error('Failed to create incident:', error);
    res.status(500).json({ error: 'Failed to create incident' });
  }
});

/**
 * PATCH /api/v2/status/incidents/:id
 * Update incident status (Admin only)
 */
router.patch('/incidents/:id', async (req: Request, res: Response) => {
  try {
    // TODO: Add authentication middleware
    const id = routeParam(req.params.id);
    const { status, message } = req.body;

    if (!status || !message) {
      return res.status(400).json({
        error: 'Missing required fields: status, message',
      });
    }

    const incident = await statusPageService.updateIncidentStatus(
      id,
      status,
      message
    );

    res.json({
      message: 'Incident updated',
      incident,
    });
  } catch (error) {
    logger.error('Failed to update incident:', error);
    res.status(500).json({ error: 'Failed to update incident' });
  }
});

/**
 * POST /api/v2/status/maintenance
 * Schedule maintenance (Admin only)
 */
router.post('/maintenance', async (req: Request, res: Response) => {
  try {
    // TODO: Add authentication middleware
    const {
      title,
      description,
      affectedComponents,
      scheduledStart,
      scheduledEnd,
    } = req.body;

    // Validate required fields
    if (
      !title ||
      !description ||
      !affectedComponents ||
      !scheduledStart ||
      !scheduledEnd
    ) {
      return res.status(400).json({
        error: 'Missing required fields',
      });
    }

    const maintenance = await statusPageService.scheduleMaintenance(
      title,
      description,
      affectedComponents,
      new Date(scheduledStart),
      new Date(scheduledEnd)
    );

    res.status(201).json({
      message: 'Maintenance scheduled',
      maintenance,
    });
  } catch (error) {
    logger.error('Failed to schedule maintenance:', error);
    res.status(500).json({ error: 'Failed to schedule maintenance' });
  }
});

/**
 * PATCH /api/v2/status/maintenance/:id/start
 * Start maintenance (Admin only)
 */
router.patch('/maintenance/:id/start', async (req: Request, res: Response) => {
  try {
    // TODO: Add authentication middleware
    const id = routeParam(req.params.id);

    const maintenance = await statusPageService.startMaintenance(id);

    res.json({
      message: 'Maintenance started',
      maintenance,
    });
  } catch (error) {
    logger.error('Failed to start maintenance:', error);
    res.status(500).json({ error: 'Failed to start maintenance' });
  }
});

/**
 * PATCH /api/v2/status/maintenance/:id/complete
 * Complete maintenance (Admin only)
 */
router.patch('/maintenance/:id/complete', async (req: Request, res: Response) => {
  try {
    // TODO: Add authentication middleware
    const id = routeParam(req.params.id);

    const maintenance = await statusPageService.completeMaintenance(id);

    res.json({
      message: 'Maintenance completed',
      maintenance,
    });
  } catch (error) {
    logger.error('Failed to complete maintenance:', error);
    res.status(500).json({ error: 'Failed to complete maintenance' });
  }
});

// ============================================================================
// Health Check
// ============================================================================

/**
 * GET /api/v2/status/health
 * Simple health check
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'status-page',
  });
});

export default router;
