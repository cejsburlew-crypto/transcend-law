-- Two-Factor Authentication Tables Migration
-- PostgreSQL migration script for 2FA implementation

-- ============================================
-- USER 2FA SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_2fa_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT FALSE,
  totp_enabled BOOLEAN DEFAULT FALSE,
  totp_secret VARCHAR(255),
  sms_enabled BOOLEAN DEFAULT FALSE,
  sms_phone VARCHAR(20),
  primary_method VARCHAR(10) CHECK (primary_method IN ('totp', 'sms')),
  configured_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_2fa_settings_user_id ON user_2fa_settings(user_id);
CREATE INDEX idx_user_2fa_settings_enabled ON user_2fa_settings(enabled);

-- ============================================
-- BACKUP CODES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash VARCHAR(255) NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_backup_codes_user_id ON backup_codes(user_id);
CREATE INDEX idx_backup_codes_user_used ON backup_codes(user_id, used);

-- ============================================
-- SMS OTP SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sms_otp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(255) NOT NULL UNIQUE,
  phone_number VARCHAR(20),
  otp_hash VARCHAR(255) NOT NULL,
  attempts INT DEFAULT 0,
  verified_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sms_otp_sessions_user_id ON sms_otp_sessions(user_id);
CREATE INDEX idx_sms_otp_sessions_session_id ON sms_otp_sessions(session_id);
CREATE INDEX idx_sms_otp_sessions_expires_at ON sms_otp_sessions(expires_at);

-- ============================================
-- TOTP SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS totp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(255) NOT NULL UNIQUE,
  verified_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_totp_sessions_user_id ON totp_sessions(user_id);
CREATE INDEX idx_totp_sessions_session_id ON totp_sessions(session_id);
CREATE INDEX idx_totp_sessions_expires_at ON totp_sessions(expires_at);

-- ============================================
-- 2FA SESSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS two_factor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(255) NOT NULL UNIQUE,
  session_type VARCHAR(10) CHECK (session_type IN ('sms', 'totp', 'backup')),
  code_hash VARCHAR(255),
  verified_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_two_factor_sessions_user_id ON two_factor_sessions(user_id);
CREATE INDEX idx_two_factor_sessions_session_id ON two_factor_sessions(session_id);
CREATE INDEX idx_two_factor_sessions_expires_at ON two_factor_sessions(expires_at);

-- ============================================
-- TRUSTED DEVICES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_fingerprint VARCHAR(255) NOT NULL,
  device_name VARCHAR(255),
  trust_token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_trusted_devices_user_id ON trusted_devices(user_id);
CREATE INDEX idx_trusted_devices_device_fingerprint ON trusted_devices(user_id, device_fingerprint);
CREATE INDEX idx_trusted_devices_trust_token ON trusted_devices(trust_token);

-- ============================================
-- ADMIN 2FA SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type VARCHAR(20) NOT NULL UNIQUE,
  require_2fa BOOLEAN DEFAULT FALSE,
  grace_period_days INT DEFAULT 30,
  active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_settings_user_type ON admin_settings(user_type);
CREATE INDEX idx_admin_settings_active ON admin_settings(active);

-- ============================================
-- 2FA AUDIT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS two_factor_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_two_factor_audit_log_user_id ON two_factor_audit_log(user_id);
CREATE INDEX idx_two_factor_audit_log_event_type ON two_factor_audit_log(event_type);
CREATE INDEX idx_two_factor_audit_log_created_at ON two_factor_audit_log(created_at);

-- ============================================
-- ADMIN AUDIT LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL,
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_audit_log_event_type ON admin_audit_log(event_type);
CREATE INDEX idx_admin_audit_log_created_at ON admin_audit_log(created_at);

-- ============================================
-- CLEAN UP EXPIRED DATA PROCEDURES
-- ============================================

-- Procedure to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_2fa_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM sms_otp_sessions WHERE expires_at < NOW();
  DELETE FROM totp_sessions WHERE expires_at < NOW();
  DELETE FROM two_factor_sessions WHERE expires_at < NOW();
  DELETE FROM trusted_devices WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger to clean up expired sessions daily (optional, can be called via cron job)
-- SELECT cleanup_expired_2fa_sessions();
