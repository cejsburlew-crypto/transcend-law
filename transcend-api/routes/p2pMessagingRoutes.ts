/**
 * Provider-to-Provider (P2P) Messaging API Routes
 * Attorney-to-attorney messaging for referrals, sub-contracting, and dispute resolution
 */

import { Router, Request, Response } from 'express';
import P2PMessagingService from '../services/p2pMessaging';
import { authenticate, requireRole } from '../middleware/auth';
import { auditLogger } from '../services/auditLogger';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs';

const router = Router();

// Attorney-to-attorney threads are privileged. `authenticate` was imported but
// never applied, so req.user was always undefined and every handler returned
// 401. Applied router-wide so it cannot be omitted per route.
router.use(authenticate);

/**
 * Express 5 types route params as `string | string[]` to accommodate wildcard
 * routes. Every route here binds a single value, so narrow explicitly rather
 * than casting - an array would otherwise reach the query layer as a value.
 */
const routeParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] ?? '' : value ?? '';

const uploadDir = process.env.UPLOAD_DIR || './uploads/p2p';

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// Apply authentication to all routes
router.use(authenticate);

// ============================================
// CONVERSATION ENDPOINTS
// ============================================

/**
 * Create a new P2P conversation
 * POST /api/p2p/conversations
 */
router.post('/conversations', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { recipientId, subject, messageType, caseId } = req.body;

    if (!userId || !recipientId || !subject) {
      return res.status(400).json({
        error: 'userId, recipientId, and subject are required',
      });
    }

    if (userId === recipientId) {
      return res.status(400).json({
        error: 'Cannot create conversation with yourself',
      });
    }

    const conversation = await P2PMessagingService.createConversation(
      userId,
      recipientId,
      subject,
      messageType || 'general',
      caseId,
    );

    res.status(201).json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

/**
 * Get all conversations for current user
 * GET /api/p2p/conversations
 */
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const conversations = await P2PMessagingService.getConversations(userId, limit, offset);

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * Get specific conversation
 * GET /api/p2p/conversations/:conversationId
 */
router.get('/conversations/:conversationId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const conversationId = routeParam(req.params.conversationId);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const conversation = await P2PMessagingService.getConversation(conversationId, userId);

    res.json(conversation);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

/**
 * Archive conversation
 * POST /api/p2p/conversations/:conversationId/archive
 */
router.post('/conversations/:conversationId/archive', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const conversationId = routeParam(req.params.conversationId);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await P2PMessagingService.archiveConversation(conversationId, userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error archiving conversation:', error);
    res.status(500).json({ error: 'Failed to archive conversation' });
  }
});

// ============================================
// MESSAGE ENDPOINTS
// ============================================

/**
 * Send a message in a conversation
 * POST /api/p2p/conversations/:conversationId/messages
 */
router.post('/conversations/:conversationId/messages', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const conversationId = routeParam(req.params.conversationId);
    const { content, messageType, attachments } = req.body;

    if (!userId || !content || !messageType) {
      return res.status(400).json({
        error: 'userId, content, and messageType are required',
      });
    }

    // Get conversation to find recipient
    const conversation = await P2PMessagingService.getConversation(conversationId, userId);

    const recipientId =
      conversation.attorneyId1 === userId ? conversation.attorneyId2 : conversation.attorneyId1;

    const message = await P2PMessagingService.sendMessage(
      conversationId,
      userId,
      recipientId,
      content,
      messageType,
      attachments,
    );

    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * Get messages in a conversation
 * GET /api/p2p/conversations/:conversationId/messages
 */
router.get('/conversations/:conversationId/messages', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const conversationId = routeParam(req.params.conversationId);
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const messages = await P2PMessagingService.getMessages(
      conversationId,
      userId,
      limit,
      offset,
    );

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * Mark message as read
 * PUT /api/p2p/messages/:messageId/read
 */
router.put('/messages/:messageId/read', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const messageId = routeParam(req.params.messageId);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await P2PMessagingService.markMessageAsRead(messageId, userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to mark message as read' });
  }
});

/**
 * Upload file attachment
 * POST /api/p2p/upload
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId || !req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const fileAttachment = {
      id: req.file.filename,
      fileName: req.file.originalname,
      fileUrl: `/api/p2p/files/${req.file.filename}`,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
    };

    res.json(fileAttachment);
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

/**
 * Download file attachment
 * GET /api/p2p/files/:filename
 */
router.get('/files/:filename', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const filename = routeParam(req.params.filename);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const filePath = path.join(uploadDir, filename);

    // Security: Prevent directory traversal
    if (!filePath.startsWith(uploadDir)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// ============================================
// REFERRAL ENDPOINTS
// ============================================

/**
 * Create a referral
 * POST /api/p2p/referrals
 */
router.post('/referrals', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { conversationId, referredAttorneyId, caseId, fee, feePercentage, notes } = req.body;

    if (!userId || !conversationId || !referredAttorneyId || !caseId) {
      return res.status(400).json({
        error: 'conversationId, referredAttorneyId, and caseId are required',
      });
    }

    const referral = await P2PMessagingService.createReferral(
      conversationId,
      userId,
      referredAttorneyId,
      caseId,
      fee,
      feePercentage,
      notes,
    );

    res.status(201).json(referral);
  } catch (error) {
    console.error('Error creating referral:', error);
    res.status(500).json({ error: 'Failed to create referral' });
  }
});

/**
 * Get referral details
 * GET /api/p2p/referrals/:referralId
 */
router.get('/referrals/:referralId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const referralId = routeParam(req.params.referralId);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const referral = await P2PMessagingService.getReferral(referralId, userId);

    res.json(referral);
  } catch (error) {
    console.error('Error fetching referral:', error);
    res.status(500).json({ error: 'Failed to fetch referral' });
  }
});

