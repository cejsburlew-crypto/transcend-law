-- TRANSCEND LAW - LAW FIRM DIRECTORY SCHEMA
-- Stores law firm data from all 50 states + DC with logos, websites, contact info

BEGIN TRANSACTION;

-- Law Firms Table
CREATE TABLE IF NOT EXISTS law_firms (
  id SERIAL PRIMARY KEY,
  external_id VARCHAR(255),

  -- Location
  state VARCHAR(2) NOT NULL,
  state_name VARCHAR(50) NOT NULL,
  city VARCHAR(100) NOT NULL,
  county VARCHAR(100),
  address TEXT,
  zip_code VARCHAR(10),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),

  -- Business Info
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  website VARCHAR(500),
  logo_url VARCHAR(1000),  -- Direct link to logo image
  logo_file_path VARCHAR(500),  -- Stored locally in S3/CDN

  -- Law Firm Details
  firm_type VARCHAR(100),  -- Solo, Small Firm, Mid-Size, Large, Corporate, Boutique
  practice_areas JSONB,    -- ["Corporate Law", "Litigation", "IP", ...]
  specializations JSONB,   -- Sub-specialties
  employee_count INT,
  founded_year INT,

  -- Social & Web Presence
  linkedin_url VARCHAR(500),
  linkedin_follower_count INT,
  twitter_handle VARCHAR(100),
  facebook_url VARCHAR(500),
  google_business_url VARCHAR(500),

  -- Ratings & Reviews
  avvo_rating DECIMAL(3,1),     -- 1.0-10.0
  avvo_reviews_count INT,
  google_rating DECIMAL(3,1),   -- 1.0-5.0
  google_reviews_count INT,
  yelp_rating DECIMAL(3,1),
  yelp_reviews_count INT,
  better_business_bureau_rating VARCHAR(5),  -- A+, A, B+, etc.

  -- Verified Data
  bar_registration_verified BOOLEAN DEFAULT FALSE,
  lead_attorney_name VARCHAR(255),
  lead_attorney_bar_number VARCHAR(100),
  malpractice_insurance BOOLEAN,

  -- Metadata
  status VARCHAR(50) DEFAULT 'ACTIVE',  -- ACTIVE, CLOSED, INACTIVE
  data_source VARCHAR(200),  -- Secretary of State, Avvo, LawDB, etc.
  data_source_url VARCHAR(500),
  last_verified TIMESTAMP,
  verified_by VARCHAR(100),

  -- Timestamps
  collected_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  imported_date TIMESTAMP,

  -- Deduplication
  firm_hash VARCHAR(255) UNIQUE,  -- SHA-256 hash for deduplication

  UNIQUE(state, name, city)
);

