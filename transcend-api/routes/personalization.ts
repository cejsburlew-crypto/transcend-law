// Personalization API Routes
// Endpoints for user segmentation, CTAs, journeys, and A/B testing

import { Router, Request, Response } from 'express';
import UserSegmentationService from '../services/userSegmentation';
import { authenticateJWT } from '../middleware/auth';
import { routeParam } from '../src/utils/httpParams';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

// ============================================
// USER SEGMENTATION ROUTES
// ============================================

/**
 * GET /api/v2/personalization/segment/:userId
 * Get user segmentation data
 */
router.get('/segment/:userId', async (req: Request, res: Response) => {
  try {
    const userId = routeParam(req.params.userId);

    // Verify user is accessing their own data
    if ((req as any).user.id !== userId && (req as any).user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Segment the user
    const segment = await UserSegmentationService.segmentUser(userId);

    res.json({
      success: true,
      data: segment,
    });
  } catch (error) {
    console.error('Error getting user segment:', error);
    res.status(500).json({
      error: 'Failed to get user segment',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v2/personalization/segment/:userId/refresh
 * Manually refresh user segmentation
 */
router.post('/segment/:userId/refresh', async (req: Request, res: Response) => {
  try {
    const userId = routeParam(req.params.userId);

    if ((req as any).user.id !== userId && (req as any).user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const segment = await UserSegmentationService.segmentUser(userId);

    res.json({
      success: true,
      message: 'User segment refreshed',
      data: segment,
    });
  } catch (error) {
    console.error('Error refreshing user segment:', error);
    res.status(500).json({
      error: 'Failed to refresh user segment',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// CTA ROUTES
// ============================================

/**
 * GET /api/v2/personalization/ctas/:userId
 * Get personalized CTAs for user
 */
router.get('/ctas/:userId', async (req: Request, res: Response) => {
  try {
    const userId = routeParam(req.params.userId);

    if ((req as any).user.id !== userId && (req as any).user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const ctas = await UserSegmentationService.getPersonalizedCTAs(userId);

    res.json({
      success: true,
      data: ctas,
    });
  } catch (error) {
    console.error('Error getting CTAs:', error);
    res.status(500).json({
      error: 'Failed to get CTAs',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v2/personalization/track-cta
 * Track CTA interaction
 */
router.post('/track-cta', async (req: Request, res: Response) => {
  try {
    const { userId, ctaId, action } = req.body;

    if (!userId || !ctaId || !action) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if ((req as any).user.id !== userId && (req as any).user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!['shown', 'clicked', 'converted'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    await UserSegmentationService.trackCTAInteraction(userId, ctaId, action);

    res.json({
      success: true,
      message: 'CTA interaction tracked',
    });
  } catch (error) {
    console.error('Error tracking CTA:', error);
    res.status(500).json({
      error: 'Failed to track CTA',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// JOURNEY ROUTES
// ============================================

/**
 * GET /api/v2/personalization/journey/:userId
 * Get personalized journey for user
 */
router.get('/journey/:userId', async (req: Request, res: Response) => {
  try {
    const userId = routeParam(req.params.userId);

    if ((req as any).user.id !== userId && (req as any).user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const journey = await UserSegmentationService.getPersonalizedJourney(userId);

    if (!journey) {
      return res.status(404).json({ error: 'Journey not found' });
    }

    res.json({
      success: true,
      data: journey,
    });
  } catch (error) {
    console.error('Error getting journey:', error);
    res.status(500).json({
      error: 'Failed to get journey',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// ANALYTICS ROUTES
// ============================================

/**
 * GET /api/v2/personalization/analytics/:userId
 * Get personalization analytics for user
 */
router.get('/analytics/:userId', async (req: Request, res: Response) => {
  try {
    const userId = routeParam(req.params.userId);

    if ((req as any).user.id !== userId && (req as any).user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get performance data
    const performance = await UserSegmentationService.getSegmentPerformance(userId);

    res.json({
      success: true,
      data: performance,
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({
      error: 'Failed to get analytics',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// A/B TESTING ROUTES (Admin only)
// ============================================

/**
 * POST /api/v2/personalization/ab-tests
 * Create new A/B test
 */
router.post('/ab-tests', async (req: Request, res: Response) => {
  try {
    if ((req as any).user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const testConfig = req.body;

    const abTest = await UserSegmentationService.createABTest(testConfig);

    res.status(201).json({
      success: true,
      message: 'A/B test created',
      data: abTest,
    });
  } catch (error) {
    console.error('Error creating A/B test:', error);
    res.status(500).json({
      error: 'Failed to create A/B test',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v2/personalization/ab-tests/:testId/variant/:userId
 * Get variant for A/B test
 */
router.get('/ab-tests/:testId/variant/:userId', async (req: Request, res: Response) => {
  try {
    const testId = routeParam(req.params.testId); const userId = routeParam(req.params.userId);

    if ((req as any).user.id !== userId && (req as any).user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const variant = await UserSegmentationService.getVariantForABTest(userId, testId);

    if (!variant) {
      return res.status(404).json({ error: 'Test or variant not found' });
    }

    res.json({
      success: true,
      data: variant,
    });
  } catch (error) {
    console.error('Error getting test variant:', error);
    res.status(500).json({
      error: 'Failed to get test variant',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v2/personalization/ab-tests/:testId/result
 * Record A/B test result
 */
router.post('/ab-tests/:testId/result', async (req: Request, res: Response) => {
  try {
    if ((req as any).user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const testId = routeParam(req.params.testId);
    const { variant, result } = req.body;

    if (!['variant1', 'variant2'].includes(variant)) {
      return res.status(400).json({ error: 'Invalid variant' });
    }

    await UserSegmentationService.recordABTestResult(testId, variant, result);

    res.json({
      success: true,
      message: 'A/B test result recorded',
    });
  } catch (error) {
    console.error('Error recording test result:', error);
    res.status(500).json({
      error: 'Failed to record test result',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v2/personalization/ab-tests/:testId/end
 * End A/B test and determine winner
 */
router.post('/ab-tests/:testId/end', async (req: Request, res: Response) => {
  try {
    if ((req as any).user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const testId = routeParam(req.params.testId);

    const result = await UserSegmentationService.endABTest(testId);

    res.json({
      success: true,
      message: 'A/B test ended',
      data: result,
    });
  } catch (error) {
    console.error('Error ending A/B test:', error);
    res.status(500).json({
      error: 'Failed to end A/B test',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// ADMIN DASHBOARD ROUTES (Admin only)
// ============================================

/**
 * GET /api/v2/personalization/dashboard
 * Get admin segmentation dashboard
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    if ((req as any).user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const dashboard = await UserSegmentationService.getAdminDashboard();

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    console.error('Error getting dashboard:', error);
    res.status(500).json({
      error: 'Failed to get dashboard',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v2/personalization/metrics
 * Get segmentation metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    if ((req as any).user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const metrics = await UserSegmentationService.getSegmentationMetrics();

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    console.error('Error getting metrics:', error);
    res.status(500).json({
      error: 'Failed to get metrics',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
