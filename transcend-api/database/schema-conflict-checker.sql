-- Conflict of Interest Checker Database Schema
-- Features: Attorney conflict detection, opposing counsel tracking, prior representations,
-- family connections, disqualifying relationships, and appeal management

-- ============================================
-- OPPOSING COUNSEL TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS opposing_counsel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opposing_attorney_id UUID REFERENCES users(id) ON DELETE SET NULL,
  case_id VARCHAR(255) NOT NULL,
  case_name VARCHAR(500) NOT NULL,
  matter_type VARCHAR(100),
  -- civil, criminal, family, bankruptcy, etc.
  court_jurisdiction VARCHAR(100),
  case_number VARCHAR(50),
  start_date DATE NOT NULL,
  end_date DATE,
  status VARCHAR(50) DEFAULT 'active',
  -- active, closed, settled, dismissed
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_opposing_counsel_attorney ON opposing_counsel(attorney_id);
CREATE INDEX idx_opposing_counsel_opposing ON opposing_counsel(opposing_attorney_id);
CREATE INDEX idx_opposing_counsel_case ON opposing_counsel(case_id);
CREATE INDEX idx_opposing_counsel_status ON opposing_counsel(status);

-- ============================================
-- PRIOR REPRESENTATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS prior_representations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES users(id) ON DELETE SET NULL,
  client_name VARCHAR(500),
  case_type VARCHAR(100) NOT NULL,
  -- personal injury, corporate, employment, etc.
  case_description TEXT,
  case_outcome VARCHAR(100),
  -- won, lost, settled, dismissed
  representation_start DATE NOT NULL,
  representation_end DATE,
  conflict_potential BOOLEAN DEFAULT FALSE,
  -- Flag if this prior representation could create conflicts
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_prior_representations_attorney ON prior_representations(attorney_id);
CREATE INDEX idx_prior_representations_client ON prior_representations(client_id);
CREATE INDEX idx_prior_representations_conflict ON prior_representations(conflict_potential);

-- ============================================
-- FAMILY CONNECTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS family_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  related_person_id UUID REFERENCES users(id) ON DELETE SET NULL,
  related_person_name VARCHAR(500),
  relationship_type VARCHAR(100) NOT NULL,
  -- spouse, parent, child, sibling, parent-in-law, etc.
  relationship_status VARCHAR(50) DEFAULT 'current',
  -- current, former, estranged
  potential_conflict BOOLEAN DEFAULT FALSE,
  notes TEXT,
  verified_at TIMESTAMP,
  verified_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_family_connections_attorney ON family_connections(attorney_id);
CREATE INDEX idx_family_connections_related ON family_connections(related_person_id);
CREATE INDEX idx_family_connections_conflict ON family_connections(potential_conflict);

-- ============================================
-- DISQUALIFYING RELATIONSHIPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS disqualifying_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  disqualified_from_id UUID REFERENCES users(id) ON DELETE SET NULL,
  disqualified_from_name VARCHAR(500),
  relationship_type VARCHAR(100) NOT NULL,
  -- former-client, adverse-party, opposing-counsel, business-associate, etc.
  reason_code VARCHAR(100) NOT NULL,
  -- attorney-client, adverse-representation, material-witness, financial-interest
  description TEXT,
  severity VARCHAR(50) DEFAULT 'standard',
  -- standard, elevated, critical
  expiration_date DATE,
  -- Null = indefinite
  status VARCHAR(50) DEFAULT 'active',
  -- active, inactive, appealed, expired
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_severity CHECK (severity IN ('standard', 'elevated', 'critical'))
);

CREATE INDEX idx_disqualifying_relationships_attorney ON disqualifying_relationships(attorney_id);
CREATE INDEX idx_disqualifying_relationships_disqualified ON disqualifying_relationships(disqualified_from_id);
CREATE INDEX idx_disqualifying_relationships_status ON disqualifying_relationships(status);
CREATE INDEX idx_disqualifying_relationships_expiration ON disqualifying_relationships(expiration_date);

-- ============================================
-- CONFLICT CHECKS TABLE (AUDIT TRAIL)
-- ============================================
CREATE TABLE IF NOT EXISTS conflict_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES users(id) ON DELETE SET NULL,
  check_type VARCHAR(100) NOT NULL,
  -- opposing-counsel, prior-representation, family, disqualifying
  conflict_found BOOLEAN NOT NULL,
  conflict_severity VARCHAR(50),
  -- none, low, medium, high, critical
  conflicts_identified JSONB,
  -- Array of specific conflicts detected
  check_status VARCHAR(50) DEFAULT 'completed',
  -- completed, under-review, appealed, resolved
  requested_by UUID REFERENCES users(id),
  checked_at TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_conflict_checks_attorney ON conflict_checks(attorney_id);
