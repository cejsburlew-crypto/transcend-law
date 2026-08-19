// Payment Routes
// Clover subscription and payment handling

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { getCloverService } from '../services/cloverService';
import { query } from '../database/connection';

// NOTE: `req.user!` / `req.userId!` assertions are sound - this router applies
// authentication middleware, so no handler runs without an authenticated user.

const router = Router();

/**
 * POST /api/v2/payments/subscribe
 * Create or update subscription
 */
router.post('/subscribe', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { planType, billingCycle } = req.body;
    const userId = req.userId!;

    if (!planType || !['basic', 'professional', 'enterprise'].includes(planType)) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    const clover = getCloverService();

    // Get or create Clover customer
    let customerResult = await query(
      `SELECT clover_customer_id FROM subscriptions WHERE user_id = $1`,
      [userId]
    );

    let customerId = customerResult.rows[0]?.clover_customer_id;

    if (!customerId) {
      // Get user info
      const userInfo = await query(
        'SELECT email, first_name, last_name FROM users WHERE id = $1',
        [userId]
      );

      const user = userInfo.rows[0];
      customerId = await clover.createCustomer(
        userId,
        user.email,
        `${user.first_name} ${user.last_name}`
      );

      // Update subscription with Clover customer ID
      await query(
        `UPDATE subscriptions SET clover_customer_id = $1 WHERE user_id = $2`,
        [customerId, userId]
      );
    }

    // Create subscription
    const result = await clover.createSubscription(userId, planType, customerId);

    return res.json({
      success: true,
      subscriptionId: result.subscriptionId,
      status: result.status,
      planType,
      billingCycle: billingCycle || 'monthly',
    });
  } catch (error: any) {
    console.error('Subscription error:', error);
    return res.status(500).json({ error: error.message || 'Subscription failed' });
  }
});

/**
 * GET /api/v2/payments/subscription
 * Get current subscription
 */
router.get('/subscription', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const result = await query(
      `SELECT * FROM subscriptions WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ subscription: null });
    }

    const subscription = result.rows[0];

    return res.json({
      subscription: {
        id: subscription.id,
        planType: subscription.plan_type,
        status: subscription.status,
        pricePerMonth: subscription.price_per_month,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        autoRenew: subscription.auto_renew,
        createdAt: subscription.created_at,
      },
    });
  } catch (error: any) {
    console.error('Error fetching subscription:', error);
    return res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

/**
 * POST /api/v2/payments/upgrade
 * Upgrade to higher tier plan
 */
router.post('/upgrade', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { newPlanType } = req.body;
    const userId = req.userId!;

    if (!newPlanType || !['basic', 'professional', 'enterprise'].includes(newPlanType)) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }

    const clover = getCloverService();

    // Get current subscription
    const subResult = await query(
      `SELECT * FROM subscriptions WHERE user_id = $1`,
      [userId]
    );

    if (subResult.rows.length === 0) {
      return res.status(400).json({ error: 'No active subscription' });
    }

    const currentSub = subResult.rows[0];

    // Create new subscription with upgraded plan
    const result = await clover.createSubscription(
      userId,
      newPlanType,
      currentSub.clover_customer_id
    );

    // Update database
    await query(
      `UPDATE subscriptions SET plan_type = $1, updated_at = NOW() WHERE user_id = $2`,
      [newPlanType, userId]
    );

    return res.json({
      success: true,
      newPlan: newPlanType,
      subscriptionId: result.subscriptionId,
    });
  } catch (error: any) {
    console.error('Upgrade error:', error);
    return res.status(500).json({ error: error.message || 'Upgrade failed' });
  }
});

/**
 * GET /api/v2/payments/invoices
 * Get payment history/invoices
 */
router.get('/invoices', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const subResult = await query(
      `SELECT * FROM subscriptions WHERE user_id = $1`,
      [userId]
    );

    if (subResult.rows.length === 0) {
      return res.json({ invoices: [] });
    }

    const subscription = subResult.rows[0];
    const clover = getCloverService();

    // Get transactions from Clover
    const transactions = await clover.getTransactions(
      subscription.clover_customer_id
    );

    const invoices = transactions.map((t: any) => ({
      id: t.id,
      amount: (t.amount || 0) / 100,
      status: t.result || 'pending',
      createdAt: new Date(t.createdTime),
      description: t.note || t.reference,
    }));

    return res.json({ invoices });
  } catch (error: any) {
    console.error('Error fetching invoices:', error);
    return res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

/**
 * POST /api/v2/payments/webhook
 * Handle Clover webhook events
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const event = req.body;

    // Verify webhook signature (implement Clover signature verification)
    // For now, just log and process

    const clover = getCloverService();
    await clover.handleWebhookEvent(event);

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * POST /api/v2/payments/cancel
 * Cancel subscription
 */
router.post('/cancel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    // Update subscription status
    await query(
      `UPDATE subscriptions SET status = $1, cancelled_at = NOW() WHERE user_id = $2`,
      ['cancelled', userId]
    );

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Cancel error:', error);
    return res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

/**
 * GET /api/v2/payments/plans
 * Get available subscription plans
 */
router.get('/plans', async (req: Request, res: Response) => {
  try {
    const plans = [
      {
        type: 'basic',
        name: 'Basic',
        price: 29,
        billing: 'month',
        features: [
          'Up to 5 active cases',
          'Basic attorney matching',
          'Email notifications',
          'Standard support',
        ],
      },
      {
        type: 'professional',
        name: 'Professional',
        price: 99,
        billing: 'month',
        features: [
          'Unlimited cases',
          'Priority attorney matching',
          'Real-time notifications',
          'Document storage (10GB)',
          'Video consultations',
          'Priority support',
        ],
      },
      {
        type: 'enterprise',
        name: 'Enterprise',
        price: 299,
        billing: 'month',
        features: [
          'Unlimited everything',
          'Dedicated account manager',
          'Custom integrations',
          'Document storage (100GB)',
          'Advanced analytics',
          '24/7 priority support',
        ],
      },
    ];

    return res.json({ plans });
  } catch (error: any) {
    console.error('Error fetching plans:', error);
    return res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

export default router;
