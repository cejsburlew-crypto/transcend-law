-- Migration: Create Usage-Based Pricing Tables
-- Description: Implements complete usage tracking, cost calculation, and billing system
-- Created: 2024-01-15
-- Version: 1.0

BEGIN;

-- ============================================
-- TABLE: usage_records
-- Purpose: Store individual usage events
-- ============================================

CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  account_id UUID NOT NULL,
  unit_type VARCHAR(50) NOT NULL,
  amount INT NOT NULL CHECK (amount > 0),
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  billable_month VARCHAR(7) NOT NULL, -- YYYY-MM format
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_unit_type CHECK (
    unit_type IN ('cases', 'transactions', 'api_calls', 'documents', 'hours', 'users')
  )
);

CREATE INDEX idx_usage_customer_month ON usage_records(customer_id, billable_month);
CREATE INDEX idx_usage_billing_month ON usage_records(billable_month);
CREATE INDEX idx_usage_tenant_month ON usage_records(tenant_id, billable_month);
CREATE INDEX idx_usage_timestamp ON usage_records(timestamp DESC);

-- ============================================
-- TABLE: pricing_tiers
-- Purpose: Define pricing configuration per tenant
-- ============================================

CREATE TABLE IF NOT EXISTS pricing_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  account_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  unit_type VARCHAR(50) NOT NULL,
  base_price NUMERIC(12, 2) NOT NULL CHECK (base_price > 0),
  includes_units INT DEFAULT 0 CHECK (includes_units >= 0),
  volume_discounts JSONB DEFAULT '[]', -- Array: [{minUnits, maxUnits, discountPercent}]
  overage JSONB DEFAULT '{"enabled":false}', -- {enabled, chargePercent, cap}
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_pricing_unit_type CHECK (
    unit_type IN ('cases', 'transactions', 'api_calls', 'documents', 'hours', 'users')
  ),
  CONSTRAINT unique_tenant_unit_type UNIQUE(tenant_id, account_id, unit_type)
);

CREATE INDEX idx_pricing_tenant ON pricing_tiers(tenant_id, account_id);

-- ============================================
-- TABLE: monthly_usage_summaries
-- Purpose: Pre-calculated monthly billing data
-- ============================================

CREATE TABLE IF NOT EXISTS monthly_usage_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  account_id UUID NOT NULL,
  billing_month VARCHAR(7) NOT NULL, -- YYYY-MM format
  usage_by_type JSONB NOT NULL DEFAULT '{}', -- {unitType: count}
  included_units INT NOT NULL DEFAULT 0,
  used_units INT NOT NULL DEFAULT 0,
  overage_units INT NOT NULL DEFAULT 0,
  overage_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (overage_amount >= 0),
  base_cost NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (base_cost >= 0),
  overage_cost NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (overage_cost >= 0),
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  billed_at TIMESTAMP,
  paid_at TIMESTAMP,
  CONSTRAINT valid_summary_status CHECK (status IN ('draft', 'pending', 'billed', 'paid')),
  CONSTRAINT unique_customer_month UNIQUE(customer_id, tenant_id, account_id, billing_month)
);

CREATE INDEX idx_summary_customer_month ON monthly_usage_summaries(customer_id, billing_month);
CREATE INDEX idx_summary_status ON monthly_usage_summaries(status);
CREATE INDEX idx_summary_tenant_month ON monthly_usage_summaries(tenant_id, billing_month);

-- ============================================
-- TABLE: cost_alerts
-- Purpose: Track usage and cost alerts per customer
-- ============================================

CREATE TABLE IF NOT EXISTS cost_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  account_id UUID NOT NULL,
  alert_type VARCHAR(50) NOT NULL,
  threshold NUMERIC(12, 2) NOT NULL,
  current_value NUMERIC(12, 2) NOT NULL,
  percentage_of_threshold NUMERIC(5, 2) NOT NULL CHECK (percentage_of_threshold > 0),
  billing_month VARCHAR(7), -- YYYY-MM format or NULL for ongoing
  severity VARCHAR(20) NOT NULL,
  notification_sent BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at TIMESTAMP,
  dismissed_at TIMESTAMP,
  description TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_alert_type CHECK (
    alert_type IN ('usage_threshold', 'cost_threshold', 'overage_warning', 'budget_exceeded', 'anomaly')
  ),
  CONSTRAINT valid_severity CHECK (severity IN ('info', 'warning', 'critical'))
);

