# SME SUBSCRIPTION SYSTEM
## Clove-Based Billing Integration for Transcend Law
**Part of Transcend Tools**

---

## OVERVIEW

SME (Subject Matter Expert) consultants must have an active subscription to post profiles and offer consultation services on Transcend Law. All billing is handled through **Clove**, the unified payment platform for Transcend Tools.

---

## SUBSCRIPTION TIERS

### 1. **Basic** - $15/month
- 1 active consultation at a time
- Basic profile listing
- Email support
- Case document access
- Document versioning

**Best for:** Getting started as an SME consultant

### 2. **Professional** - $60/month ⭐ MOST POPULAR
- 5 active consultations simultaneously
- Featured profile (appears higher in search results)
- Priority messaging from clients
- Consultation analytics dashboard
- Document versioning with client approval tracking
- Consultation fee proposal system

**Best for:** Active SME consultants with multiple clients

### 3. **Enterprise** - $150/month
- Unlimited active consultations
- Premium profile with custom branding
- Direct booking link (clients can book directly)
- 24/7 priority support
- Advanced analytics (conversion rates, client feedback, earnings)
- All Professional features

**Best for:** Full-time expert consultants

---

## CLOVE BILLING INTEGRATION

### Architecture
```
Transcend Law (Frontend)
        ↓
    Backend API
        ↓
    Clove API (Payment Processor)
        ↓
    Payment Gateway
        ↓
    Customer's Payment Method
```

### Clove API Endpoints Used

#### Registration with Subscription
```http
POST /api/sme/register
Content-Type: application/json

{
    "email": "expert@example.com",
    "password": "secure_password",
    "name": "Dr. Jane Smith",
    "professionalTitle": "Medical Expert",
    "subscriptionTier": "professional"
}
```

**Backend Action:**
1. Create SME record in PostgreSQL
2. Call `POST /api/sme/register` to create Clove subscription
3. Store Clove subscription ID in database

**Clove Call:**
```javascript
POST https://api.clove.tools/v1/subscriptions
Authorization: Bearer CLOVE_API_KEY
Content-Type: application/json

{
    "product": "transcend-law-sme",
    "tier": "professional",
    "customerId": "sme_12345",
    "email": "expert@example.com",
    "name": "Dr. Jane Smith",
    "priceInCents": 6000,  // $60.00
    "currency": "USD",
    "interval": "month",
    "metadata": {
        "smeId": 12345,
        "platform": "transcend-law",
        "tool": "transcend-tools"
    }
}
```

#### Check Subscription Status
```http
GET /api/sme/:smeId/subscription
Authorization: Bearer [jwt_token]
```

**Response:**
```json
{
    "tier": "professional",
    "plan": {
        "name": "Professional",
        "price": 60,
        "features": ["5 active consultations", "Featured profile", ...]
    },
    "cloveSubscriptionId": "clove_sub_xyz789",
    "cloveStatus": {
        "status": "active",
        "currentPeriodStart": "2026-08-12",
        "currentPeriodEnd": "2026-09-12"
    }
}
```

#### Upgrade Subscription
```http
POST /api/sme/:smeId/upgrade-subscription
Authorization: Bearer [jwt_token]
Content-Type: application/json

{
    "newTier": "enterprise"
}
```

**Clove Call:**
```javascript
PUT https://api.clove.tools/v1/subscriptions/clove_sub_xyz789
Authorization: Bearer CLOVE_API_KEY

{
    "tier": "enterprise",
    "priceInCents": 15000,  // $150.00
    "metadata": { "upgradedAt": "2026-08-12T10:30:00Z" }
}
```

#### Cancel Subscription
```http
POST /api/sme/:smeId/cancel-subscription
Authorization: Bearer [jwt_token]
```

**Clove Call:**
```javascript
POST https://api.clove.tools/v1/subscriptions/clove_sub_xyz789/cancel
Authorization: Bearer CLOVE_API_KEY
```