-- Lead Attorneys Table (Attorneys associated with firms)
CREATE TABLE IF NOT EXISTS firm_attorneys (
  id SERIAL PRIMARY KEY,
  law_firm_id INT REFERENCES law_firms(id),

  -- Attorney Info
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  full_name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(20),

  -- Bar & Credentials
  bar_number VARCHAR(100),
  bar_state VARCHAR(2),
  bar_admission_year INT,
  practicing_since INT,

  -- Practice Areas
  practice_areas JSONB,
  specializations JSONB,

  -- Social & Web
  linkedin_url VARCHAR(500),
  avvo_profile_url VARCHAR(500),

  -- Status
  status VARCHAR(50),
  position VARCHAR(100),  -- Partner, Associate, Counsel, etc.

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Law Firm Offices/Locations
CREATE TABLE IF NOT EXISTS firm_locations (
  id SERIAL PRIMARY KEY,
  law_firm_id INT REFERENCES law_firms(id),

  office_name VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(2),
  zip_code VARCHAR(10),
  phone VARCHAR(20),
  email VARCHAR(255),

  is_main_office BOOLEAN DEFAULT FALSE,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Law Firm Services/Practice Areas
CREATE TABLE IF NOT EXISTS firm_services (
  id SERIAL PRIMARY KEY,
  law_firm_id INT REFERENCES law_firms(id),

  service_name VARCHAR(255),  -- Corporate Law, Litigation, etc.
  description TEXT,
  experience_years INT,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Logo Storage References
CREATE TABLE IF NOT EXISTS firm_logos (
  id SERIAL PRIMARY KEY,
  law_firm_id INT REFERENCES law_firms(id),

  source_url VARCHAR(1000),
  stored_path VARCHAR(500),
  s3_bucket VARCHAR(255),
  s3_key VARCHAR(500),
  file_hash VARCHAR(255),

  width INT,
  height INT,
  format VARCHAR(10),  -- png, jpg, gif, svg
  file_size_bytes INT,

  downloaded_at TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_law_firms_state ON law_firms(state);
CREATE INDEX IF NOT EXISTS idx_law_firms_city ON law_firms(city);
CREATE INDEX IF NOT EXISTS idx_law_firms_name ON law_firms(name);
CREATE INDEX IF NOT EXISTS idx_law_firms_rating ON law_firms(avvo_rating);
CREATE INDEX IF NOT EXISTS idx_law_firms_state_city ON law_firms(state, city);
CREATE INDEX IF NOT EXISTS idx_law_firms_practice_areas ON law_firms USING GIN(practice_areas);
CREATE INDEX IF NOT EXISTS idx_law_firms_website ON law_firms(website);
CREATE INDEX IF NOT EXISTS idx_law_firms_status ON law_firms(status);

-- View: Complete Law Firm Directory with Attorney Count
CREATE OR REPLACE VIEW law_firm_directory AS
SELECT
  lf.id,
  lf.name,
  lf.state,
  lf.state_name,
  lf.city,
  lf.address,
  lf.phone,
  lf.email,
  lf.website,
  lf.logo_url,
  lf.firm_type,
  lf.practice_areas,
  lf.employee_count,
  lf.avvo_rating,
  lf.google_rating,
  COUNT(DISTINCT fa.id) as attorney_count,
  COUNT(DISTINCT fl.id) as office_count,
  lf.status,
  lf.collected_at
FROM law_firms lf
LEFT JOIN firm_attorneys fa ON lf.id = fa.law_firm_id
LEFT JOIN firm_locations fl ON lf.id = fl.law_firm_id
WHERE lf.status = 'ACTIVE'
GROUP BY lf.id;

-- View: Law Firms by State with Statistics
CREATE OR REPLACE VIEW law_firms_by_state_stats AS
SELECT
  state,
  state_name,
  COUNT(*) as total_firms,
  COUNT(CASE WHEN avvo_rating >= 8.0 THEN 1 END) as highly_rated,
  COUNT(CASE WHEN logo_url IS NOT NULL THEN 1 END) as with_logos,
  COUNT(CASE WHEN website IS NOT NULL THEN 1 END) as with_websites,
  COUNT(CASE WHEN linkedin_url IS NOT NULL THEN 1 END) as with_linkedin,
  AVG(employee_count) as avg_employees,
  AVG(avvo_rating) as avg_rating,
  MAX(collected_at) as last_collection_date
FROM law_firms
WHERE status = 'ACTIVE'
GROUP BY state, state_name
ORDER BY total_firms DESC;

-- View: Premium Law Firms (highly rated with full info)
CREATE OR REPLACE VIEW premium_law_firms AS
SELECT
  lf.*,
  COUNT(DISTINCT fa.id) as attorney_count
FROM law_firms lf
LEFT JOIN firm_attorneys fa ON lf.id = fa.law_firm_id
WHERE
  lf.status = 'ACTIVE'
  AND lf.avvo_rating >= 8.0
  AND lf.logo_url IS NOT NULL
  AND lf.website IS NOT NULL
  AND lf.employee_count >= 5
GROUP BY lf.id;

COMMIT;

-- Display created tables
\dt law_firms
\dt firm_attorneys
\dt firm_locations
\dt firm_services
\dt firm_logos

-- Show statistics query ready
SELECT 'Law firms schema created successfully' as status;
