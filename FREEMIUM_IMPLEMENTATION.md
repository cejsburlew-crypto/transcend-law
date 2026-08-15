# Freemium Model Implementation Guide

## Overview

This document outlines the complete freemium model implementation for Transcend Law Platform with upgrade prompts, conversion tracking, and trial management.

## Architecture

### Components

```
├── Backend Service (freemiumService.ts)
│   ├── Subscription Management
│   ├── Usage Tracking
│   ├── Feature Limits
│   └── Conversion Metrics
│
├── API Routes (freemiumRoutes.ts)
│   ├── Subscription Endpoints
│   ├── Usage Tracking
│   ├── Feature Checks
│   └── Upgrade Flow
│
├── Frontend Component (UpgradePrompt.tsx)
│   ├── Feature Comparison
│   ├── Pricing Display
│   ├── Trial Management
│   └── Conversion Tracking
│
└── Database Schema (schema-freemium.sql)
    ├── user_subscriptions
    ├── subscription_usage
    ├── conversion_metrics
    └── Pricing Configuration
```

## Tier Specifications

### Free Tier
- **5 active cases** (limit reached trigger for upgrade)
- **500 MB storage**
- **50 documents** max
- **Basic case management** only
- **Email support**
- **7-day trial included**

### Professional Tier
- **1,000 active cases** - for growing practices
- **50 GB storage**
- **5,000 documents**
- **Advanced features**:
  - Case analysis tools
  - Priority email support
  - API access
  - Custom branding
  - Advanced reporting
  - Bulk operations

### Enterprise Tier
- **Unlimited cases**
- **Unlimited storage**
- **All Pro features**
- **Custom integrations**
- **Dedicated account manager**
- **24/7 phone support**
- **99.99% SLA guarantee**

## Installation

### 1. Database Setup

```bash
# Apply the freemium schema
psql -U postgres -d transcend_db -f transcend-api/database/schema-freemium.sql

# Verify tables created
\dt user_subscriptions
\dt subscription_usage
\dt conversion_metrics
\dt pricing_plans
```

### 2. Backend Integration

#### Install Dependencies
```bash
npm install uuid
# (already in package.json)
```

#### Register Routes in Express App

```typescript
// In transcend-api/src/app.ts or main server file
import freemiumRoutes from './routes/freemiumRoutes';

app.use('/api/v2/freemium', freemiumRoutes);
```

#### Initialize New User Subscriptions

```typescript
// In user registration/creation endpoint
import { createUserSubscription } from '../services/freemiumService';

// When new user signs up
const subscription = await createUserSubscription(
  newUserId,
  'free',  // Start on free tier
  true     // Include 7-day trial
);
```

### 3. Frontend Integration

#### Install Component

```bash
# Already included in components directory
transcend-frontend/src/components/UpgradePrompt.tsx
transcend-frontend/src/components/UpgradePrompt.css
```

#### Add to App

```tsx
// In your case creation or main dashboard component
import { UpgradePrompt } from './components/UpgradePrompt';

// In component render:
<UpgradePrompt
  userId={currentUserId}
  feature="Cases"
  currentUsage={userCases}
  limit={5}
  currentTier="free"
  trialDaysRemaining={7}
  showImmediately={isAtLimit}
  onUpgradeClick={() => {
    // Refresh user subscription
    refetchSubscription();
  }}
/>
```

## Usage Patterns

### 1. Case Creation with Limit Check

```typescript
// Backend endpoint
app.post('/api/v2/cases', async (req, res) => {
  const userId = req.user.id;

  // Check if user can create case
  const featureCheck = await checkFeatureLimit(userId, 'Cases');
  
  if (!featureCheck.allowed) {
    return res.status(402).json({
      error: 'Case limit reached',
      limit: featureCheck.limit,
      current: featureCheck.current,
      upgradeUrl: '/upgrade?tier=pro&source=cases'
    });
  }

  // Create case
  const newCase = await createCase(req.body);
  
  // Track usage
  await incrementCaseCount(userId);

  res.json(newCase);
});
```

### 2. Document Upload with Limit Check

```typescript
// Frontend
async function handleDocumentUpload(file: File) {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/v2/freemium/usage/increment-document', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        count: 1,
        storageMB: file.size / (1024 * 1024)
      })
    });

    if (response.status === 402) {
      // Show upgrade prompt
      const data = await response.json();
      showUpgradePrompt(data);
      return;
    }

    if (response.ok) {
      // Upload successful
    }
  } catch (error) {
    console.error('Upload failed:', error);
  }
}
```

