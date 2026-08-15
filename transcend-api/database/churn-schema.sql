-- Churn Prediction & Win-Back Campaign Schema
-- PostgreSQL schema for churn management system

-- ============================================
-- CHURN PREDICTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS churn_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  churn_probability DECIMAL(5,4) NOT NULL CHECK (churn_probability >= 0 AND churn_probability <= 1),
  risk_segment VARCHAR(20) NOT NULL CHECK (risk_segment IN ('low', 'medium', 'high', 'critical')),
  risk_factors JSONB DEFAULT '[]',
  recommended_actions JSONB DEFAULT '[]',
  retention_score INT DEFAULT 50 CHECK (retention_score >= 0 AND retention_score <= 100),
  value_at_risk DECIMAL(12,2) DEFAULT 0,
  predicted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_churn_predictions_user_id ON churn_predictions(user_id);
CREATE INDEX idx_churn_predictions_risk_segment ON churn_predictions(risk_segment);
CREATE INDEX idx_churn_predictions_churn_probability ON churn_predictions(churn_probability DESC);
CREATE INDEX idx_churn_predictions_predicted_at ON churn_predictions(predicted_at DESC);

-- ============================================
-- WIN-BACK CAMPAIGNS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS win_back_campaigns (
  id VARCHAR(100) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  churn_probability DECIMAL(5,4) NOT NULL,
  risk_segment VARCHAR(20) NOT NULL,
  campaign_status VARCHAR(50) NOT NULL CHECK (
    campaign_status IN (
      'pending',
      'email_sent',
      'offer_accepted',
      'offer_declined',
      'user_retained',
      'churned'
    )
  ),
  campaign_start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  campaign_end_date TIMESTAMP,

  -- Offer Details
  discount_percentage INT DEFAULT 0,
  discount_expiry_days INT DEFAULT 0,
  discount_code VARCHAR(50),
  priority_support_enabled BOOLEAN DEFAULT FALSE,
  priority_support_days INT DEFAULT 30,

  -- Email Campaign
  email_sent_at TIMESTAMP,
  email_opened_at TIMESTAMP,
  email_clicked_at TIMESTAMP,
  email_template_version VARCHAR(20),

  -- Tracking Metrics
  impressions INT DEFAULT 0,
  clicks INT DEFAULT 0,
  conversions INT DEFAULT 0,
  conversion_date TIMESTAMP,

  -- Metadata
  campaign_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_win_back_campaigns_user_id ON win_back_campaigns(user_id);
CREATE INDEX idx_win_back_campaigns_status ON win_back_campaigns(campaign_status);
CREATE INDEX idx_win_back_campaigns_created_at ON win_back_campaigns(created_at DESC);
CREATE INDEX idx_win_back_campaigns_user_status ON win_back_campaigns(user_id, campaign_status);

-- ============================================
-- CHURN EVENTS TRACKING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS churn_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id VARCHAR(100) REFERENCES win_back_campaigns(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL CHECK (
    event_type IN (
      'email_sent',
      'email_opened',
      'email_clicked',
      'offer_accepted',
      'offer_declined',
      'discount_applied',
      'case_submitted',
      'login',
      'support_contacted',
      'user_retained'
    )
  ),
  event_metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_churn_events_user_id ON churn_events(user_id);
CREATE INDEX idx_churn_events_campaign_id ON churn_events(campaign_id);
CREATE INDEX idx_churn_events_event_type ON churn_events(event_type);
CREATE INDEX idx_churn_events_created_at ON churn_events(created_at DESC);

-- ============================================
-- DISCOUNT CODES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id VARCHAR(100) NOT NULL REFERENCES win_back_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL UNIQUE,
  discount_percentage INT NOT NULL,
  discount_type VARCHAR(20) NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  max_uses INT DEFAULT 1,
  times_used INT DEFAULT 0,
  valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_discount_codes_campaign_id ON discount_codes(campaign_id);
CREATE INDEX idx_discount_codes_user_id ON discount_codes(user_id);
CREATE INDEX idx_discount_codes_code ON discount_codes(code);
CREATE INDEX idx_discount_codes_valid_until ON discount_codes(valid_until);

-- ============================================
-- CHURN ANALYTICS VIEW
-- ============================================
CREATE OR REPLACE VIEW churn_analytics_summary AS
SELECT
  NOW() as calculated_at,
  COUNT(DISTINCT cp.user_id) as total_users_analyzed,
  SUM(CASE WHEN cp.churn_probability >= 0.5 THEN 1 ELSE 0 END) as users_at_risk,
  AVG(cp.churn_probability) as average_churn_probability,
  SUM(CASE WHEN cp.risk_segment = 'low' THEN 1 ELSE 0 END) as risk_low,
  SUM(CASE WHEN cp.risk_segment = 'medium' THEN 1 ELSE 0 END) as risk_medium,
  SUM(CASE WHEN cp.risk_segment = 'high' THEN 1 ELSE 0 END) as risk_high,
  SUM(CASE WHEN cp.risk_segment = 'critical' THEN 1 ELSE 0 END) as risk_critical,
  SUM(cp.value_at_risk) as total_value_at_risk,
  COUNT(DISTINCT wbc.id) as total_campaigns,
  SUM(CASE WHEN wbc.campaign_status = 'email_sent' THEN 1 ELSE 0 END) as campaigns_emails_sent,
  SUM(wbc.impressions) as total_impressions,
  SUM(wbc.clicks) as total_clicks,
  SUM(wbc.conversions) as total_conversions,
  SUM(CASE WHEN wbc.campaign_status = 'user_retained' THEN 1 ELSE 0 END) as users_retained
FROM churn_predictions cp
LEFT JOIN win_back_campaigns wbc ON cp.user_id = wbc.user_id;

-- ============================================
-- CAMPAIGN PERFORMANCE VIEW
-- ============================================
CREATE OR REPLACE VIEW campaign_performance_metrics AS
SELECT
  wbc.id as campaign_id,
  wbc.user_id,
  wbc.email,
  wbc.risk_segment,
  wbc.campaign_status,
  wbc.discount_percentage,
  wbc.priority_support_enabled,
  wbc.impressions,
  wbc.clicks,
  wbc.conversions,
  CASE
    WHEN wbc.impressions > 0 THEN (wbc.clicks::float / wbc.impressions::float) * 100
    ELSE 0
  END as click_through_rate,
  CASE
    WHEN wbc.clicks > 0 THEN (wbc.conversions::float / wbc.clicks::float) * 100
    ELSE 0
  END as conversion_rate,
  CASE
    WHEN wbc.email_sent_at IS NOT NULL AND wbc.email_opened_at IS NOT NULL THEN 1
    ELSE 0
  END as email_opened,
  DATEDIFF(
    day,
    wbc.campaign_start_date,
    COALESCE(wbc.campaign_end_date, NOW())
  ) as campaign_duration_days,
  cp.churn_probability as original_churn_probability
FROM win_back_campaigns wbc
LEFT JOIN churn_predictions cp ON wbc.user_id = cp.user_id;

-- ============================================
-- HELPER FUNCTION: Get At-Risk Users
-- ============================================
CREATE OR REPLACE FUNCTION get_at_risk_users(
  p_min_churn_probability DECIMAL DEFAULT 0.5,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  user_id UUID,
  email VARCHAR,
  churn_probability DECIMAL,
  risk_segment VARCHAR,
  risk_factors JSONB,
  recommended_actions JSONB,
  retention_score INT,
  value_at_risk DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cp.user_id,
    cp.email,
    cp.churn_probability,
    cp.risk_segment,
    cp.risk_factors,
    cp.recommended_actions,
    cp.retention_score,
    cp.value_at_risk
  FROM churn_predictions cp
  WHERE cp.churn_probability >= p_min_churn_probability
  AND cp.risk_segment IN ('high', 'critical')
  ORDER BY cp.churn_probability DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- HELPER FUNCTION: Update User Retention Status
-- ============================================
CREATE OR REPLACE FUNCTION update_user_retention_status(
  p_user_id UUID
)
RETURNS VOID AS $$
BEGIN
  -- Reduce churn probability
  UPDATE churn_predictions
  SET
    churn_probability = GREATEST(churn_probability - 0.3, 0),
    retention_score = LEAST(retention_score + 30, 100),
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Mark campaign as retained
  UPDATE win_back_campaigns
  SET
    campaign_status = 'user_retained',
    campaign_end_date = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id
  AND campaign_status IN ('email_sent', 'offer_accepted')
  AND campaign_end_date IS NULL;

  -- Log event
  INSERT INTO churn_events (user_id, event_type, event_metadata)
  VALUES (p_user_id, 'user_retained', jsonb_build_object('retention_update_at', NOW()));
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- HELPER FUNCTION: Create Discount Code
-- ============================================
CREATE OR REPLACE FUNCTION create_discount_code(
  p_campaign_id VARCHAR,
  p_user_id UUID,
  p_discount_percentage INT,
  p_expiry_days INT
)
RETURNS TABLE (
  code VARCHAR,
  discount_percentage INT,
  valid_until TIMESTAMP
) AS $$
DECLARE
  v_code VARCHAR;
  v_valid_until TIMESTAMP;
BEGIN
  v_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8));
  v_valid_until := NOW() + INTERVAL '1 day' * p_expiry_days;

  INSERT INTO discount_codes (
    campaign_id,
    user_id,
    code,
    discount_percentage,
    valid_until
  ) VALUES (p_campaign_id, p_user_id, v_code, p_discount_percentage, v_valid_until);

  RETURN QUERY SELECT v_code::VARCHAR, p_discount_percentage::INT, v_valid_until;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGER: Update Churn Prediction on Case Submission
-- ============================================
CREATE OR REPLACE FUNCTION update_churn_on_case_submission()
RETURNS TRIGGER AS $$
BEGIN
  -- Reduce churn probability on new case
  UPDATE churn_predictions
  SET
    churn_probability = GREATEST(churn_probability - 0.15, 0),
    retention_score = LEAST(retention_score + 15, 100),
    updated_at = NOW()
  WHERE user_id = NEW.client_id;

  -- Log event
  INSERT INTO churn_events (user_id, event_type, event_metadata)
  VALUES (
    NEW.client_id,
    'case_submitted',
    jsonb_build_object('case_id', NEW.id, 'service_type', NEW.service_type)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_case_submission_reduces_churn
AFTER INSERT ON cases
FOR EACH ROW
EXECUTE FUNCTION update_churn_on_case_submission();

-- ============================================
-- TRIGGER: Update Churn Prediction on Login
-- ============================================
CREATE OR REPLACE FUNCTION update_churn_on_login()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_login IS DISTINCT FROM OLD.last_login THEN
    UPDATE churn_predictions
    SET
      churn_probability = GREATEST(churn_probability - 0.05, 0),
      retention_score = LEAST(retention_score + 5, 100),
      updated_at = NOW()
    WHERE user_id = NEW.id;

    INSERT INTO churn_events (user_id, event_type)
    VALUES (NEW.id, 'login');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_login_reduces_churn
AFTER UPDATE ON users
FOR EACH ROW
WHEN (OLD.last_login IS DISTINCT FROM NEW.last_login)
EXECUTE FUNCTION update_churn_on_login();

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_churn_events_created_user ON churn_events(created_at DESC, user_id);
CREATE INDEX idx_discount_codes_active ON discount_codes(is_active, valid_until);
CREATE INDEX idx_win_back_created_status ON win_back_campaigns(created_at DESC, campaign_status);
