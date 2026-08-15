# Wait Time Analytics - Implementation Quick Reference

## Files Created

### Backend Services
1. **`/transcend-api/services/waitTimeService.ts`** (615 lines)
   - Core service for all wait time operations
   - 30+ functions for tracking, metrics, alerts, analytics
   - Interfaces for all data types
   - Audit logging integration

2. **`/transcend-api/routes/waitTimeRoutes.ts`** (280 lines)
   - Express router with 15 REST endpoints
   - Request validation and error handling
   - Authentication middleware integration

### Frontend Components
3. **`/transcend-frontend/src/components/WaitTimeDisplay.tsx`** (650 lines)
   - React component with 5 dashboard tabs
   - Real-time updates with configurable refresh
   - Type-safe interfaces for all data structures
   - Responsive design

4. **`/transcend-frontend/src/components/WaitTimeDisplay.css`** (850 lines)
   - Professional styling with dark mode support
   - Responsive grid layouts
   - Alert severity color coding
   - SLA compliance visualization

### Database
5. **`/transcend-api/migrations/create-wait-time-tables.sql`** (400 lines)
   - Two main tables: `wait_time_events`, `wait_time_alerts`
   - 4 materialized views for analytics
   - 3 stored procedures for complex calculations
   - Performance indexes

### Documentation
6. **`/WAIT_TIME_ANALYTICS.md`** (400 lines)
   - Comprehensive system documentation
   - API endpoint reference
   - Integration guide
   - Configuration and troubleshooting

7. **`WAIT_TIME_IMPLEMENTATION_GUIDE.md`** (This file)
   - Quick reference for developers

## Quick Start

### 1. Database Setup
```bash
cd /transcend-api
psql -U user -d transcend_db -f migrations/create-wait-time-tables.sql
```

### 2. Enable API Routes
In your main Express app (`server.ts` or `app.ts`):
```typescript
import waitTimeRoutes from './routes/waitTimeRoutes';
app.use('/api/wait-times', waitTimeRoutes);
```

### 3. Use in Frontend
```typescript
import WaitTimeDisplay from './components/WaitTimeDisplay';

export function Dashboard() {
  return (
    <WaitTimeDisplay
      userType="admin"
      userId={user.id}
      providerId={selectedProvider.id}
    />
  );
}
```

## Key Functions

### Recording Timestamps
```typescript
// When client arrives
const arrival = await recordClientArrival(caseId, clientId, providerId, 'legal_consultation');

// When provider responds
const response = await recordProviderResponse(arrival.id, providerId);

// When service completes
const completion = await recordServiceCompletion(arrival.id, providerId);
```

### Getting Metrics
```typescript
// Provider performance
const metrics = await generateProviderMetrics(providerId, 30);

// Top performers
const topProviders = await getTopProvidersByPerformance(10, 30);

// Satisfaction correlation
const correlation = await correlateWaitTimesWithSatisfaction(30);

// Historical analytics
const analytics = await generateHistoricalAnalytics('2024-08');
```

### Alert Management
```typescript
// Get active alerts
const alerts = await getActiveAlerts(providerId);

// Acknowledge alert
const acknowledged = await acknowledgeAlert(alertId, userId);

// Resolve alert
const resolved = await resolveAlert(alertId);
```

## Component Props

```typescript
interface WaitTimeDisplayProps {
  userType: 'client' | 'provider' | 'admin';
  userId: string;
  caseId?: string;        // Optional: filter by case
  providerId?: string;    // Optional: filter by provider
}
```

