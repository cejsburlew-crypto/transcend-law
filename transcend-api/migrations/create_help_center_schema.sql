-- Help Center Schema
-- Supports searchable articles, categories, feedback, and analytics

-- ============================================
-- HELP ARTICLES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS help_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  category VARCHAR(100) NOT NULL,
  tags JSONB DEFAULT '[]',
  content TEXT NOT NULL,
  excerpt TEXT,
  user_types JSONB DEFAULT '["client"]',
  video_url VARCHAR(500),
  related_articles JSONB DEFAULT '[]',
  view_count INTEGER DEFAULT 0,
  is_faq BOOLEAN DEFAULT FALSE,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_help_articles_category ON help_articles(category);
CREATE INDEX idx_help_articles_is_faq ON help_articles(is_faq);
CREATE INDEX idx_help_articles_user_types ON help_articles USING GIN(user_types);
CREATE INDEX idx_help_articles_tags ON help_articles USING GIN(tags);
CREATE INDEX idx_help_articles_order ON help_articles("order");

-- Full-text search index
CREATE INDEX idx_help_articles_search ON help_articles
  USING GIN(to_tsvector('english', title || ' ' || content));

-- ============================================
-- HELP CATEGORIES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS help_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(50) DEFAULT '📚',
  article_count INTEGER DEFAULT 0,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_help_categories_slug ON help_categories(slug);
CREATE INDEX idx_help_categories_order ON help_categories("order");

-- ============================================
-- ARTICLE FEEDBACK TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS article_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES help_articles(id) ON DELETE CASCADE,
  helpful BOOLEAN NOT NULL,
  comment TEXT,
  email VARCHAR(255),
  user_type VARCHAR(50),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_article_feedback_article_id ON article_feedback(article_id);
CREATE INDEX idx_article_feedback_helpful ON article_feedback(helpful);
CREATE INDEX idx_article_feedback_timestamp ON article_feedback(timestamp);

-- ============================================
-- SEARCH ANALYTICS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS search_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query VARCHAR(255) NOT NULL,
  result_count INTEGER,
  user_type VARCHAR(50),
  user_email VARCHAR(255),
  clicked_article_id UUID REFERENCES help_articles(id) ON DELETE SET NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_search_analytics_query ON search_analytics(query);
CREATE INDEX idx_search_analytics_user_type ON search_analytics(user_type);
CREATE INDEX idx_search_analytics_timestamp ON search_analytics(timestamp);

-- ============================================
-- SAMPLE DATA
-- ============================================

-- Insert sample categories
INSERT INTO help_categories (name, slug, description, icon, "order")
VALUES
  ('Getting Started', 'getting-started', 'Learn the basics of using Transcend', '🚀', 1),
  ('Client Services', 'client-services', 'Information for clients seeking legal services', '👤', 2),
  ('Service Providers', 'service-providers', 'Resources for attorneys and legal professionals', '⚖️', 3),
  ('Notary Services', 'notary-services', 'Guide to notarization and document services', '📝', 4),
  ('Account & Payments', 'account-payments', 'Manage your account and payment information', '💳', 5),
  ('Safety & Privacy', 'safety-privacy', 'Your privacy and security are our priority', '🔒', 6)
ON CONFLICT DO NOTHING;

