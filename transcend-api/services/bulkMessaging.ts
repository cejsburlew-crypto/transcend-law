// Bulk Messaging & In-App Broadcast Service
// Features: Admin message composition, segment targeting, real-time delivery, read receipts,
// scheduling, templates, and analytics (open/click rates)

import { query, transaction, getConnection } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import * as nodemailer from 'nodemailer';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface BroadcastMessage {
  id: string;
  adminId: string;
  title: string;
  content: string;
  htmlContent?: string;
  templateId?: string;
  segments: string[]; // 'all' or specific segment IDs
  targetAudience: 'all_users' | 'segment' | 'custom';
  targetFilters?: {
    lifecycles?: string[];
    valueSegments?: string[];
    engagementLevels?: string[];
    serviceTypes?: string[];
    customQuery?: string;
  };
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  channel: 'in_app' | 'email' | 'sms' | 'push' | 'multi';
  scheduledFor?: Date;
  sentAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  totalRecipients: number;
  deliveredCount: number;
  failedCount: number;
  openCount: number;
  clickCount: number;
  conversionCount?: number;
  cta?: {
    text: string;
    url: string;
    action?: string;
  };
  metadata?: {
    campaign?: string;
    source?: string;
    tags?: string[];
  };
}

export interface MessageTemplate {
  id: string;
  name: string;
  description: string;
  category: 'promotional' | 'informational' | 'urgent' | 'reminder' | 'welcome' | 'feedback';
  content: string;
  htmlContent: string;
  variables: string[]; // Template variables like {{userName}}, {{serviceType}}
  previewImage?: string;
  createdBy: string;
  isActive: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageRecipient {
  id: string;
  messageId: string;
  userId: string;
  email: string;
  phone?: string;
  status: 'pending' | 'delivered' | 'failed' | 'bounced';
  deliveredAt?: Date;
  failureReason?: string;
  openedAt?: Date;
  openCount: number;
  clickedAt?: Date;
  clickCount: number;
  clickedLinks?: string[];
  customData?: Record<string, string>; // For template variable substitution
}

export interface ReadReceipt {
  id: string;
  messageId: string;
  userId: string;
  openedAt: Date;
  deviceType?: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  userAgent?: string;
  ipAddress?: string;
}

export interface ClickEvent {
  id: string;
  messageId: string;
  recipientId: string;
  userId: string;
  url: string;
  clickedAt: Date;
  deviceType?: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  referrer?: string;
  conversionValue?: number;
}

export interface BroadcastAnalytics {
  messageId: string;
  totalSent: number;
  delivered: number;
  failed: number;
  bounced: number;
  opened: number;
  openRate: number;
  clicked: number;
  clickRate: number;
  conversions: number;
  conversionRate: number;
  uniqueOpens: number;
  uniqueClicks: number;
  averageOpenTime: number; // minutes
  topClickedLinks: { url: string; clicks: number }[];
  deviceBreakdown: Record<string, number>;
  generatedAt: Date;
}

export interface SegmentTargeting {
  id: string;
  name: string;
  description: string;
  filters: {
    lifecycles?: string[];
    valueSegments?: string[];
    engagementLevels?: string[];
    serviceTypes?: string[];
    registrationDateRange?: { from: Date; to: Date };
    geographies?: string[];
    customQuery?: string;
  };
  recipientCount?: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface BulkMessagingDashboard {
  id: string;
  generatedAt: Date;
  totalMessagesCount: number;
  sentMessages: number;
  scheduledMessages: number;
  draftMessages: number;
  averageOpenRate: number;
  averageClickRate: number;
  totalRecipientsReached: number;
  topPerformingMessages: BroadcastMessage[];
  activeSchedules: BroadcastMessage[];
  templates: MessageTemplate[];
  segments: SegmentTargeting[];
  recentAnalytics: BroadcastAnalytics[];
}

// ============================================
// BULK MESSAGING SERVICE
// ============================================

export class BulkMessagingService {
  private static mailTransporter: nodemailer.Transporter | null = null;