CREATE INDEX idx_alert_customer ON cost_alerts(customer_id, created_at DESC);
CREATE INDEX idx_alert_active ON cost_alerts(customer_id, dismissed_at) WHERE dismissed_at IS NULL;
CREATE INDEX idx_alert_month ON cost_alerts(billing_month) WHERE billing_month IS NOT NULL;
CREATE INDEX idx_alert_severity ON cost_alerts(severity);

-- ============================================
-- TABLE: billing_periods
-- Purpose: Track billing cycle boundaries
-- ============================================

CREATE TABLE IF NOT EXISTS billing_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  account_id UUID NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  billing_month VARCHAR(7) NOT NULL, -- YYYY-MM format
  invoice_id UUID,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_period_status CHECK (status IN ('active', 'closed', 'invoiced')),
  CONSTRAINT valid_dates CHECK (start_date < end_date),
  CONSTRAINT unique_customer_period UNIQUE(customer_id, tenant_id, account_id, billing_month)
);

CREATE INDEX idx_period_customer ON billing_periods(customer_id, billing_month);
CREATE INDEX idx_period_status ON billing_periods(status);
CREATE INDEX idx_period_dates ON billing_periods(start_date, end_date);

-- ============================================
-- TABLE: overage_policies
-- Purpose: Define overage handling per tenant
-- ============================================

CREATE TABLE IF NOT EXISTS overage_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  account_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  allow_overage BOOLEAN NOT NULL DEFAULT TRUE,
  overage_price NUMERIC(12, 2) NOT NULL CHECK (overage_price > 0),
  max_overage_per_month NUMERIC(12, 2),
  auto_scale BOOLEAN NOT NULL DEFAULT FALSE,
  notify_at INT NOT NULL DEFAULT 80 CHECK (notify_at > 0 AND notify_at < 100),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_tenant_policy UNIQUE(tenant_id, account_id)
);

CREATE INDEX idx_policy_tenant ON overage_policies(tenant_id, account_id);

-- ============================================
-- TABLE: invoices
-- Purpose: Generated invoices for billing
-- ============================================

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  account_id UUID NOT NULL,
  billing_month VARCHAR(7) NOT NULL, -- YYYY-MM format
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'created',
  invoice_number VARCHAR(50), -- External invoice number
  due_date DATE,
  paid_date DATE,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT valid_invoice_status CHECK (
    status IN ('created', 'sent', 'paid', 'overdue', 'cancelled')
  ),
  CONSTRAINT unique_customer_month_invoice UNIQUE(customer_id, tenant_id, account_id, billing_month)
);

CREATE INDEX idx_invoice_customer ON invoices(customer_id, created_at DESC);
CREATE INDEX idx_invoice_status ON invoices(status);
CREATE INDEX idx_invoice_month ON invoices(billing_month);
CREATE INDEX idx_invoice_amount ON invoices(amount);

-- ============================================
-- TABLE: usage_audit_log
-- Purpose: Audit trail for all pricing operations
-- ============================================

CREATE TABLE IF NOT EXISTS usage_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  customer_id UUID,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB DEFAULT '{}',
  user_id UUID,
  ip_address INET,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_tenant ON usage_audit_log(tenant_id, created_at DESC);
CREATE INDEX idx_audit_customer ON usage_audit_log(customer_id, created_at DESC);
CREATE INDEX idx_audit_action ON usage_audit_log(action);
CREATE INDEX idx_audit_entity ON usage_audit_log(entity_type, entity_id);

-- ============================================
-- VIEWS
-- ============================================

-- View: Current month usage summary per customer
CREATE OR REPLACE VIEW v_current_month_usage AS
SELECT
  ur.customer_id,
  ur.tenant_id,
  ur.account_id,
  ur.unit_type,
  SUM(ur.amount) as total_used,
  mus.included_units,
  GREATEST(0, SUM(ur.amount) - mus.included_units) as overage_units,
  ur.billable_month
FROM usage_records ur
LEFT JOIN monthly_usage_summaries mus
  ON ur.customer_id = mus.customer_id
  AND ur.tenant_id = mus.tenant_id
  AND ur.account_id = mus.account_id
  AND ur.billable_month = mus.billing_month
GROUP BY ur.customer_id, ur.tenant_id, ur.account_id, ur.unit_type, ur.billable_month, mus.included_units;

-- View: Active alerts per customer
CREATE OR REPLACE VIEW v_active_alerts AS
SELECT *
FROM cost_alerts
WHERE dismissed_at IS NULL
ORDER BY created_at DESC;

