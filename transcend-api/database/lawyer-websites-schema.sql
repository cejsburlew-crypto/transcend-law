-- Lawyer Profile Websites ($25/month subscription)

CREATE TABLE lawyer_websites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL,
  lawyer_name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) NOT NULL UNIQUE,
  bio TEXT NOT NULL,
  profile_picture_url VARCHAR(500),
  office_address VARCHAR(500),
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL,
  license_number VARCHAR(50),
  years_experience INT,
  specializations TEXT[] DEFAULT '{}',
  excluded_services TEXT[] DEFAULT '{}',
  included_services TEXT[] DEFAULT '{}',

  -- Website Customization
  website_bg_color VARCHAR(7) DEFAULT '#ffffff',
  website_accent_color VARCHAR(7) DEFAULT '#667eea',
  website_logo_url VARCHAR(500),
  website_header_image_url VARCHAR(500),

  -- Subscription
  subscription_status VARCHAR(50) DEFAULT 'active', -- active, paused, cancelled
  subscription_start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  subscription_end_date TIMESTAMP,
  stripe_subscription_id VARCHAR(255),

  -- Analytics
  total_page_views INT DEFAULT 0,
  total_unique_visitors INT DEFAULT 0,
  last_analytics_update TIMESTAMP,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_subdomain_city UNIQUE(subdomain, lawyer_id)
);

CREATE INDEX idx_lawyer_websites_lawyer_id ON lawyer_websites(lawyer_id);
CREATE INDEX idx_lawyer_websites_subdomain ON lawyer_websites(subdomain);
CREATE INDEX idx_lawyer_websites_subscription_status ON lawyer_websites(subscription_status);
CREATE INDEX idx_lawyer_websites_created_at ON lawyer_websites(created_at DESC);

-- Testimonials for lawyer websites
CREATE TABLE lawyer_website_testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES lawyer_websites(id) ON DELETE CASCADE,
  client_name VARCHAR(255) NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_testimonials_website_id ON lawyer_website_testimonials(website_id);
CREATE INDEX idx_testimonials_rating ON lawyer_website_testimonials(rating);

-- Website Analytics
CREATE TABLE lawyer_website_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES lawyer_websites(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  page_views INT DEFAULT 0,
  unique_visitors INT DEFAULT 0,
  referral_source VARCHAR(255), -- direct, google, transcend-law, etc

  CONSTRAINT unique_analytics_per_day UNIQUE(website_id, visit_date)
);

CREATE INDEX idx_analytics_website_date ON lawyer_website_analytics(website_id, visit_date DESC);

-- Service clicks tracking
CREATE TABLE lawyer_website_service_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES lawyer_websites(id) ON DELETE CASCADE,
  service_name VARCHAR(255) NOT NULL,
  click_date DATE NOT NULL,
  click_count INT DEFAULT 1,

  CONSTRAINT unique_service_clicks UNIQUE(website_id, service_name, click_date)
);

CREATE INDEX idx_service_clicks_website ON lawyer_website_service_clicks(website_id);

-- Contact form submissions
CREATE TABLE lawyer_website_contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES lawyer_websites(id) ON DELETE CASCADE,
  client_name VARCHAR(255) NOT NULL,
  client_email VARCHAR(255) NOT NULL,
  client_phone VARCHAR(20),
  service_interest VARCHAR(255),
  message TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'new', -- new, contacted, converted, spam
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  contacted_at TIMESTAMP,
  notes TEXT
);

CREATE INDEX idx_contact_submissions_website ON lawyer_website_contact_submissions(website_id);
CREATE INDEX idx_contact_submissions_status ON lawyer_website_contact_submissions(status);
CREATE INDEX idx_contact_submissions_date ON lawyer_website_contact_submissions(submitted_at DESC);

-- Subscription billing history
CREATE TABLE lawyer_website_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES lawyer_websites(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 25.00,
  currency VARCHAR(3) DEFAULT 'USD',
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, paid, failed, refunded
  stripe_invoice_id VARCHAR(255),
  payment_method VARCHAR(50),
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_billing_website ON lawyer_website_billing(website_id);
CREATE INDEX idx_billing_lawyer ON lawyer_website_billing(lawyer_id);
CREATE INDEX idx_billing_status ON lawyer_website_billing(status);
CREATE INDEX idx_billing_date ON lawyer_website_billing(created_at DESC);

-- Audit log for website changes
CREATE TABLE lawyer_website_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES lawyer_websites(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL, -- created, updated, testimonial_added, subscription_renewed, cancelled
  field_name VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_website ON lawyer_website_audit_log(website_id);
CREATE INDEX idx_audit_lawyer ON lawyer_website_audit_log(lawyer_id);
CREATE INDEX idx_audit_action ON lawyer_website_audit_log(action);

-- Helper function to update lawyer website stats
CREATE OR REPLACE FUNCTION update_lawyer_website_stats(website_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE lawyer_websites
  SET
    total_page_views = (SELECT COALESCE(SUM(page_views), 0) FROM lawyer_website_analytics WHERE website_id = $1),
    total_unique_visitors = (SELECT COALESCE(SUM(unique_visitors), 0) FROM lawyer_website_analytics WHERE website_id = $1),
    last_analytics_update = CURRENT_TIMESTAMP
  WHERE id = $1;
END;
$$ LANGUAGE plpgsql;

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_lawyer_website_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lawyer_website_updated_at
BEFORE UPDATE ON lawyer_websites
FOR EACH ROW
EXECUTE FUNCTION update_lawyer_website_updated_at();

-- Sample data for testing
INSERT INTO lawyer_websites (lawyer_id, company_name, lawyer_name, subdomain, bio, email, phone, specializations, included_services, subscription_status)
SELECT
  u.id,
  'Smith & Associates',
  u.name,
  'smith-associates',
  'Expert in personal injury law with 15+ years of experience.',
  u.email,
  '(555) 123-4567',
  ARRAY['Personal Injury', 'Automobile Accidents'],
  ARRAY['Personal Injury', 'Automobile Accidents', 'Medical Malpractice', 'Wrongful Death'],
  'active'
FROM users u
WHERE u.role = 'attorney'
LIMIT 1;
