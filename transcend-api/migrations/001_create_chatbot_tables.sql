-- AI Chatbot Tables Migration
-- Creates tables for conversation management, messages, knowledge base, and analytics

-- ============================================
-- CONVERSATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS chatbot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  status VARCHAR(50) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'resolved', 'escalated', 'closed')),
  topic VARCHAR(255),
  user_satisfaction SMALLINT CHECK (user_satisfaction >= 1 AND user_satisfaction <= 5),
  is_escalated BOOLEAN DEFAULT false,
  escalation_reason TEXT,
  escalated_to UUID,
  resolution TEXT,
  metadata JSONB,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_chatbot_conversations_user_id ON chatbot_conversations(user_id);
CREATE INDEX idx_chatbot_conversations_status ON chatbot_conversations(status);
CREATE INDEX idx_chatbot_conversations_started_at ON chatbot_conversations(started_at DESC);
CREATE INDEX idx_chatbot_conversations_is_escalated ON chatbot_conversations(is_escalated);

-- ============================================
-- MESSAGES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS chatbot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  user_id UUID NOT NULL,
  sender_type VARCHAR(20) NOT NULL
    CHECK (sender_type IN ('user', 'bot', 'agent')),
  content TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB,
  FOREIGN KEY (conversation_id) REFERENCES chatbot_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_chatbot_messages_conversation_id ON chatbot_messages(conversation_id);
CREATE INDEX idx_chatbot_messages_user_id ON chatbot_messages(user_id);
CREATE INDEX idx_chatbot_messages_sender_type ON chatbot_messages(sender_type);
CREATE INDEX idx_chatbot_messages_timestamp ON chatbot_messages(timestamp DESC);

-- ============================================
-- KNOWLEDGE BASE DOCUMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS knowledge_base_docs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  embeddings VECTOR(1536),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  metadata JSONB
);

CREATE INDEX idx_knowledge_base_docs_category ON knowledge_base_docs(category);
CREATE INDEX idx_knowledge_base_docs_is_active ON knowledge_base_docs(is_active);
CREATE INDEX idx_knowledge_base_docs_created_at ON knowledge_base_docs(created_at DESC);
CREATE INDEX idx_knowledge_base_docs_tags ON knowledge_base_docs USING GIN(tags);

-- ============================================
-- COMMON QUESTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS common_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL UNIQUE,
  answer TEXT NOT NULL,
  category VARCHAR(100),
  times_asked INTEGER DEFAULT 1,
  resolution VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB
);

CREATE INDEX idx_common_questions_times_asked ON common_questions(times_asked DESC);
CREATE INDEX idx_common_questions_category ON common_questions(category);
CREATE INDEX idx_common_questions_updated_at ON common_questions(updated_at DESC);

-- ============================================
-- CHATBOT ANALYTICS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS chatbot_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE DEFAULT CURRENT_DATE,
  total_conversations INTEGER,
  resolved_conversations INTEGER,
  escalated_conversations INTEGER,
  average_satisfaction DECIMAL(3, 2),
  average_response_time_ms INTEGER,
  average_conversation_length INTEGER,
  peak_topic VARCHAR(255),
  most_common_issue TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB
);

CREATE INDEX idx_chatbot_analytics_date ON chatbot_analytics(date DESC);
CREATE INDEX idx_chatbot_analytics_created_at ON chatbot_analytics(created_at DESC);

-- ============================================
-- SATISFACTION FEEDBACK TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS chatbot_satisfaction_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  user_id UUID NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES chatbot_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_chatbot_satisfaction_feedback_conversation_id
  ON chatbot_satisfaction_feedback(conversation_id);
CREATE INDEX idx_chatbot_satisfaction_feedback_user_id
  ON chatbot_satisfaction_feedback(user_id);
CREATE INDEX idx_chatbot_satisfaction_feedback_rating
  ON chatbot_satisfaction_feedback(rating);
CREATE INDEX idx_chatbot_satisfaction_feedback_created_at
  ON chatbot_satisfaction_feedback(created_at DESC);

-- ============================================
-- ESCALATION LOG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS chatbot_escalation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  user_id UUID NOT NULL,
  agent_id UUID,
  reason TEXT,
  escalated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  resolution TEXT,
  metadata JSONB,
  FOREIGN KEY (conversation_id) REFERENCES chatbot_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_chatbot_escalation_log_conversation_id
  ON chatbot_escalation_log(conversation_id);
CREATE INDEX idx_chatbot_escalation_log_user_id
  ON chatbot_escalation_log(user_id);
CREATE INDEX idx_chatbot_escalation_log_agent_id
  ON chatbot_escalation_log(agent_id);
CREATE INDEX idx_chatbot_escalation_log_escalated_at
  ON chatbot_escalation_log(escalated_at DESC);

-- ============================================
-- CHATBOT CONFIGURATION TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS chatbot_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_chatbot_configuration_key ON chatbot_configuration(key);

-- ============================================
-- INSERT DEFAULT CONFIGURATIONS
-- ============================================

INSERT INTO chatbot_configuration (key, value, description) VALUES
  ('max_context_length', '4000', 'Maximum context length for GPT-4 API calls'),
  ('escalation_threshold', '0.4', 'Confidence score threshold for automatic escalation'),
  ('allowed_model_id', 'gpt-4', 'Allowed AI model ID for chatbot'),
  ('knowledge_base_update_interval', '3600000', 'Knowledge base update interval in milliseconds'),
  ('conversation_timeout_minutes', '30', 'Conversation inactivity timeout in minutes'),
  ('enable_satisfaction_rating', 'true', 'Enable user satisfaction rating'),
  ('enable_analytics', 'true', 'Enable analytics tracking'),
  ('max_escalation_wait_time', '300', 'Max wait time for agent in seconds')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- GRANTS (if using separate roles)
-- ============================================

GRANT SELECT, INSERT, UPDATE ON chatbot_conversations TO app_user;
GRANT SELECT, INSERT, UPDATE ON chatbot_messages TO app_user;
GRANT SELECT ON knowledge_base_docs TO app_user;
GRANT SELECT, INSERT ON common_questions TO app_user;
GRANT SELECT, INSERT ON chatbot_satisfaction_feedback TO app_user;
GRANT SELECT ON chatbot_analytics TO app_user;
GRANT SELECT ON chatbot_escalation_log TO app_user;
GRANT SELECT ON chatbot_configuration TO app_user;

-- Admin-only operations
GRANT UPDATE ON knowledge_base_docs TO admin_user;
GRANT DELETE ON chatbot_conversations TO admin_user;
GRANT DELETE ON chatbot_messages TO admin_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON chatbot_analytics TO admin_user;
GRANT SELECT, INSERT, UPDATE ON chatbot_configuration TO admin_user;
