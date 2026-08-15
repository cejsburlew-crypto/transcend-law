# Usage-Based Pricing Implementation Guide

## Overview

This document describes the complete usage-based pricing (consumption model) implementation for the Transcend platform. The system tracks customer usage across multiple metrics, calculates dynamic costs with volume discounts, handles overages, and provides real-time cost estimation with alerts.

## Architecture

### Backend Service: `usageBasedPricing.ts`

Located at: `/transcend-api/services/usageBasedPricing.ts`

#### Core Features

1. **Usage Tracking**
   - Records usage events for multiple unit types (cases, transactions, API calls, documents, hours, users)
   - Automatic monthly billing period assignment
   - Metadata storage for detailed usage context

2. **Pricing Tiers**
   - Configurable unit pricing per service type
   - Volume discount support
   - Included units in base plan
   - Per-tier overage settings

3. **Cost Calculation**
   - Monthly cost summaries with itemized breakdown
   - Volume discount application
   - Overage charge calculation with capping
   - Tax-ready invoice generation

4. **Cost Estimation**
   - Daily usage rate calculation
   - Projected monthly cost with confidence levels
   - Remaining days in billing period tracking

5. **Overage Management**
   - Configurable overage policies per tenant
   - Auto-scaling capabilities
   - Overage cap enforcement
   - Overage charge percentage customization

6. **Alert System**
   - Usage threshold alerts (80%, 90% of included units)
   - Overage warnings
   - Cost threshold monitoring
   - Anomaly detection support
   - Alert dismissal tracking

### Frontend Component: `UsageMetering.tsx`

Located at: `/transcend-frontend/src/components/UsageMetering.tsx`

#### UI Components

1. **Usage Dashboard**
   - Real-time usage visualization
   - Individual metric progress bars
   - Overall usage summary
   - Trend indicators (up/down/stable)

2. **Alert System**
   - Dismissible alert cards
   - Color-coded severity levels
   - Actionable alerts with CTAs
   - Alert count badge

3. **Cost Projection**
   - Current month costs to date
   - Projected total monthly cost
   - Base charge vs overage breakdown
   - Volume discount display
   - Confidence level indicator

4. **Usage History**
   - Responsive data table
   - Recent activity timeline
   - Cost attribution per activity
   - Mobile-optimized card view

5. **Actions**
   - Export data (JSON, CSV, PDF)
   - Refresh usage data
   - Upgrade plan CTA
   - Manage billing link

## Database Schema

### Tables Required

```sql
-- Usage Records
CREATE TABLE usage_records (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  account_id UUID NOT NULL,
  unit_type VARCHAR(50) NOT NULL,
  amount INT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  billable_month VARCHAR(7) NOT NULL, -- YYYY-MM
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL,
  INDEX idx_customer_month (customer_id, billable_month),
  INDEX idx_billing_month (billable_month)
);

-- Pricing Tiers
CREATE TABLE pricing_tiers (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  account_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  unit_type VARCHAR(50) NOT NULL,
  base_price NUMERIC(10, 2) NOT NULL,
  includes_units INT,
  volume_discounts JSONB, -- Array of {minUnits, maxUnits, discountPercent}
  overage JSONB, -- {enabled, chargePercent, cap}
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

-- Monthly Usage Summaries
CREATE TABLE monthly_usage_summaries (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  account_id UUID NOT NULL,
  billing_month VARCHAR(7) NOT NULL,
  usage_by_type JSONB NOT NULL,
  included_units INT,
  used_units INT,
  overage_units INT,
  overage_amount NUMERIC(10, 2),
  base_cost NUMERIC(10, 2),
  overage_cost NUMERIC(10, 2),
  discount_amount NUMERIC(10, 2),
  discount_percent NUMERIC(5, 2),
  total_cost NUMERIC(10, 2),
  status VARCHAR(20), -- draft, pending, billed, paid
  generated_at TIMESTAMP NOT NULL,
  billed_at TIMESTAMP,
  paid_at TIMESTAMP,
  INDEX idx_customer_month (customer_id, billing_month)
);

-- Cost Alerts
CREATE TABLE cost_alerts (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  account_id UUID NOT NULL,
  alert_type VARCHAR(50) NOT NULL,
  threshold NUMERIC(10, 2),
  current_value NUMERIC(10, 2),
  percentage_of_threshold NUMERIC(5, 2),
  billing_month VARCHAR(7),
  severity VARCHAR(20), -- info, warning, critical
  notification_sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP,
  dismissed_at TIMESTAMP,
  description TEXT,
  created_at TIMESTAMP NOT NULL
);

-- Billing Periods
CREATE TABLE billing_periods (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  account_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  billing_month VARCHAR(7),
  invoice_id UUID,
  status VARCHAR(20), -- active, closed, invoiced
  created_at TIMESTAMP NOT NULL
);

-- Overage Policies
CREATE TABLE overage_policies (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  account_id UUID NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  allow_overage BOOLEAN DEFAULT TRUE,
  overage_price NUMERIC(10, 2),
  max_overage_per_month NUMERIC(10, 2),
  auto_scale BOOLEAN DEFAULT FALSE,
  notify_at INT DEFAULT 80, -- Percentage
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  account_id UUID NOT NULL,
  billing_month VARCHAR(7) NOT NULL,
  amount NUMERIC(10, 2),
  status VARCHAR(20), -- created, sent, paid, overdue
  created_at TIMESTAMP NOT NULL
);
```

