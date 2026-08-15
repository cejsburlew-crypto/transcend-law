# Wait Time Analytics System

## Overview

The Wait Time Analytics System is a comprehensive solution for tracking, monitoring, and analyzing client wait times, provider response times, and service completion times in the Transcend Law Platform. It provides real-time metrics, historical analytics, alert management, and correlation analysis with client satisfaction scores.

## Key Features

### 1. Real-Time Wait Time Tracking
- **Client Arrival Recording**: Capture exact timestamp when clients arrive for service
- **Provider Response Tracking**: Record when provider acknowledges/responds to client
- **Service Completion Recording**: Track when service is completed
- **Live Duration Calculation**: Display current wait times for active services
- **Auto-Refresh**: Real-time updates at configurable intervals (10s, 30s, 1m, 5m)

### 2. Provider Performance Metrics
- **Average Wait Times**: Response time and total service time averages
- **Median Calculations**: 50th percentile for robust center measurement
- **Min/Max Tracking**: Range of wait times
- **SLA Compliance**: Percentage meeting service level agreements
- **Threshold Breach Tracking**: Monitor performance degradation
- **Satisfaction Correlation**: Link wait times to client satisfaction scores

### 3. Alert System
- **Threshold-Based Alerts**: Trigger when wait times exceed SLA
- **Severity Levels**: Low, Medium, High, Critical based on breach magnitude
- **Status Tracking**: Active → Acknowledged → Resolved workflow
- **Alert Acknowledgement**: Staff can mark alerts as reviewed
- **Alert Resolution**: Close resolved incidents for tracking

### 4. Historical Analytics
- **Monthly Aggregation**: Analyze trends over time periods
- **Performance Benchmarking**: Compare providers within periods
- **Top Performers**: Identify fastest response times
- **Slowest Providers**: Flag providers needing improvement
- **Alert Generation Trends**: See if alert frequency is increasing

### 5. Satisfaction Correlation
- **Wait Time Buckets**: Group by 0-5min, 5-15min, 15-30min, 30+min
- **Satisfaction Impact**: Average score by wait time range
- **Negative Response Rate**: Percentage of poor ratings by wait time
- **Actionable Insights**: Identify optimal service speed targets

## Technical Architecture

### Backend Service (`waitTimeService.ts`)

#### Core Functions

**Timestamp Recording**
```typescript
recordClientArrival(caseId, clientId, providerId, serviceType): Promise<WaitTimeEvent>
recordProviderResponse(eventId, providerId): Promise<WaitTimeEvent>
recordServiceCompletion(eventId, providerId): Promise<WaitTimeEvent>
```

**Wait Time Calculations**
```typescript
getCurrentWaitTime(eventId): Promise<number | null>
getProviderAverageWaitTimes(providerId, daysBack): Promise<AverageMetrics>
```

**Provider Metrics**
```typescript
generateProviderMetrics(providerId, daysBack): Promise<ProviderMetrics>
getTopProvidersByPerformance(limit, daysBack): Promise<ProviderMetrics[]>
```

**Analytics**
```typescript
correlateWaitTimesWithSatisfaction(daysBack): Promise<ClientSatisfactionCorrelation[]>
generateHistoricalAnalytics(yearMonth): Promise<HistoricalAnalytics>
```

**Alert Management**
```typescript
getActiveAlerts(providerId?): Promise<WaitTimeAlert[]>
acknowledgeAlert(alertId, acknowledgedBy): Promise<WaitTimeAlert>
resolveAlert(alertId): Promise<WaitTimeAlert>
```

### Frontend Component (`WaitTimeDisplay.tsx`)

#### Tabs

1. **Real-Time Tab**
   - Shows active wait time events
   - Displays current wait times for waiting clients
   - Shows completed service times
   - Color-coded by status (waiting, in_progress, completed, no_show)
   - Highlights threshold breaches with red indicator

2. **Alerts Tab**
   - List of all active alerts
   - Severity badges (Critical, High, Medium, Low)
   - Status tracking (Active, Acknowledged, Resolved)
   - Acknowledge and Resolve actions
   - Comparison of actual vs threshold wait times

3. **Metrics Tab**
   - Provider performance dashboard
   - SLA compliance percentage with visual bar
   - Response time statistics (Avg, Median, Max, Min)
   - Service time statistics
   - Performance indicators
   - Satisfaction score integration

