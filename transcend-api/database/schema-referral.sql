-- Referral Program Database Schema
-- Stores referral codes, tracking, rewards, and payout information

-- ============================================
-- Referral Codes Table
-- ============================================
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(8) UNIQUE NOT NULL,
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 100,
  current_uses INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  INDEX idx_code ON referral_codes(code),
  INDEX idx_referrer_id ON referral_codes(referrer_id),
  INDEX idx_is_active ON referral_codes(is_active),
  INDEX idx_expires_at ON referral_codes(expires_at)
);

-- ============================================
-- Referrals Table (tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_code VARCHAR(8) NOT NULL REFERENCES referral_codes(code) ON DELETE CASCADE,
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_email VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired', 'cancelled')),
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  UNIQUE(referrer_id, referred_user_id),
  INDEX idx_referrer_id ON referrals(referrer_id),
  INDEX idx_referred_user_id ON referrals(referred_user_id),
  INDEX idx_status ON referrals(status),
  INDEX idx_referral_code ON referrals(referrer_code),
  INDEX idx_created_at ON referrals(created_at),
  INDEX idx_expires_at ON referrals(expires_at)
);

-- ============================================
-- Referral Rewards Table
-- ============================================
CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_type VARCHAR(50) NOT NULL CHECK (reward_type IN ('credit', 'discount')),
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  paid_at TIMESTAMP WITH TIME ZONE,
  payout_method VARCHAR(50),
  transaction_id VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  INDEX idx_referral_id ON referral_rewards(referral_id),
  INDEX idx_referrer_id ON referral_rewards(referrer_id),
  INDEX idx_status ON referral_rewards(status),
  INDEX idx_reward_type ON referral_rewards(reward_type),
  INDEX idx_created_at ON referral_rewards(created_at)
);

-- ============================================
-- Referral Statistics Cache Table
-- ============================================
CREATE TABLE IF NOT EXISTS referral_stats_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  total_referrals INTEGER NOT NULL DEFAULT 0,
  verified_referrals INTEGER NOT NULL DEFAULT 0,
  total_rewards_earned DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_rewards_paid DECIMAL(10, 2) NOT NULL DEFAULT 0,
  pending_rewards DECIMAL(10, 2) NOT NULL DEFAULT 0,
  last_referral_date TIMESTAMP WITH TIME ZONE,
  cached_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  INDEX idx_referrer_id ON referral_stats_cache(referrer_id),
  INDEX idx_updated_at ON referral_stats_cache(updated_at)
);

-- ============================================
-- Referral Payout History Table
-- ============================================
CREATE TABLE IF NOT EXISTS referral_payout_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  reward_id UUID NOT NULL REFERENCES referral_rewards(id) ON DELETE CASCADE,
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  payout_method VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  stripe_payout_id VARCHAR(255),
  paypal_transaction_id VARCHAR(255),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  INDEX idx_batch_id ON referral_payout_history(batch_id),
  INDEX idx_reward_id ON referral_payout_history(reward_id),
  INDEX idx_referrer_id ON referral_payout_history(referrer_id),
  INDEX idx_status ON referral_payout_history(status),
  INDEX idx_created_at ON referral_payout_history(created_at)
);

-- ============================================
-- Referral Events Table (audit logging)
-- ============================================
CREATE TABLE IF NOT EXISTS referral_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  referral_id UUID REFERENCES referrals(id) ON DELETE SET NULL,
  referrer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reward_id UUID REFERENCES referral_rewards(id) ON DELETE SET NULL,
  event_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  INDEX idx_event_type ON referral_events(event_type),
  INDEX idx_referral_id ON referral_events(referral_id),
  INDEX idx_referrer_id ON referral_events(referrer_id),
  INDEX idx_created_at ON referral_events(created_at)
);

-- ============================================
-- Triggers and Functions
-- ============================================

-- Update referral_codes.updated_at on any change
CREATE OR REPLACE FUNCTION update_referral_codes_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER referral_codes_timestamp_trigger
BEFORE UPDATE ON referral_codes
FOR EACH ROW
EXECUTE FUNCTION update_referral_codes_timestamp();

