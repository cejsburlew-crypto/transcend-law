-- KYC (Know Your Customer) Database Schema
-- Progressive verification system with 6 stages
-- FinCEN AML/KYC Compliance

-- ============================================
-- USERS TABLE UPDATES (add KYC columns)
-- ============================================
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_completed BOOLEAN DEFAULT FALSE;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_completed_at TIMESTAMP;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMP;

-- ============================================
-- KYC VERIFICATION TABLE (Main verification records)
-- ============================================
CREATE TABLE IF NOT EXISTS kyc_verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage VARCHAR(50) NOT NULL CHECK (stage IN (
    'email',
    'phone',
    'government_id',
    'address_verification',
    'bank_account',
    'video_call'
  )),

  -- Verification method specific fields
  email VARCHAR(255),
  phone_number VARCHAR(20),
  otp VARCHAR(6), -- SMS OTP for phone verification
  id_type VARCHAR(50) CHECK (id_type IN ('driver_license', 'passport')),
  document_url TEXT, -- S3/storage URL for uploaded documents
  address TEXT,
  bank_token TEXT, -- Plaid or similar token

  -- Status and tracking
  status VARCHAR(50) NOT NULL CHECK (status IN (
    'pending',
    'pending_review',
    'pending_verification',
    'scheduled',
    'verified',
    'rejected',
    'expired'
  )),
  token VARCHAR(255) UNIQUE, -- For email/document verification links

  -- Timing and expiration
  expires_at TIMESTAMP NOT NULL,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Retry tracking
  attempt_number INT DEFAULT 1 CHECK (attempt_number > 0 AND attempt_number <= 3),

  -- Admin review
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  notes TEXT,

  -- Indexing for queries
  CONSTRAINT kyc_stage_expires ON (stage, expires_at),
  CONSTRAINT kyc_user_stage_unique UNIQUE NULLS NOT DISTINCT (user_id, stage, status)
);

CREATE INDEX idx_kyc_user_id ON kyc_verification(user_id);
CREATE INDEX idx_kyc_stage ON kyc_verification(stage);
CREATE INDEX idx_kyc_status ON kyc_verification(status);
CREATE INDEX idx_kyc_expires_at ON kyc_verification(expires_at);
CREATE INDEX idx_kyc_token ON kyc_verification(token) WHERE token IS NOT NULL;
CREATE INDEX idx_kyc_phone ON kyc_verification(phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX idx_kyc_email ON kyc_verification(email) WHERE email IS NOT NULL;

-- ============================================
-- KYC USER PROGRESS TABLE (Track completion)
-- ============================================
CREATE TABLE IF NOT EXISTS kyc_user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- Stage completion (boolean flags)
  email BOOLEAN DEFAULT FALSE,
  phone BOOLEAN DEFAULT FALSE,
  government_id BOOLEAN DEFAULT FALSE,
  address_verification BOOLEAN DEFAULT FALSE,
  bank_account BOOLEAN DEFAULT FALSE,
  video_call BOOLEAN DEFAULT FALSE,

  -- Completion tracking
  kyc_completed BOOLEAN DEFAULT FALSE,
  kyc_completed_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Denormalized for performance
  total_stages_completed INT GENERATED ALWAYS AS (
    (CAST(email AS INT) + CAST(phone AS INT) + CAST(government_id AS INT) +
     CAST(address_verification AS INT) + CAST(bank_account AS INT) + CAST(video_call AS INT))
  ) STORED
);

CREATE INDEX idx_kyc_progress_user_id ON kyc_user_progress(user_id);
CREATE INDEX idx_kyc_progress_completed ON kyc_user_progress(kyc_completed);

-- ============================================
-- KYC ADMIN REVIEW QUEUE (Manual verification)
-- ============================================
CREATE TABLE IF NOT EXISTS kyc_admin_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verification_id UUID NOT NULL REFERENCES kyc_verification(id) ON DELETE CASCADE,
  stage VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending',
    'in_progress',
    'approved',
    'rejected',
    'expired'
  )),

  -- Assignment
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL, -- Admin user
  assigned_at TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,

  CONSTRAINT review_queue_unique UNIQUE (verification_id)
);

CREATE INDEX idx_review_queue_user_id ON kyc_admin_review_queue(user_id);
CREATE INDEX idx_review_queue_status ON kyc_admin_review_queue(status);
CREATE INDEX idx_review_queue_assigned_to ON kyc_admin_review_queue(assigned_to);
CREATE INDEX idx_review_queue_created_at ON kyc_admin_review_queue(created_at);

