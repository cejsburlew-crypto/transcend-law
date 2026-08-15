-- Sanctions Screening System Migration
-- OFAC/EU/UN/UK Sanctions List Screening

-- ============================================
-- SANCTIONS SCREENINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sanctions_screenings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  check_type VARCHAR(50) NOT NULL CHECK (check_type IN ('account_creation', 'payment_processing', 'manual_review')),
  status VARCHAR(50) NOT NULL CHECK (status IN ('clear', 'potential_match', 'confirmed_match', 'blocked', 'manual_review')),
  risk_score INT NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  matches_count INT NOT NULL DEFAULT 0,
  matches_data JSONB DEFAULT '[]',
  sanctions_lists JSONB DEFAULT '[]',
  auto_blocked BOOLEAN DEFAULT FALSE,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  review_notes TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_sanctions_screenings_user_id ON sanctions_screenings(user_id);
CREATE INDEX idx_sanctions_screenings_status ON sanctions_screenings(status);
CREATE INDEX idx_sanctions_screenings_check_type ON sanctions_screenings(check_type);
CREATE INDEX idx_sanctions_screenings_risk_score ON sanctions_screenings(risk_score);
CREATE INDEX idx_sanctions_screenings_auto_blocked ON sanctions_screenings(auto_blocked);
CREATE INDEX idx_sanctions_screenings_expires_at ON sanctions_screenings(expires_at);
CREATE INDEX idx_sanctions_screenings_created_at ON sanctions_screenings(created_at);

-- ============================================
-- SANCTIONS MATCHES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sanctions_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  screening_id UUID NOT NULL REFERENCES sanctions_screenings(id) ON DELETE CASCADE,
  match_type VARCHAR(50) NOT NULL CHECK (match_type IN ('individual', 'entity', 'vessel')),
  match_score DECIMAL(3,2) NOT NULL DEFAULT 0.0 CHECK (match_score >= 0 AND match_score <= 1),
  list_names JSONB NOT NULL DEFAULT '[]',
  matched_names JSONB DEFAULT '[]',
  matched_addresses JSONB DEFAULT '[]',
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sanctions_matches_screening_id ON sanctions_matches(screening_id);
CREATE INDEX idx_sanctions_matches_match_type ON sanctions_matches(match_type);
CREATE INDEX idx_sanctions_matches_match_score ON sanctions_matches(match_score);

-- ============================================
-- SANCTIONS LIST UPDATES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sanctions_list_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_name VARCHAR(255) NOT NULL UNIQUE,
  record_count INT DEFAULT 0,
  status VARCHAR(50) NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
  error_message TEXT,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  next_scheduled_update TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sanctions_list_updates_list_name ON sanctions_list_updates(list_name);
CREATE INDEX idx_sanctions_list_updates_last_updated ON sanctions_list_updates(last_updated);

-- ============================================
-- SANCTIONS AUDIT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sanctions_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL CHECK (action IN ('SCREENING_CHECK', 'MANUAL_REVIEW', 'AUTO_BLOCK', 'UNBLOCK', 'EXPORT')),
  check_type VARCHAR(50),
  status VARCHAR(50),
  risk_score INT,
  matches_count INT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sanctions_audit_log_user_id ON sanctions_audit_log(user_id);
CREATE INDEX idx_sanctions_audit_log_action ON sanctions_audit_log(action);
CREATE INDEX idx_sanctions_audit_log_created_at ON sanctions_audit_log(created_at);
CREATE INDEX idx_sanctions_audit_log_reviewed_by ON sanctions_audit_log(reviewed_by);

-- ============================================
-- BLOCKED USERS TRACKING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sanctions_blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  blocking_screening_id UUID NOT NULL REFERENCES sanctions_screenings(id) ON DELETE RESTRICT,
  reason VARCHAR(255),
  blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  unblocked_at TIMESTAMP,
  unblocked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  unblock_reason TEXT,
  appeal_submitted_at TIMESTAMP,
  appeal_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sanctions_blocked_users_user_id ON sanctions_blocked_users(user_id);
