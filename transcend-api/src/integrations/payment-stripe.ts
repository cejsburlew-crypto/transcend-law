// Stripe Payment Integration

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

export const stripeIntegration = {
  // Create payment intent for subscription or case payment
  createPaymentIntent: async (amount: number, description: string, metadata: any) => {
    try {
      const intent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        description,
        metadata,
      });
      return { success: true, clientSecret: intent.client_secret };
    } catch (error) {
      console.error('Stripe error:', error);
      return { success: false, error: 'Payment failed' };
    }
  },

  // Create subscription
  createSubscription: async (customerId: string, priceId: string) => {
    try {
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
      });
      return { success: true, subscriptionId: subscription.id };
    } catch (error) {
      console.error('Subscription error:', error);
      return { success: false, error: 'Subscription failed' };
    }
  },

  // Handle webhook events
  handleWebhook: (event: any) => {
    switch (event.type) {
      case 'payment_intent.succeeded':
        console.log('Payment succeeded:', event.data.object);
        // TODO: Update database with payment confirmation
        break;
      case 'customer.subscription.updated':
        console.log('Subscription updated:', event.data.object);
        // TODO: Update subscription in database
        break;
      case 'invoice.payment_failed':
        console.log('Payment failed:', event.data.object);
        // TODO: Send renewal notification
        break;
    }
  },
};