4. **Satisfaction Tab**
   - Wait time vs satisfaction correlation
   - Visual bars showing satisfaction scores by wait range
   - Negative response percentage by wait time
   - Response counts for statistical significance

5. **Historical Tab**
   - Month selector for historical data
   - Period summary metrics
   - Top performing providers
   - Slowest providers
   - Alert generation trends
   - Period-over-period comparison

### Database Schema

#### Tables

**wait_time_events**
- Primary tracking table for all service interactions
- Stores timestamps: arrival, response, completion
- Calculates wait times: client_wait_time, total_service_time
- Tracks SLA threshold breaches
- Supports status tracking (waiting, in_progress, completed, no_show, cancelled)

**wait_time_alerts**
- Alert log for all threshold breaches
- Links to originating event
- Tracks severity (low, medium, high, critical)
- Supports acknowledgement workflow
- Maintains resolution history

**Views**
- `wait_time_statistics`: Provider performance aggregations
- `wait_time_distribution`: Wait time bucket distributions
- `provider_performance_scorecard`: Comprehensive KPI view
- `alert_summary`: Alert trend aggregations

## API Endpoints

### Timestamp Recording

```
POST /api/wait-times/client-arrival
Body: { caseId, clientId, providerId, serviceType }
Returns: WaitTimeEvent

POST /api/wait-times/:eventId/provider-response
Body: { providerId }
Returns: WaitTimeEvent

POST /api/wait-times/:eventId/completion
Body: { providerId }
Returns: WaitTimeEvent
```

### Current Wait Times

```
GET /api/wait-times/current?caseId=X&providerId=Y
Returns: WaitTimeEvent[]

GET /api/wait-times/:eventId
Returns: { eventId, currentWaitTimeSeconds }
```

### Provider Metrics

```
GET /api/wait-times/metrics/:providerId?daysBack=30
Returns: ProviderMetrics

GET /api/wait-times/metrics?limit=10&daysBack=30
Returns: ProviderMetrics[]

GET /api/wait-times/average/:providerId?daysBack=30
Returns: { averageResponseWaitTime, averageTotalServiceTime, ... }
```

### Satisfaction Correlation

```
GET /api/wait-times/satisfaction-correlation?daysBack=30
Returns: ClientSatisfactionCorrelation[]
```

### Alert Management

```
GET /api/wait-times/alerts?providerId=X
Returns: WaitTimeAlert[]

PATCH /api/wait-times/alerts/:alertId/acknowledge
Returns: WaitTimeAlert

PATCH /api/wait-times/alerts/:alertId/resolve
Returns: WaitTimeAlert
```

### Historical Analytics

```
GET /api/wait-times/analytics/:period
Params: period = "YYYY-MM" (e.g., "2024-08")
Returns: HistoricalAnalytics
```

## Integration Guide

### 1. Database Setup

Run the migration to create tables:
```bash
psql transcend_db < transcend-api/migrations/create-wait-time-tables.sql
```

### 2. API Integration

Mount the wait time router in your Express app:
```typescript
import waitTimeRouter from './routes/waitTimeRoutes';

app.use('/api/wait-times', waitTimeRouter);
```

### 3. Frontend Integration

Import and use the component:
```typescript
import { WaitTimeDisplay } from './components/WaitTimeDisplay';

export function MyPage() {
  return (
    <WaitTimeDisplay
      userType="admin"
      userId={currentUser.id}
      providerId={selectedProvider?.id}
    />
  );
}
```

### 4. Recording Events

When a service session starts:
```typescript
const event = await fetch('/api/wait-times/client-arrival', {
  method: 'POST',
  body: JSON.stringify({
    caseId: case.id,
    clientId: client.id,
    providerId: provider.id,
    serviceType: 'legal_consultation'
  })
});

const { id: eventId } = await event.json();
```

When provider responds:
```typescript
await fetch(`/api/wait-times/${eventId}/provider-response`, {
  method: 'POST',
  body: JSON.stringify({ providerId: provider.id })
});
```

When service completes:
```typescript
await fetch(`/api/wait-times/${eventId}/completion`, {
  method: 'POST',
  body: JSON.stringify({ providerId: provider.id })
});
```

## Configuration

### Default SLA Thresholds

