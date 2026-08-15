# Freemium API Reference

Quick reference for all freemium endpoints and common integration patterns.

## Base URL

```
https://api.transcend.law/api/v2/freemium
```

## Authentication

All endpoints require Bearer token:
```
Authorization: Bearer {authToken}
```

---

## Subscription Management

### Get Current Subscription

```http
GET /subscription
```

**Response:**
```json
{
  "subscription": {
    "id": "sub_123",
    "userId": "user_456",
    "tier": "free",
    "status": "active",
    "isTrialActive": true,
    "trialEndDate": "2024-09-15T00:00:00Z"
  },
  "usage": {
    "casesActive": 3,
    "storageUsed": 250,
    "documentsUploaded": 12
  },
  "trialDaysRemaining": 7
}
```

### Create New Subscription

```http
POST /subscription/create
Content-Type: application/json

{
  "tier": "free",
  "includeFreeTrial": true
}
```

**Response:**
```json
{
  "id": "sub_123",
  "userId": "user_456",
  "tier": "free",
  "status": "active",
  "createdAt": "2024-08-15T10:30:00Z"
}
```

---

## Usage Tracking

### Increment Case Count

```http
POST /usage/increment-case
Content-Type: application/json

{
  "count": 1
}
```

**Success Response (200):**
```json
{
  "success": true,
  "usage": {
    "casesActive": 4,
    "casesCreated": 4
  }
}
```

**Limit Reached Response (402):**
```json
{
  "error": "Case limit reached",
  "limit": 5,
  "current": 5,
  "requiresUpgrade": true
}
```

### Increment Document Count

```http
POST /usage/increment-document
Content-Type: application/json

{
  "count": 1,
  "storageMB": 2.5
}
```

**Success Response (200):**
```json
{
  "success": true,
  "usage": {
    "documentsUploaded": 13,
    "storageUsed": 252.5
  }
}
```

### Get Current Usage

```http
GET /usage
```

**Response:**
```json
{
  "id": "usage_789",
  "userId": "user_456",
  "casesActive": 3,
  "casesCreated": 5,
  "storageUsed": 250.5,
  "documentsUploaded": 12,
  "lastUpdated": "2024-08-15T14:20:00Z"
}
```

---

## Feature Limits

### Check Feature Limit

```http
GET /check-limit/Cases
```

**Response:**
```json
{
  "allowed": true,
  "current": 3,
  "limit": 5,
  "percentageUsed": 60,
  "needsUpgrade": false,
  "tier": "free"
}
```

### Get Feature Comparison & Pricing

```http
GET /features
```

**Response:**
```json
{
  "features": [
    {
      "name": "Active Cases",
      "category": "Core Features",
      "free": "5 cases",
      "pro": "1,000 cases",
      "enterprise": "Unlimited"
    },
    {
      "name": "Case Analysis",
      "category": "Advanced Features",
      "free": false,
      "pro": true,
      "enterprise": true
    }
  ],
  "pricingTiers": [
    {
      "name": "free",
      "displayName": "Free",
      "monthlyPrice": 0,
      "annualPrice": 0,
      "features": ["5 active cases", "500 MB storage", "Email support"]
    },
    {
      "name": "pro",
      "displayName": "Professional",
      "monthlyPrice": 99,
      "annualPrice": 990,
      "features": ["1,000 active cases", "50 GB storage", "Priority support"]
    }
  ]
}
```

### Get Upgrade Prompt Context

```http
GET /upgrade-prompt/Cases
```

**Response:**
```json
{
  "userId": "user_456",
  "currentTier": "free",
  "currentUsage": 5,
  "limit": 5,
  "feature": "Cases",
  "upgradeUrl": "/upgrade?tier=pro&source=Cases",
  "trialDaysRemaining": 7
}
```

---

## Upgrade Flow

### Upgrade to Pro Tier

```http
POST /upgrade
Content-Type: application/json

{
  "newTier": "pro",
  "billingCycle": "monthly"
}
```

**Request Options:**
- `newTier`: `"pro"` | `"enterprise"`
- `billingCycle`: `"monthly"` | `"annual"` (default: `"monthly"`)

**Success Response (200):**
```json
{
  "success": true,
  "subscription": {
    "id": "sub_123",
    "tier": "pro",
    "status": "active",
    "billingCycle": "monthly",
    "trialStatus": "converted",
    "paidPlanStartDate": "2024-08-15T15:00:00Z"
  },
  "message": "Successfully upgraded to pro tier"
}
```

**Error Response (400):**
```json
{
  "error": "Invalid tier"
}
```

---

## Trial Management

### Get Trial Remaining Days

```http
GET /trial-remaining
```

**Response:**
```json
{
  "daysRemaining": 7
}
```

### Extend Trial by 7 Days

```http
POST /extend-trial
Content-Type: application/json

{}
```

**Success Response (200):**
```json
{
  "success": true,
  "trialDaysRemaining": 14,
  "message": "Trial extended by 7 days"
}
```

**Error Response (400):**
```json
{
  "error": "Trial is not active"
}
```