-- ============================================
-- KYC VIDEO CALL QUEUE (Schedule video verifications)
-- ============================================
CREATE TABLE IF NOT EXISTS kyc_video_call_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending',
    'scheduled',
    'in_progress',
    'completed',
    'cancelled',
    'rescheduled'
  )),

  -- Scheduling
  scheduled_at TIMESTAMP,
  scheduled_for_time TIMESTAMP,
  duration_minutes INT DEFAULT 15,

  -- Assignment
  assigned_agent_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Meeting
  video_room_id VARCHAR(255),
  video_meeting_url TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_video_queue_user_id ON kyc_video_call_queue(user_id);
CREATE INDEX idx_video_queue_status ON kyc_video_call_queue(status);
CREATE INDEX idx_video_queue_scheduled_at ON kyc_video_call_queue(scheduled_at);
CREATE INDEX idx_video_queue_assigned_agent ON kyc_video_call_queue(assigned_agent_id);

-- ============================================
-- KYC AUDIT LOG (Compliance & FinCEN)
-- ============================================
CREATE TABLE IF NOT EXISTS kyc_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage VARCHAR(50) NOT NULL,
  event VARCHAR(100) NOT NULL CHECK (event IN (
    'initiated',
    'completed',
    'approved_by_admin',
    'rejected_by_admin',
    'failed_attempt',
    'expired',
    'suspicious_activity'
  )),

  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kyc_audit_user_id ON kyc_audit_log(user_id);
CREATE INDEX idx_kyc_audit_stage ON kyc_audit_log(stage);
CREATE INDEX idx_kyc_audit_event ON kyc_audit_log(event);
CREATE INDEX idx_kyc_audit_created_at ON kyc_audit_log(created_at);

-- ============================================
-- KYC DOCUMENTS TABLE (Store document metadata)
-- ============================================
CREATE TABLE IF NOT EXISTS kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verification_id UUID REFERENCES kyc_verification(id) ON DELETE CASCADE,

  document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
    'government_id',
    'driver_license',
    'passport',
    'address_proof',
    'utility_bill',
    'bank_statement'
  )),

  file_url TEXT NOT NULL,
  file_name VARCHAR(255),
  file_size INT,
  file_hash VARCHAR(255), -- For duplication detection

  -- Document extraction (via OCR/API)
  extracted_data JSONB, -- {name, dob, id_number, issue_date, expiry_date, etc}

  -- Status
  status VARCHAR(50) DEFAULT 'uploaded' CHECK (status IN (
    'uploaded',
    'processing',
    'verified',
    'rejected',
    'expired'
  )),

  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified_at TIMESTAMP
);

CREATE INDEX idx_kyc_documents_user_id ON kyc_documents(user_id);
CREATE INDEX idx_kyc_documents_verification_id ON kyc_documents(verification_id);
CREATE INDEX idx_kyc_documents_document_type ON kyc_documents(document_type);

-- ============================================
-- KYC SANCTIONS LIST (PEP/OFAC checking)
-- ============================================
CREATE TABLE IF NOT EXISTS kyc_sanctions_check (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  check_type VARCHAR(50) NOT NULL CHECK (check_type IN (
    'pep', -- Politically Exposed Person
    'ofac', -- Office of Foreign Assets Control
    'worldcheck',
    'custom_list'
  )),

  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN (
    'pending',
    'clear',
    'match_found',
    'manual_review_required'
  )),

  result JSONB, -- {matched_records: [], match_score: 0.95, etc}
  checked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sanctions_user_id ON kyc_sanctions_check(user_id);
CREATE INDEX idx_sanctions_status ON kyc_sanctions_check(status);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update kyc_user_progress.updated_at
CREATE OR REPLACE FUNCTION update_kyc_progress_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kyc_progress_updated_at BEFORE UPDATE ON kyc_user_progress
  FOR EACH ROW EXECUTE FUNCTION update_kyc_progress_timestamp();

-- Auto-update users.kyc_completed when all stages are done
CREATE OR REPLACE FUNCTION auto_complete_kyc()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.total_stages_completed = 6 THEN
    UPDATE users SET kyc_completed = TRUE, kyc_completed_at = NOW()
    WHERE id = NEW.user_id AND kyc_completed = FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_complete_kyc_trigger AFTER UPDATE ON kyc_user_progress
  FOR EACH ROW EXECUTE FUNCTION auto_complete_kyc();

-- ============================================
-- VIEWS
-- ============================================

