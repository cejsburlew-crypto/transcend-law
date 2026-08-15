-- UAT Test Data Seeding Script
-- Creates test users, cases, and data for UAT testing

-- Disable triggers temporarily
ALTER TABLE users DISABLE TRIGGER ALL;

-- Create test users
INSERT INTO users (id, email, password_hash, user_type, created_at, email_verified) VALUES
  ('uat-client-1', 'uat-client-1@test.com', '$2b$10$abc123...', 'client', NOW(), true),
  ('uat-client-2', 'uat-client-2@test.com', '$2b$10$abc123...', 'client', NOW(), true),
  ('uat-attorney-1', 'uat-attorney-1@test.com', '$2b$10$abc123...', 'attorney', NOW(), true),
  ('uat-attorney-2', 'uat-attorney-2@test.com', '$2b$10$abc123...', 'attorney', NOW(), true),
  ('uat-admin', 'uat-admin@test.com', '$2b$10$abc123...', 'admin', NOW(), true);

-- Create test law firms
INSERT INTO law_firms (id, name, bio, rating, specialties, tier) VALUES
  ('firm-1', 'Premium Law Firm', 'Top tier firm specializing in IP', 4.8, ARRAY['Trademark', 'Patent'], 'premium'),
  ('firm-2', 'General Practice', 'Full service law firm', 4.5, ARRAY['Contract', 'Litigation'], 'basic'),
  ('firm-3', 'Boutique IP Firm', 'Focused on intellectual property', 4.9, ARRAY['Trademark', 'Copyright'], 'premium');

-- Create test cases
INSERT INTO cases (id, user_id, title, description, service_type, status, budget, urgency) VALUES
  ('case-1', 'uat-client-1', 'Trademark Dispute UAT', 'Test case for trademark dispute', 'trademark', 'open', 5000, 'high'),
  ('case-2', 'uat-client-2', 'Patent Issue UAT', 'Test case for patent issue', 'patent', 'open', 10000, 'medium'),
  ('case-3', 'uat-client-1', 'Contract Review UAT', 'Test case for contract review', 'contract', 'open', 2000, 'low');

-- Create test conversations
INSERT INTO conversations (id, case_id, participant_ids) VALUES
  ('conv-1', 'case-1', ARRAY['uat-client-1', 'uat-attorney-1']),
  ('conv-2', 'case-2', ARRAY['uat-client-2', 'uat-attorney-2']);

-- Create test messages
INSERT INTO messages (id, conversation_id, sender_id, content) VALUES
  ('msg-1', 'conv-1', 'uat-client-1', 'Hello, I need help with my trademark issue'),
  ('msg-2', 'conv-1', 'uat-attorney-1', 'I can help. Let me review your case details');

-- Create test subscriptions
INSERT INTO subscriptions (id, user_id, plan_id, status, started_at) VALUES
  ('sub-1', 'uat-client-1', 'professional', 'active', NOW()),
  ('sub-2', 'uat-attorney-1', 'professional', 'active', NOW());

-- Re-enable triggers
ALTER TABLE users ENABLE TRIGGER ALL;

-- Verify data
SELECT 'Users created:' as status, COUNT(*) FROM users WHERE email LIKE 'uat-%';
SELECT 'Cases created:' as status, COUNT(*) FROM cases WHERE title LIKE '%UAT%';
SELECT 'Messages created:' as status, COUNT(*) FROM messages;
