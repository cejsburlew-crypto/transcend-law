-- Freemium System Schema
-- Handles user subscriptions, usage tracking, and conversion metrics

-- User Subscriptions Table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  tier VARCHAR(50) NOT NULL CHECK (tier IN ('free', 'pro', 'enterprise')) DEFAULT 'free',
  status VARCHAR(50) NOT NULL CHECK (status IN ('active', 'cancelled', 'expired')) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Trial Information
  trial_start_date TIMESTAMP WITH TIME ZONE,
  trial_end_date TIMESTAMP WITH TIME ZONE,
  trial_status VARCHAR(50) NOT NULL CHECK (trial_status IN ('active', 'expired', 'converted', 'cancelled')) DEFAULT 'expired',
  is_trial_active BOOLEAN NOT NULL DEFAULT false,

  -- Paid Plan Information
  paid_plan_start_date TIMESTAMP WITH TIME ZONE,

  -- Billing
  billing_cycle VARCHAR(20) CHECK (billing_cycle IN ('monthly', 'annual')),
  auto_renew BOOLEAN DEFAULT true,

  -- Audit
  created_by UUID,
  updated_by UUID,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT subscription_consistency CHECK (
    (tier = 'free' AND trial_status IS NOT NULL) OR
    (tier != 'free' AND paid_plan_start_date IS NOT NULL)
  )
);

CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_tier ON user_subscriptions(tier);
CREATE INDEX idx_user_subscriptions_trial_active ON user_subscriptions(is_trial_active);
CREATE INDEX idx_user_subscriptions_created_at ON user_subscriptions(created_at);

-- Subscription Usage Tracking
CREATE TABLE IF NOT EXISTS subscription_usage (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription_id UUID NOT NULL,

  -- Usage Metrics
  cases_created INTEGER NOT NULL DEFAULT 0,
  cases_active INTEGER NOT NULL DEFAULT 0,
  storage_used NUMERIC(12, 2) NOT NULL DEFAULT 0,  -- in MB
  documents_uploaded INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES user_subscriptions(id) ON DELETE CASCADE,
  CONSTRAINT positive_usage CHECK (
    cases_created >= 0 AND
    cases_active >= 0 AND
    storage_used >= 0 AND
    documents_uploaded >= 0
  )
);

CREATE INDEX idx_subscription_usage_user_id ON subscription_usage(user_id);
CREATE INDEX idx_subscription_usage_subscription_id ON subscription_usage(subscription_id);
CREATE INDEX idx_subscription_usage_last_updated ON subscription_usage(last_updated);

