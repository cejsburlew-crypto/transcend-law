# 💳 Clover Payment Setup Guide

**For Lawyer Website Hosting: $25/month via Clover**

---

## Overview

The Lawyer Website Hosting feature uses **Clover** for payment processing instead of Stripe.

- **Product:** Lawyer Website Hosting
- **Price:** $25/month
- **Billing Model:** Monthly recurring subscription
- **Payment Processor:** Clover

---

## Prerequisites

1. **Clover Merchant Account**
   - Sign up at https://clover.com
   - Verify business details
   - Get Merchant ID

2. **API Access**
   - Generate API Key from Clover Dashboard
   - Enable "Subscriptions" app

---

## Step 1: Create Clover Item (Product)

### Via Clover Web Dashboard

1. Go to https://merchant.clover.com
2. Log in with your merchant account
3. Navigate to **Inventory** → **Items**
4. Click **Add Item**
5. Fill in:
   - **Name:** `Lawyer Website Hosting`
   - **SKU:** `lawyer-website-monthly`
   - **Price:** `$25.00`
   - **Category:** Services (or create new)
   - **Description:** `Professional lawyer website at transcend-law.com`
6. Click **Save**
7. Copy the **Item ID** - you'll need this

### Via Clover API

```bash
curl -X POST https://api.clover.com/v3/merchants/{CLOVER_MERCHANT_ID}/items \
  -H "Authorization: Bearer $CLOVER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lawyer Website Hosting",
    "description": "Professional lawyer website at transcend-law.com",
    "sku": "lawyer-website-monthly",
    "price": 2500
  }'
```

Save the returned `id` - this is your `CLOVER_WEBSITE_ITEM_ID`.

---

## Step 2: Configure Environment Variables

Create `.env` file with:

```env
# Clover Configuration
CLOVER_API_KEY=your_clover_api_key_here
CLOVER_MERCHANT_ID=your_merchant_id_here
CLOVER_WEBSITE_ITEM_ID=lawyer_website_25mo

# Clover Webhooks
CLOVER_WEBHOOK_SECRET=your_webhook_secret_here
```

### Where to Find These:

1. **CLOVER_MERCHANT_ID**
   - Clover Dashboard → Settings → Merchant Info
   - Copy the "Merchant ID"

2. **CLOVER_API_KEY**
   - Clover Dashboard → Settings → API Tokens
   - Create a new token or copy existing
   - Scopes needed: `read_inventory`, `write_inventory`, `read_customers`, `write_customers`, `read_orders`, `write_orders`

3. **CLOVER_WEBHOOK_SECRET**
   - Clover Dashboard → Webhooks
   - Create webhook endpoint (see Step 3)
   - Copy the secret

---

## Step 3: Setup Webhook for Payment Events

### Configure Clover Webhook

1. Go to Clover Dashboard → **Webhooks**
2. Click **Add Endpoint**
3. Enter:
   - **URL:** `https://transcend-law.com/api/webhooks/clover`
   - **Events:** Select these:
     - `order.created`
     - `order.updated`
     - `customer.created`
     - `customer.deleted`
     - `subscription.created`
     - `subscription.updated`
     - `subscription.deleted`
4. Copy the **Webhook Secret** for env variables
5. Click **Save**

### Webhook Handler Implementation

```typescript
// /transcend-api/routes/webhooks.ts

import crypto from 'crypto';
import express from 'express';

const router = express.Router();

/**
 * POST /api/webhooks/clover
 * Handle Clover webhook events
 */
router.post('/api/webhooks/clover', (req, res) => {
  const signature = req.headers['x-clover-signature'] as string;
  const payload = req.rawBody; // Raw body as string

  // Verify webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.CLOVER_WEBHOOK_SECRET || '')
    .update(payload)
    .digest('base64');

  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const event = req.body;

  // Handle different event types
  switch (event.type) {
    case 'order.created':
      handleOrderCreated(event.data);
      break;
    case 'order.updated':
      handleOrderUpdated(event.data);
      break;
    case 'subscription.created':
      handleSubscriptionCreated(event.data);
      break;
    case 'subscription.deleted':
      handleSubscriptionCancelled(event.data);
      break;
  }

  res.json({ success: true });
});

function handleOrderCreated(data: any) {
  console.log('Order created:', data.id);
  // Update lawyer website subscription status
  // TODO: Mark subscription as active if payment successful
}

function handleOrderUpdated(data: any) {
  console.log('Order updated:', data.id);
  // Handle payment confirmation
}

function handleSubscriptionCreated(data: any) {
  console.log('Subscription created:', data.id);
  // Update lawyer website with subscription ID
}

function handleSubscriptionCancelled(data: any) {
  console.log('Subscription cancelled:', data.id);
  // Mark lawyer website subscription as cancelled
}

export default router;
```

