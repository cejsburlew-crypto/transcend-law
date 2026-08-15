-- Review Credibility System Database Schema
-- Tables for review credibility scoring, fake review detection, and reputation management

-- ============================================
-- REVIEWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL,
  user_id UUID NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  service_type VARCHAR(100) NOT NULL,
  is_verified_user BOOLEAN DEFAULT FALSE,
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('approved', 'pending', 'flagged', 'rejected', 'archived')),
  credibility_score INT DEFAULT 50 CHECK (credibility_score >= 0 AND credibility_score <= 100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_reviews_provider_id ON reviews(provider_id);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_status ON reviews(status);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX idx_reviews_credibility_score ON reviews(credibility_score);

-- ============================================
-- REVIEW CREDIBILITY SCORES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS review_credibility_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL UNIQUE,
  provider_id UUID NOT NULL,
  overall_score INT NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),

  -- Component scores (JSON for flexibility)
  score_components JSONB NOT NULL DEFAULT '{
    "verifiedUserScore": 50,
    "timingScore": 50,
    "textAnalysisScore": 50,
    "ratingClusteringScore": 50,
    "userHistoryScore": 50,
    "contentConsistencyScore": 50
  }',

  -- Flags detected
  flags JSONB NOT NULL DEFAULT '[]',

  -- AI detection results
  is_likely_fake BOOLEAN DEFAULT FALSE,
  ai_text_probability INT DEFAULT 0 CHECK (ai_text_probability >= 0 AND ai_text_probability <= 100),

  -- Recommendation
  recommended_action VARCHAR(50) DEFAULT 'manual_review' CHECK (recommended_action IN ('approve', 'flag', 'reject', 'manual_review')),

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

CREATE INDEX idx_review_credibility_scores_provider_id ON review_credibility_scores(provider_id);
CREATE INDEX idx_review_credibility_scores_overall_score ON review_credibility_scores(overall_score);
CREATE INDEX idx_review_credibility_scores_is_likely_fake ON review_credibility_scores(is_likely_fake);
CREATE INDEX idx_review_credibility_scores_ai_probability ON review_credibility_scores(ai_text_probability DESC);

-- ============================================
-- CREDIBILITY FLAGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS credibility_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL,
  review_credibility_score_id UUID NOT NULL,

  -- Flag details
  type VARCHAR(100) NOT NULL CHECK (type IN (
    'ai_generated', 'timing_anomaly', 'rating_clustering', 'duplicate_pattern',
    'suspicious_keywords', 'language_mismatch', 'extreme_sentiment', 'unusual_pattern'
  )),
  severity VARCHAR(50) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  confidence INT CHECK (confidence >= 0 AND confidence <= 100),
  evidence TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  FOREIGN KEY (review_credibility_score_id) REFERENCES review_credibility_scores(id) ON DELETE CASCADE
);

CREATE INDEX idx_credibility_flags_review_id ON credibility_flags(review_id);
CREATE INDEX idx_credibility_flags_type ON credibility_flags(type);
CREATE INDEX idx_credibility_flags_severity ON credibility_flags(severity);

-- ============================================
-- PROVIDER REPUTATION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS provider_reputation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL UNIQUE,

  -- Reputation metrics
  average_rating DECIMAL(3,2) DEFAULT 0.0 CHECK (average_rating >= 0 AND average_rating <= 5),
  total_reviews INT DEFAULT 0 CHECK (total_reviews >= 0),
  verified_reviews INT DEFAULT 0 CHECK (verified_reviews >= 0),

  -- Credibility and trust scores
  credibility_score INT DEFAULT 50 CHECK (credibility_score >= 0 AND credibility_score <= 100),
  trust_score INT DEFAULT 50 CHECK (trust_score >= 0 AND trust_score <= 100),

  -- Suspicious activity
  suspicious_reviews INT DEFAULT 0 CHECK (suspicious_reviews >= 0),

  -- Risk assessment
  risk_level VARCHAR(50) DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),

  -- Trend analysis
  trend VARCHAR(50) DEFAULT 'stable' CHECK (trend IN ('improving', 'stable', 'declining', 'volatile')),

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

CREATE INDEX idx_provider_reputation_provider_id ON provider_reputation(provider_id UNIQUE);
CREATE INDEX idx_provider_reputation_credibility_score ON provider_reputation(credibility_score);
CREATE INDEX idx_provider_reputation_risk_level ON provider_reputation(risk_level);
CREATE INDEX idx_provider_reputation_trust_score ON provider_reputation(trust_score DESC);

-- ============================================
-- ADMIN REVIEW QUEUE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS admin_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL,
  provider_id UUID NOT NULL,

  -- Review assignment
  reviewer_id UUID REFERENCES admins(id) ON DELETE SET NULL,

  -- Queue details
  reason TEXT NOT NULL,
  priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'resolved')),

  -- Resolution
  resolution TEXT,
  action_taken VARCHAR(50) CHECK (action_taken IN ('approved', 'rejected', 'modified', 'escalated')),

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

CREATE INDEX idx_admin_review_queue_status ON admin_review_queue(status);
CREATE INDEX idx_admin_review_queue_priority ON admin_review_queue(priority);
CREATE INDEX idx_admin_review_queue_reviewer_id ON admin_review_queue(reviewer_id);
CREATE INDEX idx_admin_review_queue_created_at ON admin_review_queue(created_at DESC);

