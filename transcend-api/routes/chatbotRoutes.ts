// AI Chatbot API Routes
// Endpoints for conversation management, message handling, escalation, and analytics

import { Router, Request, Response } from 'express';
import {
  createConversation,
  getConversation,
  saveMessage,
  generateChatbotResponse,
  escalateConversation,
  recordSatisfactionRating,
  trackCommonQuestion,
  getChatbotAnalytics,
  getConversationAnalytics,
  getCommonQuestions,
  getUserConversationHistory,
  closeConversation,
  initializeKnowledgeBase,
  addKnowledgeBaseDoc,
  searchKnowledgeBase,
} from '../services/aiChatbot';
import { logAction } from '../services/auditLogger';
import { authMiddleware, adminMiddleware } from '../middleware/auth';

const router = Router();

// ============================================
// CONVERSATION ENDPOINTS
// ============================================

/**
 * POST /api/chatbot/conversations
 * Create a new conversation
 */
router.post('/conversations', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const conversation = await createConversation(userId);

    res.status(201).json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

/**
 * GET /api/chatbot/conversations/:conversationId
 * Get conversation details
 */
router.get('/conversations/:conversationId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;

    const conversation = await getConversation(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Verify user owns this conversation
    if (conversation.userId !== req.user?.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json(conversation);
  } catch (error) {
    console.error('Error getting conversation:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

/**
 * GET /api/chatbot/conversations
 * Get user's conversation history
 */
router.get('/conversations', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const conversations = await getUserConversationHistory(userId, limit);

    res.json(conversations);
  } catch (error) {
    console.error('Error getting conversation history:', error);
    res.status(500).json({ error: 'Failed to get conversation history' });
  }
});

// ============================================
// MESSAGE ENDPOINTS
// ============================================

/**
 * POST /api/chatbot/messages
 * Send a message and get bot response
 */
router.post('/messages', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { conversationId, content } = req.body;

    if (!conversationId || !content) {
      return res.status(400).json({
        error: 'Missing required fields: conversationId, content',
      });
    }

    // Verify user owns this conversation
    const conversation = await getConversation(conversationId);
    if (!conversation || conversation.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Save user message
    const userMessage = await saveMessage(
      conversationId,
      userId,
      'user',
      content
    );

    // Generate bot response
    const { response, confidence, shouldEscalate } = await generateChatbotResponse(
      content,
      conversation.messages,
      userId
    );

    // Save bot message
    const botMessage = await saveMessage(
      conversationId,
      userId,
      'bot',
      response,
      {
        confidence,
        shouldEscalate,
        messageType: 'answer',
      }
    );

    // Track common question if confidence is high
    if (confidence > 0.7) {
      await trackCommonQuestion(content, response, 'general', userId);
    }

    res.status(201).json(botMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ============================================
// ESCALATION ENDPOINTS
// ============================================

/**
 * POST /api/chatbot/escalate
 * Escalate conversation to human agent
 */
router.post('/escalate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { conversationId, reason } = req.body;

    if (!conversationId) {
      return res.status(400).json({
        error: 'Missing required field: conversationId',
      });
    }

    // Verify user owns this conversation
    const conversation = await getConversation(conversationId);
    if (!conversation || conversation.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Escalate conversation
    const escalatedConversation = await escalateConversation(
      conversationId,
      reason || 'User requested escalation',
      undefined // agentId would be assigned by support system
    );

    res.json(escalatedConversation);
  } catch (error) {
    console.error('Error escalating conversation:', error);
    res.status(500).json({ error: 'Failed to escalate conversation' });
  }
});

// ============================================
// SATISFACTION & FEEDBACK ENDPOINTS
// ============================================

/**
 * POST /api/chatbot/satisfaction
 * Record user satisfaction rating
 */
router.post('/satisfaction', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { conversationId, rating, feedback } = req.body;

    if (!conversationId || rating === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: conversationId, rating',
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        error: 'Rating must be between 1 and 5',
      });
    }

    // Verify user owns this conversation
    const conversation = await getConversation(conversationId);
    if (!conversation || conversation.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await recordSatisfactionRating(conversationId, userId, rating, feedback);

    res.json({ success: true, message: 'Rating recorded' });
  } catch (error) {
    console.error('Error recording satisfaction:', error);
    res.status(500).json({ error: 'Failed to record satisfaction' });
  }
});

/**
 * POST /api/chatbot/close
 * Close a conversation
 */
router.post('/close', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { conversationId, resolution } = req.body;

    if (!conversationId) {
      return res.status(400).json({
        error: 'Missing required field: conversationId',
      });
    }

    // Verify user owns this conversation
    const conversation = await getConversation(conversationId);
    if (!conversation || conversation.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await closeConversation(conversationId, resolution || 'Closed by user');

    res.json({ success: true, message: 'Conversation closed' });
  } catch (error) {
    console.error('Error closing conversation:', error);
    res.status(500).json({ error: 'Failed to close conversation' });
  }
});

// ============================================
// ANALYTICS ENDPOINTS
// ============================================

/**
 * GET /api/chatbot/analytics
 * Get chatbot analytics for date range
 * Requires admin access
 */
router.get('/analytics', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

    if (startDate > endDate) {
      return res.status(400).json({
        error: 'Start date must be before end date',
      });
    }

    const analytics = await getChatbotAnalytics(startDate, endDate);

    res.json(analytics);
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

/**
 * GET /api/chatbot/analytics/conversation/:conversationId
 * Get analytics for a specific conversation
 */
router.get('/analytics/conversation/:conversationId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;

    // Verify user owns this conversation
    const conversation = await getConversation(conversationId);
    if (!conversation || conversation.userId !== req.user?.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const analytics = await getConversationAnalytics(conversationId);

    res.json(analytics);
  } catch (error) {
    console.error('Error getting conversation analytics:', error);
    res.status(500).json({ error: 'Failed to get conversation analytics' });
  }
});

/**
 * GET /api/chatbot/common-questions
 * Get most common questions
 * Requires admin access
 */
router.get('/common-questions', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const questions = await getCommonQuestions(limit);

    res.json(questions);
  } catch (error) {
    console.error('Error getting common questions:', error);
    res.status(500).json({ error: 'Failed to get common questions' });
  }
});

