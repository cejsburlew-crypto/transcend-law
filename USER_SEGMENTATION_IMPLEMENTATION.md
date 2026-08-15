# User Segmentation & Personalized Journeys Implementation Guide

## Overview

This comprehensive guide covers the implementation of a multi-dimensional user segmentation system with personalized journeys, optimized CTAs, A/B testing capabilities, and performance tracking for the Transcend Law Platform.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Layer                           │
│  PersonalizedUI.tsx - React Component                       │
│  - Card, Banner, Modal, Inline variants                     │
│  - Real-time analytics tracking                             │
│  - Journey visualization                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer                                │
│  /api/v2/personalization/* endpoints                        │
│  - Authentication & Authorization                          │
│  - Rate limiting & caching                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                 Service Layer                               │
│  UserSegmentationService.ts                                 │
│  - Segmentation algorithms                                 │
│  - CTA management                                          │
│  - Journey orchestration                                   │
│  - A/B testing                                             │
│  - Analytics & reporting                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                 Data Layer                                  │
│  PostgreSQL Database                                        │
│  - Segmentation tables                                      │
│  - CTA interaction logs                                     │
│  - Journey tracking                                         │
│  - A/B test results                                         │
│  - Performance metrics                                      │
└─────────────────────────────────────────────────────────────┘
```

## Database Setup

### 1. Initialize Segmentation Schema

```bash
# Load the segmentation schema
psql -U transcend_admin -d transcend_law -f transcend-api/database/schema-segmentation.sql
```

### 2. Key Tables

#### user_segments
- Stores user segmentation data across multiple dimensions
- **Fields**: id, user_id, lifecycle, value, engagement, service_types, behavior_patterns, risk_factors, recommended_ctas

#### recommended_ctas
- Stores CTA configurations per segment
- **Fields**: id, segment_type, action, text, priority, conversion_rate, impression_count, click_count

#### cta_interactions
- Tracks all CTA interactions for analytics
- **Fields**: id, user_id, cta_id, action (shown/clicked/converted), created_at

#### segment_performance
- Tracks performance metrics per segment
- **Fields**: id, segment_id, user_id, ctas_shown, ctas_clicked, conversion_rate, revenue, churn_risk

#### ab_tests
- Stores A/B test configurations and results
- **Fields**: id, test_name, segment, variant1_cta, variant2_cta, status, results

### 3. Indexes

The schema includes comprehensive indexing for:
- Fast user segment lookups
- CTA interaction queries (time-range based)
- Performance metric aggregations
- A/B test filtering

### 4. Materialized Views

- **segment_summary**: Aggregated segment data with interaction statistics

### 5. Triggers

- **update_segment_on_activity**: Automatically updates segment last_updated on user activity
- **update_cta_metrics**: Updates CTA metrics when interactions are logged

## Backend Integration

### 1. Install Dependencies

```bash
npm install uuid pg dotenv
```

### 2. Configure Environment Variables

```env
# .env
DB_USER=transcend_admin
DB_PASSWORD=<your_secure_password>
DB_HOST=localhost
DB_PORT=5432
DB_NAME=transcend_law
```

### 3. Register API Routes

In your main server file (e.g., `transcend-api/src/server.ts`):

```typescript
import personalizationRoutes from './routes/personalization';

// ... other imports and setup

app.use('/api/v2/personalization', personalizationRoutes);
```

### 4. Available Endpoints

#### User Segmentation
- `GET /api/v2/personalization/segment/:userId` - Get user segment
- `POST /api/v2/personalization/segment/:userId/refresh` - Refresh segmentation

#### CTAs
- `GET /api/v2/personalization/ctas/:userId` - Get personalized CTAs
- `POST /api/v2/personalization/track-cta` - Track CTA interaction

#### Journeys
- `GET /api/v2/personalization/journey/:userId` - Get personalized journey

#### Analytics
- `GET /api/v2/personalization/analytics/:userId` - Get user analytics

#### A/B Testing (Admin only)
- `POST /api/v2/personalization/ab-tests` - Create A/B test
- `GET /api/v2/personalization/ab-tests/:testId/variant/:userId` - Get variant
- `POST /api/v2/personalization/ab-tests/:testId/result` - Record result
- `POST /api/v2/personalization/ab-tests/:testId/end` - End test

#### Admin Dashboard
- `GET /api/v2/personalization/dashboard` - Get admin dashboard (admin only)
- `GET /api/v2/personalization/metrics` - Get segmentation metrics (admin only)

## Frontend Integration

### 1. Install Dependencies

```bash
npm install react
```

### 2. Basic Usage

```typescript
import PersonalizedUI from './components/PersonalizedUI';

function App() {
  const userId = localStorage.getItem('userId');

  return (
    <PersonalizedUI
      userId={userId}
      variant="card"
      showAnalytics={true}
      onCTAClick={(cta) => {
        console.log('CTA clicked:', cta);
      }}
    />
  );
}
```

### 3. Component Variants

#### Card Variant
Primary personalization component with full details:
- Segment badge
- CTAs with priority levels
- Journey expansion
- Analytics metrics

```typescript
<PersonalizedUI variant="card" userId={userId} />
```

#### Banner Variant
Minimal promotional banner:
- Headline and description
- Single CTA button
- Gradient background

```typescript
<PersonalizedUI variant="banner" userId={userId} />
```

#### Modal Variant
Full-screen modal experience:
- Overlay background
- Close button
- Card content inside

```typescript
<PersonalizedUI variant="modal" userId={userId} />
```

#### Inline Variant
Compact inline element:
- Segment badge
- Multiple CTAs in row
- Minimal space usage

```typescript
<PersonalizedUI variant="inline" userId={userId} />
```

### 4. Styling

The component includes comprehensive CSS with:
- Light and dark mode support
- Responsive design (mobile, tablet, desktop)
- Smooth animations and transitions
- Segment-specific color schemes

Customize colors in CSS:
```css
:root {
  --primary-color: #3498db;
  --success-color: #2ecc71;
  --warning-color: #f39c12;
  --danger-color: #e74c3c;
}
```

## User Segmentation Strategy

### 1. Lifecycle Stages

| Stage | Criteria | Actions |
|-------|----------|---------|
| **New** | Created < 30 days ago | Onboarding, guided tours, welcome offers |
| **Active** | Regular engagement, logged in < 30 days | Upsells, feature highlights, premium upgrades |
| **At-Risk** | No login 60-180 days | Retention offers, re-engagement campaigns, support |
| **Loyal** | Account > 1 year, high engagement | VIP programs, exclusive features, referral programs |
| **Churned** | No login > 180 days | Win-back campaigns, special offers, exit surveys |

### 2. Value Tiers

| Tier | LTV Range | Engagement | Treatment |
|------|-----------|------------|-----------|
| **High** | $5,000+ | Premium | VIP support, exclusive features |
| **Medium** | $1,000-$5,000 | Standard | Regular engagement, targeted offers |
| **Low** | < $1,000 | Basic | Educational content, free resources |

### 3. Engagement Levels

| Level | Activity Threshold | Characteristics |
|-------|-------------------|-----------------|
| **High** | > 100 actions/90d | Frequent user, strong retention signal |
| **Medium** | 20-100 actions/90d | Regular user, growth opportunity |
| **Low** | < 20 actions/90d | Casual user, onboarding needed |
| **Inactive** | No login > 180d | Churn risk, needs re-engagement |

## CTA Management

### 1. Lifecycle-Based CTAs

```typescript
const ctaMap = {
  new: {
    high: {
      text: 'Complete Your Profile',
      action: 'complete_onboarding',
      priority: 'high',
      conversionRate: 0.45,
    },
  },
  active: {
    high: {
      text: 'Upgrade to Pro',
      action: 'upgrade_plan',
      priority: 'high',
      conversionRate: 0.32,
    },
  },
  'at-risk': {
    high: {
      text: 'Special Offer: 50% Off',
      action: 'retention_offer',
      priority: 'high',
      conversionRate: 0.28,
    },
  },
  loyal: {
    high: {
      text: 'Join VIP Program',
      action: 'vip_program',
      priority: 'medium',
      conversionRate: 0.52,
    },
  },
};
```

### 2. CTA Performance Tracking

CTAs automatically track:
- **Impressions**: Number of times shown
- **Clicks**: Number of user clicks
- **Conversions**: Number of successful conversions
- **Conversion Rate**: clicks / impressions
- **Revenue**: Total revenue generated
- **Cost Per Click**: Average cost to acquire a click

## A/B Testing

### 1. Create A/B Test

```typescript
const testConfig = {
  testName: 'CTA Copy Test',
  segment: 'at-risk',
  variant1: {
    cta: {
      id: 'cta-1',
      text: 'Special Offer: 50% Off',
      action: 'retention_offer',
      priority: 'high',
    },
    weight: 0.5,
  },
  variant2: {
    cta: {
      id: 'cta-2',
      text: 'Limited Time Discount',
      action: 'retention_offer',
      priority: 'high',
    },
    weight: 0.5,
  },
  startDate: new Date(),
  status: 'active',
};

const abTest = await UserSegmentationService.createABTest(testConfig);
```

### 2. Track Results

Results automatically tracked when:
- CTA is shown (impression)
- CTA is clicked
- User converts

### 3. Determine Winner

```typescript
const result = await UserSegmentationService.endABTest(testId);
// Returns: { winner: 'variant1' | 'variant2', uplift: number }
```

## Performance Metrics

### 1. Segment Performance

Tracked automatically for each segment:
- CTAs shown/clicked
- Conversion rate
- Revenue generated
- User retention (days retained)
- Churn risk score (0-100)

### 2. Admin Dashboard

Get comprehensive insights:

```typescript
const dashboard = await UserSegmentationService.getAdminDashboard();

// Returns:
{
  metrics: { totalUsers, segmentDistribution, averageConversionRate, ... },
  topPerformingCTAs: [...],
  underperformingSegments: [...],
  recommendedActions: [...],
  activeABTests: [...],
  predictionModels: { churnPrediction: 0.82, lifetimeValuePrediction: 0.76 }
}
```

### 3. Segmentation Metrics

```typescript
const metrics = await UserSegmentationService.getSegmentationMetrics();

// Returns:
{
  totalUsers: 5000,
  segmentDistribution: { new: 1000, active: 2500, ... },
  lifecycleBreakdown: { ... },
  valueBreakdown: { high: 500, medium: 1500, low: 3000 },
  engagementBreakdown: { ... },
  averageConversionRate: 0.25,
  averageChurnRisk: 35,
  topRiskFactors: [...],
  generatedAt: Date
}
```

## Risk Factors

The system automatically identifies and tracks:

| Risk Factor | Threshold | Description |
|------------|-----------|-------------|
| **Low Engagement** | No login 30+ days | User not interacting with platform |
| **High Churn Risk** | No login 60+ days AND < 20 actions | Combination indicates high churn risk |
| **Support Needed** | Login < 3 days AND > 50 actions | Highly active user may need help |
| **Upsell Opportunity** | LTV > $1000 AND < 10 purchases | High-value user ready for premium |

## Implementation Checklist

### Phase 1: Database & Backend
- [ ] Run schema migration: `schema-segmentation.sql`
- [ ] Install dependencies in `transcend-api`
- [ ] Copy `userSegmentation.ts` to services
- [ ] Copy `personalization.ts` to routes
- [ ] Configure environment variables
- [ ] Register API routes in server
- [ ] Run tests: `npm test userSegmentation.test.ts`

### Phase 2: Frontend
- [ ] Install React dependencies
- [ ] Copy `PersonalizedUI.tsx` and `PersonalizedUI.css` to components
- [ ] Import component in pages that need personalization
- [ ] Configure authentication tokens
- [ ] Test all component variants
- [ ] Verify responsive design on mobile

### Phase 3: Integration
- [ ] Connect PersonalizedUI to user dashboard
- [ ] Add segmentation to landing pages
- [ ] Implement CTA tracking analytics
- [ ] Set up A/B testing workflows
- [ ] Create admin dashboard page

### Phase 4: Optimization
- [ ] Monitor segmentation accuracy
- [ ] Analyze CTA performance
- [ ] Run A/B tests
- [ ] Refine segmentation criteria
- [ ] Optimize CTAs based on data

## Testing

### Run Unit Tests

```bash
cd transcend-api
npm test -- userSegmentation.test.ts
```

### Manual Testing

1. **Test Segmentation**
   ```bash
   curl -H "Authorization: Bearer <token>" \
     http://localhost:3000/api/v2/personalization/segment/<user-id>
   ```

2. **Test CTAs**
   ```bash
   curl -H "Authorization: Bearer <token>" \
     http://localhost:3000/api/v2/personalization/ctas/<user-id>
   ```

3. **Test Journey**
   ```bash
   curl -H "Authorization: Bearer <token>" \
     http://localhost:3000/api/v2/personalization/journey/<user-id>
   ```

4. **Test A/B Variant**
   ```bash
   curl -H "Authorization: Bearer <token>" \
     http://localhost:3000/api/v2/personalization/ab-tests/<test-id>/variant/<user-id>
   ```

## Monitoring & Maintenance

### 1. Monitor Segmentation Quality

Track:
- Segment stability (users moving between segments)
- CTA conversion rates by segment
- A/B test results
- Risk factor accuracy

### 2. Database Maintenance

```sql
-- Refresh materialized views daily
REFRESH MATERIALIZED VIEW segment_summary;

-- Calculate metrics
SELECT calculate_segment_metrics();

-- Monitor query performance
EXPLAIN ANALYZE SELECT * FROM user_segments 
WHERE lifecycle = 'at-risk';
```

### 3. Performance Optimization

- Index frequently queried fields
- Archive old CTA interactions (> 1 year)
- Batch update segment performance
- Cache admin dashboard results

## Security Considerations

1. **Authentication**
   - All endpoints require JWT authentication
   - Verify user owns data before returning
   - Admin-only endpoints require role check

2. **Data Privacy**
   - Don't expose raw conversion data to users
   - Aggregate metrics in dashboards
   - Comply with data retention policies

3. **Rate Limiting**
   - Implement rate limits on:
     - Segmentation API: 10 req/min per user
     - A/B test endpoints: 100 req/min per admin
     - Analytics queries: 5 req/min per user

## Troubleshooting

### Issue: Segments not updating

```sql
-- Check last update time
SELECT user_id, last_updated FROM user_segments 
WHERE last_updated < NOW() - INTERVAL '1 day';

-- Manually refresh
SELECT refresh_user_segment('<user-id>'::uuid);
```

### Issue: Low CTA conversion rates

1. Check if CTAs are being shown
2. Verify CTA text is appropriate for segment
3. Run A/B test to optimize copy
4. Check if navigation is working

### Issue: A/B test results not recording

1. Verify CTA interactions are being tracked
2. Check if test status is 'active'
3. Verify variant weights sum to 1.0
4. Check database logs for insert errors

## Future Enhancements

1. **Machine Learning Integration**
   - Predictive churn modeling
   - Lifetime value prediction
   - Segment clustering

2. **Advanced Personalization**
   - Content personalization
   - Email campaign targeting
   - Dynamic pricing

3. **Multi-Channel Support**
   - Email CTA tracking
   - SMS personalization
   - In-app notifications

4. **Advanced Analytics**
   - Cohort analysis
   - Funnel analysis
   - Attribution modeling

## Resources

- Database Schema: `transcend-api/database/schema-segmentation.sql`
- Service Implementation: `transcend-api/services/userSegmentation.ts`
- API Routes: `transcend-api/routes/personalization.ts`
- Frontend Component: `transcend-frontend/src/components/PersonalizedUI.tsx`
- Test Suite: `transcend-api/services/userSegmentation.test.ts`

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review test cases in `userSegmentation.test.ts`
3. Check database logs for errors
4. Review API response status codes

## Version History

- **v1.0.0** (2026-08-15): Initial implementation
  - Multi-dimensional user segmentation
  - Personalized CTAs and journeys
  - A/B testing framework
  - Admin dashboard
  - Performance tracking
  - Frontend React component
