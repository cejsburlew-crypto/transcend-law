# Seller Performance Dashboard Implementation

## Overview

The Seller Performance Dashboard is a comprehensive system for tracking, analyzing, and improving seller/provider performance metrics. It provides real-time insights, benchmarking, alerts, and actionable improvement suggestions.

## Components

### 1. Backend Service: `sellerMetrics.ts`
Location: `/transcend-api/services/sellerMetrics.ts`

Provides core business logic for:
- Metrics calculation and retrieval
- Benchmarking comparisons
- Performance alerts
- Historical trend analysis
- Improvement suggestion generation
- Performance scoring

### 2. Frontend Component: `SellerDashboard.tsx`
Location: `/transcend-frontend/src/components/SellerDashboard.tsx`

React component featuring:
- Real-time metric cards (Rating, Defect Rate, Delivery, Cancellation, Response)
- Performance score visualization
- Interactive alerts with acknowledgment
- Tab-based navigation (Overview, Benchmarks, Trends, Suggestions)
- Top performers display
- Historical trend charts
- Improvement suggestions with prioritization

### 3. API Routes: `sellerRoutes.ts`
Location: `/transcend-api/routes/sellerRoutes.ts`

RESTful endpoints:
- `GET /api/seller/dashboard/:providerId` - Complete dashboard data
- `GET /api/seller/metrics/:providerId` - Current metrics
- `GET /api/seller/benchmarks/:providerId` - Benchmarking data
- `GET /api/seller/alerts/:providerId` - Active alerts
- `POST /api/seller/alerts/:alertId/acknowledge` - Alert acknowledgment
- `GET /api/seller/trends/:providerId` - Historical trends
- `GET /api/seller/suggestions/:providerId` - Improvement suggestions
- `GET /api/seller/ranking/:providerId` - Category ranking
- `GET /api/seller/top-performers` - Top performers by service
- `GET /api/seller/performance-score/:providerId` - Performance score
- `GET /api/seller/category-stats` - Category statistics

### 4. Database Schema: `seller_performance_schema.sql`
Location: `/transcend-api/database/migrations/seller_performance_schema.sql`

Tables:
- `sellers` - Core provider information and current metrics
- `seller_metrics_history` - Historical metrics snapshots
- `performance_alerts` - Performance alerts and notifications
- `improvement_suggestions` - Actionable improvement recommendations
- `benchmark_cache` - Cached benchmark calculations
- `performance_targets` - Monthly performance targets
- `competitor_analysis` - Competitive comparisons
- `performance_badges` - Achievements and badges
- `seller_alert_notifications` - Alert notification tracking

## Key Features

### 1. Real-Time Metrics
Tracks five core performance indicators:
- **Rating Score**: Average customer rating (1-5 stars)
- **Defect Rate**: Percentage of defective/problematic deliveries
- **On-Time Delivery Rate**: Percentage of on-time completions
- **Cancellation Rate**: Percentage of cancelled services
- **Response Rate**: Customer message response percentage

### 2. Performance Scoring
Calculates overall performance score (0-100) based on:
- Rating (40% weight)
- Defect rate (20% weight, inverted)
- On-time delivery (20% weight)
- Cancellation rate (10% weight, inverted)
- Response rate (10% weight)

### 3. Benchmarking System
Compares provider metrics against:
- Category average
- Percentile ranking
- Trend analysis (improving/stable/declining)
- Top performers visualization

### 4. Alert System
Generates alerts for:
- Low rating (< 4.0 stars)
- High defect rate (> 5%)
- Poor delivery (< 85% on-time)
- High cancellation (> 5%)
- Low response rate (< 85%)
- Declining trends

Alert severity levels:
- **Critical**: Immediate action required
- **Warning**: Address within 7 days
- **Info**: For awareness and improvement

### 5. Improvement Suggestions
AI-generated recommendations with:
- Priority levels (high/medium/low)
- Estimated impact percentage
- Implementation difficulty
- Required resources
- Success metrics
- Category-specific improvements:
  - Quality: QA processes, error reduction
  - Speed: Scheduling optimization, resource allocation
  - Reliability: Contingency planning, equipment upgrades
  - Communication: Response systems, SLAs
  - Customer Satisfaction: Training, feedback systems

### 6. Historical Trends
90-day trend analysis showing:
- Rating progression
- Defect rate trends
- Delivery rate changes
- Response rate evolution
- Transaction volume trends

### 7. Category Ranking
Displays:
- Current rank within service category
- Total providers in category
- Percentile ranking
- Comparison against top performers
- Similar providers list

## Usage

### Component Integration

```typescript
import { SellerDashboard } from './components/SellerDashboard';

// Basic usage
<SellerDashboard providerId="seller-123" />

// Compact view
<SellerDashboard 
  providerId="seller-123" 
  compact={true}
/>

// Custom sections
<SellerDashboard 
  providerId="seller-123"
  showAlerts={true}
  showBenchmarks={true}
  showTrends={true}
  showSuggestions={true}
/>

// Current user (from auth context)
<SellerDashboard providerId="current" />
```

### API Usage Examples

