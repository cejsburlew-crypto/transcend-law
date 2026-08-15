-- Migration: Create Threat Scan System Tables
-- Purpose: Set up database schema for threat detection, reporting, and isolation
-- Date: 2026-08-15

-- Table: Threat Reports
CREATE TABLE IF NOT EXISTS threat_reports (
    id VARCHAR(255) PRIMARY KEY,
    resource_id VARCHAR(1024) NOT NULL,
    resource_type VARCHAR(50) NOT NULL CHECK (resource_type IN ('file', 'url', 'ip', 'domain')),
    threat_level VARCHAR(20) NOT NULL CHECK (threat_level IN ('critical', 'high', 'medium', 'low', 'none')),
    detected_threats JSONB NOT NULL DEFAULT '[]',
    scan_date TIMESTAMP NOT NULL DEFAULT NOW(),
    isolated BOOLEAN NOT NULL DEFAULT false,
    isolation_reason VARCHAR(255),
    reported_to JSONB NOT NULL DEFAULT '[]',
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scanned', 'isolated', 'resolved')),
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    INDEX idx_threat_level (threat_level),
    INDEX idx_status (status),
    INDEX idx_isolated (isolated),
    INDEX idx_scan_date (scan_date),
    INDEX idx_resource_id (resource_id)
);

-- Table: Scan Errors
CREATE TABLE IF NOT EXISTS scan_errors (
    id SERIAL PRIMARY KEY,
    service VARCHAR(50) NOT NULL CHECK (service IN ('google', 'aws', 'virustotal', 'internal')),
    error TEXT NOT NULL,
    resource_id VARCHAR(1024),
    retryable BOOLEAN NOT NULL DEFAULT false,
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    INDEX idx_service (service),
    INDEX idx_retryable (retryable),
    INDEX idx_created_at (created_at)
);

-- Table: Threat Isolation Log
CREATE TABLE IF NOT EXISTS threat_isolation_log (
    id SERIAL PRIMARY KEY,
    threat_report_id VARCHAR(255) NOT NULL REFERENCES threat_reports(id),
    isolation_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    isolation_method VARCHAR(50) NOT NULL CHECK (isolation_method IN ('s3-bucket', 'network-block', 'process-kill', 'quarantine')),
    isolated_location VARCHAR(255),
    reversal_timestamp TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'failed')),
    notes TEXT,
    INDEX idx_threat_report_id (threat_report_id),
    INDEX idx_isolation_timestamp (isolation_timestamp),
    FOREIGN KEY (threat_report_id) REFERENCES threat_reports(id) ON DELETE CASCADE
);

-- Table: Security Scan Statistics
CREATE TABLE IF NOT EXISTS security_scan_statistics (
    id SERIAL PRIMARY KEY,
    scan_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    total_scans INT NOT NULL DEFAULT 0,
    threats_detected INT NOT NULL DEFAULT 0,
    critical_threats INT NOT NULL DEFAULT 0,
    high_threats INT NOT NULL DEFAULT 0,
    medium_threats INT NOT NULL DEFAULT 0,
    low_threats INT NOT NULL DEFAULT 0,
    items_isolated INT NOT NULL DEFAULT 0,
    errors_encountered INT NOT NULL DEFAULT 0,
    avg_scan_duration_ms INT,
    max_scan_duration_ms INT,
    INDEX idx_scan_timestamp (scan_timestamp)
);

-- Table: External API Status
CREATE TABLE IF NOT EXISTS external_api_status (
    id SERIAL PRIMARY KEY,
    api_name VARCHAR(50) NOT NULL CHECK (api_name IN ('google-safe-browsing', 'virustotal', 'aws-inspector')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('operational', 'degraded', 'down')),
    last_check TIMESTAMP NOT NULL DEFAULT NOW(),
    response_time_ms INT,
    error_message VARCHAR(255),
    consecutive_failures INT DEFAULT 0,
    INDEX idx_api_name (api_name),
    INDEX idx_status (status),
    INDEX idx_last_check (last_check)
);

-- Table: Threat Alert History
CREATE TABLE IF NOT EXISTS threat_alert_history (
    id SERIAL PRIMARY KEY,
    threat_report_id VARCHAR(255) NOT NULL REFERENCES threat_reports(id),
    alert_sent_to VARCHAR(255) NOT NULL,
    alert_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    alert_status VARCHAR(50) NOT NULL CHECK (alert_status IN ('sent', 'failed', 'acknowledged')),
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('critical', 'high-priority', 'routine')),
    recipient_acknowledgment TIMESTAMP,
    notes TEXT,
    INDEX idx_threat_report_id (threat_report_id),
    INDEX idx_alert_timestamp (alert_timestamp),
    FOREIGN KEY (threat_report_id) REFERENCES threat_reports(id) ON DELETE CASCADE
);

