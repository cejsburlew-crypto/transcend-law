// Stripe Payment Service
// Subscription management, payments, and webhooks

import Stripe from 'stripe';
import { query } from '../database/connection';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
});

// ============================================
// SUBSCRIPTION PLANS
// ============================================

export const SUBSCRIPTION_PLANS = {
  basic: {
    name: 'Basic',
    priceMonthly: 29,
    priceAnnual: 290, // 20% discount
    stripePriceIdMonthly: process.env.STRIPE_PRICE_BASIC_MONTHLY || '',
    stripePriceIdAnnual: process.env.STRIPE_PRICE_BASIC_ANNUAL || '',
    features: [
      'Up to 5 active cases',
      'Basic attorney matching',
      'Email notifications',
      'Standard support',
    ],
  },
  professional: {
    name: 'Professional',
    priceMonthly: 99,
    priceAnnual: 990,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY || '',
    stripePriceIdAnnual: process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL || '',
    features: [
      'Unlimited cases',
      'Priority attorney matching',
      'Real-time notifications',
      'Document storage (10GB)',
      'Video consultations',
      'Priority support',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    priceMonthly: 299,
    priceAnnual: 2990,
    stripePriceIdMonthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || '',
    stripePriceIdAnnual: process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL || '',
    features: [
      'Unlimited everything',
      'Dedicated account manager',
      'Custom integrations',
      'Document storage (100GB)',
      'Advanced analytics',
      '24/7 priority support',
    ],
  },
};

// ============================================
// CUSTOMER MANAGEMENT
// ============================================

export async function createStripeCustomer(
  userId: string,
  email: string,
  name?: string
): Promise<string> {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        userId,
      },
    });

    return customer.id;
  } catch (error) {
    console.error('Failed to create Stripe customer:', error);
    throw error;
  }
}

export async function getStripeCustomer(stripeCustomerId: string) {
  try {
    return await stripe.customers.retrieve(stripeCustomerId);
  } catch (error) {
    console.error('Failed to retrieve customer:', error);
    throw error;
  }
}

// ============================================
// SUBSCRIPTION MANAGEMENT
// ============================================

export async function createSubscription(
  userId: string,
  planType: 'basic' | 'professional' | 'enterprise',
  billingCycle: 'monthly' | 'annual' = 'monthly'
): Promise<{ subscriptionId: string; clientSecret?: string }> {
  try {
    // Get user's Stripe customer ID
    const userResult = await query(
      `SELECT s.stripe_customer_id FROM subscriptions s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );

    let customerId = userResult.rows[0]?.stripe_customer_id;

    if (!customerId) {
      // Get user info
      const userInfo = await query(
        'SELECT email, first_name, last_name FROM users WHERE id = $1',
        [userId]
      );

      const user = userInfo.rows[0];
      customerId = await createStripeCustomer(
        userId,
        user.email,
        `${user.first_name} ${user.last_name}`
      );
    }

    // Get plan details
    const plan = SUBSCRIPTION_PLANS[planType];
    const priceId =
      billingCycle === 'annual'
        ? plan.stripePriceIdAnnual
        : plan.stripePriceIdMonthly;

    if (!priceId) {
      throw new Error(`Price ID not configured for ${planType} ${billingCycle}`);
    }

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });

    // Save to database
    await query(
      `INSERT INTO subscriptions
       (user_id, plan_type, stripe_customer_id, stripe_subscription_id, status, price_per_month)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
       plan_type = $2, stripe_subscription_id = $4`,
      [
        userId,
        planType,
        customerId,
        subscription.id,
        subscription.status,
        billingCycle === 'annual' ? plan.priceAnnual / 12 : plan.priceMonthly,
      ]
    );

    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = invoice?.payment_intent as Stripe.PaymentIntent;

    return {
      subscriptionId: subscription.id,
      clientSecret: paymentIntent?.client_secret,
    };
  } catch (error) {
    console.error('Failed to create subscription:', error);
    throw error;
  }
}

export async function upgradeSubscription(
  userId: string,
  newPlanType: 'basic' | 'professional' | 'enterprise',
  billingCycle: 'monthly' | 'annual' = 'monthly'
): Promise<void> {
  try {
    // Get current subscription
    const subResult = await query(
      'SELECT stripe_subscription_id FROM subscriptions WHERE user_id = $1',
      [userId]
    );

    if (subResult.rows.length === 0) {
      throw new Error('No active subscription found');
    }

    const subscriptionId = subResult.rows[0].stripe_subscription_id;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    if (!subscription.items.data[0]) {
      throw new Error('Invalid subscription structure');
    }

    const plan = SUBSCRIPTION_PLANS[newPlanType];
    const priceId =
      billingCycle === 'annual'
        ? plan.stripePriceIdAnnual
        : plan.stripePriceIdMonthly;

    // Update subscription with proration
    await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: priceId,
        },
      ],
      proration_behavior: 'create_prorations',
    });

    // Update database
    await query(
      'UPDATE subscriptions SET plan_type = $1 WHERE user_id = $2',
      [newPlanType, userId]
    );
  } catch (error) {
    console.error('Failed to upgrade subscription:', error);
    throw error;
  }
}

export async function cancelSubscription(userId: string): Promise<void> {
  try {
    const subResult = await query(
      'SELECT stripe_subscription_id FROM subscriptions WHERE user_id = $1',
      [userId]
    );

    if (subResult.rows.length === 0) {
      throw new Error('No subscription found');
    }

    const subscriptionId = subResult.rows[0].stripe_subscription_id;

    // Cancel at period end
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    // Update database
    await query(
      `UPDATE subscriptions SET status = $1, cancelled_at = NOW()
       WHERE user_id = $2`,
      ['cancelled', userId]
    );
  } catch (error) {
    console.error('Failed to cancel subscription:', error);
    throw error;
  }
}

export async function getSubscription(userId: string) {
  try {
    const result = await query(
      `SELECT * FROM subscriptions WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const sub = result.rows[0];
    const plan = SUBSCRIPTION_PLANS[sub.plan_type as keyof typeof SUBSCRIPTION_PLANS];

    return {
      ...sub,
      planDetails: plan,
    };
  } catch (error) {
    console.error('Failed to get subscription:', error);
    throw error;
  }
}

// ============================================
// PAYMENT INTENTS
// ============================================

export async function createPaymentIntent(
  userId: string,
  amount: number,
  description: string,
  metadata?: Record<string, string>
): Promise<string> {
  try {
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: 'usd',
      description,
      metadata: {
        userId,
        ...metadata,
      },
    });

    return intent.client_secret || '';
  } catch (error) {
    console.error('Failed to create payment intent:', error);
    throw error;
  }
}