CREATE INDEX idx_conflict_checks_client ON conflict_checks(client_id);
CREATE INDEX idx_conflict_checks_conflict_found ON conflict_checks(conflict_found);
CREATE INDEX idx_conflict_checks_status ON conflict_checks(check_status);
CREATE INDEX idx_conflict_checks_checked_at ON conflict_checks(checked_at);

-- ============================================
-- CONFLICT MATCHES (ATTORNEY-CLIENT BLOCKS)
-- ============================================
CREATE TABLE IF NOT EXISTS conflict_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conflict_check_id UUID NOT NULL REFERENCES conflict_checks(id) ON DELETE CASCADE,
  match_type VARCHAR(100) NOT NULL,
  -- blocked, flagged-for-review, pending-appeal
  conflict_details JSONB,
  block_reason TEXT,
  blocked_at TIMESTAMP DEFAULT NOW(),
  blocks_until DATE,
  -- Optional expiration
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(attorney_id, client_id)
);

CREATE INDEX idx_conflict_matches_attorney ON conflict_matches(attorney_id);
CREATE INDEX idx_conflict_matches_client ON conflict_matches(client_id);
CREATE INDEX idx_conflict_matches_type ON conflict_matches(match_type);

-- ============================================
-- CONFLICT APPEALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS conflict_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conflict_match_id UUID NOT NULL REFERENCES conflict_matches(id) ON DELETE CASCADE,
  attorney_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appeal_status VARCHAR(50) DEFAULT 'pending',
  -- pending, under-review, approved, denied, withdrawn
  appeal_reason TEXT NOT NULL,
  supporting_documents JSONB,
  -- Array of document URLs
  submitted_by UUID NOT NULL REFERENCES users(id),
  submitted_at TIMESTAMP DEFAULT NOW(),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  decision TEXT,
  decision_rationale TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_conflict_appeals_match ON conflict_appeals(conflict_match_id);
CREATE INDEX idx_conflict_appeals_attorney ON conflict_appeals(attorney_id);
CREATE INDEX idx_conflict_appeals_status ON conflict_appeals(appeal_status);
CREATE INDEX idx_conflict_appeals_submitted ON conflict_appeals(submitted_at);

-- ============================================
-- CONFLICT DATABASE MAINTENANCE
-- ============================================
CREATE TABLE IF NOT EXISTS conflict_database_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_type VARCHAR(100) NOT NULL,
  -- import, sync, manual-entry, bulk-upload
  source VARCHAR(255),
  record_count INTEGER,
  records_added INTEGER,
  records_updated INTEGER,
  records_deleted INTEGER,
  errors JSONB,
  updated_by UUID REFERENCES users(id),
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_conflict_db_updates_type ON conflict_database_updates(update_type);
CREATE INDEX idx_conflict_db_updates_completed ON conflict_database_updates(completed_at);

-- ============================================
-- CONFLICT VIEWS
-- ============================================

-- View: Active Conflicts for Attorney
CREATE OR REPLACE VIEW vw_active_conflicts AS
SELECT
  attorney_id,
  COUNT(DISTINCT disqualified_from_id) as total_conflicts,
  COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_conflicts,
  COUNT(CASE WHEN severity = 'elevated' THEN 1 END) as elevated_conflicts,
  COUNT(CASE WHEN expiration_date IS NULL THEN 1 END) as indefinite_conflicts,
  COUNT(CASE WHEN expiration_date > NOW() THEN 1 END) as active_with_expiration
FROM disqualifying_relationships
WHERE status = 'active'
GROUP BY attorney_id;

-- View: Blocked Attorney-Client Pairs
CREATE OR REPLACE VIEW vw_blocked_matches AS
SELECT
  cm.attorney_id,
  cm.client_id,
  cm.match_type,
  cm.block_reason,
  cm.blocked_at,
  cm.blocks_until,
  cc.conflict_severity,
  cc.conflicts_identified,
  COUNT(ca.id) FILTER (WHERE ca.appeal_status IN ('pending', 'under-review')) as pending_appeals
