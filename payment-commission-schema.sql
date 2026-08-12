-- TRANSCEND LAW - OPTION 1: PAYMENT & COMMISSION SYSTEM SCHEMA

BEGIN TRANSACTION;

-- ============================================================================
-- TRANSACTIONS TABLE - Record every referral/service
-- ============================================================================

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  transaction_id VARCHAR(100) UNIQUE NOT NULL,

  -- Parties
  client_id INT NOT NULL,
  professional_id INT NOT NULL,
  profession_type VARCHAR(100),

  -- Service details
  service_description TEXT,
  service_amount DECIMAL(15,2),
  hours_billed DECIMAL(10,2),
  hourly_rate DECIMAL(10,2),

  -- Commission calculation
  commission_percentage DECIMAL(5,2),  -- 5-20% based on profession
  commission_amount DECIMAL(15,2),
  platform_fee DECIMAL(15,2),  -- 1% of service amount

  -- Status
  status VARCHAR(50) DEFAULT 'COMPLETED',  -- PENDING, COMPLETED, DISPUTED, REFUNDED

  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,

  INDEX idx_professional (professional_id),
  INDEX idx_client (client_id),
  INDEX idx_status (status),
  INDEX idx_created (created_at)
);

-- ============================================================================
-- COMMISSIONS TABLE - Track what professionals are owed
-- ============================================================================

CREATE TABLE IF NOT EXISTS commissions (
  id SERIAL PRIMARY KEY,

  professional_id INT NOT NULL,
  transaction_id INT REFERENCES transactions(id),

  -- Amount
  commission_amount DECIMAL(15,2),

  -- Status workflow
  status VARCHAR(50) DEFAULT 'EARNED',  -- EARNED, PENDING_SETTLEMENT, SETTLED, DISPUTED, REVERSED

  earned_at TIMESTAMP DEFAULT NOW(),
  settled_at TIMESTAMP,

  INDEX idx_professional (professional_id),
  INDEX idx_status (status),
  INDEX idx_earned (earned_at)
);

-- ============================================================================
-- SETTLEMENTS TABLE - Monthly payout records
-- ============================================================================

CREATE TABLE IF NOT EXISTS settlements (
  id SERIAL PRIMARY KEY,
  settlement_id VARCHAR(100) UNIQUE NOT NULL,

  professional_id INT NOT NULL,

  -- Period
  settlement_period VARCHAR(7),  -- YYYY-MM

  -- Aggregated amounts
  total_commissions DECIMAL(15,2),
  total_transactions INT,

  -- Deductions
  disputed_amount DECIMAL(15,2) DEFAULT 0,
  refunded_amount DECIMAL(15,2) DEFAULT 0,

  -- Final
  net_amount DECIMAL(15,2),

  -- Status
  status VARCHAR(50) DEFAULT 'PENDING',  -- PENDING, APPROVED, PAID, DISPUTED
  paid_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_professional (professional_id),
  INDEX idx_period (settlement_period),
  INDEX idx_status (status)
);

-- ============================================================================
-- INVOICES TABLE - Professional invoices with line items
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_id VARCHAR(100) UNIQUE NOT NULL,

  professional_id INT NOT NULL,
  settlement_id INT REFERENCES settlements(id),

  -- Invoice details
  invoice_number VARCHAR(50),
  invoice_date DATE,
  due_date DATE,

  total_amount DECIMAL(15,2),
  tax_amount DECIMAL(15,2),
  final_amount DECIMAL(15,2),

  -- Delivery
  pdf_url VARCHAR(500),
  email_sent BOOLEAN DEFAULT FALSE,

  status VARCHAR(50) DEFAULT 'DRAFT',  -- DRAFT, SENT, VIEWED, PAID

  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_professional (professional_id),
  INDEX idx_invoice (invoice_id)
);

-- ============================================================================
-- PROFESSIONAL BANK ACCOUNTS - Encrypted bank details
-- ============================================================================

