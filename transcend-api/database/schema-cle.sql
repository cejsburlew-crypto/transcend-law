-- CLE Tracking System Database Schema
-- Supports state-specific requirements, credit tracking, and compliance reporting

-- ============================================
-- CLE PROVIDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cle_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name VARCHAR(255) NOT NULL,
  provider_type VARCHAR(50) NOT NULL,
  -- Types: law-firm, bar-association, university, online-platform, conference
  states_approved JSONB,
  -- Array of state codes approved for this provider
  approval_number VARCHAR(100),
  bar_association_id VARCHAR(100),
  api_integration BOOLEAN DEFAULT FALSE,
  last_sync_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cle_providers_type ON cle_providers(provider_type);
CREATE INDEX idx_cle_providers_approval ON cle_providers(approval_number);

-- ============================================
-- CLE CREDITS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cle_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES cle_providers(id),
  course_name VARCHAR(255) NOT NULL,
  course_description TEXT,
  credit_type VARCHAR(50) NOT NULL,
  -- Types: Ethics, Mandatory, General
  hours_earned DECIMAL(5, 2) NOT NULL,
  state VARCHAR(2) NOT NULL,
  -- State code (CA, TX, NY, etc.)
  credential_accepted BOOLEAN DEFAULT TRUE,
  completion_date DATE NOT NULL,
  certificate_url TEXT,
  bar_reference_number VARCHAR(100),
  synced_with_bar BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_hours CHECK (hours_earned > 0 AND hours_earned <= 50),
  CONSTRAINT valid_state CHECK (state ~ '^[A-Z]{2}$')
);

CREATE INDEX idx_cle_credits_attorney ON cle_credits(attorney_id);
CREATE INDEX idx_cle_credits_state_year ON cle_credits(state, EXTRACT(YEAR FROM completion_date));
CREATE INDEX idx_cle_credits_synced ON cle_credits(synced_with_bar);
CREATE INDEX idx_cle_credits_bar_ref ON cle_credits(bar_reference_number);

-- ============================================
-- CLE COMPLIANCE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cle_compliance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state VARCHAR(2) NOT NULL,
  year INTEGER NOT NULL,
  total_hours DECIMAL(5, 2) NOT NULL DEFAULT 0,
  ethics_hours DECIMAL(5, 2) NOT NULL DEFAULT 0,
  mandatory_hours DECIMAL(5, 2) NOT NULL DEFAULT 0,
  general_hours DECIMAL(5, 2) NOT NULL DEFAULT 0,
  carryover_hours DECIMAL(5, 2) NOT NULL DEFAULT 0,
  deficit_hours DECIMAL(5, 2) NOT NULL DEFAULT 0,
  is_compliant BOOLEAN DEFAULT FALSE,
  last_audit_date TIMESTAMP DEFAULT NOW(),
  audit_status VARCHAR(50) DEFAULT 'pending',
  -- pending, approved, rejected
  audit_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(attorney_id, state, year),
  CONSTRAINT valid_hours_check CHECK (total_hours >= 0)
);

CREATE INDEX idx_cle_compliance_attorney_state_year ON cle_compliance(attorney_id, state, year);
CREATE INDEX idx_cle_compliance_status ON cle_compliance(is_compliant);
CREATE INDEX idx_cle_compliance_audit ON cle_compliance(audit_status);

-- ============================================
-- CLE DEADLINES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cle_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state VARCHAR(2) NOT NULL,
  reporting_deadline DATE NOT NULL,
  earning_deadline DATE NOT NULL,
  required_hours DECIMAL(5, 2) NOT NULL,
  alarm_at_30_days BOOLEAN DEFAULT FALSE,
  alarm_at_60_days BOOLEAN DEFAULT FALSE,
  alarm_at_90_days BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'upcoming',
  -- upcoming, warning, critical, met, overdue
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(attorney_id, state, reporting_deadline),
  CONSTRAINT valid_deadline_dates CHECK (earning_deadline < reporting_deadline)
);

CREATE INDEX idx_cle_deadlines_attorney ON cle_deadlines(attorney_id);
CREATE INDEX idx_cle_deadlines_status ON cle_deadlines(status);
CREATE INDEX idx_cle_deadlines_upcoming ON cle_deadlines(reporting_deadline)
  WHERE status IN ('upcoming', 'warning', 'critical');

-- ============================================
-- CLE AUDIT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cle_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  -- credit_recorded, synced, compliance_updated, audit_completed, etc.
  credit_id UUID REFERENCES cle_credits(id),
  compliance_id UUID REFERENCES cle_compliance(id),
  changes JSONB,
  user_id UUID REFERENCES users(id),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cle_audit_attorney ON cle_audit_log(attorney_id);
CREATE INDEX idx_cle_audit_action ON cle_audit_log(action);
CREATE INDEX idx_cle_audit_date ON cle_audit_log(created_at);

