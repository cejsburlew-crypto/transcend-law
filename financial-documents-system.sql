-- TRANSCEND LAW - FINANCIAL DOCUMENT VERIFICATION SYSTEM
-- Captures and verifies required financial documents for all service providers

BEGIN TRANSACTION;

-- Financial documents storage table
CREATE TABLE IF NOT EXISTS financial_documents (
  id SERIAL PRIMARY KEY,
  service_provider_id VARCHAR(255) NOT NULL,  -- References notary, attorney, sme, or tagger
  provider_type VARCHAR(50) NOT NULL CHECK (provider_type IN ('notary', 'attorney', 'sme', 'tagger')),
  firm_id UUID REFERENCES firms(id),

  -- Document info
  document_type VARCHAR(100) NOT NULL,  -- Tax ID, W9, 1099, EIN, SSN, License, Insurance, etc.
  document_category VARCHAR(50) NOT NULL CHECK (document_category IN ('tax_id', 'business_structure', 'identification', 'insurance', 'banking', 'compliance')),

  -- File storage
  file_url VARCHAR(1000) NOT NULL,
  file_hash VARCHAR(255) NOT NULL,  -- SHA-256 hash for integrity verification
  file_size_bytes INT,
  mime_type VARCHAR(100),
  uploaded_at TIMESTAMP DEFAULT NOW(),

  -- Document content fields
  document_number VARCHAR(255),  -- Tax ID, License Number, Policy Number, etc.
  document_name VARCHAR(255),
  document_issue_date DATE,
  document_expiration_date DATE,
  issuing_authority VARCHAR(255),
  issuing_country VARCHAR(2) DEFAULT 'US',

  -- AI Verification Results
  verification_status VARCHAR(50) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected', 'manual_review_required', 'expired')),
  verification_timestamp TIMESTAMP,
  verification_method VARCHAR(50),  -- 'ai_ocr', 'ai_ml', 'manual', 'government_api'

  -- AI Confidence Scores (0-100)
  document_authenticity_score INT CHECK (document_authenticity_score >= 0 AND document_authenticity_score <= 100),
  data_accuracy_score INT CHECK (data_accuracy_score >= 0 AND data_accuracy_score <= 100),
  completeness_score INT CHECK (completeness_score >= 0 AND completeness_score <= 100),

  -- Extracted Data (AI-OCR results)
  extracted_data JSONB,  -- {"field_name": "value", "confidence": 0.95, ...}
  extracted_fields_match BOOLEAN DEFAULT FALSE,  -- Does extracted data match submitted form?

  -- Manual Review
  reviewer_id VARCHAR(255),
  reviewer_notes TEXT,
  rejection_reason TEXT,
  rejection_code VARCHAR(50),  -- 'expired', 'invalid_format', 'data_mismatch', 'duplicate', 'incomplete'

  -- Compliance flags
  requires_government_verification BOOLEAN DEFAULT FALSE,
  government_verification_status VARCHAR(50),  -- 'pending', 'verified', 'failed'
  government_verification_timestamp TIMESTAMP,
  irs_match BOOLEAN,  -- Does it match IRS records?
  ssn_match BOOLEAN,  -- Does SSN match background check?

  -- Audit trail
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(255),
  updated_by VARCHAR(255),

  UNIQUE(service_provider_id, provider_type, document_type, issuing_authority)
);

-- Service provider financial profiles
CREATE TABLE IF NOT EXISTS financial_profiles (
  id SERIAL PRIMARY KEY,
  service_provider_id VARCHAR(255) NOT NULL,
  provider_type VARCHAR(50) NOT NULL CHECK (provider_type IN ('notary', 'attorney', 'sme', 'tagger')),
  firm_id UUID REFERENCES firms(id),

  -- Required documents checklist
  has_tax_id BOOLEAN DEFAULT FALSE,
  has_identification BOOLEAN DEFAULT FALSE,
  has_business_registration BOOLEAN DEFAULT FALSE,
  has_insurance BOOLEAN DEFAULT FALSE,
  has_banking_info BOOLEAN DEFAULT FALSE,

  -- Compliance status
  compliance_status VARCHAR(50) DEFAULT 'incomplete' CHECK (compliance_status IN ('incomplete', 'pending_review', 'verified', 'rejected')),
  compliance_percentage INT DEFAULT 0,  -- 0-100%
  last_compliance_check TIMESTAMP,

  -- Financial info
  business_structure VARCHAR(50),  -- 'sole_proprietor', 'llc', 'corp', 's_corp', 'partnership'
  tax_id_type VARCHAR(50),  -- 'ssn', 'ein'
  tax_id_last_4 VARCHAR(4),

  -- Banking (encrypted)
  bank_account_last_4 VARCHAR(4),
  bank_routing_last_4 VARCHAR(4),

  -- Payment details
  payment_method VARCHAR(50) DEFAULT 'direct_deposit',  -- 'direct_deposit', 'check', 'wire'
  ready_for_payment BOOLEAN DEFAULT FALSE,

  -- Created/Updated
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(service_provider_id, provider_type)
);

