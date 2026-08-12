-- TRANSCEND LAW - PROFESSIONAL DISCOVERY & REFERRAL SYSTEM
-- Connects all professionals and enables cross-profession referrals
-- Used for recruitment, recommendations, and network effects

BEGIN TRANSACTION;

-- Professional Network Table - Maps relationships between all professional types
CREATE TABLE IF NOT EXISTS professional_network (
  id SERIAL PRIMARY KEY,

  -- Source Professional (the one making the referral)
  source_professional_id INT NOT NULL,
  source_profession_type VARCHAR(100) NOT NULL,  -- Attorney, Paralegal, PI, etc.
  source_firm_id INT,

  -- Target Professional Type (what they need)
  target_profession_type VARCHAR(100) NOT NULL,
  target_state VARCHAR(2),

  -- Relationship Details
  relationship_type VARCHAR(50),  -- REFERRAL, RECOMMENDATION, WORKING_RELATIONSHIP
  case_type VARCHAR(100),  -- Type of work that triggered the relationship
  frequency INT DEFAULT 1,  -- How many times referenced

  -- Value Exchange
  commission_offered DECIMAL(5,2),  -- Commission percentage offered
  volume_potential_per_month INT,  -- Est. referrals/month

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(source_professional_id, source_profession_type, target_profession_type, target_state)
);

