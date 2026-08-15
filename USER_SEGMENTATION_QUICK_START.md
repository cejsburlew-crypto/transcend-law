# User Segmentation & Personalized Journeys - Quick Start Guide

## 5-Minute Setup

### Step 1: Database Setup (2 min)

```bash
# Navigate to the API directory
cd transcend-api

# Run the segmentation schema
psql -U transcend_admin -d transcend_law -f database/schema-segmentation.sql

# Verify tables were created
psql -U transcend_admin -d transcend_law -c "\dt" | grep user_segments
```

### Step 2: Backend Setup (2 min)

**In `transcend-api/src/server.ts`:**

```typescript
import personalizationRoutes from './routes/personalization';

// Add this after other route registrations
app.use('/api/v2/personalization', personalizationRoutes);
```

**Restart your server:**
```bash
npm run dev
```

### Step 3: Frontend Setup (1 min)

**In any component where you want personalization:**

```typescript
import PersonalizedUI from './components/PersonalizedUI';

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <PersonalizedUI 
        userId={localStorage.getItem('userId')}
        variant="card"
      />
    </div>
  );
}
```

## Common Use Cases

### Use Case 1: Show Personalized CTA on Dashboard

```typescript
<PersonalizedUI 
  userId={userId}
  variant="card"
  onCTAClick={(cta) => {
    console.log('User clicked:', cta.text);
    // Handle navigation
    window.location.href = `/action/${cta.action}`;
  }}
/>
```

### Use Case 2: Show Banner on Homepage

```typescript
<PersonalizedUI 
  userId={userId}
  variant="banner"
  showAnalytics={false}
/>
```

### Use Case 3: Show Personalized Offer in Modal

```typescript
const [showPersonalization, setShowPersonalization] = useState(false);

return (
  <>
    {showPersonalization && (
      <PersonalizedUI 
        userId={userId}
        variant="modal"
      />
    )}
    <button onClick={() => setShowPersonalization(true)}>
      View Personalized Offer
    </button>
  </>
);
```

### Use Case 4: Inline Segment Badge

```typescript
<div className="user-profile">
  <PersonalizedUI 
    userId={userId}
    variant="inline"
    showAnalytics={false}
  />
  <h2>My Profile</h2>
</div>
```

## API Usage Examples

### Example 1: Get User Segment

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v2/personalization/segment/user-id-here
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "user-id",
    "lifecycle": "active",
    "value": "high",
    "engagement": "high",
    "serviceTypes": ["legal", "consulting"],
    "behaviorPatterns": [...],
    "riskFactors": [...],
    "recommendedCTAs": [...]
  }
}
```

### Example 2: Track CTA Click

```bash
curl -X POST http://localhost:3000/api/v2/personalization/track-cta \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id",
    "ctaId": "cta-id",
    "action": "clicked"
  }'
```

### Example 3: Get Personalized Journey

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v2/personalization/journey/user-id-here
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user-id",
    "journeyStage": "active",
    "recommendedContent": [...],
    "nextSteps": [
      "Upgrade to Pro plan",
      "Complete profile setup",
      "Schedule consultation"
    ],
    "estimatedTimeToConversion": 7,
    "successProbability": 75
  }
}
```

### Example 4: Get Analytics

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v2/personalization/analytics/user-id-here
```

## Admin Dashboard

### Access Admin Dashboard

```bash
curl -H "Authorization: Bearer ADMIN_TOKEN" \
  http://localhost:3000/api/v2/personalization/dashboard
```

### Create A/B Test

```bash
curl -X POST http://localhost:3000/api/v2/personalization/ab-tests \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "testName": "CTA Copy Test",
    "segment": "at-risk",
    "variant1": {
      "cta": {
        "id": "cta-1",
        "action": "retention_offer",
        "text": "Special Offer: 50% Off",
        "priority": "high"
      },
      "weight": 0.5
    },
    "variant2": {
      "cta": {
        "id": "cta-2",
        "action": "retention_offer",
        "text": "Limited Time Discount",
        "priority": "high"
      },
      "weight": 0.5
    },
    "startDate": "2026-08-15T00:00:00Z",
    "status": "active"
  }'