-- View: Monthly revenue report
CREATE OR REPLACE VIEW v_monthly_revenue AS
SELECT
  billing_month,
  tenant_id,
  COUNT(DISTINCT customer_id) as customer_count,
  SUM(total_cost) as total_revenue,
  SUM(base_cost) as base_revenue,
  SUM(overage_cost) as overage_revenue,
  SUM(discount_amount) as total_discounts,
  AVG(total_cost) as avg_customer_spend,
  MAX(total_cost) as max_customer_spend
FROM monthly_usage_summaries
WHERE status = 'billed'
GROUP BY billing_month, tenant_id;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Update timestamp on pricing_tiers
CREATE TRIGGER trigger_pricing_tiers_updated_at
BEFORE UPDATE ON pricing_tiers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Update timestamp on overage_policies
CREATE TRIGGER trigger_overage_policies_updated_at
BEFORE UPDATE ON overage_policies
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Update timestamp on invoices
CREATE TRIGGER trigger_invoices_updated_at
BEFORE UPDATE ON invoices
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Function: Validate usage record
CREATE OR REPLACE FUNCTION validate_usage_record()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure billable_month matches timestamp
  IF TO_CHAR(NEW.timestamp, 'YYYY-MM') != NEW.billable_month THEN
    RAISE EXCEPTION 'billable_month must match timestamp month';
  END IF;

  -- Ensure amount is positive
  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Validate usage records
CREATE TRIGGER trigger_validate_usage_record
BEFORE INSERT OR UPDATE ON usage_records
FOR EACH ROW
EXECUTE FUNCTION validate_usage_record();

-- ============================================
-- PERMISSIONS
-- ============================================

-- Restrict access to usage data
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_usage_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies should be configured based on your auth system
-- Example: Only allow access to own tenant's data

-- ============================================
-- INITIAL DATA
-- ============================================

-- Sample pricing tiers (optional - customize as needed)
INSERT INTO pricing_tiers (
  tenant_id, account_id, name, unit_type, base_price, includes_units, volume_discounts, overage
) VALUES
  (
    'default-tenant', 'default-account', 'Cases',
    'cases', 35.00, 50,
    '[{"minUnits":100,"discountPercent":5},{"minUnits":250,"discountPercent":10},{"minUnits":500,"discountPercent":15}]',
    '{"enabled":true,"chargePercent":150,"cap":500}'
  ),
  (
    'default-tenant', 'default-account', 'Transactions',
    'transactions', 2.50, 1500,
    '[{"minUnits":3000,"discountPercent":5},{"minUnits":5000,"discountPercent":10}]',
    '{"enabled":true,"chargePercent":125,"cap":1000}'
  ),
  (
    'default-tenant', 'default-account', 'API Calls',
    'api_calls', 0.01, 10000,
    '[{"minUnits":50000,"discountPercent":5},{"minUnits":100000,"discountPercent":10}]',
    '{"enabled":true,"chargePercent":150,"cap":100}'
  )
ON CONFLICT DO NOTHING;

-- Sample overage policy
INSERT INTO overage_policies (
  tenant_id, account_id, enabled, allow_overage, overage_price, max_overage_per_month, auto_scale, notify_at
) VALUES
  ('default-tenant', 'default-account', TRUE, TRUE, 50.00, 2000.00, FALSE, 80)
ON CONFLICT DO NOTHING;

-- ============================================
-- COMMIT
-- ============================================

COMMIT;

-- ============================================
-- MIGRATION NOTES
-- ============================================
/*
Migration Completion Checklist:
- [x] Create usage_records table with indexes
- [x] Create pricing_tiers table
- [x] Create monthly_usage_summaries table with indexes
- [x] Create cost_alerts table with indexes
- [x] Create billing_periods table
- [x] Create overage_policies table
- [x] Create invoices table
- [x] Create usage_audit_log table
- [x] Create views for reporting
- [x] Create triggers for timestamp updates
- [x] Create validation functions
- [x] Enable RLS for sensitive tables
- [x] Add sample pricing data

Next Steps:
1. Configure RLS policies based on authentication system
2. Configure notification handlers for alerts
3. Set up scheduled jobs for monthly billing
4. Create backup strategy for billing data
5. Test data access patterns and query performance
6. Monitor index usage and optimize if needed

Performance Considerations:
- All frequently queried columns are indexed
- Composite indexes for common query patterns
- Partial indexes for active records only
- Query optimizer should choose indexes efficiently

Maintenance:
- Monitor index bloat: ANALYZE; REINDEX;
- Archive old usage records monthly
- Vacuum tables regularly: VACUUM ANALYZE usage_records;
- Check index efficiency: EXPLAIN ANALYZE <query>;
*/