---

## Step 4: Update Database Schema

Add Clover fields to lawyer_websites table:

```sql
ALTER TABLE lawyer_websites 
ADD COLUMN clover_customer_id VARCHAR(255),
ADD COLUMN clover_subscription_id VARCHAR(255),
ADD COLUMN clover_order_id VARCHAR(255),
ADD COLUMN last_payment_date TIMESTAMP,
ADD COLUMN next_payment_date TIMESTAMP;

CREATE INDEX idx_lawyer_websites_clover_customer ON lawyer_websites(clover_customer_id);
CREATE INDEX idx_lawyer_websites_clover_subscription ON lawyer_websites(clover_subscription_id);
```

---

## Step 5: Frontend Integration

### Update LawyerWebsiteSetup.tsx

```typescript
// Add to form submission
const handleSubmit = async () => {
  // Get or create Clover customer
  const cloverCustomerId = await createCloverCustomer({
    name: formData.companyName,
    email: localStorage.getItem('email'),
    phone: formData.phone,
  });

  // Submit website creation with Clover customer ID
  const response = await fetch('/api/lawyer-websites', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    },
    body: JSON.stringify({
      // ... existing fields
      cloverCustomerId,
    }),
  });
};

// Create Clover customer
async function createCloverCustomer(data: {
  name: string;
  email: string;
  phone: string;
}) {
  const response = await fetch('/api/clover/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  return result.customerId;
}
```

---

## Step 6: Clover API Calls Reference

### Create Customer

```bash
curl -X POST https://api.clover.com/v3/merchants/{CLOVER_MERCHANT_ID}/customers \
  -H "Authorization: Bearer $CLOVER_API_KEY" \
  -d 'emailAddress=lawyer@example.com' \
  -d 'firstName=John' \
  -d 'lastName=Smith' \
  -d 'phone=5551234567'
```

### Create Subscription

```bash
curl -X POST https://api.clover.com/v3/merchants/{CLOVER_MERCHANT_ID}/subscription_plans \
  -H "Authorization: Bearer $CLOVER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lawyer Website - Smith & Associates",
    "items": [{
      "id": "lawyer_website_25mo",
      "quantity": 1
    }],
    "recurring": {
      "interval": "MONTH",
      "intervalCount": 1
    },
    "customer": "customer_id_here"
  }'
```

### Charge Customer (Manual Renewal)

```bash
curl -X POST https://api.clover.com/v3/merchants/{CLOVER_MERCHANT_ID}/charges \
  -H "Authorization: Bearer $CLOVER_API_KEY" \
  -d 'customerId=customer_id' \
  -d 'amount=2500' \
  -d 'currency=USD' \
  -d 'description=Lawyer Website Renewal'
```

### Cancel Subscription

```bash
curl -X DELETE https://api.clover.com/v3/merchants/{CLOVER_MERCHANT_ID}/subscription_plans/subscription_id \
  -H "Authorization: Bearer $CLOVER_API_KEY"
```

---

## Step 7: Verify Setup

### Test Payment Flow

1. Create a test lawyer website
2. Check Clover Dashboard → Orders
3. Verify order appears with correct amount ($25.00)
4. Verify customer created
5. Verify subscription created

### Monitor Webhooks

```bash
# View recent webhook deliveries
curl https://api.clover.com/v3/merchants/{CLOVER_MERCHANT_ID}/webhooks \
  -H "Authorization: Bearer $CLOVER_API_KEY"
```

---

## Step 8: Handle Subscription Lifecycle

### Monthly Billing

Clover handles automatic recurring charges. Each month on the anniversary date:
- Clover charges the customer $25
- Webhook fires: `order.created`
- Update `next_payment_date` in database

