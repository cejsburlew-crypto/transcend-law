-- TRANSCEND LAW - OPTION 3: VERIFICATION & COMPLIANCE SCHEMA

BEGIN TRANSACTION;

-- Professional License Verification
CREATE TABLE IF NOT EXISTS professional_verifications (
  id SERIAL PRIMARY KEY,
  professional_id INT NOT NULL,
  license_number VARCHAR(100),
  license_type VARCHAR(100),
  issuing_state VARCHAR(2),
  license_status VARCHAR(50),  -- ACTIVE, INACTIVE, SUSPENDED, EXPIRED
  issued_date DATE,
  expiration_date DATE,
  verified_at TIMESTAMP,
  verified_by VARCHAR(100),
  INDEX idx_professional (professional_id)
);

-- Compliance Requirements per Profession
CREATE TABLE IF NOT EXISTS compliance_requirements (
  id SERIAL PRIMARY KEY,
  profession_type VARCHAR(100),
  requirement_type VARCHAR(100),  -- LICENSE, INSURANCE, BACKGROUND_CHECK, BONDING, etc.
  description TEXT,
  mandatory BOOLEAN DEFAULT TRUE,
  renewal_frequency INT,  -- months
  documentation_required BOOLEAN DEFAULT TRUE
);

-- Professional Compliance Status
CREATE TABLE IF NOT EXISTS professional_compliance (
  id SERIAL PRIMARY KEY,
  professional_id INT NOT NULL,
  profession_type VARCHAR(100),
  requirement_type VARCHAR(100),
  status VARCHAR(50),  -- INCOMPLETE, PENDING_REVIEW, COMPLIANT, EXPIRED
  completion_date TIMESTAMP,
  expiration_date DATE,
  INDEX idx_professional (professional_id),
  INDEX idx_status (status)
);

-- Verification Documents
CREATE TABLE IF NOT EXISTS verification_documents (
  id SERIAL PRIMARY KEY,
  professional_id INT NOT NULL,
  document_type VARCHAR(100),
  document_url VARCHAR(500),
  file_hash VARCHAR(100),
  uploaded_at TIMESTAMP,
  expiration_date DATE,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP
);

-- Background Checks
CREATE TABLE IF NOT EXISTS background_checks (
  id SERIAL PRIMARY KEY,
  professional_id INT NOT NULL,
  check_type VARCHAR(100),  -- CRIMINAL, CREDIT, CIVIL, REGULATORY
  provider VARCHAR(100),
  result TEXT,
  status VARCHAR(50),  -- CLEAR, FLAG, REVIEW_REQUIRED
  checked_at TIMESTAMP
);

-- Insurance & Bonding
CREATE TABLE IF NOT EXISTS professional_insurance (
  id SERIAL PRIMARY KEY,
  professional_id INT NOT NULL,
  insurance_type VARCHAR(100),  -- MALPRACTICE, LIABILITY, BONDING
  provider_name VARCHAR(255),
  policy_number VARCHAR(100),
  coverage_amount DECIMAL(15,2),
  effective_date DATE,
  expiration_date DATE,
  verified BOOLEAN DEFAULT FALSE
);

-- Trust Scores (0-100)
CREATE TABLE IF NOT EXISTS professional_trust_scores (
  id SERIAL PRIMARY KEY,
  professional_id INT NOT NULL,
  verification_score INT,  -- 0-25
  compliance_score INT,  -- 0-25
  history_score INT,  -- 0-25
  rating_score INT,  -- 0-25
  total_score INT,  -- 0-100
  trust_level VARCHAR(50),  -- UNVERIFIED, BASIC, TRUSTED, VERIFIED_PROFESSIONAL
  last_updated TIMESTAMP,
  INDEX idx_professional (professional_id),
  INDEX idx_trust_level (trust_level)
);

-- Disciplinary History
CREATE TABLE IF NOT EXISTS disciplinary_history (
  id SERIAL PRIMARY KEY,
  professional_id INT NOT NULL,
  offense_type VARCHAR(100),
  severity VARCHAR(50),  -- MINOR, MODERATE, SEVERE
  ruling_date DATE,
  status VARCHAR(50),  -- ACTIVE, RESOLVED, APPEALED
  details TEXT,
  suspension_period INT,  -- days
  INDEX idx_professional (professional_id)
);

-- Views for Compliance Reporting
CREATE OR REPLACE VIEW compliance_summary_by_profession AS
SELECT
  profession_type,
  COUNT(DISTINCT professional_id) as professionals,
  COUNT(CASE WHEN status = 'COMPLIANT' THEN 1 END) as compliant_count,
  ROUND(100.0 * COUNT(CASE WHEN status = 'COMPLIANT' THEN 1 END) / COUNT(*), 2) as compliance_rate
FROM professional_compliance
GROUP BY profession_type;

CREATE OR REPLACE VIEW verification_status_by_state AS
SELECT
  state,
  COUNT(*) as total_professionals,
  COUNT(CASE WHEN id IN (SELECT professional_id FROM professional_verifications WHERE verified_at IS NOT NULL) THEN 1 END) as verified_count
FROM professional_profiles
GROUP BY state;

COMMIT;

SELECT 'Verification & Compliance Schema Created Successfully' as status;
