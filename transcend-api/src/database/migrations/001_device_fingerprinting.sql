-- Migration: Device Fingerprinting Tables
-- This migration adds tables for comprehensive device fingerprinting, geo-velocity checks, and admin alerting

-- ============================================
-- DEVICE FINGERPRINTS TABLE
-- ============================================
CREATE TABLE device_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name VARCHAR(255),
  fingerprint_hash VARCHAR(64) NOT NULL,
  screen_resolution VARCHAR(20),
  browser_user_agent TEXT,
  ip_address VARCHAR(45),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  timezone VARCHAR(50),
  language VARCHAR(5),
  platform VARCHAR(50),
  cpu_cores INT,
  ram_gb INT,
  is_whitelisted BOOLEAN DEFAULT FALSE,
  session_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_device_fingerprints_user_id ON device_fingerprints(user_id);
CREATE INDEX idx_device_fingerprints_fingerprint_hash ON device_fingerprints(fingerprint_hash);
CREATE INDEX idx_device_fingerprints_created_at ON device_fingerprints(created_at);
CREATE INDEX idx_device_fingerprints_user_created ON device_fingerprints(user_id, created_at DESC);

-- ============================================
-- DEVICE WHITELIST TABLE
-- ============================================
CREATE TABLE device_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint_hash VARCHAR(64) NOT NULL,
  device_name VARCHAR(255),
  trusted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP,
  revoked_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_device_whitelist_user_id ON device_whitelist(user_id);
CREATE INDEX idx_device_whitelist_fingerprint_hash ON device_whitelist(fingerprint_hash);
CREATE UNIQUE INDEX idx_device_whitelist_unique ON device_whitelist(user_id, fingerprint_hash)
  WHERE revoked_at IS NULL;

-- ============================================
-- FINGERPRINT MISMATCHES TABLE (Audit Trail)
-- ============================================
CREATE TABLE fingerprint_mismatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address VARCHAR(45),
  reason TEXT,
  suspicious_flags JSONB DEFAULT '[]',
  verified_by_user BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fingerprint_mismatches_user_id ON fingerprint_mismatches(user_id);
CREATE INDEX idx_fingerprint_mismatches_created_at ON fingerprint_mismatches(created_at);
CREATE INDEX idx_fingerprint_mismatches_user_created ON fingerprint_mismatches(user_id, created_at DESC);

-- ============================================
-- ADMIN ALERTS TABLE
-- ============================================
CREATE TABLE admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}',
  severity VARCHAR(20) CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) DEFAULT 'HIGH',
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_alerts_alert_type ON admin_alerts(alert_type);
CREATE INDEX idx_admin_alerts_user_id ON admin_alerts(user_id);
CREATE INDEX idx_admin_alerts_severity ON admin_alerts(severity);
CREATE INDEX idx_admin_alerts_created_at ON admin_alerts(created_at DESC);
CREATE INDEX idx_admin_alerts_acknowledged ON admin_alerts(acknowledged);

-- ============================================
-- LOGIN SESSIONS TABLE
-- ============================================
CREATE TABLE login_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_fingerprint_id UUID REFERENCES device_fingerprints(id) ON DELETE SET NULL,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP
);

CREATE INDEX idx_login_sessions_user_id ON login_sessions(user_id);
CREATE INDEX idx_login_sessions_session_token ON login_sessions(session_token);
CREATE INDEX idx_login_sessions_is_active ON login_sessions(is_active);
CREATE INDEX idx_login_sessions_expires_at ON login_sessions(expires_at);

-- ============================================
-- LOCATION HISTORY TABLE
-- ============================================
CREATE TABLE location_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address VARCHAR(45),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  country VARCHAR(100),
  city VARCHAR(100),
  isp VARCHAR(255),
  vpn_detected BOOLEAN DEFAULT FALSE,
  proxy_detected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_location_history_user_id ON location_history(user_id);
CREATE INDEX idx_location_history_created_at ON location_history(created_at DESC);
CREATE INDEX idx_location_history_user_created ON location_history(user_id, created_at DESC);

