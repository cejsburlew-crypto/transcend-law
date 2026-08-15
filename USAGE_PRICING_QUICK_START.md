# Usage-Based Pricing - Quick Start Guide

## Files Created

```
transcend-api/services/usageBasedPricing.ts
├─ Backend service with all core functionality
├─ 600+ lines of TypeScript
└─ Production-ready

transcend-frontend/src/components/UsageMetering.tsx
├─ React component with hooks
├─ Mobile-first responsive UI
├─ 44x44px touch targets
└─ Accessibility compliant

transcend-frontend/src/components/UsageMetering.css
├─ Mobile-first styling
├─ Dark mode support
├─ Print-friendly
└─ 800+ lines of CSS
```

## Feature Checklist

### Backend Service Features

- ✅ **Usage Tracking**
  - Record usage events with metadata
  - Auto-billable month assignment
  - Multiple unit types (cases, transactions, API calls, documents, hours, users)

- ✅ **Pricing Configuration**
  - Configurable unit pricing
  - Volume discount tiers
  - Included units per tier
  - Per-tier overage settings

- ✅ **Cost Calculation**
  - Monthly cost summaries
  - Volume discount application
  - Overage charge calculation
  - Overage capping

- ✅ **Cost Projection**
  - Daily usage rate calculation
  - Projected monthly cost
  - Confidence level determination
  - Remaining days in billing period

- ✅ **Overage Management**
  - Configurable overage policies
  - Auto-scaling capabilities
  - Overage charge percentage
  - Overage cap enforcement

- ✅ **Alert System**
  - Usage threshold alerts (80%, 90%)
  - Overage warnings
  - Cost threshold monitoring
  - Alert dismissal tracking
  - Dismissible alerts with retention

- ✅ **Billing**
  - Monthly billing period creation
  - Invoice generation
  - Invoice status tracking
  - Multi-month reporting

- ✅ **Data Export**
  - JSON export
  - CSV export
  - Usage report generation

### Frontend Component Features

- ✅ **Dashboard Views**
  - Real-time usage visualization
  - Progress bars with percentage
  - Trend indicators
  - Summary statistics

- ✅ **Alert Display**
  - Dismissible alert cards
  - Color-coded by severity (info/warning/critical)
  - Actionable alerts with CTAs
  - Alert count badge

- ✅ **Cost Tracking**
  - Current month costs
  - Projected total costs
  - Base charge vs overage
  - Volume discount display
  - Confidence level indicator

- ✅ **Activity History**
  - Recent activity table
  - Mobile-optimized card view
  - Activity descriptions
  - Cost attribution

- ✅ **User Actions**
  - Export functionality (JSON, CSV, PDF)
  - Data refresh button
  - Upgrade plan CTA
  - Manage billing link
  - Responsive action buttons

- ✅ **Responsive Design**
  - Mobile-first approach
  - 44x44px minimum touch targets
  - Expandable sections on mobile
  - Responsive tables
  - Print-friendly layout

- ✅ **Accessibility**
  - Semantic HTML
  - ARIA labels and roles
  - Keyboard navigation
  - Focus management
  - Color contrast compliance
  - Reduced motion support

## Integration Steps

### 1. Database Setup

```sql
-- Run migrations to create tables
-- See USAGE_BASED_PRICING_GUIDE.md for full schema

psql -U postgres -d transcend_db -f migration_usage_pricing.sql
```

### 2. Backend Integration

```typescript
// In your main application file or middleware
import * as usagePricing from './services/usageBasedPricing';

// Make available throughout app
app.locals.usagePricing = usagePricing;
```

### 3. Record Usage Events

```typescript
// When case is created
import { recordUsage } from '@/services/usageBasedPricing';

app.post('/api/cases', async (req, res) => {
  // ... create case logic ...
  
  await recordUsage(
    customerId,
    tenantId,
    accountId,
    'cases',
    1,
    `Case ${caseId} created`,
    { caseType: req.body.type }
  );
  
  res.json(newCase);
});
```

### 4. Frontend Component Integration

```tsx
// In your billing/dashboard page
import UsageMetering from '@/components/UsageMetering';

export function BillingPage() {
  const { customerId } = useAuth();
  
  return (
    <UsageMetering
      customerId={customerId}
      onUpgrade={() => navigate('/upgrade')}
      onManageBilling={() => navigate('/billing')}
    />
  );
}
```

