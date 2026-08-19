/**
 * Provider-to-Provider (P2P) Messaging Service
 * Attorney-to-attorney messaging for referrals, sub-contracting, and dispute resolution
 * Features: Rate limiting, referral tracking, negotiation context, message history
 */

import { query } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import { auditLogger } from './auditLogger';
import * as Redis from 'redis';
import { encryptField, decryptField } from '../src/services/fieldEncryption';

// ============================================
// TYPES & INTERFACES
// ============================================

export enum MessageType {
  REFERRAL = 'referral',
  SUBCONTRACT = 'subcontract',
  DISPUTE = 'dispute',
  GENERAL = 'general',
  NEGOTIATION = 'negotiation',
}

export enum ConversationStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  RESOLVED = 'resolved',
  DISPUTED = 'disputed',
}

export interface P2PMessage {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  messageType: MessageType;
  subject?: string;
  content: string;
  caseId?: string;
  referralId?: string;
  subcontractId?: string;
  attachments?: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
  }>;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface P2PConversation {
  id: string;
  attorneyId1: string;
  attorneyId2: string;
  attorney1Name?: string;
  attorney2Name?: string;
  status: ConversationStatus;
  subject: string;
  messageType: MessageType;
  caseId?: string;
  referralId?: string;
  subcontractId?: string;
  messageCount: number;
  unreadCount: number;
  lastMessage?: P2PMessage;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferralTracking {
  id: string;
  conversationId: string;
  referrerId: string;
  referredAttorneyId: string;
  referralFee?: number;
  feePercentage?: number;
  status: 'pending' | 'accepted' | 'completed' | 'declined';
  caseId: string;
  notes?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface SubcontractNegotiation {
  id: string;
  conversationId: string;
  principalAttorneyId: string;
  subcontractorId: string;
  serviceScope: string;
  proposedRate: number;
  estimatedHours?: number;
  status: 'proposal' | 'counter_offer' | 'accepted' | 'rejected' | 'completed';
  caseId: string;
  timeline?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DisputeResolution {
  id: string;
  conversationId: string;
  initiatedBy: string;
  party1Id: string;
  party2Id: string;
  disputeReason: string;
  status: 'open' | 'mediation' | 'escalated' | 'resolved';
  resolutionDetails?: string;
  mediatorId?: string;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface RateLimitStatus {
  remaining: number;
  resetTime: number;
  isLimited: boolean;
}

export interface MessageStats {
  totalMessages: number;
  totalConversations: number;
  averageResponseTime: number;
  unreadMessages: number;
  activeReferrals: number;
  activeSubcontracts: number;
  openDisputes: number;
}

// ============================================
// P2P MESSAGING SERVICE CLASS
// ============================================

class P2PMessagingService {
  private redisClient: Redis.RedisClient;
  private readonly RATE_LIMIT_WINDOW = 3600; // 1 hour
  private readonly MESSAGE_LIMIT = 100; // Messages per hour
  private readonly CONVERSATION_TTL = 7776000; // 90 days

  constructor() {
    // Initialize Redis for rate limiting and caching
    this.redisClient = Redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
  }

  /**
   * Create a new P2P conversation
   */
  async createConversation(
    attorneyId1: string,
    attorneyId2: string,
    subject: string,
    messageType: MessageType,
    caseId?: string,
  ): Promise<P2PConversation> {
    try {
      const conversationId = uuidv4();
      const now = new Date();

      // Insert conversation
      await query(
        `INSERT INTO p2p_conversations
        (id, attorney_id_1, attorney_id_2, subject, message_type, case_id, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          conversationId,
          attorneyId1,
          attorneyId2,
          subject,
          messageType,
          caseId || null,
          ConversationStatus.ACTIVE,
          now,
          now,
        ],
      );

      // Log to audit trail
      await auditLogger.log({
        userId: attorneyId1,
        action: 'create',
        entityType: 'p2p_conversation',
        entityId: conversationId,
        changes: {
          before: {},
          after: { subject, messageType, participantId: attorneyId2 },
          fields_modified: ['subject', 'message_type', 'attorney_id_2'],
        },
        status: 'success',
      });

      return this.getConversation(conversationId, attorneyId1);
    } catch (error) {
      console.error('Error creating P2P conversation:', error);
      throw error;
    }
  }

  /**
   * Send a P2P message
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    recipientId: string,
    content: string,
    messageType: MessageType,
    attachments?: P2PMessage['attachments'],
  ): Promise<P2PMessage> {
    try {
      // Check rate limit
      const rateLimitStatus = await this.checkRateLimit(senderId);
      if (rateLimitStatus.isLimited) {
        throw new Error(
          `Rate limit exceeded. Please try again in ${rateLimitStatus.resetTime} seconds.`,
        );
      }

      const messageId = uuidv4();
      const now = new Date();

      // Validate conversation exists and user is participant
      const conv = await this.getConversation(conversationId, senderId);
      if (!conv) {
        throw new Error('Conversation not found or access denied');
      }

      // Insert message
      await query(
        `INSERT INTO p2p_messages
        (id, conversation_id, sender_id, recipient_id, message_type, content, attachments, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          messageId,
          conversationId,
          senderId,
          recipientId,
          messageType,
          // Privileged: encrypted before it reaches Postgres.
          encryptField(content),
          JSON.stringify(attachments || []),
          now,
          now,
        ],
      );

      // Update conversation last message timestamp
      await query('UPDATE p2p_conversations SET last_message_at = $1, updated_at = $2 WHERE id = $3', [
        now,
        now,
        conversationId,
      ]);

      // Increment message count in Redis for rate limiting
      await this.incrementMessageCount(senderId);

      // Log to audit trail
      await auditLogger.log({
        userId: senderId,
        action: 'create',
        entityType: 'p2p_message',
        entityId: messageId,
        changes: {
          before: {},
          after: { messageType, recipientId },
          fields_modified: ['message_type', 'recipient_id', 'content'],
        },
        status: 'success',
      });

      return this.getMessage(messageId, senderId);
    } catch (error) {
      console.error('Error sending P2P message:', error);
      throw error;
    }
  }

  /**
   * Get a specific message
   */
  async getMessage(messageId: string, userId: string): Promise<P2PMessage> {
    try {
      const result = await query(
        `SELECT m.*, c.attorney_id_1, c.attorney_id_2
        FROM p2p_messages m
        JOIN p2p_conversations c ON m.conversation_id = c.id
        WHERE m.id = $1 AND (m.sender_id = $2 OR m.recipient_id = $2 OR c.attorney_id_1 = $2 OR c.attorney_id_2 = $2)`,
        [messageId, userId],
      );

      if (result.rows.length === 0) {
        throw new Error('Message not found');
      }

      return this.mapMessageRow(result.rows[0]);
    } catch (error) {
      console.error('Error fetching message:', error);
      throw error;
    }
  }

  /**
   * Get conversation with all messages
   */
  async getConversation(conversationId: string, userId: string): Promise<P2PConversation> {
    try {
      // Get conversation
      const convResult = await query(
        `SELECT * FROM p2p_conversations
        WHERE id = $1 AND (attorney_id_1 = $2 OR attorney_id_2 = $2)`,
        [conversationId, userId],
      );

      if (convResult.rows.length === 0) {
        throw new Error('Conversation not found or access denied');
      }

      const conv = convResult.rows[0];

      // Get message count
      const messageCountResult = await query(
        'SELECT COUNT(*) as count FROM p2p_messages WHERE conversation_id = $1',
        [conversationId],
      );

      // Get unread count
      const unreadResult = await query(
        'SELECT COUNT(*) as count FROM p2p_messages WHERE conversation_id = $1 AND recipient_id = $2 AND read_at IS NULL',
        [conversationId, userId],
      );

      // Get last message
      const lastMsgResult = await query(
        'SELECT * FROM p2p_messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1',
        [conversationId],
      );

      // Get attorney names
      const attorney1 = await this.getAttorneyInfo(conv.attorney_id_1);
      const attorney2 = await this.getAttorneyInfo(conv.attorney_id_2);

      return {
        id: conv.id,
        attorneyId1: conv.attorney_id_1,
        attorneyId2: conv.attorney_id_2,
        attorney1Name: attorney1?.name,
        attorney2Name: attorney2?.name,
        status: conv.status,
        subject: conv.subject,
        messageType: conv.message_type,
        caseId: conv.case_id,
        messageCount: parseInt(messageCountResult.rows[0].count),
        unreadCount: parseInt(unreadResult.rows[0].count),
        lastMessage: lastMsgResult.rows.length > 0 ? this.mapMessageRow(lastMsgResult.rows[0]) : undefined,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
      };
    } catch (error) {
      console.error('Error fetching conversation:', error);
      throw error;
    }
  }

  /**
   * Get all conversations for an attorney
   */
  async getConversations(
    attorneyId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<P2PConversation[]> {
    try {
      const result = await query(
        `SELECT * FROM p2p_conversations
        WHERE attorney_id_1 = $1 OR attorney_id_2 = $1
        ORDER BY last_message_at DESC NULLS LAST, updated_at DESC
        LIMIT $2 OFFSET $3`,
        [attorneyId, limit, offset],
      );

      const conversations: P2PConversation[] = [];
      for (const conv of result.rows) {
        conversations.push(await this.getConversation(conv.id, attorneyId));
      }

      return conversations;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }

  /**
   * Get all messages in a conversation
   */
  async getMessages(conversationId: string, userId: string, limit: number = 100, offset: number = 0) {
    try {
      // Verify user is part of conversation
      await this.getConversation(conversationId, userId);

      const result = await query(
        `SELECT * FROM p2p_messages
        WHERE conversation_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
        [conversationId, limit, offset],
      );

      return result.rows.map(row => this.mapMessageRow(row));
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    try {
      const now = new Date();
      await query(
        `UPDATE p2p_messages
        SET read_at = $1, updated_at = $2
        WHERE id = $3 AND recipient_id = $4`,
        [now, now, messageId, userId],
      );
    } catch (error) {
      console.error('Error marking message as read:', error);
      throw error;
    }
  }

  /**
   * Create referral tracking record
   */
  async createReferral(
    conversationId: string,
    referrerId: string,
    referredAttorneyId: string,
    caseId: string,
    fee?: number,
    feePercentage?: number,
    notes?: string,
  ): Promise<ReferralTracking> {
    try {
      const referralId = uuidv4();
      const now = new Date();

      await query(
        `INSERT INTO p2p_referrals
        (id, conversation_id, referrer_id, referred_attorney_id, case_id, fee, fee_percentage, notes, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          referralId,
          conversationId,
          referrerId,
          referredAttorneyId,
          caseId,
          fee || null,
          feePercentage || null,
          notes || null,
          'pending',
          now,
        ],
      );

      // Log to audit
      await auditLogger.log({
        userId: referrerId,
        action: 'create',
        entityType: 'p2p_referral',
        entityId: referralId,
        changes: {
          before: {},
          after: { referredAttorneyId, caseId },
          fields_modified: ['referrer_id', 'referred_attorney_id', 'case_id'],
        },
        status: 'success',
      });

      return this.getReferral(referralId, referrerId);
    } catch (error) {
      console.error('Error creating referral:', error);
      throw error;
    }
  }

  /**
   * Get referral details
   */
  async getReferral(referralId: string, userId: string): Promise<ReferralTracking> {
    try {
      const result = await query(
        `SELECT * FROM p2p_referrals
        WHERE id = $1 AND (referrer_id = $2 OR referred_attorney_id = $2)`,
        [referralId, userId],
      );

      if (result.rows.length === 0) {
        throw new Error('Referral not found');
      }

      const row = result.rows[0];
      return {
        id: row.id,
        conversationId: row.conversation_id,
        referrerId: row.referrer_id,
        referredAttorneyId: row.referred_attorney_id,
        referralFee: row.fee,
        feePercentage: row.fee_percentage,
        status: row.status,
        caseId: row.case_id,
        notes: row.notes,
        createdAt: row.created_at,
        completedAt: row.completed_at,
      };
    } catch (error) {
      console.error('Error fetching referral:', error);
      throw error;
    }
  }

  /**
   * Update referral status
   */
  async updateReferralStatus(
    referralId: string,
    newStatus: 'accepted' | 'completed' | 'declined',
    userId: string,
  ): Promise<ReferralTracking> {
    try {
      const now = new Date();
      const completedAt = newStatus === 'completed' ? now : null;

      await query(
        `UPDATE p2p_referrals
        SET status = $1, completed_at = $2, updated_at = $3
        WHERE id = $4 AND (referrer_id = $5 OR referred_attorney_id = $5)`,
        [newStatus, completedAt, now, referralId, userId],
      );

      return this.getReferral(referralId, userId);
    } catch (error) {
      console.error('Error updating referral status:', error);
      throw error;
    }
  }

  /**
   * Create subcontract negotiation
   */
  async createSubcontractProposal(
    conversationId: string,
    principalAttorneyId: string,
    subcontractorId: string,
    caseId: string,
    serviceScope: string,
    proposedRate: number,
    estimatedHours?: number,
    timeline?: string,
  ): Promise<SubcontractNegotiation> {
    try {
      const negotiationId = uuidv4();
      const now = new Date();

      await query(
        `INSERT INTO p2p_subcontract_negotiations
        (id, conversation_id, principal_attorney_id, subcontractor_id, case_id, service_scope, proposed_rate, estimated_hours, timeline, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          negotiationId,
          conversationId,
          principalAttorneyId,
          subcontractorId,
          caseId,
          serviceScope,
          proposedRate,
          estimatedHours || null,
          timeline || null,
          'proposal',
          now,
          now,
        ],
      );

      return this.getSubcontract(negotiationId, principalAttorneyId);
    } catch (error) {
      console.error('Error creating subcontract proposal:', error);
      throw error;
    }
  }

  /**
   * Get subcontract negotiation
   */
  async getSubcontract(negotiationId: string, userId: string): Promise<SubcontractNegotiation> {
    try {
      const result = await query(
        `SELECT * FROM p2p_subcontract_negotiations
        WHERE id = $1 AND (principal_attorney_id = $2 OR subcontractor_id = $2)`,
        [negotiationId, userId],
      );

      if (result.rows.length === 0) {
        throw new Error('Subcontract not found');
      }

      const row = result.rows[0];
      return {
        id: row.id,
        conversationId: row.conversation_id,
        principalAttorneyId: row.principal_attorney_id,
        subcontractorId: row.subcontractor_id,
        serviceScope: row.service_scope,
        proposedRate: row.proposed_rate,
        estimatedHours: row.estimated_hours,
        status: row.status,
        caseId: row.case_id,
        timeline: row.timeline,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      console.error('Error fetching subcontract:', error);
      throw error;
    }
  }

  /**
   * Update subcontract status
   */
  async updateSubcontractStatus(
    negotiationId: string,
    newStatus: 'counter_offer' | 'accepted' | 'rejected' | 'completed',
    userId: string,
    newRate?: number,
  ): Promise<SubcontractNegotiation> {
    try {
      const now = new Date();

      const updateFields = ['status = $1', 'updated_at = $2'];
      const params: any[] = [newStatus, now];
      let paramIndex = 3;

      if (newRate !== undefined) {
        updateFields.push(`proposed_rate = $${paramIndex}`);
        params.push(newRate);
        paramIndex++;
      }

      await query(
        `UPDATE p2p_subcontract_negotiations
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex} AND (principal_attorney_id = $${paramIndex + 1} OR subcontractor_id = $${paramIndex + 1})`,
        [...params, negotiationId, userId],
      );

      return this.getSubcontract(negotiationId, userId);
    } catch (error) {
      console.error('Error updating subcontract status:', error);
      throw error;
    }
  }

  /**
   * Create dispute resolution record
   */
  async createDispute(
    conversationId: string,
    initiatedBy: string,
    party1Id: string,
    party2Id: string,
    disputeReason: string,
  ): Promise<DisputeResolution> {
    try {
      const disputeId = uuidv4();
      const now = new Date();

      await query(
        `INSERT INTO p2p_disputes
        (id, conversation_id, initiated_by, party_1_id, party_2_id, dispute_reason, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [disputeId, conversationId, initiatedBy, party1Id, party2Id, disputeReason, 'open', now],
      );

      // Update conversation status
      await query('UPDATE p2p_conversations SET status = $1 WHERE id = $2', [
        ConversationStatus.DISPUTED,
        conversationId,
      ]);

      return this.getDispute(disputeId, initiatedBy);
    } catch (error) {
      console.error('Error creating dispute:', error);
      throw error;
    }
  }

  /**
   * Get dispute details
   */
  async getDispute(disputeId: string, userId: string): Promise<DisputeResolution> {
    try {
      const result = await query(
        `SELECT * FROM p2p_disputes
        WHERE id = $1 AND (party_1_id = $2 OR party_2_id = $2 OR initiated_by = $2)`,
        [disputeId, userId],
      );

      if (result.rows.length === 0) {
        throw new Error('Dispute not found');
      }

      const row = result.rows[0];
      return {
        id: row.id,
        conversationId: row.conversation_id,
        initiatedBy: row.initiated_by,
        party1Id: row.party_1_id,
        party2Id: row.party_2_id,
        disputeReason: row.dispute_reason,
        status: row.status,
        resolutionDetails: row.resolution_details,
        mediatorId: row.mediator_id,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at,
      };
    } catch (error) {
      console.error('Error fetching dispute:', error);
      throw error;
    }
  }

  /**
   * Resolve dispute
   */
  async resolveDispute(
    disputeId: string,
    resolutionDetails: string,
    userId: string,
  ): Promise<DisputeResolution> {
    try {
      const now = new Date();

      await query(
        `UPDATE p2p_disputes
        SET status = $1, resolution_details = $2, resolved_at = $3
        WHERE id = $4`,
        ['resolved', resolutionDetails, now, disputeId],
      );

      return this.getDispute(disputeId, userId);
    } catch (error) {
      console.error('Error resolving dispute:', error);
      throw error;
    }
  }

  /**
   * Archive conversation
   */
  async archiveConversation(conversationId: string, userId: string): Promise<void> {
    try {
      const now = new Date();

      await query(
        `UPDATE p2p_conversations
        SET status = $1, updated_at = $2
        WHERE id = $3 AND (attorney_id_1 = $4 OR attorney_id_2 = $4)`,
        [ConversationStatus.ARCHIVED, now, conversationId, userId],
      );
    } catch (error) {
      console.error('Error archiving conversation:', error);
      throw error;
    }
  }

  /**
   * Get message statistics for an attorney
   */
  async getMessageStats(attorneyId: string): Promise<MessageStats> {
    try {
      // Total conversations
      const conversationResult = await query(
        'SELECT COUNT(*) as count FROM p2p_conversations WHERE attorney_id_1 = $1 OR attorney_id_2 = $1',
        [attorneyId],
      );

      // Total messages
      const messagesResult = await query(
        'SELECT COUNT(*) as count FROM p2p_messages WHERE sender_id = $1 OR recipient_id = $1',
        [attorneyId],
      );

      // Unread messages
      const unreadResult = await query(
        'SELECT COUNT(*) as count FROM p2p_messages WHERE recipient_id = $1 AND read_at IS NULL',
        [attorneyId],
      );

      // Active referrals
      const referralsResult = await query(
        "SELECT COUNT(*) as count FROM p2p_referrals WHERE (referrer_id = $1 OR referred_attorney_id = $1) AND status IN ('pending', 'accepted')",
        [attorneyId],
      );

      // Active subcontracts
      const subcontractsResult = await query(
        "SELECT COUNT(*) as count FROM p2p_subcontract_negotiations WHERE (principal_attorney_id = $1 OR subcontractor_id = $1) AND status IN ('proposal', 'counter_offer')",
        [attorneyId],
      );

      // Open disputes
      const disputesResult = await query(
        "SELECT COUNT(*) as count FROM p2p_disputes WHERE (party_1_id = $1 OR party_2_id = $1) AND status IN ('open', 'mediation')",
        [attorneyId],
      );

      // Calculate average response time (in minutes)
      const responseTimeResult = await query(
        `SELECT AVG(EXTRACT(EPOCH FROM (m2.created_at - m1.created_at))/60) as avg_minutes
        FROM p2p_messages m1
        JOIN p2p_messages m2 ON m1.conversation_id = m2.conversation_id
        WHERE m1.sender_id = $1 AND m2.recipient_id = $1 AND m2.created_at > m1.created_at
        AND m2.created_at - m1.created_at < interval '24 hours'`,
        [attorneyId],
      );

      return {
        totalMessages: parseInt(messagesResult.rows[0].count),
        totalConversations: parseInt(conversationResult.rows[0].count),
        averageResponseTime: responseTimeResult.rows[0].avg_minutes || 0,
        unreadMessages: parseInt(unreadResult.rows[0].count),
        activeReferrals: parseInt(referralsResult.rows[0].count),
        activeSubcontracts: parseInt(subcontractsResult.rows[0].count),
        openDisputes: parseInt(disputesResult.rows[0].count),
      };
    } catch (error) {
      console.error('Error fetching message stats:', error);
      throw error;
    }
  }

  /**
   * Check rate limit for a user
   */
  async checkRateLimit(userId: string): Promise<RateLimitStatus> {
    try {
      const key = `p2p_messages:${userId}`;
      const count = await new Promise<number>((resolve, reject) => {
        this.redisClient.get(key, (err, data) => {
          if (err) reject(err);
          resolve(parseInt(data || '0'));
        });
      });

      const isLimited = count >= this.MESSAGE_LIMIT;

      // Get TTL
      const ttl = await new Promise<number>((resolve, reject) => {
        this.redisClient.ttl(key, (err, data) => {
          if (err) reject(err);
          resolve(data === -1 ? this.RATE_LIMIT_WINDOW : data);
        });
      });

      return {
        remaining: Math.max(0, this.MESSAGE_LIMIT - count),
        resetTime: ttl,
        isLimited,
      };
    } catch (error) {
      console.error('Error checking rate limit:', error);
      // Fail open if Redis is unavailable
      return {
        remaining: this.MESSAGE_LIMIT,
        resetTime: this.RATE_LIMIT_WINDOW,
        isLimited: false,
      };
    }
  }

  /**
   * Increment message count for rate limiting
   */
  private async incrementMessageCount(userId: string): Promise<void> {
    try {
      const key = `p2p_messages:${userId}`;
      await new Promise<void>((resolve, reject) => {
        this.redisClient.incr(key, (err) => {
          if (err) reject(err);
          resolve();
        });
      });

      // Set expiration on first increment
      await new Promise<void>((resolve, reject) => {
        this.redisClient.expire(key, this.RATE_LIMIT_WINDOW, (err) => {
          if (err) reject(err);
          resolve();
        });
      });
    } catch (error) {
      console.error('Error incrementing message count:', error);
    }
  }

  /**
   * Get attorney info helper
   */
  private async getAttorneyInfo(
    attorneyUserId: string,
  ): Promise<{ name: string; email: string } | null> {
    try {
      const result = await query(
        'SELECT first_name, last_name, email FROM users WHERE id = $1',
        [attorneyUserId],
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        name: `${row.first_name} ${row.last_name}`,
        email: row.email,
      };
    } catch (error) {
      console.error('Error fetching attorney info:', error);
      return null;
    }
  }

  /**
   * Map database row to P2PMessage interface
   */
  private mapMessageRow(row: any): P2PMessage {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      senderId: row.sender_id,
      recipientId: row.recipient_id,
      messageType: row.message_type,
      subject: row.subject,
      // Decrypts the AES-256-GCM envelope; passes through legacy plaintext rows.
      content: decryptField(row.content),
      caseId: row.case_id,
      referralId: row.referral_id,
      subcontractId: row.subcontract_id,
      attachments: JSON.parse(row.attachments || '[]'),
      readAt: row.read_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

export default new P2PMessagingService();
