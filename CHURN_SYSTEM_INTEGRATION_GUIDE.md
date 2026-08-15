# Churn System Integration Quick Guide

## Step 1: Database Migration

```bash
# Execute schema in your PostgreSQL database
psql -U your_db_user -d transcend_law < transcend-api/database/churn-schema.sql

# Verify tables created
psql -U your_db_user -d transcend_law -c "\dt churn_*"
```

## Step 2: Update Email Service

Add churn win-back template to `/transcend-api/src/services/emailService.ts`:

```typescript
import churnWinBackTemplate from './emailTemplates/churnWinBack';

const emailTemplates = {
  // ... existing templates
  churnWinBack: {
    subject: 'We miss you - Here\'s a special offer just for you',
    template: 'churn-winback',
    type: 'transactional',
  },
};
```

## Step 3: Register API Routes

Update your Express app configuration (`index.ts` or equivalent):

```typescript
import churnRoutes from './routes/churnRoutes';

// Mount churn routes
app.use('/api/churn', churnRoutes);

// Verify routes loaded
console.log('Churn routes registered at /api/churn');
```

## Step 4: Add Frontend Components

Import and use in your dashboard/admin pages:

### User Alert (Customer-Facing)

```tsx
import ChurnAlert from './components/ChurnAlert';

export function DashboardPage() {
  return (
    <div>
      <ChurnAlert 
        userId={currentUser.id}
        onDismiss={() => console.log('Alert dismissed')}
        compact={false}
      />
      {/* ... rest of dashboard ... */}
    </div>
  );
}
```

### Admin Dashboard

```tsx
import { ChurnAnalyticsDashboard } from './components/ChurnAlert';

export function AdminChurnPage() {
  return (
    <div className="admin-page">
      <h1>Churn Prevention Dashboard</h1>
      <ChurnAnalyticsDashboard onRefresh={() => {}} />
    </div>
  );
}
```

## Step 5: Configure Cron Jobs (Optional but Recommended)

```typescript
import schedule from 'node-schedule';
import ChurnPredictionService from './services/churnPrediction';

// Daily churn prediction (2 AM UTC)
schedule.scheduleJob('0 2 * * *', async () => {
  try {
    console.log('Starting daily churn predictions...');
    const predictions = await ChurnPredictionService.predictChurnForAllUsers();
    console.log(`✓ Predicted churn for ${predictions.length} users`);
  } catch (error) {
    console.error('Churn prediction failed:', error);
  }
});

// Weekly automated campaigns (Monday 9 AM UTC)
schedule.scheduleJob('0 9 * * 1', async () => {
  try {
    console.log('Starting weekly win-back campaigns...');
    const result = await ChurnPredictionService.runAutomatedChurnCampaigns();
    console.log(`✓ Created ${result.campaignsCreated} campaigns, sent ${result.emailsSent} emails`);
  } catch (error) {
    console.error('Campaign run failed:', error);
  }
});
```

## Step 6: Update Authentication Middleware

Ensure your auth middleware files (`/middleware/auth.ts`) include:

```typescript
// Make sure these functions exist
export function authenticateUser(req: Request, res: Response, next: NextFunction) {
  // Your existing auth logic
  next();
}

export function authorizeAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.isAdmin) {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
}
```

## Step 7: Manual Trigger (Testing)

```bash
# Trigger churn prediction for all users
curl -X POST http://localhost:3000/api/churn/predict-all \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Get at-risk users
curl http://localhost:3000/api/churn/at-risk-users \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Get analytics
curl http://localhost:3000/api/churn/analytics \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Step 8: Testing the System

### 1. Test Prediction API

```bash
# Get current user's churn prediction
curl http://localhost:3000/api/churn/prediction/current \
  -H "Authorization: Bearer YOUR_USER_TOKEN"

# Response example:
{
  "userId": "user-123",
  "email": "user@example.com",
  "churnProbability": 0.72,
  "riskSegment": "high",
  "riskFactors": [
    "No login activity in 60+ days",
    "No cases submitted in 90 days"
  ],
  "recommendedActions": [
    "Email campaign with personal touch",
    "Moderate discount offer (10-15%)"
  ],
  "retentionScore": 28,
  "predictedValueAtRisk": 1200
}
```

### 2. Test Campaign Creation

```bash
curl -X POST http://localhost:3000/api/churn/create-campaign \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "discountPercentage": 15,
    "prioritySupportDays": 30
  }'
```

### 3. Test Analytics

```bash
curl http://localhost:3000/api/churn/analytics \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" | jq
```

## Step 9: Monitor & Validate

Check that everything is working:

```bash
# 1. Verify tables exist
psql -U your_db_user -d transcend_law -c "
  SELECT table_name FROM information_schema.tables 
  WHERE table_name LIKE 'churn%' OR table_name LIKE 'win_back%'
  ORDER BY table_name;
"

# 2. Check for errors in logs
tail -f logs/app.log | grep -i churn

# 3. Verify API routes
curl http://localhost:3000/health

# 4. Test frontend component
# Navigate to admin dashboard and verify ChurnAnalyticsDashboard renders
```

## Configuration Variables

Add to your `.env` file:

```env
# Churn System
CHURN_ENABLED=true
CHURN_MIN_PROBABILITY=0.5
CHURN_CAMPAIGN_BATCH_SIZE=100
CHURN_EMAIL_DELAY_MS=1000

# Campaign Defaults
DEFAULT_DISCOUNT_PERCENTAGE=10
DEFAULT_SUPPORT_DAYS=30
DEFAULT_DISCOUNT_EXPIRY_DAYS=7

# Scheduling
ENABLE_CRON_JOBS=true
CHURN_PREDICTION_SCHEDULE="0 2 * * *"  # 2 AM daily
CAMPAIGN_RUN_SCHEDULE="0 9 * * 1"      # 9 AM Monday
```

## Troubleshooting Checklist

- [ ] Database schema applied successfully
- [ ] API routes registered and accessible
- [ ] Email service has churn-winback template
- [ ] Authentication middleware functioning
- [ ] Frontend components rendering
- [ ] Cron jobs scheduled (if using)
- [ ] Email service credentials configured
- [ ] SendGrid API key active
- [ ] Analytics dashboard showing data
- [ ] Campaign tracking pixels working

## Success Criteria

Your system is ready when:

1. ✓ `GET /api/churn/prediction/current` returns valid prediction
2. ✓ `GET /api/churn/analytics` returns populated metrics
3. ✓ ChurnAlert component displays on user dashboard
4. ✓ ChurnAnalyticsDashboard shows in admin panel
5. ✓ Campaign emails send without errors
6. ✓ Email opens/clicks are tracked
7. ✓ Retention score updates correctly

## Performance Baseline

Expected performance metrics:

- **Prediction calculation**: 30-100ms per user
- **Full dataset (5000 users)**: 3-5 minutes
- **Campaign creation**: 50-200ms per campaign
- **Email send rate**: 100-500 per minute
- **Analytics query**: 500-1000ms
- **Dashboard load**: 1-2 seconds

## Next Steps

1. Monitor churn metrics weekly
2. Adjust feature weights based on results
3. Test different discount tiers
4. Analyze campaign performance
5. Optimize email templates based on click rates
6. Add A/B testing for subject lines
7. Integrate with CRM for customer feedback

## Support

Issues? Check:

1. `logs/churn/` for error logs
2. Database tables for data accuracy
3. API response codes (200, 400, 403, 500)
4. Email delivery logs in SendGrid

---

**Estimated Setup Time**: 15-30 minutes
**Production Ready**: Yes
**Last Updated**: 2026-08-15