---

## Conversion Tracking

### Track Event

```http
POST /track
Content-Type: application/json

{
  "event": "upgrade_clicked",
  "metadata": {
    "feature": "Cases",
    "currentTier": "free"
  }
}
```

**Event Types:**
- `prompt_shown` - User sees upgrade prompt
- `comparison_viewed` - User views feature table
- `upgrade_clicked` - User clicks upgrade button
- `payment_completed` - Upgrade successful
- `upgrade_cancelled` - User cancels upgrade
- `trial_started` - User begins trial

**Response:**
```json
{
  "success": true,
  "metrics": {
    "id": "metric_123",
    "event": "upgrade_clicked",
    "timestamp": "2024-08-15T15:10:00Z"
  }
}
```

### Get Conversion Funnel Metrics (Admin Only)

```http
GET /analytics/funnel?startDate=2024-08-01&endDate=2024-08-31
```

**Response:**
```json
{
  "totalPromptsSeen": 450,
  "totalComparisonsViewed": 210,
  "totalUpgradesClicked": 85,
  "totalPaymentsCompleted": 12,
  "conversionRate": 2.67
}
```

---

## Error Codes

| Code | Error | Meaning |
|------|-------|---------|
| 200 | OK | Request successful |
| 400 | Bad Request | Invalid parameters |
| 401 | Unauthorized | Missing/invalid auth token |
| 402 | Payment Required | Feature limit reached |
| 404 | Not Found | Subscription not found |
| 500 | Server Error | Internal error |

---

## Common Integration Patterns

### Pattern 1: Case Creation with Limit Check

```typescript
async function createCase(caseData: CaseInput): Promise<Case> {
  // Check limit first
  const featureCheck = await fetch('/api/v2/freemium/check-limit/Cases', {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json());

  if (!featureCheck.allowed) {
    // Show upgrade prompt
    showUpgradeModal({
      feature: 'Cases',
      current: featureCheck.current,
      limit: featureCheck.limit
    });
    return null;
  }

  // Create case
  const response = await fetch('/api/v2/cases', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(caseData)
  });

  // Track usage
  await fetch('/api/v2/freemium/usage/increment-case', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ count: 1 })
  });

  return response.json();
}
```

### Pattern 2: Display Upgrade Prompt Component

```tsx
// In your React component
import { UpgradePrompt } from './UpgradePrompt';

function Dashboard() {
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    // Fetch current subscription
    fetch('/api/v2/freemium/subscription', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setSubscription(data.subscription);
        setUsage(data.usage);
      });
  }, []);

  const isAtLimit = usage?.casesActive >= 5 && subscription?.tier === 'free';

  return (
    <>
      <Dashboard />
      
      {isAtLimit && (
        <UpgradePrompt
          userId={userId}
          feature="Cases"
          currentUsage={usage.casesActive}
          limit={5}
          currentTier={subscription.tier}
          trialDaysRemaining={subscription.trialEndDate ? 
            calculateDaysRemaining(subscription.trialEndDate) : undefined}
          showImmediately={true}
          onUpgradeClick={() => {
            // Refresh subscription
            refetchSubscription();
          }}
        />
      )}
    </>
  );
}
```

### Pattern 3: Track Conversion Events

```typescript
// Track when user views feature comparison
await fetch('/api/v2/freemium/track', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    event: 'comparison_viewed',
    metadata: {
      feature: 'Cases',
      currentTier: 'free'
    }
  })
});

// Track when user clicks upgrade
await fetch('/api/v2/freemium/track', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    event: 'upgrade_clicked',
    metadata: {
      fromTier: 'free',
      toTier: 'pro',
      billingCycle: 'monthly'
    }
  })
});
```

### Pattern 4: Handle Upgrade

```typescript
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
      const data = await response.json();
      
      // Track successful payment
      await fetch('/api/v2/freemium/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          event: 'payment_completed',
          metadata: { billingCycle }
        })
      });

      // Redirect to success page
      window.location.href = '/dashboard?upgraded=true';
    } else if (response.status === 402) {
      showError('Upgrade limit reached. Please try again later.');
    }
  } catch (error) {
    showError('Upgrade failed. Please try again.');
  }
}
```

---

## Rate Limits

- **Subscription endpoints**: 10 requests/minute per user
- **Upgrade endpoint**: 5 requests/minute per user
- **Tracking endpoint**: 100 requests/minute per user
- **Analytics endpoints**: 30 requests/minute per admin

---

## Webhook Events (Future)

Coming in v1.1:
- `subscription.created`
- `subscription.upgraded`
- `trial.extended`
- `trial.expired`
- `upgrade.completed`

---

## Support

For API issues:
- Check logs: `curl -H "Authorization: Bearer $TOKEN" https://api.transcend.law/api/v2/freemium/debug`
- Enable debug mode: Add `?debug=1` to any request
- Contact: api-support@transcend.law

---

## Changelog

- **v1.0.0** (2024-08-15)
  - Initial release
  - Subscription management
  - Usage tracking
  - Conversion analytics