### 3. Upgrade Flow

```typescript
// When user clicks upgrade
async function handleUpgrade(billingCycle: 'monthly' | 'annual') {
  try {
    const response = await fetch('/api/v2/freemium/upgrade', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        newTier: 'pro',
        billingCycle
      })
    });

    if (response.ok) {
      // Redirect to success page
      window.location.href = '/dashboard?upgraded=true';
    }
  } catch (error) {
    console.error('Upgrade failed:', error);
  }
}
```

## Feature Limits Implementation

### Adding New Feature Limit

1. **Define in freemiumService.ts**:
```typescript
const FEATURE_LIMITS: Record<UserTier, Record<string, number | boolean>> = {
  free: {
    // Add new feature
    customReports: false,
  },
  pro: {
    customReports: true,
  },
  // ...
};
```

2. **Add to Feature Comparison**:
```typescript
const FEATURE_COMPARISON: FeatureComparison = {
  features: [
    {
      name: 'Custom Reports',
      category: 'Advanced Features',
      free: false,
      pro: true,
      enterprise: true,
    },
    // ...
  ],
};
```

3. **Check in Backend**:
```typescript
const isAvailable = isFeatureAvailable(tier, 'customReports');
```

## Conversion Tracking

### Tracked Events

1. **prompt_shown** - User sees upgrade prompt
2. **comparison_viewed** - User views feature comparison
3. **trial_started** - User begins trial period
4. **upgrade_clicked** - User clicks upgrade button
5. **payment_completed** - Successful upgrade
6. **upgrade_cancelled** - User cancels upgrade

### Analytics Dashboard Query

```sql
-- Conversion funnel
SELECT
  DATE(timestamp) as date,
  COUNT(CASE WHEN event = 'prompt_shown' THEN 1 END) as prompts,
  COUNT(CASE WHEN event = 'upgrade_clicked' THEN 1 END) as clicks,
  COUNT(CASE WHEN event = 'payment_completed' THEN 1 END) as payments,
  ROUND(
    COUNT(CASE WHEN event = 'payment_completed' THEN 1 END)::numeric /
    NULLIF(COUNT(CASE WHEN event = 'prompt_shown' THEN 1 END), 0) * 100, 2
  ) as conversion_rate
FROM conversion_metrics
GROUP BY DATE(timestamp)
ORDER BY date DESC;
```

### Retrieve Funnel Metrics

```typescript
const metrics = await getConversionFunnelMetrics(
  new Date('2024-01-01'),
  new Date('2024-12-31')
);

console.log(`Conversion Rate: ${metrics.conversionRate}%`);
// Output: Conversion Rate: 12.5%
```

## Trial Management

### Trial Lifecycle

1. **Creation**: 7 days at signup (free tier)
2. **Active**: Full Pro features during trial
3. **Expiration**: Auto-downgrade to free tier
4. **Extension**: Can extend 7 more days (once)
5. **Conversion**: Upgrade to paid plan

### Trial Expiration Notification

```typescript
// Background job to check expiring trials
import { query } from '../database/connection';

async function notifyExpiringTrials() {
  const result = await query(`
    SELECT id, email, trial_end_date FROM expiring_trials
    WHERE days_until_expiration = 3
  `);

  for (const user of result.rows) {
    // Send email notification
    await sendEmail(user.email, {
      subject: 'Your free trial ends in 3 days',
      template: 'trial-expiring',
      data: {
        username: user.email,
        expiryDate: user.trial_end_date
      }
    });
  }
}

// Run daily
cron.schedule('0 9 * * *', notifyExpiringTrials);
```

## Error Handling

### Common Status Codes

| Code | Scenario | Response |
|------|----------|----------|
| 402 | Feature limit reached | `{ error: 'limit_reached', limit: 5, current: 5 }` |
| 404 | No subscription found | `{ error: 'subscription_not_found' }` |
| 400 | Invalid request | `{ error: 'invalid_upgrade_tier' }` |
| 401 | Unauthorized | `{ error: 'unauthorized' }` |

### Frontend Error Handling

