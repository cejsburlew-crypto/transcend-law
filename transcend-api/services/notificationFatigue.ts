// Notification Fatigue Prevention Service
// Features: Frequency tracking, auto-reduction, batching, priority levels, quiet hours,
// user controls (mute/snooze), preferences storage, and effectiveness analytics

import { query } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// TYPES & INTERFACES
// ============================================

export type NotificationPriority = 'urgent' | 'high' | 'normal' | 'low' | 'info';
export type NotificationCategory = 'case_update' | 'message' | 'payment' | 'deadline' | 'system' | 'marketing';
export type NotificationChannel = 'push' | 'email' | 'sms' | 'in_app';

export interface NotificationPreferences {
  userId: string;
  channels: {
    push: { enabled: boolean; dailyLimit?: number };
    email: { enabled: boolean; dailyLimit?: number };
    sms: { enabled: boolean; dailyLimit?: number };
    in_app: { enabled: boolean; dailyLimit?: number };
  };
  categories: {
    [key in NotificationCategory]?: {
      enabled: boolean;
      minPriority: NotificationPriority;
      channels: NotificationChannel[];
    };
  };
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:MM format
    endTime: string; // HH:MM format
    timezone: string;
    allowUrgentDuringQuietHours: boolean;
  };
  batchingPreferences: {
    enabled: boolean;
    batchWindowMinutes: number; // Default 60
    minNotificationsToTriggerBatch: number; // Default 3
  };
  autoReduceThreshold: number; // Default 10 notifications/day
  autoReduceMode: 'digest' | 'hide_low_priority' | 'defer' | 'disabled';
  mutedCategories: NotificationCategory[];
  mutedUntil?: Date;
  snoozedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationMetrics {
  userId: string;
  date: Date;
  totalSent: number;
  totalReceived: number; // Actually viewed/interacted
  totalEngaged: number;
  engagementRate: number;
  channelMetrics: {
    [key in NotificationChannel]?: {
      sent: number;
      received: number;
      engaged: number;
    };
  };
  categoryMetrics: {
    [key in NotificationCategory]?: {
      sent: number;
      received: number;
      engaged: number;
    };
  };
  fatigueScore: number; // 0-100, higher = more fatigued
  autoReduceTriggered: boolean;
  averageTimeToEngagement?: number; // In seconds
}

export interface NotificationLog {
  id: string;
  userId: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  channel: NotificationChannel;
  title: string;
  body: string;
  metadata?: Record<string, any>;
  sentAt: Date;
  viewedAt?: Date;
  engagedAt?: Date;
  engagementType?: 'click' | 'reply' | 'archive' | 'dismiss';
  batchedWith?: string[]; // IDs of other notifications in same batch
  fatigueReduce: {
    wasReduced: boolean;
    reason?: 'daily_limit' | 'quiet_hours' | 'auto_reduce' | 'muted';
    deferredUntil?: Date;
  };
}

export interface NotificationBatch {
  id: string;
  userId: string;
  notificationIds: string[];
  title: string;
  summary: string;
  createdAt: Date;
  sentAt?: Date;
  viewedAt?: Date;
  channel: NotificationChannel;
}

export interface NotificationState {
  userId: string;
  dailyCount: number;
  lastResetDate: Date;
  lastNotificationTime?: Date;
  fatigueLevel: 'low' | 'medium' | 'high' | 'critical';
  autoReduceActive: boolean;
  batchQueue: string[]; // Notification IDs waiting to be batched
  batchTimestamp?: Date;
}

// ============================================
// NOTIFICATION FATIGUE SERVICE
// ============================================