## API Endpoints Overview

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/wait-times/client-arrival` | Record client arrival |
| POST | `/api/wait-times/:eventId/provider-response` | Record provider response |
| POST | `/api/wait-times/:eventId/completion` | Record service completion |
| GET | `/api/wait-times/:eventId` | Get current wait time |
| GET | `/api/wait-times/metrics/:providerId` | Get provider metrics |
| GET | `/api/wait-times/average/:providerId` | Get average wait times |
| GET | `/api/wait-times/alerts` | Get active alerts |
| PATCH | `/api/wait-times/alerts/:alertId/acknowledge` | Acknowledge alert |
| PATCH | `/api/wait-times/alerts/:alertId/resolve` | Resolve alert |
| GET | `/api/wait-times/satisfaction-correlation` | Get satisfaction data |
| GET | `/api/wait-times/analytics/:period` | Get historical analytics |

## Default Configuration

```typescript
// In waitTimeService.ts
DEFAULT_RESPONSE_THRESHOLD_SECONDS = 300;        // 5 minutes
DEFAULT_COMPLETION_THRESHOLD_SECONDS = 1800;     // 30 minutes
CRITICAL_WAIT_TIME_SECONDS = 3600;               // 1 hour
ALERT_ESCALATION_TIME_SECONDS = 1800;            // 30 minutes
```

## Database Tables Schema

### wait_time_events
- `id`: Event ID
- `case_id`: Associated case
- `client_id`: Client who is waiting
- `provider_id`: Service provider
- `service_type`: Type of service
- `client_arrival_time`: When client arrived
- `provider_response_time`: When provider responded
- `service_completion_time`: When service completed
- `client_wait_time`: Seconds from arrival to response
- `total_service_time`: Seconds from arrival to completion
- `status`: 'waiting' | 'in_progress' | 'completed' | 'no_show' | 'cancelled'
- `exceeds_response_threshold`: Boolean flag
- `exceeds_completion_threshold`: Boolean flag

### wait_time_alerts
- `id`: Alert ID
- `event_id`: Link to wait time event
- `alert_type`: Type of alert
- `severity`: 'low' | 'medium' | 'high' | 'critical'
- `threshold`: SLA threshold in seconds
- `actual_value`: Actual wait time in seconds
- `status`: 'active' | 'acknowledged' | 'resolved'
- `message`: Alert description

## Performance Tips

1. **Use Indexes**: Queries are optimized with indexes on:
   - `provider_id`, `created_at`
   - `status`, `exceeds_thresholds`
   - Composite indexes for common filter combinations

2. **Caching Strategy**:
   - Real-time data: No cache
   - Metrics: Cache 5 minutes
   - Historical: Cache 1 day
   - Alerts: Cache 1 minute

3. **Query Optimization**:
   - Use `daysBack` parameter to limit time range
   - Pagination for large result sets
   - Pre-calculated views for complex analytics

## Testing

### Unit Test Example
```typescript
describe('waitTimeService', () => {
  it('should calculate client wait time', async () => {
    const event = await recordClientArrival(caseId, clientId, providerId, 'test');
    await new Promise(r => setTimeout(r, 1000));
    const response = await recordProviderResponse(event.id, providerId);
    expect(response.clientWaitTime).toBeGreaterThanOrEqual(1);
  });
});
```

### API Test Example
```typescript
it('POST /api/wait-times/client-arrival', async () => {
  const res = await request(app)
    .post('/api/wait-times/client-arrival')
    .send({
      caseId: 'case_123',
      clientId: 'client_456',
      providerId: 'provider_789',
      serviceType: 'legal_consultation'
    });
  
  expect(res.status).toBe(201);
  expect(res.body).toHaveProperty('id');
});
```

## Troubleshooting Checklist

- [ ] Database tables created with `create-wait-time-tables.sql`
- [ ] Routes mounted in Express app
- [ ] Authentication middleware configured
- [ ] Foreign keys match existing tables (cases, users, providers)
- [ ] Component imported and props passed correctly
- [ ] Refresh interval set appropriately
- [ ] Satisfaction scores being recorded in database
- [ ] Provider IDs match between frontend and backend

## Dependencies

Backend:
- `express`: HTTP server
- `jsonwebtoken`: Authentication
- Database driver (PostgreSQL/MySQL)

Frontend:
- `react`: UI framework
- `typescript`: Type safety
- CSS (included, no external deps)

## Maintenance

### Weekly
- Archive events older than 12 months
- Check alert accuracy

### Monthly
- Recalculate materialized views
- Review provider SLA compliance

### Quarterly
- Adjust thresholds based on trends
- Analyze satisfaction correlation changes

## Support Resources

1. Full documentation: `WAIT_TIME_ANALYTICS.md`
2. Service code: `waitTimeService.ts` (well-commented)
3. Component code: `WaitTimeDisplay.tsx` (well-documented)
4. Migration: `create-wait-time-tables.sql` (with comments)

## Next Steps

1. [ ] Run database migration
2. [ ] Mount API routes
3. [ ] Import frontend component
4. [ ] Call `recordClientArrival` when service starts
5. [ ] Call `recordProviderResponse` when provider acknowledges
6. [ ] Call `recordServiceCompletion` when service ends
7. [ ] Display `WaitTimeDisplay` component in dashboard
8. [ ] Configure refresh intervals
9. [ ] Test real-time updates
10. [ ] Monitor alert generation