-- KYC Status Overview
CREATE OR REPLACE VIEW kyc_status_overview AS
SELECT
  u.id as user_id,
  u.email,
  u.first_name,
  u.last_name,
  kp.email as email_verified,
  kp.phone as phone_verified,
  kp.government_id as id_verified,
  kp.address_verification as address_verified,
  kp.bank_account as bank_verified,
  kp.video_call as video_verified,
  kp.total_stages_completed,
  (kp.total_stages_completed::FLOAT / 6 * 100)::INT as completion_percentage,
  kp.kyc_completed,
  kp.kyc_completed_at,
  u.created_at as account_created_at
FROM users u
LEFT JOIN kyc_user_progress kp ON u.id = kp.user_id;

-- Pending Verifications
CREATE OR REPLACE VIEW kyc_pending_verifications AS
SELECT
  kv.id,
  kv.user_id,
  u.email,
  u.first_name,
  u.last_name,
  kv.stage,
  kv.status,
  kv.attempt_number,
  kv.expires_at,
  EXTRACT(HOUR FROM (kv.expires_at - NOW())) as hours_until_expiry
FROM kyc_verification kv
JOIN users u ON kv.user_id = u.id
WHERE kv.status IN ('pending', 'pending_review', 'pending_verification')
ORDER BY kv.created_at ASC;

-- Admin Review Dashboard
CREATE OR REPLACE VIEW kyc_admin_dashboard AS
SELECT
  COUNT(DISTINCT CASE WHEN arq.status = 'pending' THEN arq.id END) as pending_reviews,
  COUNT(DISTINCT CASE WHEN arq.status = 'in_progress' THEN arq.id END) as in_progress_reviews,
  COUNT(DISTINCT CASE WHEN vcq.status = 'pending' THEN vcq.id END) as pending_video_calls,
  COUNT(DISTINCT CASE WHEN sc.status = 'match_found' THEN sc.id END) as sanctions_alerts,
  COUNT(DISTINCT u.id) as total_users,
  COUNT(DISTINCT CASE WHEN kp.kyc_completed = TRUE THEN u.id END) as fully_verified_users
FROM users u
LEFT JOIN kyc_admin_review_queue arq ON u.id = arq.user_id
LEFT JOIN kyc_video_call_queue vcq ON u.id = vcq.user_id
LEFT JOIN kyc_sanctions_check sc ON u.id = sc.user_id
LEFT JOIN kyc_user_progress kp ON u.id = kp.user_id;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Check if user has access to feature based on KYC stage
CREATE OR REPLACE FUNCTION has_kyc_access(p_user_id UUID, p_feature VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  v_email BOOLEAN;
  v_phone BOOLEAN;
  v_id BOOLEAN;
  v_address BOOLEAN;
  v_bank BOOLEAN;
  v_video BOOLEAN;
BEGIN
  SELECT email, phone, government_id, address_verification, bank_account, video_call
  INTO v_email, v_phone, v_id, v_address, v_bank, v_video
  FROM kyc_user_progress
  WHERE user_id = p_user_id;

  -- Feature access matrix
  CASE p_feature
    WHEN 'account_access' THEN RETURN COALESCE(v_email, FALSE);
    WHEN 'basic_search' THEN RETURN COALESCE(v_email, FALSE);
    WHEN 'messaging' THEN RETURN COALESCE(v_phone, FALSE);
    WHEN 'case_creation' THEN RETURN COALESCE(v_phone, FALSE);
    WHEN 'service_provider_access' THEN RETURN COALESCE(v_id, FALSE);
    WHEN 'higher_transaction_limits' THEN RETURN COALESCE(v_id, FALSE);
    WHEN 'payment_processing' THEN RETURN COALESCE(v_address, FALSE);
    WHEN 'premium_features' THEN RETURN COALESCE(v_bank, FALSE);
    WHEN 'instant_payments' THEN RETURN COALESCE(v_bank, FALSE);
    WHEN 'unlimited_transactions' THEN RETURN COALESCE(v_video, FALSE);
    WHEN 'vip_support' THEN RETURN COALESCE(v_video, FALSE);
    ELSE RETURN FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Get user KYC completion percentage
CREATE OR REPLACE FUNCTION get_kyc_percentage(p_user_id UUID)
RETURNS INT AS $$
DECLARE
  v_percentage INT;
BEGIN
  SELECT COALESCE((total_stages_completed::FLOAT / 6 * 100)::INT, 0)
  INTO v_percentage
  FROM kyc_user_progress
  WHERE user_id = p_user_id;

  RETURN COALESCE(v_percentage, 0);
END;
$$ LANGUAGE plpgsql;
