-- Migration 004: Create admin_requests and admin_request_audit_log tables
-- Purpose: Add full database support for admin request management system
-- Created: 2026-08-15

BEGIN;

-- Create admin_requests table
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

-- Create admin_request_audit_log table
CREATE TABLE IF NOT EXISTS admin_request_audit_log (
  id SERIAL PRIMARY KEY,

  request_id UUID NOT NULL REFERENCES admin_requests(id) ON DELETE CASCADE,
  admin_id INT REFERENCES admin_users(id),

  -- What changed
  action_type VARCHAR(100),  -- CREATED, STATUS_CHANGED, PROGRESS_UPDATE, COMPLETED, ARCHIVED
  old_values JSONB,
  new_values JSONB,

  -- Timeline
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for admin_requests
CREATE INDEX IF NOT EXISTS idx_admin_request_status ON admin_requests(status);
CREATE INDEX IF NOT EXISTS idx_admin_request_type ON admin_requests(type);
CREATE INDEX IF NOT EXISTS idx_admin_request_priority ON admin_requests(priority);
CREATE INDEX IF NOT EXISTS idx_admin_request_created ON admin_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_request_assigned ON admin_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_admin_request_archived ON admin_requests(archived);
CREATE INDEX IF NOT EXISTS idx_admin_request_requested_by ON admin_requests(requested_by);

-- Create indexes for admin_request_audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_request ON admin_request_audit_log(request_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON admin_request_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON admin_request_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON admin_request_audit_log(created_at DESC);

-- Create view for dashboard summary
CREATE OR REPLACE VIEW admin_requests_summary AS
SELECT
  status,
  COUNT(*) as request_count,
  AVG(completion_percentage) as avg_completion,
  COUNT(CASE WHEN priority = 'critical' THEN 1 END) as critical_count
FROM admin_requests
WHERE archived = FALSE
GROUP BY status;

COMMIT;

SELECT '✅ Admin Requests Migration 004 Applied Successfully' as status;