```

## Common Issues & Solutions

### Issue: "Unauthorized" Error

**Solution:** Make sure your auth token is valid and passed in headers:
```typescript
const response = await fetch('/api/v2/personalization/segment/' + userId, {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  }
});
```

### Issue: Component Not Showing

**Solution:** Check that:
1. User ID is valid
2. Database tables are created
3. Backend server is running
4. Authentication token is valid

### Issue: Styles Not Applying

**Solution:** Make sure CSS file is imported:
```typescript
import './PersonalizedUI.css';
```

## Key Files Reference

| File | Purpose |
|------|---------|
| `transcend-api/services/userSegmentation.ts` | Core segmentation logic |
| `transcend-api/routes/personalization.ts` | API endpoints |
| `transcend-api/database/schema-segmentation.sql` | Database schema |
| `transcend-frontend/src/components/PersonalizedUI.tsx` | React component |
| `transcend-frontend/src/components/PersonalizedUI.css` | Styling |
| `USER_SEGMENTATION_IMPLEMENTATION.md` | Full documentation |

## Performance Tips

1. **Cache segment data** (5-minute TTL)
   ```typescript
   const getCachedSegment = async (userId) => {
     const cached = localStorage.getItem(`segment-${userId}`);
     if (cached) return JSON.parse(cached);
     
     const data = await fetch(`/api/v2/personalization/segment/${userId}`);
     localStorage.setItem(`segment-${userId}`, JSON.stringify(data));
     return data;
   };
   ```

2. **Batch CTA tracking**
   ```typescript
   const trackedCTAs = [];
   
   const trackCTA = (cta, action) => {
     trackedCTAs.push({ cta, action });
   };
   
   // Send in batches
   setInterval(() => {
     if (trackedCTAs.length > 0) {
     fetch('/api/v2/personalization/track-batch', {
       method: 'POST',
       body: JSON.stringify({ interactions: trackedCTAs })
     });
     trackedCTAs.length = 0;
     }
   }, 10000);
   ```

3. **Use materialized views for dashboards**
   ```sql
   REFRESH MATERIALIZED VIEW segment_summary;
   SELECT * FROM segment_summary;
   ```

## Next Steps

1. **Segment Your Users** - Run segmentation on existing users
2. **Set Up A/B Tests** - Test CTA variations
3. **Monitor Metrics** - Check admin dashboard daily
4. **Optimize CTAs** - Improve based on performance data
5. **Scale Journey Content** - Add more recommended content

## Testing Checklist

- [ ] Database tables created successfully
- [ ] API endpoints responding
- [ ] PersonalizedUI component renders
- [ ] CTA tracking works
- [ ] Admin dashboard accessible
- [ ] A/B tests can be created
- [ ] Performance metrics displaying

## Rollback Plan

If you need to remove segmentation:

```bash
# Drop segmentation tables
psql -U transcend_admin -d transcend_law -c "
  DROP TABLE IF EXISTS admin_segmentation_dashboards;
  DROP TABLE IF EXISTS segmentation_metrics;
  DROP TABLE IF EXISTS segment_performance;
  DROP TABLE IF EXISTS ab_test_assignments;
  DROP TABLE IF EXISTS ab_tests;
  DROP TABLE IF EXISTS content_recommendations;
  DROP TABLE IF EXISTS personalized_journeys;
  DROP TABLE IF EXISTS cta_interactions;
  DROP TABLE IF EXISTS recommended_ctas;
  DROP TABLE IF EXISTS user_segments;
  DROP MATERIALIZED VIEW IF EXISTS segment_summary;
"
```

## Support Resources

- Full Documentation: `USER_SEGMENTATION_IMPLEMENTATION.md`
- API Tests: `transcend-api/services/userSegmentation.test.ts`
- Component Props: See `PersonalizedUI.tsx` interface definitions
- Database Schema: `schema-segmentation.sql`

## Key Metrics to Monitor

| Metric | Target | Action if Low |
|--------|--------|---------------|
| CTA Conversion Rate | > 25% | A/B test copy |
| Click-Through Rate | > 15% | Improve visibility |
| Journey Completion | > 40% | Simplify next steps |
| New User Activation | > 50% | Improve onboarding |
| Churn Risk Accuracy | > 80% | Refine criteria |

## Deployment Checklist

- [ ] Database schema migrated
- [ ] Environment variables set
- [ ] API routes registered
- [ ] Frontend components imported
- [ ] Tests passing
- [ ] CORS configured
- [ ] Rate limiting enabled
- [ ] Logging configured
- [ ] Monitoring alerts set up

## Questions?

Refer to `USER_SEGMENTATION_IMPLEMENTATION.md` for:
- Detailed architecture
- All endpoint documentation
- Segmentation strategy
- A/B testing workflows
- Troubleshooting guide
