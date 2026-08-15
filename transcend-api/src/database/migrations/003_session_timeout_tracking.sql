-- Session Timeout & Auto-Logout Tracking Migration
-- Ensures audit logging for session management

-- Verify audit_log table exists and has necessary columns
-- (Already exists in schema.sql, but ensure it has the right structure)
-- This migration ensures compatibility with session timeout middleware

-- Add session-related indexes to activity_logs if not exists
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_session
  ON activity_logs(action, session_id)
  WHERE action IN ('session_started', 'session_ended', 'session_extended');

-- Add index for logout tracking
CREATE INDEX IF NOT EXISTS idx_audit_log_logout_action
  ON audit_log(action, created_at)
  WHERE action = 'logout';

-- Create a view for session timeout analytics
CREATE OR REPLACE VIEW session_timeout_analytics AS
SELECT
  DATE(al.timestamp) as date,
  COUNT(*) FILTER (WHERE al.action = 'session_started') as sessions_started,
  COUNT(*) FILTER (WHERE al.action = 'session_ended') as sessions_ended,
  COUNT(*) FILTER (WHERE au.action = 'logout' AND au.changes->>'reason' = 'timeout') as timeouts,
  COUNT(*) FILTER (WHERE au.action = 'logout' AND au.changes->>'reason' = 'manual') as manual_logouts,
  COUNT(*) FILTER (WHERE au.action = 'logout' AND au.changes->>'reason' = 'forced') as forced_logouts,
  AVG(
    EXTRACT(EPOCH FROM (
      SELECT COALESCE(MAX(al2.timestamp), al.timestamp)
      FROM activity_logs al2
      WHERE al2.session_id = al.session_id
      AND al2.timestamp > al.timestamp
    ))
  ) as avg_session_duration_seconds
FROM activity_logs al
LEFT JOIN audit_log au ON al.session_id = au.resource_id AND au.resource_type = 'session'
WHERE al.action IN ('session_started', 'session_ended')
GROUP BY DATE(al.timestamp);

-- Create stored procedure for cleanup of old audit logs
CREATE OR REPLACE FUNCTION cleanup_old_session_logs()
RETURNS void AS $$
BEGIN
  -- Delete audit logs older than 90 days
  DELETE FROM audit_log
  WHERE action = 'logout'
  AND created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';

  -- Delete activity logs older than 90 days
  DELETE FROM activity_logs
  WHERE action IN ('session_started', 'session_ended')
  AND timestamp < CURRENT_TIMESTAMP - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Grant permissions if using role-based access
-- GRANT EXECUTE ON FUNCTION cleanup_old_session_logs() TO application_role;
