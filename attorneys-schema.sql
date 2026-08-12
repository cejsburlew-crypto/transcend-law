-- TRANSCEND LAW - LICENSED ATTORNEYS DIRECTORY SCHEMA
-- Stores licensed attorneys from all 50 states + DC

BEGIN TRANSACTION;

-- Licensed Attorneys Table
CREATE TABLE IF NOT EXISTS attorneys (
  id SERIAL PRIMARY KEY,
  external_id VARCHAR(255),

  -- Location
  state VARCHAR(2) NOT NULL,
  state_name VARCHAR(50) NOT NULL,
  bar_state VARCHAR(2),

  -- Personal Information
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  middle_name VARCHAR(100),

  -- Bar Information
  bar_number VARCHAR(100) UNIQUE,
  bar_admission_year INT,
  practicing_years INT,
  license_status VARCHAR(50) DEFAULT 'ACTIVE',  -- ACTIVE, INACTIVE, SUSPENDED, DISBARRED

  -- Contact Information
  email VARCHAR(255),
  phone VARCHAR(20),
  office_phone VARCHAR(20),
  mobile_phone VARCHAR(20),

  -- Law Firm Association
  law_firm_id INT REFERENCES law_firms(id),
  law_firm_name VARCHAR(255),
  firm_position VARCHAR(100),  -- Partner, Associate, Counsel, etc.
  years_at_firm INT,

  -- Practice Areas
  practice_areas JSONB,  -- ["Corporate Law", "Litigation", ...]
  specializations JSONB,  -- Sub-specialties
  primary_practice_area VARCHAR(100),
  secondary_practice_areas VARCHAR(500),

  -- Professional Qualifications
  education_school VARCHAR(255),
  education_degree VARCHAR(50),  -- JD, LLM, etc.
  graduation_year INT,
  certifications JSONB,  -- Board certifications, etc.
  bar_associations JSONB,  -- Multiple bar memberships

  -- Social & Web Presence
  linkedin_url VARCHAR(500),
  linkedin_follower_count INT,
  avvo_url VARCHAR(500),
  avvo_rating DECIMAL(3,1),
  avvo_reviews_count INT,
  google_rating DECIMAL(3,1),
  google_reviews_count INT,
  justia_url VARCHAR(500),
  findlaw_url VARCHAR(500),
  website_url VARCHAR(500),

  -- Experience & Credentials
  years_experience INT,
  cases_handled INT,
  favorable_outcomes INT,
  disciplinary_history BOOLEAN DEFAULT FALSE,
  disciplinary_details TEXT,

  -- Ratings & Trust
  peer_rating DECIMAL(3,1),  -- Martindale-Hubbell
  client_satisfaction_score DECIMAL(3,1),
  languages JSONB,  -- Languages spoken: ["English", "Spanish", ...]

  -- Availability
  accepts_new_clients BOOLEAN DEFAULT TRUE,
  consultation_fee DECIMAL(10,2),
  hourly_rate DECIMAL(10,2),

  -- Metadata
  status VARCHAR(50) DEFAULT 'ACTIVE',
  data_source VARCHAR(200),  -- State Bar Directory, etc.
  data_source_url VARCHAR(500),
  last_verified TIMESTAMP,
  verified_by VARCHAR(100),

  -- Timestamps
  collected_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  imported_date TIMESTAMP,

  -- Deduplication
  attorney_hash VARCHAR(255) UNIQUE,

  UNIQUE(state, bar_number),
  UNIQUE(state, first_name, last_name, bar_admission_year)
);