-- ============================================
-- REVIEW TRENDS TABLE (Historical tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS review_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL,
  trend_date DATE NOT NULL,

  -- Daily aggregates
  average_credibility_score INT DEFAULT 0 CHECK (average_credibility_score >= 0 AND average_credibility_score <= 100),
  flagged_count INT DEFAULT 0 CHECK (flagged_count >= 0),
  approved_count INT DEFAULT 0 CHECK (approved_count >= 0),
  rejected_count INT DEFAULT 0 CHECK (rejected_count >= 0),
  average_rating DECIMAL(3,2) DEFAULT 0.0,

  -- Rating distribution
  rating_distribution JSONB NOT NULL DEFAULT '{
    "oneStar": 0,
    "twoStar": 0,
    "threeStar": 0,
    "fourStar": 0,
    "fiveStar": 0
  }',

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(provider_id, trend_date),
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
);

CREATE INDEX idx_review_trends_provider_id ON review_trends(provider_id);
CREATE INDEX idx_review_trends_trend_date ON review_trends(trend_date DESC);
CREATE INDEX idx_review_trends_provider_date ON review_trends(provider_id, trend_date DESC);

-- ============================================
-- USER REVIEW HISTORY TABLE (Cache for performance)
-- ============================================
CREATE TABLE IF NOT EXISTS user_review_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,

  -- User statistics
  review_count INT DEFAULT 0 CHECK (review_count >= 0),
  average_rating DECIMAL(3,2) DEFAULT 0.0,
  suspicious_count INT DEFAULT 0 CHECK (suspicious_count >= 0),

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_review_history_user_id ON user_review_history(user_id UNIQUE);
CREATE INDEX idx_user_review_history_suspicious_count ON user_review_history(suspicious_count DESC);

-- ============================================
-- REVIEW ANALYSIS AUDIT TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS review_analysis_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL,
  review_credibility_score_id UUID,

  -- Analysis details
  analysis_type VARCHAR(100) NOT NULL,
  result JSONB NOT NULL,

  -- Admin action (if any)
  admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  admin_action VARCHAR(100),
  admin_notes TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  FOREIGN KEY (review_credibility_score_id) REFERENCES review_credibility_scores(id) ON DELETE SET NULL
);

CREATE INDEX idx_review_analysis_audits_review_id ON review_analysis_audits(review_id);
CREATE INDEX idx_review_analysis_audits_created_at ON review_analysis_audits(created_at DESC);
CREATE INDEX idx_review_analysis_audits_admin_id ON review_analysis_audits(admin_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Update provider reputation trigger
CREATE OR REPLACE FUNCTION update_provider_reputation()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE provider_reputation
  SET last_updated = NOW()
  WHERE provider_id = NEW.provider_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_provider_reputation
AFTER UPDATE ON review_credibility_scores
FOR EACH ROW
EXECUTE FUNCTION update_provider_reputation();

-- Update user review history trigger
CREATE OR REPLACE FUNCTION update_user_review_history()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_review_history (user_id, review_count, average_rating, suspicious_count)
  SELECT
    NEW.user_id,
    COUNT(*),
    AVG(rating),
    COUNT(CASE WHEN status IN ('flagged', 'rejected') THEN 1 END)
  FROM reviews
  WHERE user_id = NEW.user_id
  ON CONFLICT (user_id)
  DO UPDATE SET
    review_count = EXCLUDED.review_count,
    average_rating = EXCLUDED.average_rating,
    suspicious_count = EXCLUDED.suspicious_count,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_review_history
AFTER INSERT ON reviews
FOR EACH ROW
EXECUTE FUNCTION update_user_review_history();

-- Automatically set admin review status to "in_review" when assigned
CREATE OR REPLACE FUNCTION auto_mark_review_in_progress()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reviewer_id IS NOT NULL AND OLD.reviewer_id IS NULL THEN
    NEW.status := 'in_review';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_mark_review_in_progress
BEFORE UPDATE ON admin_review_queue
FOR EACH ROW
EXECUTE FUNCTION auto_mark_review_in_progress();

-- ============================================
-- VIEWS FOR ANALYTICS
-- ============================================

-- Suspicious Reviews View
CREATE OR REPLACE VIEW suspicious_reviews_view AS
SELECT
  r.id,
  r.provider_id,
  r.user_id,
  r.rating,
  r.created_at,
  rcs.overall_score,
  rcs.is_likely_fake,
  rcs.ai_text_probability,
  r.status
FROM reviews r
LEFT JOIN review_credibility_scores rcs ON r.id = rcs.review_id
WHERE r.status IN ('flagged', 'rejected')
  OR rcs.is_likely_fake = TRUE
ORDER BY r.created_at DESC;

-- Provider Health View
CREATE OR REPLACE VIEW provider_health_view AS
SELECT
  pr.provider_id,
  pr.average_rating,
  pr.total_reviews,
  pr.verified_reviews,
  pr.credibility_score,
  pr.trust_score,
  pr.suspicious_reviews,
  pr.risk_level,
  pr.trend,
  COUNT(CASE WHEN r.status = 'approved' THEN 1 END) as approved_count,
  COUNT(CASE WHEN r.status = 'rejected' THEN 1 END) as rejected_count,
  COUNT(CASE WHEN r.status = 'flagged' THEN 1 END) as flagged_count
FROM provider_reputation pr
LEFT JOIN reviews r ON pr.provider_id = r.provider_id
GROUP BY pr.provider_id, pr.average_rating, pr.total_reviews, pr.verified_reviews,
         pr.credibility_score, pr.trust_score, pr.suspicious_reviews, pr.risk_level, pr.trend;

-- Admin Queue Status View
CREATE OR REPLACE VIEW admin_queue_status_view AS
SELECT
  priority,
  status,
  COUNT(*) as count,
  MAX(created_at) as most_recent,
  MIN(created_at) as oldest
FROM admin_review_queue
GROUP BY priority, status
ORDER BY priority DESC, status;
