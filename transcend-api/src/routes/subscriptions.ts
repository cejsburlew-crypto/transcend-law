// Subscriptions API Endpoints
// Handle subscription plans and billing

import { Router, Request, Response } from 'express';

const router = Router();

// GET /api/v2/subscriptions/plans - Get all subscription plans
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const plans = [
      {
        id: 'basic',
        name: 'Basic',
        price: 29,
        billingPeriod: 'monthly',
        features: [
          'Up to 5 consultation hours/month',
          'Basic document review',
          'Email support',
          'Case history (3 months)',
          'Attorney directory access',
        ],
      },
      {
        id: 'professional',
        name: 'Professional',
        price: 99,
        billingPeriod: 'monthly',
        features: [
          'Unlimited consultation hours',
          'Priority document review',
          '24/7 chat & phone support',
          'Full case history',
          'Attorney directory + specializations',
          'Video conferencing included',
          'Monthly legal newsletter',
        ],
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price: 299,
        billingPeriod: 'monthly',
        features: [
          'Everything in Professional',
          'Dedicated legal advisor',
          'Custom case tracking',
          'Priority attorney matching',
          'Negotiation assistance',
          'Quarterly strategy reviews',
          'Custom integrations',
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

// GET /api/v2/subscriptions/current - Get current subscription
router.get('/current', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Mock data
    const subscription = {
      id: 'sub_123',
      userId,
      planId: 'professional',
      planName: 'Professional',
      price: 99,
      status: 'active',
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      renewalDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      paymentMethod: 'Visa ending in 4242',
      autoRenew: true,
    };

    // TODO: Fetch from database

    res.json({
      success: true,
      subscription,
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// POST /api/v2/subscriptions/upgrade - Upgrade subscription
router.post('/upgrade', async (req: Request, res: Response) => {
  try {
    const { planId } = req.body;
    const userId = req.user?.id;

    if (!userId || !planId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // TODO: Process payment via Stripe
    // TODO: Update subscription in database
    // TODO: Send confirmation email

    res.json({
      success: true,
      message: 'Subscription upgraded successfully',
      planId,
    });
  } catch (error) {
    console.error('Upgrade subscription error:', error);
    res.status(500).json({ error: 'Failed to upgrade subscription' });
  }
});

export default router;
