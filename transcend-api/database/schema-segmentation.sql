-- User Segmentation & Personalized Journeys Schema
-- Comprehensive tables for user segmentation, CTA management, A/B testing, and analytics

-- ============================================
-- USER SEGMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS user_segments (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  lifecycle VARCHAR(20) CHECK (lifecycle IN ('new', 'active', 'at-risk', 'loyal', 'churned')),
  value VARCHAR(10) CHECK (value IN ('high', 'medium', 'low')),
  engagement VARCHAR(10) CHECK (engagement IN ('high', 'medium', 'low', 'inactive')),
  service_types JSONB DEFAULT '[]',
  behavior_patterns JSONB DEFAULT '[]',
  risk_factors JSONB DEFAULT '[]',
  recommended_ctas JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_segments_user_id (user_id),
  INDEX idx_user_segments_lifecycle (lifecycle),
  INDEX idx_user_segments_value (value),
  INDEX idx_user_segments_engagement (engagement)
);

-- ============================================
-- RECOMMENDED CTAs TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS recommended_ctas (
  id UUID PRIMARY KEY,
  segment_type VARCHAR(20),
  value_tier VARCHAR(10),
  action VARCHAR(50) NOT NULL,
  text TEXT NOT NULL,
  description TEXT,
  priority VARCHAR(10) CHECK (priority IN ('high', 'medium', 'low')),
  conversion_rate DECIMAL(5, 4) DEFAULT 0,
  impression_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  revenue_generated DECIMAL(15, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  variant VARCHAR(50),
  ab_test_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_recommended_ctas_segment (segment_type),
  INDEX idx_recommended_ctas_active (is_active),
  INDEX idx_recommended_ctas_priority (priority)
);

-- ============================================
-- CTA INTERACTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS cta_interactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cta_id UUID NOT NULL REFERENCES recommended_ctas(id) ON DELETE CASCADE,
  action VARCHAR(20) CHECK (action IN ('shown', 'clicked', 'converted')) NOT NULL,
  session_id VARCHAR(100),
  device_type VARCHAR(50),
  browser VARCHAR(100),
  referrer TEXT,
  conversion_value DECIMAL(15, 2),
  conversion_time_seconds INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cta_interactions_user_id (user_id),
  INDEX idx_cta_interactions_cta_id (cta_id),
  INDEX idx_cta_interactions_action (action),
  INDEX idx_cta_interactions_created_at (created_at),
  INDEX idx_cta_interactions_conversion (CASE WHEN action = 'converted' THEN 1 END)
);

-- ============================================
-- PERSONALIZED JOURNEYS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS personalized_journeys (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES user_segments(id) ON DELETE CASCADE,
  journey_stage VARCHAR(50),
  recommended_content JSONB DEFAULT '[]',
  next_steps JSONB DEFAULT '[]',
  estimated_time_to_conversion INTEGER,
  success_probability DECIMAL(5, 2),
  progress DECIMAL(5, 2) DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  INDEX idx_journeys_user_id (user_id),
  INDEX idx_journeys_stage (journey_stage),
  INDEX idx_journeys_completed (completed)
);

-- ============================================
-- CONTENT RECOMMENDATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS content_recommendations (
  id UUID PRIMARY KEY,
  segment_type VARCHAR(20),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) CHECK (type IN ('guide', 'video', 'case-study', 'webinar', 'resource', 'article', 'tutorial')),
  content_url VARCHAR(255),
  relevance_score DECIMAL(5, 2),
  estimated_read_time INTEGER,
  view_count INTEGER DEFAULT 0,
  engagement_score DECIMAL(5, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_content_recommendations_segment (segment_type),
  INDEX idx_content_recommendations_type (type),
  INDEX idx_content_recommendations_active (is_active)
);