### Renewal

```typescript
// Manual renewal endpoint
router.post('/api/lawyer-websites/:websiteId/renew', async (req, res) => {
  const { websiteId } = req.params;
  const { months = 1 } = req.body;

  // Get website
  const website = await db.lawyerWebsites.findById(websiteId);

  // Charge via Clover
  const charge = await axios.post(
    `${CLOVER_API_BASE}/v3/merchants/${CLOVER_MERCHANT_ID}/charges`,
    {
      customerId: website.clover_customer_id,
      amount: 2500 * months,
      currency: 'USD',
      description: `Lawyer Website Renewal - ${months} month(s)`,
    },
    {
      headers: { Authorization: `Bearer ${CLOVER_API_KEY}` },
    }
  );

  // Update subscription end date
  website.subscription_end_date = new Date(
    website.subscription_end_date.getTime() + months * 30 * 24 * 60 * 60 * 1000
  );
  await db.lawyerWebsites.update(website);

  res.json({ success: true, message: 'Subscription renewed' });
});
```

### Cancellation

```typescript
// Cancel endpoint
router.post('/api/lawyer-websites/:websiteId/cancel', async (req, res) => {
  const { websiteId } = req.params;

  // Get website
  const website = await db.lawyerWebsites.findById(websiteId);

  // Cancel Clover subscription
  await axios.delete(
    `${CLOVER_API_BASE}/v3/merchants/${CLOVER_MERCHANT_ID}/subscription_plans/${website.clover_subscription_id}`,
    {
      headers: { Authorization: `Bearer ${CLOVER_API_KEY}` },
    }
  );

  // Update database
  website.subscription_status = 'cancelled';
  website.subscription_end_date = new Date();
  await db.lawyerWebsites.update(website);

  res.json({ success: true, message: 'Subscription cancelled' });
});
```

---

## Step 9: Payment Reconciliation

### Daily Reconciliation Report

```typescript
async function reconcileCloverPayments() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Get all orders from Clover
  const orders = await axios.get(
    `${CLOVER_API_BASE}/v3/merchants/${CLOVER_MERCHANT_ID}/orders?modifiedTime=${yesterday.getTime()}`,
    {
      headers: { Authorization: `Bearer ${CLOVER_API_KEY}` },
    }
  );

  // Match against our records
  for (const order of orders.data.elements) {
    const billing = await db.lawyerWebsiteBilling.findOne({
      clover_order_id: order.id,
    });

    if (!billing) {
      // New order - create billing record
      await db.lawyerWebsiteBilling.create({
        clover_order_id: order.id,
        amount: order.total / 100, // Clover returns cents
        status: order.state === 'LOCKED' ? 'paid' : 'pending',
        paid_at: new Date(order.createdTime),
      });
    }
  }
}
```

---

## Troubleshooting

### Payment Not Processing

1. Verify API key is correct
2. Check merchant account has payment method on file
3. Verify webhook secret matches
4. Check Clover Dashboard for error messages

### Customer Not Found

1. Ensure customer was created before subscription
2. Verify customer ID from creation response
3. Check in Clover Dashboard → Customers

### Webhook Not Firing

1. Verify webhook URL is publicly accessible
2. Check webhook secret matches
3. Review webhook delivery history in Clover Dashboard
4. Test with Clover's webhook tester tool

---

## Production Checklist

- [ ] Clover merchant account verified
- [ ] API key generated with correct scopes
- [ ] Lawyer Website item created ($25)
- [ ] Environment variables configured
- [ ] Webhook endpoint configured
- [ ] Webhook secret stored in env
- [ ] Database schema updated
- [ ] Payment API routes implemented
- [ ] Webhook handler implemented
- [ ] Frontend updated with Clover integration
- [ ] Test payment completed successfully
- [ ] Webhook delivery verified
- [ ] Billing reconciliation running daily
- [ ] Cancellation flow tested
- [ ] Renewal flow tested

---

## Support

- **Clover Documentation:** https://developers.clover.com
- **API Reference:** https://docs.clover.com/reference
- **Merchant Dashboard:** https://merchant.clover.com

---

**Status:** Ready for implementation  
**Payment Processor:** Clover (not Stripe)  
**Monthly Cost:** $25 per lawyer website
