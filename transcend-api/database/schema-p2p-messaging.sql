-- P2P Messaging System Schema
-- Provider-to-Provider (Attorney-to-Attorney) Messaging
-- Supports referrals, sub-contracting, negotiations, and dispute resolution

-- ============================================
-- P2P CONVERSATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS p2p_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attorney_id_1 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attorney_id_2 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  message_type VARCHAR(50) NOT NULL CHECK (message_type IN ('referral', 'subcontract', 'dispute', 'general', 'negotiation')),
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'resolved', 'disputed')),
  last_message_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_p2p_conversations_attorney_1 ON p2p_conversations(attorney_id_1);
CREATE INDEX IF NOT EXISTS idx_p2p_conversations_attorney_2 ON p2p_conversations(attorney_id_2);
CREATE INDEX IF NOT EXISTS idx_p2p_conversations_case_id ON p2p_conversations(case_id);
CREATE INDEX IF NOT EXISTS idx_p2p_conversations_status ON p2p_conversations(status);
CREATE INDEX IF NOT EXISTS idx_p2p_conversations_message_type ON p2p_conversations(message_type);
CREATE INDEX IF NOT EXISTS idx_p2p_conversations_created_at ON p2p_conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_p2p_conversations_updated_at ON p2p_conversations(updated_at);

-- Composite index for efficient conversation lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_p2p_conversations_unique
ON p2p_conversations(
  LEAST(attorney_id_1, attorney_id_2),
  GREATEST(attorney_id_1, attorney_id_2),
  case_id
);

-- ============================================
-- P2P MESSAGES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS p2p_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES p2p_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_type VARCHAR(50) NOT NULL CHECK (message_type IN ('referral', 'subcontract', 'dispute', 'general', 'negotiation')),
  subject VARCHAR(255),
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_p2p_messages_conversation_id ON p2p_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_p2p_messages_sender_id ON p2p_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_p2p_messages_recipient_id ON p2p_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_p2p_messages_message_type ON p2p_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_p2p_messages_created_at ON p2p_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_p2p_messages_read_at ON p2p_messages(read_at);

-- Full-text search index on message content
CREATE INDEX IF NOT EXISTS idx_p2p_messages_content_fts
ON p2p_messages USING GIN (to_tsvector('english', content));

-- ============================================
-- P2P REFERRALS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS p2p_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES p2p_conversations(id) ON DELETE CASCADE,
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_attorney_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  fee DECIMAL(10, 2),
  fee_percentage DECIMAL(5, 2),
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'declined')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_p2p_referrals_conversation_id ON p2p_referrals(conversation_id);
CREATE INDEX IF NOT EXISTS idx_p2p_referrals_referrer_id ON p2p_referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_p2p_referrals_referred_attorney_id ON p2p_referrals(referred_attorney_id);
CREATE INDEX IF NOT EXISTS idx_p2p_referrals_case_id ON p2p_referrals(case_id);
CREATE INDEX IF NOT EXISTS idx_p2p_referrals_status ON p2p_referrals(status);
CREATE INDEX IF NOT EXISTS idx_p2p_referrals_created_at ON p2p_referrals(created_at);

-- ============================================
-- P2P SUBCONTRACT NEGOTIATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS p2p_subcontract_negotiations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES p2p_conversations(id) ON DELETE CASCADE,
  principal_attorney_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subcontractor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  service_scope TEXT NOT NULL,
  proposed_rate DECIMAL(10, 2) NOT NULL,
  estimated_hours DECIMAL(8, 2),
  timeline VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'proposal' CHECK (status IN ('proposal', 'counter_offer', 'accepted', 'rejected', 'completed')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_p2p_subcontract_conversation_id ON p2p_subcontract_negotiations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_p2p_subcontract_principal_id ON p2p_subcontract_negotiations(principal_attorney_id);
CREATE INDEX IF NOT EXISTS idx_p2p_subcontract_subcontractor_id ON p2p_subcontract_negotiations(subcontractor_id);
CREATE INDEX IF NOT EXISTS idx_p2p_subcontract_case_id ON p2p_subcontract_negotiations(case_id);
CREATE INDEX IF NOT EXISTS idx_p2p_subcontract_status ON p2p_subcontract_negotiations(status);
CREATE INDEX IF NOT EXISTS idx_p2p_subcontract_created_at ON p2p_subcontract_negotiations(created_at);

-- ============================================
-- P2P DISPUTES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS p2p_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES p2p_conversations(id) ON DELETE CASCADE,
  initiated_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  party_1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  party_2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dispute_reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'mediation', 'escalated', 'resolved')),
  resolution_details TEXT,
  mediator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_p2p_disputes_conversation_id ON p2p_disputes(conversation_id);
CREATE INDEX IF NOT EXISTS idx_p2p_disputes_initiated_by ON p2p_disputes(initiated_by);
CREATE INDEX IF NOT EXISTS idx_p2p_disputes_party_1_id ON p2p_disputes(party_1_id);
CREATE INDEX IF NOT EXISTS idx_p2p_disputes_party_2_id ON p2p_disputes(party_2_id);
CREATE INDEX IF NOT EXISTS idx_p2p_disputes_status ON p2p_disputes(status);
CREATE INDEX IF NOT EXISTS idx_p2p_disputes_created_at ON p2p_disputes(created_at);

-- ============================================
-- AUDIT LOGGING FOR P2P ACTIVITIES
-- ============================================

