-- ============================================
-- SELLER PERFORMANCE METRICS SCHEMA
-- ============================================

-- Main sellers table (if not already exists)
CREATE TABLE IF NOT EXISTS sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  service_type VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),

  -- Performance metrics
  rating_score DECIMAL(3, 2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  defect_rate DECIMAL(5, 2) DEFAULT 0,
  on_time_delivery_rate DECIMAL(5, 2) DEFAULT 0,
  cancellation_rate DECIMAL(5, 2) DEFAULT 0,
  response_rate DECIMAL(5, 2) DEFAULT 0,
  avg_response_time INTEGER DEFAULT 0, -- in minutes

  -- Transaction metrics
  total_transactions INTEGER DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,

  -- Account management
  subscription_status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT sellers_service_type_check CHECK (service_type != '')
);

-- Create indexes for performance queries
CREATE INDEX IF NOT EXISTS idx_sellers_service_type ON sellers(service_type);
CREATE INDEX IF NOT EXISTS idx_sellers_rating_score ON sellers(rating_score DESC);
CREATE INDEX IF NOT EXISTS idx_sellers_subscription ON sellers(subscription_status);
CREATE INDEX IF NOT EXISTS idx_sellers_created ON sellers(created_at DESC);

-- Historical metrics tracking for trends
CREATE TABLE IF NOT EXISTS seller_metrics_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,

  -- Metrics snapshot
  rating_score DECIMAL(3, 2),
  defect_rate DECIMAL(5, 2),
  on_time_delivery_rate DECIMAL(5, 2),
  cancellation_rate DECIMAL(5, 2),
  response_rate DECIMAL(5, 2),

  -- Context
  transaction_count INTEGER,
  review_count INTEGER,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_history_provider ON seller_metrics_history(provider_id);
CREATE INDEX IF NOT EXISTS idx_metrics_history_created ON seller_metrics_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_history_date_range ON seller_metrics_history(provider_id, created_at DESC);

-- Performance alerts table
CREATE TABLE IF NOT EXISTS performance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,

  -- Alert details
  alert_type VARCHAR(50) NOT NULL, -- low_rating, high_defect_rate, poor_delivery, etc.
  severity VARCHAR(20) NOT NULL, -- info, warning, critical
  message TEXT NOT NULL,
  metric VARCHAR(100) NOT NULL,
  current_value DECIMAL(10, 2),
  threshold DECIMAL(10, 2),
  recommended_action TEXT,

  -- Tracking
  created_at TIMESTAMP DEFAULT NOW(),
  acknowledged_at TIMESTAMP,
  resolved_at TIMESTAMP,

  CONSTRAINT performance_alerts_severity_check CHECK (severity IN ('info', 'warning', 'critical')),
  CONSTRAINT performance_alerts_type_check CHECK (alert_type IN (
    'low_rating',
    'high_defect_rate',
    'poor_delivery',
    'high_cancellation',
    'low_response_rate',
    'declining_trend'
  ))
);

CREATE INDEX IF NOT EXISTS idx_alerts_provider ON performance_alerts(provider_id);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON performance_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_acknowledged ON performance_alerts(acknowledged_at);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON performance_alerts(created_at DESC);

-- Improvement suggestions table
CREATE TABLE IF NOT EXISTS improvement_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,

  -- Suggestion details
  category VARCHAR(50) NOT NULL, -- quality, speed, reliability, communication, customer_satisfaction
  suggestion TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL, -- low, medium, high

  -- Impact estimation
  estimated_impact INTEGER, -- percentage improvement potential
  implementation_difficulty VARCHAR(20), -- easy, medium, hard

  -- Resources and success metrics
  resources_needed JSONB DEFAULT '[]'::jsonb,
  success_metrics JSONB DEFAULT '[]'::jsonb,

  -- Status tracking
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  completed BOOLEAN DEFAULT FALSE,

  CONSTRAINT improvement_suggestions_category_check CHECK (category IN (
    'quality',
    'speed',
    'reliability',
    'communication',
    'customer_satisfaction'
  )),
  CONSTRAINT improvement_suggestions_priority_check CHECK (priority IN ('low', 'medium', 'high')),
  CONSTRAINT improvement_suggestions_difficulty_check CHECK (implementation_difficulty IN ('easy', 'medium', 'hard'))
);