CREATE TABLE IF NOT EXISTS professional_bank_accounts (
  id SERIAL PRIMARY KEY,

  professional_id INT NOT NULL UNIQUE,

  -- Bank details (encrypted in production)
  bank_name VARCHAR(255),
  account_holder_name VARCHAR(255),
  account_type VARCHAR(50),  -- CHECKING, SAVINGS

  routing_number_encrypted VARCHAR(500),
  account_number_encrypted VARCHAR(500),

  -- Verification
  verified BOOLEAN DEFAULT FALSE,
  verification_method VARCHAR(50),  -- MICRODEPOSIT, DOCUMENT
  verified_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- COMMISSION DISPUTES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS commission_disputes (
  id SERIAL PRIMARY KEY,
  dispute_id VARCHAR(100) UNIQUE NOT NULL,

  professional_id INT NOT NULL,
  settlement_id INT REFERENCES settlements(id),

  -- Dispute details
  reason TEXT,
  disputed_amount DECIMAL(15,2),
  evidence_url VARCHAR(500),

  -- Status
  status VARCHAR(50) DEFAULT 'FILED',  -- FILED, UNDER_REVIEW, RESOLVED, REJECTED
  resolution TEXT,

  filed_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,

  INDEX idx_professional (professional_id),
  INDEX idx_status (status)
);

-- ============================================================================
-- PAYOUTS TABLE - Audit trail of payments
-- ============================================================================

CREATE TABLE IF NOT EXISTS payouts (
  id SERIAL PRIMARY KEY,
  payout_id VARCHAR(100) UNIQUE NOT NULL,

  professional_id INT NOT NULL,
  settlement_id INT REFERENCES settlements(id),

  -- Amount
  payout_amount DECIMAL(15,2),

  -- Method
  payment_method VARCHAR(50),  -- ACH, WIRE, CHECK

  -- Status
  status VARCHAR(50) DEFAULT 'INITIATED',  -- INITIATED, PENDING, COMPLETED, FAILED

  initiated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,

  processor_reference VARCHAR(100),  -- Stripe/Clove reference

  INDEX idx_professional (professional_id),
  INDEX idx_status (status)
);

-- ============================================================================
-- RECONCILIATION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS reconciliation_records (
  id SERIAL PRIMARY KEY,

  reconciliation_month VARCHAR(7),  -- YYYY-MM

  total_transactions DECIMAL(15,2),
  total_commissions DECIMAL(15,2),
  total_settled DECIMAL(15,2),
  total_disputed DECIMAL(15,2),

  discrepancies INT DEFAULT 0,
  reconciled BOOLEAN DEFAULT FALSE,
  reconciled_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- VIEWS FOR REPORTING
-- ============================================================================

CREATE OR REPLACE VIEW commission_summary_by_professional AS
SELECT
  p.professional_id,
  p.profession_type,
  COUNT(c.id) as total_commissions,
  SUM(c.commission_amount) as total_earned,
  COUNT(CASE WHEN c.status = 'EARNED' THEN 1 END) as pending_commissions,
  SUM(CASE WHEN c.status = 'EARNED' THEN c.commission_amount ELSE 0 END) as pending_amount
FROM commissions c
JOIN professional_profiles p ON c.professional_id = p.id
WHERE c.professional_id = p.professional_id
GROUP BY p.professional_id, p.profession_type;

CREATE OR REPLACE VIEW settlement_summary_by_month AS
SELECT
  settlement_period,
  COUNT(*) as settlements_this_period,
  SUM(net_amount) as total_paid,
  AVG(net_amount) as avg_settlement,
  COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_settlements
FROM settlements
GROUP BY settlement_period
ORDER BY settlement_period DESC;

CREATE OR REPLACE VIEW dispute_summary AS
SELECT
  professional_id,
  COUNT(*) as total_disputes,
  COUNT(CASE WHEN status = 'FILED' THEN 1 END) as open_disputes,
  SUM(disputed_amount) as total_disputed_amount
FROM commission_disputes
GROUP BY professional_id;

CREATE OR REPLACE VIEW revenue_summary AS
SELECT
  DATE(created_at) as revenue_date,
  COUNT(*) as transactions,
  SUM(service_amount) as gross_volume,
  SUM(commission_amount) as commissions_owed,
  SUM(platform_fee) as platform_revenue
FROM transactions
WHERE status = 'COMPLETED'
GROUP BY DATE(created_at)
ORDER BY DATE(created_at) DESC;

COMMIT;

SELECT 'Payment & Commission Schema Created Successfully' as status;