export class NotificationFatigueService {
  /**
   * Initialize or get default preferences for a user
   */
  static async getOrCreatePreferences(userId: string): Promise<NotificationPreferences> {
    try {
      const result = await query(
        `SELECT * FROM notification_preferences WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length > 0) {
        return result.rows[0] as NotificationPreferences;
      }

      // Create default preferences
      const defaultPrefs: NotificationPreferences = {
        userId,
        channels: {
          push: { enabled: true, dailyLimit: 20 },
          email: { enabled: true, dailyLimit: 15 },
          sms: { enabled: false, dailyLimit: 5 },
          in_app: { enabled: true, dailyLimit: 50 },
        },
        categories: {
          case_update: { enabled: true, minPriority: 'high', channels: ['push', 'email', 'in_app'] },
          message: { enabled: true, minPriority: 'normal', channels: ['push', 'in_app'] },
          payment: { enabled: true, minPriority: 'high', channels: ['push', 'email'] },
          deadline: { enabled: true, minPriority: 'high', channels: ['push', 'email', 'in_app'] },
          system: { enabled: true, minPriority: 'normal', channels: ['in_app'] },
          marketing: { enabled: false, minPriority: 'info', channels: ['email'] },
        },
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '08:00',
          timezone: 'America/Los_Angeles',
          allowUrgentDuringQuietHours: true,
        },
        batchingPreferences: {
          enabled: true,
          batchWindowMinutes: 60,
          minNotificationsToTriggerBatch: 3,
        },
        autoReduceThreshold: 10,
        autoReduceMode: 'digest',
        mutedCategories: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await query(
        `INSERT INTO notification_preferences
        (user_id, channels, categories, quiet_hours, batching_preferences,
         auto_reduce_threshold, auto_reduce_mode, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          userId,
          JSON.stringify(defaultPrefs.channels),
          JSON.stringify(defaultPrefs.categories),
          JSON.stringify(defaultPrefs.quietHours),
          JSON.stringify(defaultPrefs.batchingPreferences),
          defaultPrefs.autoReduceThreshold,
          defaultPrefs.autoReduceMode,
          defaultPrefs.createdAt,
          defaultPrefs.updatedAt,
        ]
      );

      return defaultPrefs;
    } catch (error) {
      console.error('Error getting/creating preferences:', error);
      throw error;
    }
  }

  /**
   * Update user notification preferences
   */
  static async updatePreferences(userId: string, updates: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    try {
      const updateFields: string[] = [];
      const values: any[] = [userId];
      let paramCount = 2;

      if (updates.channels) {
        updateFields.push(`channels = $${paramCount++}`);
        values.push(JSON.stringify(updates.channels));
      }
      if (updates.categories) {
        updateFields.push(`categories = $${paramCount++}`);
        values.push(JSON.stringify(updates.categories));
      }
      if (updates.quietHours !== undefined) {
        updateFields.push(`quiet_hours = $${paramCount++}`);
        values.push(JSON.stringify(updates.quietHours));
      }
      if (updates.batchingPreferences) {
        updateFields.push(`batching_preferences = $${paramCount++}`);
        values.push(JSON.stringify(updates.batchingPreferences));
      }
      if (updates.autoReduceThreshold !== undefined) {
        updateFields.push(`auto_reduce_threshold = $${paramCount++}`);
        values.push(updates.autoReduceThreshold);
      }
      if (updates.autoReduceMode) {
        updateFields.push(`auto_reduce_mode = $${paramCount++}`);
        values.push(updates.autoReduceMode);
      }
      if (updates.mutedCategories) {
        updateFields.push(`muted_categories = $${paramCount++}`);
        values.push(JSON.stringify(updates.mutedCategories));
      }
      if (updates.mutedUntil !== undefined) {
        updateFields.push(`muted_until = $${paramCount++}`);
        values.push(updates.mutedUntil);
      }
      if (updates.snoozedUntil !== undefined) {
        updateFields.push(`snoozed_until = $${paramCount++}`);
        values.push(updates.snoozedUntil);
      }

      updateFields.push(`updated_at = $${paramCount++}`);
      values.push(new Date());

      const result = await query(
        `UPDATE notification_preferences SET ${updateFields.join(', ')}
         WHERE user_id = $1 RETURNING *`,
        values
      );

      return result.rows[0] as NotificationPreferences;
    } catch (error) {
      console.error('Error updating preferences:', error);
      throw error;
    }
  }