-- Conversion Metrics for Analytics
CREATE TABLE IF NOT EXISTS conversion_metrics (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  event VARCHAR(100) NOT NULL CHECK (event IN (
    'prompt_shown',
    'comparison_viewed',
    'trial_started',
    'upgrade_clicked',
    'payment_completed',
    'upgrade_cancelled'
  )),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_conversion_metrics_user_id ON conversion_metrics(user_id);
CREATE INDEX idx_conversion_metrics_event ON conversion_metrics(event);
CREATE INDEX idx_conversion_metrics_timestamp ON conversion_metrics(timestamp);
CREATE INDEX idx_conversion_metrics_event_timestamp ON conversion_metrics(event, timestamp);

-- Payment/Transaction Log
CREATE TABLE IF NOT EXISTS upgrade_transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription_id UUID NOT NULL,

  from_tier VARCHAR(50) NOT NULL,
  to_tier VARCHAR(50) NOT NULL,
  billing_cycle VARCHAR(20) NOT NULL,

  -- Pricing
  amount NUMERIC(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',

  -- Payment Details
  payment_method VARCHAR(50),
  payment_intent_id VARCHAR(255),
  status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'pending',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES user_subscriptions(id) ON DELETE CASCADE
);

CREATE INDEX idx_upgrade_transactions_user_id ON upgrade_transactions(user_id);
CREATE INDEX idx_upgrade_transactions_status ON upgrade_transactions(status);
CREATE INDEX idx_upgrade_transactions_created_at ON upgrade_transactions(created_at);

-- Trial Extension History
CREATE TABLE IF NOT EXISTS trial_extensions (
  id UUID PRIMARY KEY,
  subscription_id UUID NOT NULL,
  user_id UUID NOT NULL,

  original_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  new_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  days_extended INTEGER NOT NULL,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by VARCHAR(50), -- 'system' or 'admin' or 'user_action'
  reason TEXT,

  FOREIGN KEY (subscription_id) REFERENCES user_subscriptions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_trial_extensions_subscription_id ON trial_extensions(subscription_id);
CREATE INDEX idx_trial_extensions_user_id ON trial_extensions(user_id);

-- Pricing Plans Configuration (can be updated by admins)
CREATE TABLE IF NOT EXISTS pricing_plans (
  id UUID PRIMARY KEY,
  tier_name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,

  -- Pricing
  monthly_price NUMERIC(10, 2) NOT NULL,
  annual_price NUMERIC(10, 2) NOT NULL,

  -- Features & Limits
  description TEXT,
  max_cases INTEGER, -- NULL means unlimited
  max_documents INTEGER,
  max_storage_mb INTEGER,

  features JSONB NOT NULL DEFAULT '[]',

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_pricing CHECK (monthly_price >= 0 AND annual_price >= 0)
);

CREATE INDEX idx_pricing_plans_tier_name ON pricing_plans(tier_name);
CREATE INDEX idx_pricing_plans_is_active ON pricing_plans(is_active);

-- Insert default pricing tiers
INSERT INTO pricing_plans (
  id, tier_name, display_name, monthly_price, annual_price,
  max_cases, max_documents, max_storage_mb, display_order,
  description, features
) VALUES
  (
    'tier-free'::UUID,
    'free',
    'Free',
    0,
    0,
    5,
    50,
    500,
    1,
    'Perfect for getting started with legal services',
    '[
      "5 active cases",
      "500 MB storage",
      "Basic case management",
      "Email support",
      "7-day trial included"
    ]'
  ),
  (
    'tier-pro'::UUID,
    'pro',
    'Professional',
    99,
    990,
    1000,
    5000,
    50000,
    2,
    'For growing law practices',
    '[
      "1,000 active cases",
      "50 GB storage",
      "Advanced case analysis",
      "Bulk operations",
      "API access",
      "Priority email support",
      "Advanced reporting"
    ]'
  ),
  (
    'tier-enterprise'::UUID,
    'enterprise',
    'Enterprise',
    0,
    0,
    null,
    null,
    null,
    3,
    'For large-scale operations',
    '[
      "Unlimited cases",
      "Unlimited storage",
      "All Pro features",
      "Custom integrations",
      "Dedicated account manager",
      "24/7 phone support",
      "99.99% SLA"
    ]'
  )
ON CONFLICT DO NOTHING;

-- Feature Limits Matrix (for quick lookups)
CREATE TABLE IF NOT EXISTS feature_limits (
  id UUID PRIMARY KEY,
  tier VARCHAR(50) NOT NULL,
  feature_name VARCHAR(100) NOT NULL,
  limit_value INTEGER, -- NULL means unlimited or use boolean
  is_enabled BOOLEAN DEFAULT true,

  UNIQUE(tier, feature_name),
  FOREIGN KEY (tier) REFERENCES pricing_plans(tier_name) ON DELETE CASCADE
);

CREATE INDEX idx_feature_limits_tier ON feature_limits(tier);
CREATE INDEX idx_feature_limits_tier_feature ON feature_limits(tier, feature_name);

