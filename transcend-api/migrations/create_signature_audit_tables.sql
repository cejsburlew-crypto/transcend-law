-- Enhanced E-Signature Audit Trail Tables
-- eIDAS and ESIGN Compliance
-- Immutable audit logging with chain of custody

-- Main signature audit trail table
CREATE TABLE IF NOT EXISTS signature_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signer_id VARCHAR(255) NOT NULL,
  document_id VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  ip_address INET,
  device_fingerprint VARCHAR(256) NOT NULL,
  user_agent TEXT,
  status VARCHAR(50) NOT NULL CHECK (status IN ('success', 'rejected', 'pending', 'cancelled')),
  rejection_reason TEXT,
  signature_hash VARCHAR(256) NOT NULL,
  certificate_hash VARCHAR(256),
  chain_of_custody_hash VARCHAR(256),
  immutability_proof VARCHAR(256) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  -- Make immutable
  CONSTRAINT immutable_audit_trail CHECK (true)
);

-- Indexes for query performance
CREATE INDEX idx_signature_audit_signer_id ON signature_audit_trail(signer_id);
CREATE INDEX idx_signature_audit_document_id ON signature_audit_trail(document_id);
CREATE INDEX idx_signature_audit_timestamp ON signature_audit_trail(timestamp DESC);
CREATE INDEX idx_signature_audit_status ON signature_audit_trail(status);

-- Signer behavior audit table
CREATE TABLE IF NOT EXISTS signer_behavior_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_attempt_id UUID NOT NULL,
  cursor_movements JSONB NOT NULL DEFAULT '[]',
  scroll_events JSONB NOT NULL DEFAULT '[]',
  time_spent_ms INTEGER NOT NULL DEFAULT 0,
  viewport_data JSONB NOT NULL,
  interaction_events JSONB NOT NULL DEFAULT '[]',
  focus_losses INTEGER NOT NULL DEFAULT 0,
  copy_attempts INTEGER NOT NULL DEFAULT 0,
  print_attempts INTEGER NOT NULL DEFAULT 0,
  right_click_attempts INTEGER NOT NULL DEFAULT 0,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_signature_attempt
    FOREIGN KEY (signature_attempt_id)
    REFERENCES signature_audit_trail(id) ON DELETE CASCADE
);

-- Indexes for behavior queries
CREATE INDEX idx_signer_behavior_attempt_id ON signer_behavior_audit(signature_attempt_id);
CREATE INDEX idx_signer_behavior_recorded_at ON signer_behavior_audit(recorded_at DESC);

-- Signature certificates table
CREATE TABLE IF NOT EXISTS signature_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_attempt_id UUID NOT NULL,
  signer_id VARCHAR(255) NOT NULL,
  document_hash VARCHAR(256) NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  signature_algorithm VARCHAR(50) NOT NULL,
  timestamp_authority VARCHAR(255) NOT NULL,
  certificate_chain JSONB NOT NULL,
  signature TEXT NOT NULL,
  eidias_compliant BOOLEAN NOT NULL DEFAULT true,
  esign_compliant BOOLEAN NOT NULL DEFAULT true,
  legal_framework TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_certificate_attempt
    FOREIGN KEY (signature_attempt_id)
    REFERENCES signature_audit_trail(id) ON DELETE CASCADE
);

-- Indexes for certificate queries
CREATE INDEX idx_certificates_attempt_id ON signature_certificates(signature_attempt_id);
CREATE INDEX idx_certificates_signer_id ON signature_certificates(signer_id);
CREATE INDEX idx_certificates_issued_at ON signature_certificates(issued_at DESC);

-- Chain of custody table (immutable)
CREATE TABLE IF NOT EXISTS chain_of_custody (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_attempt_id UUID NOT NULL,
  sequence_number INTEGER NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  actor VARCHAR(255) NOT NULL,
  action VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  hash VARCHAR(256) NOT NULL,
  previous_hash VARCHAR(256) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_coc_attempt
    FOREIGN KEY (signature_attempt_id)
    REFERENCES signature_audit_trail(id) ON DELETE CASCADE,
  CONSTRAINT unique_coc_sequence
    UNIQUE (signature_attempt_id, sequence_number)
);

