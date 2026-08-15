// AI Chatbot Service
// Features: GPT-4 powered chatbot, knowledge base integration, conversation history,
// escalation to human support, user satisfaction rating, analytics on common issues

import { v4 as uuidv4 } from 'uuid';
import { query } from '../database/connection';
import { logAction } from './auditLogger';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface ChatMessage {
  id: string;
  conversationId: string;
  userId: string;
  senderType: 'user' | 'bot' | 'agent';
  content: string;
  timestamp: Date;
  metadata?: {
    messageType?: 'question' | 'answer' | 'clarification' | 'escalation';
    confidence?: number;
    sourceDocs?: string[];
    aiModel?: string;
  };
}

export interface Conversation {
  id: string;
  userId: string;
  startedAt: Date;
  updatedAt: Date;
  endedAt?: Date;
  status: 'active' | 'resolved' | 'escalated' | 'closed';
  messages: ChatMessage[];
  topic?: string;
  userSatisfaction?: number; // 1-5 rating
  escalatedTo?: string; // agent ID
  resolution?: string;
  isEscalated: boolean;
  escalationReason?: string;
}

export interface KnowledgeBaseDoc {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  embeddings?: number[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface ChatbotAnalytics {
  id: string;
  date: Date;
  totalConversations: number;
  averageConversationLength: number;
  resolutionRate: number; // percentage
  escalationRate: number; // percentage
  avgResponseTime: number; // milliseconds
  avgUserSatisfaction: number; // 1-5 average
  topTopics: Array<{ topic: string; count: number }>;
  commonQuestions: Array<{ question: string; count: number }>;
  unknownQuestions: string[];
}

export interface ChatbotConfig {
  maxContextLength: number;
  escalationThreshold: number; // confidence score threshold for escalation
  allowedModelId: string;
  knowledgeBaseUpdateInterval: number; // milliseconds
  conversationTimeoutMinutes: number;
}

export interface CommonQuestion {
  id: string;
  question: string;
  answer: string;
  category: string;
  timesAsked: number;
  resolution: string;
  updatedAt: Date;
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================

const DEFAULT_CONFIG: ChatbotConfig = {
  maxContextLength: 4000,
  escalationThreshold: 0.4, // Below 40% confidence triggers escalation
  allowedModelId: 'gpt-4',
  knowledgeBaseUpdateInterval: 3600000, // 1 hour
  conversationTimeoutMinutes: 30,
};

// ============================================
// KNOWLEDGE BASE OPERATIONS
// ============================================

/**
 * Initialize knowledge base with common questions and answers
 */
export async function initializeKnowledgeBase(): Promise<void> {
  try {
    const commonDocs = [
      {
        title: 'How do I create an account?',
        content: 'To create an account: 1. Visit our homepage 2. Click Sign Up 3. Enter your email 4. Create a strong password 5. Verify your email address',
        category: 'Account Setup',
        tags: ['registration', 'account', 'setup'],
      },
      {
        title: 'How do I reset my password?',
        content: 'To reset your password: 1. Click Forgot Password on login page 2. Enter your email 3. Check your email for reset link 4. Click the link and create new password 5. Login with new password',
        category: 'Account Security',
        tags: ['password', 'security', 'reset'],
      },
      {
        title: 'What services are available?',
        content: 'We offer legal services, notary services, tax preparation, document review, and business consulting. Each service is available through our service directory.',
        category: 'Services',
        tags: ['services', 'offerings', 'directory'],
      },
      {
        title: 'How do I find a service provider?',
        content: 'Use our Service Directory to browse providers by location, specialization, and ratings. Filter by your needs and contact providers directly.',
        category: 'Service Discovery',
        tags: ['directory', 'providers', 'search'],
      },
      {
        title: 'Is my data secure?',
        content: 'Yes, we implement encryption at rest and in transit, follow GDPR/CCPA compliance, and never share data with third parties without explicit consent.',
        category: 'Privacy & Security',
        tags: ['security', 'privacy', 'data-protection'],
      },
      {
        title: 'How do I contact support?',
        content: 'You can contact our support team via: 1. Live chat (24/7) 2. Email: support@transcend.com 3. Phone: 1-800-TRANSCEND 4. In-app support messages',
        category: 'Support',
        tags: ['contact', 'support', 'help'],
      },
    ];

    for (const doc of commonDocs) {
      await addKnowledgeBaseDoc(
        doc.title,
        doc.content,
        doc.category,
        doc.tags
      );
    }

    console.log('Knowledge base initialized with common documents');
  } catch (error) {
    console.error('Error initializing knowledge base:', error);
    throw error;
  }
}

/**
 * Add a document to the knowledge base
 */
export async function addKnowledgeBaseDoc(
  title: string,
  content: string,
  category: string,
  tags: string[]
): Promise<KnowledgeBaseDoc> {
  const id = uuidv4();
  const now = new Date();

  const sql = `
    INSERT INTO knowledge_base_docs (id, title, content, category, tags, created_at, updated_at, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;

  try {
    const result = await query(sql, [id, title, content, category, tags, now, now, true]);
    return result.rows[0] as KnowledgeBaseDoc;
  } catch (error) {
    console.error('Error adding knowledge base document:', error);
    throw error;
  }
}

/**
 * Search knowledge base by semantic similarity or keywords
 */
export async function searchKnowledgeBase(
  searchQuery: string,
  limit: number = 5
): Promise<KnowledgeBaseDoc[]> {
  const sql = `
    SELECT * FROM knowledge_base_docs
    WHERE is_active = true
    AND (
      title ILIKE $1
      OR content ILIKE $1
      OR $2 && tags
    )
    LIMIT $3
  `;

  try {
    const keywords = searchQuery.toLowerCase().split(' ');
    const result = await query(sql, [
      `%${searchQuery}%`,
      keywords,
      limit,
    ]);
    return result.rows as KnowledgeBaseDoc[];
  } catch (error) {
    console.error('Error searching knowledge base:', error);
    throw error;
  }
}

// ============================================
// CONVERSATION MANAGEMENT
// ============================================

/**
 * Create a new conversation
 */
export async function createConversation(userId: string): Promise<Conversation> {
  const id = uuidv4();
  const now = new Date();

  const sql = `
    INSERT INTO chatbot_conversations (id, user_id, started_at, updated_at, status, is_escalated)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;

  try {
    const result = await query(sql, [id, userId, now, now, 'active', false]);
    const conv = result.rows[0];

    await logAction('chatbot_conversation_created', userId, {
      conversationId: id,
      timestamp: now,
    });

    return {
      id: conv.id,
      userId: conv.user_id,
      startedAt: conv.started_at,
      updatedAt: conv.updated_at,
      status: conv.status,
      messages: [],
      isEscalated: conv.is_escalated,
    };
  } catch (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }
}

/**
 * Get conversation history
 */
export async function getConversation(conversationId: string): Promise<Conversation | null> {
  const sql = `
    SELECT c.*,
           json_agg(
             json_build_object(
               'id', m.id,
               'conversationId', m.conversation_id,
               'userId', m.user_id,
               'senderType', m.sender_type,
               'content', m.content,
               'timestamp', m.timestamp,
               'metadata', m.metadata
             ) ORDER BY m.timestamp
           ) AS messages
    FROM chatbot_conversations c
    LEFT JOIN chatbot_messages m ON c.id = m.conversation_id
    WHERE c.id = $1
    GROUP BY c.id
  `;

  try {
    const result = await query(sql, [conversationId]);
    if (result.rows.length === 0) {
      return null;
    }

    const conv = result.rows[0];
    return {
      id: conv.id,
      userId: conv.user_id,
      startedAt: conv.started_at,
      updatedAt: conv.updated_at,
      endedAt: conv.ended_at,
      status: conv.status,
      messages: conv.messages?.filter((m: any) => m.id) || [],
      topic: conv.topic,
      userSatisfaction: conv.user_satisfaction,
      escalatedTo: conv.escalated_to,
      resolution: conv.resolution,
      isEscalated: conv.is_escalated,
      escalationReason: conv.escalation_reason,
    };
  } catch (error) {
    console.error('Error getting conversation:', error);
    throw error;
  }
}

/**
 * Save a message to conversation
 */
export async function saveMessage(
  conversationId: string,
  userId: string,
  senderType: 'user' | 'bot' | 'agent',
  content: string,
  metadata?: any
): Promise<ChatMessage> {
  const id = uuidv4();
  const timestamp = new Date();

  const sql = `
    INSERT INTO chatbot_messages (id, conversation_id, user_id, sender_type, content, timestamp, metadata)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

  try {
    const result = await query(sql, [
      id,
      conversationId,
      userId,
      senderType,
      content,
      timestamp,
      metadata ? JSON.stringify(metadata) : null,
    ]);

    // Update conversation updated_at
    const updateSql = 'UPDATE chatbot_conversations SET updated_at = $1 WHERE id = $2';
    await query(updateSql, [timestamp, conversationId]);

    return result.rows[0] as ChatMessage;
  } catch (error) {
    console.error('Error saving message:', error);
    throw error;
  }
}

// ============================================
// GPT-4 INTEGRATION
// ============================================

/**
 * Process user message and generate bot response using GPT-4
 */
export async function generateChatbotResponse(
  userMessage: string,
  conversationHistory: ChatMessage[],
  userId: string
): Promise<{ response: string; confidence: number; shouldEscalate: boolean }> {
  try {
    // Search knowledge base for relevant documents
    const relevantDocs = await searchKnowledgeBase(userMessage, 5);

    // Build context from knowledge base and conversation history
    let context = 'You are a helpful support assistant. ';

    if (relevantDocs.length > 0) {
      context += 'Relevant information: ';
      relevantDocs.forEach((doc) => {
        context += `${doc.title}: ${doc.content}. `;
      });
    }

    context += '\nConversation history:\n';
    conversationHistory.slice(-10).forEach((msg) => {
      context += `${msg.senderType === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
    });

    // Make GPT-4 API call (simulated for now)
    const response = await callGPT4API(userMessage, context);

    // Determine confidence score and escalation need
    const { confidenceScore, shouldEscalate } = await assessResponse(response);

    return {
      response,
      confidence: confidenceScore,
      shouldEscalate,
    };
  } catch (error) {
    console.error('Error generating chatbot response:', error);
    throw error;
  }
}

/**
 * Call GPT-4 API with conversation context
 */
async function callGPT4API(userMessage: string, context: string): Promise<string> {
  // This is a placeholder for actual GPT-4 API integration
  // In production, integrate with OpenAI's GPT-4 API
  try {
    // Simulated GPT-4 response
    // In production: Use OpenAI SDK or REST API
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Mock response for demonstration
    const responses: { [key: string]: string } = {
      account: 'To manage your account, visit your profile settings where you can update personal information, security settings, and preferences.',
      service: 'Our service directory offers legal services, notary services, tax preparation, document review, and business consulting.',
      password: 'To reset your password, click Forgot Password on the login page, verify your email, and create a new password.',
      security: 'Your data is protected with industry-standard encryption and regular security audits.',
    };

    // Find matching response based on keywords
    const messageWords = userMessage.toLowerCase();
    for (const [key, response] of Object.entries(responses)) {
      if (messageWords.includes(key)) {
        return response;
      }
    }

    return 'Thank you for your question. I understand you need help with: ' +
           userMessage + '. Could you provide more details so I can better assist you?';
  } catch (error) {
    console.error('Error calling GPT-4 API:', error);
    throw error;
  }
}

/**
 * Assess response quality and confidence score
 */
async function assessResponse(response: string): Promise<{
  confidenceScore: number;
  shouldEscalate: boolean;
}> {
  // Calculate confidence based on response length, specificity, etc.
  const hasConfidentKeywords = /^(to|you can|we recommend|here's|step|try)/i.test(response);
  const responseLength = response.split(' ').length;
  const hasNumericalInfo = /\d+/.test(response);

  let confidenceScore = 0.5; // Base confidence

  if (hasConfidentKeywords) confidenceScore += 0.2;
  if (responseLength > 20) confidenceScore += 0.15;
  if (hasNumericalInfo) confidenceScore += 0.15;

  // Escalate if confidence is below threshold
  const shouldEscalate = confidenceScore < DEFAULT_CONFIG.escalationThreshold;

  return {
    confidenceScore: Math.min(1.0, confidenceScore),
    shouldEscalate,
  };
}

// ============================================
// ESCALATION
// ============================================

/**
 * Escalate conversation to human agent
 */
export async function escalateConversation(
  conversationId: string,
  reason: string,
  agentId?: string
): Promise<Conversation> {
  const now = new Date();

  const sql = `
    UPDATE chatbot_conversations
    SET is_escalated = true,
        status = 'escalated',
        escalation_reason = $1,
        escalated_to = $2,
        updated_at = $3
    WHERE id = $4
    RETURNING *
  `;

  try {
    const result = await query(sql, [reason, agentId || null, now, conversationId]);
    const conv = result.rows[0];

    await logAction('chatbot_escalated', conv.user_id, {
      conversationId,
      reason,
      agentId,
      timestamp: now,
    });

    // Get full conversation
    return (await getConversation(conversationId)) as Conversation;
  } catch (error) {
    console.error('Error escalating conversation:', error);
    throw error;
  }
}

// ============================================
// SATISFACTION RATING
// ============================================

/**
 * Record user satisfaction rating
 */
export async function recordSatisfactionRating(
  conversationId: string,
  userId: string,
  rating: number, // 1-5
  feedback?: string
): Promise<void> {
  if (rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  const sql = `
    UPDATE chatbot_conversations
    SET user_satisfaction = $1,
        status = 'resolved',
        updated_at = $2
    WHERE id = $3
  `;

  try {
    await query(sql, [rating, new Date(), conversationId]);

    await logAction('chatbot_satisfaction_recorded', userId, {
      conversationId,
      rating,
      feedback,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error recording satisfaction rating:', error);
    throw error;
  }
}

// ============================================
// COMMON QUESTIONS MANAGEMENT
// ============================================

/**
 * Track and update common questions
 */
export async function trackCommonQuestion(
  question: string,
  answer: string,
  category: string,
  userId: string
): Promise<CommonQuestion> {
  const id = uuidv4();
  const now = new Date();

  const sql = `
    INSERT INTO common_questions (id, question, answer, category, times_asked, updated_at)
    VALUES ($1, $2, $3, $4, 1, $5)
    ON CONFLICT (question) DO UPDATE
    SET times_asked = common_questions.times_asked + 1,
        updated_at = $5
    RETURNING *
  `;

  try {
    const result = await query(sql, [id, question, answer, category, now]);

    await logAction('common_question_tracked', userId, {
      question,
      category,
      timestamp: now,
    });

    return result.rows[0] as CommonQuestion;
  } catch (error) {
    console.error('Error tracking common question:', error);
    throw error;
  }
}

/**
 * Get most common questions
 */
export async function getCommonQuestions(limit: number = 10): Promise<CommonQuestion[]> {
  const sql = `
    SELECT * FROM common_questions
    ORDER BY times_asked DESC
    LIMIT $1
  `;

  try {
    const result = await query(sql, [limit]);
    return result.rows as CommonQuestion[];
  } catch (error) {
    console.error('Error getting common questions:', error);
    throw error;
  }
}

// ============================================
// ANALYTICS
// ============================================

/**
 * Get chatbot analytics for a date range
 */
export async function getChatbotAnalytics(
  startDate: Date,
  endDate: Date
): Promise<ChatbotAnalytics> {
  const id = uuidv4();
  const now = new Date();

  const sql = `
    SELECT
      COUNT(DISTINCT c.id) as total_conversations,
      AVG(array_length(agg_messages, 1)) as avg_messages,
      COUNT(CASE WHEN c.status = 'resolved' THEN 1 END)::float / COUNT(DISTINCT c.id) as resolution_rate,
      COUNT(CASE WHEN c.is_escalated THEN 1 END)::float / COUNT(DISTINCT c.id) as escalation_rate,
      AVG(EXTRACT(EPOCH FROM (c.updated_at - c.started_at))) * 1000 as avg_response_time,
      AVG(c.user_satisfaction) as avg_satisfaction
    FROM chatbot_conversations c
    LEFT JOIN LATERAL (
      SELECT array_agg(id) as agg_messages
      FROM chatbot_messages
      WHERE conversation_id = c.id
    ) m ON true
    WHERE c.started_at >= $1 AND c.started_at <= $2
  `;

  try {
    const result = await query(sql, [startDate, endDate]);
    const row = result.rows[0];

    // Get top topics and questions
    const topicsSql = `
      SELECT c.topic, COUNT(*) as count
      FROM chatbot_conversations c
      WHERE c.started_at >= $1 AND c.started_at <= $2
      AND c.topic IS NOT NULL
      GROUP BY c.topic
      ORDER BY count DESC
      LIMIT 5
    `;

    const topicsResult = await query(topicsSql, [startDate, endDate]);
    const topTopics = topicsResult.rows.map((r) => ({
      topic: r.topic,
      count: r.count,
    }));

    const questionsSql = `
      SELECT m.content as question, COUNT(*) as count
      FROM chatbot_messages m
      JOIN chatbot_conversations c ON m.conversation_id = c.id
      WHERE m.sender_type = 'user'
      AND c.started_at >= $1 AND c.started_at <= $2
      GROUP BY m.content
      ORDER BY count DESC
      LIMIT 10
    `;

    const questionsResult = await query(questionsSql, [startDate, endDate]);
    const commonQuestions = questionsResult.rows.map((r) => ({
      question: r.question,
      count: r.count,
    }));

    return {
      id,
      date: now,
      totalConversations: row.total_conversations || 0,
      averageConversationLength: row.avg_messages || 0,
      resolutionRate: (row.resolution_rate || 0) * 100,
      escalationRate: (row.escalation_rate || 0) * 100,
      avgResponseTime: row.avg_response_time || 0,
      avgUserSatisfaction: row.avg_satisfaction || 0,
      topTopics,
      commonQuestions,
      unknownQuestions: [],
    };
  } catch (error) {
    console.error('Error getting chatbot analytics:', error);
    throw error;
  }
}

/**
 * Get conversation analytics
 */
export async function getConversationAnalytics(
  conversationId: string
): Promise<{
  messageCount: number;
  duration: number;
  escalated: boolean;
  satisfaction?: number;
}> {
  const sql = `
    SELECT
      COUNT(m.id) as message_count,
      EXTRACT(EPOCH FROM (c.updated_at - c.started_at)) as duration,
      c.is_escalated,
      c.user_satisfaction
    FROM chatbot_conversations c
    LEFT JOIN chatbot_messages m ON c.id = m.conversation_id
    WHERE c.id = $1
    GROUP BY c.id, c.is_escalated, c.user_satisfaction, c.updated_at, c.started_at
  `;

  try {
    const result = await query(sql, [conversationId]);
    if (result.rows.length === 0) {
      throw new Error('Conversation not found');
    }

    const row = result.rows[0];
    return {
      messageCount: row.message_count || 0,
      duration: row.duration || 0,
      escalated: row.is_escalated,
      satisfaction: row.user_satisfaction,
    };
  } catch (error) {
    console.error('Error getting conversation analytics:', error);
    throw error;
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Close conversation
 */
export async function closeConversation(
  conversationId: string,
  resolution: string
): Promise<void> {
  const sql = `
    UPDATE chatbot_conversations
    SET status = 'closed',
        resolution = $1,
        ended_at = $2
    WHERE id = $3
  `;

  try {
    await query(sql, [resolution, new Date(), conversationId]);
  } catch (error) {
    console.error('Error closing conversation:', error);
    throw error;
  }
}

/**
 * Get user's conversation history
 */
export async function getUserConversationHistory(userId: string, limit: number = 20): Promise<Conversation[]> {
  const sql = `
    SELECT c.*,
           COUNT(m.id) as message_count
    FROM chatbot_conversations c
    LEFT JOIN chatbot_messages m ON c.id = m.conversation_id
    WHERE c.user_id = $1
    GROUP BY c.id
    ORDER BY c.started_at DESC
    LIMIT $2
  `;

  try {
    const result = await query(sql, [userId, limit]);
    const conversations = [];

    for (const row of result.rows) {
      const conv = await getConversation(row.id);
      if (conv) conversations.push(conv);
    }

    return conversations;
  } catch (error) {
    console.error('Error getting user conversation history:', error);
    throw error;
  }
}
