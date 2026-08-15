-- Transcend Law Database Schema
-- PostgreSQL production-ready schema

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('client', 'attorney', 'firm')),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  profile_picture_url TEXT,
  bio TEXT,
  preferred_language VARCHAR(5) DEFAULT 'en',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_user_type ON users(user_type);

-- ============================================
-- ATTORNEYS TABLE
-- ============================================
CREATE TABLE attorneys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  bar_number VARCHAR(50) UNIQUE,
  bar_state VARCHAR(2),
  license_verified BOOLEAN DEFAULT FALSE,
  license_verified_at TIMESTAMP,
  years_experience INT,
  specialties TEXT[], -- Array of specialties
  rating DECIMAL(3,2),
  total_cases INT DEFAULT 0,
  success_rate DECIMAL(5,2),
  hourly_rate INT,
  bio TEXT,
  office_address TEXT,
  office_phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attorneys_user_id ON attorneys(user_id);
CREATE INDEX idx_attorneys_specialties ON attorneys USING GIN(specialties);

-- ============================================
-- LAW FIRMS TABLE
-- ============================================
CREATE TABLE law_firms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  logo_url TEXT,
  website_url TEXT,
  phone VARCHAR(20),
  address TEXT,
  state VARCHAR(2),
  attorneys_count INT DEFAULT 0,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_law_firms_state ON law_firms(state);

-- ============================================
-- FIRM MEMBERS (Attorneys in Firms)
-- ============================================
CREATE TABLE firm_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES law_firms(id) ON DELETE CASCADE,
  attorney_id UUID NOT NULL REFERENCES attorneys(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'associate',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_firm_members_unique ON firm_members(firm_id, attorney_id);

-- ============================================
-- CASES/LEGAL MATTERS
-- ============================================
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  original_language VARCHAR(5) DEFAULT 'en',
  translated_content JSONB DEFAULT '{}', -- {es: {title: ..., description: ...}, fr: {...}}
  budget_min INT,
  budget_max INT,
  urgency VARCHAR(20) CHECK (urgency IN ('low', 'medium', 'high', 'urgent')),
  location VARCHAR(100),
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'matched', 'accepted', 'completed', 'closed')),
  documents_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_cases_client_id ON cases(client_id);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_service_type ON cases(service_type);
CREATE INDEX idx_cases_created_at ON cases(created_at);

-- ============================================
-- CASE DOCUMENTS
-- ============================================
CREATE TABLE case_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size INT,
  file_type VARCHAR(50),
  uploaded_by UUID NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_case_documents_case_id ON case_documents(case_id);

-- ============================================
-- CASE OFFERS/QUOTES
-- ============================================
CREATE TABLE case_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  attorney_id UUID NOT NULL REFERENCES attorneys(id) ON DELETE CASCADE,
  firm_id UUID REFERENCES law_firms(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'quoted', 'rejected', 'accepted', 'retained')),
  quote_amount INT,
  quote_message TEXT,
  timeline VARCHAR(100),
  response_time INT, -- minutes to respond
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP,
  accepted_at TIMESTAMP
);

CREATE INDEX idx_case_offers_case_id ON case_offers(case_id);
CREATE INDEX idx_case_offers_attorney_id ON case_offers(attorney_id);
CREATE INDEX idx_case_offers_status ON case_offers(status);
CREATE UNIQUE INDEX idx_case_offers_unique ON case_offers(case_id, attorney_id);

-- ============================================
-- CONVERSATIONS/THREADS
-- ============================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  participant_1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(255),
  last_message_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conversations_case_id ON conversations(case_id);
CREATE INDEX idx_conversations_participant_1 ON conversations(participant_1_id);
CREATE INDEX idx_conversations_participant_2 ON conversations(participant_2_id);
CREATE UNIQUE INDEX idx_conversations_unique ON conversations(participant_1_id, participant_2_id, case_id);

-- ============================================
-- MESSAGES
-- ============================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  sender_language VARCHAR(5) DEFAULT 'en',
  translated_content JSONB DEFAULT '{}', -- {es: "...", fr: "...", zh: "..."}
  attachments JSONB DEFAULT '[]',
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- ============================================
-- SUBSCRIPTIONS
-- ============================================
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan_type VARCHAR(50) NOT NULL CHECK (plan_type IN ('basic', 'professional', 'enterprise')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled', 'expired')),
  price_per_month INT,
  billing_cycle_anchor TIMESTAMP,
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  auto_renew BOOLEAN DEFAULT TRUE,
  -- Clover Integration
  clover_customer_id VARCHAR(255),
  clover_order_id VARCHAR(255),
  -- Legacy Stripe (if migrating)
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMP
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);

-- ============================================
-- INVOICES
-- ============================================
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  stripe_invoice_id VARCHAR(255),
  amount INT,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'void', 'uncollectible')),
  invoice_url TEXT,
  paid_at TIMESTAMP,
  due_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoices_subscription_id ON invoices(subscription_id);

-- ============================================
-- REFRESH TOKENS (for JWT)
-- ============================================
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- ============================================
-- AUDIT LOG
-- ============================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- ============================================
-- TRANSLATION CACHE
-- ============================================
CREATE TABLE translation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_text TEXT NOT NULL,
  source_language VARCHAR(5) NOT NULL,
  target_language VARCHAR(5) NOT NULL,
  translated_text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_translation_cache_unique ON translation_cache(
  source_language, target_language, MD5(source_text)
);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER attorneys_updated_at BEFORE UPDATE ON attorneys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER cases_updated_at BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS
-- ============================================

-- Attorney Profile View (joined with user data)
CREATE VIEW attorney_profiles AS
SELECT
  u.id,
  u.email,
  u.first_name,
  u.last_name,
  u.phone,
  u.profile_picture_url,
  a.bar_number,
  a.bar_state,
  a.license_verified,
  a.years_experience,
  a.specialties,
  a.rating,
  a.total_cases,
  a.success_rate,
  a.hourly_rate
FROM users u
LEFT JOIN attorneys a ON u.id = a.user_id
WHERE u.user_type = 'attorney';

-- Active Cases by Attorney
CREATE VIEW active_attorney_cases AS
SELECT
  a.id as attorney_id,
  COUNT(co.id) as active_cases
FROM attorneys a
LEFT JOIN case_offers co ON a.id = co.attorney_id AND co.status = 'retained'
GROUP BY a.id;
