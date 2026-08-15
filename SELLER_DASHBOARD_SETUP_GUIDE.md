# Seller Performance Dashboard - Setup & Implementation Guide

## Quick Start

### 1. Database Migration

Apply the database schema:

```bash
# Navigate to project root
cd /transcend-ssp

# Apply migration
psql -U postgres -d transcend_db -f transcend-api/database/migrations/seller_performance_schema.sql

# Verify tables created
psql -U postgres -d transcend_db -c "\dt seller_* performance_* benchmark_* improvement_* competitor_*"
```

### 2. Install Dependencies

Ensure all required packages are installed:

```bash
npm install stripe  # For payment metrics
npm install pg      # PostgreSQL client (if not already)
```

### 3. Register Routes

Add to your Express server (`transcend-api/server.ts` or main app file):

```typescript
import sellerRoutes from './routes/sellerRoutes';

// Mount seller routes
app.use('/api/seller', sellerRoutes);
```

### 4. Update TypeScript Types

Ensure TypeScript configuration includes the new service:

```typescript
// In tsconfig.json or your type definitions
export * from './services/sellerMetrics';
export * from './routes/sellerRoutes';
```

### 5. Add to Frontend

Import and use the dashboard component:

```typescript
// In your provider dashboard page
import { SellerDashboard } from '../components/SellerDashboard';

export const ProviderDashboardPage: React.FC = () => {
  const { providerId } = useAuth(); // or from params

  return (
    <div className="page-container">
      <SellerDashboard providerId={providerId} />
    </div>
  );
};
```

## Testing

### Unit Tests for Backend Service

Create `transcend-api/services/sellerMetrics.test.ts`:

```typescript
import * as sellerMetrics from './sellerMetrics';
import { query } from '../database/connection';

jest.mock('../database/connection');

describe('Seller Metrics Service', () => {
  const mockMetrics: ProviderMetrics = {
    providerId: 'test-123',
    providerName: 'Test Provider',
    serviceType: 'legal_services',
    ratingScore: 4.5,
    ratingCount: 100,
    defectRate: 2,
    onTimeDeliveryRate: 95,
    cancellationRate: 1,
    responseRatePercent: 98,
    averageResponseTime: 30,
    totalTransactions: 500,
    totalReviewsSubmitted: 100,
    accountAgeDays: 365,
    subscriptionStatus: 'active',
    lastUpdated: new Date(),
  };

  describe('calculatePerformanceScore', () => {
    it('should calculate correct performance score', () => {
      const score = sellerMetrics.calculatePerformanceScore(mockMetrics);
      expect(score).toBeGreaterThan(80);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should handle poor metrics', () => {
      const poorMetrics = {
        ...mockMetrics,
        ratingScore: 2,
        defectRate: 15,
        onTimeDeliveryRate: 50,
      };
      const score = sellerMetrics.calculatePerformanceScore(poorMetrics);
      expect(score).toBeLessThan(50);
    });
  });

  describe('getSellerMetrics', () => {
    it('should fetch seller metrics', async () => {
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [mockMetrics],
      });

      const metrics = await sellerMetrics.getSellerMetrics('test-123');
      expect(metrics).toEqual(mockMetrics);
    });

    it('should return null for non-existent seller', async () => {
      (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const metrics = await sellerMetrics.getSellerMetrics('nonexistent');
      expect(metrics).toBeNull();
    });
  });

  describe('generateImprovementSuggestions', () => {
    it('should generate quality suggestions for high defect rate', async () => {
      const poorQualityMetrics = {
        ...mockMetrics,
        defectRate: 8,
      };

      const suggestions = await sellerMetrics.generateImprovementSuggestions(
        'test-123',
        poorQualityMetrics
      );

      const qualitySuggestions = suggestions.filter(
        (s) => s.category === 'quality'
      );
      expect(qualitySuggestions.length).toBeGreaterThan(0);
    });

    it('should generate delivery suggestions for low on-time rate', async () => {
      const slowDeliveryMetrics = {
        ...mockMetrics,
        onTimeDeliveryRate: 75,
      };

      const suggestions = await sellerMetrics.generateImprovementSuggestions(
        'test-123',
        slowDeliveryMetrics
      );

      const deliverySuggestions = suggestions.filter(
        (s) => s.category === 'speed'
      );
      expect(deliverySuggestions.length).toBeGreaterThan(0);
    });
  });

  describe('getBenchmarkComparison', () => {
    it('should return benchmark data', async () => {
      (query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          rating_score: 4.5,
          avg_rating: 4.0,
          rating_percentile: 75,
          // ... other fields
        }],
      });

      const benchmarks = await sellerMetrics.getBenchmarkComparison(
        'test-123',
        'legal_services'
      );

      expect(benchmarks.length).toBeGreaterThan(0);
      expect(benchmarks[0].metric).toBe('Rating Score');
    });
  });
});
```