-- Update referrals.updated_at on any change
CREATE OR REPLACE FUNCTION update_referrals_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER referrals_timestamp_trigger
BEFORE UPDATE ON referrals
FOR EACH ROW
EXECUTE FUNCTION update_referrals_timestamp();

-- Update referral_rewards.updated_at on any change
CREATE OR REPLACE FUNCTION update_referral_rewards_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER referral_rewards_timestamp_trigger
BEFORE UPDATE ON referral_rewards
FOR EACH ROW
EXECUTE FUNCTION update_referral_rewards_timestamp();

-- Log referral events
CREATE OR REPLACE FUNCTION log_referral_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO referral_events (
    event_type,
    referral_id,
    referrer_id,
    reward_id,
    event_data
  ) VALUES (
    TG_ARGV[0],
    NEW.id,
    NEW.referrer_id,
    NULL,
    jsonb_build_object(
      'status', NEW.status,
      'old_status', OLD.status
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER referrals_log_event_trigger
AFTER INSERT OR UPDATE ON referrals
FOR EACH ROW
EXECUTE FUNCTION log_referral_event();

-- ============================================
-- Views for Analytics
-- ============================================

-- View: Active referral codes
CREATE OR REPLACE VIEW active_referral_codes AS
SELECT
  rc.*,
  u.email as referrer_email,
  COUNT(DISTINCT r.id) as total_uses_from_referrals
FROM referral_codes rc
LEFT JOIN users u ON rc.referrer_id = u.id
LEFT JOIN referrals r ON rc.code = r.referrer_code AND r.status = 'verified'
WHERE rc.is_active = true AND rc.expires_at > now()
GROUP BY rc.id, u.id;

-- View: Referral leaderboard
CREATE OR REPLACE VIEW referral_leaderboard AS
SELECT
  r.referrer_id,
  u.email,
  u.name,
  COUNT(DISTINCT r.id) as referral_count,
  COUNT(DISTINCT CASE WHEN r.status = 'verified' THEN r.id END) as verified_count,
  COALESCE(SUM(CASE WHEN reward.reward_type = 'credit' THEN reward.amount ELSE 0 END), 0) as total_earnings,
  MAX(r.created_at) as last_referral_date
FROM referrals r
LEFT JOIN users u ON r.referrer_id = u.id
LEFT JOIN referral_rewards reward ON r.id = reward.referral_id AND reward.reward_type = 'credit'
GROUP BY r.referrer_id, u.id
ORDER BY verified_count DESC, total_earnings DESC;

-- View: Pending payouts
CREATE OR REPLACE VIEW pending_payouts AS
SELECT
  rr.id,
  rr.referral_id,
  rr.referrer_id,
  u.email,
  u.name,
  rr.amount,
  rr.currency,
  rr.status,
  rr.created_at
FROM referral_rewards rr
LEFT JOIN users u ON rr.referrer_id = u.id
WHERE rr.status = 'approved' AND rr.reward_type = 'credit'
ORDER BY rr.created_at ASC;

-- ============================================
-- Sample Queries for Admin Dashboard
-- ============================================

-- Get daily referral metrics
-- SELECT
--   DATE(r.created_at) as date,
--   COUNT(*) as total_referrals,
--   COUNT(CASE WHEN r.status = 'verified' THEN 1 END) as verified_referrals,
--   COUNT(CASE WHEN r.status = 'pending' THEN 1 END) as pending_referrals,
--   COALESCE(SUM(reward.amount), 0) as total_rewards
-- FROM referrals r
-- LEFT JOIN referral_rewards reward ON r.id = reward.referral_id AND reward.reward_type = 'credit'
-- GROUP BY DATE(r.created_at)
-- ORDER BY date DESC;

-- Get monthly payout summary
-- SELECT
--   DATE_TRUNC('month', rh.created_at) as month,
--   COUNT(*) as payout_count,
--   SUM(rh.amount) as total_amount,
--   rh.payout_method
-- FROM referral_payout_history rh
-- WHERE rh.status = 'completed'
-- GROUP BY DATE_TRUNC('month', rh.created_at), rh.payout_method
-- ORDER BY month DESC;