-- ============================================
-- CLE EXPORT REPORTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cle_export_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state VARCHAR(2) NOT NULL,
  report_year INTEGER NOT NULL,
  total_credits DECIMAL(5, 2) NOT NULL,
  credit_breakdown JSONB,
  -- { ethics: X, mandatory: Y, general: Z }
  compliant BOOLEAN NOT NULL,
  file_format VARCHAR(20) NOT NULL,
  -- pdf, csv, json
  file_url TEXT,
  generated_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 year'
);

CREATE INDEX idx_cle_exports_attorney ON cle_export_reports(attorney_id);
CREATE INDEX idx_cle_exports_state_year ON cle_export_reports(state, report_year);
CREATE INDEX idx_cle_exports_compliant ON cle_export_reports(compliant);

-- ============================================
-- CLE STATE REQUIREMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS cle_state_requirements (
  state_code VARCHAR(2) PRIMARY KEY,
  state_name VARCHAR(100) NOT NULL,
  annual_hours DECIMAL(5, 2) NOT NULL,
  ethics_hours DECIMAL(5, 2) NOT NULL,
  mandatory_hours JSONB,
  -- { "Ethics": 1, "Professionalism": 1, etc. }
  reporting_deadline DATE NOT NULL,
  carryover_hours DECIMAL(5, 2) DEFAULT 0,
  carryover_years INTEGER DEFAULT 0,
  bar_association_id VARCHAR(100),
  bar_association_api VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert state requirements
INSERT INTO cle_state_requirements (state_code, state_name, annual_hours, ethics_hours, mandatory_hours, reporting_deadline, carryover_hours, carryover_years, bar_association_id, bar_association_api)
VALUES
  ('CA', 'California', 25, 1, '{"Elimination of Bias": 1}'::JSONB, '2024-12-31', 5, 3, 'state-bar-of-california', 'https://api.calbar.ca.gov/cle'),
  ('TX', 'Texas', 15, 1, '{"Professional": 1}'::JSONB, '2024-06-30', 0, 0, 'texas-bar', 'https://api.texasbar.com/cle'),
  ('NY', 'New York', 24, 4, '{"Legal Ethics": 2, "Professionalism": 1}'::JSONB, '2024-05-15', 6, 3, 'new-york-bar', 'https://api.nycourts.gov/cle'),
  ('FL', 'Florida', 33, 3, '{"Ethics": 3, "Professionalism": 1}'::JSONB, '2024-01-31', 0, 0, 'florida-bar', 'https://api.floridabar.org/cle'),
  ('IL', 'Illinois', 30, 2, '{"Legal Ethics": 1, "Diversity": 1}'::JSONB, '2024-12-31', 10, 1, 'illinois-bar', 'https://api.isba.org/cle'),
  ('PA', 'Pennsylvania', 12, 2, '{"Legal Ethics": 2}'::JSONB, '2024-12-31', 0, 0, 'pennsylvania-bar', 'https://api.pabar.org/cle'),
  ('OH', 'Ohio', 24, 1, '{"Professionalism": 1}'::JSONB, '2024-01-15', 0, 0, 'ohio-bar', 'https://api.ohiobar.org/cle'),
  ('GA', 'Georgia', 12, 1, '{"Ethics": 1}'::JSONB, '2024-12-31', 0, 0, 'georgia-bar', 'https://api.gabar.org/cle'),
  ('NC', 'North Carolina', 12, 1, '{"Ethics": 1}'::JSONB, '2024-06-30', 0, 0, 'north-carolina-bar', 'https://api.ncbar.org/cle'),
  ('MI', 'Michigan', 18, 1, '{"Professionalism": 1}'::JSONB, '2024-09-30', 0, 0, 'michigan-bar', 'https://api.michbar.org/cle')
ON CONFLICT DO NOTHING;

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Attorney Compliance Summary
CREATE OR REPLACE VIEW vw_attorney_cle_summary AS
SELECT
  c.attorney_id,
  c.state,
  c.year,
  c.total_hours,
  c.ethics_hours,
  c.mandatory_hours,
  c.general_hours,
  c.is_compliant,
  d.reporting_deadline,
  EXTRACT(DAY FROM (d.reporting_deadline - NOW())) as days_until_deadline,
  d.status as deadline_status
FROM cle_compliance c
LEFT JOIN cle_deadlines d ON c.attorney_id = d.attorney_id
  AND c.state = d.state
  AND EXTRACT(YEAR FROM d.reporting_deadline) = c.year;

-- View: Credits by Attorney and State
CREATE OR REPLACE VIEW vw_cle_credits_summary AS
SELECT
  attorney_id,
  state,
  EXTRACT(YEAR FROM completion_date) as year,
  COUNT(*) as total_credits,
  SUM(hours_earned) as total_hours,
  SUM(CASE WHEN credit_type = 'Ethics' THEN hours_earned ELSE 0 END) as ethics_hours,
  SUM(CASE WHEN credit_type = 'Mandatory' THEN hours_earned ELSE 0 END) as mandatory_hours,
  SUM(CASE WHEN credit_type = 'General' THEN hours_earned ELSE 0 END) as general_hours,
  SUM(CASE WHEN synced_with_bar THEN 1 ELSE 0 END) as synced_credits
FROM cle_credits
GROUP BY attorney_id, state, EXTRACT(YEAR FROM completion_date);

-- View: Attorneys with Upcoming Deadlines
CREATE OR REPLACE VIEW vw_upcoming_cle_deadlines AS
SELECT
  d.attorney_id,
  d.state,
  d.reporting_deadline,
  EXTRACT(DAY FROM (d.reporting_deadline - NOW())) as days_remaining,
  d.status,
  c.total_hours,
  c.total_hours + c.deficit_hours as required_hours
FROM cle_deadlines d
LEFT JOIN cle_compliance c ON d.attorney_id = c.attorney_id
  AND d.state = c.state
  AND EXTRACT(YEAR FROM d.reporting_deadline) = c.year
WHERE d.reporting_deadline > NOW()
ORDER BY d.reporting_deadline ASC;

-- ============================================
-- FUNCTIONS FOR CLE OPERATIONS
-- ============================================

-- Function: Calculate compliance status
CREATE OR REPLACE FUNCTION calculate_cle_compliance(
  p_attorney_id UUID,
  p_state VARCHAR(2),
  p_year INTEGER
)
RETURNS TABLE (
  total_hours DECIMAL,
  ethics_hours DECIMAL,
  mandatory_hours DECIMAL,
  general_hours DECIMAL,
  is_compliant BOOLEAN,
  deficit_hours DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    SUM(cc.hours_earned)::DECIMAL as total_hours,
    SUM(CASE WHEN cc.credit_type = 'Ethics' THEN cc.hours_earned ELSE 0 END)::DECIMAL as ethics_hours,
    SUM(CASE WHEN cc.credit_type = 'Mandatory' THEN cc.hours_earned ELSE 0 END)::DECIMAL as mandatory_hours,
    SUM(CASE WHEN cc.credit_type = 'General' THEN cc.hours_earned ELSE 0 END)::DECIMAL as general_hours,
    (SUM(cc.hours_earned) >= sr.annual_hours)::BOOLEAN as is_compliant,
    GREATEST(0, sr.annual_hours - SUM(cc.hours_earned))::DECIMAL as deficit_hours
  FROM cle_credits cc
  FULL OUTER JOIN cle_state_requirements sr ON sr.state_code = p_state
  WHERE cc.attorney_id = p_attorney_id
    AND cc.state = p_state
    AND EXTRACT(YEAR FROM cc.completion_date) = p_year
  GROUP BY sr.annual_hours;
END;
$$ LANGUAGE plpgsql;

-- Function: Get deadline status
CREATE OR REPLACE FUNCTION get_deadline_status(p_reporting_deadline DATE)
RETURNS VARCHAR AS $$
DECLARE
  v_days_until INTEGER;
BEGIN
  v_days_until := EXTRACT(DAY FROM (p_reporting_deadline - NOW()));

  IF v_days_until < 0 THEN
    RETURN 'overdue';
  ELSIF v_days_until <= 30 THEN
    RETURN 'critical';
  ELSIF v_days_until <= 60 THEN
    RETURN 'warning';
  ELSE
    RETURN 'upcoming';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS FOR AUDIT LOGGING
-- ============================================

CREATE OR REPLACE FUNCTION log_cle_credit_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO cle_audit_log (
    attorney_id,
    action,
    credit_id,
    changes,
    description
  ) VALUES (
    NEW.attorney_id,
    CASE WHEN TG_OP = 'INSERT' THEN 'credit_recorded'
         WHEN TG_OP = 'UPDATE' THEN 'credit_updated'
         WHEN TG_OP = 'DELETE' THEN 'credit_deleted'
    END,
    NEW.id,
    row_to_json(NEW),
    'CLE credit ' || CASE WHEN TG_OP = 'INSERT' THEN 'recorded'
                         WHEN TG_OP = 'UPDATE' THEN 'updated'
                         WHEN TG_OP = 'DELETE' THEN 'deleted'
                    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_cle_credit_change
AFTER INSERT OR UPDATE OR DELETE ON cle_credits
FOR EACH ROW EXECUTE FUNCTION log_cle_credit_change();

-- ============================================
-- SAMPLE DATA FOR TESTING
-- ============================================

-- Insert sample CLE providers
INSERT INTO cle_providers (provider_name, provider_type, states_approved, approval_number, api_integration)
VALUES
  ('State Bar of California CLE Program', 'bar-association', '["CA"]'::JSONB, 'SBCA-001', TRUE),
  ('Stanford Law School Continuing Education', 'university', '["CA", "TX", "NY"]'::JSONB, 'STANFORD-CLE', FALSE),
  ('LawPoint CLE Platform', 'online-platform', '["CA", "TX", "NY", "FL", "IL"]'::JSONB, 'LAWPOINT-API', TRUE),
  ('Texas Bar Association', 'bar-association', '["TX"]'::JSONB, 'TEXAS-BAR-001', TRUE),
  ('New York Legal Education Board', 'bar-association', '["NY"]'::JSONB, 'NY-LEB-001', TRUE)
ON CONFLICT DO NOTHING;