-- Insert sample articles
INSERT INTO help_articles (title, slug, category, tags, content, excerpt, user_types, is_faq, "order")
VALUES
  (
    'What is Transcend?',
    'what-is-transcend',
    'getting-started',
    '["introduction", "overview"]',
    'Transcend is a comprehensive legal services platform connecting clients with qualified attorneys and service providers. We provide access to vetted professionals across various practice areas including employment law, family law, real estate, and more.

Our mission is to make legal services accessible, affordable, and transparent. We handle the matching process, vetting, and coordination so you can focus on your case.

Key features include 24/7 access to services, real-time case tracking, and secure document storage.',
    'Transcend is a comprehensive legal services platform connecting clients with qualified attorneys and service providers.',
    '["client", "provider"]',
    TRUE,
    1
  ),
  (
    'How do I get started as a client?',
    'getting-started-client',
    'getting-started',
    '["clients", "onboarding"]',
    'Getting started with Transcend is simple:

1. Create your account by providing your email and basic information
2. Complete your profile with details about your legal needs
3. Browse available service providers in your area and practice area
4. Submit a service request with case details
5. Get matched with a qualified provider
6. Communicate securely through our platform
7. Track your case status in real-time

All your documents are securely stored and encrypted. You maintain complete control over your personal information.',
    'Getting started with Transcend is simple and takes just a few minutes.',
    '["client"]',
    TRUE,
    2
  ),
  (
    'How do I get started as a service provider?',
    'getting-started-provider',
    'service-providers',
    '["providers", "onboarding", "registration"]',
    'Becoming a service provider on Transcend involves these steps:

1. Register as a professional provider
2. Verify your credentials and professional licenses
3. Complete your professional profile with your expertise areas
4. Set your service rates and availability
5. Pass our vetting process which includes credential verification
6. Start accepting client cases

We verify all credentials through official bar associations and professional databases. This ensures only qualified professionals can access our platform.',
    'Becoming a service provider on Transcend involves credential verification and professional vetting.',
    '["provider"]',
    TRUE,
    1
  ),
  (
    'What payment methods do you accept?',
    'payment-methods',
    'account-payments',
    '["payments", "billing"]',
    'Transcend accepts the following payment methods:

Credit Cards: Visa, Mastercard, American Express
Digital Wallets: Apple Pay, Google Pay, PayPal
Bank Transfer: Direct bank transfers for larger invoices
Payment Plans: We offer flexible payment arrangements for qualified cases

All payment information is encrypted and PCI-DSS compliant. You can save multiple payment methods for convenience.',
    'Transcend accepts credit cards, digital wallets, bank transfers, and flexible payment plans.',
    '["client", "provider"]',
    TRUE,
    1
  ),
  (
    'How is my personal information protected?',
    'data-protection',
    'safety-privacy',
    '["privacy", "security", "encryption"]',
    'Your privacy and security are our top priorities:

Encryption: All data is encrypted both in transit and at rest using military-grade encryption
Compliance: We comply with HIPAA, GDPR, CCPA, and other privacy regulations
Access Control: Only authorized personnel can access your information
Audit Trails: All data access is logged and audited
No Sharing: We never share your information with third parties without explicit consent
Document Storage: Your case documents are securely stored with automatic backups

You can request a copy of all your data or request deletion at any time.',
    'Your privacy and security are our top priorities with military-grade encryption.',
    '["client", "provider"]',
    TRUE,
    1
  )
ON CONFLICT DO NOTHING;

-- ============================================
-- VIEWS FOR ANALYTICS
-- ============================================

CREATE OR REPLACE VIEW help_article_stats AS
SELECT
  ha.id,
  ha.title,
  ha.slug,
  ha.category,
  ha.view_count,
  COUNT(DISTINCT af.id) as feedback_count,
  SUM(CASE WHEN af.helpful = true THEN 1 ELSE 0 END)::int as helpful_count,
  SUM(CASE WHEN af.helpful = false THEN 1 ELSE 0 END)::int as unhelpful_count,
  ROUND(100.0 * SUM(CASE WHEN af.helpful = true THEN 1 ELSE 0 END)::numeric /
    NULLIF(COUNT(DISTINCT af.id), 0), 2) as helpful_percentage,
  ha.created_at,
  ha.updated_at
FROM help_articles ha
LEFT JOIN article_feedback af ON af.article_id = ha.id
GROUP BY ha.id, ha.title, ha.slug, ha.category, ha.view_count, ha.created_at, ha.updated_at;

-- ============================================
-- AUDIT LOGGING
-- ============================================

CREATE OR REPLACE FUNCTION log_help_article_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (entity_type, entity_id, action, changes, timestamp)
  VALUES (
    'help_article',
    NEW.id,
    TG_OP,
    jsonb_build_object(
      'title', NEW.title,
      'category', NEW.category,
      'is_faq', NEW.is_faq
    ),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_help_article_audit
AFTER INSERT OR UPDATE ON help_articles
FOR EACH ROW
EXECUTE FUNCTION log_help_article_changes();
