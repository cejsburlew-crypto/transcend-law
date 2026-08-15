// Clover Payment Service
// Subscription management, payments, and POS integration

import axios, { AxiosInstance } from 'axios';
import { query } from '../database/connection';

const CLOVER_API_URL = 'https://api.clover.com';

interface CloverConfig {
  merchantId: string;
  accessToken: string;
}

class CloverService {
  private api: AxiosInstance;
  private merchantId: string;

  constructor(config: CloverConfig) {
    this.merchantId = config.merchantId;
    this.api = axios.create({
      baseURL: CLOVER_API_URL,
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // ============================================
  // SUBSCRIPTION PLANS
  // ============================================

  async createSubscriptionPlans(): Promise<void> {
    try {
      const plans = [
        {
          name: 'Basic',
          price: 2900, // $29.00
          recurring: true,
          recurringInterval: 'MONTH',
          metadata: { plan_type: 'basic' },
        },
        {
          name: 'Professional',
          price: 9900, // $99.00
          recurring: true,
          recurringInterval: 'MONTH',
          metadata: { plan_type: 'professional' },
        },
        {
          name: 'Enterprise',
          price: 29900, // $299.00
          recurring: true,
          recurringInterval: 'MONTH',
          metadata: { plan_type: 'enterprise' },
        },
      ];

      for (const plan of plans) {
        await this.api.post(`/v1/merchants/${this.merchantId}/items`, {
          name: plan.name,
          price: plan.price,
          stockCount: 999999,
          isHidden: false,
          isReturnable: false,
          modifierGroups: [],
          metadata: plan.metadata,
        });
      }

      console.log('✅ Clover subscription plans created');
    } catch (error) {
      console.error('Failed to create subscription plans:', error);
      throw error;
    }
  }

  // ============================================
  // CUSTOMER MANAGEMENT
  // ============================================

  async createCustomer(
    userId: string,
    email: string,
    name: string
  ): Promise<string> {
    try {
      const response = await this.api.post(
        `/v1/merchants/${this.merchantId}/customers`,
        {
          firstName: name.split(' ')[0],
          lastName: name.split(' ').slice(1).join(' '),
          emailAddresses: [email],
          metadata: { user_id: userId },
        }
      );

      return response.data.id;
    } catch (error) {
      console.error('Failed to create Clover customer:', error);
      throw error;
    }
  }

  // ============================================
  // PAYMENT PROCESSING
  // ============================================

  async createPayment(
    customerId: string,
    amount: number,
    description: string,
    metadata?: Record<string, string>
  ): Promise<{ transactionId: string; status: string }> {
    try {
      const response = await this.api.post(
        `/v1/merchants/${this.merchantId}/payments`,
        {
          amount: Math.round(amount * 100), // Convert to cents
          customerId,
          tipAmount: 0,
          taxAmount: 0,
          description,
          note: description,
          metadata,
        }
      );

      return {
        transactionId: response.data.id,
        status: response.data.status,
      };
    } catch (error) {
      console.error('Failed to create payment:', error);
      throw error;
    }
  }

  // ============================================
  // SUBSCRIPTION MANAGEMENT
  // ============================================

  async createSubscription(
    userId: string,
    planType: 'basic' | 'professional' | 'enterprise',
    customerId: string
  ): Promise<{ subscriptionId: string; status: string }> {
    try {
      // Get plan item ID from Clover
      const itemsResponse = await this.api.get(
        `/v1/merchants/${this.merchantId}/items?filter=name=${planType.toUpperCase()}`
      );

      if (!itemsResponse.data.items || itemsResponse.data.items.length === 0) {
        throw new Error(`Plan ${planType} not found in Clover`);
      }

      const planItem = itemsResponse.data.items[0];

      // Create order with plan
      const orderResponse = await this.api.post(
        `/v1/merchants/${this.merchantId}/orders`,
        {
          customerId,
          lineItems: [
            {
              item: { id: planItem.id },
              quantity: '1',
            },
          ],
          metadata: {
            subscription_type: planType,
            plan_type: planType,
          },
        }
      );

      // Save to database
      await query(
        `INSERT INTO subscriptions
         (user_id, plan_type, status, price_per_month)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE SET
         plan_type = $2`,
        [userId, planType, 'active', this.getPlanPrice(planType)]
      );

      return {
        subscriptionId: orderResponse.data.id,
        status: orderResponse.data.state,
      };
    } catch (error) {
      console.error('Failed to create subscription:', error);
      throw error;
    }
  }

  // ============================================
  // INVENTORY & ORDERS
  // ============================================

  async getOrders(
    customerId?: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
      });

      if (customerId) {
        params.append('filter', `customerId=${customerId}`);
      }

      const response = await this.api.get(
        `/v1/merchants/${this.merchantId}/orders?${params.toString()}`
      );

      return response.data.elements || [];
    } catch (error) {
      console.error('Failed to get orders:', error);
      throw error;
    }
  }

