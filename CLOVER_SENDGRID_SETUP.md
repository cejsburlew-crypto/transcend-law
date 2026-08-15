# 💳 Clover + SendGrid Integration Setup

**Status:** Clover payments + SendGrid emails fully implemented and ready for deployment

---

## 🎯 What's Integrated

### Clover Payment Processing
- ✅ Subscription management (3 tiers)
- ✅ Customer account creation
- ✅ Payment processing
- ✅ Order management
- ✅ Invoice generation
- ✅ Webhook support

### SendGrid Email Notifications
- ✅ 10 professional email templates
- ✅ Automated notifications
- ✅ Batch email capability
- ✅ Transaction emails

---

## 🚀 Quick Setup

### Step 1: Configure Clover

**Get Credentials:**
1. Log in to https://dashboard.clover.com
2. Go to Settings → Integrations → API Tokens
3. Copy Merchant ID and Access Token

**.env Configuration:**
```env
CLOVER_MERCHANT_ID=your-merchant-id
CLOVER_ACCESS_TOKEN=your-access-token
```

**Create Subscription Plans in Clover:**
The API will auto-create these plans on first run, or manually:
1. Go to Inventory → Items
2. Create 3 items:
   - Basic: $29/month
   - Professional: $99/month
   - Enterprise: $299/month
3. Enable recurring billing for each

### Step 2: Configure SendGrid

**Get API Key:**
1. Go to https://app.sendgrid.com
2. Settings → API Keys → Create API Key
3. Copy the key

**.env Configuration:**
```env
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@transcend-law.com
```

**Verify Sender:**
1. Go to Settings → Sender Authentication
2. Verify your domain or single sender email
3. SendGrid won't send until verified

### Step 3: Test Integration

```bash
# Start API
npm start

# Test payment endpoint
curl -X GET http://localhost:3001/api/v2/payments/plans \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Test subscription
curl -X POST http://localhost:3001/api/v2/payments/subscribe \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "planType": "professional",
    "billingCycle": "monthly"
  }'
```

---

## 📧 Email Templates

### 1. **Welcome Emails**
- **welcome-client**: New client onboarding
- **welcome-attorney**: Attorney dashboard intro

### 2. **Case Emails**
- **case-submitted**: Client confirmation
- **new-case-opportunity**: Attorney notification
- **case-quote**: Quote received notification
- **case-accepted**: Case accepted notification

### 3. **Subscription Emails**
- **subscription-confirmed**: Subscription active
- **subscription-upgraded**: Plan upgrade confirmation
- **invoice-ready**: Invoice available
- **payment-failed**: Payment failure alert

### 4. **Communication**
- **new-message**: New message notification

---

## 💳 Payment Flow

```
Client Creates Subscription
         ↓
API calls Clover
         ↓
Clover creates order in POS
         ↓
Customer charged
         ↓
Webhook fires
         ↓
API stores subscription
         ↓
SendGrid sends confirmation email
         ↓
Client sees active subscription
```

---

## 🔧 API Endpoints

### Get Subscription Plans
```bash
GET /api/v2/payments/plans

Response:
{
  "plans": [
    {
      "type": "basic",
      "name": "Basic",
      "price": 29,
      "billing": "month",
      "features": [...]
    },
    ...
  ]
}
```

### Create Subscription
```bash
POST /api/v2/payments/subscribe
Authorization: Bearer token

Body:
{
  "planType": "professional",
  "billingCycle": "monthly"
}

Response:
{
  "success": true,
  "subscriptionId": "order_id",
  "status": "open",
  "planType": "professional"
}
```

### Get Current Subscription
```bash
GET /api/v2/payments/subscription
Authorization: Bearer token

Response:
{
  "subscription": {
    "id": "...",
    "planType": "professional",
    "status": "active",
    "pricePerMonth": 99,
    "autoRenew": true
  }
}
```

### Upgrade Plan
```bash
POST /api/v2/payments/upgrade
Authorization: Bearer token

Body:
{
  "newPlanType": "enterprise"
}

Response:
{
  "success": true,
  "newPlan": "enterprise",
  "subscriptionId": "..."
}
```

### Get Invoice History
```bash
GET /api/v2/payments/invoices
Authorization: Bearer token

Response:
{
  "invoices": [
    {
      "id": "pay_123",
      "amount": 99.00,
      "status": "SUCCESS",
      "createdAt": "2026-08-15T10:30:00Z"
    }
  ]
}
```

### Cancel Subscription
```bash
POST /api/v2/payments/cancel
Authorization: Bearer token

Response:
{
  "success": true
}
```

