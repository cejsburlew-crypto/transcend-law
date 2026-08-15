-- TRANSCEND LAW - ADMIN DASHBOARD & OPERATIONS SCHEMA
-- System monitoring, professional management, support tickets

BEGIN TRANSACTION;

-- ============================================================================
-- ADMIN USERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,

  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),

  -- Role & permissions
  role VARCHAR(50),  -- SUPER_ADMIN, ADMIN, MODERATOR, SUPPORT
  permissions JSONB,  -- Array of permission strings

  status VARCHAR(50) DEFAULT 'ACTIVE',
  last_login TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- SYSTEM METRICS TABLE - Real-time dashboard metrics
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_metrics (
  id SERIAL PRIMARY KEY,

  metric_date DATE,
  metric_hour INT,

  -- Transaction metrics
  transactions_today INT DEFAULT 0,
  transactions_this_month INT DEFAULT 0,
  gross_volume_today DECIMAL(15,2) DEFAULT 0,
  gross_volume_this_month DECIMAL(15,2) DEFAULT 0,

  -- Professional metrics
  active_professionals INT DEFAULT 0,
  new_signups_today INT DEFAULT 0,
  new_signups_this_month INT DEFAULT 0,

  -- Revenue metrics
  platform_revenue_today DECIMAL(15,2) DEFAULT 0,
  commissions_paid_today DECIMAL(15,2) DEFAULT 0,

  -- Performance
  avg_response_time_ms INT,
  api_errors_today INT DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- PROFESSIONAL MANAGEMENT TABLE - Admin actions on professionals
-- ============================================================================

CREATE TABLE IF NOT EXISTS professional_management_actions (
  id SERIAL PRIMARY KEY,

  professional_id INT NOT NULL,
  profession_type VARCHAR(100),

  -- Action
  action_type VARCHAR(100),  -- APPROVE, SUSPEND, REACTIVATE, REMOVE, RESTRICT
  reason TEXT,

  -- Admin info
  admin_id INT REFERENCES admin_users(id),
  action_date TIMESTAMP DEFAULT NOW(),

  -- Status
  status VARCHAR(50) DEFAULT 'ACTIVE',  -- ACTIVE, PENDING_REVIEW, OVERTURNED, EXPIRED
  review_date TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- SUPPORT TICKETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS support_tickets (
  id SERIAL PRIMARY KEY,

  ticket_id VARCHAR(100) UNIQUE NOT NULL,

  -- Requester
  requester_id INT,
  requester_type VARCHAR(100),  -- PROFESSIONAL, ATTORNEY, ADMIN

  -- Issue
  issue_category VARCHAR(100),  -- PAYMENT, REFERRAL, TECHNICAL, COMPLIANCE, OTHER
  subject TEXT,
  description TEXT,

  -- Status
  status VARCHAR(50) DEFAULT 'OPEN',  -- OPEN, IN_PROGRESS, WAITING_INFO, RESOLVED, CLOSED
  priority INT DEFAULT 5,  -- 1-10

  -- Assignment
  assigned_to INT REFERENCES admin_users(id),

  -- Timeline
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  response_time_hours INT,

  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- AUDIT LOG TABLE - Track all admin actions
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,

  admin_id INT REFERENCES admin_users(id),
  action_type VARCHAR(100),
  entity_type VARCHAR(100),  -- PROFESSIONAL, TRANSACTION, DISPUTE, etc.
  entity_id INT,

  -- What changed
  changes_made TEXT,  -- JSON of before/after

  status VARCHAR(50),  -- SUCCESS, FAILED, PENDING
  ip_address VARCHAR(50),

  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- OPERATIONAL ALERTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS operational_alerts (
  id SERIAL PRIMARY KEY,

  alert_type VARCHAR(100),  -- THRESHOLD_EXCEEDED, SYSTEM_ERROR, SECURITY, COMPLIANCE
  severity VARCHAR(50),  -- INFO, WARNING, CRITICAL

  -- Details
  message TEXT,
  affected_resource VARCHAR(100),

  -- Thresholds that triggered it
  metric_name VARCHAR(100),
  threshold_value DECIMAL(15,2),
  current_value DECIMAL(15,2),

  -- Status
  status VARCHAR(50) DEFAULT 'ACTIVE',
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by INT REFERENCES admin_users(id),
  acknowledged_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- REFERRAL MONITORING TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS referral_monitoring (
  id SERIAL PRIMARY KEY,

  referral_id INT,
  transaction_id INT REFERENCES transactions(id),

  -- Quality tracking
  quality_flag VARCHAR(100),  -- HIGH_VALUE, COMPLEX, AT_RISK, DELAYED, COMPLETED
  monitoring_reason TEXT,

  -- Timeline
  flagged_date TIMESTAMP,
  last_check_date TIMESTAMP,
  completion_date TIMESTAMP,

  -- Notes
  admin_notes TEXT,

  status VARCHAR(50) DEFAULT 'ACTIVE',

  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- ADMIN REQUESTS TABLE - Feature requests, bug reports, enhancements
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_requests (
  id UUID PRIMARY KEY,

  -- Request metadata
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,  -- feature, bug, enhancement, infrastructure
  priority VARCHAR(50) NOT NULL,  -- low, medium, high, critical

  -- Requester info
  requested_by VARCHAR(255),
  requested_at TIMESTAMP NOT NULL,

  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending',  -- pending, in_progress, completed, cancelled, on_hold
  completion_percentage INT DEFAULT 0,

  -- Timeline
  estimated_completion TIMESTAMP,
  completed_at TIMESTAMP,

  -- Metadata
  assigned_to INT REFERENCES admin_users(id),
  tags JSONB,  -- Array of tags for categorization
  archived BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- ADMIN REQUEST AUDIT LOG TABLE - Track changes to requests
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_request_audit_log (
  id SERIAL PRIMARY KEY,

  request_id UUID NOT NULL REFERENCES admin_requests(id) ON DELETE CASCADE,
  admin_id INT REFERENCES admin_users(id),

  -- What changed
  action_type VARCHAR(100),  -- CREATED, STATUS_CHANGED, PROGRESS_UPDATE, COMPLETED
  old_values JSONB,
  new_values JSONB,

  -- Timeline
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_admin_role ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_metrics_date ON system_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_action_professional ON professional_management_actions(professional_id);
CREATE INDEX IF NOT EXISTS idx_ticket_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_ticket_assigned ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_audit_admin ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_alert_status ON operational_alerts(status);
CREATE INDEX IF NOT EXISTS idx_monitoring_referral ON referral_monitoring(transaction_id);
CREATE INDEX IF NOT EXISTS idx_admin_request_status ON admin_requests(status);
CREATE INDEX IF NOT EXISTS idx_admin_request_type ON admin_requests(type);
CREATE INDEX IF NOT EXISTS idx_admin_request_priority ON admin_requests(priority);
CREATE INDEX IF NOT EXISTS idx_admin_request_created ON admin_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_request_assigned ON admin_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_admin_request_archived ON admin_requests(archived);
CREATE INDEX IF NOT EXISTS idx_audit_log_request ON admin_request_audit_log(request_id);

-- ============================================================================
-- VIEWS FOR DASHBOARDS
-- ============================================================================

CREATE OR REPLACE VIEW admin_dashboard_snapshot AS
SELECT
  (SELECT COUNT(*) FROM professional_profiles WHERE status = 'ACTIVE') as active_professionals,
  (SELECT COUNT(*) FROM transactions WHERE DATE(created_at) = CURRENT_DATE) as transactions_today,
  (SELECT SUM(service_amount) FROM transactions WHERE DATE(created_at) = CURRENT_DATE) as volume_today,
  (SELECT COUNT(*) FROM support_tickets WHERE status IN ('OPEN', 'IN_PROGRESS')) as open_tickets,
  (SELECT COUNT(*) FROM disputes WHERE status IN ('OPEN', 'UNDER_REVIEW')) as open_disputes,
  (SELECT COUNT(*) FROM operational_alerts WHERE status = 'ACTIVE' AND acknowledged = FALSE) as unack_alerts;

CREATE OR REPLACE VIEW professional_action_summary AS
SELECT
  action_type,
  COUNT(*) as action_count,
  DATE(action_date) as action_date
FROM professional_management_actions
WHERE status = 'ACTIVE'
GROUP BY action_type, DATE(action_date)
ORDER BY DATE(action_date) DESC;

CREATE OR REPLACE VIEW support_ticket_summary AS
SELECT
  status,
  COUNT(*) as ticket_count,
  AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600)::INT as avg_resolution_hours
FROM support_tickets
GROUP BY status;

COMMIT;

SELECT 'Admin Dashboard Schema Created Successfully' as status;
\dt admin_users system_metrics professional_management_actions support_tickets
\dt audit_logs operational_alerts referral_monitoring
\dv admin_dashboard_snapshot professional_action_summary support_ticket_summary