CREATE INDEX idx_sanctions_blocked_users_blocking_screening_id ON sanctions_blocked_users(blocking_screening_id);
CREATE INDEX idx_sanctions_blocked_users_blocked_at ON sanctions_blocked_users(blocked_at);
CREATE INDEX idx_sanctions_blocked_users_unblocked_at ON sanctions_blocked_users(unblocked_at);

-- ============================================
-- SANCTIONS APPEALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sanctions_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES sanctions_blocked_users(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'under_review')),
  reason TEXT NOT NULL,
  supporting_documents JSONB DEFAULT '[]',
  reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  review_notes TEXT,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sanctions_appeals_user_id ON sanctions_appeals(user_id);
CREATE INDEX idx_sanctions_appeals_status ON sanctions_appeals(status);
CREATE INDEX idx_sanctions_appeals_blocked_user_id ON sanctions_appeals(blocked_user_id);

-- ============================================
-- ADD COLUMNS TO USERS TABLE
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS sanctions_blocked BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_sanctions_screening_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_sanctions_screening_status VARCHAR(50);

CREATE INDEX idx_users_sanctions_blocked ON users(sanctions_blocked);
CREATE INDEX idx_users_last_sanctions_screening_at ON users(last_sanctions_screening_at);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_sanctions_screenings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sanctions_screenings_updated_at BEFORE UPDATE ON sanctions_screenings
  FOR EACH ROW EXECUTE FUNCTION update_sanctions_screenings_updated_at();

CREATE OR REPLACE FUNCTION update_sanctions_blocked_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sanctions_blocked_users_updated_at BEFORE UPDATE ON sanctions_blocked_users
  FOR EACH ROW EXECUTE FUNCTION update_sanctions_blocked_users_updated_at();

CREATE OR REPLACE FUNCTION update_sanctions_appeals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sanctions_appeals_updated_at BEFORE UPDATE ON sanctions_appeals
  FOR EACH ROW EXECUTE FUNCTION update_sanctions_appeals_updated_at();

-- ============================================
-- CLEANUP VIEWS FOR EXPIRED SCREENINGS
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_screenings()
RETURNS void AS $$
BEGIN
  DELETE FROM sanctions_screenings
  WHERE expires_at < CURRENT_TIMESTAMP AND status = 'clear';

  DELETE FROM sanctions_screenings
  WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days' AND status IN ('clear', 'potential_match');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SANCTIONS STATISTICS VIEW
-- ============================================
CREATE OR REPLACE VIEW sanctions_statistics AS
SELECT
  COUNT(DISTINCT user_id) as total_screened_users,
  COUNT(*) as total_screenings,
  COUNT(CASE WHEN status = 'clear' THEN 1 END) as clear_screenings,
  COUNT(CASE WHEN status = 'potential_match' THEN 1 END) as potential_match_count,
  COUNT(CASE WHEN status = 'confirmed_match' THEN 1 END) as confirmed_match_count,
  COUNT(CASE WHEN status = 'blocked' THEN 1 END) as blocked_screenings,
  COUNT(CASE WHEN status = 'manual_review' THEN 1 END) as pending_reviews,
  COUNT(CASE WHEN auto_blocked = true THEN 1 END) as auto_blocked_count,
  AVG(risk_score) as average_risk_score,
  DATE(CURRENT_TIMESTAMP) as report_date
FROM sanctions_screenings
WHERE deleted_at IS NULL;

-- ============================================
-- DAILY UPDATE SCHEDULING FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION schedule_next_sanctions_update()
RETURNS void AS $$
BEGIN
  UPDATE sanctions_list_updates
  SET next_scheduled_update = CURRENT_TIMESTAMP + INTERVAL '24 hours'
  WHERE status = 'success' AND next_scheduled_update IS NULL OR next_scheduled_update < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;