Run tests:

```bash
npm test -- sellerMetrics.test.ts
```

### Integration Tests

Create `transcend-api/routes/sellerRoutes.test.ts`:

```typescript
import request from 'supertest';
import app from '../server';

describe('Seller Routes', () => {
  const token = 'valid-jwt-token'; // Get from auth system

  describe('GET /api/seller/dashboard/:providerId', () => {
    it('should return dashboard data for authenticated seller', async () => {
      const response = await request(app)
        .get('/api/seller/dashboard/seller-123')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('metrics');
      expect(response.body).toHaveProperty('performanceScore');
      expect(response.body).toHaveProperty('benchmarks');
      expect(response.body).toHaveProperty('activeAlerts');
    });

    it('should deny access to other sellers data', async () => {
      const response = await request(app)
        .get('/api/seller/dashboard/other-seller')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/seller/dashboard/seller-123')
        .expect(401);
    });
  });

  describe('POST /api/seller/alerts/:alertId/acknowledge', () => {
    it('should acknowledge alert', async () => {
      const response = await request(app)
        .post('/api/seller/alerts/alert-123/acknowledge')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/seller/category-stats', () => {
    it('should return category stats for admin', async () => {
      const response = await request(app)
        .get('/api/seller/category-stats?serviceType=legal_services')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('categoryStats');
      expect(response.body).toHaveProperty('topPerformers');
    });

    it('should deny access to non-admin', async () => {
      const response = await request(app)
        .get('/api/seller/category-stats?serviceType=legal_services')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
});
```

Run integration tests:

```bash
npm test -- sellerRoutes.test.ts
```

### Frontend Component Tests

Create `transcend-frontend/src/components/SellerDashboard.test.tsx`:

```typescript
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SellerDashboard } from './SellerDashboard';

// Mock fetch
global.fetch = jest.fn();

describe('SellerDashboard Component', () => {
  const mockDashboardData = {
    metrics: {
      providerId: 'test-123',
      providerName: 'Test Provider',
      serviceType: 'legal_services',
      ratingScore: 4.5,
      ratingCount: 100,
      defectRate: 2,
      onTimeDeliveryRate: 95,
      cancellationRate: 1,
      responseRatePercent: 98,
      averageResponseTime: 30,
      totalTransactions: 500,
      totalReviewsSubmitted: 100,
      accountAgeDays: 365,
      subscriptionStatus: 'active',
      lastUpdated: new Date().toISOString(),
    },
    benchmarks: [],
    activeAlerts: [],
    historicalTrends: [],
    improvementSuggestions: [],
    performanceScore: 92,
    monthlyTargets: {
      targetRating: 4.8,
      targetDefectRate: 2,
      targetOnTimeRate: 95,
      targetResponseRate: 95,
    },
    comparisonStats: {
      topPerformers: [],
      similarProviders: [],
      categoryRanking: {
        rank: 5,
        totalProviders: 100,
        percentile: 95,
      },
    },
  };

  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('should render dashboard header with provider name', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboardData,
    });

    render(<SellerDashboard providerId="test-123" />);

    await waitFor(() => {
      expect(screen.getByText('Test Provider')).toBeInTheDocument();
    });
  });

  it('should display performance score', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboardData,
    });

    render(<SellerDashboard providerId="test-123" />);

    await waitFor(() => {
      expect(screen.getByText('92')).toBeInTheDocument();
    });
  });

  it('should display metric cards', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboardData,
    });

    render(<SellerDashboard providerId="test-123" />);

    await waitFor(() => {
      expect(screen.getByText('Rating')).toBeInTheDocument();
      expect(screen.getByText('Defect Rate')).toBeInTheDocument();
      expect(screen.getByText('On-Time Delivery')).toBeInTheDocument();
    });
  });

  it('should switch tabs', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboardData,
    });

    render(<SellerDashboard providerId="test-123" />);

    const benchmarksTab = await screen.findByText('Benchmarks');
    fireEvent.click(benchmarksTab);

    await waitFor(() => {
      expect(screen.getByText('Benchmarking Against Category')).toBeInTheDocument();
    });
  });

  it('should display loading state', () => {
    (global.fetch as jest.Mock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => mockDashboardData,
              }),
            1000
          );
        })
    );

    render(<SellerDashboard providerId="test-123" />);

    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
  });

  it('should handle errors gracefully', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
    });

    render(<SellerDashboard providerId="nonexistent" />);

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });
  });
});
```

Run component tests:

```bash
npm test -- SellerDashboard.test.tsx
```