### 5. Setup API Endpoints

```typescript
// Express route examples

// Record usage
router.post('/api/usage', async (req, res) => {
  const { customerId, unitType, amount, description, metadata } = req.body;
  const record = await recordUsage(
    customerId,
    req.tenant.id,
    req.account.id,
    unitType,
    amount,
    description,
    metadata
  );
  res.json(record);
});

// Get monthly costs
router.get('/api/usage/:customerId/:billingMonth', async (req, res) => {
  const { customerId, billingMonth } = req.params;
  const summary = await calculateMonthlyCost(
    customerId,
    req.tenant.id,
    req.account.id,
    billingMonth
  );
  res.json(summary);
});

// Get cost estimate
router.get('/api/usage/estimate/:customerId', async (req, res) => {
  const { customerId } = req.params;
  const estimate = await estimateMonthlyProjection(
    customerId,
    req.tenant.id,
    req.account.id
  );
  res.json(estimate);
});

// Get alerts
router.get('/api/usage/alerts/:customerId/:billingMonth', async (req, res) => {
  const { customerId, billingMonth } = req.params;
  const alerts = await getActiveCostAlerts(
    customerId,
    req.tenant.id,
    req.account.id,
    billingMonth
  );
  res.json(alerts);
});

// Generate invoice
router.post('/api/usage/invoice/:customerId/:billingMonth', async (req, res) => {
  const { customerId, billingMonth } = req.params;
  const invoice = await generateMonthlyInvoice(
    customerId,
    req.tenant.id,
    req.account.id,
    billingMonth
  );
  res.json(invoice);
});
```

### 6. Setup Cost Alerts

```typescript
// Periodic job to check thresholds (run hourly or on usage record)
async function checkAndCreateAlerts(customerId, tenantId, accountId) {
  const now = new Date();
  const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const alerts = await checkUsageThresholds(
    customerId,
    tenantId,
    accountId,
    billingMonth
  );
  
  // Send notifications
  for (const alert of alerts) {
    if (!alert.notificationSent) {
      await notificationService.send({
        to: customer.email,
        type: 'cost_alert',
        severity: alert.severity,
        message: alert.description
      });
    }
  }
}
```

## API Response Examples

### Record Usage

**Request:**
```json
POST /api/usage
{
  "customerId": "cust_123",
  "unitType": "cases",
  "amount": 1,
  "description": "Case #001 created",
  "metadata": { "caseType": "employment" }
}
```

**Response:**
```json
{
  "id": "usage_abc123",
  "customerId": "cust_123",
  "unitType": "cases",
  "amount": 1,
  "timestamp": "2024-01-15T10:30:00Z",
  "billableMonth": "2024-01"
}
```

### Get Cost Estimate

**Request:**
```
GET /api/usage/estimate/cust_123
```

**Response:**
```json
{
  "id": "estimate_abc123",
  "customerId": "cust_123",
  "currentMonthUsage": 45,
  "projectedMonthlyUsage": 90,
  "baseCost": 1800,
  "projectedOverageCost": 145,
  "projectedTotalCost": 1945,
  "projectedMonthlyRate": 3,
  "daysRemainingInMonth": 17,
  "confidenceLevel": "high"
}
```

### Get Alerts

**Request:**
```
GET /api/usage/alerts/cust_123/2024-01
```

**Response:**
```json
[
  {
    "id": "alert_1",
    "alertType": "usage_threshold",
    "severity": "warning",
    "currentValue": 45,
    "threshold": 50,
    "percentageOfThreshold": 90,
    "description": "Cases usage at 90% of included units",
    "createdAt": "2024-01-15T10:30:00Z"
  }
]
```

## Configuration Reference

### Pricing Tier Configuration

```typescript
const PRICING_TIERS: PricingTier[] = [
  {
    id: 'tier-cases',
    name: 'Cases',
    unitType: 'cases',
    basePrice: 35.00,
    includesUnits: 50,
    volumeDiscounts: [
      { minUnits: 100, discountPercent: 5 },
      { minUnits: 250, discountPercent: 10 },
      { minUnits: 500, discountPercent: 15 }
    ],
    overage: {
      enabled: true,
      chargePercent: 150,
      cap: 500
    }
  },
  {
    id: 'tier-transactions',
    name: 'Transactions',
    unitType: 'transactions',
    basePrice: 2.50,
    includesUnits: 1500,
    volumeDiscounts: [
      { minUnits: 3000, discountPercent: 5 },
      { minUnits: 5000, discountPercent: 10 }
    ],
    overage: {
      enabled: true,
      chargePercent: 125,
      cap: 1000
    }
  }
];
```