  async updateOrder(
    orderId: string,
    state: 'OPEN' | 'CLOSED' | 'CANCELED'
  ): Promise<void> {
    try {
      await this.api.post(
        `/v1/merchants/${this.merchantId}/orders/${orderId}`,
        { state }
      );
    } catch (error) {
      console.error('Failed to update order:', error);
      throw error;
    }
  }

  // ============================================
  // REPORTING & ANALYTICS
  // ============================================

  async getTransactions(
    customerId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<any[]> {
    try {
      const params = new URLSearchParams();

      if (customerId) {
        params.append('filter', `customerId=${customerId}`);
      }

      if (startDate) {
        params.append('minTime', startDate.getTime().toString());
      }

      if (endDate) {
        params.append('maxTime', endDate.getTime().toString());
      }

      const response = await this.api.get(
        `/v1/merchants/${this.merchantId}/payments?${params.toString()}`
      );

      return response.data.elements || [];
    } catch (error) {
      console.error('Failed to get transactions:', error);
      throw error;
    }
  }

  async getRevenueSummary(startDate: Date, endDate: Date): Promise<any> {
    try {
      const response = await this.api.get(
        `/v1/merchants/${this.merchantId}/payments?minTime=${startDate.getTime()}&maxTime=${endDate.getTime()}`
      );

      const payments = response.data.elements || [];
      const totalRevenue = payments.reduce(
        (sum: number, p: any) => sum + (p.amount || 0),
        0
      );

      return {
        totalRevenue: totalRevenue / 100, // Convert from cents
        transactionCount: payments.length,
        period: { startDate, endDate },
      };
    } catch (error) {
      console.error('Failed to get revenue summary:', error);
      throw error;
    }
  }

  // ============================================
  // WEBHOOKS
  // ============================================

  async setupWebhook(url: string, events: string[]): Promise<string> {
    try {
      const response = await this.api.post(
        `/v1/merchants/${this.merchantId}/webhooks`,
        {
          url,
          events,
        }
      );

      return response.data.id;
    } catch (error) {
      console.error('Failed to setup webhook:', error);
      throw error;
    }
  }

  async handleWebhookEvent(event: any): Promise<void> {
    try {
      switch (event.type) {
        case 'payment.create': {
          console.log('✅ Payment created:', event.objectId);
          // Update transaction in database
          break;
        }

        case 'order.close': {
          console.log('✅ Order closed:', event.objectId);
          // Mark subscription as active
          break;
        }

        case 'order.delete': {
          console.log('✅ Order deleted:', event.objectId);
          // Mark subscription as cancelled
          break;
        }

        default:
          console.log('Webhook event:', event.type);
      }
    } catch (error) {
      console.error('Webhook handler error:', error);
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  private getPlanPrice(planType: string): number {
    const prices: { [key: string]: number } = {
      basic: 29,
      professional: 99,
      enterprise: 299,
    };
    return prices[planType] || 0;
  }

  async getCustomerSubscription(customerId: string): Promise<any> {
    try {
      const orders = await this.getOrders(customerId, 1);
      if (orders.length === 0) {
        return null;
      }

      const order = orders[0];
      return {
        id: order.id,
        customerId,
        status: order.state,
        total: (order.total || 0) / 100,
        createdAt: new Date(order.createdTime),
        metadata: order.metadata,
      };
    } catch (error) {
      console.error('Failed to get customer subscription:', error);
      return null;
    }
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let cloverService: CloverService | null = null;

export function initializeClover(): CloverService {
  if (!cloverService) {
    const merchantId = process.env.CLOVER_MERCHANT_ID;
    const accessToken = process.env.CLOVER_ACCESS_TOKEN;

    if (!merchantId || !accessToken) {
      throw new Error('Clover credentials not configured');
    }

    cloverService = new CloverService({
      merchantId,
      accessToken,
    });
  }

  return cloverService;
}

export function getCloverService(): CloverService {
  if (!cloverService) {
    throw new Error('Clover service not initialized');
  }
  return cloverService;
}

export default CloverService;