// ============================================
// INVOICES
// ============================================

export async function getInvoices(userId: string): Promise<any[]> {
  try {
    const subResult = await query(
      'SELECT stripe_subscription_id FROM subscriptions WHERE user_id = $1',
      [userId]
    );

    if (subResult.rows.length === 0) {
      return [];
    }

    const subscription = await stripe.subscriptions.retrieve(
      subResult.rows[0].stripe_subscription_id
    );

    const invoices = await stripe.invoices.list({
      subscription: subscription.id,
      limit: 12,
    });

    return invoices.data.map((invoice) => ({
      id: invoice.id,
      amount: invoice.amount_paid,
      status: invoice.status,
      paidAt: new Date(invoice.paid_at || 0),
      dueAt: new Date(invoice.due_date || 0),
      invoiceUrl: invoice.hosted_invoice_url,
      description: invoice.description,
    }));
  } catch (error) {
    console.error('Failed to get invoices:', error);
    throw error;
  }
}

// ============================================
// WEBHOOK HANDLERS
// ============================================

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  try {
    switch (event.type) {
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`✅ Subscription ${event.type}:`, subscription.id);

        // Update database
        const status = subscription.status;
        const customerId = subscription.customer as string;

        await query(
          `UPDATE subscriptions SET status = $1, updated_at = NOW()
           WHERE stripe_customer_id = $2`,
          [status, customerId]
        );
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('✅ Subscription cancelled:', subscription.id);

        await query(
          `UPDATE subscriptions SET status = $1, cancelled_at = NOW()
           WHERE stripe_subscription_id = $2`,
          ['cancelled', subscription.id]
        );
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('✅ Invoice paid:', invoice.id);

        // Save invoice record
        const subResult = await query(
          'SELECT user_id FROM subscriptions WHERE stripe_subscription_id = $1',
          [invoice.subscription]
        );

        if (subResult.rows.length > 0) {
          await query(
            `INSERT INTO invoices (subscription_id, stripe_invoice_id, amount, status, paid_at)
             SELECT id, $2, $3, $4, NOW() FROM subscriptions WHERE user_id = $1`,
            [subResult.rows[0].user_id, invoice.id, invoice.amount_paid, 'paid']
          );
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.warn('❌ Invoice payment failed:', invoice.id);

        // TODO: Send email notification to user
        break;
      }

      default:
        console.log('Unhandled webhook event:', event.type);
    }
  } catch (error) {
    console.error('Webhook handler error:', error);
    throw error;
  }
}

// ============================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================

export function verifyWebhookSignature(
  body: string,
  signature: string
): Stripe.Event {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
    return stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error: any) {
    console.error('Webhook signature verification failed:', error.message);
    throw error;
  }
}

export default {
  createSubscription,
  upgradeSubscription,
  cancelSubscription,
  getSubscription,
  createPaymentIntent,
  getInvoices,
  handleWebhookEvent,
  verifyWebhookSignature,
  SUBSCRIPTION_PLANS,
};