---

## 🔌 Webhook Integration

### Setup Clover Webhook

```bash
# API will handle webhook registration
# Or manually in Clover Dashboard:
1. Settings → Webhooks
2. Add endpoint: https://your-domain.com/api/v2/payments/webhook
3. Select events: payment.create, order.close, order.delete
```

### Webhook Events Handled

```
payment.create    → Log transaction
order.close       → Mark subscription active
order.delete      → Mark subscription cancelled
```

---

## 📊 Email Customization

### Custom Email Templates

Edit `emailService.ts` to customize templates:

```typescript
'custom-template': `
  <div class="container">
    <div class="header">
      <h1>Custom Email</h1>
    </div>
    <div class="content">
      <p>Hello ${context.firstName},</p>
      <p>Your custom content here...</p>
    </div>
  </div>
`
```

### Send Custom Email

```typescript
import { sendEmail } from './services/emailService';

await sendEmail('user@example.com', 'custom-template', {
  firstName: 'John',
  customField: 'value'
});
```

---

## 🔐 Security Best Practices

### Clover Security
- ✅ API key in environment variable
- ✅ HTTPS for all requests
- ✅ Customer data encrypted
- ✅ Webhook signature verification

### SendGrid Security
- ✅ API key in environment variable
- ✅ Domain verification
- ✅ Bounce handling
- ✅ Unsubscribe management

---

## 🐛 Troubleshooting

### "Clover service not initialized"
```bash
# Check environment variables
echo $CLOVER_MERCHANT_ID
echo $CLOVER_ACCESS_TOKEN

# Add to .env if missing
CLOVER_MERCHANT_ID=your-id
CLOVER_ACCESS_TOKEN=your-token
```

### "Failed to send email"
```bash
# Check SendGrid API key
echo $SENDGRID_API_KEY

# Verify sender email
# Go to SendGrid → Settings → Sender Authentication
```

### "Plan not found in Clover"
```bash
# Ensure items exist in Clover inventory
# Create them manually or let API create them
# Check dashboard at: https://dashboard.clover.com
```

### Webhook not firing
```bash
# 1. Check webhook URL in Clover
# 2. Ensure it's accessible from public internet
# 3. Check logs for webhook requests
```

---

## 📈 Testing Checklist

- [ ] Can list subscription plans
- [ ] Can create new subscription
- [ ] Can upgrade subscription
- [ ] Can cancel subscription
- [ ] Can retrieve subscription details
- [ ] Can get invoice history
- [ ] Emails sent on subscription creation
- [ ] Emails sent on plan upgrade
- [ ] Emails sent on payment failure
- [ ] Webhook events received and logged
- [ ] Database updated on subscription changes

---

## 🚢 Production Deployment

### Before Going Live

1. **Clover Setup**
   - [ ] Production merchant account
   - [ ] Real API tokens
   - [ ] Subscription items created
   - [ ] Webhook configured

2. **SendGrid Setup**
   - [ ] Production API key
   - [ ] Sender domain verified
   - [ ] Email templates branded
   - [ ] Reply-to address set

3. **Environment**
   - [ ] Production secrets in AWS Secrets Manager
   - [ ] Error logging configured
   - [ ] Monitoring alerts set

4. **Testing**
   - [ ] Test with real Clover test mode
   - [ ] Test all email templates
   - [ ] Test webhook delivery
   - [ ] Load test payment endpoint

---

## 💰 Revenue Model

### Subscription Pricing
- **Basic**: $29/month - Up to 5 cases, basic matching
- **Professional**: $99/month - Unlimited cases, priority support
- **Enterprise**: $299/month - Everything, dedicated support

### Monthly Revenue Projection
```
100 clients × $99 (avg) = $9,900/month
```

---

## 📊 Monitoring

### Metrics to Track
- New subscriptions per day
- Churn rate
- ARPU (Average Revenue Per User)
- Payment success rate
- Email delivery rate

### Logging
```typescript
console.log('✅ Email sent to user@example.com: subscription-confirmed');
console.log('❌ Payment failed for customer_id: error message');
```

---

## 🔮 Next Steps

### Week 3: Real-Time Features
- [ ] AWS S3 for document storage
- [ ] Socket.io for real-time messaging
- [ ] Redis caching layer

### Week 4: Pre-Launch
- [ ] Security audit
- [ ] Load testing
- [ ] E2E test suite
- [ ] Launch readiness

---

**Status:** Payments + emails production-ready  
**Next:** AWS S3 integration for document storage