-- Insert default feature limits
INSERT INTO feature_limits (id, tier, feature_name, limit_value, is_enabled) VALUES
  -- Free tier
  (uuid_generate_v4(), 'free', 'max_cases', 5, true),
  (uuid_generate_v4(), 'free', 'max_documents', 50, true),
  (uuid_generate_v4(), 'free', 'max_storage_mb', 500, true),
  (uuid_generate_v4(), 'free', 'case_analysis', NULL, false),
  (uuid_generate_v4(), 'free', 'priority_support', NULL, false),
  (uuid_generate_v4(), 'free', 'api_access', NULL, false),
  (uuid_generate_v4(), 'free', 'custom_branding', NULL, false),
  (uuid_generate_v4(), 'free', 'advanced_reporting', NULL, false),
  (uuid_generate_v4(), 'free', 'bulk_operations', NULL, false),

  -- Pro tier
  (uuid_generate_v4(), 'pro', 'max_cases', 1000, true),
  (uuid_generate_v4(), 'pro', 'max_documents', 5000, true),
  (uuid_generate_v4(), 'pro', 'max_storage_mb', 50000, true),
  (uuid_generate_v4(), 'pro', 'case_analysis', NULL, true),
  (uuid_generate_v4(), 'pro', 'priority_support', NULL, true),
  (uuid_generate_v4(), 'pro', 'api_access', NULL, true),
  (uuid_generate_v4(), 'pro', 'custom_branding', NULL, true),
  (uuid_generate_v4(), 'pro', 'advanced_reporting', NULL, true),
  (uuid_generate_v4(), 'pro', 'bulk_operations', NULL, true),

  -- Enterprise tier
  (uuid_generate_v4(), 'enterprise', 'max_cases', NULL, true),
  (uuid_generate_v4(), 'enterprise', 'max_documents', NULL, true),
  (uuid_generate_v4(), 'enterprise', 'max_storage_mb', NULL, true),
  (uuid_generate_v4(), 'enterprise', 'case_analysis', NULL, true),
  (uuid_generate_v4(), 'enterprise', 'priority_support', NULL, true),
  (uuid_generate_v4(), 'enterprise', 'api_access', NULL, true),
  (uuid_generate_v4(), 'enterprise', 'custom_branding', NULL, true),
  (uuid_generate_v4(), 'enterprise', 'advanced_reporting', NULL, true),
  (uuid_generate_v4(), 'enterprise', 'bulk_operations', NULL, true)
ON CONFLICT DO NOTHING;

-- Freemium Analytics View
CREATE OR REPLACE VIEW freemium_analytics AS
SELECT
  u.id as user_id,
  u.email,
  us.tier,
  us.status,
  us.is_trial_active,
  us.trial_end_date,
  us.paid_plan_start_date,
  su.cases_active,
  su.storage_used,
  su.documents_uploaded,
  su.last_updated,
  (SELECT COUNT(*) FROM conversion_metrics WHERE user_id = u.id AND event = 'prompt_shown') as prompts_shown,
  (SELECT COUNT(*) FROM conversion_metrics WHERE user_id = u.id AND event = 'upgrade_clicked') as upgrades_clicked,
  (SELECT COUNT(*) FROM conversion_metrics WHERE user_id = u.id AND event = 'payment_completed') as payments_completed
FROM users u
LEFT JOIN user_subscriptions us ON u.id = us.user_id
LEFT JOIN subscription_usage su ON u.id = su.user_id;

-- Trial Expiration View
CREATE OR REPLACE VIEW expiring_trials AS
SELECT
  u.id,
  u.email,
  us.id as subscription_id,
  us.trial_end_date,
  EXTRACT(DAY FROM us.trial_end_date - NOW()) as days_until_expiration
FROM users u
JOIN user_subscriptions us ON u.id = us.user_id
WHERE us.is_trial_active = true
  AND us.trial_end_date IS NOT NULL
  AND us.trial_end_date > NOW()
ORDER BY us.trial_end_date ASC;

-- Conversion Funnel View
CREATE OR REPLACE VIEW conversion_funnel_daily AS
SELECT
  DATE(timestamp) as date,
  COUNT(CASE WHEN event = 'prompt_shown' THEN 1 END) as prompts_shown,
  COUNT(CASE WHEN event = 'comparison_viewed' THEN 1 END) as comparisons_viewed,
  COUNT(CASE WHEN event = 'upgrade_clicked' THEN 1 END) as upgrades_clicked,
  COUNT(CASE WHEN event = 'payment_completed' THEN 1 END) as payments_completed,
  COUNT(DISTINCT user_id) as unique_users
FROM conversion_metrics
GROUP BY DATE(timestamp)
ORDER BY date DESC;

-- Grants for queries (adjust as needed)
GRANT SELECT ON user_subscriptions TO app_user;
GRANT SELECT ON subscription_usage TO app_user;
GRANT SELECT ON conversion_metrics TO app_user;
GRANT SELECT ON upgrade_transactions TO app_user;
GRANT SELECT ON pricing_plans TO app_user;
GRANT SELECT ON feature_limits TO app_user;
GRANT SELECT ON freemium_analytics TO app_user;
GRANT SELECT ON expiring_trials TO app_user;
GRANT SELECT ON conversion_funnel_daily TO app_user;

GRANT INSERT, UPDATE ON user_subscriptions TO app_user;
GRANT INSERT, UPDATE ON subscription_usage TO app_user;
GRANT INSERT ON conversion_metrics TO app_user;
GRANT INSERT ON upgrade_transactions TO app_user;
GRANT INSERT ON trial_extensions TO app_user;