```typescript
if (response.status === 402) {
  // Show upgrade prompt
  const data = await response.json();
  showUpgradePrompt({
    feature: data.feature,
    currentUsage: data.current,
    limit: data.limit,
    message: `You've reached your limit of ${data.limit} ${data.feature.toLowerCase()}`
  });
} else if (response.status === 401) {
  // Redirect to login
  window.location.href = '/login';
} else if (!response.ok) {
  // Show generic error
  showError('An error occurred. Please try again.');
}
```

## Security Considerations

### 1. Subscription Verification

```typescript
// Always verify subscription on each request
const subscription = await getUserSubscription(userId);
if (!subscription || subscription.status !== 'active') {
  throw new Error('Invalid subscription');
}
```

### 2. Audit Logging

```typescript
// All subscription changes are logged
await logAction(userId, 'upgrade_completed', {
  fromTier: 'free',
  toTier: 'pro',
  timestamp: new Date()
});
```

### 3. Rate Limiting

```typescript
// Rate limit upgrade endpoints to prevent abuse
app.post('/api/v2/freemium/upgrade',
  rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5 // 5 requests per minute
  }),
  upgradeHandler
);
```

## Testing

### Unit Tests

```typescript
// Example: Test feature limit check
describe('Freemium Service', () => {
  it('should prevent case creation at limit', async () => {
    const userId = 'test-user';
    
    // Set 5 cases (at limit)
    await createTestCases(userId, 5);
    
    const featureCheck = await checkFeatureLimit(userId, 'Cases');
    
    expect(featureCheck.allowed).toBe(false);
    expect(featureCheck.current).toBe(5);
    expect(featureCheck.limit).toBe(5);
  });

  it('should track upgrade conversion', async () => {
    const userId = 'test-user';
    
    await trackConversionEvent(userId, 'upgrade_clicked');
    
    const metrics = await getConversionFunnelMetrics(
      new Date(),
      new Date()
    );
    
    expect(metrics.totalUpgradesClicked).toBeGreaterThan(0);
  });
});
```

### Integration Tests

```typescript
// Test complete upgrade flow
describe('Upgrade Flow', () => {
  it('should complete upgrade successfully', async () => {
    // 1. Start with free tier
    let subscription = await getUserSubscription(userId);
    expect(subscription.tier).toBe('free');

    // 2. Try to exceed limit
    for (let i = 0; i < 6; i++) {
      await incrementCaseCount(userId);
    }

    // 3. Check limit reached
    const featureCheck = await checkFeatureLimit(userId, 'Cases');
    expect(featureCheck.allowed).toBe(false);

    // 4. Upgrade
    subscription = await upgradeSubscription(userId, 'pro', 'monthly');
    expect(subscription.tier).toBe('pro');

    // 5. Should now be able to create cases
    const newCheck = await checkFeatureLimit(userId, 'Cases');
    expect(newCheck.allowed).toBe(true);
  });
});
```

## Monitoring & Analytics

### Key Metrics

1. **Conversion Funnel**
   - Prompts shown → Upgrades clicked → Payments completed
   - Target: 10-15% conversion rate

2. **Trial Metrics**
   - Trial starts → Trial conversions → Trial expirations
   - Target: 20-30% trial to paid conversion

3. **Usage Patterns**
   - Most common limiting feature
   - Average days to limit reached
   - Target: Optimize prompts based on data

### Query Examples

```sql
-- Trial conversion rate
SELECT
  COUNT(DISTINCT CASE WHEN tier = 'pro' THEN user_id END)::numeric /
  COUNT(DISTINCT CASE WHEN is_trial_active = true THEN user_id END) * 100
    as trial_conversion_rate
FROM user_subscriptions;

-- Average usage by tier
SELECT
  tier,
  AVG(cases_active) as avg_cases,
  AVG(storage_used) as avg_storage,
  AVG(documents_uploaded) as avg_documents
FROM freemium_analytics
GROUP BY tier;
```

## Next Steps

1. **Implement payment processing** (Stripe/Paddle integration)
2. **Add email notifications** for trial expiration
3. **Create admin dashboard** for freemium metrics
4. **Set up automated downgrade** for expired trials
5. **A/B test upgrade prompts** for optimization

## Support

For questions or issues:
1. Check logs in `transcend-api/services/auditLogger.ts`
2. Review SQL queries in `schema-freemium.sql`
3. Test endpoints with Postman/curl
4. Enable debug logging: `DEBUG=freemium:*`

## Changelog

- **v1.0.0** - Initial freemium model
  - Free tier: 5 cases
  - Pro tier: 1,000 cases
  - 7-day trial period
  - Conversion tracking
  - Feature comparison
