-- Affiliate Program Schema
-- Comprehensive affiliate management system with commission tracking, payouts, and fraud detection

-- ============================================
-- AFFILIATE PROFILES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  company_name VARCHAR(255) NOT NULL,
  unique_code VARCHAR(50) NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'rejected')),
  tier VARCHAR(20) DEFAULT 'basic' CHECK (tier IN ('basic', 'premium', 'elite')),
  commission_rate DECIMAL(5, 2) DEFAULT 10.00,
  tax_id VARCHAR(50),
  payment_method VARCHAR(20) CHECK (payment_method IN ('bank', 'paypal', 'stripe')),
  payment_details JSONB,
  monthly_revenue_cap DECIMAL(10, 2),
  fraud_score INTEGER DEFAULT 0 CHECK (fraud_score >= 0 AND fraud_score <= 100),
  verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'failed')),
  bank_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_status (status),
  INDEX idx_tier (tier),
  INDEX idx_fraud_score (fraud_score),
  INDEX idx_email (email)
);

-- ============================================
-- TRACKING LINKS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS tracking_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  code VARCHAR(100) NOT NULL UNIQUE,
  url TEXT NOT NULL,
  campaign_name VARCHAR(255) NOT NULL,
  click_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_affiliate_id (affiliate_id),
  INDEX idx_code (code),
  INDEX idx_campaign (campaign_name),
  INDEX idx_active (is_active)
);

-- ============================================
-- COMMISSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL CHECK (type IN ('signup', 'revenue-share', 'performance-bonus')),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  service_type VARCHAR(100),
  client_id UUID,
  referral_source VARCHAR(100),
  status VARCHAR(20) DEFAULT 'earned' CHECK (status IN ('earned', 'pending', 'paid', 'disputed')),
  fraud_flags JSONB,
  verification_status VARCHAR(20) DEFAULT 'verified' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  created_at TIMESTAMP DEFAULT NOW(),
  paid_at TIMESTAMP,
  INDEX idx_affiliate_id (affiliate_id),
  INDEX idx_status (status),
  INDEX idx_type (type),
  INDEX idx_created_at (created_at),
  INDEX idx_verification_status (verification_status)
);

-- ============================================
-- PAYOUTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  method VARCHAR(20) NOT NULL CHECK (method IN ('bank', 'paypal', 'stripe')),
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'processing', 'completed', 'failed')),
  transaction_id VARCHAR(255),
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  INDEX idx_affiliate_id (affiliate_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_transaction_id (transaction_id)
);

-- ============================================
-- MARKETING MATERIALS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS marketing_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID REFERENCES affiliates(id) ON DELETE SET NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN ('email', 'banner', 'social', 'landing-page', 'video')),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  preview_url TEXT,
  download_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  performance_metrics JSONB DEFAULT '{"views": 0, "clicks": 0, "conversions": 0}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_affiliate_id (affiliate_id),
  INDEX idx_type (type),
  INDEX idx_active (is_active)
);

-- ============================================
-- CLICK LOGS TABLE (For fraud detection)
-- ============================================

CREATE TABLE IF NOT EXISTS click_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) NOT NULL REFERENCES tracking_links(code),
  client_ip INET NOT NULL,
  user_agent TEXT,
  country VARCHAR(2),
  city VARCHAR(100),
  timestamp TIMESTAMP DEFAULT NOW(),
  INDEX idx_code (code),
  INDEX idx_client_ip (client_ip),
  INDEX idx_timestamp (timestamp)
);

-- ============================================
-- FRAUD INDICATORS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS fraud_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  indicator_type VARCHAR(50) NOT NULL CHECK (indicator_type IN ('duplicate-ip', 'high-velocity', 'suspicious-pattern', 'geographic-mismatch', 'invalid-traffic')),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  description TEXT NOT NULL,
  flagged_at TIMESTAMP DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  INDEX idx_affiliate_id (affiliate_id),
  INDEX idx_severity (severity),
  INDEX idx_resolved (resolved)
);

-- ============================================
-- COMMISSION SUMMARIES TABLE (Materialized view for performance)
-- ============================================

CREATE TABLE IF NOT EXISTS commission_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL UNIQUE REFERENCES affiliates(id) ON DELETE CASCADE,
  total_earned DECIMAL(12, 2) DEFAULT 0,
  total_paid DECIMAL(12, 2) DEFAULT 0,
  total_pending DECIMAL(12, 2) DEFAULT 0,
  total_disputed DECIMAL(12, 2) DEFAULT 0,
  commission_count INTEGER DEFAULT 0,
  avg_commission DECIMAL(10, 2) DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  INDEX idx_affiliate_id (affiliate_id)
);

-- ============================================
-- VIEWS
-- ============================================