-- ============================================
-- DEVICE COMPROMISE FLAGS TABLE
-- ============================================
CREATE TABLE device_compromise_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint_hash VARCHAR(64),
  flag_type VARCHAR(100) NOT NULL CHECK (flag_type IN (
    'IMPOSSIBLE_TRAVEL',
    'MULTIPLE_MISMATCHES',
    'VPN_DETECTED',
    'PROXY_DETECTED',
    'MALWARE_SUSPECTED',
    'BRUTE_FORCE_ATTEMPT',
    'CREDENTIAL_STUFFING'
  )),
  severity VARCHAR(20) CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  details JSONB DEFAULT '{}',
  action_taken VARCHAR(100),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_device_compromise_flags_user_id ON device_compromise_flags(user_id);
CREATE INDEX idx_device_compromise_flags_flag_type ON device_compromise_flags(flag_type);
CREATE INDEX idx_device_compromise_flags_resolved ON device_compromise_flags(resolved);

-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

-- Update updated_at for device_fingerprints
CREATE TRIGGER device_fingerprints_updated_at BEFORE UPDATE ON device_fingerprints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-cleanup expired login sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  UPDATE login_sessions
  SET is_active = FALSE, ended_at = NOW()
  WHERE is_active = TRUE AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to flag suspicious pattern
CREATE OR REPLACE FUNCTION flag_suspicious_pattern()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user has 5+ mismatches in 30 minutes
  IF (SELECT COUNT(*) FROM fingerprint_mismatches
      WHERE user_id = NEW.user_id
      AND created_at > NOW() - INTERVAL '30 minutes') >= 5 THEN

    INSERT INTO device_compromise_flags
    (user_id, flag_type, severity, details, created_at)
    VALUES (
      NEW.user_id,
      'MULTIPLE_MISMATCHES',
      'HIGH',
      jsonb_build_object('mismatches_in_30min', 5, 'recent_ips', NEW.ip_address),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to flag suspicious patterns
CREATE TRIGGER fingerprint_mismatch_suspicious_pattern
AFTER INSERT ON fingerprint_mismatches
FOR EACH ROW EXECUTE FUNCTION flag_suspicious_pattern();

-- ============================================
-- VIEWS
-- ============================================

-- User device security status
CREATE VIEW user_device_security_status AS
SELECT
  u.id as user_id,
  u.email,
  COUNT(DISTINCT df.id) as total_devices,
  COUNT(DISTINCT CASE WHEN dw.id IS NOT NULL THEN df.id END) as trusted_devices,
  COUNT(DISTINCT CASE WHEN fm.id IS NOT NULL AND fm.created_at > NOW() - INTERVAL '24 hours' THEN fm.id END) as mismatches_24h,
  MAX(df.created_at) as last_login,
  COUNT(DISTINCT dcf.id) as active_compromise_flags
FROM users u
LEFT JOIN device_fingerprints df ON u.id = df.user_id
LEFT JOIN device_whitelist dw ON u.id = dw.user_id AND df.fingerprint_hash = dw.fingerprint_hash
LEFT JOIN fingerprint_mismatches fm ON u.id = fm.user_id
LEFT JOIN device_compromise_flags dcf ON u.id = dcf.user_id AND dcf.resolved = FALSE
GROUP BY u.id, u.email;

-- Recent suspicious activities
CREATE VIEW recent_suspicious_activities AS
SELECT
  'mismatch' as activity_type,
  fm.user_id,
  fm.created_at,
  fm.ip_address,
  fm.reason,
  fm.suspicious_flags,
  'HIGH' as severity
FROM fingerprint_mismatches fm
WHERE fm.created_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT
  'compromise_flag' as activity_type,
  dcf.user_id,
  dcf.created_at,
  NULL as ip_address,
  dcf.flag_type,
  jsonb_build_object('details', dcf.details) as suspicious_flags,
  dcf.severity
FROM device_compromise_flags dcf
WHERE dcf.created_at > NOW() - INTERVAL '24 hours'
AND dcf.resolved = FALSE

UNION ALL

SELECT
  'admin_alert' as activity_type,
  aa.user_id,
  aa.created_at,
  NULL as ip_address,
  aa.alert_type,
  aa.details as suspicious_flags,
  aa.severity
FROM admin_alerts aa
WHERE aa.created_at > NOW() - INTERVAL '24 hours'
AND aa.acknowledged = FALSE

ORDER BY created_at DESC;