-- ============================================
-- A/B TESTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS ab_tests (
  id UUID PRIMARY KEY,
  test_name VARCHAR(255) NOT NULL,
  segment VARCHAR(20),
  variant1_cta JSONB NOT NULL,
  variant1_weight DECIMAL(5, 2) DEFAULT 0.5,
  variant2_cta JSONB NOT NULL,
  variant2_weight DECIMAL(5, 2) DEFAULT 0.5,
  variant1_results JSONB DEFAULT '{"impressions": 0, "clicks": 0, "conversions": 0, "revenue": 0, "conversionRate": 0, "cpc": 0, "roas": 0}',
  variant2_results JSONB DEFAULT '{"impressions": 0, "clicks": 0, "conversions": 0, "revenue": 0, "conversionRate": 0, "cpc": 0, "roas": 0}',
  status VARCHAR(20) CHECK (status IN ('active', 'paused', 'completed')) DEFAULT 'active',
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  winner VARCHAR(20),
  uplift DECIMAL(8, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ab_tests_segment (segment),
  INDEX idx_ab_tests_status (status),
  INDEX idx_ab_tests_start_date (start_date)
);

-- ============================================
-- A/B TEST ASSIGNMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS ab_test_assignments (
  id UUID PRIMARY KEY,
  test_id UUID NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  variant VARCHAR(20) CHECK (variant IN ('variant1', 'variant2')) NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_assignments_test_id (test_id),
  INDEX idx_assignments_user_id (user_id),
  INDEX idx_assignments_variant (variant)
);

-- ============================================
-- SEGMENT PERFORMANCE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS segment_performance (
  id UUID PRIMARY KEY,
  segment_id UUID NOT NULL REFERENCES user_segments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  segment VARCHAR(20),
  value VARCHAR(10),
  ctas_shown INTEGER DEFAULT 0,
  ctas_clicked INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  conversion_rate DECIMAL(8, 4) DEFAULT 0,
  revenue DECIMAL(15, 2) DEFAULT 0,
  retention INTEGER,
  churn_risk DECIMAL(5, 2) DEFAULT 0,
  engagement_score DECIMAL(5, 2) DEFAULT 0,
  ltv_estimate DECIMAL(15, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_performance_segment_id (segment_id),
  INDEX idx_performance_user_id (user_id),
  INDEX idx_performance_segment (segment),
  INDEX idx_performance_created_at (created_at)
);

-- ============================================
-- SEGMENTATION METRICS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS segmentation_metrics (
  id UUID PRIMARY KEY,
  total_users INTEGER,
  segment_distribution JSONB,
  lifecycle_breakdown JSONB,
  value_breakdown JSONB,
  engagement_breakdown JSONB,
  average_conversion_rate DECIMAL(8, 4),
  average_churn_risk DECIMAL(5, 2),
  top_risk_factors JSONB,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_metrics_generated_at (generated_at)
);

-- ============================================
-- ADMIN SEGMENTATION DASHBOARD TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS admin_segmentation_dashboards (
  id UUID PRIMARY KEY,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metrics_snapshot JSONB,
  top_performing_ctas JSONB,
  underperforming_segments JSONB,
  recommended_actions JSONB,
  active_ab_tests JSONB,
  churn_prediction_accuracy DECIMAL(5, 2),
  ltv_prediction_accuracy DECIMAL(5, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dashboards_generated_at (generated_at)
);

-- ============================================
-- USER ACTIVITY TABLE (for behavior tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS user_activities (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  service_type VARCHAR(50),
  metadata JSONB,
  session_id VARCHAR(100),
  device_type VARCHAR(50),
  browser VARCHAR(100),
  ip_address VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_activities_user_id (user_id),
  INDEX idx_activities_action_type (action_type),
  INDEX idx_activities_created_at (created_at),
  INDEX idx_activities_service_type (service_type)
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX idx_user_segments_created_at ON user_segments(created_at);
CREATE INDEX idx_user_segments_last_updated ON user_segments(last_updated);
CREATE INDEX idx_cta_interactions_user_cta ON cta_interactions(user_id, cta_id);
CREATE INDEX idx_cta_interactions_user_action ON cta_interactions(user_id, action);
CREATE INDEX idx_cta_interactions_timestamp_range ON cta_interactions(user_id, created_at) WHERE created_at > NOW() - INTERVAL '90 days';
CREATE INDEX idx_segment_performance_timestamp ON segment_performance(segment_id, created_at DESC);
CREATE INDEX idx_journeys_user_progress ON personalized_journeys(user_id, progress, completed);
CREATE INDEX idx_recommended_ctas_conversion ON recommended_ctas(segment_type, conversion_rate DESC);
CREATE INDEX idx_ab_tests_active_segment ON ab_tests(status, segment) WHERE status = 'active';
CREATE INDEX idx_performance_metrics ON segment_performance(churn_risk DESC, conversion_rate ASC) WHERE created_at > NOW() - INTERVAL '30 days';

-- ============================================
-- MATERIALIZED VIEW FOR SEGMENT SUMMARY
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS segment_summary AS
SELECT
  us.id,
  us.user_id,
  us.lifecycle,
  us.value,
  us.engagement,
  COUNT(DISTINCT ci.id) as total_cta_interactions,
  COUNT(DISTINCT CASE WHEN ci.action = 'clicked' THEN ci.id END) as cta_clicks,
  COUNT(DISTINCT CASE WHEN ci.action = 'converted' THEN ci.id END) as conversions,
  AVG(CASE WHEN ci.action = 'shown' THEN 1 ELSE 0 END) as click_rate,
  COALESCE(SUM(CASE WHEN ci.action = 'converted' THEN ci.conversion_value ELSE 0 END), 0) as total_revenue,
  MAX(ci.created_at) as last_interaction,
  us.created_at,
  us.last_updated
FROM user_segments us
LEFT JOIN cta_interactions ci ON us.user_id = ci.user_id
GROUP BY us.id, us.user_id, us.lifecycle, us.value, us.engagement, us.created_at, us.last_updated;

-- ============================================
-- STORED PROCEDURES
-- ============================================

-- Function to refresh user segment
CREATE OR REPLACE FUNCTION refresh_user_segment(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE user_segments
  SET last_updated = CURRENT_TIMESTAMP
  WHERE user_id = p_user_id;

  REFRESH MATERIALIZED VIEW segment_summary;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate segment metrics
CREATE OR REPLACE FUNCTION calculate_segment_metrics()
RETURNS void AS $$
BEGIN
  INSERT INTO segmentation_metrics (
    id,
    total_users,
    segment_distribution,
    lifecycle_breakdown,
    value_breakdown,
    engagement_breakdown,
    average_conversion_rate,
    average_churn_risk,
    generated_at
  )
  SELECT
    gen_random_uuid(),
    COUNT(DISTINCT user_id),
    jsonb_object_agg(lifecycle, COUNT(*)) FILTER (WHERE lifecycle IS NOT NULL),
    jsonb_object_agg(lifecycle, COUNT(*)) FILTER (WHERE lifecycle IS NOT NULL),
    jsonb_object_agg(value, COUNT(*)) FILTER (WHERE value IS NOT NULL),
    jsonb_object_agg(engagement, COUNT(*)) FILTER (WHERE engagement IS NOT NULL),
    AVG(COALESCE((sp.conversion_rate)::numeric, 0)),
    AVG(COALESCE(sp.churn_risk, 0)),
    CURRENT_TIMESTAMP
  FROM user_segments us
  LEFT JOIN segment_performance sp ON us.id = sp.segment_id
  WHERE sp.created_at > NOW() - INTERVAL '30 days' OR sp.id IS NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger to update segment on user activity
CREATE OR REPLACE FUNCTION trigger_update_segment()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE user_segments
  SET last_updated = CURRENT_TIMESTAMP
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_segment_on_activity
AFTER INSERT ON user_activities
FOR EACH ROW
EXECUTE FUNCTION trigger_update_segment();

-- Trigger to update CTA conversion metrics
CREATE OR REPLACE FUNCTION trigger_update_cta_metrics()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.action = 'shown' THEN
    UPDATE recommended_ctas
    SET impression_count = impression_count + 1
    WHERE id = NEW.cta_id;
  ELSIF NEW.action = 'clicked' THEN
    UPDATE recommended_ctas
    SET click_count = click_count + 1,
        conversion_rate = CAST(click_count + 1 AS DECIMAL) / NULLIF(impression_count, 0)
    WHERE id = NEW.cta_id;
  ELSIF NEW.action = 'converted' THEN
    UPDATE recommended_ctas
    SET conversion_count = conversion_count + 1,
        revenue_generated = revenue_generated + COALESCE(NEW.conversion_value, 0),
        conversion_rate = CAST(conversion_count + 1 AS DECIMAL) / NULLIF(impression_count, 0)
    WHERE id = NEW.cta_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cta_metrics
AFTER INSERT ON cta_interactions
FOR EACH ROW
EXECUTE FUNCTION trigger_update_cta_metrics();