```bash
# Get complete dashboard
curl -H "Authorization: Bearer TOKEN" \
  /api/seller/dashboard/seller-123

# Get performance score
curl -H "Authorization: Bearer TOKEN" \
  /api/seller/performance-score/seller-123

# Acknowledge alert
curl -X POST -H "Authorization: Bearer TOKEN" \
  /api/seller/alerts/alert-id/acknowledge

# Get benchmarks
curl -H "Authorization: Bearer TOKEN" \
  /api/seller/benchmarks/seller-123

# Get category stats (admin)
curl -H "Authorization: Bearer TOKEN" \
  "/api/seller/category-stats?serviceType=legal_services"
```

### Service Functions

```typescript
import * as sellerMetrics from '../services/sellerMetrics';

// Get current metrics
const metrics = await sellerMetrics.getSellerMetrics('seller-123');

// Get benchmarking data
const benchmarks = await sellerMetrics.getBenchmarkComparison(
  'seller-123',
  'legal_services'
);

// Get alerts
const alerts = await sellerMetrics.getPerformanceAlerts('seller-123');

// Get trends
const trends = await sellerMetrics.getHistoricalTrends('seller-123');

// Generate suggestions
const suggestions = await sellerMetrics.generateImprovementSuggestions(
  'seller-123',
  metrics
);

// Calculate performance score
const score = sellerMetrics.calculatePerformanceScore(metrics);

// Get complete dashboard
const dashboard = await sellerMetrics.getSellerDashboardData('seller-123');
```

## Database Setup

Run the migration:

```bash
psql -U postgres -d transcend_db \
  -f transcend-api/database/migrations/seller_performance_schema.sql
```

## Security

- **Access Control**: Sellers can only view their own data; admins can view all
- **Token Authentication**: All endpoints require valid JWT token
- **Role-Based Access**: Admin-only endpoints for category stats
- **Data Isolation**: Provider data is isolated per tenant/user

## Performance Optimization

- Benchmark calculations are cached for 1 day
- Historical trends use efficient time-series queries
- Indexed queries on provider_id, service_type, and date ranges
- Aggregated statistics reduce calculation overhead

## Monitoring & Maintenance

### Key Metrics to Monitor
1. Dashboard load time (target < 2s)
2. Alert generation frequency
3. Suggestion completion rate
4. Top performer consistency

### Regular Tasks
- Purge old historical data (> 1 year)
- Recalculate benchmark cache weekly
- Regenerate improvement suggestions monthly
- Archive historical metrics quarterly

### Sample Queries

```sql
-- Get providers below performance targets
SELECT id, name, rating_score, on_time_delivery_rate
FROM sellers
WHERE service_type = 'legal_services'
AND (rating_score < 4.0 OR on_time_delivery_rate < 85)
ORDER BY rating_score ASC;

-- Get trending improvements
SELECT provider_id, category, COUNT(*) as suggestion_count
FROM improvement_suggestions
WHERE completed = TRUE
AND resolved_at > NOW() - INTERVAL '30 days'
GROUP BY provider_id, category
ORDER BY suggestion_count DESC;

-- Get top performers this month
SELECT id, name, rating_score, on_time_delivery_rate
FROM sellers
WHERE service_type = 'legal_services'
AND created_at > NOW() - INTERVAL '30 days'
ORDER BY rating_score DESC, on_time_delivery_rate DESC
LIMIT 10;
```

## Customization

### Modifying Alert Thresholds
Edit `generateImprovementSuggestions()` function:

```typescript
if (metrics.defectRate > 5) { // Change threshold
  suggestions.push({
    // ...
    priority: metrics.defectRate > 10 ? 'high' : 'medium',
  });
}
```

### Adjusting Performance Score Weights
Edit `calculatePerformanceScore()` function:

```typescript
score += (metrics.ratingScore / 5) * 40; // Increase weight to 50
```

### Custom Suggestion Categories
Add to `ImprovementSuggestion` category union and database constraints.

## Future Enhancements

1. **ML-Based Predictions**: Predict future performance trends
2. **Peer Learning**: Share best practices between similar providers
3. **Automated Interventions**: Trigger actions for critical alerts
4. **Video Tutorials**: Link suggestions to how-to content
5. **Incentive Programs**: Reward top performers
6. **Custom Dashboards**: Per-provider personalization
7. **Export Reports**: PDF/Excel reports for stakeholders
8. **Real-Time Collaboration**: Team-based performance tracking
9. **A/B Testing**: Test improvement suggestions
10. **Integration with Payment Systems**: Link performance to payouts

## Troubleshooting

### No data showing
- Verify seller exists in database
- Check authentication token validity
- Ensure user has access to view seller data

### Performance slow
- Check database query performance
- Clear benchmark cache
- Review active alerts count
- Check historical trends data volume

### Alerts not showing
- Verify alerts were created
- Check acknowledge filters
- Ensure alert creation timestamps are recent

## Support

For issues or questions:
1. Review API response status and error messages
2. Check browser console for JavaScript errors
3. Review database query logs
4. Verify all tables are created via migration
5. Check user permissions and authentication

## References

- [Backend Service Documentation](./transcend-api/services/sellerMetrics.ts)
- [Frontend Component Documentation](./transcend-frontend/src/components/SellerDashboard.tsx)
- [API Routes Documentation](./transcend-api/routes/sellerRoutes.ts)
- [Database Schema](./transcend-api/database/migrations/seller_performance_schema.sql)