```typescript
DEFAULT_RESPONSE_THRESHOLD_SECONDS = 300;      // 5 minutes
DEFAULT_COMPLETION_THRESHOLD_SECONDS = 1800;   // 30 minutes
CRITICAL_WAIT_TIME_SECONDS = 3600;             // 1 hour
ALERT_ESCALATION_TIME_SECONDS = 1800;          // 30 minutes
```

### Customize Thresholds

Update defaults in `waitTimeService.ts` or store provider-specific thresholds in database:

```typescript
// Per-provider configuration example
const providerThresholds = {
  'provider_001': { response: 180, completion: 1200 }, // 3min, 20min
  'provider_002': { response: 600, completion: 3600 }  // 10min, 1hr
};
```

### Alert Severity Mapping

- **Critical**: Wait time > 3x threshold
- **High**: Wait time > 2x threshold
- **Medium**: Wait time > threshold
- **Low**: Wait time < threshold but approaching

## Data Retention

### Recommended Policies

```
- Real-time data: Keep indefinitely
- Event data: 12 months
- Alert data: 12 months
- Historical aggregates: Indefinitely
- Satisfaction correlations: 24 months
```

## Performance Optimization

### Indexes
All critical queries have supporting indexes:
- `idx_provider_id`, `idx_created_at` for time range queries
- `idx_status` for state filtering
- `idx_exceeds_thresholds` for alert queries

### Materialized Views
Use stored procedures for complex calculations:
- `CalculateProviderSLACompliance`: Efficient compliance calculation
- `GetProviderWaitTimePercentiles`: Performance percentile analysis

### Caching Strategy
```typescript
- Provider metrics: Cache 5 minutes
- Historical analytics: Cache 1 day
- Current wait times: Real-time, no cache
- Alerts: Cache 1 minute
```

## Monitoring and Alerts

### Key Metrics to Monitor

1. **System Health**
   - Event recording latency
   - Alert generation time
   - Query performance

2. **Service Quality**
   - SLA compliance percentage
   - Alert frequency trends
   - Provider performance variance

3. **Data Quality**
   - Event completion rates
   - Missing satisfaction correlations
   - Alert accuracy

## Troubleshooting

### No Wait Time Events Showing
- Verify `recordClientArrival` is being called
- Check client, provider, and case IDs exist
- Review database logs for foreign key errors

### Alerts Not Generating
- Verify SLA thresholds are configured
- Check `recordProviderResponse` is being called
- Review alert generation logic in `waitTimeService.ts`

### Satisfaction Correlation Empty
- Ensure service reviews are linked to cases
- Verify satisfaction scores are being recorded
- Check date range filters in queries

### Performance Issues
- Monitor query execution plans
- Verify indexes are created
- Consider archiving old events (>12 months)
- Use pagination for large result sets

## Future Enhancements

1. **Predictive Analytics**
   - Machine learning to predict wait times
   - Demand forecasting

2. **Real-Time Notifications**
   - WebSocket updates for live alerts
   - Email/SMS notifications for threshold breaches

3. **Advanced Reporting**
   - Custom date range reports
   - Provider comparison reports
   - Trend analysis and forecasting

4. **SLA Management**
   - Dynamic threshold adjustment
   - Provider-specific SLA tiers
   - Penalty calculation for breaches

5. **Integration**
   - Calendar integration for scheduling
   - Payment system integration for SLA credits
   - Communication platform alerts

## Support and Maintenance

### Regular Maintenance Tasks
- Archive events older than 12 months weekly
- Recalculate materialized views monthly
- Review and update SLA thresholds quarterly
- Monitor alert accuracy and adjust severity levels

### Escalation Procedures
1. Critical alert (severity = critical): Immediate escalation
2. High alert: Escalate within 15 minutes
3. Medium alert: Review and acknowledge within 1 hour
4. Low alert: Log and review daily

## References

- Backend Service: `/transcend-api/services/waitTimeService.ts`
- Frontend Component: `/transcend-frontend/src/components/WaitTimeDisplay.tsx`
- API Routes: `/transcend-api/routes/waitTimeRoutes.ts`
- Database Migration: `/transcend-api/migrations/create-wait-time-tables.sql`
- Styling: `/transcend-frontend/src/components/WaitTimeDisplay.css`