**Effect:**
- Subscription marked as cancelled in Clove
- SME profile deactivated in Transcend Law
- SME cannot post new consultations
- Existing consultations can complete (grace period)

---

## DATABASE SCHEMA

### SMS Table Updates
```sql
ALTER TABLE smes ADD COLUMN clove_subscription_id VARCHAR(255);
ALTER TABLE smes ADD COLUMN subscription_tier VARCHAR(50) DEFAULT 'professional';
ALTER TABLE smes ADD COLUMN active BOOLEAN DEFAULT true;
ALTER TABLE smes ADD COLUMN subscription_started_at TIMESTAMP DEFAULT NOW();
ALTER TABLE smes ADD COLUMN subscription_renewal_date TIMESTAMP;

CREATE INDEX idx_smes_clove_sub ON smes(clove_subscription_id);
CREATE INDEX idx_smes_active ON smes(active);
```

### Subscription Table (Optional - for local tracking)
```sql
CREATE TABLE sme_subscriptions (
    id SERIAL PRIMARY KEY,
    sme_id INT REFERENCES smes(id),
    clove_subscription_id VARCHAR(255) UNIQUE,
    tier VARCHAR(50),
    status VARCHAR(50), -- active, cancelled, paused
    price_cents INT,
    currency VARCHAR(3),
    interval VARCHAR(50), -- month, year
    started_at TIMESTAMP DEFAULT NOW(),
    renewal_date TIMESTAMP,
    cancelled_at TIMESTAMP,
    metadata JSONB
);
```

---

## SME SIGNUP FLOW

### Step 1: Choose Plan (sme-signup.html)
- 3 pricing cards: Basic ($15), Professional ($60), Enterprise ($150)
- Visual comparison of features
- "Most Popular" badge on Professional tier

### Step 2: Create Account
- Email address
- Password (8+ chars)
- Full name
- Professional title
- Select subscription tier

### Step 3: Payment (Clove)
- Redirect to Clove payment form
- Accept Clove terms
- Enter payment method
- Clove processes payment

### Step 4: Confirmation
- Account created in Transcend Law
- Subscription activated in Clove
- Email confirmation sent
- Redirect to SME dashboard
- Profile now visible to clients/lawyers

---

## SME DASHBOARD UPDATES

### Subscription Status Widget (New)
```
📦 Your Subscription

Professional Plan
$60/month
Renews: September 12, 2026

[Upgrade to Enterprise] [Manage Billing] [Cancel Subscription]
```

### Profile Visibility
- ✅ Basic: Appears in SME search after subscription active
- ✅ Professional: Featured in search results (appears higher)
- ✅ Enterprise: Premium listing + direct booking link

### Consultation Limits Enforced
- **Basic:** Can accept 1 active consultation at a time
- **Professional:** Can accept 5 simultaneous consultations
- **Enterprise:** Unlimited consultations

---

## PAYMENT FLOW DETAILS

### Monthly Billing
- Charge date: Same day each month
- Automatic renewal (until cancelled)
- Clove sends reminders 5 days before renewal

### Failed Payments
1. Payment fails on renewal date
2. Clove retries for 3 days
3. If still failing: SME notified
4. After 7 days: Subscription suspended
5. SME profile becomes inactive
6. SME cannot accept new consultations

### Billing Notifications
- **Renewal successful:** Email from Clove + in-app notification
- **Renewal failed:** Email + urgent in-app alert
- **Subscription expiring:** 30-day warning

---

## CLOVE CONFIGURATION

### Environment Variables (.env)
```env
CLOVE_API_KEY=clove_live_sk_xxxxxxxxxxxxxxx
CLOVE_API_URL=https://api.clove.tools/v1
CLOVE_WEBHOOK_SECRET=clove_wh_xxxxxxxxxxxxxxx
CLOVE_PRODUCT_ID=transcend-law-sme
```

### Webhook Handling
Clove sends webhooks for:
- `subscription.created` - New subscription activated
- `subscription.renewed` - Monthly renewal completed
- `subscription.failed` - Payment failure
- `subscription.cancelled` - User cancelled
- `subscription.expired` - Subscription lapsed