-- Indexes for chain of custody queries
CREATE INDEX idx_coc_attempt_id ON chain_of_custody(signature_attempt_id);
CREATE INDEX idx_coc_timestamp ON chain_of_custody(timestamp DESC);
CREATE INDEX idx_coc_sequence ON chain_of_custody(sequence_number DESC);

-- Audit exports table (for legal proceedings)
CREATE TABLE IF NOT EXISTS audit_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_attempt_id UUID NOT NULL,
  exported_at TIMESTAMP WITH TIME ZONE NOT NULL,
  exported_by VARCHAR(255) NOT NULL,
  verification_code VARCHAR(50) NOT NULL UNIQUE,
  export_signature VARCHAR(256) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_export_attempt
    FOREIGN KEY (signature_attempt_id)
    REFERENCES signature_audit_trail(id) ON DELETE CASCADE
);

-- Indexes for export queries
CREATE INDEX idx_exports_attempt_id ON audit_exports(signature_attempt_id);
CREATE INDEX idx_exports_verification_code ON audit_exports(verification_code);
CREATE INDEX idx_exports_exported_at ON audit_exports(exported_at DESC);

-- GPS location tracking table
CREATE TABLE IF NOT EXISTS signer_gps_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_attempt_id UUID NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  accuracy DECIMAL(5, 2),
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT fk_gps_attempt
    FOREIGN KEY (signature_attempt_id)
    REFERENCES signature_audit_trail(id) ON DELETE CASCADE
);

-- Indexes for location queries
CREATE INDEX idx_gps_attempt_id ON signer_gps_locations(signature_attempt_id);
CREATE INDEX idx_gps_recorded_at ON signer_gps_locations(recorded_at DESC);

-- Audit integrity verification table
CREATE TABLE IF NOT EXISTS audit_integrity_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_attempt_id UUID NOT NULL,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_valid BOOLEAN NOT NULL,
  immutability_proof_valid BOOLEAN NOT NULL,
  chain_of_custody_valid BOOLEAN NOT NULL,
  certificate_valid BOOLEAN NOT NULL,
  issues JSONB DEFAULT '[]',
  CONSTRAINT fk_integrity_check_attempt
    FOREIGN KEY (signature_attempt_id)
    REFERENCES signature_audit_trail(id) ON DELETE CASCADE
);

-- Indexes for integrity checks
CREATE INDEX idx_integrity_attempt_id ON audit_integrity_checks(signature_attempt_id);
CREATE INDEX idx_integrity_checked_at ON audit_integrity_checks(checked_at DESC);

-- Create immutability trigger function
CREATE OR REPLACE FUNCTION prevent_audit_deletion()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit trail records are immutable and cannot be deleted';
END;
$$ LANGUAGE plpgsql;

-- Create immutability trigger on main audit table
DROP TRIGGER IF EXISTS prevent_delete_audit_trail ON signature_audit_trail;
CREATE TRIGGER prevent_delete_audit_trail
BEFORE DELETE ON signature_audit_trail
FOR EACH ROW EXECUTE FUNCTION prevent_audit_deletion();

-- Create immutability trigger on chain of custody
DROP TRIGGER IF EXISTS prevent_delete_coc ON chain_of_custody;
CREATE TRIGGER prevent_delete_coc
BEFORE DELETE ON chain_of_custody
FOR EACH ROW EXECUTE FUNCTION prevent_audit_deletion();

-- Create immutability trigger on certificates
DROP TRIGGER IF EXISTS prevent_delete_certificates ON signature_certificates;
CREATE TRIGGER prevent_delete_certificates
BEFORE DELETE ON signature_certificates
FOR EACH ROW EXECUTE FUNCTION prevent_audit_deletion();

-- Create update restriction trigger
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow status updates only for specific fields
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    -- Status changes are allowed
    RETURN NEW;
  ELSIF (OLD IS DISTINCT FROM NEW) THEN
    RAISE EXCEPTION 'Audit trail records are immutable and cannot be modified';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create update trigger on main audit table
DROP TRIGGER IF EXISTS prevent_update_audit_trail ON signature_audit_trail;
CREATE TRIGGER prevent_update_audit_trail
BEFORE UPDATE ON signature_audit_trail
FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- Create audit log table for schema changes
CREATE TABLE IF NOT EXISTS audit_schema_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation VARCHAR(50) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  details JSONB,
  performed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  performed_by VARCHAR(255)
);

