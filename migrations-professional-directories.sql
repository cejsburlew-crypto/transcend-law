-- TRANSCEND LAW: Professional Directories Tables
-- Notaries, Attorneys, and Law Firms by State
-- Migration: 2026-08-12

-- Table 1: State Notaries Directory
CREATE TABLE IF NOT EXISTS state_notaries (
  id SERIAL PRIMARY KEY,
  state VARCHAR(2) NOT NULL,
  notary_id VARCHAR(100) UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  full_name VARCHAR(200),
  email VARCHAR(150),
  phone VARCHAR(20),
  license_number VARCHAR(100),
  commission_expiration DATE,
  county VARCHAR(100),
  city VARCHAR(100),
  address VARCHAR(300),
  zip_code VARCHAR(10),
  status VARCHAR(50) DEFAULT 'ACTIVE', -- ACTIVE, EXPIRED, SUSPENDED, REVOKED
  data_source VARCHAR(100), -- State Notary Registry, Secretary of State, etc.
  last_verified DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_state_notaries_state ON state_notaries(state);
CREATE INDEX idx_state_notaries_status ON state_notaries(status);
CREATE INDEX idx_state_notaries_last_name ON state_notaries(last_name);
CREATE INDEX idx_state_notaries_email ON state_notaries(email);
CREATE INDEX idx_state_notaries_last_verified ON state_notaries(last_verified);
CREATE INDEX idx_state_notaries_city ON state_notaries(city);

-- Table 2: State Attorneys Directory
CREATE TABLE IF NOT EXISTS state_attorneys (
  id SERIAL PRIMARY KEY,
  state VARCHAR(2) NOT NULL,
  bar_number VARCHAR(100) UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  full_name VARCHAR(200),
  email VARCHAR(150),
  phone VARCHAR(20),
  office_address VARCHAR(300),
  office_city VARCHAR(100),
  office_state VARCHAR(2),
  office_zip VARCHAR(10),
  bar_admission_year INT,
  practice_areas TEXT, -- JSON array or comma-separated
  firm_name VARCHAR(200),
  status VARCHAR(50) DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, SUSPENDED, DISBARRED
  data_source VARCHAR(100), -- State Bar Association, AVVO, LexisNexis, etc.
  bar_lookup_url VARCHAR(300),
  last_verified DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_state_attorneys_state ON state_attorneys(state);
CREATE INDEX idx_state_attorneys_status ON state_attorneys(status);
CREATE INDEX idx_state_attorneys_bar_number ON state_attorneys(bar_number);
CREATE INDEX idx_state_attorneys_last_name ON state_attorneys(last_name);
CREATE INDEX idx_state_attorneys_email ON state_attorneys(email);
CREATE INDEX idx_state_attorneys_firm_name ON state_attorneys(firm_name);
CREATE INDEX idx_state_attorneys_last_verified ON state_attorneys(last_verified);

-- Table 3: State Law Firms Directory
CREATE TABLE IF NOT EXISTS state_law_firms (
  id SERIAL PRIMARY KEY,
  state VARCHAR(2) NOT NULL,
  firm_name VARCHAR(200) NOT NULL,
  firm_id VARCHAR(100) UNIQUE,
  office_address VARCHAR(300),
  office_city VARCHAR(100),
  office_state VARCHAR(2),
  office_zip VARCHAR(10),
  phone VARCHAR(20),
  email VARCHAR(150),
  website VARCHAR(300),
  founding_year INT,
  number_of_attorneys INT,
  managing_partner VARCHAR(150),
  practice_areas TEXT, -- JSON array
  bar_registration_number VARCHAR(100),
  status VARCHAR(50) DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, DISSOLVED
  data_source VARCHAR(100), -- Secretary of State, State Bar, UCC Filings, etc.
  last_verified DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_state_law_firms_state ON state_law_firms(state);
CREATE INDEX idx_state_law_firms_firm_name ON state_law_firms(firm_name);
CREATE INDEX idx_state_law_firms_status ON state_law_firms(status);
CREATE INDEX idx_state_law_firms_city ON state_law_firms(office_city);
CREATE INDEX idx_state_law_firms_email ON state_law_firms(email);
CREATE INDEX idx_state_law_firms_last_verified ON state_law_firms(last_verified);

-- Statistics tracking for admin dashboard
CREATE TABLE IF NOT EXISTS directory_import_log (
  id SERIAL PRIMARY KEY,
  directory_type VARCHAR(50), -- notaries, attorneys, law_firms
  state VARCHAR(2),
  records_imported INT,
  records_updated INT,
  import_date DATE,
  data_source VARCHAR(100),
  import_status VARCHAR(50), -- SUCCESS, FAILED, PARTIAL
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_import_log_date ON directory_import_log(import_date);
CREATE INDEX idx_import_log_type ON directory_import_log(directory_type);
CREATE INDEX idx_import_log_state ON directory_import_log(state);