-- Affiliate Performance View
CREATE OR REPLACE VIEW affiliate_performance_view AS
SELECT
  a.id,
  a.company_name,
  a.status,
  a.tier,
  a.commission_rate,
  a.fraud_score,
  COUNT(DISTINCT tl.id) as link_count,
  SUM(tl.click_count) as total_clicks,
  SUM(tl.conversion_count) as total_conversions,
  CASE
    WHEN SUM(tl.click_count) > 0
    THEN (SUM(tl.conversion_count)::FLOAT / SUM(tl.click_count)) * 100
    ELSE 0
  END as conversion_rate,
  SUM(CASE WHEN c.status IN ('earned', 'paid') THEN c.amount ELSE 0 END) as total_earned,
  SUM(CASE WHEN c.status = 'paid' THEN c.amount ELSE 0 END) as total_paid,
  SUM(CASE WHEN c.status = 'earned' THEN c.amount ELSE 0 END) as pending_payout,
  COUNT(DISTINCT c.id) as commission_count,
  MAX(c.created_at) as last_activity
FROM affiliates a
LEFT JOIN tracking_links tl ON a.id = tl.affiliate_id
LEFT JOIN commissions c ON a.id = c.affiliate_id
GROUP BY a.id;

-- Top Performing Affiliates View
CREATE OR REPLACE VIEW top_affiliates_view AS
SELECT
  a.id,
  a.company_name,
  a.status,
  a.tier,
  SUM(c.amount) as total_commissions,
  COUNT(DISTINCT c.id) as commission_count,
  SUM(CASE WHEN c.status IN ('earned', 'paid') THEN c.amount ELSE 0 END) as earned_commissions
FROM affiliates a
LEFT JOIN commissions c ON a.id = c.affiliate_id
WHERE a.status = 'active'
GROUP BY a.id
ORDER BY earned_commissions DESC;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_commissions_created_earned ON commissions(created_at, status) WHERE status = 'earned';
CREATE INDEX idx_commissions_created_paid ON commissions(created_at, status) WHERE status = 'paid';
CREATE INDEX idx_affiliates_fraud_active ON affiliates(fraud_score, status) WHERE status = 'active';
CREATE INDEX idx_payouts_pending ON payouts(status) WHERE status IN ('scheduled', 'processing');
CREATE INDEX idx_tracking_links_active ON tracking_links(affiliate_id, is_active) WHERE is_active = TRUE;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update affiliate summary
CREATE OR REPLACE FUNCTION update_affiliate_summary()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO commission_summaries (affiliate_id, total_earned, total_paid, total_pending, commission_count)
  SELECT
    NEW.affiliate_id,
    SUM(CASE WHEN status IN ('earned', 'paid') THEN amount ELSE 0 END),
    SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END),
    SUM(CASE WHEN status = 'earned' THEN amount ELSE 0 END),
    COUNT(*)
  FROM commissions
  WHERE affiliate_id = NEW.affiliate_id
  ON CONFLICT (affiliate_id) DO UPDATE SET
    total_earned = EXCLUDED.total_earned,
    total_paid = EXCLUDED.total_paid,
    total_pending = EXCLUDED.total_pending,
    commission_count = EXCLUDED.commission_count,
    last_updated = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update tracking link stats
CREATE OR REPLACE FUNCTION update_tracking_link_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE tracking_links
  SET conversion_count = (
    SELECT COUNT(*)
    FROM commissions
    WHERE referral_source = NEW.code AND status IN ('earned', 'paid')
  )
  WHERE code = NEW.referral_source;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER trigger_commission_summary
AFTER INSERT OR UPDATE ON commissions
FOR EACH ROW
EXECUTE FUNCTION update_affiliate_summary();

CREATE TRIGGER trigger_tracking_link_stats
AFTER INSERT OR UPDATE ON commissions
FOR EACH ROW
EXECUTE FUNCTION update_tracking_link_stats();

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- Insert sample affiliates
INSERT INTO affiliates (user_id, email, company_name, unique_code, status, tier, commission_rate)
VALUES
  (gen_random_uuid(), 'partner1@example.com', 'Partner One Inc', 'PARTNER001', 'active', 'premium', 15),
  (gen_random_uuid(), 'partner2@example.com', 'Partner Two LLC', 'PARTNER002', 'active', 'basic', 10)
ON CONFLICT DO NOTHING;

-- Insert sample tracking links
INSERT INTO tracking_links (affiliate_id, code, url, campaign_name)
SELECT
  id,
  'aff_' || substring(gen_random_uuid()::text, 1, 12),
  'https://transcend-law.com?aff=' || 'aff_' || substring(gen_random_uuid()::text, 1, 12),
  'Campaign 1'
FROM affiliates
WHERE company_name = 'Partner One Inc'
LIMIT 1
ON CONFLICT DO NOTHING;

-- ============================================
-- END OF SCHEMA
-- ============================================
