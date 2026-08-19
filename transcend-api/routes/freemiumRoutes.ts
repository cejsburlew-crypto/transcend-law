// Freemium API Routes
// Endpoints for subscription management, usage tracking, and upgrade flow

import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  createUserSubscription,
  getUserSubscription,
  upgradeSubscription,
  checkFeatureLimit,
  generateUpgradePromptContext,
  trackConversionEvent,
  getConversionFunnelMetrics,
  getFeatureComparison,
  getPricingTiers,
  getTrialRemainingDays,
  extendTrialPeriod,
  getUsageStats,
  incrementCaseCount,
  incrementDocumentCount,
  updateStorageUsage,
  ConversionEvent,
} from '../services/freemiumService';
import { logAction } from '../services/auditLogger';
import { queryParam, routeParam } from '../src/utils/httpParams';

const router = Router();

// Middleware to ensure user is authenticated
router.use(authenticateToken);

// ============================================
// SUBSCRIPTION ENDPOINTS
// ============================================

/**
 * GET /api/v2/freemium/subscription
 * Get current user subscription details
 */
router.get('/subscription', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const subscription = await getUserSubscription(userId);
    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const usage = await getUsageStats(userId);
    const trialDaysRemaining = await getTrialRemainingDays(userId);

    res.json({
      subscription,
      usage,
      trialDaysRemaining,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v2/freemium/subscription/create
 * Create initial subscription for new user
 */
router.post('/subscription/create', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { tier = 'free', includeFreeTrial = true } = req.body;

    // Check if subscription already exists
    const existing = await getUserSubscription(userId);
    if (existing) {
      return res.status(400).json({ error: 'Subscription already exists' });
    }

    const subscription = await createUserSubscription(userId, tier, includeFreeTrial);

    await logAction(userId, 'subscription_created', {
      tier,
      includeFreeTrial,
    });

    res.status(201).json(subscription);
  } catch (error) {
    next(error);
  }
});

// ============================================
// USAGE TRACKING ENDPOINTS
// ============================================

/**
 * POST /api/v2/freemium/usage/increment-case
 * Track case creation
 */
router.post(
  '/usage/increment-case',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { count = 1 } = req.body;

      // Check limit before incrementing
      const featureCheck = await checkFeatureLimit(userId, 'Cases');
      if (!featureCheck.allowed) {
        return res.status(402).json({
          error: 'Case limit reached',
          limit: featureCheck.limit,
          current: featureCheck.current,
          requiresUpgrade: true,
        });
      }

      await incrementCaseCount(userId, count);

      const usage = await getUsageStats(userId);
      res.json({ success: true, usage });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v2/freemium/usage/increment-document
 * Track document upload
 */
router.post(
  '/usage/increment-document',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { count = 1, storageMB = 0 } = req.body;

      // Check limits
      const casesCheck = await checkFeatureLimit(userId, 'Documents');
      const storageCheck = await checkFeatureLimit(userId, 'Storage');

      if (!casesCheck.allowed) {
        return res.status(402).json({
          error: 'Document limit reached',
          limit: casesCheck.limit,
          current: casesCheck.current,
        });
      }

      if (!storageCheck.allowed) {
        return res.status(402).json({
          error: 'Storage limit reached',
          limit: storageCheck.limit,
          current: storageCheck.current,
        });
      }

      await incrementDocumentCount(userId, count);
      if (storageMB > 0) {
        await updateStorageUsage(userId, storageMB);
      }

      const usage = await getUsageStats(userId);
      res.json({ success: true, usage });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v2/freemium/usage
 * Get current usage statistics
 */
router.get('/usage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const usage = await getUsageStats(userId);
    res.json(usage);
  } catch (error) {
    next(error);
  }
});

// ============================================
// FEATURE LIMITS ENDPOINTS
// ============================================

/**
 * GET /api/v2/freemium/features
 * Get feature comparison and pricing tiers
 */
router.get('/features', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const comparison = getFeatureComparison();
    const pricingTiers = getPricingTiers();

    res.json({
      features: comparison.features,
      pricingTiers,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v2/freemium/check-limit/:feature
 * Check if user has hit feature limit
 */
router.get(
  '/check-limit/:feature',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const feature = routeParam(req.params.feature);

      const featureCheck = await checkFeatureLimit(userId, feature);
      const subscription = await getUserSubscription(userId);

      res.json({
        ...featureCheck,
        tier: subscription?.tier,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v2/freemium/upgrade-prompt/:feature
 * Generate upgrade prompt context for a feature
 */
router.get(
  '/upgrade-prompt/:feature',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const feature = routeParam(req.params.feature);

      const promptContext = await generateUpgradePromptContext(userId, feature);
      if (!promptContext) {
        return res.status(404).json({ error: 'Subscription not found' });
      }

      await trackConversionEvent(userId, 'prompt_shown', {
        feature,
      });

      res.json(promptContext);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// UPGRADE ENDPOINTS
// ============================================

/**
 * POST /api/v2/freemium/upgrade
 * Upgrade user to paid tier
 */
router.post('/upgrade', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { newTier, billingCycle = 'monthly' } = req.body;

    if (!newTier || !['pro', 'enterprise'].includes(newTier)) {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    const upgraded = await upgradeSubscription(userId, newTier, billingCycle);

    await trackConversionEvent(userId, 'payment_completed', {
      tier: newTier,
      billingCycle,
    });

    res.json({
      success: true,
      subscription: upgraded,
      message: `Successfully upgraded to ${newTier} tier`,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// TRIAL ENDPOINTS
// ============================================

/**
 * POST /api/v2/freemium/extend-trial
 * Extend user trial by 7 days
 */
router.post('/extend-trial', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const subscription = await getUserSubscription(userId);
    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    if (!subscription.isTrialActive) {
      return res.status(400).json({ error: 'Trial is not active' });
    }

    await extendTrialPeriod(userId, 7);
    const daysRemaining = await getTrialRemainingDays(userId);

    await trackConversionEvent(userId, 'trial_extended', {
      daysAdded: 7,
    });

    res.json({
      success: true,
      trialDaysRemaining: daysRemaining,
      message: 'Trial extended by 7 days',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v2/freemium/trial-remaining
 * Get days remaining in trial
 */
router.get(
  '/trial-remaining',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const daysRemaining = await getTrialRemainingDays(userId);

      res.json({
        daysRemaining,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// CONVERSION TRACKING ENDPOINTS
// ============================================

/**
 * POST /api/v2/freemium/track
 * Track conversion events
 */
router.post('/track', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { event, metadata } = req.body;

    if (!event || !['prompt_shown', 'comparison_viewed', 'upgrade_clicked', 'payment_completed', 'upgrade_cancelled', 'trial_started'].includes(event)) {
      return res.status(400).json({ error: 'Invalid event type' });
    }

    const metrics = await trackConversionEvent(userId, event as ConversionEvent, metadata);

    res.json({ success: true, metrics });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v2/freemium/analytics/funnel
 * Get conversion funnel metrics (admin only)
 */
router.get(
  '/analytics/funnel',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Verify admin access
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const startDate = queryParam(req.query.startDate); const endDate = queryParam(req.query.endDate);

      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      const metrics = await getConversionFunnelMetrics(start, end);

      res.json(metrics);
    } catch (error) {
      next(error);
    }
  }
);

// ============================================
// ERROR HANDLER
// ============================================

router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Freemium route error:', error);

  // Specific error handling
  if (error.message.includes('subscription_consistency')) {
    return res.status(400).json({ error: 'Invalid subscription state' });
  }

  if (error.message.includes('Not authorized')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.status(500).json({
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
  });
});

export default router;
