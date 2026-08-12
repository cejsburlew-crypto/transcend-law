-- TRANSCEND LAW - PRIVATE INVESTIGATORS DIRECTORY SCHEMA
-- Licensed investigators from all 50 states + DC

BEGIN TRANSACTION;

-- Private Investigators Table
CREATE TABLE IF NOT EXISTS private_investigators (
  id SERIAL PRIMARY KEY,
  external_id VARCHAR(255),

  -- Location
  state VARCHAR(2) NOT NULL,
  state_name VARCHAR(50) NOT NULL,
  city VARCHAR(100),
  county VARCHAR(100),

  -- Personal Information
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  full_name VARCHAR(255) NOT NULL,

  -- License Information
  license_number VARCHAR(100) UNIQUE,
  license_type VARCHAR(100),  -- PI, Security Guard, Corporate Investigator, etc.
  license_status VARCHAR(50) DEFAULT 'ACTIVE',  -- ACTIVE, INACTIVE, SUSPENDED
  license_issue_date DATE,
  license_expiration_date DATE,
  years_licensed INT,

  -- Contact Information
  email VARCHAR(255),
  phone VARCHAR(20),
  office_phone VARCHAR(20),
  mobile_phone VARCHAR(20),
  website VARCHAR(500),

  -- Business Information
  business_name VARCHAR(255),
  business_type VARCHAR(100),  -- Solo, Agency, Firm
  years_in_business INT,
  employee_count INT,

  -- Specializations
  specializations JSONB,  -- ["Background Checks", "Infidelity", "Corporate Fraud", ...]
  case_types JSONB,  -- Types of cases handled
  industries_served JSONB,  -- Industries: Corporate, Legal, Insurance, etc.

  -- Credentials & Certifications
  certifications JSONB,  -- Board certifications, advanced training
  background_check_trained BOOLEAN,
  surveillance_certified BOOLEAN,
  corporate_investigator BOOLEAN,
  insurance_fraud_specialist BOOLEAN,

  -- Professional Credentials
  bonded BOOLEAN DEFAULT FALSE,
  insured BOOLEAN DEFAULT FALSE,
  insurance_provider VARCHAR(255),
  insurance_coverage_amount DECIMAL(15,2),

  -- Ratings & Reviews
  avvo_rating DECIMAL(3,1),
  google_rating DECIMAL(3,1),
  reviews_count INT,
  case_success_rate DECIMAL(5,2),  -- Percentage

  -- Availability & Pricing
  available_for_new_cases BOOLEAN DEFAULT TRUE,
  service_areas JSONB,  -- Geographic areas served
  hourly_rate DECIMAL(10,2),
  retainer_required BOOLEAN,
  retainer_amount DECIMAL(10,2),

  -- Professional References
  bar_associations JSONB,
  professional_memberships JSONB,
  linkedin_url VARCHAR(500),

  -- Metadata
  status VARCHAR(50) DEFAULT 'ACTIVE',
  data_source VARCHAR(200),
  data_source_url VARCHAR(500),
  last_verified TIMESTAMP,
  verified_by VARCHAR(100),

  -- Timestamps
  collected_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  imported_date TIMESTAMP,

  -- Deduplication
  investigator_hash VARCHAR(255) UNIQUE,

  UNIQUE(state, license_number)
);

-- PI Cases Table
CREATE TABLE IF NOT EXISTS pi_cases (
  id SERIAL PRIMARY KEY,
  pi_id INT REFERENCES private_investigators(id),

  case_type VARCHAR(100),  -- Background Check, Infidelity, Fraud, etc.
  case_description TEXT,
  case_date DATE,
  case_status VARCHAR(50),  -- Open, Closed, Archived
  client_type VARCHAR(50),  -- Corporate, Individual, Attorney, Insurance
  outcome VARCHAR(100),
  case_value DECIMAL(15,2),

  created_at TIMESTAMP DEFAULT NOW()
);

-- PI Services Table
CREATE TABLE IF NOT EXISTS pi_services (
  id SERIAL PRIMARY KEY,
  pi_id INT REFERENCES private_investigators(id),

  service_name VARCHAR(255),  -- Background Investigation, Surveillance, etc.
  service_description TEXT,
  hourly_rate DECIMAL(10,2),
  minimum_hours INT,
  availability VARCHAR(100),

  created_at TIMESTAMP DEFAULT NOW()
);

-- PI Certifications
CREATE TABLE IF NOT EXISTS pi_certifications (
  id SERIAL PRIMARY KEY,
  pi_id INT REFERENCES private_investigators(id),

  certification_name VARCHAR(255),
  issuing_organization VARCHAR(255),
  issue_date DATE,
  expiration_date DATE,
  certification_number VARCHAR(100),

  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_pi_state ON private_investigators(state);
CREATE INDEX IF NOT EXISTS idx_pi_license ON private_investigators(license_number);
CREATE INDEX IF NOT EXISTS idx_pi_name ON private_investigators(last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_pi_rating ON private_investigators(google_rating);
CREATE INDEX IF NOT EXISTS idx_pi_specializations ON private_investigators USING GIN(specializations);
CREATE INDEX IF NOT EXISTS idx_pi_status ON private_investigators(license_status);

-- View: Active Investigators by State
CREATE OR REPLACE VIEW active_investigators_by_state AS
SELECT
  state,
  state_name,
  COUNT(*) as total_investigators,
  COUNT(CASE WHEN google_rating >= 4.5 THEN 1 END) as highly_rated,
  COUNT(CASE WHEN bonded THEN 1 END) as bonded_investigators,
  AVG(CAST(google_rating AS FLOAT))::NUMERIC(3,1) as avg_rating,
  AVG(CAST(years_in_business AS FLOAT))::INT as avg_years_experience
FROM private_investigators
WHERE license_status = 'ACTIVE'
GROUP BY state, state_name
ORDER BY total_investigators DESC;

-- View: Top Rated Investigators
CREATE OR REPLACE VIEW top_rated_investigators AS
SELECT
  id,
  full_name,
  state,
  business_name,
  specializations,
  google_rating,
  reviews_count,
  years_in_business,
  hourly_rate,
  service_areas
FROM private_investigators
WHERE license_status = 'ACTIVE' AND google_rating >= 4.5
ORDER BY google_rating DESC, reviews_count DESC;

COMMIT;

-- Display created tables
\dt private_investigators
\dt pi_cases
\dt pi_services
\dt pi_certifications

SELECT 'Private Investigators schema created successfully' as status;