### Overage Policy Configuration

```typescript
const OVERAGE_POLICY: OveragePolicy = {
  id: 'policy-standard',
  tenantId: 'tenant_abc',
  accountId: 'account_xyz',
  enabled: true,
  allowOverage: true,
  overagePrice: 50.00,
  maxOveragePerMonth: 2000.00,
  autoScale: true,
  notifyAt: 80
};
```

## Testing

### Test Usage Recording

```typescript
test('should record usage correctly', async () => {
  const record = await recordUsage(
    'cust_123',
    'tenant_abc',
    'account_xyz',
    'cases',
    5,
    'Batch case creation'
  );
  
  expect(record.id).toBeDefined();
  expect(record.amount).toBe(5);
  expect(record.billableMonth).toMatch(/\d{4}-\d{2}/);
});
```

### Test Cost Calculation

```typescript
test('should calculate monthly cost with discounts', async () => {
  const summary = await calculateMonthlyCost(
    'cust_123',
    'tenant_abc',
    'account_xyz',
    '2024-01'
  );
  
  expect(summary.totalCost).toBeGreaterThan(0);
  expect(summary.discountAmount).toBeGreaterThanOrEqual(0);
  expect(summary.baseCost + summary.overageCost - summary.discountAmount)
    .toBeCloseTo(summary.totalCost);
});
```

### Test Alert Generation

```typescript
test('should generate alerts at thresholds', async () => {
  // Record usage at 85%
  await recordUsage('cust_123', 'tenant_abc', 'account_xyz', 'cases', 43);
  
  const alerts = await checkUsageThresholds(
    'cust_123',
    'tenant_abc',
    'account_xyz',
    '2024-01'
  );
  
  expect(alerts.length).toBeGreaterThan(0);
  expect(alerts[0].severity).toBe('warning');
});
```

## Performance Considerations

- **Indexing**: All queries use indexed columns (customer_id, billing_month)
- **Caching**: Monthly summaries are calculated once per month
- **Pagination**: Historical data supports pagination
- **Batch Operations**: Bulk usage recording supported
- **Query Optimization**: Aggregate queries use GROUP BY

## Security Checklist

- ✅ Tenant isolation (all queries filter by tenant_id)
- ✅ Customer isolation (all queries filter by customer_id)
- ✅ Encryption (sensitive data encrypted in database)
- ✅ Audit logging (all actions logged)
- ✅ Rate limiting (API endpoints rate-limited)
- ✅ Input validation (all inputs validated)
- ✅ Access control (endpoint authorization required)

## Troubleshooting

### "Usage not appearing"
1. Check that customer_id, tenant_id, account_id are correct
2. Verify billing month is in YYYY-MM format
3. Check database tables exist
4. Review audit logs for errors

### "Alerts not firing"
1. Verify overage policy is enabled
2. Check notify_at threshold value
3. Confirm pricing tier configuration
4. Review alert thresholds are reasonable

### "Cost calculation incorrect"
1. Verify pricing tier configuration
2. Check volume discount ranges don't overlap
3. Confirm overage cap settings
4. Review usage records in database

### "Component not rendering"
1. Ensure all props are provided
2. Check API endpoints return correct format
3. Verify CSS file is imported
4. Check browser console for errors

## Next Steps

1. **Immediate**: Set up database tables and run migrations
2. **Week 1**: Integrate backend service with usage events
3. **Week 2**: Deploy frontend component to staging
4. **Week 3**: Setup alert notifications and testing
5. **Week 4**: Production deployment with monitoring

## Support

- **Documentation**: See USAGE_BASED_PRICING_GUIDE.md
- **Issues**: Tag issues with `usage-based-pricing`
- **Slack**: #billing-engineering
- **Runbooks**: See ops/ directory

---

**Version**: 1.0
**Last Updated**: 2024-01-15