/**
 * Update referral status
 * PATCH /api/p2p/referrals/:referralId
 */
router.patch('/referrals/:referralId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const referralId = routeParam(req.params.referralId);
    const { status } = req.body;

    if (!userId || !status) {
      return res.status(400).json({ error: 'status is required' });
    }

    if (!['accepted', 'completed', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const referral = await P2PMessagingService.updateReferralStatus(referralId, status, userId);

    res.json(referral);
  } catch (error) {
    console.error('Error updating referral:', error);
    res.status(500).json({ error: 'Failed to update referral' });
  }
});

// ============================================
// SUBCONTRACT ENDPOINTS
// ============================================

/**
 * Create subcontract proposal
 * POST /api/p2p/subcontracts
 */
router.post('/subcontracts', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const {
      conversationId,
      subcontractorId,
      caseId,
      serviceScope,
      proposedRate,
      estimatedHours,
      timeline,
    } = req.body;

    if (!userId || !conversationId || !subcontractorId || !caseId || !serviceScope || proposedRate === undefined) {
      return res.status(400).json({
        error: 'conversationId, subcontractorId, caseId, serviceScope, and proposedRate are required',
      });
    }

    const subcontract = await P2PMessagingService.createSubcontractProposal(
      conversationId,
      userId,
      subcontractorId,
      caseId,
      serviceScope,
      proposedRate,
      estimatedHours,
      timeline,
    );

    res.status(201).json(subcontract);
  } catch (error) {
    console.error('Error creating subcontract:', error);
    res.status(500).json({ error: 'Failed to create subcontract proposal' });
  }
});

/**
 * Get subcontract details
 * GET /api/p2p/subcontracts/:subcontractId
 */
router.get('/subcontracts/:subcontractId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const subcontractId = routeParam(req.params.subcontractId);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const subcontract = await P2PMessagingService.getSubcontract(subcontractId, userId);

    res.json(subcontract);
  } catch (error) {
    console.error('Error fetching subcontract:', error);
    res.status(500).json({ error: 'Failed to fetch subcontract' });
  }
});

/**
 * Update subcontract status
 * PATCH /api/p2p/subcontracts/:subcontractId
 */
router.patch('/subcontracts/:subcontractId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const subcontractId = routeParam(req.params.subcontractId);
    const { status, newRate } = req.body;

    if (!userId || !status) {
      return res.status(400).json({ error: 'status is required' });
    }

    if (!['counter_offer', 'accepted', 'rejected', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const subcontract = await P2PMessagingService.updateSubcontractStatus(
      subcontractId,
      status,
      userId,
      newRate,
    );

    res.json(subcontract);
  } catch (error) {
    console.error('Error updating subcontract:', error);
    res.status(500).json({ error: 'Failed to update subcontract' });
  }
});

// ============================================
// DISPUTE ENDPOINTS
// ============================================

/**
 * Create dispute resolution record
 * POST /api/p2p/disputes
 */
router.post('/disputes', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { conversationId, otherPartyId, disputeReason } = req.body;

    if (!userId || !conversationId || !otherPartyId || !disputeReason) {
      return res.status(400).json({
        error: 'conversationId, otherPartyId, and disputeReason are required',
      });
    }

    const dispute = await P2PMessagingService.createDispute(
      conversationId,
      userId,
      userId,
      otherPartyId,
      disputeReason,
    );

    res.status(201).json(dispute);
  } catch (error) {
    console.error('Error creating dispute:', error);
    res.status(500).json({ error: 'Failed to create dispute' });
  }
});

/**
 * Get dispute details
 * GET /api/p2p/disputes/:disputeId
 */
router.get('/disputes/:disputeId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const disputeId = routeParam(req.params.disputeId);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const dispute = await P2PMessagingService.getDispute(disputeId, userId);

    res.json(dispute);
  } catch (error) {
    console.error('Error fetching dispute:', error);
    res.status(500).json({ error: 'Failed to fetch dispute' });
  }
});

/**
 * Resolve dispute
 * PATCH /api/p2p/disputes/:disputeId/resolve
 */
router.patch('/disputes/:disputeId/resolve', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const disputeId = routeParam(req.params.disputeId);
    const { resolutionDetails } = req.body;

    if (!userId || !resolutionDetails) {
      return res.status(400).json({ error: 'resolutionDetails is required' });
    }

    const dispute = await P2PMessagingService.resolveDispute(disputeId, resolutionDetails, userId);

    res.json(dispute);
  } catch (error) {
    console.error('Error resolving dispute:', error);
    res.status(500).json({ error: 'Failed to resolve dispute' });
  }
});

// ============================================
// STATISTICS & RATE LIMIT ENDPOINTS
// ============================================

/**
 * Get message statistics for current user
 * GET /api/p2p/stats
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const stats = await P2PMessagingService.getMessageStats(userId);

    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * Check rate limit status for current user
 * GET /api/p2p/rate-limit
 */
router.get('/rate-limit', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const rateLimitStatus = await P2PMessagingService.checkRateLimit(userId);

    res.json(rateLimitStatus);
  } catch (error) {
    console.error('Error checking rate limit:', error);
    res.status(500).json({ error: 'Failed to check rate limit' });
  }
});

export default router;