  /**
   * Track daily notification count and state
   */
  static async getNotificationState(userId: string): Promise<NotificationState> {
    try {
      const result = await query(
        `SELECT * FROM notification_state WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length > 0) {
        return result.rows[0] as NotificationState;
      }

      // Initialize new state
      const newState: NotificationState = {
        userId,
        dailyCount: 0,
        lastResetDate: new Date(),
        fatigueLevel: 'low',
        autoReduceActive: false,
        batchQueue: [],
      };

      await query(
        `INSERT INTO notification_state
        (user_id, daily_count, last_reset_date, fatigue_level, auto_reduce_active, batch_queue)
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, 0, newState.lastResetDate, 'low', false, JSON.stringify([])]
      );

      return newState;
    } catch (error) {
      console.error('Error getting notification state:', error);
      throw error;
    }
  }

  /**
   * Check if notification should be sent based on preferences and fatigue
   */
  static async shouldSendNotification(
    userId: string,
    category: NotificationCategory,
    priority: NotificationPriority,
    channel: NotificationChannel
  ): Promise<{ allowed: boolean; reason?: string; alternative?: NotificationChannel }> {
    try {
      const prefs = await this.getOrCreatePreferences(userId);
      const state = await this.getNotificationState(userId);

      // Check if category is muted
      if (prefs.mutedCategories.includes(category)) {
        return { allowed: false, reason: 'category_muted' };
      }

      // Check if globally muted
      if (prefs.mutedUntil && new Date() < prefs.mutedUntil) {
        if (priority !== 'urgent') {
          return { allowed: false, reason: 'globally_muted' };
        }
      }

      // Check if snoozed
      if (prefs.snoozedUntil && new Date() < prefs.snoozedUntil) {
        return { allowed: false, reason: 'snoozed' };
      }

      // Check channel availability
      const channelConfig = prefs.channels[channel];
      if (!channelConfig || !channelConfig.enabled) {
        return { allowed: false, reason: 'channel_disabled' };
      }

      // Check daily limit
      if (channelConfig.dailyLimit && state.dailyCount >= channelConfig.dailyLimit) {
        if (priority !== 'urgent') {
          return { allowed: false, reason: 'daily_limit_reached' };
        }
      }

      // Check category priority
      const categoryConfig = prefs.categories[category];
      if (categoryConfig && !categoryConfig.enabled) {
        return { allowed: false, reason: 'category_disabled' };
      }

      // Check priority threshold
      const priorityValues = { urgent: 5, high: 4, normal: 3, low: 2, info: 1 };
      const categoryMinPriority = categoryConfig?.minPriority || 'normal';
      if (priorityValues[priority] < priorityValues[categoryMinPriority]) {
        return { allowed: false, reason: 'priority_below_threshold' };
      }

      // Check quiet hours
      if (this.isInQuietHours(prefs.quietHours)) {
        if (priority !== 'urgent' || !prefs.quietHours.allowUrgentDuringQuietHours) {
          return { allowed: false, reason: 'quiet_hours' };
        }
      }

      // Check auto-reduce
      if (state.fatigueLevel === 'critical' || state.autoReduceActive) {
        if (priority !== 'urgent' && priority !== 'high') {
          return { allowed: false, reason: 'auto_reduce_active' };
        }
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error checking notification eligibility:', error);
      return { allowed: false, reason: 'error' };
    }
  }

  /**
   * Send notification with fatigue prevention
   */
  static async sendNotification(
    userId: string,
    category: NotificationCategory,
    priority: NotificationPriority,
    channel: NotificationChannel,
    title: string,
    body: string,
    metadata?: Record<string, any>
  ): Promise<{ sent: boolean; notificationId?: string; reason?: string }> {
    try {
      const eligibility = await this.shouldSendNotification(userId, category, priority, channel);

      if (!eligibility.allowed) {
        // Log as deferred/reduced
        const logEntry: NotificationLog = {
          id: uuidv4(),
          userId,
          category,
          priority,
          channel,
          title,
          body,
          metadata,
          sentAt: new Date(),
          fatigueReduce: {
            wasReduced: true,
            reason: eligibility.reason as any,
          },
        };

        await this.logNotification(logEntry);
        return { sent: false, reason: eligibility.reason };
      }

      // Check if should batch
      const prefs = await this.getOrCreatePreferences(userId);
      if (prefs.batchingPreferences.enabled && priority !== 'urgent') {
        const shouldBatch = await this.shouldBatchNotification(userId);
        if (shouldBatch) {
          return { sent: false, reason: 'batched' };
        }
      }

      // Create and send notification
      const notificationId = uuidv4();
      const logEntry: NotificationLog = {
        id: notificationId,
        userId,
        category,
        priority,
        channel,
        title,
        body,
        metadata,
        sentAt: new Date(),
        fatigueReduce: { wasReduced: false },
      };

      await this.logNotification(logEntry);
      await this.incrementDailyCount(userId);
      await this.checkAndApplyAutoReduce(userId);

      return { sent: true, notificationId };
    } catch (error) {
      console.error('Error sending notification:', error);
      return { sent: false, reason: 'error' };
    }
  }

  /**
   * Check if notification should be batched
   */
  private static async shouldBatchNotification(userId: string): Promise<boolean> {
    try {
      const state = await this.getNotificationState(userId);
      const prefs = await this.getOrCreatePreferences(userId);

      if (!prefs.batchingPreferences.enabled) {
        return false;
      }

      // Check if queue already has pending notifications
      if (state.batchQueue.length >= prefs.batchingPreferences.minNotificationsToTriggerBatch) {
        return true;
      }

      // Check batch window
      if (
        state.batchTimestamp &&
        new Date().getTime() - state.batchTimestamp.getTime() <
          prefs.batchingPreferences.batchWindowMinutes * 60 * 1000
      ) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking batch eligibility:', error);
      return false;
    }
  }

  /**
   * Create a batch of notifications
   */
  static async createNotificationBatch(
    userId: string,
    channel: NotificationChannel
  ): Promise<NotificationBatch> {
    try {
      const state = await this.getNotificationState(userId);
      const batchId = uuidv4();

      const batch: NotificationBatch = {
        id: batchId,
        userId,
        notificationIds: state.batchQueue,
        title: `You have ${state.batchQueue.length} updates`,
        summary: `View all your updates and messages`,
        createdAt: new Date(),
        channel,
      };

      await query(
        `INSERT INTO notification_batches
        (id, user_id, notification_ids, title, summary, channel, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [batchId, userId, JSON.stringify(state.batchQueue), batch.title, batch.summary, channel, batch.createdAt]
      );

      // Clear queue
      await query(
        `UPDATE notification_state SET batch_queue = $1, batch_timestamp = NULL WHERE user_id = $2`,
        [JSON.stringify([]), userId]
      );

      return batch;
    } catch (error) {
      console.error('Error creating notification batch:', error);
      throw error;
    }
  }

  /**
   * Log notification event
   */
  private static async logNotification(log: NotificationLog): Promise<void> {
    try {
      await query(
        `INSERT INTO notification_logs
        (id, user_id, category, priority, channel, title, body, metadata,
         sent_at, fatigue_reduce_was_reduced, fatigue_reduce_reason)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          log.id,
          log.userId,
          log.category,
          log.priority,
          log.channel,
          log.title,
          log.body,
          JSON.stringify(log.metadata || {}),
          log.sentAt,
          log.fatigueReduce.wasReduced,
          log.fatigueReduce.reason,
        ]
      );
    } catch (error) {
      console.error('Error logging notification:', error);
    }
  }

  /**
   * Increment daily notification count
   */
  private static async incrementDailyCount(userId: string): Promise<void> {
    try {
      const state = await this.getNotificationState(userId);

      // Reset if new day
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastReset = new Date(state.lastResetDate);
      lastReset.setHours(0, 0, 0, 0);

      if (today.getTime() !== lastReset.getTime()) {
        await query(
          `UPDATE notification_state
           SET daily_count = 1, last_reset_date = $1 WHERE user_id = $2`,
          [new Date(), userId]
        );
      } else {
        await query(
          `UPDATE notification_state SET daily_count = daily_count + 1 WHERE user_id = $1`,
          [userId]
        );
      }
    } catch (error) {
      console.error('Error incrementing daily count:', error);
    }
  }

  /**
   * Check and apply auto-reduce if threshold exceeded
   */
  private static async checkAndApplyAutoReduce(userId: string): Promise<void> {
    try {
      const prefs = await this.getOrCreatePreferences(userId);
      const state = await this.getNotificationState(userId);

      if (state.dailyCount > prefs.autoReduceThreshold) {
        let fatigueLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
        const ratio = state.dailyCount / prefs.autoReduceThreshold;

        if (ratio > 3) fatigueLevel = 'critical';
        else if (ratio > 2) fatigueLevel = 'high';
        else if (ratio > 1.5) fatigueLevel = 'medium';

        await query(
          `UPDATE notification_state
           SET auto_reduce_active = true, fatigue_level = $1 WHERE user_id = $2`,
          [fatigueLevel, userId]
        );
      }
    } catch (error) {
      console.error('Error applying auto-reduce:', error);
    }
  }

  /**
   * Mark notification as viewed/engaged
   */
  static async recordEngagement(
    notificationId: string,
    engagementType: 'click' | 'reply' | 'archive' | 'dismiss'
  ): Promise<void> {
    try {
      await query(
        `UPDATE notification_logs
         SET viewed_at = $1, engaged_at = $2, engagement_type = $3 WHERE id = $4`,
        [new Date(), new Date(), engagementType, notificationId]
      );
    } catch (error) {
      console.error('Error recording engagement:', error);
    }
  }

  /**
   * Mute notifications for a category or all
   */
  static async muteNotifications(
    userId: string,
    durationMinutes: number,
    category?: NotificationCategory
  ): Promise<void> {
    try {
      const mutedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);

      if (category) {
        const prefs = await this.getOrCreatePreferences(userId);
        if (!prefs.mutedCategories.includes(category)) {
          prefs.mutedCategories.push(category);
          await this.updatePreferences(userId, {
            mutedCategories: prefs.mutedCategories,
          });
        }
      } else {
        await this.updatePreferences(userId, { mutedUntil });
      }
    } catch (error) {
      console.error('Error muting notifications:', error);
    }
  }

  /**
   * Snooze all notifications for a duration
   */
  static async snoozeNotifications(userId: string, durationMinutes: number): Promise<void> {
    try {
      const snoozedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
      await this.updatePreferences(userId, { snoozedUntil });
    } catch (error) {
      console.error('Error snoozing notifications:', error);
    }
  }

  /**
   * Unmute notifications
   */
  static async unmuteNotifications(userId: string): Promise<void> {
    try {
      await this.updatePreferences(userId, {
        mutedCategories: [],
        mutedUntil: undefined,
      });
    } catch (error) {
      console.error('Error unmuting notifications:', error);
    }
  }

  /**
   * Get notification metrics and analytics
   */
  static async getNotificationMetrics(userId: string, date: Date): Promise<NotificationMetrics> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const result = await query(
        `SELECT
          COUNT(*) as total_sent,
          COUNT(CASE WHEN viewed_at IS NOT NULL THEN 1 END) as total_viewed,
          COUNT(CASE WHEN engaged_at IS NOT NULL THEN 1 END) as total_engaged,
          AVG(EXTRACT(EPOCH FROM (engaged_at - sent_at))) as avg_engagement_time
        FROM notification_logs
        WHERE user_id = $1 AND sent_at BETWEEN $2 AND $3`,
        [userId, startOfDay, endOfDay]
      );

      const totalSent = parseInt(result.rows[0].total_sent) || 0;
      const totalViewed = parseInt(result.rows[0].total_viewed) || 0;
      const totalEngaged = parseInt(result.rows[0].total_engaged) || 0;

      // Calculate fatigue score (0-100)
      const state = await this.getNotificationState(userId);
      const prefs = await this.getOrCreatePreferences(userId);
      const fatigueScore =
        Math.min(100, (state.dailyCount / prefs.autoReduceThreshold) * 50 + (1 - totalEngaged / Math.max(1, totalSent)) * 50);

      const metrics: NotificationMetrics = {
        userId,
        date,
        totalSent,
        totalReceived: totalViewed,
        totalEngaged,
        engagementRate: totalSent > 0 ? (totalEngaged / totalSent) * 100 : 0,
        channelMetrics: {},
        categoryMetrics: {},
        fatigueScore: Math.round(fatigueScore),
        autoReduceTriggered: state.autoReduceActive,
        averageTimeToEngagement: result.rows[0].avg_engagement_time || 0,
      };

      return metrics;
    } catch (error) {
      console.error('Error getting notification metrics:', error);
      throw error;
    }
  }

  /**
   * Reset daily counts (typically called by cron job)
   */
  static async resetDailyCounts(): Promise<void> {
    try {
      await query(
        `UPDATE notification_state
         SET daily_count = 0, auto_reduce_active = false, fatigue_level = 'low'
         WHERE last_reset_date < NOW() - INTERVAL '1 day'`
      );
    } catch (error) {
      console.error('Error resetting daily counts:', error);
    }
  }

  /**
   * Check if current time is within quiet hours
   */
  private static isInQuietHours(quietHours: NotificationPreferences['quietHours']): boolean {
    if (!quietHours.enabled) return false;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const [startHour, startMin] = quietHours.startTime.split(':').map(Number);
    const [endHour, endMin] = quietHours.endTime.split(':').map(Number);
    const [currentHour, currentMin] = currentTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const currentMinutes = currentHour * 60 + currentMin;

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      // Quiet hours span midnight
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  }

  /**
   * Get detailed notification history
   */
  static async getNotificationHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<NotificationLog[]> {
    try {
      const result = await query(
        `SELECT * FROM notification_logs
         WHERE user_id = $1
         ORDER BY sent_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      return result.rows as NotificationLog[];
    } catch (error) {
      console.error('Error getting notification history:', error);
      throw error;
    }
  }

  /**
   * Get effectiveness report for a date range
   */
  static async getEffectivenessReport(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalSent: number;
    totalEngaged: number;
    engagementRate: number;
    bestPerformingCategory: NotificationCategory;
    worstPerformingCategory: NotificationCategory;
    averageFatigueScore: number;
    recommendations: string[];
  }> {
    try {
      const result = await query(
        `SELECT
          COUNT(*) as total_sent,
          COUNT(CASE WHEN engaged_at IS NOT NULL THEN 1 END) as total_engaged,
          category,
          COUNT(CASE WHEN engaged_at IS NOT NULL THEN 1 END)::float / COUNT(*) as category_engagement_rate
        FROM notification_logs
        WHERE user_id = $1 AND sent_at BETWEEN $2 AND $3
        GROUP BY category`,
        [userId, startDate, endDate]
      );

      const totalSent = result.rows.reduce((sum, row) => sum + parseInt(row.total_sent), 0);
      const totalEngaged = result.rows.reduce((sum, row) => sum + parseInt(row.total_engaged), 0);

      const categoryMetrics = result.rows.map((row) => ({
        category: row.category,
        engagementRate: row.category_engagement_rate * 100,
      }));

      const recommendations: string[] = [];

      if (categoryMetrics.length > 0) {
        const sortedByEngagement = [...categoryMetrics].sort((a, b) => b.engagementRate - a.engagementRate);

        if (sortedByEngagement[0].engagementRate < 20) {
          recommendations.push('Consider reducing notification frequency across all categories');
        }

        const lowEngagementCategories = sortedByEngagement.filter((c) => c.engagementRate < 10);
        if (lowEngagementCategories.length > 0) {
          recommendations.push(
            `Consider disabling or reducing: ${lowEngagementCategories.map((c) => c.category).join(', ')}`
          );
        }
      }

      return {
        totalSent,
        totalEngaged,
        engagementRate: totalSent > 0 ? (totalEngaged / totalSent) * 100 : 0,
        bestPerformingCategory:
          categoryMetrics.length > 0 ? (categoryMetrics[categoryMetrics.length - 1].category as NotificationCategory) : 'system',
        worstPerformingCategory:
          categoryMetrics.length > 0 ? (categoryMetrics[0].category as NotificationCategory) : 'system',
        averageFatigueScore: 0, // Can be calculated from daily metrics
        recommendations,
      };
    } catch (error) {
      console.error('Error getting effectiveness report:', error);
      throw error;
    }
  }
}

export default NotificationFatigueService;
