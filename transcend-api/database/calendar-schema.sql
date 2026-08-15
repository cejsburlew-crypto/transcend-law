-- Calendar Integration Schema
-- Database schema for Availability Calendar Integration system

-- ============================================
-- Calendar Providers Table
-- ============================================
CREATE TABLE IF NOT EXISTS calendar_providers (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL,
  provider_type ENUM('google', 'outlook', 'calendly') NOT NULL,
  access_token LONGTEXT NOT NULL,
  refresh_token LONGTEXT,
  expires_at BIGINT,
  connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_sync TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_provider (userId, provider_type),
  INDEX idx_userId (userId),
  INDEX idx_provider_type (provider_type),
  INDEX idx_expires_at (expires_at)
);

-- ============================================
-- Availability Patterns Table
-- ============================================
CREATE TABLE IF NOT EXISTS availability_patterns (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL,
  day_of_week INT NOT NULL COMMENT '0-6 (Sunday-Saturday)',
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_recurring BOOLEAN DEFAULT TRUE,
  timezone VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_pattern (userId, day_of_week),
  INDEX idx_userId (userId),
  INDEX idx_day_of_week (day_of_week),
  INDEX idx_is_active (is_active)
);

-- ============================================
-- Blackout Dates Table
-- ============================================
CREATE TABLE IF NOT EXISTS blackout_dates (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason VARCHAR(500),
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern ENUM('daily', 'weekly', 'monthly', 'yearly'),
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_userId (userId),
  INDEX idx_date_range (start_date, end_date),
  INDEX idx_is_recurring (is_recurring)
);

-- ============================================
-- Appointments Table
-- ============================================
CREATE TABLE IF NOT EXISTS appointments (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  description LONGTEXT,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  attendees JSON,
  provider ENUM('google', 'outlook', 'calendly') NOT NULL,
  provider_event_id VARCHAR(500),
  status ENUM('confirmed', 'cancelled', 'tentative') DEFAULT 'confirmed',
  service_type VARCHAR(100),
  timezone VARCHAR(50),
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP NULL,
  UNIQUE KEY unique_provider_event (provider, provider_event_id),
  INDEX idx_userId (userId),
  INDEX idx_status (status),
  INDEX idx_time_range (start_time, end_time),
  INDEX idx_provider (provider),
  INDEX idx_service_type (service_type)
);

-- ============================================
-- Booking Slots Cache Table
-- ============================================
CREATE TABLE IF NOT EXISTS booking_slots_cache (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL,
  slot_date DATE NOT NULL,
  provider VARCHAR(50) NOT NULL,
  slots JSON NOT NULL COMMENT 'Cached available slots',
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  INDEX idx_userId_date (userId, slot_date),
  INDEX idx_expires_at (expires_at)
);

-- ============================================
-- Calendar Sync Log Table
-- ============================================
CREATE TABLE IF NOT EXISTS calendar_sync_logs (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  sync_action ENUM('fetch', 'create', 'update', 'delete') NOT NULL,
  event_id VARCHAR(500),
  status ENUM('success', 'failed', 'pending') DEFAULT 'pending',
  error_message LONGTEXT,
  sync_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  metadata JSON,
  INDEX idx_userId (userId),
  INDEX idx_provider (provider),
  INDEX idx_status (status),
  INDEX idx_sync_timestamp (sync_timestamp)
);

-- ============================================
-- Booking Configuration Table
-- ============================================
CREATE TABLE IF NOT EXISTS booking_configurations (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL UNIQUE,
  duration_minutes INT DEFAULT 60,
  buffer_minutes INT DEFAULT 15,
  timezone VARCHAR(50) DEFAULT 'America/Los_Angeles',
  min_notice_minutes INT DEFAULT 60,
  max_advance_days INT DEFAULT 90,
  timezone_preference VARCHAR(50),
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_userId (userId)
);

-- ============================================
-- Event Webhooks Table
-- ============================================
CREATE TABLE IF NOT EXISTS calendar_webhooks (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  webhook_id VARCHAR(500),
  webhook_url VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  last_notification TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_userId (userId),
  INDEX idx_provider (provider),
  INDEX idx_is_active (is_active)
);