## Sample Data Insertion

Insert test data for development:

```sql
-- Insert test sellers
INSERT INTO sellers (name, service_type, email, rating_score, rating_count, 
                     defect_rate, on_time_delivery_rate, cancellation_rate, 
                     response_rate, total_transactions)
VALUES
  ('Elite Legal Services', 'legal_services', 'elite@example.com', 4.8, 250,
   1.5, 98, 0.5, 99, 1500),
  ('Quick Notary Pro', 'notary_services', 'notary@example.com', 4.3, 180,
   4.2, 85, 3.0, 92, 800),
  ('Budget Attorneys', 'legal_services', 'budget@example.com', 3.9, 120,
   6.5, 78, 5.2, 88, 600);

-- Insert performance alerts
INSERT INTO performance_alerts 
  (provider_id, alert_type, severity, message, metric, current_value, threshold, recommended_action)
SELECT id, 'low_response_rate', 'warning', 'Response rate below target',
       'response_rate', response_rate, 95, 'Implement automated response system'
FROM sellers WHERE response_rate < 95;

-- Insert improvement suggestions
INSERT INTO improvement_suggestions
  (provider_id, category, suggestion, priority, estimated_impact, implementation_difficulty)
SELECT id, 'quality', 'Implement quality assurance checklist before delivery',
       'high', 25, 'easy'
FROM sellers WHERE defect_rate > 5;

-- Insert historical metrics
INSERT INTO seller_metrics_history 
  (provider_id, rating_score, defect_rate, on_time_delivery_rate, 
   cancellation_rate, response_rate, transaction_count)
SELECT id, rating_score, defect_rate, on_time_delivery_rate,
       cancellation_rate, response_rate, total_transactions
FROM sellers;
```

## Environment Configuration

Add to `.env`:

```
# Seller Dashboard
SELLER_ALERT_THRESHOLD_RATING=4.0
SELLER_ALERT_THRESHOLD_DEFECT=5
SELLER_ALERT_THRESHOLD_DELIVERY=85
SELLER_ALERT_THRESHOLD_RESPONSE=85

# Performance targets
PERFORMANCE_TARGET_RATING=4.8
PERFORMANCE_TARGET_DEFECT=2
PERFORMANCE_TARGET_DELIVERY=95
PERFORMANCE_TARGET_RESPONSE=95
```

Load in service:

```typescript
const ALERT_THRESHOLDS = {
  rating: parseFloat(process.env.SELLER_ALERT_THRESHOLD_RATING || '4.0'),
  defect: parseFloat(process.env.SELLER_ALERT_THRESHOLD_DEFECT || '5'),
  delivery: parseFloat(process.env.SELLER_ALERT_THRESHOLD_DELIVERY || '85'),
  response: parseFloat(process.env.SELLER_ALERT_THRESHOLD_RESPONSE || '85'),
};
```

## Deployment Checklist

- [ ] Database migration applied
- [ ] Routes registered in main app
- [ ] Component added to provider dashboard
- [ ] Environment variables configured
- [ ] Tests passing (unit, integration, component)
- [ ] Error handling verified
- [ ] Authentication/authorization tested
- [ ] Performance optimized (< 2s load time)
- [ ] Responsive design verified (mobile, tablet, desktop)
- [ ] Documentation updated
- [ ] Staged deployment tested
- [ ] Production rollout scheduled

## Monitoring

Add to monitoring/logging:

```typescript
// Log dashboard access
logger.info('Seller dashboard accessed', {
  providerId,
  userId: req.user?.id,
  timestamp: new Date(),
});

// Track performance score changes
logger.info('Performance score calculated', {
  providerId,
  score,
  metrics: {
    rating: metrics.ratingScore,
    defectRate: metrics.defectRate,
  },
});

// Alert generation
logger.warn('Performance alert generated', {
  providerId,
  alertType,
  severity,
  message,
});
```

## Troubleshooting Deployment

### Issue: Endpoints returning 404
**Solution**: Verify routes are registered in main server file

### Issue: Database errors
**Solution**: Run migration script, check table names and column names

### Issue: Slow dashboard load
**Solution**: Check query performance, enable caching, reduce trend data

### Issue: Alerts not appearing
**Solution**: Verify performance_alerts table exists, check thresholds

### Issue: Component not rendering
**Solution**: Check console errors, verify TypeScript compilation, check CSS import

## Support & Maintenance

- Monitor alert generation frequency (should be < 5 alerts/day for healthy system)
- Review top improvement suggestions monthly
- Update benchmarks quarterly
- Archive old metrics annually
- Test disaster recovery quarterly

For questions, review the main documentation in `SELLER_PERFORMANCE_DASHBOARD.md`.