**Webhook Endpoint:**
```http
POST /api/webhooks/clove
Content-Type: application/json

{
    "event": "subscription.renewed",
    "timestamp": "2026-08-12T10:30:00Z",
    "data": {
        "subscriptionId": "clove_sub_xyz789",
        "customerId": "sme_12345",
        "tier": "professional",
        "status": "active"
    }
}
```

---

## REVENUE MODEL

### Per-SME Revenue (Monthly)
- Basic: $15 × users
- Professional: $60 × users
- Enterprise: $150 × users

### Example (1000 SMEs)
- 40% Basic tier: 400 × $15 = $6,000
- 50% Professional: 500 × $60 = $30,000
- 10% Enterprise: 100 × $150 = $15,000
- **Total: $51,000/month**

### Clove Fees
- Clove charges 2% per transaction (industry standard)
- Payment processor fee: ~3% (absorbed by Clove)
- Transcend Tools retains: 98% of subscription revenue

---

## SECURITY & COMPLIANCE

### PCI Compliance
- ✅ No card data stored locally (Clove handles all payments)
- ✅ Clove PCI DSS Level 1 compliant
- ✅ Transcend Law stores only Clove subscription IDs

### Data Protection
- JWT tokens secure API access
- Bcrypt password hashing for SME accounts
- HTTPS only for all Clove API calls
- Clove webhook signature verification

### Fraud Prevention
- Clove performs fraud detection
- Multiple payment failures trigger account review
- Suspicious activity monitored

---

## TESTING

### Sandbox Testing (Before Production)
```
Test Credentials:
- Card: 4242 4242 4242 4242 (Visa - Success)
- Card: 4000 0000 0000 0002 (Visa - Declined)
- Expiry: 12/26 (any future date)
- CVC: 123
```

### Test Scenarios
1. ✅ New SME signs up → Professional tier
2. ✅ Payment processes → Subscription created
3. ✅ SME logs in → Dashboard shows "Professional" plan
4. ✅ SME views dashboard → Can post consultations
5. ✅ SME upgrades to Enterprise
6. ✅ SME cancels subscription → Profile deactivates

---

## SUPPORT & OPERATIONS

### Common Issues

**"Payment Declined"**
- Clove will email SME with retry options
- SME can update payment method in Clove portal
- After 7 days: Account suspended

**"I want to cancel"**
- SME clicks [Cancel Subscription] in dashboard
- Clove immediately stops billing
- Existing consultations can complete
- Profile deactivates within 24 hours

**"How do I upgrade?"**
- SME clicks [Upgrade to Enterprise] in dashboard
- Clove pro-rates the difference
- New tier active immediately

### Admin Tools
- View all SME subscriptions (via Clove API)
- Manual tier adjustments (override for disputes)
- Refund processing (via Clove dashboard)
- Subscription analytics & reports

---

## PRODUCTION CHECKLIST

- [ ] CLOVE_API_KEY added to production .env
- [ ] Webhook signature verification enabled
- [ ] Email notifications configured (Sendgrid)
- [ ] Error handling for Clove API failures
- [ ] Subscription status sync cron job
- [ ] Database backups include subscription data
- [ ] Monitoring/alerts for failed payments
- [ ] Customer support documentation ready
- [ ] Terms of Service updated with subscription terms
- [ ] Billing support email (support@transcend.tools)

---

## NEXT STEPS

1. **Frontend:** Deploy sme-signup.html to production
2. **Backend:** Update server.js with Clove credentials
3. **Database:** Run subscription schema migration
4. **Testing:** Verify all subscription flows in sandbox
5. **Monitoring:** Set up alerts for failed payments
6. **Documentation:** Update customer-facing docs
7. **Launch:** Enable SME subscription system for new signups

---

**All changes backward-compatible. Existing SME data unaffected.**
**Subscription enforcement begins on activation date.**
