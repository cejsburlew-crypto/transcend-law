# Affiliate Program Implementation Guide

## Overview

The Transcend Law Affiliate Program is a comprehensive platform for managing affiliate partnerships, commission tracking, payouts, and performance analytics. This guide covers all components and how to integrate them into your system.

## Architecture

### Backend Components

1. **affiliateService.ts** - Core service logic for all affiliate operations
2. **schema-affiliate-program.sql** - Database schema with tables, views, and functions
3. **affiliateRoutes.ts** - RESTful API endpoints

### Frontend Components

1. **AffiliateDashboard.tsx** - Main dashboard interface
2. **AffiliateDashboard.css** - Styling and responsive design

## Database Setup

### Initialize Database

```sql
-- Run this SQL file to set up all required tables, indexes, and views
psql -U postgres -d transcend_db -f transcend-api/database/schema-affiliate-program.sql
```

### Key Tables

#### affiliates
- Core affiliate profile information
- Status tracking (pending, active, suspended, rejected)
- Commission rates and tiers
- Fraud scoring

#### tracking_links
- Unique tracking codes for each campaign
- Click and conversion counting
- Campaign metadata

#### commissions
- Individual commission records
- Types: signup, revenue-share, performance-bonus
- Status tracking and verification
- Fraud flags

#### payouts
- Payout requests and processing
- Transaction IDs for payment gateways
- Retry logic for failed payouts

#### marketing_materials
- Pre-made marketing assets
- Global templates and affiliate-specific materials
- Performance metrics tracking

#### fraud_indicators
- Suspicious activity detection
- Click pattern analysis
- Geographic anomalies

## Features

### 1. Affiliate Signup

```typescript
// Register new affiliate
const profile = await affiliateService.registerAffiliate(
  userId,
  'partner@example.com',
  'Partner Company Inc',
  '12-3456789'
);
```

**Process:**
- User submits company info
- Email verification sent
- Manual admin approval required
- Affiliate status transitions: pending → verified → active

**API Endpoint:**
```
POST /api/v1/affiliate/signup
Body: {
  companyName: string,
  email: string,
  taxId?: string
}
```

### 2. Tracking Links

Generate unique tracking codes for marketing campaigns:

```typescript
// Create tracking link
const link = await affiliateService.createTrackingLink(
  affiliateId,
  'Summer 2024 Campaign',
  { channel: 'linkedin', target: 'lawyers' }
);

// Result:
// {
//   code: 'aff_a1b2c3d4e5f6',
//   url: 'https://transcend-law.com?aff=aff_a1b2c3d4e5f6',
//   campaignName: 'Summer 2024 Campaign',
//   clickCount: 0,
//   conversionCount: 0
// }
```

**Features:**
- Unique code per campaign
- Click tracking
- Conversion tracking
- Expiration dates (optional)
- Custom metadata

**Dashboard UI:**
- View all tracking links
- Copy link to clipboard
- Real-time click/conversion stats
- Conversion rate calculation
- Disable links

### 3. Commission Tracking

Automatic and manual commission recording:

```typescript
// Record signup commission
const commission = await affiliateService.recordCommission(
  affiliateId,
  'signup',
  150, // $150 per signup
  {
    clientId: 'client-123',
    referralSource: 'aff_a1b2c3d4e5f6'
  }
);

// Revenue-share commission
const revenueComm = await affiliateService.recordCommission(
  affiliateId,
  'revenue-share',
  250, // 10% of $2500 service
  {
    serviceType: 'employment-law',
    clientId: 'client-456'
  }
);
```

**Commission Types:**
- **Signup**: Fixed amount per client signup ($50-$250)
- **Revenue-Share**: Percentage of service revenue (10-25%)
- **Performance-Bonus**: Monthly bonuses for top performers

**Status Flow:**
- earned → pending → paid
- disputed (manual review required)

**Dashboard UI:**
- Commission history with filtering
- Earned vs. paid summary
- Dispute claims
- Fraud flag indicators

### 4. Payout Automation

Automatic payout processing:

```typescript
// Create payout request
const payout = await affiliateService.createPayout(
  affiliateId,
  100 // minimum $100 threshold
);

// Process all pending payouts (run as cron job)
const processed = await affiliateService.processPendingPayouts();
```

**Process:**
1. Affiliate requests payout (minimum threshold: $100)
2. System verifies no fraud flags
3. Payment processed to stored payment method
4. Status: scheduled → processing → completed
5. Retry logic for failed transactions (up to 3 attempts)

**Payment Methods:**
- Bank transfer (ACH)
- PayPal
- Stripe Connect

**Dashboard UI:**
- Pending payout amount
- Payout history
- Payment method management
- Payout tracking

### 5. Marketing Materials

Pre-made promotional assets:

```typescript
// Create marketing material
const material = await affiliateService.createMarketingMaterial(
  'email',
  'Partner Onboarding Email',
  emailTemplate,
  null, // null = global template
  'https://cdn.example.com/templates/email-1.zip'
);

// Get available materials for affiliate
const materials = await affiliateService.getMarketingMaterials(
  'email',
  affiliateId
);

// Track usage
await affiliateService.recordMaterialUsage(materialId, 'click');
```