-- Attorney Case History
CREATE TABLE IF NOT EXISTS attorney_cases (
  id SERIAL PRIMARY KEY,
  attorney_id INT REFERENCES attorneys(id),

  case_name VARCHAR(255),
  case_number VARCHAR(100),
  court VARCHAR(100),
  practice_area VARCHAR(100),
  outcome VARCHAR(50),  -- Won, Lost, Settled, Dismissed
  amount_involved DECIMAL(15,2),
  trial_date DATE,
  settlement_date DATE,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Attorney Disciplinary Records
CREATE TABLE IF NOT EXISTS attorney_disciplinary_records (
  id SERIAL PRIMARY KEY,
  attorney_id INT REFERENCES attorneys(id),

  violation_date DATE,
  violation_description TEXT,
  sanction_type VARCHAR(100),  -- Warning, Suspension, Disbarment, etc.
  sanction_duration_months INT,
  status VARCHAR(50),  -- Active, Resolved, Appealed
  details TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Attorney Education & Credentials
CREATE TABLE IF NOT EXISTS attorney_credentials (
  id SERIAL PRIMARY KEY,
  attorney_id INT REFERENCES attorneys(id),

  credential_type VARCHAR(100),  -- Board Certification, Specialty, etc.
  credential_name VARCHAR(255),
  issuing_organization VARCHAR(255),
  issue_date DATE,
  expiration_date DATE,
  credential_number VARCHAR(100),
  status VARCHAR(50),

  created_at TIMESTAMP DEFAULT NOW()
);

-- Attorney Reviews & Ratings
CREATE TABLE IF NOT EXISTS attorney_reviews (
  id SERIAL PRIMARY KEY,
  attorney_id INT REFERENCES attorneys(id),

  reviewer_name VARCHAR(255),
  reviewer_type VARCHAR(50),  -- Client, Peer, Judge
  rating DECIMAL(3,1),
  review_text TEXT,
  review_date DATE,
  verified BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_attorneys_state ON attorneys(state);
CREATE INDEX IF NOT EXISTS idx_attorneys_bar_number ON attorneys(bar_number);
CREATE INDEX IF NOT EXISTS idx_attorneys_name ON attorneys(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_attorneys_firm ON attorneys(law_firm_id);
CREATE INDEX IF NOT EXISTS idx_attorneys_practice ON attorneys USING GIN(practice_areas);
CREATE INDEX IF NOT EXISTS idx_attorneys_rating ON attorneys(avvo_rating);
CREATE INDEX IF NOT EXISTS idx_attorneys_status ON attorneys(license_status);
CREATE INDEX IF NOT EXISTS idx_attorneys_email ON attorneys(email);

-- View: Active Attorneys by State
CREATE OR REPLACE VIEW active_attorneys_by_state AS
SELECT
  state,
  state_name,
  COUNT(*) as total_attorneys,
  COUNT(CASE WHEN avvo_rating >= 8.0 THEN 1 END) as highly_rated,
  COUNT(CASE WHEN law_firm_id IS NOT NULL THEN 1 END) as affiliated_with_firms,
  AVG(CAST(avvo_rating AS FLOAT))::NUMERIC(3,1) as avg_rating,
  AVG(CAST(years_experience AS FLOAT))::INT as avg_experience_years,
  MAX(collected_at) as last_collection_date
FROM attorneys
WHERE license_status = 'ACTIVE'
GROUP BY state, state_name
ORDER BY total_attorneys DESC;

-- View: Top Attorneys by Rating
CREATE OR REPLACE VIEW top_rated_attorneys AS
SELECT
  a.id,
  a.full_name,
  a.state,
  a.state_name,
  a.practice_areas,
  a.avvo_rating,
  a.avvo_reviews_count,
  a.years_experience,
  lf.name as law_firm_name,
  COUNT(DISTINCT ac.id) as cases_handled
FROM attorneys a
LEFT JOIN law_firms lf ON a.law_firm_id = lf.id
LEFT JOIN attorney_cases ac ON a.id = ac.attorney_id
WHERE a.license_status = 'ACTIVE' AND a.avvo_rating >= 8.0
GROUP BY a.id, lf.id
ORDER BY a.avvo_rating DESC, a.avvo_reviews_count DESC;

-- View: Attorneys by Practice Area
CREATE OR REPLACE VIEW attorneys_by_practice_area AS
SELECT
  state,
  jsonb_array_elements(practice_areas)::text as practice_area,
  COUNT(DISTINCT id) as attorney_count,
  AVG(CAST(avvo_rating AS FLOAT))::NUMERIC(3,1) as avg_rating
FROM attorneys
WHERE license_status = 'ACTIVE'
GROUP BY state, jsonb_array_elements(practice_areas)
ORDER BY attorney_count DESC;

COMMIT;

-- Display created tables
\dt attorneys
\dt attorney_cases
\dt attorney_disciplinary_records
\dt attorney_credentials
\dt attorney_reviews

-- Show views
\dv active_attorneys_by_state
\dv top_rated_attorneys
\dv attorneys_by_practice_area

SELECT 'Attorneys schema created successfully' as status;
