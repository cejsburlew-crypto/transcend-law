-- Wait Time Analytics Tables Migration
-- Creates tables for tracking client wait times, provider response times, alerts, and analytics

-- Drop tables if they exist (for fresh migrations)
DROP TABLE IF EXISTS wait_time_alerts;
DROP TABLE IF EXISTS wait_time_events;

-- ============================================
-- Wait Time Events Table
-- ============================================

CREATE TABLE wait_time_events (
  id VARCHAR(100) PRIMARY KEY,
  case_id VARCHAR(100) NOT NULL,
  client_id VARCHAR(100) NOT NULL,
  provider_id VARCHAR(100) NOT NULL,
  service_type VARCHAR(100) NOT NULL,

  -- Timestamp tracking
  client_arrival_time TIMESTAMP NOT NULL,
  provider_response_time TIMESTAMP,
  service_completion_time TIMESTAMP,

  -- Calculated wait times (in seconds)
  client_wait_time INTEGER,
  total_service_time INTEGER,

  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'waiting',
  -- Values: 'waiting', 'in_progress', 'completed', 'no_show', 'cancelled'

  -- Threshold tracking
  exceeds_response_threshold BOOLEAN DEFAULT FALSE,
  exceeds_completion_threshold BOOLEAN DEFAULT FALSE,

  -- SLA thresholds (in seconds, configurable per provider)
  response_threshold_sla INTEGER DEFAULT 300, -- 5 minutes default
  completion_threshold_sla INTEGER DEFAULT 1800, -- 30 minutes default

  -- Audit fields
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Indexes for common queries
  CONSTRAINT fk_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_client FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,

  INDEX idx_case_id (case_id),
  INDEX idx_provider_id (provider_id),
  INDEX idx_client_id (client_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_client_arrival_time (client_arrival_time),
  INDEX idx_exceeds_thresholds (exceeds_response_threshold, exceeds_completion_threshold)
);

-- ============================================
-- Wait Time Alerts Table
-- ============================================

CREATE TABLE wait_time_alerts (
  id VARCHAR(100) PRIMARY KEY,
  event_id VARCHAR(100) NOT NULL,
  case_id VARCHAR(100) NOT NULL,
  client_id VARCHAR(100) NOT NULL,
  provider_id VARCHAR(100) NOT NULL,

  -- Alert type
  alert_type VARCHAR(50) NOT NULL,
  -- Values: 'response_time_exceeded', 'completion_time_exceeded', 'no_show'

  -- Severity levels
  severity VARCHAR(50) NOT NULL,
  -- Values: 'low', 'medium', 'high', 'critical'

  -- Alert details
  threshold INTEGER NOT NULL, -- SLA threshold in seconds
  actual_value INTEGER NOT NULL, -- Actual wait time in seconds
  message TEXT NOT NULL,

  -- Alert status
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  -- Values: 'active', 'acknowledged', 'resolved'

  -- Acknowledgement tracking
  acknowledged_by VARCHAR(100),
  acknowledged_at TIMESTAMP,

  -- Resolution tracking
  resolved_at TIMESTAMP,

  -- Audit fields
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Indexes for common queries
  CONSTRAINT fk_event FOREIGN KEY (event_id) REFERENCES wait_time_events(id) ON DELETE CASCADE,
  CONSTRAINT fk_alert_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_alert_client FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_alert_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,

  INDEX idx_event_id (event_id),
  INDEX idx_provider_id (provider_id),
  INDEX idx_status (status),
  INDEX idx_severity (severity),
  INDEX idx_created_at (created_at),
  INDEX idx_active_alerts (status, severity, created_at)
);

-- ============================================
-- Wait Time Statistics View
-- ============================================

CREATE VIEW wait_time_statistics AS
SELECT
  provider_id,
  COUNT(*) as total_services,
  AVG(client_wait_time) as avg_response_wait_time,
  AVG(total_service_time) as avg_total_service_time,
  MIN(client_wait_time) as min_response_wait_time,
  MAX(client_wait_time) as max_response_wait_time,
  STDDEV(client_wait_time) as stddev_response_wait_time,
  COUNT(CASE WHEN exceeds_response_threshold THEN 1 END) as response_threshold_exceeded_count,
  COUNT(CASE WHEN exceeds_completion_threshold THEN 1 END) as completion_threshold_exceeded_count,
  ROUND(
    (COUNT(CASE WHEN exceeds_response_threshold OR exceeds_completion_threshold THEN 1 END) /
     COUNT(*)) * 100, 2
  ) as percentage_threshold_exceeded,
  DATE_FORMAT(created_at, '%Y-%m') as period
FROM wait_time_events
WHERE status IN ('completed', 'in_progress')
GROUP BY provider_id, DATE_FORMAT(created_at, '%Y-%m');

-- ============================================
-- Wait Time Distribution View
-- ============================================

CREATE VIEW wait_time_distribution AS
SELECT
  provider_id,
  CASE
    WHEN client_wait_time <= 300 THEN '0-5 min'
    WHEN client_wait_time <= 900 THEN '5-15 min'
    WHEN client_wait_time <= 1800 THEN '15-30 min'
    WHEN client_wait_time <= 3600 THEN '30-60 min'
    ELSE '60+ min'
  END as wait_time_range,
  COUNT(*) as count,
  ROUND(AVG(client_wait_time), 0) as avg_wait_time
FROM wait_time_events
WHERE status IN ('completed', 'in_progress')
  AND client_wait_time IS NOT NULL
GROUP BY provider_id, wait_time_range;

-- ============================================
-- Provider Performance Scorecard View
-- ============================================

CREATE VIEW provider_performance_scorecard AS
SELECT
  p.id as provider_id,
  p.name as provider_name,
  COUNT(wte.id) as total_services_30d,
  ROUND(AVG(wte.client_wait_time), 0) as avg_response_time_seconds,
  ROUND(AVG(wte.total_service_time), 0) as avg_total_service_time_seconds,
  COUNT(CASE WHEN wte.exceeds_response_threshold THEN 1 END) as response_sla_breaches,
  COUNT(CASE WHEN wte.exceeds_completion_threshold THEN 1 END) as completion_sla_breaches,
  ROUND(
    (1 - (COUNT(CASE WHEN wte.exceeds_response_threshold OR wte.exceeds_completion_threshold THEN 1 END) /
          NULLIF(COUNT(*), 0))) * 100, 1
  ) as sla_compliance_percentage,
  ROUND(AVG(sr.satisfaction_score), 2) as avg_satisfaction_score,
  COUNT(sr.id) as satisfaction_responses,
  DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') as generated_at
FROM providers p
LEFT JOIN wait_time_events wte ON p.id = wte.provider_id
  AND wte.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
  AND wte.status IN ('completed', 'in_progress')
LEFT JOIN service_reviews sr ON p.id = sr.provider_id
  AND sr.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY p.id, p.name;

-- ============================================
-- Alert Summary View
-- ============================================

CREATE VIEW alert_summary AS
SELECT
  provider_id,
  severity,
  COUNT(*) as alert_count,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active_alerts,
  COUNT(CASE WHEN status = 'acknowledged' THEN 1 END) as acknowledged_alerts,
  COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_alerts,
  DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') as generated_at
FROM wait_time_alerts
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY provider_id, severity;

-- ============================================
-- Create Stored Procedures
-- ============================================

DELIMITER //

-- Procedure to calculate SLA compliance for a provider
CREATE PROCEDURE CalculateProviderSLACompliance(
  IN p_provider_id VARCHAR(100),
  IN p_days_back INT,
  OUT p_sla_compliance_percentage DECIMAL(5,2)
)
BEGIN
  SELECT
    ROUND(
      (1 - (COUNT(CASE WHEN exceeds_response_threshold OR exceeds_completion_threshold THEN 1 END) /
            NULLIF(COUNT(*), 0))) * 100, 2
    ) INTO p_sla_compliance_percentage
  FROM wait_time_events
  WHERE provider_id = p_provider_id
    AND created_at >= DATE_SUB(NOW(), INTERVAL p_days_back DAY)
    AND status IN ('completed', 'in_progress');
END //

-- Procedure to generate alert for excessive wait time
CREATE PROCEDURE GenerateWaitTimeAlert(
  IN p_event_id VARCHAR(100),
  IN p_case_id VARCHAR(100),
  IN p_client_id VARCHAR(100),
  IN p_provider_id VARCHAR(100),
  IN p_alert_type VARCHAR(50),
  IN p_severity VARCHAR(50),
  IN p_threshold INT,
  IN p_actual_value INT
)
BEGIN
  INSERT INTO wait_time_alerts (
    id,
    event_id,
    case_id,
    client_id,
    provider_id,
    alert_type,
    severity,
    threshold,
    actual_value,
    message,
    status,
    created_at
  ) VALUES (
    CONCAT('alert_', UNIX_TIMESTAMP(), '_', SUBSTRING(MD5(RAND()), 1, 8)),
    p_event_id,
    p_case_id,
    p_client_id,
    p_provider_id,
    p_alert_type,
    p_severity,
    p_threshold,
    p_actual_value,
    CONCAT(
      REPLACE(p_alert_type, '_', ' '), ': Wait time of ',
      FLOOR(p_actual_value / 60), ' minutes exceeds threshold of ',
      FLOOR(p_threshold / 60), ' minutes'
    ),
    'active',
    NOW()
  );
END //

-- Procedure to get provider wait time percentiles
CREATE PROCEDURE GetProviderWaitTimePercentiles(
  IN p_provider_id VARCHAR(100),
  IN p_days_back INT
)
BEGIN
  SELECT
    provider_id,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY client_wait_time) as p50_response_time,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY client_wait_time) as p75_response_time,
    PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY client_wait_time) as p90_response_time,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY client_wait_time) as p95_response_time,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY client_wait_time) as p99_response_time
  FROM wait_time_events
  WHERE provider_id = p_provider_id
    AND created_at >= DATE_SUB(NOW(), INTERVAL p_days_back DAY)
    AND status IN ('completed', 'in_progress')
    AND client_wait_time IS NOT NULL;
END //

DELIMITER ;

-- ============================================
-- Create Indexes for Performance
-- ============================================

CREATE INDEX idx_wte_case_provider ON wait_time_events(case_id, provider_id);
CREATE INDEX idx_wte_status_date ON wait_time_events(status, created_at);
CREATE INDEX idx_wte_thresholds_date ON wait_time_events(
  exceeds_response_threshold,
  exceeds_completion_threshold,
  created_at
);

CREATE INDEX idx_wta_provider_status ON wait_time_alerts(provider_id, status);
CREATE INDEX idx_wta_severity_date ON wait_time_alerts(severity, created_at);
CREATE INDEX idx_wta_active_alerts ON wait_time_alerts(status, created_at)
  WHERE status = 'active';

-- ============================================
-- Add Audit Trigger
-- ============================================

DELIMITER //

CREATE TRIGGER update_wait_time_events_timestamp
BEFORE UPDATE ON wait_time_events
FOR EACH ROW
BEGIN
  SET NEW.updated_at = CURRENT_TIMESTAMP;
END //

DELIMITER ;
