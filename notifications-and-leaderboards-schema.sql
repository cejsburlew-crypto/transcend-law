-- TRANSCEND LAW - OPTIONS 6 & 7: NOTIFICATIONS + LEADERBOARDS SCHEMA

BEGIN TRANSACTION;

-- ============================================================================
-- OPTION 6: NOTIFICATIONS SCHEMA
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id SERIAL PRIMARY KEY,
  professional_id INT NOT NULL,
  email_referrals BOOLEAN DEFAULT TRUE,
  email_payments BOOLEAN DEFAULT TRUE,
  email_disputes BOOLEAN DEFAULT TRUE,
  email_compliance BOOLEAN DEFAULT TRUE,
  sms_alerts BOOLEAN DEFAULT FALSE,
  in_app_notifications BOOLEAN DEFAULT TRUE,
  digest_frequency VARCHAR(50) DEFAULT 'DAILY'
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  notification_id VARCHAR(100) UNIQUE NOT NULL,
  professional_id INT NOT NULL,
  type VARCHAR(100),  -- NEW_REFERRAL, PAYMENT, DISPUTE, COMPLIANCE, ACHIEVEMENT
  title VARCHAR(255),
  message TEXT,
  action_url VARCHAR(500),
  status VARCHAR(50) DEFAULT 'UNREAD',  -- UNREAD, READ, ARCHIVED
  read_at TIMESTAMP,
  email_sent BOOLEAN DEFAULT FALSE,
  sms_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_professional (professional_id)
);

CREATE TABLE IF NOT EXISTS email_campaigns (
  id SERIAL PRIMARY KEY,
  campaign_id VARCHAR(100) UNIQUE NOT NULL,
  campaign_type VARCHAR(100),
  recipients_count INT DEFAULT 0,
  sent_count INT DEFAULT 0,
  opened_count INT DEFAULT 0,
  clicked_count INT DEFAULT 0,
  subject TEXT,
  template_id VARCHAR(100),
  status VARCHAR(50) DEFAULT 'DRAFT',
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- OPTION 7: LEADERBOARDS & GAMIFICATION SCHEMA
-- ============================================================================

CREATE TABLE IF NOT EXISTS professional_leaderboard (
  id SERIAL PRIMARY KEY,
  professional_id INT NOT NULL,
  profession_type VARCHAR(100),
  state VARCHAR(2),
  monthly_earnings DECIMAL(15,2) DEFAULT 0,
  ytd_earnings DECIMAL(15,2) DEFAULT 0,
  all_time_earnings DECIMAL(15,2) DEFAULT 0,
  referrals_this_month INT DEFAULT 0,
  referrals_ytd INT DEFAULT 0,
  rank_nationwide INT,
  rank_state INT,
  rank_profession INT,
  period VARCHAR(50) DEFAULT 'MONTHLY',
  updated_at TIMESTAMP,
  INDEX idx_professional (professional_id)
);

CREATE TABLE IF NOT EXISTS professional_achievements (
  id SERIAL PRIMARY KEY,
  professional_id INT NOT NULL,
  achievement_type VARCHAR(100),  -- FIRST_REFERRAL, MILESTONE_EARNINGS, PERFECT_RATING, TOP_EARNER
  achievement_name VARCHAR(255),
  badge_icon VARCHAR(255),
  progress_value INT,
  target_value INT,
  earned_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS professional_xp_system (
  id SERIAL PRIMARY KEY,
  professional_id INT NOT NULL,
  total_xp INT DEFAULT 0,
  level INT DEFAULT 1,
  xp_to_next_level INT,
  weekly_xp INT DEFAULT 0,
  monthly_xp INT DEFAULT 0,
  updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS xp_activities (
  id SERIAL PRIMARY KEY,
  professional_id INT NOT NULL,
  activity_type VARCHAR(100),
  xp_earned INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Views
CREATE OR REPLACE VIEW monthly_earnings_leaderboard AS
SELECT ROW_NUMBER() OVER (ORDER BY monthly_earnings DESC) as rank,
       professional_id, profession_type, state, monthly_earnings
FROM professional_leaderboard
WHERE period = 'MONTHLY'
LIMIT 100;

CREATE OR REPLACE VIEW top_professionals_by_state AS
SELECT state, professional_id, rank_state, monthly_earnings
FROM professional_leaderboard
WHERE rank_state <= 10 AND period = 'MONTHLY'
ORDER BY state, rank_state;

COMMIT;

SELECT 'Notifications & Leaderboards Schema Created Successfully' as status;
