-- Escrow Payment System Tables
-- Migration: 001-escrow-tables
-- Created: 2026-08-15
-- Purpose: Add tables for escrow payment holding and management

-- ============================================
-- ESCROW ACCOUNTS TABLE
-- ============================================

CREATE TABLE escrow_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_account_id VARCHAR(255) UNIQUE NOT NULL,
  balance DECIMAL(12, 2) DEFAULT 0.00,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_escrow_accounts_status ON escrow_accounts(status);

-- ============================================
-- ESCROW HOLDS TABLE
-- ============================================

CREATE TABLE escrow_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) DEFAULT 'held' CHECK (status IN ('held', 'released', 'refunded', 'disputed')),
  requires_client_approval BOOLEAN DEFAULT TRUE,
  client_approved_at TIMESTAMP,
  requires_provider_approval BOOLEAN DEFAULT FALSE,
  provider_approved_at TIMESTAMP,
  hold_period_days INT DEFAULT 30,
  hold_until_date TIMESTAMP NOT NULL,
  escrow_fee_amount DECIMAL(12, 2),
  escrow_fee_percentage DECIMAL(5, 2),
  who_pays_fee VARCHAR(20) CHECK (who_pays_fee IN ('client', 'provider', 'platform')),
  payment_intent_id VARCHAR(255) NOT NULL,
  transfer_id VARCHAR(255),
  refund_id VARCHAR(255),
  released_at TIMESTAMP,
  released_by UUID REFERENCES users(id),
  refunded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_escrow_holds_case_id ON escrow_holds(case_id);
CREATE INDEX idx_escrow_holds_client_id ON escrow_holds(client_id);
CREATE INDEX idx_escrow_holds_provider_id ON escrow_holds(provider_id);
CREATE INDEX idx_escrow_holds_status ON escrow_holds(status);
CREATE INDEX idx_escrow_holds_hold_until_date ON escrow_holds(hold_until_date);
CREATE INDEX idx_escrow_holds_payment_intent_id ON escrow_holds(payment_intent_id);

-- ============================================
-- ESCROW DISPUTES TABLE
-- ============================================

CREATE TABLE escrow_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_hold_id UUID NOT NULL REFERENCES escrow_holds(id) ON DELETE CASCADE,
  initiated_by UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  resolution TEXT,
  resolved_at TIMESTAMP,
  resolved_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_escrow_disputes_hold_id ON escrow_disputes(escrow_hold_id);
CREATE INDEX idx_escrow_disputes_initiated_by ON escrow_disputes(initiated_by);
CREATE INDEX idx_escrow_disputes_status ON escrow_disputes(status);

-- ============================================
-- ESCROW AUDIT LOG TABLE
-- ============================================

CREATE TABLE escrow_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_hold_id UUID REFERENCES escrow_holds(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES users(id),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_escrow_audit_log_hold_id ON escrow_audit_log(escrow_hold_id);
CREATE INDEX idx_escrow_audit_log_user_id ON escrow_audit_log(user_id);
CREATE INDEX idx_escrow_audit_log_created_at ON escrow_audit_log(created_at);

-- ============================================
-- ESCROW RECONCILIATIONS TABLE
-- ============================================

CREATE TABLE escrow_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  total_held DECIMAL(12, 2) DEFAULT 0.00,
  total_released DECIMAL(12, 2) DEFAULT 0.00,
  total_refunded DECIMAL(12, 2) DEFAULT 0.00,
  total_disputed DECIMAL(12, 2) DEFAULT 0.00,
  platform_fee_collected DECIMAL(12, 2) DEFAULT 0.00,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'verified')),
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_escrow_reconciliations_date ON escrow_reconciliations(date);
CREATE INDEX idx_escrow_reconciliations_status ON escrow_reconciliations(status);

-- ============================================
-- UPDATE USERS TABLE TO ADD STRIPE ACCOUNT ID
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255);

CREATE INDEX idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX idx_users_stripe_account_id ON users(stripe_account_id);

-- ============================================
-- CREATE PROVIDERS TABLE FOR SERVICE PROVIDERS
-- ============================================

CREATE TABLE IF NOT EXISTS providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  business_name VARCHAR(255),
  business_type VARCHAR(50),
  stripe_account_id VARCHAR(255),
  stripe_bank_account_id VARCHAR(255),
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP,
  rating DECIMAL(3, 2),
  total_services INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_providers_user_id ON providers(user_id);
CREATE INDEX idx_providers_stripe_account_id ON providers(stripe_account_id);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE TRIGGER escrow_accounts_updated_at BEFORE UPDATE ON escrow_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER escrow_holds_updated_at BEFORE UPDATE ON escrow_holds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER escrow_disputes_updated_at BEFORE UPDATE ON escrow_disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER escrow_reconciliations_updated_at BEFORE UPDATE ON escrow_reconciliations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS FOR ESCROW ANALYTICS
-- ============================================

CREATE VIEW escrow_summary AS
SELECT
  COUNT(CASE WHEN status = 'held' THEN 1 END) as held_count,
  COUNT(CASE WHEN status = 'released' THEN 1 END) as released_count,
  COUNT(CASE WHEN status = 'refunded' THEN 1 END) as refunded_count,
  COUNT(CASE WHEN status = 'disputed' THEN 1 END) as disputed_count,
  COALESCE(SUM(CASE WHEN status = 'held' THEN amount ELSE 0 END), 0) as total_held,
  COALESCE(SUM(CASE WHEN status = 'released' THEN amount ELSE 0 END), 0) as total_released,
  COALESCE(SUM(CASE WHEN status = 'refunded' THEN amount ELSE 0 END), 0) as total_refunded,
  COALESCE(SUM(CASE WHEN status = 'disputed' THEN amount ELSE 0 END), 0) as total_disputed,
  COALESCE(SUM(CASE WHEN who_pays_fee = 'platform' THEN escrow_fee_amount ELSE 0 END), 0) as platform_fees
FROM escrow_holds;

CREATE VIEW case_escrow_status AS
SELECT
  c.id as case_id,
  c.client_id,
  eh.id as escrow_hold_id,
  eh.amount,
  eh.status,
  eh.created_at,
  eh.hold_until_date
FROM cases c
LEFT JOIN escrow_holds eh ON c.id = eh.case_id
ORDER BY c.created_at DESC;

CREATE VIEW user_escrow_holds AS
SELECT
  u.id as user_id,
  u.email,
  COUNT(CASE WHEN eh.status = 'held' THEN 1 END) as held_count,
  COUNT(CASE WHEN eh.status = 'released' THEN 1 END) as released_count,
  COUNT(CASE WHEN eh.status = 'disputed' THEN 1 END) as disputed_count,
  COALESCE(SUM(CASE WHEN eh.status = 'held' THEN eh.amount ELSE 0 END), 0) as total_held,
  COALESCE(SUM(CASE WHEN eh.status = 'released' THEN eh.amount ELSE 0 END), 0) as total_released
FROM users u
LEFT JOIN escrow_holds eh ON (u.id = eh.client_id OR u.id = eh.provider_id)
GROUP BY u.id, u.email;