-- Create indexes for performance optimization
CREATE INDEX idx_threat_reports_created_at ON threat_reports(created_at DESC);
CREATE INDEX idx_threat_reports_resource ON threat_reports(resource_id, resource_type);
CREATE INDEX idx_scan_errors_created_at ON scan_errors(created_at DESC);
CREATE INDEX idx_isolation_log_timestamp ON threat_isolation_log(isolation_timestamp DESC);

-- Create views for reporting
CREATE VIEW critical_threats_view AS
SELECT
    id,
    resource_id,
    resource_type,
    threat_level,
    scan_date,
    isolated,
    detected_threats
FROM threat_reports
WHERE threat_level = 'critical'
ORDER BY scan_date DESC;

CREATE VIEW isolated_threats_view AS
SELECT
    id,
    resource_id,
    resource_type,
    threat_level,
    scan_date,
    isolation_reason,
    (SELECT COUNT(*) FROM threat_isolation_log WHERE threat_report_id = threat_reports.id) as isolation_actions
FROM threat_reports
WHERE isolated = true
ORDER BY scan_date DESC;

CREATE VIEW recent_scan_errors_view AS
SELECT
    service,
    error,
    COUNT(*) as error_count,
    MAX(created_at) as last_occurrence,
    SUM(CASE WHEN retryable THEN 1 ELSE 0 END) as retryable_count
FROM scan_errors
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY service, error
ORDER BY error_count DESC;

-- Create stored procedures for common operations
DELIMITER //

CREATE PROCEDURE get_threat_statistics(IN p_start_date TIMESTAMP, IN p_end_date TIMESTAMP)
BEGIN
    SELECT
        COUNT(*) as total_scans,
        SUM(CASE WHEN threat_level = 'critical' THEN 1 ELSE 0 END) as critical_count,
        SUM(CASE WHEN threat_level = 'high' THEN 1 ELSE 0 END) as high_count,
        SUM(CASE WHEN threat_level = 'medium' THEN 1 ELSE 0 END) as medium_count,
        SUM(CASE WHEN threat_level = 'low' THEN 1 ELSE 0 END) as low_count,
        SUM(CASE WHEN isolated = true THEN 1 ELSE 0 END) as isolated_count,
        AVG(EXTRACT(EPOCH FROM (updated_at - scan_date))) as avg_scan_duration_sec
    FROM threat_reports
    WHERE scan_date BETWEEN p_start_date AND p_end_date;
END//

CREATE PROCEDURE get_active_threats()
BEGIN
    SELECT
        id,
        resource_id,
        resource_type,
        threat_level,
        scan_date,
        isolated,
        detected_threats
    FROM threat_reports
    WHERE status IN ('pending', 'scanned', 'isolated')
    ORDER BY threat_level DESC, scan_date DESC;
END//

CREATE PROCEDURE archive_old_threats(IN p_days_old INT)
BEGIN
    DELETE FROM threat_isolation_log
    WHERE threat_report_id IN (
        SELECT id FROM threat_reports
        WHERE scan_date < NOW() - INTERVAL p_days_old DAY
        AND status = 'resolved'
    );

    DELETE FROM threat_reports
    WHERE scan_date < NOW() - INTERVAL p_days_old DAY
    AND status = 'resolved';
END//

DELIMITER ;

-- Insert API status monitoring records
INSERT INTO external_api_status (api_name, status, response_time_ms)
VALUES
    ('google-safe-browsing', 'operational', NULL),
    ('virustotal', 'operational', NULL),
    ('aws-inspector', 'operational', NULL)
ON DUPLICATE KEY UPDATE status = VALUES(status);

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON threat_reports TO 'transcend_user'@'localhost';
GRANT SELECT, INSERT, UPDATE ON scan_errors TO 'transcend_user'@'localhost';
GRANT SELECT, INSERT ON threat_isolation_log TO 'transcend_user'@'localhost';
GRANT SELECT, INSERT ON security_scan_statistics TO 'transcend_user'@'localhost';
GRANT SELECT, UPDATE ON external_api_status TO 'transcend_user'@'localhost';
GRANT SELECT, INSERT ON threat_alert_history TO 'transcend_user'@'localhost';
GRANT SELECT ON critical_threats_view TO 'transcend_user'@'localhost';
GRANT SELECT ON isolated_threats_view TO 'transcend_user'@'localhost';
GRANT SELECT ON recent_scan_errors_view TO 'transcend_user'@'localhost';