**Material Types:**
- Email templates
- Banner graphics (300x250, 728x90, etc.)
- Social media graphics
- Landing page templates
- Video scripts

**Performance Tracking:**
- Views
- Clicks
- Conversions

**Dashboard UI:**
- Organized by material type
- Download buttons
- Performance metrics
- Custom marketing kit builder

### 6. Performance Dashboard

Real-time analytics:

```typescript
// Get affiliate stats
const stats = await affiliateService.getAffiliateStats(affiliateId);
// Returns:
// {
//   totalClicks: 1250,
//   totalConversions: 45,
//   conversionRate: 3.6,
//   totalEarned: 12500,
//   totalPaid: 8000,
//   pendingPayout: 4500,
//   avgOrderValue: 277.78,
//   lastActivity: 2024-08-15T...
// }

// Platform-wide analytics
const platformStats = await affiliateService.getPlatformAffiliateAnalytics();
```

**Dashboard Overview Tab Shows:**
- Total clicks
- Total conversions
- Conversion rate
- Total earned
- Total paid
- Pending payout
- Average order value
- 30-day performance chart
- Quick actions

**Admin Analytics:**
- Total active affiliates
- Total commissions issued
- Total payouts processed
- Platform-wide conversion rate

### 7. Fraud Detection

Multi-layered fraud prevention:

```typescript
// Analyze click patterns for suspicious activity
const indicators = await affiliateService.analyzeClickPatterns(affiliateId);
// Returns fraud indicators:
// - duplicate-ip: Same IP clicking many times
// - high-velocity: Too many commissions in short time
// - geographic-mismatch: Clicks from many countries
// - unusual-amount: Commission amount anomalies
// - new-affiliate-large-commission: Red flag for new affiliates

// Resolve fraud flag
await affiliateService.resolveFraudFlag(affiliateId, 'duplicate-ip', true);
```

**Fraud Detection Triggers:**

1. **High Velocity** (>10 commissions/hour)
   - Action: Flag for review, auto-suspend if score > 75

2. **Unusual Amount** (>5x average commission)
   - Action: Requires manual approval

3. **Geographic Anomaly** (>20 countries in 24h)
   - Action: Flag for review

4. **Click Fraud** (>50 clicks from same IP)
   - Action: Disable tracking link

5. **Revenue Cap Exceeded**
   - Action: Block additional commissions

**Fraud Score System:**
- Each fraud flag: +10 points
- Threshold: 75 = auto-suspension
- Manual review can reduce score

**Admin Dashboard:**
- View fraud indicators per affiliate
- Approve/reject suspicious activity
- Adjust fraud scores
- Generate fraud reports

## API Integration

### Required Environment Variables

```env
# Affiliate Program
AFFILIATE_BASE_URL=https://transcend-law.com
AFFILIATE_MIN_PAYOUT=100
AFFILIATE_COMMISSION_RANGES=10,15,20,25

# Payment Processing
STRIPE_SECRET_KEY=sk_test_...
STRIPE_CONNECT_ENABLED=true
PAYPAL_CLIENT_ID=...
PAYPAL_SECRET=...

# Fraud Detection
FRAUD_SCORE_THRESHOLD=75
FRAUD_AUTO_SUSPEND=true

# Cron Job
CRON_SECRET=secure_random_secret
```

### Integration Steps

1. **Database Setup**
```bash
psql -U postgres -d transcend_db -f transcend-api/database/schema-affiliate-program.sql
```

2. **Register Routes**
```typescript
// In your Express app setup
import affiliateRoutes from './routes/affiliateRoutes';

app.use('/api/v1/affiliate', affiliateRoutes);
```

3. **Set Up Cron Job**
```typescript
// Process payouts every hour
CronJob.from({
  cronTime: '0 * * * *',
  onTick: async () => {
    await affiliateService.processPendingPayouts();
  },
  start: true
});
```

4. **Frontend Integration**
```typescript
import { AffiliateDashboard } from '@/pages/AffiliateDashboard';

// In your router
<Route path="/dashboard/affiliate" element={<AffiliateDashboard />} />
```

## Usage Examples

### Example 1: Record Affiliate Signup

```typescript
// When a client signs up via affiliate link
const affiliateCode = req.query.aff;
const link = await affiliateService.getTrackingLink(affiliateCode);

// Record commission
await affiliateService.recordCommission(
  link.affiliateId,
  'signup',
  150,
  {
    clientId: newClient.id,
    referralSource: affiliateCode
  }
);
```

### Example 2: Create Tiered Commission Structure

```typescript
// Approve affiliate with tier-based commission
await affiliateService.approveAffiliate(
  affiliateId,
  'premium', // tier: basic (10%), premium (15%), elite (20%)
  15
);
```

### Example 3: Automated Monthly Payouts

