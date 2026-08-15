-- Push Notifications Database Schema
-- Tables for FCM integration, user preferences, devices, and analytics

-- ============================================
-- DEVICE REGISTRATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS device_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fcm_token VARCHAR(500) NOT NULL,
  device_type VARCHAR(50) NOT NULL CHECK (device_type IN ('web', 'mobile', 'tablet')),
  device_name VARCHAR(255),
  os_type VARCHAR(100) NOT NULL,
  os_version VARCHAR(100),
  app_version VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  registered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, fcm_token)
);

CREATE INDEX idx_device_registrations_user_id ON device_registrations(user_id);
CREATE INDEX idx_device_registrations_active ON device_registrations(is_active, last_used_at);

-- ============================================
-- NOTIFICATION PREFERENCES
-- ============================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  enable_browser_notifications BOOLEAN DEFAULT true,
  enable_in_app_notifications BOOLEAN DEFAULT true,
  enable_email_notifications BOOLEAN DEFAULT true,
  enable_sms_notifications BOOLEAN DEFAULT false,
  quiet_hours JSONB DEFAULT '{
    "enabled": true,
    "startTime": "22:00",
    "endTime": "08:00",
    "timezone": "America/Los_Angeles"
  }',
  muted_categories TEXT[] DEFAULT ARRAY[]::TEXT[],
  preferred_channels TEXT[] DEFAULT ARRAY['browser', 'in_app']::TEXT[],
  delivery_frequency VARCHAR(50) DEFAULT 'immediate' CHECK (delivery_frequency IN ('immediate', 'daily_digest', 'weekly_digest')),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);

-- ============================================
-- PUSH NOTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS push_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'case_update', 'message', 'alert', 'document', 'appointment', 'payment', 'system', 'marketing'
  )),
  priority VARCHAR(50) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  channels TEXT[] NOT NULL DEFAULT ARRAY['browser', 'in_app']::TEXT[],
  deep_link VARCHAR(500),
  image_url VARCHAR(500),
  action_buttons JSONB DEFAULT '[]'::JSONB,
  data JSONB DEFAULT '{}'::JSONB,
  scheduled_for TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP,
  read_at TIMESTAMP,
  clicked_at TIMESTAMP,
  delivery_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (delivery_status IN (
    'pending', 'sent', 'delivered', 'failed', 'expired', 'dismissed'
  )),
  delivery_attempts INTEGER DEFAULT 0,
  last_error_message TEXT
);

CREATE INDEX idx_push_notifications_user_id ON push_notifications(user_id);
CREATE INDEX idx_push_notifications_created_at ON push_notifications(created_at);
CREATE INDEX idx_push_notifications_delivery_status ON push_notifications(delivery_status);
CREATE INDEX idx_push_notifications_scheduled_for ON push_notifications(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX idx_push_notifications_expires_at ON push_notifications(expires_at);
CREATE INDEX idx_push_notifications_category ON push_notifications(category);

-- ============================================
-- NOTIFICATION ANALYTICS
-- ============================================

CREATE TABLE IF NOT EXISTS notification_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES push_notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,
  clicked_at TIMESTAMP,
  channel VARCHAR(50) NOT NULL CHECK (channel IN ('browser', 'in_app', 'email', 'sms')),
  device_type VARCHAR(50),
  os_type VARCHAR(100),
  user_action VARCHAR(50) NOT NULL CHECK (user_action IN (
    'delivered', 'read', 'clicked', 'dismissed', 'failed'
  )),
  delay_ms INTEGER,
  deep_link_followed VARCHAR(500),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_analytics_notification_id ON notification_analytics(notification_id);
CREATE INDEX idx_notification_analytics_user_id ON notification_analytics(user_id);
CREATE INDEX idx_notification_analytics_user_action ON notification_analytics(user_action);
CREATE INDEX idx_notification_analytics_created_at ON notification_analytics(created_at);
CREATE INDEX idx_notification_analytics_channel ON notification_analytics(channel);

-- ============================================
-- NOTIFICATION TEMPLATES
-- ============================================

CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'case_update', 'message', 'alert', 'document', 'appointment', 'payment', 'system', 'marketing'
  )),
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  image_url VARCHAR(500),
  action_buttons JSONB DEFAULT '[]'::JSONB,
  variables TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_templates_category ON notification_templates(category);
