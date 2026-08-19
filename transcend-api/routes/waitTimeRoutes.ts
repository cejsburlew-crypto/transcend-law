// Wait Time Analytics Routes
// API endpoints for wait time tracking, metrics, and alerts

import express, { Request, Response, Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import * as waitTimeService from '../services/waitTimeService';
import { queryParam, routeParam } from '../src/utils/httpParams';

const router: Router = express.Router();

// Middleware to require authentication
router.use(authenticateToken);

// ============================================
// TIMESTAMP TRACKING ENDPOINTS
// ============================================

/**
 * POST /api/wait-times/client-arrival
 * Record a client arrival
 */
router.post('/client-arrival', async (req: Request, res: Response) => {
  try {
    const { caseId, clientId, providerId, serviceType } = req.body;

    if (!caseId || !clientId || !providerId || !serviceType) {
      return res.status(400).json({
        error: 'Missing required fields: caseId, clientId, providerId, serviceType',
      });
    }

    const event = await waitTimeService.recordClientArrival(
      caseId,
      clientId,
      providerId,
      serviceType
    );

    res.status(201).json(event);
  } catch (error) {
    console.error('Error recording client arrival:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to record client arrival',
    });
  }
});

/**
 * POST /api/wait-times/:eventId/provider-response
 * Record provider response
 */
router.post('/:eventId/provider-response', async (req: Request, res: Response) => {
  try {
    const eventId = routeParam(req.params.eventId);
    const { providerId } = req.body;

    if (!providerId) {
      return res.status(400).json({
        error: 'Missing required field: providerId',
      });
    }

    const event = await waitTimeService.recordProviderResponse(eventId, providerId);

    res.json(event);
  } catch (error) {
    console.error('Error recording provider response:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to record provider response',
    });
  }
});

/**
 * POST /api/wait-times/:eventId/completion
 * Record service completion
 */
router.post('/:eventId/completion', async (req: Request, res: Response) => {
  try {
    const eventId = routeParam(req.params.eventId);
    const { providerId } = req.body;

    if (!providerId) {
      return res.status(400).json({
        error: 'Missing required field: providerId',
      });
    }

    const event = await waitTimeService.recordServiceCompletion(eventId, providerId);

    res.json(event);
  } catch (error) {
    console.error('Error recording service completion:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to record service completion',
    });
  }
});

// ============================================
// WAIT TIME CALCULATION ENDPOINTS
// ============================================

/**
 * GET /api/wait-times/current
 * Get current wait times (optionally filtered by caseId or providerId)
 */
router.get('/current', async (req: Request, res: Response) => {
  try {
    const caseId = queryParam(req.query.caseId); const providerId = queryParam(req.query.providerId);

    // This would typically query the database
    // For now, returning the structure
    res.json({
      message: 'Implement database query for current wait times',
      filters: { caseId, providerId },
    });
  } catch (error) {
    console.error('Error fetching current wait times:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch current wait times',
    });
  }
});

/**
 * GET /api/wait-times/:eventId
 * Get a specific wait time event
 */
router.get('/:eventId', async (req: Request, res: Response) => {
  try {
    const eventId = routeParam(req.params.eventId);

    const waitTime = await waitTimeService.getCurrentWaitTime(eventId);

    if (waitTime === null) {
      return res.status(404).json({
        error: 'Wait time event not found',
      });
    }

    res.json({ eventId, currentWaitTimeSeconds: waitTime });
  } catch (error) {
    console.error('Error fetching wait time:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch wait time',
    });
  }
});

// ============================================
// PROVIDER METRICS ENDPOINTS
// ============================================

/**
 * GET /api/wait-times/metrics/:providerId
 * Get comprehensive provider metrics
 */
router.get('/metrics/:providerId', async (req: Request, res: Response) => {
  try {
    const providerId = routeParam(req.params.providerId);
    const daysBack = queryParam(req.query.daysBack);

    const days = daysBack ? parseInt(daysBack as string) : 30;
    const metrics = await waitTimeService.generateProviderMetrics(providerId, days);

    res.json(metrics);
  } catch (error) {
    console.error('Error generating provider metrics:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate provider metrics',
    });
  }
});

/**
 * GET /api/wait-times/metrics
 * Get metrics for top providers
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const limit = queryParam(req.query.limit); const daysBack = queryParam(req.query.daysBack);

    const topLimit = limit ? parseInt(limit as string) : 10;
    const days = daysBack ? parseInt(daysBack as string) : 30;

    const topProviders = await waitTimeService.getTopProvidersByPerformance(topLimit, days);

    res.json(topProviders);
  } catch (error) {
    console.error('Error fetching top providers:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch top providers',
    });
  }
});

/**
 * GET /api/wait-times/average/:providerId
 * Get average wait times for a provider
 */
router.get('/average/:providerId', async (req: Request, res: Response) => {
  try {
    const providerId = routeParam(req.params.providerId);
    const daysBack = queryParam(req.query.daysBack);

    const days = daysBack ? parseInt(daysBack as string) : 30;
    const averages = await waitTimeService.getProviderAverageWaitTimes(providerId, days);

    res.json(averages);
  } catch (error) {
    console.error('Error calculating average wait times:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to calculate averages',
    });
  }
});

// ============================================
// SATISFACTION CORRELATION ENDPOINTS
// ============================================

/**
 * GET /api/wait-times/satisfaction-correlation
 * Get correlation between wait times and satisfaction
 */
router.get('/satisfaction-correlation', async (req: Request, res: Response) => {
  try {
    const daysBack = queryParam(req.query.daysBack);

    const days = daysBack ? parseInt(daysBack as string) : 30;
    const correlation = await waitTimeService.correlateWaitTimesWithSatisfaction(days);

    res.json(correlation);
  } catch (error) {
    console.error('Error calculating satisfaction correlation:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to calculate correlation',
    });
  }
});

// ============================================
// ALERT MANAGEMENT ENDPOINTS
// ============================================

/**
 * GET /api/wait-times/alerts
 * Get active alerts (optionally filtered by providerId)
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const providerId = queryParam(req.query.providerId);

    const alerts = await waitTimeService.getActiveAlerts(providerId as string | undefined);

    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch alerts',
    });
  }
});

/**
 * PATCH /api/wait-times/alerts/:alertId/acknowledge
 * Acknowledge an alert
 */
router.patch('/alerts/:alertId/acknowledge', async (req: Request, res: Response) => {
  try {
    const alertId = routeParam(req.params.alertId);
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'User ID required',
      });
    }

    const alert = await waitTimeService.acknowledgeAlert(alertId, userId);

    res.json(alert);
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to acknowledge alert',
    });
  }
});

/**
 * PATCH /api/wait-times/alerts/:alertId/resolve
 * Resolve an alert
 */
router.patch('/alerts/:alertId/resolve', async (req: Request, res: Response) => {
  try {
    const alertId = routeParam(req.params.alertId);

    const alert = await waitTimeService.resolveAlert(alertId);

    res.json(alert);
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to resolve alert',
    });
  }
});

// ============================================
// HISTORICAL ANALYTICS ENDPOINTS
// ============================================

/**
 * GET /api/wait-times/analytics/:period
 * Get historical analytics for a period (YYYY-MM format)
 */
router.get('/analytics/:period', async (req: Request, res: Response) => {
  try {
    const period = routeParam(req.params.period);

    // Validate period format
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({
        error: 'Invalid period format. Use YYYY-MM format',
      });
    }

    const analytics = await waitTimeService.generateHistoricalAnalytics(period);

    res.json(analytics);
  } catch (error) {
    console.error('Error generating historical analytics:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate analytics',
    });
  }
});

export default router;