## API Integration Points

### Backend Endpoints

```typescript
// Usage Recording
POST /api/usage
{
  customerId: string
  unitType: 'cases' | 'transactions' | 'api_calls' | 'documents' | 'hours' | 'users'
  amount: number
  description?: string
  metadata?: Record<string, any>
}

// Get Monthly Usage
GET /api/usage/monthly/:customerId/:billingMonth

// Get Usage Estimate
GET /api/usage/estimate/:customerId

// Get Cost Alerts
GET /api/usage/alerts/:customerId/:billingMonth

// Dismiss Alert
PATCH /api/usage/alerts/:alertId/dismiss

// Generate Invoice
POST /api/usage/invoice/:customerId/:billingMonth

// Export Usage Data
GET /api/usage/export/:customerId/:billingMonth?format=csv|json|pdf

// Get Usage Report
GET /api/usage/report/:customerId?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
```

### Frontend Integration

```typescript
import { UsageMetering } from './components/UsageMetering';

<UsageMetering
  customerId="customer-123"
  onUpgrade={() => navigate('/upgrade')}
  onManageBilling={() => navigate('/billing')}
  readonly={false}
/>
```

## Usage Scenarios

### Scenario 1: Recording Usage

```typescript
import { recordUsage } from '@/services/usageBasedPricing';

// Record a new case creation
await recordUsage(
  'customer-123',
  'tenant-456',
  'account-789',
  'cases',
  1,
  'Case #12345 created',
  { caseType: 'employment', priority: 'high' }
);
```

### Scenario 2: Monthly Cost Calculation

```typescript
import { calculateMonthlyCost } from '@/services/usageBasedPricing';

// Calculate costs for January 2024
const summary = await calculateMonthlyCost(
  'customer-123',
  'tenant-456',
  'account-789',
  '2024-01'
);

console.log({
  baseCost: summary.baseCost,
  overageCost: summary.overageCost,
  totalCost: summary.totalCost,
  usedUnits: summary.usedUnits
});
```

### Scenario 3: Cost Estimation

```typescript
import { estimateMonthlyProjection } from '@/services/usageBasedPricing';

// Get current month projection
const estimate = await estimateMonthlyProjection(
  'customer-123',
  'tenant-456',
  'account-789'
);

console.log({
  currentUsage: estimate.currentMonthUsage,
  projectedTotal: estimate.projectedTotalCost,
  confidence: estimate.confidenceLevel,
  daysRemaining: estimate.daysRemainingInMonth
});
```

### Scenario 4: Alert Management

```typescript
import { checkUsageThresholds, createCostAlert } from '@/services/usageBasedPricing';

// Check all thresholds and create alerts
const alerts = await checkUsageThresholds(
  'customer-123',
  'tenant-456',
  'account-789',
  '2024-01'
);

// Manually create alert
await createCostAlert(
  'customer-123',
  'tenant-456',
  'account-789',
  'cost_threshold',
  5000, // threshold
  4500, // current value
  '2024-01',
  'Approaching monthly budget'
);
```

### Scenario 5: Overage Handling

```typescript
import { handleOverage } from '@/services/usageBasedPricing';

// Handle overage charges
const result = await handleOverage(
  'customer-123',
  'tenant-456',
  'account-789',
  '2024-01'
);

console.log({
  overageCharged: result.overageCharged,
  overageAmount: result.overageAmount,
  autoScaled: result.autoScaled
});
```

## Configuration

### Pricing Tier Example

```typescript
const tier: PricingTier = {
  id: 'tier-1',
  name: 'Cases',
  unitType: 'cases',
  basePrice: 35.00, // $35 per case
  includesUnits: 50, // 50 cases included in base plan
  volumeDiscounts: [
    { minUnits: 100, discountPercent: 5 },
    { minUnits: 250, discountPercent: 10 },
    { minUnits: 500, discountPercent: 15 }
  ],
  overage: {
    enabled: true,
    chargePercent: 150, // 150% of base price
    cap: 500 // Max $500 overage per month
  }
};
```