-- Professional Discovery Signals - Tracks what professionals are actively looking for
CREATE TABLE IF NOT EXISTS discovery_signals (
  id SERIAL PRIMARY KEY,

  professional_id INT NOT NULL,
  profession_type VARCHAR(100) NOT NULL,
  state VARCHAR(2),

  -- What they need
  needed_profession_type VARCHAR(100),
  case_types_needed JSONB,  -- Types of cases they handle

  -- How often they need it
  frequency_per_month INT,
  last_need_date TIMESTAMP,

  -- Preference
  preferred_hourly_rate_min DECIMAL(10,2),
  preferred_hourly_rate_max DECIMAL(10,2),
  required_experience_years INT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Professional Profiles View - Shows what each professional offers
CREATE TABLE IF NOT EXISTS professional_profiles (
  id SERIAL PRIMARY KEY,

  professional_id INT NOT NULL,
  profession_type VARCHAR(100) NOT NULL,
  state VARCHAR(2) NOT NULL,

  -- Basic Info
  full_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),

  -- What they offer
  specializations JSONB,
  case_types_handled JSONB,
  hourly_rate DECIMAL(10,2),

  -- Availability
  available_for_referrals BOOLEAN DEFAULT TRUE,
  referral_commission_accepted DECIMAL(5,2),

  -- Rating
  avg_rating DECIMAL(3,1),
  reviews_count INT,

  -- Status
  status VARCHAR(50) DEFAULT 'ACTIVE',
  verified BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Referral Queue - Pending referrals waiting to be matched
CREATE TABLE IF NOT EXISTS referral_queue (
  id SERIAL PRIMARY KEY,

  referrer_id INT,
  referrer_profession_type VARCHAR(100),
  referrer_state VARCHAR(2),

  needed_profession_type VARCHAR(100),
  needed_state VARCHAR(2),
  case_type VARCHAR(100),

  -- Matching
  matched_professional_id INT,
  match_confidence DECIMAL(3,2),  -- 0.0-1.0

  -- Status
  status VARCHAR(50) DEFAULT 'PENDING',  -- PENDING, MATCHED, COMPLETED, REJECTED

  matched_at TIMESTAMP,
  completed_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Recruitment Tracking - Tracks outreach to each profession type
CREATE TABLE IF NOT EXISTS recruitment_campaigns (
  id SERIAL PRIMARY KEY,

  profession_type VARCHAR(100) NOT NULL,
  state VARCHAR(2),

  -- Campaign Details
  campaign_name VARCHAR(255),
  target_count INT,
  estimated_commission_offered DECIMAL(5,2),
  value_proposition TEXT,

  -- Results
  outreach_sent INT DEFAULT 0,
  signups INT DEFAULT 0,
  conversion_rate DECIMAL(5,2),

  -- Status
  status VARCHAR(50) DEFAULT 'PLANNING',  -- PLANNING, ACTIVE, COMPLETED
  launch_date TIMESTAMP,
  end_date TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Recruitment Leads - Individual professionals contacted
CREATE TABLE IF NOT EXISTS recruitment_leads (
  id SERIAL PRIMARY KEY,

  profession_type VARCHAR(100) NOT NULL,
  state VARCHAR(2),

  -- Contact Info
  name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),

  -- Source
  data_source VARCHAR(200),  -- Where we got their contact info

  -- Outreach
  outreach_sent BOOLEAN DEFAULT FALSE,
  outreach_date TIMESTAMP,
  outreach_message_type VARCHAR(100),  -- EMAIL, PHONE, SMS

  -- Response
  opened_email BOOLEAN DEFAULT FALSE,
  clicked_link BOOLEAN DEFAULT FALSE,
  responded BOOLEAN DEFAULT FALSE,
  signed_up BOOLEAN DEFAULT FALSE,
  signup_date TIMESTAMP,

  -- Interest Level
  interest_level VARCHAR(50),  -- HIGH, MEDIUM, LOW
  estimated_monthly_volume INT,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Professional Matching Rules - How to match referrals
CREATE TABLE IF NOT EXISTS matching_rules (
  id SERIAL PRIMARY KEY,

  source_profession_type VARCHAR(100),
  target_profession_type VARCHAR(100),

  -- Matching Logic
  match_by_state BOOLEAN DEFAULT TRUE,
  match_by_specialization BOOLEAN DEFAULT TRUE,
  match_by_experience_level BOOLEAN DEFAULT FALSE,

  -- Scoring
  priority_score INT DEFAULT 100,
  min_rating DECIMAL(3,1) DEFAULT 3.5,

  -- Volume & Rates
  min_availability_per_month INT DEFAULT 5,
  commission_percentage DECIMAL(5,2),

  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_network_source ON professional_network(source_professional_id, source_profession_type);
CREATE INDEX IF NOT EXISTS idx_network_target ON professional_network(target_profession_type, target_state);
CREATE INDEX IF NOT EXISTS idx_discovery_profession ON discovery_signals(profession_type, state);
CREATE INDEX IF NOT EXISTS idx_referral_queue_status ON referral_queue(status);
CREATE INDEX IF NOT EXISTS idx_referral_queue_match ON referral_queue(needed_profession_type, needed_state, status);
CREATE INDEX IF NOT EXISTS idx_recruitment_profession ON recruitment_campaigns(profession_type, state);
CREATE INDEX IF NOT EXISTS idx_recruitment_leads_signup ON recruitment_leads(signed_up, profession_type);
CREATE INDEX IF NOT EXISTS idx_matching_types ON matching_rules(source_profession_type, target_profession_type);

-- View: Top Referral Opportunities
CREATE OR REPLACE VIEW top_referral_opportunities AS
SELECT
  source_profession_type,
  target_profession_type,
  COUNT(*) as referral_count,
  AVG(commission_offered) as avg_commission,
  SUM(volume_potential_per_month) as total_monthly_volume,
  state
FROM professional_network
WHERE frequency > 0
GROUP BY source_profession_type, target_profession_type, state
ORDER BY total_monthly_volume DESC;

-- View: Recruitment Status by Profession
CREATE OR REPLACE VIEW recruitment_status_by_profession AS
SELECT
  profession_type,
  state,
  COUNT(*) as total_leads,
  SUM(CASE WHEN outreach_sent THEN 1 ELSE 0 END) as outreach_sent,
  SUM(CASE WHEN responded THEN 1 ELSE 0 END) as responded,
  SUM(CASE WHEN signed_up THEN 1 ELSE 0 END) as signed_up,
  ROUND(100.0 * SUM(CASE WHEN signed_up THEN 1 ELSE 0 END) / COUNT(*), 2) as signup_rate
FROM recruitment_leads
GROUP BY profession_type, state
ORDER BY signup_rate DESC;

COMMIT;

-- Display created tables
SELECT 'Professional Discovery System created successfully' as status;
\dt professional_network
\dt discovery_signals
\dt professional_profiles
\dt referral_queue
\dt recruitment_campaigns
\dt recruitment_leads
\dt matching_rules