-- Create trigger to automatically log P2P message creation
CREATE OR REPLACE FUNCTION log_p2p_message_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    user_id, action, entity_type, entity_id,
    changes, status, timestamp
  ) VALUES (
    NEW.sender_id, 'create', 'p2p_message', NEW.id,
    jsonb_build_object(
      'message_type', NEW.message_type,
      'conversation_id', NEW.conversation_id,
      'recipient_id', NEW.recipient_id
    ),
    'success', NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_p2p_message_creation
AFTER INSERT ON p2p_messages
FOR EACH ROW
EXECUTE FUNCTION log_p2p_message_creation();

-- Create trigger to automatically log referral creation
CREATE OR REPLACE FUNCTION log_referral_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (
    user_id, action, entity_type, entity_id,
    changes, status, timestamp
  ) VALUES (
    NEW.referrer_id, 'create', 'p2p_referral', NEW.id,
    jsonb_build_object(
      'referred_attorney_id', NEW.referred_attorney_id,
      'case_id', NEW.case_id,
      'fee', NEW.fee,
      'fee_percentage', NEW.fee_percentage
    ),
    'success', NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_referral_creation
AFTER INSERT ON p2p_referrals
FOR EACH ROW
EXECUTE FUNCTION log_referral_creation();

-- ============================================
-- MATERIALIZED VIEWS FOR ANALYTICS
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS p2p_messaging_summary AS
SELECT
  u1.id as attorney_id_1,
  CONCAT(u1.first_name, ' ', u1.last_name) as attorney_1_name,
  u2.id as attorney_id_2,
  CONCAT(u2.first_name, ' ', u2.last_name) as attorney_2_name,
  COUNT(DISTINCT pc.id) as total_conversations,
  COUNT(DISTINCT pm.id) as total_messages,
  MAX(pm.created_at) as last_message_date,
  COUNT(DISTINCT CASE WHEN pm.read_at IS NULL THEN pm.id END) as unread_messages,
  COUNT(DISTINCT pr.id) as total_referrals,
  COUNT(DISTINCT CASE WHEN pr.status = 'completed' THEN pr.id END) as completed_referrals,
  COUNT(DISTINCT ps.id) as total_subcontracts,
  COUNT(DISTINCT CASE WHEN ps.status = 'accepted' THEN ps.id END) as accepted_subcontracts,
  COUNT(DISTINCT pd.id) as total_disputes,
  COUNT(DISTINCT CASE WHEN pd.status = 'resolved' THEN pd.id END) as resolved_disputes
FROM users u1
FULL OUTER JOIN users u2 ON u1.id != u2.id
LEFT JOIN p2p_conversations pc ON (
  (pc.attorney_id_1 = u1.id AND pc.attorney_id_2 = u2.id) OR
  (pc.attorney_id_1 = u2.id AND pc.attorney_id_2 = u1.id)
)
LEFT JOIN p2p_messages pm ON pc.id = pm.conversation_id
LEFT JOIN p2p_referrals pr ON pc.id = pr.conversation_id
LEFT JOIN p2p_subcontract_negotiations ps ON pc.id = ps.conversation_id
LEFT JOIN p2p_disputes pd ON pc.id = pd.conversation_id
WHERE u1.user_type = 'attorney' AND u2.user_type = 'attorney' AND u1.id < u2.id
GROUP BY u1.id, u2.id, u1.first_name, u1.last_name, u2.first_name, u2.last_name;

CREATE INDEX idx_p2p_messaging_summary_attorney_1 ON p2p_messaging_summary(attorney_id_1);
CREATE INDEX idx_p2p_messaging_summary_attorney_2 ON p2p_messaging_summary(attorney_id_2);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get unread message count for an attorney
CREATE OR REPLACE FUNCTION get_unread_messages_count(attorney_id UUID)
RETURNS INTEGER AS $$
SELECT COUNT(*) FROM p2p_messages
WHERE recipient_id = attorney_id AND read_at IS NULL;
$$ LANGUAGE SQL STABLE;

-- Function to get active referral count for an attorney
CREATE OR REPLACE FUNCTION get_active_referrals_count(attorney_id UUID)
RETURNS INTEGER AS $$
SELECT COUNT(*) FROM p2p_referrals
WHERE (referrer_id = attorney_id OR referred_attorney_id = attorney_id)
AND status IN ('pending', 'accepted');
$$ LANGUAGE SQL STABLE;

-- Function to calculate average response time (in minutes)
CREATE OR REPLACE FUNCTION get_average_response_time(attorney_id UUID)
RETURNS NUMERIC AS $$
SELECT AVG(EXTRACT(EPOCH FROM (m2.created_at - m1.created_at))/60)
FROM p2p_messages m1
JOIN p2p_messages m2 ON m1.conversation_id = m2.conversation_id
WHERE m1.sender_id = attorney_id
AND m2.recipient_id = attorney_id
AND m2.created_at > m1.created_at
AND m2.created_at - m1.created_at < interval '24 hours';
$$ LANGUAGE SQL STABLE;

-- ============================================
-- GRANTS (adjust based on your application user)
-- ============================================

-- Grants are conditional: this file previously granted to a hardcoded
-- 'transcend_user' role that no migration creates, so applying the schema to a
-- fresh database failed here and left the p2p tables ungranted. The application
-- role is configurable via the DB_APP_ROLE setting, defaulting to the owner.
DO $$
DECLARE
  app_role text := coalesce(current_setting('transcend.app_role', true), 'transcend_user');
  t text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
    RAISE NOTICE 'Role % does not exist; skipping p2p grants (tables are owned by %)', app_role, current_user;
    RETURN;
  END IF;

  FOREACH t IN ARRAY ARRAY['p2p_conversations','p2p_messages','p2p_referrals',
                           'p2p_subcontract_negotiations','p2p_disputes']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO %I', t, app_role);
  END LOOP;
END $$;