FROM conflict_matches cm
LEFT JOIN conflict_checks cc ON cm.conflict_check_id = cc.id
LEFT JOIN conflict_appeals ca ON cm.id = ca.conflict_match_id
WHERE cm.match_type IN ('blocked', 'flagged-for-review')
GROUP BY cm.id, cc.id, cm.attorney_id, cm.client_id, cm.match_type,
         cm.block_reason, cm.blocked_at, cm.blocks_until, cc.conflict_severity, cc.conflicts_identified;

-- View: Pending Conflict Appeals
CREATE OR REPLACE VIEW vw_pending_appeals AS
SELECT
  ca.id,
  ca.conflict_match_id,
  ca.attorney_id,
  cm.client_id,
  ca.appeal_status,
  ca.submitted_at,
  EXTRACT(DAY FROM (NOW() - ca.submitted_at)) as days_pending,
  ca.appeal_reason,
  cc.conflict_severity
FROM conflict_appeals ca
JOIN conflict_matches cm ON ca.conflict_match_id = cm.id
LEFT JOIN conflict_checks cc ON cm.conflict_check_id = cc.id
WHERE ca.appeal_status IN ('pending', 'under-review')
ORDER BY ca.submitted_at ASC;

-- ============================================
-- CONFLICT FUNCTIONS
-- ============================================

-- Function: Check Attorney Conflicts
CREATE OR REPLACE FUNCTION check_attorney_conflicts(
  p_attorney_id UUID,
  p_client_id UUID
)
RETURNS TABLE (
  conflict_found BOOLEAN,
  conflict_severity VARCHAR,
  conflicts_detected JSONB
) AS $$
DECLARE
  v_conflicts JSONB := '[]'::JSONB;
  v_conflict_found BOOLEAN := FALSE;
  v_conflict_severity VARCHAR := 'none';
BEGIN
  -- Check opposing counsel
  IF EXISTS (
    SELECT 1 FROM opposing_counsel
    WHERE (attorney_id = p_attorney_id OR opposing_attorney_id = p_attorney_id)
    AND status = 'active'
    AND (
      SELECT COUNT(*) FROM opposing_counsel
      WHERE attorney_id = p_attorney_id
      AND opposing_attorney_id = (SELECT id FROM users WHERE id = p_client_id)
    ) > 0
  ) THEN
    v_conflicts := v_conflicts || '{"type": "opposing_counsel", "severity": "high"}'::JSONB;
    v_conflict_found := TRUE;
    v_conflict_severity := 'high';
  END IF;

  -- Check prior representations
  IF EXISTS (
    SELECT 1 FROM prior_representations
    WHERE attorney_id = p_attorney_id
    AND conflict_potential = TRUE
    AND representation_end > (NOW() - INTERVAL '7 years')
  ) THEN
    v_conflicts := v_conflicts || '{"type": "prior_representation", "severity": "medium"}'::JSONB;
    v_conflict_found := TRUE;
    IF v_conflict_severity = 'none' THEN
      v_conflict_severity := 'medium';
    END IF;
  END IF;

  -- Check disqualifying relationships
  IF EXISTS (
    SELECT 1 FROM disqualifying_relationships
    WHERE attorney_id = p_attorney_id
    AND disqualified_from_id = p_client_id
    AND status = 'active'
    AND (expiration_date IS NULL OR expiration_date > NOW())
  ) THEN
    v_conflicts := v_conflicts || '{"type": "disqualifying_relationship", "severity": "critical"}'::JSONB;
    v_conflict_found := TRUE;
    v_conflict_severity := 'critical';
  END IF;

  -- Check family connections
  IF EXISTS (
    SELECT 1 FROM family_connections
    WHERE (attorney_id = p_attorney_id OR related_person_id = p_attorney_id)
    AND potential_conflict = TRUE
    AND relationship_status IN ('current', 'former')
  ) THEN
    v_conflicts := v_conflicts || '{"type": "family_connection", "severity": "medium"}'::JSONB;
    v_conflict_found := TRUE;
    IF v_conflict_severity IN ('none', 'low') THEN
      v_conflict_severity := 'medium';
    END IF;
  END IF;

  RETURN QUERY SELECT v_conflict_found, v_conflict_severity, v_conflicts;
END;
$$ LANGUAGE plpgsql;

-- Function: Record Conflict Check
CREATE OR REPLACE FUNCTION record_conflict_check(
  p_attorney_id UUID,
  p_client_id UUID,
  p_check_type VARCHAR,
  p_conflict_found BOOLEAN,
  p_severity VARCHAR,
  p_conflicts JSONB,
  p_requested_by UUID
)
RETURNS UUID AS $$
DECLARE
  v_check_id UUID;