-- AI Verification Results Archive
CREATE TABLE IF NOT EXISTS ai_verification_logs (
  id SERIAL PRIMARY KEY,
  financial_document_id INT REFERENCES financial_documents(id),

  -- AI Model used
  ai_model VARCHAR(100),  -- 'gpt-4-vision', 'claude-vision', 'tesseract', etc.
  ai_model_version VARCHAR(50),

  -- Processing details
  processing_start TIMESTAMP,
  processing_duration_ms INT,
  confidence_level DECIMAL(3,2),  -- 0.00-1.00

  -- Results
  ocr_text TEXT,  -- Raw OCR output
  extracted_fields JSONB,  -- Structured extracted fields
  validation_rules_applied TEXT[],  -- Which rules were checked
  validation_results JSONB,  -- {"rule_name": {"passed": true, "details": "..."}}

  -- Flags
  anomalies_detected TEXT[],  -- ["field_mismatch", "unusual_format", ...]
  requires_manual_review BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Compliance requirements by provider type
CREATE TABLE IF NOT EXISTS compliance_requirements (
  id SERIAL PRIMARY KEY,
  provider_type VARCHAR(50) NOT NULL,
  document_type VARCHAR(100) NOT NULL,
  requirement_category VARCHAR(50),
  required BOOLEAN DEFAULT TRUE,
  verification_method VARCHAR(100),  -- 'ai_ocr', 'government_api', 'manual'
  description TEXT,

  UNIQUE(provider_type, document_type)
);

-- Insert compliance requirements
INSERT INTO compliance_requirements (provider_type, document_type, requirement_category, verification_method, description) VALUES
  ('notary', 'Notary License', 'identification', 'ai_ocr', 'Valid state notary commission'),
  ('notary', 'Tax ID (SSN)', 'tax_id', 'government_api', 'Social Security Number verification'),
  ('notary', 'Identification', 'identification', 'ai_ocr', 'Driver License or State ID'),
  ('notary', 'Background Check', 'compliance', 'government_api', 'FBI/State background clearance'),

  ('attorney', 'Law License', 'identification', 'government_api', 'Active bar license verification'),
  ('attorney', 'Tax ID (SSN or EIN)', 'tax_id', 'government_api', 'IRS verified'),
  ('attorney', 'Identification', 'identification', 'ai_ocr', 'Driver License'),
  ('attorney', 'Bar Association Registration', 'compliance', 'government_api', 'Current bar membership'),
  ('attorney', 'Insurance', 'insurance', 'government_api', 'Professional liability insurance'),

  ('sme', 'Tax ID (SSN or EIN)', 'tax_id', 'government_api', 'IRS verified'),
  ('sme', 'Identification', 'identification', 'ai_ocr', 'Driver License or Passport'),
  ('sme', 'Business Registration (if LLC/Corp)', 'business_structure', 'government_api', 'Secretary of State filing'),

  ('tagger', 'Tax ID (SSN or EIN)', 'tax_id', 'government_api', 'IRS verified'),
  ('tagger', 'Identification', 'identification', 'ai_ocr', 'Driver License'),
  ('tagger', 'Registration/Certification', 'compliance', 'government_api', 'State vehicle registration authority');

-- Create indexes for performance
CREATE INDEX idx_financial_docs_provider ON financial_documents(service_provider_id, provider_type);
CREATE INDEX idx_financial_docs_status ON financial_documents(verification_status);
CREATE INDEX idx_financial_profiles_status ON financial_profiles(compliance_status);
CREATE INDEX idx_financial_profiles_payment_ready ON financial_profiles(ready_for_payment);

-- View: Compliance Dashboard Summary
CREATE OR REPLACE VIEW financial_compliance_summary AS
SELECT
  fp.provider_type,
  COUNT(DISTINCT fp.service_provider_id) as total_providers,
  COUNT(CASE WHEN fp.compliance_status = 'verified' THEN 1 END) as verified_count,
  COUNT(CASE WHEN fp.compliance_status = 'pending_review' THEN 1 END) as pending_count,
  COUNT(CASE WHEN fp.compliance_status = 'rejected' THEN 1 END) as rejected_count,
  COUNT(CASE WHEN fp.ready_for_payment THEN 1 END) as ready_for_payment_count,
  AVG(fp.compliance_percentage) as avg_compliance_percentage,
  MIN(fp.last_compliance_check) as oldest_check,
  MAX(fp.last_compliance_check) as most_recent_check
FROM financial_profiles fp
GROUP BY fp.provider_type;

COMMIT;

-- Display created tables
\dt financial_*
\dt ai_verification_logs
\dt compliance_requirements

-- Show compliance requirements
SELECT * FROM compliance_requirements ORDER BY provider_type, document_type;