-- ============================================
-- Audit Log Table
-- ============================================
CREATE TABLE IF NOT EXISTS calendar_audit_log (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(500),
  details JSON,
  ip_address VARCHAR(45),
  user_agent LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_userId (userId),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Compound indexes for common queries
CREATE INDEX idx_user_provider ON calendar_providers(userId, provider_type);
CREATE INDEX idx_user_date_slots ON booking_slots_cache(userId, slot_date);
CREATE INDEX idx_user_appointment_time ON appointments(userId, start_time, end_time);
CREATE INDEX idx_blackout_date_range ON blackout_dates(userId, start_date, end_date);
CREATE INDEX idx_sync_log_recent ON calendar_sync_logs(userId, sync_timestamp DESC);

-- ============================================
-- Views for Common Queries
-- ============================================

-- View: Active providers for a user
CREATE OR REPLACE VIEW active_providers AS
SELECT
  cp.id,
  cp.userId,
  cp.provider_type,
  cp.connected_at,
  cp.last_sync,
  CASE
    WHEN cp.expires_at IS NULL THEN 'valid'
    WHEN cp.expires_at > UNIX_TIMESTAMP(NOW()) * 1000 THEN 'valid'
    ELSE 'expired'
  END as token_status
FROM calendar_providers cp
WHERE cp.is_active = TRUE;

-- View: Available slots for today and next 90 days
CREATE OR REPLACE VIEW available_slots_view AS
SELECT
  ap.userId,
  ap.day_of_week,
  ap.start_time,
  ap.end_time,
  ap.timezone,
  COUNT(DISTINCT a.id) as appointment_count
FROM availability_patterns ap
LEFT JOIN appointments a ON
  a.userId = ap.userId
  AND DAYOFWEEK(DATE_SUB(a.start_time, INTERVAL 1 DAY)) = ap.day_of_week
  AND a.status = 'confirmed'
WHERE ap.is_active = TRUE
GROUP BY ap.userId, ap.day_of_week;

-- View: User availability summary
CREATE OR REPLACE VIEW user_availability_summary AS
SELECT
  ap.userId,
  ap.timezone,
  COUNT(DISTINCT ap.id) as pattern_count,
  MIN(ap.start_time) as earliest_start,
  MAX(ap.end_time) as latest_end,
  COUNT(DISTINCT bd.id) as blackout_count,
  COUNT(DISTINCT a.id) as appointment_count
FROM availability_patterns ap
LEFT JOIN blackout_dates bd ON bd.userId = ap.userId
LEFT JOIN appointments a ON a.userId = ap.userId AND a.status = 'confirmed'
WHERE ap.is_active = TRUE
GROUP BY ap.userId;

-- ============================================
-- Stored Procedures
-- ============================================

-- Procedure: Clean expired cache and logs
DELIMITER //
CREATE PROCEDURE clean_expired_cache_and_logs()
BEGIN
  DELETE FROM booking_slots_cache WHERE expires_at < NOW();
  DELETE FROM calendar_sync_logs
  WHERE completed_at IS NOT NULL
  AND completed_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
END //
DELIMITER ;

-- Procedure: Get available slots for a specific user and date
DELIMITER //
CREATE PROCEDURE get_available_slots(
  IN p_userId VARCHAR(255),
  IN p_slot_date DATE,
  IN p_duration_minutes INT,
  IN p_buffer_minutes INT
)
BEGIN
  SELECT
    a.id,
    a.start_time,
    a.end_time,
    a.status,
    ap.timezone
  FROM appointments a
  INNER JOIN availability_patterns ap ON
    ap.userId = a.userId
    AND ap.day_of_week = DAYOFWEEK(DATE_SUB(p_slot_date, INTERVAL 1 DAY))
  WHERE a.userId = p_userId
    AND DATE(a.start_time) = p_slot_date
    AND a.status = 'confirmed'
  ORDER BY a.start_time;
END //
DELIMITER ;

-- Procedure: Get sync statistics
DELIMITER //
CREATE PROCEDURE get_sync_statistics(
  IN p_userId VARCHAR(255),
  IN p_days INT
)
BEGIN
  SELECT
    provider,
    COUNT(*) as total_syncs,
    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_syncs,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_syncs,
    MAX(completed_at) as last_sync,
    AVG(TIMESTAMPDIFF(SECOND, sync_timestamp, completed_at)) as avg_sync_duration
  FROM calendar_sync_logs
  WHERE userId = p_userId
    AND sync_timestamp > DATE_SUB(NOW(), INTERVAL p_days DAY)
  GROUP BY provider;
END //
DELIMITER ;

-- ============================================
-- Triggers
-- ============================================

-- Trigger: Update provider last_sync on successful sync
DELIMITER //
CREATE TRIGGER update_provider_last_sync
AFTER UPDATE ON calendar_sync_logs
FOR EACH ROW
BEGIN
  IF NEW.status = 'success' THEN
    UPDATE calendar_providers
    SET last_sync = NOW()
    WHERE userId = NEW.userId
      AND provider_type = NEW.provider;
  END IF;
END //
DELIMITER ;

-- Trigger: Auto-expire cache entries
DELIMITER //
CREATE TRIGGER auto_expire_cache
BEFORE INSERT ON booking_slots_cache
FOR EACH ROW
BEGIN
  SET NEW.expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE);
END //
DELIMITER ;

-- ============================================
-- Permissions & Security
-- ============================================

-- Create application user (read/write)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON transcend_db.calendar_* TO 'calendar_app'@'localhost' IDENTIFIED BY 'secure_password';

-- Create audit user (read-only)
-- GRANT SELECT ON transcend_db.calendar_audit_log TO 'calendar_audit'@'localhost' IDENTIFIED BY 'secure_password';
