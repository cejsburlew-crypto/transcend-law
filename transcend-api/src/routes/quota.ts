// Quota API Endpoints
// Expose quota status and management endpoints

import { Router, Request, Response } from 'express';
import { authMiddleware, requireUserType } from '../middleware/authMiddleware';
import { getQuotaStatus, setAdminQuotaOverride, PlanType } from '../middleware/rateLimitMiddleware';
import type { QuotaStatus } from '../types/quota';

const router = Router();

// Mock function to get user's plan - replace with database query
async function getUserPlan(userId: string): Promise<PlanType> {
  // TODO: Query database for user's subscription plan
  // For now, return Free plan for all users
  return PlanType.FREE;
}

// Mock function to check if user is admin
async function isAdminUser(userId: string): Promise<boolean> {
  // TODO: Query database for user role
  // For now, return false
  return false;
}

/**
 * GET /api/v2/quota/status
 * Get current quota status for authenticated user
 */
router.get('/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const plan = await getUserPlan(userId);
    const isAdmin = await isAdminUser(userId);

    const status = getQuotaStatus(userId, plan, isAdmin);

    res.json({
      success: true,
      status,
      headers: {
        'X-RateLimit-Limit': req.get('X-RateLimit-Limit'),
        'X-RateLimit-Remaining': req.get('X-RateLimit-Remaining'),
        'X-RateLimit-Reset': req.get('X-RateLimit-Reset'),
        'X-RateLimit-Usage': req.get('X-RateLimit-Usage'),
      },
    });
  } catch (error) {
    console.error('Get quota status error:', error);
    res.status(500).json({ error: 'Failed to fetch quota status' });
  }
});

/**
 * GET /api/v2/quota/history
 * Get quota usage history for the current period
 */
router.get('/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const plan = await getUserPlan(userId);
    const status = getQuotaStatus(userId, plan);

    // Mock history data - in production, query from database
    const history = {
      period: 'minute',
      periodStart: new Date(status.windowReset - 60000).toISOString(),
      periodEnd: new Date(status.windowReset).toISOString(),
      requests: status.requestsInWindow,
      limit: status.limitPerWindow,
      percentage: status.usage,
    };

    res.json({
      success: true,
      history,
      daily: {
        period: 'day',
        periodStart: new Date(status.windowReset - 24 * 60 * 60 * 1000).toISOString(),
        periodEnd: new Date(status.windowReset).toISOString(),
        requests: status.dailyRequests,
        limit: status.limitPerDay,
        percentage: (status.dailyRequests / status.limitPerDay) * 100,
      },
    });
  } catch (error) {
    console.error('Get quota history error:', error);
    res.status(500).json({ error: 'Failed to fetch quota history' });
  }
});

/**
 * POST /api/v2/quota/upgrade-check
 * Check if user should upgrade based on quota usage
 */
router.post('/upgrade-check', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const plan = await getUserPlan(userId);
    const status = getQuotaStatus(userId, plan);

    let recommendedPlan = plan;
    let recommendation = null;

    if (plan === PlanType.FREE && status.usage > 50) {
      recommendedPlan = PlanType.PRO;
      recommendation = {
        currentPlan: plan,
        recommendedPlan: PlanType.PRO,
        reason: 'Heavy usage on Free plan',
        benefits: [
          '10x more requests (100/min)',
          'Daily limits instead of per-minute',
          'Priority support',
        ],
      };
    } else if (plan === PlanType.PRO && status.usage > 80) {
      recommendedPlan = PlanType.ENTERPRISE;
      recommendation = {
        currentPlan: plan,
        recommendedPlan: PlanType.ENTERPRISE,
        reason: 'Approaching Pro plan limits',
        benefits: [
          'Unlimited requests',
          'Custom rate limiting',
          'Dedicated support',
          'Custom integrations',
        ],
      };
    }

    res.json({
      success: true,
      status,
      recommendation,
    });
  } catch (error) {
    console.error('Upgrade check error:', error);
    res.status(500).json({ error: 'Failed to check upgrade recommendation' });
  }
});

/**
 * POST /api/v2/quota/admin/override
 * Admin endpoint to override quota for a user
 * Requires admin authentication
 */
router.post(
  '/admin/override',
  authMiddleware,
  requireUserType('admin'),
  async (req: Request, res: Response) => {
    try {
      const { userId, override } = req.body;

      if (!userId || override === undefined) {
        return res.status(400).json({ error: 'Missing required fields: userId, override' });
      }

      if (typeof override !== 'boolean') {
        return res.status(400).json({ error: 'override must be a boolean' });
      }

      setAdminQuotaOverride(userId, override);

      res.json({
        success: true,
        message: `Quota override ${override ? 'enabled' : 'disabled'} for user ${userId}`,
        userId,
        override,
      });
    } catch (error) {
      console.error('Admin override error:', error);
      res.status(500).json({ error: 'Failed to set quota override' });
    }
  }
);

/**
 * GET /api/v2/quota/plans
 * Get all available plans and their quota limits
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const plans = [
      {
        id: PlanType.FREE,
        name: 'Free',
        description: 'Get started with basic API access',
        price: 0,
        billingPeriod: 'monthly',
        quotas: {
          requestsPerMinute: 10,
          requestsPerDay: 500,
          resetPeriod: 'minute',
        },
        features: [
          '10 requests/minute',
          '500 requests/day',
          'Basic support',
          'Rate limit headers',
        ],
      },
      {
        id: PlanType.PRO,
        name: 'Pro',
        description: 'Scale your application with higher limits',
        price: 29,
        billingPeriod: 'monthly',
        quotas: {
          requestsPerMinute: 100,
          requestsPerDay: 10000,
          resetPeriod: 'daily',
        },
        features: [
          '100 requests/minute',
          '10,000 requests/day',
          'Email support',
          'Quota alerts',
          'Usage analytics',
          'Graceful degradation',
        ],
      },
      {
        id: PlanType.ENTERPRISE,
        name: 'Enterprise',
        description: 'Unlimited access with dedicated support',
        price: null,
        billingPeriod: 'custom',
        quotas: {
          requestsPerMinute: Infinity,
          requestsPerDay: Infinity,
          resetPeriod: 'monthly',
        },
        features: [
          'Unlimited requests',
          'Custom rate limiting',
          'Phone & email support',
          'Custom integrations',
          'Dedicated account manager',
          'SLA guarantees',
        ],
      },
    ];

    res.json({
      success: true,
      plans,
    });
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

/**
 * GET /api/v2/quota/analytics
 * Get quota usage analytics for admin dashboard
 */
router.get(
  '/analytics',
  authMiddleware,
  requireUserType('admin'),
  async (req: Request, res: Response) => {
    try {
      // Mock analytics data - in production, query from database
      const analytics = {
        totalUsers: 1234,
        usersByPlan: {
          free: 1000,
          pro: 200,
          enterprise: 34,
        },
        averageUsage: {
          free: 45,
          pro: 72,
          enterprise: 89,
        },
        topUsedEndpoints: [
          { endpoint: '/api/v2/cases', requests: 45000, plan: 'pro' },
          { endpoint: '/api/v2/messages', requests: 38000, plan: 'pro' },
          { endpoint: '/api/v2/documents', requests: 25000, plan: 'free' },
        ],
        quotaExceededAlerts: {
          today: 12,
          thisWeek: 89,
          thisMonth: 342,
        },
      };

      res.json({
        success: true,
        analytics,
      });
    } catch (error) {
      console.error('Get analytics error:', error);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  }
);

export default router;
