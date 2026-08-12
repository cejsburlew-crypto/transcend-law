-- TRANSCEND LAW - OPTION 4: DISPUTE & RESOLUTION SCHEMA

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS disputes (
  id SERIAL PRIMARY KEY,
  dispute_id VARCHAR(100) UNIQUE NOT NULL,
  transaction_id INT,

  -- Parties
  complainant_id INT,
  complainant_type VARCHAR(50),  -- CLIENT, PROFESSIONAL, ADMIN
  respondent_id INT,
  respondent_type VARCHAR(50),

  -- Issue
  issue_category VARCHAR(100),
  issue_description TEXT,
  severity_level VARCHAR(50),  -- LOW, MEDIUM, HIGH, CRITICAL

  -- Evidence
  evidence_urls JSONB,
  evidence_count INT DEFAULT 0,

  -- Status
  status VARCHAR(50) DEFAULT 'OPEN',  -- OPEN, UNDER_REVIEW, AWAITING_RESOLUTION, RESOLUTION_PROPOSED, RESOLVED, ESCALATED
  resolution_type VARCHAR(50),
  refund_amount DECIMAL(15,2),
  resolution_notes TEXT,

  -- Timeline
  filed_at TIMESTAMP DEFAULT NOW(),
  first_response_at TIMESTAMP,
  resolved_at TIMESTAMP,
  days_to_resolve INT,

  INDEX idx_status (status),
  INDEX idx_respondent (respondent_id),
  INDEX idx_filed (filed_at)
);

CREATE TABLE IF NOT EXISTS referral_quality_ratings (
  id SERIAL PRIMARY KEY,
  transaction_id INT,
  rater_id INT,
  rater_type VARCHAR(50),
  professional_id INT,

  -- Scores 1-5
  quality_score INT,
  timeliness_score INT,
  professionalism_score INT,
  result_quality_score INT,

  review_text TEXT,
  status VARCHAR(50) DEFAULT 'SUBMITTED',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dispute_escalations (
  id SERIAL PRIMARY KEY,
  dispute_id INT REFERENCES disputes(id),
  escalation_level VARCHAR(50),  -- LEVEL_1, LEVEL_2, LEVEL_3, LEGAL
  escalation_reason TEXT,
  status VARCHAR(50) DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dispute_responses (
  id SERIAL PRIMARY KEY,
  dispute_id INT REFERENCES disputes(id),
  respondent_id INT,
  response_text TEXT,
  response_evidence JSONB,
  status VARCHAR(50) DEFAULT 'SUBMITTED',
  submitted_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS professional_accountability (
  id SERIAL PRIMARY KEY,
  professional_id INT NOT NULL,
  profession_type VARCHAR(100),

  -- Dispute stats
  total_referrals INT DEFAULT 0,
  total_disputes INT DEFAULT 0,
  dispute_rate DECIMAL(5,2),

  -- Risk level
  risk_level VARCHAR(50),  -- LOW, MEDIUM, HIGH, CRITICAL
  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_professional (professional_id)
);

CREATE TABLE IF NOT EXISTS performance_alerts (
  id SERIAL PRIMARY KEY,
  professional_id INT,
  profession_type VARCHAR(100),

  -- Alert type
  alert_type VARCHAR(100),  -- HIGH_DISPUTE_RATE, MULTIPLE_POOR_REVIEWS, LATE_DELIVERY, etc.
  severity VARCHAR(50),  -- INFO, WARNING, CRITICAL
  description TEXT,

  metric_value DECIMAL(10,2),
  action_required VARCHAR(100),
  status VARCHAR(50) DEFAULT 'ACTIVE',

  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_professional (professional_id)
);

CREATE TABLE IF NOT EXISTS refunds (
  id SERIAL PRIMARY KEY,
  refund_id VARCHAR(100) UNIQUE NOT NULL,
  dispute_id INT REFERENCES disputes(id),
  transaction_id INT,

  original_amount DECIMAL(15,2),
  refund_amount DECIMAL(15,2),
  reason VARCHAR(100),
  status VARCHAR(50) DEFAULT 'PENDING',

  processor_reference VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dispute_resolution_rules (
  id SERIAL PRIMARY KEY,
  profession_type VARCHAR(100),

  -- Thresholds
  dispute_rate_threshold DECIMAL(5,2),  -- percent
  warning_level_disputes INT,
  suspension_trigger_disputes INT,

  auto_refund_low_rating BOOLEAN DEFAULT FALSE,
  auto_refund_threshold DECIMAL(5,2),

  INDEX idx_profession (profession_type)
);

-- Views
CREATE OR REPLACE VIEW dispute_summary_by_profession AS
SELECT
  profession_type,
  COUNT(*) as total_disputes,
  COUNT(CASE WHEN status = 'RESOLVED' THEN 1 END) as resolved,
  COUNT(CASE WHEN status = 'ESCALATED' THEN 1 END) as escalated
FROM disputes
GROUP BY profession_type;

CREATE OR REPLACE VIEW professional_risk_assessment AS
SELECT
  professional_id,
  total_disputes,
  dispute_rate,
  CASE
    WHEN dispute_rate > 10 THEN 'CRITICAL'
    WHEN dispute_rate > 5 THEN 'HIGH'
    WHEN dispute_rate > 2 THEN 'MEDIUM'
    ELSE 'LOW'
  END as risk_level
FROM professional_accountability;

COMMIT;

SELECT 'Dispute Resolution Schema Created Successfully' as status;