CREATE INDEX idx_notification_templates_name ON notification_templates(name);

-- ============================================
-- NOTIFICATION HISTORY (for audit trail)
-- ============================================

CREATE TABLE IF NOT EXISTS notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES push_notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
    'created', 'scheduled', 'sent', 'delivered', 'failed', 'read', 'clicked', 'dismissed'
  )),
  event_details JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_history_notification_id ON notification_history(notification_id);
CREATE INDEX idx_notification_history_user_id ON notification_history(user_id);
CREATE INDEX idx_notification_history_event_type ON notification_history(event_type);
CREATE INDEX idx_notification_history_created_at ON notification_history(created_at);

-- ============================================
-- BATCH NOTIFICATION JOBS
-- ============================================

CREATE TABLE IF NOT EXISTS notification_batch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  total_users INTEGER NOT NULL,
  total_sent INTEGER DEFAULT 0,
  total_failed INTEGER DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed'
  )),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT
);

CREATE INDEX idx_notification_batch_jobs_status ON notification_batch_jobs(status);
CREATE INDEX idx_notification_batch_jobs_created_at ON notification_batch_jobs(created_at);

-- ============================================
-- CLEANUP: Expired Notifications
-- ============================================

-- Function to automatically delete expired notifications
CREATE OR REPLACE FUNCTION cleanup_expired_notifications() RETURNS void AS $$
BEGIN
  DELETE FROM push_notifications
  WHERE expires_at < CURRENT_TIMESTAMP
  AND created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup job (run daily at 2 AM using pg_cron if available)
-- SELECT cron.schedule('cleanup-expired-notifications', '0 2 * * *', 'SELECT cleanup_expired_notifications()');

-- ============================================
-- STATISTICS & VIEWS
-- ============================================

-- View for notification delivery statistics
CREATE OR REPLACE VIEW v_notification_stats AS
SELECT
  DATE_TRUNC('day', created_at) as date,
  category,
  COUNT(*) as total_sent,
  COUNT(CASE WHEN delivery_status = 'delivered' THEN 1 END) as delivered,
  COUNT(CASE WHEN read_at IS NOT NULL THEN 1 END) as read,
  COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as clicked,
  COUNT(CASE WHEN delivery_status = 'failed' THEN 1 END) as failed,
  ROUND(
    COUNT(CASE WHEN delivery_status = 'delivered' THEN 1 END)::NUMERIC /
    NULLIF(COUNT(*), 0) * 100, 2
  ) as delivery_rate,
  ROUND(
    COUNT(CASE WHEN read_at IS NOT NULL THEN 1 END)::NUMERIC /
    NULLIF(COUNT(*), 0) * 100, 2
  ) as read_rate,
  ROUND(
    COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END)::NUMERIC /
    NULLIF(COUNT(*), 0) * 100, 2
  ) as click_rate
FROM push_notifications
GROUP BY DATE_TRUNC('day', created_at), category;

-- View for user notification engagement
CREATE OR REPLACE VIEW v_user_notification_engagement AS
SELECT
  user_id,
  COUNT(DISTINCT notification_id) as total_received,
  COUNT(DISTINCT CASE WHEN user_action = 'read' THEN notification_id END) as total_read,
  COUNT(DISTINCT CASE WHEN user_action = 'clicked' THEN notification_id END) as total_clicked,
  ROUND(
    COUNT(DISTINCT CASE WHEN user_action IN ('read', 'clicked') THEN notification_id END)::NUMERIC /
    NULLIF(COUNT(DISTINCT notification_id), 0) * 100, 2
  ) as engagement_rate,
  AVG(delay_ms) as avg_delivery_delay_ms,
  MAX(created_at) as last_notification_at
FROM notification_analytics
GROUP BY user_id;