### Overage Policy Example

```typescript
const policy: OveragePolicy = {
  id: 'policy-1',
  tenantId: 'tenant-456',
  accountId: 'account-789',
  enabled: true,
  allowOverage: true,
  overagePrice: 50.00,
  maxOveragePerMonth: 1000.00,
  autoScale: true, // Auto-upgrade when overage occurs
  notifyAt: 80, // Alert at 80% of included units
  createdAt: new Date(),
  updatedAt: new Date()
};
```

## Design Patterns

### Mobile-First Responsive Design

- **Minimum touch targets**: 44x44px per accessibility guidelines
- **Breakpoints**:
  - Mobile: < 768px
  - Tablet: 768px - 1023px
  - Desktop: ≥ 1024px

- **Responsive Tables**: Converts to card layout on mobile
- **Expandable Sections**: Collapse/expand to save vertical space
- **Touch-Friendly Controls**: Large buttons with adequate spacing

### Data Protection

All sensitive pricing and usage data is:
- Encrypted at rest and in transit
- Access-controlled per tenant
- Logged via audit trail
- Encrypted in database JSONB columns

### Performance

- Usage records indexed by customer and billing month
- Monthly summaries cached
- Lazy-loading of historical data
- Pagination support for large datasets

## Monitoring & Alerting

### Metrics to Track

```
- Total usage per customer per month
- Revenue per usage type
- Overage frequency and amounts
- Alert generation rates
- Plan upgrade triggered by overage
- Usage trend anomalies
```

### Alert Conditions

```
✓ 80%: Warning alert - "Approaching limit"
✓ 90%: Critical alert - "Near limit"
✓ 100%: Overage alert - "Exceeded limit"
✓ Anomaly: Spike detection - "Unusual usage pattern"
✓ Budget: Cost threshold - "Cost approaching limit"
```

## Security Considerations

1. **Access Control**: Only customers can view their own usage
2. **Data Encryption**: All pricing data encrypted in transit and at rest
3. **Audit Logging**: All pricing events logged with tenant context
4. **Rate Limiting**: API endpoints rate-limited per customer
5. **Input Validation**: All usage amounts validated and sanitized

## Testing

### Unit Tests Required

```typescript
describe('Usage Recording', () => {
  test('should record usage with correct billing month');
  test('should handle timezone conversion');
  test('should validate unit types');
});

describe('Cost Calculation', () => {
  test('should apply volume discounts correctly');
  test('should calculate overages accurately');
  test('should cap overage charges');
});

describe('Alerts', () => {
  test('should create alerts at correct thresholds');
  test('should not duplicate alerts');
  test('should dismiss alerts properly');
});
```

### Integration Tests Required

```typescript
describe('End-to-End Pricing', () => {
  test('complete billing cycle from usage to invoice');
  test('overage detection and notification');
  test('auto-scaling trigger on overage');
});
```

## Deployment Checklist

- [ ] Database tables created with indexes
- [ ] Environment variables configured (API keys, thresholds)
- [ ] Usage tracking middleware integrated
- [ ] Alert notification system connected
- [ ] Invoice generation service deployed
- [ ] Frontend component integrated with API
- [ ] Audit logging verified
- [ ] Data encryption enabled
- [ ] Rate limiting configured
- [ ] Monitoring dashboards created
- [ ] Runbooks for common issues
- [ ] Customer documentation updated
- [ ] Support team trained

## Future Enhancements

1. **Advanced Analytics**
   - Usage prediction models
   - Anomaly detection with ML
   - Cost optimization recommendations

2. **Flexible Billing**
   - Custom billing periods
   - Multi-currency support
   - Negotiated pricing per customer

3. **Integration**
   - Webhook notifications
   - Third-party billing systems
   - Advanced reporting APIs

4. **UI Enhancements**
   - Interactive cost calculator
   - Usage breakdown by time
   - Budget simulation tool

## Support & Troubleshooting

### Common Issues

**Q: Usage not showing up?**
A: Check that `recordUsage` is being called with correct tenant/account context. Verify billing month format (YYYY-MM).

**Q: Alerts not firing?**
A: Verify overage policy is enabled. Check threshold configuration. Review audit logs.

**Q: Projection confidence too low?**
A: Confidence increases after 20+ days of usage data. Low confidence in early month is expected.

**Q: Overage not applying?**
A: Confirm overage policy exists and is enabled. Check `allow_overage` setting. Verify cap hasn't been reached.

## Contact & Support

For questions or issues:
- Internal: Post in #billing-support channel
- GitHub Issues: Tag with `usage-based-pricing`
- Email: billing-team@transcend-law.com

---

**Document Version**: 1.0
**Last Updated**: 2024-01-15
**Maintained By**: Billing & Product Team