// ============================================
// KNOWLEDGE BASE ENDPOINTS
// ============================================

/**
 * GET /api/chatbot/kb/search
 * Search knowledge base
 */
router.get('/kb/search', authMiddleware, async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    const limit = parseInt(req.query.limit as string) || 5;

    if (!query) {
      return res.status(400).json({
        error: 'Missing required parameter: q',
      });
    }

    const results = await searchKnowledgeBase(query, limit);

    res.json(results);
  } catch (error) {
    console.error('Error searching knowledge base:', error);
    res.status(500).json({ error: 'Failed to search knowledge base' });
  }
});

/**
 * POST /api/chatbot/kb/docs
 * Add document to knowledge base
 * Requires admin access
 */
router.post('/kb/docs', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { title, content, category, tags } = req.body;

    if (!title || !content || !category) {
      return res.status(400).json({
        error: 'Missing required fields: title, content, category',
      });
    }

    const doc = await addKnowledgeBaseDoc(
      title,
      content,
      category,
      tags || []
    );

    await logAction('knowledge_base_doc_added', req.user?.id, {
      docId: doc.id,
      title,
      category,
    });

    res.status(201).json(doc);
  } catch (error) {
    console.error('Error adding knowledge base document:', error);
    res.status(500).json({ error: 'Failed to add document' });
  }
});

/**
 * POST /api/chatbot/kb/init
 * Initialize knowledge base with default documents
 * Requires admin access
 */
router.post('/kb/init', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    await initializeKnowledgeBase();

    await logAction('knowledge_base_initialized', req.user?.id, {
      timestamp: new Date(),
    });

    res.json({
      success: true,
      message: 'Knowledge base initialized with default documents',
    });
  } catch (error) {
    console.error('Error initializing knowledge base:', error);
    res.status(500).json({ error: 'Failed to initialize knowledge base' });
  }
});

export default router;