```typescript
// Scheduled job - runs on 1st of each month
CronJob.from({
  cronTime: '0 0 1 * *',
  onTick: async () => {
    // Get all active affiliates
    const affiliates = await affiliateService.listAffiliates(
      { status: 'active' },
      1000,
      0
    );

    for (const affiliate of affiliates) {
      // Create payout if threshold met
      await affiliateService.createPayout(affiliate.id, 100);
    }

    // Process all pending payouts
    await affiliateService.processPendingPayouts();
  }
});
```

### Example 4: Handle Tracking Link Click

```typescript
// In public redirect endpoint
app.get('/ref/:code', async (req, res) => {
  const { code } = req.params;

  // Record click
  await affiliateService.recordLinkClick(
    code,
    req.ip,
    req.get('user-agent')
  );

  // Get target URL
  const link = await affiliateService.getTrackingLink(code);
  
  if (link) {
    res.redirect(link.url);
  } else {
    res.redirect('/');
  }
});
```

## Security Considerations

1. **Data Encryption**
   - Payment details encrypted at rest
   - Sensitive data masked in logs

2. **Rate Limiting**
   - Affiliate endpoints rate-limited to prevent abuse
   - Click tracking rate-limited per IP

3. **Fraud Detection**
   - Automatic fraud scoring
   - Manual approval for high-risk commissions
   - IP-based duplicate detection

4. **Access Control**
   - Only authenticated users can access their affiliate dashboard
   - Admins-only endpoints for sensitive operations
   - Payment data protected with PCI compliance

5. **Audit Logging**
   - All actions logged via auditLogger
   - Commission approval chain tracked
   - Payout processing logged

## Monitoring & Alerts

### Key Metrics to Monitor

```typescript
// Daily metrics
- Active affiliate count
- Total commissions issued
- Total pending payouts
- Average conversion rate
- High fraud scores (>50)

// Monthly metrics
- Total revenue driven
- Total payouts processed
- Top 10 performing affiliates
- Fraud detection success rate
```

### Alert Triggers

1. Affiliate fraud score > 75 → Suspend & notify
2. Payout processing failure → Retry & notify
3. Unusual commission amount → Manual review
4. High click volume from single IP → Review pattern

## Testing

### Test Affiliate Signup Flow

```bash
curl -X POST http://localhost:3000/api/v1/affiliate/signup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "companyName": "Test Partner",
    "email": "partner@test.com",
    "taxId": "12-3456789"
  }'
```

### Test Tracking Link

```bash
curl -X POST http://localhost:3000/api/v1/affiliate/links \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "campaignName": "Test Campaign"
  }'
```

### Test Commission Recording

```bash
curl -X POST http://localhost:3000/api/v1/affiliate/record-commission \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "affiliateId": "uuid-here",
    "type": "signup",
    "amount": 150,
    "referralSource": "aff_code_here"
  }'
```

## Troubleshooting

### Payout Not Processing

1. Check affiliate fraud score (should be < 75)
2. Verify payment method configured
3. Check payment gateway credentials
4. Review transaction logs
5. Manually retry with `/api/v1/affiliate/process-payouts`

### Commissions Not Tracking

1. Verify tracking link is active
2. Check referral source matches
3. Confirm commission type is valid
4. Review fraud detection logs

### Fraud Flags False Positives

1. Review fraud indicator details
2. Call `resolveFraudFlag` to approve legitimate activity
3. Adjust fraud score thresholds if needed

## Future Enhancements

1. **Advanced Analytics**
   - Cohort analysis
   - Lifetime value calculations
   - Attribution modeling

2. **AI/ML Fraud Detection**
   - Pattern recognition
   - Anomaly detection
   - Predictive scoring

3. **Affiliate Tiers**
   - Dynamic tier progression
   - Performance-based tier increases
   - Tier-specific benefits

4. **Commission Rules Engine**
   - Complex commission calculations
   - Promotional periods
   - Category-based commissions

5. **Mobile App**
   - Affiliate management on iOS/Android
   - Push notifications for payouts
   - Real-time stats

## Support

For issues or questions:
1. Review this guide
2. Check database logs: `SELECT * FROM affiliate_logs`
3. Review service logs for errors
4. Check fraud detection logs
5. Contact development team

## Endpoints Reference

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/affiliate/signup` | Yes | Register new affiliate |
| GET | `/affiliate/profile` | Yes | Get affiliate profile |
| PUT | `/affiliate/profile` | Yes | Update profile |
| POST | `/affiliate/links` | Yes | Create tracking link |
| GET | `/affiliate/links` | Yes | List tracking links |
| GET | `/affiliate/commissions` | Yes | Get commissions |
| POST | `/affiliate/payouts` | Yes | Request payout |
| GET | `/affiliate/payouts` | Yes | Get payout history |
| GET | `/affiliate/stats` | Yes | Get performance stats |
| GET | `/affiliate/marketing-materials` | Yes | Get marketing assets |
| GET | `/affiliate/analytics` | Admin | Platform analytics |
| POST | `/affiliate/admin/approve` | Admin | Approve affiliate |
| POST | `/affiliate/admin/suspend` | Admin | Suspend affiliate |
| POST | `/affiliate/process-payouts` | Cron | Process payouts |

---

**Last Updated:** August 2024
**Version:** 1.0.0
**Status:** Production Ready