  /**
   * Initialize email transporter (configure in production)
   */
  private static initMailTransporter(): nodemailer.Transporter {
    if (!this.mailTransporter) {
      this.mailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth:
          process.env.SMTP_USER && process.env.SMTP_PASS
            ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              }
            : undefined,
      });
    }
    return this.mailTransporter;
  }

  // ==========================================
  // 1. Message Creation & Management
  // ==========================================

  /**
   * Create a new broadcast message
   */
  static async createBroadcastMessage(
    adminId: string,
    messageData: Omit<BroadcastMessage, 'id' | 'createdAt' | 'updatedAt' | 'deliveredCount' | 'failedCount' | 'openCount' | 'clickCount'>
  ): Promise<BroadcastMessage> {
    try {
      const id = uuidv4();
      const now = new Date();

      const message: BroadcastMessage = {
        id,
        // Spread first: ...messageData was overwriting the explicit adminId.
        ...messageData,
        adminId,
        createdAt: now,
        updatedAt: now,
        deliveredCount: 0,
        failedCount: 0,
        openCount: 0,
        clickCount: 0,
      };

      await query(
        `INSERT INTO broadcast_messages
         (id, admin_id, title, content, html_content, template_id, segments, target_audience,
          target_filters, status, priority, channel, scheduled_for, expires_at, cta, metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
        [
          id,
          adminId,
          messageData.title,
          messageData.content,
          messageData.htmlContent || null,
          messageData.templateId || null,
          JSON.stringify(messageData.segments),
          messageData.targetAudience,
          JSON.stringify(messageData.targetFilters || {}),
          messageData.status,
          messageData.priority,
          messageData.channel,
          messageData.scheduledFor || null,
          messageData.expiresAt || null,
          JSON.stringify(messageData.cta || null),
          JSON.stringify(messageData.metadata || null),
          now,
          now,
        ]
      );

      // Log audit
      await this.logBroadcastAudit(adminId, 'message_created', id, messageData.title);

      return message;
    } catch (error) {
      console.error('Error creating broadcast message:', error);
      throw error;
    }
  }

  /**
   * Update broadcast message
   */
  static async updateBroadcastMessage(
    messageId: string,
    updates: Partial<BroadcastMessage>
  ): Promise<BroadcastMessage> {
    try {
      const now = new Date();

      const result = await query(
        `UPDATE broadcast_messages
         SET title = COALESCE($2, title),
             content = COALESCE($3, content),
             html_content = COALESCE($4, html_content),
             segments = COALESCE($5, segments),
             target_audience = COALESCE($6, target_audience),
             target_filters = COALESCE($7, target_filters),
             status = COALESCE($8, status),
             priority = COALESCE($9, priority),
             scheduled_for = COALESCE($10, scheduled_for),
             expires_at = COALESCE($11, expires_at),
             cta = COALESCE($12, cta),
             metadata = COALESCE($13, metadata),
             updated_at = $14
         WHERE id = $1
         RETURNING *`,
        [
          messageId,
          updates.title || null,
          updates.content || null,
          updates.htmlContent || null,
          updates.segments ? JSON.stringify(updates.segments) : null,
          updates.targetAudience || null,
          updates.targetFilters ? JSON.stringify(updates.targetFilters) : null,
          updates.status || null,
          updates.priority || null,
          updates.scheduledFor || null,
          updates.expiresAt || null,
          updates.cta ? JSON.stringify(updates.cta) : null,
          updates.metadata ? JSON.stringify(updates.metadata) : null,
          now,
        ]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error updating broadcast message:', error);
      throw error;
    }
  }

  /**
   * Get broadcast message by ID
   */
  static async getBroadcastMessage(messageId: string): Promise<BroadcastMessage | null> {
    try {
      const result = await query(
        `SELECT * FROM broadcast_messages WHERE id = $1`,
        [messageId]
      );
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting broadcast message:', error);
      throw error;
    }
  }

  /**
   * List broadcast messages with pagination
   */
  static async listBroadcastMessages(
    filters?: {
      status?: string;
      adminId?: string;
      channel?: string;
    },
    limit: number = 50,
    offset: number = 0
  ): Promise<{ messages: BroadcastMessage[]; total: number }> {
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];

      if (filters?.status) {
        whereClause += ` AND status = $${params.length + 1}`;
        params.push(filters.status);
      }

      if (filters?.adminId) {
        whereClause += ` AND admin_id = $${params.length + 1}`;
        params.push(filters.adminId);
      }

      if (filters?.channel) {
        whereClause += ` AND channel = $${params.length + 1}`;
        params.push(filters.channel);
      }

      const countResult = await query(
        `SELECT COUNT(*) as total FROM broadcast_messages ${whereClause}`,
        params
      );

      const result = await query(
        `SELECT * FROM broadcast_messages ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      );

      return {
        messages: result.rows,
        total: parseInt(countResult.rows[0].total),
      };
    } catch (error) {
      console.error('Error listing broadcast messages:', error);
      throw error;
    }
  }

  /**
   * Delete broadcast message (only if draft)
   */
  static async deleteBroadcastMessage(messageId: string, adminId: string): Promise<boolean> {
    try {
      const msg = await this.getBroadcastMessage(messageId);
      if (!msg || msg.status !== 'draft') {
        throw new Error('Can only delete draft messages');
      }

      await query(
        `DELETE FROM broadcast_messages WHERE id = $1 AND admin_id = $2`,
        [messageId, adminId]
      );

      await this.logBroadcastAudit(adminId, 'message_deleted', messageId, msg.title);

      return true;
    } catch (error) {
      console.error('Error deleting broadcast message:', error);
      throw error;
    }
  }

  // ==========================================
  // 2. Message Template Management
  // ==========================================

  /**
   * Create message template
   */
  static async createMessageTemplate(
    createdBy: string,
    templateData: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>
  ): Promise<MessageTemplate> {
    try {
      const id = uuidv4();
      const now = new Date();

      const template: MessageTemplate = {
        id,
        ...templateData,
        createdAt: now,
        updatedAt: now,
        usageCount: 0,
      };

      await query(
        `INSERT INTO message_templates
         (id, name, description, category, content, html_content, variables, preview_image, created_by, is_active, usage_count, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          id,
          templateData.name,
          templateData.description,
          templateData.category,
          templateData.content,
          templateData.htmlContent,
          JSON.stringify(templateData.variables),
          templateData.previewImage || null,
          createdBy,
          templateData.isActive,
          0,
          now,
          now,
        ]
      );

      return template;
    } catch (error) {
      console.error('Error creating message template:', error);
      throw error;
    }
  }

  /**
   * Get message template by ID
   */
  static async getMessageTemplate(templateId: string): Promise<MessageTemplate | null> {
    try {
      const result = await query(
        `SELECT * FROM message_templates WHERE id = $1`,
        [templateId]
      );
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting message template:', error);
      throw error;
    }
  }

  /**
   * List all message templates
   */
  static async listMessageTemplates(
    category?: string,
    activeOnly: boolean = true
  ): Promise<MessageTemplate[]> {
    try {
      let query_str = 'SELECT * FROM message_templates WHERE 1=1';
      const params: any[] = [];

      if (activeOnly) {
        query_str += ' AND is_active = true';
      }

      if (category) {
        query_str += ` AND category = $${params.length + 1}`;
        params.push(category);
      }

      const result = await query(query_str, params);
      return result.rows;
    } catch (error) {
      console.error('Error listing message templates:', error);
      throw error;
    }
  }

  /**
   * Render template with variables
   */
  static renderTemplate(template: MessageTemplate, variables: Record<string, string>): string {
    let content = template.content;

    template.variables.forEach((variable) => {
      const regex = new RegExp(`{{${variable}}}`, 'g');
      content = content.replace(regex, variables[variable] || '');
    });

    return content;
  }

  // ==========================================
  // 3. Segment Targeting
  // ==========================================

  /**
   * Create segment target
   */
  static async createSegmentTarget(
    createdBy: string,
    segmentData: Omit<SegmentTargeting, 'id' | 'createdAt' | 'updatedAt' | 'recipientCount'>
  ): Promise<SegmentTargeting> {
    try {
      const id = uuidv4();
      const now = new Date();

      const segment: SegmentTargeting = {
        id,
        ...segmentData,
        createdAt: now,
        updatedAt: now,
        recipientCount: 0,
      };

      // Calculate recipient count
      const recipientCount = await this.calculateSegmentRecipientCount(segmentData.filters);

      await query(
        `INSERT INTO segment_targets
         (id, name, description, filters, recipient_count, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          segmentData.name,
          segmentData.description,
          JSON.stringify(segmentData.filters),
          recipientCount,
          createdBy,
          now,
          now,
        ]
      );

      return { ...segment, recipientCount };
    } catch (error) {
      console.error('Error creating segment target:', error);
      throw error;
    }
  }

  /**
   * Calculate recipient count for a segment
   */
  private static async calculateSegmentRecipientCount(filters: any): Promise<number> {
    try {
      let whereClause = 'WHERE 1=1';

      if ((filters.lifecycles?.length ?? 0) > 0) {
        whereClause += ` AND lifecycle = ANY($1)`;
      }

      if ((filters.valueSegments?.length ?? 0) > 0) {
        whereClause += ` AND value = ANY($2)`;
      }

      if ((filters.engagementLevels?.length ?? 0) > 0) {
        whereClause += ` AND engagement = ANY($3)`;
      }

      const result = await query(
        `SELECT COUNT(*) as count FROM users ${whereClause}`,
        [
          filters.lifecycles || null,
          filters.valueSegments || null,
          filters.engagementLevels || null,
        ]
      );

      return parseInt(result.rows[0].count) || 0;
    } catch (error) {
      console.error('Error calculating segment recipient count:', error);
      return 0;
    }
  }

  /**
   * Get target segment
   */
  static async getSegmentTarget(segmentId: string): Promise<SegmentTargeting | null> {
    try {
      const result = await query(
        `SELECT * FROM segment_targets WHERE id = $1`,
        [segmentId]
      );
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting segment target:', error);
      throw error;
    }
  }

  // ==========================================
  // 4. Message Scheduling & Sending
  // ==========================================

  /**
   * Schedule message for later sending
   */
  static async scheduleMessage(messageId: string, scheduledFor: Date): Promise<boolean> {
    try {
      await query(
        `UPDATE broadcast_messages
         SET status = 'scheduled', scheduled_for = $1, updated_at = $2
         WHERE id = $3`,
        [scheduledFor, new Date(), messageId]
      );

      // In production, integrate with a job queue (Bull, RabbitMQ, etc.)
      console.log(`Message ${messageId} scheduled for ${scheduledFor}`);

      return true;
    } catch (error) {
      console.error('Error scheduling message:', error);
      throw error;
    }
  }

  /**
   * Send message immediately
   */
  static async sendMessage(messageId: string): Promise<boolean> {
    try {
      const message = await this.getBroadcastMessage(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      // Update status to sending
      await query(
        `UPDATE broadcast_messages SET status = 'sending' WHERE id = $1`,
        [messageId]
      );

      // Get target recipients
      const recipients = await this.getTargetRecipients(messageId, message);

      // Send to all recipients
      for (const recipient of recipients) {
        await this.sendToRecipient(messageId, recipient, message);
      }

      // Update message status
      const deliveredCount = recipients.length;
      await query(
        `UPDATE broadcast_messages
         SET status = 'sent', sent_at = $1, total_recipients = $2, delivered_count = $2, updated_at = $1
         WHERE id = $3`,
        [new Date(), deliveredCount, messageId]
      );

      return true;
    } catch (error) {
      console.error('Error sending message:', error);

      // Update status to failed
      await query(
        `UPDATE broadcast_messages SET status = 'failed', updated_at = $1 WHERE id = $2`,
        [new Date(), messageId]
      );

      throw error;
    }
  }

  /**
   * Get target recipients for a message
   */
  private static async getTargetRecipients(
    messageId: string,
    message: BroadcastMessage
  ): Promise<any[]> {
    try {
      let query_str = 'SELECT id, email, phone FROM users WHERE 1=1';
      const params: any[] = [];

      if (message.targetAudience !== 'all_users' && message.targetFilters) {
        const filters = message.targetFilters;

        if ((filters.lifecycles?.length ?? 0) > 0) {
          query_str += ` AND lifecycle = ANY($${params.length + 1})`;
          params.push(filters.lifecycles);
        }

        if ((filters.valueSegments?.length ?? 0) > 0) {
          query_str += ` AND value = ANY($${params.length + 1})`;
          params.push(filters.valueSegments);
        }

        if ((filters.engagementLevels?.length ?? 0) > 0) {
          query_str += ` AND engagement = ANY($${params.length + 1})`;
          params.push(filters.engagementLevels);
        }
      }

      const result = await query(query_str, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting target recipients:', error);
      return [];
    }
  }

  /**
   * Send message to a single recipient
   */
  private static async sendToRecipient(
    messageId: string,
    recipient: any,
    message: BroadcastMessage
  ): Promise<void> {
    // Declared outside the try: the catch block marks this recipient failed and
    // previously threw a ReferenceError instead, losing the failure entirely.
    const recipientId = uuidv4();

    try {
      // Create recipient record
      await query(
        `INSERT INTO message_recipients
         (id, message_id, user_id, email, phone, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [recipientId, messageId, recipient.id, recipient.email, recipient.phone || null, 'pending', new Date()]
      );

      // Send via configured channels
      if (message.channel === 'email' || message.channel === 'multi') {
        await this.sendEmailNotification(recipient.email, message);
      }

      if (message.channel === 'push' || message.channel === 'multi') {
        await this.sendPushNotification(recipient.id, message);
      }

      if (message.channel === 'sms' || message.channel === 'multi') {
        await this.sendSMSNotification(recipient.phone, message);
      }

      // Mark as delivered
      await query(
        `UPDATE message_recipients
         SET status = 'delivered', delivered_at = $1
         WHERE id = $2`,
        [new Date(), recipientId]
      );
    } catch (error) {
      console.error('Error sending to recipient:', error);

      // Mark as failed
      await query(
        `UPDATE message_recipients
         SET status = 'failed', failure_reason = $1
         WHERE id = $2`,
        [(error as Error).message, recipientId]
      );
    }
  }

  /**
   * Send email notification
   */
  private static async sendEmailNotification(email: string, message: BroadcastMessage): Promise<void> {
    try {
      const transporter = this.initMailTransporter();

      const htmlContent = message.htmlContent || `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1>${message.title}</h1>
          <div>${message.content}</div>
          ${
            message.cta
              ? `<a href="${message.cta.url}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">${message.cta.text}</a>`
              : ''
          }
        </div>
      `;

      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@transcend.com',
        to: email,
        subject: message.title,
        html: htmlContent,
      });
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  /**
   * Send push notification (stub - integrate with FCM, APNs, etc.)
   */
  private static async sendPushNotification(userId: string, message: BroadcastMessage): Promise<void> {
    try {
      console.log(`Push notification sent to user ${userId}: ${message.title}`);
      // Integrate with FCM, APNs, or other push services
    } catch (error) {
      console.error('Error sending push notification:', error);
      throw error;
    }
  }

  /**
   * Send SMS notification (stub - integrate with Twilio, etc.)
   */
  private static async sendSMSNotification(phone: string | null | undefined, message: BroadcastMessage): Promise<void> {
    try {
      if (!phone) return;
      console.log(`SMS sent to ${phone}: ${message.title}`);
      // Integrate with Twilio or other SMS services
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw error;
    }
  }

  // ==========================================
  // 5. Read Receipts & Analytics
  // ==========================================

  /**
   * Record message open (read receipt)
   */
  static async recordMessageOpen(
    messageId: string,
    userId: string,
    deviceType?: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<ReadReceipt> {
    try {
      const id = uuidv4();
      const now = new Date();

      const receipt: ReadReceipt = {
        id,
        messageId,
        userId,
        openedAt: now,
        deviceType: (deviceType as any) || 'unknown',
        userAgent,
        ipAddress,
      };

      await query(
        `INSERT INTO read_receipts
         (id, message_id, user_id, opened_at, device_type, user_agent, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, messageId, userId, now, deviceType || 'unknown', userAgent || null, ipAddress || null]
      );

      // Update message metrics
      await query(
        `UPDATE broadcast_messages
         SET open_count = open_count + 1
         WHERE id = $1`,
        [messageId]
      );

      // Update recipient record
      await query(
        `UPDATE message_recipients
         SET opened_at = $1, open_count = open_count + 1
         WHERE message_id = $2 AND user_id = $3`,
        [now, messageId, userId]
      );

      return receipt;
    } catch (error) {
      console.error('Error recording message open:', error);
      throw error;
    }
  }

  /**
   * Record link click
   */
  static async recordClickEvent(
    messageId: string,
    userId: string,
    url: string,
    deviceType?: string,
    referrer?: string
  ): Promise<ClickEvent> {
    try {
      const id = uuidv4();
      const now = new Date();

      const event: ClickEvent = {
        id,
        messageId,
        // Resolved from message_recipients below; '' until then.
        recipientId: '',
        userId,
        url,
        clickedAt: now,
        deviceType: (deviceType as any) || 'unknown',
        referrer,
      };

      // Get recipient
      const recipientResult = await query(
        `SELECT id FROM message_recipients WHERE message_id = $1 AND user_id = $2`,
        [messageId, userId]
      );

      const recipientId = recipientResult.rows[0]?.id;

      if (recipientId) {
        event.recipientId = recipientId;
      }

      await query(
        `INSERT INTO click_events
         (id, message_id, recipient_id, user_id, url, clicked_at, device_type, referrer)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, messageId, recipientId || null, userId, url, now, deviceType || 'unknown', referrer || null]
      );

      // Update message metrics
      await query(
        `UPDATE broadcast_messages
         SET click_count = click_count + 1
         WHERE id = $1`,
        [messageId]
      );

      // Update recipient record
      await query(
        `UPDATE message_recipients
         SET clicked_at = $1, click_count = click_count + 1, clicked_links = array_append(clicked_links, $2)
         WHERE message_id = $3 AND user_id = $4`,
        [now, url, messageId, userId]
      );

      return event;
    } catch (error) {
      console.error('Error recording click event:', error);
      throw error;
    }
  }

  /**
   * Get broadcast analytics
   */
  static async getBroadcastAnalytics(messageId: string): Promise<BroadcastAnalytics | null> {
    try {
      const messageResult = await query(
        `SELECT * FROM broadcast_messages WHERE id = $1`,
        [messageId]
      );

      if (messageResult.rows.length === 0) {
        return null;
      }

      const message = messageResult.rows[0];

      const recipientResult = await query(
        `SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          COUNT(CASE WHEN status = 'bounced' THEN 1 END) as bounced
         FROM message_recipients WHERE message_id = $1`,
        [messageId]
      );

      const recipientData = recipientResult.rows[0];

      const openResult = await query(
        `SELECT COUNT(DISTINCT user_id) as opens, COUNT(*) as total_opens
         FROM read_receipts WHERE message_id = $1`,
        [messageId]
      );

      const clickResult = await query(
        `SELECT COUNT(DISTINCT user_id) as clicks, COUNT(*) as total_clicks, url
         FROM click_events WHERE message_id = $1 GROUP BY url ORDER BY COUNT(*) DESC LIMIT 5`,
        [messageId]
      );

      const deviceResult = await query(
        `SELECT device_type, COUNT(*) as count FROM read_receipts
         WHERE message_id = $1 GROUP BY device_type`,
        [messageId]
      );

      const delivered = parseInt(recipientData.delivered) || 0;
      const opens = parseInt(openResult.rows[0]?.opens) || 0;
      const clicks = parseInt(clickResult.rows?.length > 0 ? clickResult.rows[0]?.total_clicks : 0) || 0;

      const analytics: BroadcastAnalytics = {
        messageId,
        totalSent: parseInt(recipientData.total) || 0,
        delivered,
        failed: parseInt(recipientData.failed) || 0,
        bounced: parseInt(recipientData.bounced) || 0,
        opened: opens,
        openRate: delivered > 0 ? (opens / delivered) * 100 : 0,
        clicked: clicks,
        clickRate: opens > 0 ? (clicks / opens) * 100 : 0,
        conversions: message.conversion_count || 0,
        conversionRate: clicks > 0 ? ((message.conversion_count || 0) / clicks) * 100 : 0,
        uniqueOpens: opens,
        uniqueClicks: parseInt(clickResult.rows[0]?.clicks) || 0,
        averageOpenTime: 5, // Calculate based on data
        topClickedLinks: clickResult.rows.map((r: any) => ({ url: r.url, clicks: r.count })),
        deviceBreakdown: Object.fromEntries(
          deviceResult.rows.map((r: any) => [r.device_type, r.count])
        ),
        generatedAt: new Date(),
      };

      return analytics;
    } catch (error) {
      console.error('Error getting broadcast analytics:', error);
      throw error;
    }
  }

  /**
   * Get analytics dashboard
   */
  static async getAnalyticsDashboard(limit: number = 10): Promise<BroadcastAnalytics[]> {
    try {
      const result = await query(
        `SELECT id FROM broadcast_messages
         WHERE status = 'sent'
         ORDER BY sent_at DESC
         LIMIT $1`,
        [limit]
      );

      const analytics: BroadcastAnalytics[] = [];

      for (const row of result.rows) {
        const analysis = await this.getBroadcastAnalytics(row.id);
        if (analysis) {
          analytics.push(analysis);
        }
      }

      return analytics;
    } catch (error) {
      console.error('Error getting analytics dashboard:', error);
      return [];
    }
  }

  // ==========================================
  // 6. Admin Dashboard
  // ==========================================

  /**
   * Get bulk messaging admin dashboard
   */
  static async getAdminDashboard(): Promise<BulkMessagingDashboard> {
    try {
      const id = uuidv4();
      const now = new Date();

      // Get message counts
      const countsResult = await query(
        `SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent,
          COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled,
          COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft
         FROM broadcast_messages`
      );

      const counts = countsResult.rows[0];

      // Get top performing messages
      const topMessagesResult = await query(
        `SELECT * FROM broadcast_messages
         WHERE status = 'sent'
         ORDER BY open_count DESC, click_count DESC
         LIMIT 10`
      );

      // Get active schedules
      const activeSchedulesResult = await query(
        `SELECT * FROM broadcast_messages
         WHERE status = 'scheduled' AND scheduled_for > NOW()
         ORDER BY scheduled_for ASC`
      );

      // Get templates
      const templatesResult = await query(
        `SELECT * FROM message_templates WHERE is_active = true`
      );

      // Get segments
      const segmentsResult = await query(
        `SELECT * FROM segment_targets ORDER BY created_at DESC LIMIT 20`
      );

      // Calculate average analytics
      const analyticsResult = await query(
        `SELECT
          AVG(CASE WHEN delivered > 0 THEN (open_count::float / delivered) * 100 ELSE 0 END) as avg_open_rate,
          AVG(CASE WHEN open_count > 0 THEN (click_count::float / open_count) * 100 ELSE 0 END) as avg_click_rate,
          SUM(delivered) as total_reached
         FROM broadcast_messages WHERE status = 'sent'`
      );

      const analytics = analyticsResult.rows[0];

      const recentAnalytics = await this.getAnalyticsDashboard(5);

      return {
        id,
        generatedAt: now,
        totalMessagesCount: parseInt(counts.total) || 0,
        sentMessages: parseInt(counts.sent) || 0,
        scheduledMessages: parseInt(counts.scheduled) || 0,
        draftMessages: parseInt(counts.draft) || 0,
        averageOpenRate: parseFloat(analytics.avg_open_rate) || 0,
        averageClickRate: parseFloat(analytics.avg_click_rate) || 0,
        totalRecipientsReached: parseInt(analytics.total_reached) || 0,
        topPerformingMessages: topMessagesResult.rows,
        activeSchedules: activeSchedulesResult.rows,
        templates: templatesResult.rows,
        segments: segmentsResult.rows,
        recentAnalytics,
      };
    } catch (error) {
      console.error('Error getting admin dashboard:', error);
      throw error;
    }
  }

  // ==========================================
  // 7. Audit Logging
  // ==========================================

  /**
   * Log broadcast audit event
   */
  private static async logBroadcastAudit(
    adminId: string,
    action: string,
    messageId: string,
    details: string
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO broadcast_audit_logs (id, admin_id, action, message_id, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [uuidv4(), adminId, action, messageId, details, new Date()]
      );
    } catch (error) {
      console.error('Error logging broadcast audit:', error);
    }
  }

  /**
   * Get audit logs
   */
  static async getAuditLogs(limit: number = 50): Promise<any[]> {
    try {
      const result = await query(
        `SELECT * FROM broadcast_audit_logs
         ORDER BY created_at DESC
         LIMIT $1`,
        [limit]
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting audit logs:', error);
      return [];
    }
  }
}

export default BulkMessagingService;