CREATE INDEX IF NOT EXISTS idx_suggestions_provider ON improvement_suggestions(provider_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_category ON improvement_suggestions(category);
CREATE INDEX IF NOT EXISTS idx_suggestions_priority ON improvement_suggestions(priority);
CREATE INDEX IF NOT EXISTS idx_suggestions_completed ON improvement_suggestions(completed);
CREATE INDEX IF NOT EXISTS idx_suggestions_created ON improvement_suggestions(created_at DESC);

-- Benchmark comparisons table (cache)
CREATE TABLE IF NOT EXISTS benchmark_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  service_type VARCHAR(100) NOT NULL,

  -- Cached benchmark data
  metric_name VARCHAR(100),
  your_value DECIMAL(10, 2),
  category_average DECIMAL(10, 2),
  percentile DECIMAL(5, 2),

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '1 day',

  CONSTRAINT benchmark_cache_unique UNIQUE(provider_id, service_type, metric_name)
);

CREATE INDEX IF NOT EXISTS idx_benchmark_cache_provider ON benchmark_cache(provider_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_cache_service ON benchmark_cache(service_type);
CREATE INDEX IF NOT EXISTS idx_benchmark_cache_expires ON benchmark_cache(expires_at);

-- Performance targets table
CREATE TABLE IF NOT EXISTS performance_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  service_type VARCHAR(100) NOT NULL,

  -- Monthly targets
  target_rating DECIMAL(3, 2) DEFAULT 4.8,
  target_defect_rate DECIMAL(5, 2) DEFAULT 2.0,
  target_on_time_rate DECIMAL(5, 2) DEFAULT 95.0,
  target_response_rate DECIMAL(5, 2) DEFAULT 95.0,
  target_cancellation_rate DECIMAL(5, 2) DEFAULT 2.0,

  -- Period
  month INTEGER,
  year INTEGER,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT performance_targets_unique UNIQUE(provider_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_targets_provider ON performance_targets(provider_id);
CREATE INDEX IF NOT EXISTS idx_targets_period ON performance_targets(year, month);

-- Competitor analysis table
CREATE TABLE IF NOT EXISTS competitor_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
  competing_provider_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,

  -- Comparison metrics
  rating_difference DECIMAL(3, 2),
  delivery_rate_difference DECIMAL(5, 2),
  response_time_difference INTEGER,
  price_difference DECIMAL(10, 2),

  -- Analysis
  competitive_advantage TEXT,
  improvement_areas TEXT,

  analyzed_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT competitor_analysis_different_providers CHECK (provider_id != competing_provider_id)
);

CREATE INDEX IF NOT EXISTS idx_competitor_analysis_provider ON competitor_analysis(provider_id);
CREATE INDEX IF NOT EXISTS idx_competitor_analysis_competitor ON competitor_analysis(competing_provider_id);

-- Performance badges/achievements table
CREATE TABLE IF NOT EXISTS performance_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,

  -- Badge definition
  badge_type VARCHAR(100) NOT NULL, -- top_performer, on_time_master, quality_champion, etc.
  badge_name VARCHAR(255) NOT NULL,
  badge_description TEXT,

  -- Achievement tracking
  earned_at TIMESTAMP DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE,
  tier VARCHAR(20), -- gold, silver, bronze

  CONSTRAINT performance_badges_unique UNIQUE(provider_id, badge_type, tier)
);

CREATE INDEX IF NOT EXISTS idx_badges_provider ON performance_badges(provider_id);
CREATE INDEX IF NOT EXISTS idx_badges_type ON performance_badges(badge_type);
CREATE INDEX IF NOT EXISTS idx_badges_active ON performance_badges(active);

