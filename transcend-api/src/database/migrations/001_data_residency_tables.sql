-- Data Residency Tables
-- Supports GDPR/CCPA/PIPEDA regional compliance

-- User residency configuration
CREATE TABLE IF NOT EXISTS user_residency (
  id SERIAL PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  region VARCHAR(20) NOT NULL CHECK (region IN ('us-east-1', 'eu-west-1', 'uk-west-2', 'ca-central-1')),
  compliance_framework VARCHAR(50) NOT NULL,
  data_retention_days INTEGER NOT NULL,
  encryption_key_region VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'migrating', 'archived')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_region (region),
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
);

-- User encryption keys per region
CREATE TABLE IF NOT EXISTS user_encryption_keys (
  id SERIAL PRIMARY KEY,
  key_id VARCHAR(100) UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  region VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'rotated', 'archived')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rotated_at TIMESTAMP,
  INDEX idx_user_region (user_id, region),
  INDEX idx_status (status)
);

-- Data transfer requests
CREATE TABLE IF NOT EXISTS data_transfer_requests (
  id SERIAL PRIMARY KEY,
  request_id VARCHAR(100) UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_region VARCHAR(20) NOT NULL,
  to_region VARCHAR(20) NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'in-progress', 'completed', 'rejected')),
  approved_by VARCHAR(255),
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_requested_at (requested_at)
);

-- Compliance reports
CREATE TABLE IF NOT EXISTS compliance_reports (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  region VARCHAR(20) NOT NULL,
  report_data JSONB NOT NULL,
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_region (region),
  INDEX idx_generated_at (generated_at)
);

-- User data metadata for volume tracking
CREATE TABLE IF NOT EXISTS user_data_metadata (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  region VARCHAR(20) NOT NULL,
  data_size BIGINT DEFAULT 0,
  record_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_region (region),
  INDEX idx_user_region (user_id, region)
);

-- Regional access log (for monitoring cross-region access attempts)
CREATE TABLE IF NOT EXISTS regional_access_log (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resource_type VARCHAR(50),
  resource_id VARCHAR(100),
  user_region VARCHAR(20) NOT NULL,
  request_region VARCHAR(20) NOT NULL,
  ip_address INET,
  allowed BOOLEAN DEFAULT FALSE,
  access_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_allowed (allowed),
  INDEX idx_access_at (access_at)
);

-- Data transfer log (audit trail)
CREATE TABLE IF NOT EXISTS data_transfer_log (
  id SERIAL PRIMARY KEY,
  transfer_request_id VARCHAR(100),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_region VARCHAR(20) NOT NULL,
  to_region VARCHAR(20) NOT NULL,
  records_transferred INTEGER DEFAULT 0,
  data_size_bytes BIGINT DEFAULT 0,
  status VARCHAR(20),
  initiated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_completed_at (completed_at)
);

-- Encryption key rotation history
CREATE TABLE IF NOT EXISTS encryption_key_rotation (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  region VARCHAR(20) NOT NULL,
  old_key_id VARCHAR(100),
  new_key_id VARCHAR(100),
  rotation_reason VARCHAR(255),
  rotated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rotated_by VARCHAR(255),
  INDEX idx_user_region (user_id, region),
  INDEX idx_rotated_at (rotated_at)
);

-- Regional compliance audit trail
CREATE TABLE IF NOT EXISTS compliance_audit (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  region VARCHAR(20) NOT NULL,
  audit_type VARCHAR(50),
  compliance_framework VARCHAR(50),
  findings JSONB,
  status VARCHAR(20),
  audited_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_region (region),
  INDEX idx_audited_at (audited_at)
);

-- Triggers for updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_residency_timestamp
BEFORE UPDATE ON user_residency
FOR EACH ROW
EXECUTE PROCEDURE update_timestamp();

CREATE TRIGGER update_data_transfer_requests_timestamp
BEFORE UPDATE ON data_transfer_requests
FOR EACH ROW
EXECUTE PROCEDURE update_timestamp();

-- Create views for reporting
CREATE OR REPLACE VIEW residency_summary AS
SELECT
  ur.region,
  COUNT(DISTINCT ur.user_id) as active_users,
  MAX(ur.updated_at) as last_updated,
  ur.compliance_framework
FROM user_residency ur
WHERE ur.status = 'active'
GROUP BY ur.region, ur.compliance_framework;

CREATE OR REPLACE VIEW compliance_status AS
SELECT
  cr.user_id,
  cr.region,
  cr.generated_at,
  cr.report_data->>'encryptionStatus' as encryption_status,
  (cr.report_data->>'retentionCompliance')::BOOLEAN as retention_compliant,
  (cr.report_data->'findings') as findings
FROM compliance_reports cr
WHERE cr.generated_at = (
  SELECT MAX(generated_at)
  FROM compliance_reports
  WHERE user_id = cr.user_id
);