BEGIN
  INSERT INTO conflict_checks (
    attorney_id,
    client_id,
    check_type,
    conflict_found,
    conflict_severity,
    conflicts_identified,
    requested_by,
    check_status
  ) VALUES (
    p_attorney_id,
    p_client_id,
    p_check_type,
    p_conflict_found,
    p_severity,
    p_conflicts,
    p_requested_by,
    'completed'
  )
  RETURNING id INTO v_check_id;

  -- If conflict found, create match record
  IF p_conflict_found THEN
    INSERT INTO conflict_matches (
      attorney_id,
      client_id,
      conflict_check_id,
      match_type,
      conflict_details,
      block_reason
    ) VALUES (
      p_attorney_id,
      p_client_id,
      v_check_id,
      'blocked',
      p_conflicts,
      'Conflict detected: ' || p_severity
    )
    ON CONFLICT (attorney_id, client_id) DO UPDATE
    SET
      conflict_check_id = v_check_id,
      conflict_details = p_conflicts,
      updated_at = NOW();
  END IF;

  RETURN v_check_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Get Conflict Summary
CREATE OR REPLACE FUNCTION get_conflict_summary(p_attorney_id UUID)
RETURNS TABLE (
  total_conflicts INTEGER,
  active_conflicts INTEGER,
  critical_conflicts INTEGER,
  blocked_matches INTEGER,
  pending_appeals INTEGER,
  last_check TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT dr.id)::INTEGER as total_conflicts,
    COUNT(DISTINCT CASE WHEN dr.status = 'active' THEN dr.id END)::INTEGER as active_conflicts,
    COUNT(DISTINCT CASE WHEN dr.severity = 'critical' AND dr.status = 'active' THEN dr.id END)::INTEGER as critical_conflicts,
    COUNT(DISTINCT cm.id)::INTEGER as blocked_matches,
    COUNT(DISTINCT CASE WHEN ca.appeal_status IN ('pending', 'under-review') THEN ca.id END)::INTEGER as pending_appeals,
    MAX(cc.checked_at) as last_check
  FROM disqualifying_relationships dr
  FULL OUTER JOIN conflict_matches cm ON dr.attorney_id = cm.attorney_id
  FULL OUTER JOIN conflict_appeals ca ON cm.id = ca.conflict_match_id
  FULL OUTER JOIN conflict_checks cc ON cm.conflict_check_id = cc.id
  WHERE dr.attorney_id = p_attorney_id OR cm.attorney_id = p_attorney_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS FOR CONFLICT LOGGING
-- ============================================

CREATE OR REPLACE FUNCTION log_conflict_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO conflict_checks (
    attorney_id,
    client_id,
    check_type,
    conflict_found,
    check_status,
    notes
  ) VALUES (
    NEW.attorney_id,
    NEW.client_id,
    'conflict_relationship_change',
    TRUE,
    'completed',
    'Automatic check triggered by relationship change: ' || TG_TABLE_NAME
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_opposing_counsel_change
AFTER INSERT OR UPDATE OR DELETE ON opposing_counsel
FOR EACH ROW EXECUTE FUNCTION log_conflict_change();

CREATE TRIGGER trigger_log_family_connection_change
AFTER INSERT OR UPDATE OR DELETE ON family_connections
FOR EACH ROW EXECUTE FUNCTION log_conflict_change();

-- ============================================
-- SAMPLE DATA FOR TESTING
-- ============================================

-- Insert sample opposing counsel records
INSERT INTO opposing_counsel (
  attorney_id,
  opposing_attorney_id,
  case_id,
  case_name,
  matter_type,
  court_jurisdiction,
  case_number,
  start_date,
  status
) SELECT
  (SELECT id FROM users WHERE role = 'attorney' LIMIT 1),
  (SELECT id FROM users WHERE role = 'attorney' OFFSET 1 LIMIT 1),
  'CASE-2024-001',
  'Smith v. Johnson',
  'civil',
  'Superior Court - California',
  '2024-12345',
  CURRENT_DATE - INTERVAL '6 months',
  'active'
ON CONFLICT DO NOTHING;

-- Insert sample disqualifying relationships
INSERT INTO disqualifying_relationships (
  attorney_id,
  disqualified_from_name,
  relationship_type,
  reason_code,
  description,
  severity,
  status
) SELECT
  (SELECT id FROM users WHERE role = 'attorney' LIMIT 1),
  'Former Client - Tech Corp LLC',
  'former-client',
  'attorney-client',
  'Former client in corporate matter; still maintaining confidential information',
  'critical',
  'active'
ON CONFLICT DO NOTHING;