-- Notification log for alerts
CREATE TABLE IF NOT EXISTS seller_alert_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES performance_alerts(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,

  -- Notification details
  notification_type VARCHAR(50) NOT NULL, -- email, sms, in_app
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, read, acknowledged

  -- Content
  subject VARCHAR(255),
  message TEXT,

  -- Tracking
  sent_at TIMESTAMP,
  read_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_notifications_provider ON seller_alert_notifications(provider_id);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_alert ON seller_alert_notifications(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_notifications_status ON seller_alert_notifications(status);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to calculate performance score
CREATE OR REPLACE FUNCTION calculate_performance_score(
  rating_score DECIMAL,
  defect_rate DECIMAL,
  on_time_rate DECIMAL,
  cancellation_rate DECIMAL,
  response_rate DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  score DECIMAL := 100;
BEGIN
  -- Rating component (max 40 points)
  score := score + (rating_score / 5.0) * 40;

  -- Defect rate component (max 20 points, lower is better)
  score := score - (defect_rate / 100.0) * 20;

  -- On-time delivery (max 20 points)
  score := score + (on_time_rate / 100.0) * 20;

  -- Cancellation rate (max 10 points, lower is better)
  score := score - (cancellation_rate / 100.0) * 10;

  -- Response rate (max 10 points)
  score := score + (response_rate / 100.0) * 10;

  RETURN LEAST(100, GREATEST(0, score));
END;
$$ LANGUAGE plpgsql;

-- Function to detect performance alerts
CREATE OR REPLACE FUNCTION check_performance_alerts(
  provider_id_param UUID
) RETURNS TABLE(alert_type VARCHAR, severity VARCHAR, message TEXT, metric VARCHAR, current_value DECIMAL, threshold DECIMAL) AS $$
BEGIN
  -- Check for low rating
  RETURN QUERY
  SELECT
    'low_rating'::VARCHAR as alert_type,
    'warning'::VARCHAR as severity,
    'Rating has fallen below target'::TEXT as message,
    'rating_score'::VARCHAR as metric,
    (SELECT rating_score FROM sellers WHERE id = provider_id_param),
    4.0::DECIMAL as threshold
  WHERE EXISTS (
    SELECT 1 FROM sellers WHERE id = provider_id_param AND rating_score < 4.0
  );

  -- Check for high defect rate
  RETURN QUERY
  SELECT
    'high_defect_rate'::VARCHAR,
    CASE WHEN (SELECT defect_rate FROM sellers WHERE id = provider_id_param) > 10 THEN 'critical'::VARCHAR ELSE 'warning'::VARCHAR END,
    'Defect rate is above acceptable levels'::TEXT,
    'defect_rate'::VARCHAR,
    (SELECT defect_rate FROM sellers WHERE id = provider_id_param),
    5.0::DECIMAL
  WHERE EXISTS (
    SELECT 1 FROM sellers WHERE id = provider_id_param AND defect_rate > 5
  );

  -- Check for poor on-time delivery
  RETURN QUERY
  SELECT
    'poor_delivery'::VARCHAR,
    'warning'::VARCHAR,
    'On-time delivery rate is below target'::TEXT,
    'on_time_delivery_rate'::VARCHAR,
    (SELECT on_time_delivery_rate FROM sellers WHERE id = provider_id_param),
    85.0::DECIMAL
  WHERE EXISTS (
    SELECT 1 FROM sellers WHERE id = provider_id_param AND on_time_delivery_rate < 85
  );
END;
$$ LANGUAGE plpgsql;

-- Trigger to update seller's updated_at timestamp
CREATE OR REPLACE FUNCTION update_seller_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sellers_update_timestamp
BEFORE UPDATE ON sellers
FOR EACH ROW
EXECUTE FUNCTION update_seller_timestamp();

-- ============================================
-- GRANTS
-- ============================================

-- Adjust these based on your role structure
-- GRANT SELECT, INSERT, UPDATE ON sellers TO api_role;
-- GRANT SELECT, INSERT ON seller_metrics_history TO api_role;
-- GRANT SELECT, INSERT, UPDATE ON performance_alerts TO api_role;
-- GRANT SELECT, INSERT, UPDATE ON improvement_suggestions TO api_role;