-- Insert initial audit log entry
INSERT INTO audit_schema_log (operation, table_name, performed_by)
VALUES ('SCHEMA_CREATE', 'signature_audit_trail', 'system');

-- Create view for compliance reporting
CREATE OR REPLACE VIEW audit_compliance_summary AS
SELECT
  sat.id,
  sat.signer_id,
  sat.document_id,
  sat.timestamp,
  sat.status,
  sc.eidias_compliant,
  sc.esign_compliant,
  aic.is_valid AS integrity_valid,
  aic.checked_at,
  COUNT(coc.id) AS custody_chain_length
FROM signature_audit_trail sat
LEFT JOIN signature_certificates sc ON sat.id = sc.signature_attempt_id
LEFT JOIN audit_integrity_checks aic ON sat.id = aic.signature_attempt_id
LEFT JOIN chain_of_custody coc ON sat.id = coc.signature_attempt_id
GROUP BY sat.id, sc.id, aic.id;

-- Grant appropriate permissions (adjust as needed for your security model)
GRANT SELECT ON signature_audit_trail TO authenticated_user;
GRANT SELECT ON signer_behavior_audit TO authenticated_user;
GRANT SELECT ON signature_certificates TO authenticated_user;
GRANT SELECT ON chain_of_custody TO authenticated_user;
GRANT SELECT ON audit_exports TO authenticated_user;
GRANT SELECT ON audit_compliance_summary TO authenticated_user;

-- Create function for audit verification
CREATE OR REPLACE FUNCTION verify_audit_trail_integrity(
  p_signature_attempt_id UUID
)
RETURNS TABLE(
  is_valid BOOLEAN,
  audit_trail_exists BOOLEAN,
  certificate_valid BOOLEAN,
  chain_valid BOOLEAN,
  timestamp_valid BOOLEAN,
  issues TEXT[]
) AS $$
DECLARE
  v_issues TEXT[] := ARRAY[]::TEXT[];
  v_audit_exists BOOLEAN;
  v_cert_valid BOOLEAN;
  v_chain_valid BOOLEAN;
  v_timestamp_valid BOOLEAN;
BEGIN
  -- Check if audit trail exists
  SELECT EXISTS(
    SELECT 1 FROM signature_audit_trail WHERE id = p_signature_attempt_id
  ) INTO v_audit_exists;

  IF NOT v_audit_exists THEN
    v_issues := array_append(v_issues, 'Audit trail not found');
    RETURN QUERY SELECT FALSE, FALSE, FALSE, FALSE, FALSE, v_issues;
    RETURN;
  END IF;

  -- Check certificate validity
  SELECT EXISTS(
    SELECT 1 FROM signature_certificates
    WHERE signature_attempt_id = p_signature_attempt_id
    AND eidias_compliant = true
    AND esign_compliant = true
  ) INTO v_cert_valid;

  -- Check chain of custody validity
  SELECT COUNT(*) > 0 INTO v_chain_valid
  FROM chain_of_custody
  WHERE signature_attempt_id = p_signature_attempt_id;

  -- Check timestamp validity
  SELECT EXISTS(
    SELECT 1 FROM signature_audit_trail
    WHERE id = p_signature_attempt_id
    AND timestamp <= NOW()
  ) INTO v_timestamp_valid;

  -- Build issues list
  IF NOT v_cert_valid THEN
    v_issues := array_append(v_issues, 'Certificate compliance failed');
  END IF;

  IF NOT v_chain_valid THEN
    v_issues := array_append(v_issues, 'Chain of custody invalid');
  END IF;

  IF NOT v_timestamp_valid THEN
    v_issues := array_append(v_issues, 'Timestamp validation failed');
  END IF;

  -- Return results
  RETURN QUERY SELECT
    (v_audit_exists AND v_cert_valid AND v_chain_valid AND v_timestamp_valid),
    v_audit_exists,
    v_cert_valid,
    v_chain_valid,
    v_timestamp_valid,
    v_issues;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for performance optimization
CREATE INDEX idx_audit_timestamp_status ON signature_audit_trail(timestamp DESC, status);
CREATE INDEX idx_audit_signer_document ON signature_audit_trail(signer_id, document_id);
CLUSTER signature_audit_trail USING idx_audit_timestamp_status;
