// Messages API Endpoints
// Client <-> attorney messaging.
//
// PRIVILEGED CONTENT. Message bodies are encrypted with AES-256-GCM before they
// reach Postgres (see services/fieldEncryption.ts) and decrypted only on the way
// to a verified participant. Every handler authorises the caller against the
// conversation's participants first: an authenticated user must never be able to
// read a conversation they are not part of.

import { Router, Request, Response } from 'express';
import { query } from '../database/connection';
import { encryptField, decryptField } from '../services/fieldEncryption';
import { auditLogger } from '../../services/auditLogger';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Every endpoint here exposes privileged content, so authentication is applied
// at the router level rather than per-handler - a new route cannot be added
// without it by accident.
router.use(authMiddleware);

const clientIp = (req: Request): string =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';

/**
 * Confirm the user participates in the conversation.
 * Returns the other participant's id, or null when access is denied.
 */
const authoriseParticipant = async (
  conversationId: string,
  userId: string
): Promise<{ otherParticipantId: string } | null> => {
  const result = await query(
    `SELECT participant_1_id, participant_2_id
       FROM conversations
      WHERE id = $1 AND (participant_1_id = $2 OR participant_2_id = $2)`,
    [conversationId, userId]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    otherParticipantId:
      row.participant_1_id === userId ? row.participant_2_id : row.participant_1_id,
  };
};

// POST /api/v2/messages - Send message
router.post('/', async (req: Request, res: Response) => {
  try {
    const { conversationId, content, attachments, senderLanguage } = req.body;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!conversationId || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'conversationId and content are required' });
    }
    if (content.length > 20000) {
      return res.status(413).json({ error: 'Message exceeds 20000 characters' });
    }

    const access = await authoriseParticipant(conversationId, userId);
    if (!access) {
      // Deliberately indistinguishable from "not found" so the endpoint cannot
      // be used to probe which conversation ids exist.
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const result = await query(
      `INSERT INTO messages (conversation_id, sender_id, content, sender_language, attachments)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [
        conversationId,
        userId,
        // Encrypted at rest. Stored verbatim otherwise: never translated,
        // normalised, or rewritten on the way in.
        encryptField(content),
        typeof senderLanguage === 'string' ? senderLanguage.slice(0, 5) : 'en',
        JSON.stringify(Array.isArray(attachments) ? attachments : []),
      ]
    );

    const created = result.rows[0];

    await query('UPDATE conversations SET last_message_at = NOW() WHERE id = $1', [conversationId]);

    // Audit the fact of the message, never its contents.
    await auditLogger.log({
      userId,
      action: 'create',
      entityType: 'message',
      entityId: created.id,
      ipAddress: clientIp(req),
      userAgent: req.headers['user-agent'],
      dataClassification: 'restricted',
      metadata: { conversationId, recipientId: access.otherParticipantId },
    });

    return res.json({
      success: true,
      messageId: created.id,
      message: {
        id: created.id,
        conversationId,
        sender: userId,
        content,
        attachments: Array.isArray(attachments) ? attachments : [],
        timestamp: created.created_at,
        read: false,
      },
    });
  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({ error: 'Failed to send message' });
  }
});

// GET /api/v2/messages/conversations - Conversations for the caller
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Only conversations the caller participates in. The lateral join pulls the
    // most recent message per conversation without a second round trip.
    const result = await query(
      `SELECT c.id,
              c.subject,
              c.case_id,
              c.last_message_at,
              CASE WHEN c.participant_1_id = $1 THEN c.participant_2_id
                   ELSE c.participant_1_id END        AS other_participant_id,
              NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), '')
                                                      AS other_participant_name,
              u.user_type                             AS other_participant_role,
              m.content                               AS last_message_content,
              (SELECT COUNT(*) FROM messages um
                WHERE um.conversation_id = c.id
                  AND um.sender_id <> $1
                  AND um.read_at IS NULL)             AS unread_count
         FROM conversations c
         LEFT JOIN users u
                ON u.id = CASE WHEN c.participant_1_id = $1 THEN c.participant_2_id
                               ELSE c.participant_1_id END
         LEFT JOIN LATERAL (
                SELECT content FROM messages
                 WHERE conversation_id = c.id
                 ORDER BY created_at DESC
                 LIMIT 1
              ) m ON TRUE
        WHERE c.participant_1_id = $1 OR c.participant_2_id = $1
        ORDER BY c.last_message_at DESC NULLS LAST`,
      [userId]
    );

    const conversations = result.rows.map((row: any) => ({
      id: row.id,
      subject: row.subject,
      caseId: row.case_id,
      participantId: row.other_participant_id,
      participant: row.other_participant_name,
      participantRole: row.other_participant_role,
      // Decrypted for a verified participant only.
      lastMessage: decryptField(row.last_message_content),
      lastMessageTime: row.last_message_at,
      unreadCount: Number(row.unread_count) || 0,
    }));

    return res.json({ success: true, conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    return res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// GET /api/v2/messages/:conversationId - Message thread
router.get('/:conversationId', async (req: Request, res: Response) => {
  try {
    const conversationId = Array.isArray(req.params.conversationId)
      ? req.params.conversationId[0]
      : req.params.conversationId;
    const userId = req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const access = await authoriseParticipant(conversationId, userId);
    if (!access) return res.status(404).json({ error: 'Conversation not found' });

    const result = await query(
      `SELECT m.id, m.sender_id, m.content, m.sender_language, m.attachments,
              m.read_at, m.created_at, u.user_type AS sender_role
         FROM messages m
         LEFT JOIN users u ON u.id = m.sender_id
        WHERE m.conversation_id = $1
        ORDER BY m.created_at ASC`,
      [conversationId]
    );

    const messages = result.rows.map((row: any) => ({
      id: row.id,
      sender: row.sender_id,
      senderRole: row.sender_role,
      // Original wording, decrypted. Display-time translation happens client
      // side and never replaces this value.
      content: decryptField(row.content),
      senderLanguage: row.sender_language,
      attachments: typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments || [],
      timestamp: row.created_at,
      read: Boolean(row.read_at),
    }));

    // Mark the other party's messages read.
    await query(
      `UPDATE messages
          SET read_at = NOW()
        WHERE conversation_id = $1 AND sender_id <> $2 AND read_at IS NULL`,
      [conversationId, userId]
    );

    await auditLogger.log({
      userId,
      action: 'read',
      entityType: 'conversation',
      entityId: conversationId,
      ipAddress: clientIp(req),
      userAgent: req.headers['user-agent'],
      dataClassification: 'restricted',
      sensitiveDataAccessed: true,
      metadata: { messageCount: messages.length },
    });

    return res.json({ success: true, conversationId, messages });
  } catch (error) {
    console.error('Get messages error:', error);
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

export default router;
