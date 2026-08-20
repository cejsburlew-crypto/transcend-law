/**
 * Push Notifications Service
 * Firebase Cloud Messaging (FCM) integration
 * Features: Multi-channel delivery (browser + in-app), opt-in management, scheduling,
 * notification categories, deep linking, analytics, and user preferences
 */

import * as admin from 'firebase-admin';
import { query } from '../src/database/connection';
import { v4 as uuidv4 } from 'uuid';
import { logAction } from './auditLogger';

// ============================================
// TYPES & INTERFACES
// ============================================

export enum NotificationCategory {
  CASE_UPDATE = 'case_update',
  MESSAGE = 'message',
  ALERT = 'alert',
  DOCUMENT = 'document',
  APPOINTMENT = 'appointment',
  PAYMENT = 'payment',
  SYSTEM = 'system',
  MARKETING = 'marketing',
}

export enum NotificationChannel {
  BROWSER = 'browser',
  IN_APP = 'in_app',
  EMAIL = 'email',
  SMS = 'sms',
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
}

export interface UserNotificationPreferences {
  userId: string;
  enableBrowserNotifications: boolean;
  enableInAppNotifications: boolean;
  enableEmailNotifications: boolean;
  enableSmsNotifications: boolean;
  quietHours: {
    enabled: boolean;
    startTime: string; // HH:MM
    endTime: string; // HH:MM
    timezone: string;
  };
  mutedCategories: NotificationCategory[];
  preferredChannels: NotificationChannel[];
  deliveryFrequency: 'immediate' | 'daily_digest' | 'weekly_digest';
  updatedAt: Date;
}

export interface DeviceRegistration {
  id: string;
  userId: string;
  fcmToken: string;
  deviceType: 'web' | 'mobile' | 'tablet';
  deviceName?: string;
  osType: string;
  osVersion: string;
  appVersion: string;
  isActive: boolean;
  lastUsedAt: Date;
  registeredAt: Date;
}

export interface PushNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  deepLink?: string;
  imageUrl?: string;
  actionButtons?: Array<{
    id: string;
    label: string;
    deepLink?: string;
  }>;
  data?: Record<string, string>;
  scheduledFor?: Date;
  expiresAt: Date;
  createdAt: Date;
  sentAt?: Date;
  readAt?: Date;
  clickedAt?: Date;
  deliveryStatus: 'pending' | 'sent' | 'delivered' | 'failed' | 'expired' | 'dismissed';
  deliveryAttempts: number;
  lastErrorMessage?: string;
}

export interface NotificationAnalytics {
  id: string;
  notificationId: string;
  userId: string;
  deliveredAt?: Date;
  readAt?: Date;
  clickedAt?: Date;
  delayMs: number;
  channel: NotificationChannel;
  deviceType: string;
  osType: string;
  deepLinkFollowed?: string;
  userAction: 'delivered' | 'read' | 'clicked' | 'dismissed' | 'failed';
}

export interface NotificationTemplate {
  id: string;
  name: string;
  category: NotificationCategory;
  titleTemplate: string;
  bodyTemplate: string;
  imageUrl?: string;
  actionButtons?: Array<{
    label: string;
    deepLinkTemplate: string;
  }>;
  variables: string[]; // e.g., ['caseId', 'attorneyName']
}

export interface BatchNotificationResult {
  totalRequested: number;
  totalSuccessful: number;
  totalFailed: number;
  failedUserIds: string[];
  scheduledNotifications: string[];
}

export interface QuietHoursResult {
  isInQuietHours: boolean;
  nextQuietHourStart?: Date;
  nextQuietHourEnd?: Date;
}

// ============================================
// FIREBASE INITIALIZATION
// ============================================

let firebaseApp: admin.app.App;

export async function initializeFirebase() {
  try {
    if (!firebaseApp) {
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
      if (!serviceAccountPath) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT_PATH not configured');
      }

      const serviceAccount = require(serviceAccountPath);

      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });

      console.log('Firebase initialized successfully');
    }
    return firebaseApp;
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    throw error;
  }
}

// ============================================
// DEVICE REGISTRATION
// ============================================

/**
 * Register or update device FCM token
 */
export async function registerDevice(
  userId: string,
  fcmToken: string,
  deviceInfo: {
    deviceType: 'web' | 'mobile' | 'tablet';
    deviceName?: string;
    osType: string;
    osVersion: string;
    appVersion: string;
  }
): Promise<DeviceRegistration> {
  const id = uuidv4();

  await query(
    `INSERT INTO device_registrations (id, user_id, fcm_token, device_type, device_name, os_type, os_version, app_version, is_active, last_used_at, registered_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (user_id, fcm_token) DO UPDATE SET
       is_active = true,
       last_used_at = $10`,
    [
      id,
      userId,
      fcmToken,
      deviceInfo.deviceType,
      deviceInfo.deviceName || null,
      deviceInfo.osType,
      deviceInfo.osVersion,
      deviceInfo.appVersion,
      true,
      new Date(),
      new Date(),
    ]
  );

  await logAction('DEVICE_REGISTERED', userId, {
    deviceType: deviceInfo.deviceType,
    osType: deviceInfo.osType,
  });

  return {
    id,
    userId,
    fcmToken,
    ...deviceInfo,
    isActive: true,
    lastUsedAt: new Date(),
    registeredAt: new Date(),
  };
}

/**
 * Unregister device
 */
export async function unregisterDevice(
  userId: string,
  fcmToken: string
): Promise<boolean> {
  await query(
    'UPDATE device_registrations SET is_active = false WHERE user_id = $1 AND fcm_token = $2',
    [userId, fcmToken]
  );

  await logAction('DEVICE_UNREGISTERED', userId, { fcmToken });
  return true;
}

/**
 * Get user's active devices
 */
export async function getUserDevices(userId: string): Promise<DeviceRegistration[]> {
  const result = await query(
    'SELECT * FROM device_registrations WHERE user_id = $1 AND is_active = true',
    [userId]
  );

  return result.rows;
}

// ============================================
// NOTIFICATION PREFERENCES
// ============================================

/**
 * Get user notification preferences
 */
export async function getNotificationPreferences(
  userId: string
): Promise<UserNotificationPreferences> {
  const result = await query(
    'SELECT * FROM notification_preferences WHERE user_id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    return createDefaultPreferences(userId);
  }

  return result.rows[0];
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<UserNotificationPreferences>
): Promise<UserNotificationPreferences> {
  const currentPrefs = await getNotificationPreferences(userId);

  const updated = {
    ...currentPrefs,
    ...preferences,
    updatedAt: new Date(),
  };

  await query(
    `INSERT INTO notification_preferences (user_id, enable_browser_notifications, enable_in_app_notifications, enable_email_notifications, enable_sms_notifications, quiet_hours, muted_categories, preferred_channels, delivery_frequency, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (user_id) DO UPDATE SET
       enable_browser_notifications = $2,
       enable_in_app_notifications = $3,
       enable_email_notifications = $4,
       enable_sms_notifications = $5,
       quiet_hours = $6,
       muted_categories = $7,
       preferred_channels = $8,
       delivery_frequency = $9,
       updated_at = $10`,
    [
      userId,
      updated.enableBrowserNotifications,
      updated.enableInAppNotifications,
      updated.enableEmailNotifications,
      updated.enableSmsNotifications,
      JSON.stringify(updated.quietHours),
      JSON.stringify(updated.mutedCategories),
      JSON.stringify(updated.preferredChannels),
      updated.deliveryFrequency,
      updated.updatedAt,
    ]
  );

  await logAction('NOTIFICATION_PREFERENCES_UPDATED', userId, {
    preferences: updated,
  });

  return updated;
}

/**
 * Create default preferences
 */
function createDefaultPreferences(userId: string): UserNotificationPreferences {
  return {
    userId,
    enableBrowserNotifications: true,
    enableInAppNotifications: true,
    enableEmailNotifications: true,
    enableSmsNotifications: false,
    quietHours: {
      enabled: true,
      startTime: '22:00',
      endTime: '08:00',
      timezone: 'America/Los_Angeles',
    },
    mutedCategories: [],
    preferredChannels: [
      NotificationChannel.BROWSER,
      NotificationChannel.IN_APP,
    ],
    deliveryFrequency: 'immediate',
    updatedAt: new Date(),
  };
}

// ============================================
// QUIET HOURS MANAGEMENT
// ============================================

/**
 * Check if user is in quiet hours
 */
export async function isInQuietHours(userId: string): Promise<QuietHoursResult> {
  const prefs = await getNotificationPreferences(userId);

  if (!prefs.quietHours.enabled) {
    return { isInQuietHours: false };
  }

  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: prefs.quietHours.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const currentTimeStr = formatter.format(now);
  const [currentHours, currentMinutes] = currentTimeStr.split(':').map(Number);
  const currentMinutesTotal = currentHours * 60 + currentMinutes;

  const [startHours, startMinutes] = prefs.quietHours.startTime
    .split(':')
    .map(Number);
  const startMinutesTotal = startHours * 60 + startMinutes;

  const [endHours, endMinutes] = prefs.quietHours.endTime.split(':').map(Number);
  const endMinutesTotal = endHours * 60 + endMinutes;

  let isInQuietHours = false;

  if (startMinutesTotal <= endMinutesTotal) {
    isInQuietHours =
      currentMinutesTotal >= startMinutesTotal &&
      currentMinutesTotal < endMinutesTotal;
  } else {
    isInQuietHours =
      currentMinutesTotal >= startMinutesTotal ||
      currentMinutesTotal < endMinutesTotal;
  }

  return {
    isInQuietHours,
    nextQuietHourStart: calculateNextTime(
      prefs.quietHours.startTime,
      prefs.quietHours.timezone
    ),
    nextQuietHourEnd: calculateNextTime(
      prefs.quietHours.endTime,
      prefs.quietHours.timezone
    ),
  };
}

/**
 * Calculate next occurrence of a time
 */
function calculateNextTime(timeStr: string, timezone: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const now = new Date();

  const nextOccurrence = new Date(now);
  nextOccurrence.setHours(hours, minutes, 0, 0);

  if (nextOccurrence <= now) {
    nextOccurrence.setDate(nextOccurrence.getDate() + 1);
  }

  return nextOccurrence;
}

// ============================================
// SEND NOTIFICATIONS
// ============================================

/**
 * Send push notification to user
 */
export async function sendNotification(
  userId: string,
  notification: Omit<
    PushNotification,
    'id' | 'userId' | 'createdAt' | 'deliveryStatus' | 'deliveryAttempts'
  >
): Promise<PushNotification> {
  // Check if category is muted
  const prefs = await getNotificationPreferences(userId);
  if (prefs.mutedCategories.includes(notification.category)) {
    return createNotificationRecord(userId, notification, 'dismissed');
  }

  // Check quiet hours for non-urgent notifications
  if (notification.priority !== NotificationPriority.HIGH) {
    const quietHours = await isInQuietHours(userId);
    if (quietHours.isInQuietHours) {
      // Schedule for after quiet hours
      notification.scheduledFor = quietHours.nextQuietHourEnd;
    }
  }

  // Get user devices
  const devices = await getUserDevices(userId);
  if (devices.length === 0) {
    // Store in-app notification only
    return createNotificationRecord(userId, notification, 'pending');
  }

  const notificationRecord = await createNotificationRecord(userId, notification, 'pending');

  // Send to all devices via FCM
  const fcmTokens = devices.map((d) => d.fcmToken);
  const sendTask = admin.messaging().sendMulticast({
    tokens: fcmTokens,
    webpush: buildWebpushConfig(notification),
    apns: buildApnsConfig(notification),
    android: buildAndroidConfig(notification),
    data: notification.data || {},
  });

  try {
    const response = await sendTask;
    await updateNotificationDelivery(
      notificationRecord.id,
      response.successCount,
      response.failureCount
    );
    await logAction('NOTIFICATION_SENT', userId, {
      notificationId: notificationRecord.id,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
  } catch (error) {
    console.error('FCM send error:', error);
    await updateNotificationStatus(
      notificationRecord.id,
      'failed',
      (error as Error).message
    );
  }

  return notificationRecord;
}

/**
 * Send batch notifications
 */
export async function sendBatchNotifications(
  userIds: string[],
  notificationData: Omit<
    PushNotification,
    'id' | 'userId' | 'createdAt' | 'deliveryStatus' | 'deliveryAttempts'
  >
): Promise<BatchNotificationResult> {
  const results: BatchNotificationResult = {
    totalRequested: userIds.length,
    totalSuccessful: 0,
    totalFailed: 0,
    failedUserIds: [],
    scheduledNotifications: [],
  };

  for (const userId of userIds) {
    try {
      const notification = await sendNotification(userId, notificationData);
      if (notification.deliveryStatus === 'pending') {
        results.scheduledNotifications.push(notification.id);
      } else {
        results.totalSuccessful++;
      }
    } catch (error) {
      results.totalFailed++;
      results.failedUserIds.push(userId);
    }
  }

  return results;
}

/**
 * Send scheduled notification
 */
export async function sendScheduledNotifications(): Promise<number> {
  const result = await query(
    `SELECT * FROM push_notifications
     WHERE scheduled_for <= NOW()
     AND delivery_status = 'pending'
     ORDER BY scheduled_for ASC
     LIMIT 1000`
  );

  let sentCount = 0;

  for (const notification of result.rows) {
    try {
      await sendNotification(notification.user_id, {
        title: notification.title,
        body: notification.body,
        category: notification.category,
        priority: notification.priority,
        channels: notification.channels,
        deepLink: notification.deep_link,
        imageUrl: notification.image_url,
        actionButtons: notification.action_buttons,
        data: notification.data,
        expiresAt: notification.expires_at,
      });
      sentCount++;
    } catch (error) {
      console.error(`Failed to send scheduled notification ${notification.id}:`, error);
    }
  }

  return sentCount;
}

// ============================================
// NOTIFICATION TRACKING & ANALYTICS
// ============================================

/**
 * Track notification delivery
 */
export async function trackNotificationDelivery(
  notificationId: string,
  userId: string,
  channel: NotificationChannel,
  deviceInfo: {
    deviceType: string;
    osType: string;
  }
): Promise<NotificationAnalytics> {
  const id = uuidv4();
  const deliveredAt = new Date();

  await query(
    `INSERT INTO notification_analytics (id, notification_id, user_id, delivered_at, channel, device_type, os_type, user_action, delay_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      notificationId,
      userId,
      deliveredAt,
      channel,
      deviceInfo.deviceType,
      deviceInfo.osType,
      'delivered',
      0,
    ]
  );

  return {
    id,
    notificationId,
    userId,
    deliveredAt,
    channel,
    deviceType: deviceInfo.deviceType,
    osType: deviceInfo.osType,
    userAction: 'delivered',
    delayMs: 0,
  };
}

/**
 * Track notification read
 */
export async function trackNotificationRead(
  notificationId: string,
  userId: string
): Promise<void> {
  const now = new Date();

  await query(
    `UPDATE push_notifications SET read_at = $1 WHERE id = $2 AND user_id = $3`,
    [now, notificationId, userId]
  );

  await query(
    `UPDATE notification_analytics SET read_at = $1, user_action = 'read' WHERE notification_id = $2 AND user_id = $3`,
    [now, notificationId, userId]
  );

  await logAction('NOTIFICATION_READ', userId, { notificationId });
}

/**
 * Track notification click
 */
export async function trackNotificationClick(
  notificationId: string,
  userId: string,
  deepLink?: string
): Promise<void> {
  const now = new Date();

  await query(
    `UPDATE push_notifications SET clicked_at = $1 WHERE id = $2 AND user_id = $3`,
    [now, notificationId, userId]
  );

  await query(
    `UPDATE notification_analytics SET clicked_at = $1, deep_link_followed = $4, user_action = 'clicked' WHERE notification_id = $2 AND user_id = $3`,
    [now, notificationId, userId, deepLink || null]
  );

  await logAction('NOTIFICATION_CLICKED', userId, {
    notificationId,
    deepLink,
  });
}

/**
 * Get notification analytics
 */
export async function getNotificationAnalytics(
  startDate: Date,
  endDate: Date,
  filters?: {
    userId?: string;
    category?: NotificationCategory;
    channel?: NotificationChannel;
  }
): Promise<any> {
  let whereClause = 'WHERE pn.created_at BETWEEN $1 AND $2';
  const params: any[] = [startDate, endDate];

  let paramIndex = 3;

  if (filters?.userId) {
    whereClause += ` AND pn.user_id = $${paramIndex}`;
    params.push(filters.userId);
    paramIndex++;
  }

  if (filters?.category) {
    whereClause += ` AND pn.category = $${paramIndex}`;
    params.push(filters.category);
    paramIndex++;
  }

  if (filters?.channel) {
    whereClause += ` AND na.channel = $${paramIndex}`;
    params.push(filters.channel);
    paramIndex++;
  }

  const result = await query(
    `SELECT
       COUNT(DISTINCT pn.id) as total_notifications,
       COUNT(DISTINCT CASE WHEN pn.delivery_status = 'delivered' THEN pn.id END) as delivered,
       COUNT(DISTINCT CASE WHEN pn.read_at IS NOT NULL THEN pn.id END) as read,
       COUNT(DISTINCT CASE WHEN pn.clicked_at IS NOT NULL THEN pn.id END) as clicked,
       COUNT(DISTINCT CASE WHEN pn.delivery_status = 'failed' THEN pn.id END) as failed,
       AVG(EXTRACT(EPOCH FROM (pn.sent_at - pn.created_at))) as avg_send_delay_seconds,
       pn.category,
       na.channel,
       na.device_type,
       na.os_type,
       COUNT(DISTINCT na.user_id) as unique_users
     FROM push_notifications pn
     LEFT JOIN notification_analytics na ON pn.id = na.notification_id
     ${whereClause}
     GROUP BY pn.category, na.channel, na.device_type, na.os_type`,
    params
  );

  return result.rows;
}

// ============================================
// NOTIFICATION TEMPLATES
// ============================================

/**
 * Create notification template
 */
export async function createNotificationTemplate(
  template: Omit<NotificationTemplate, 'id'>
): Promise<NotificationTemplate> {
  const id = uuidv4();

  await query(
    `INSERT INTO notification_templates (id, name, category, title_template, body_template, image_url, action_buttons, variables)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      template.name,
      template.category,
      template.titleTemplate,
      template.bodyTemplate,
      template.imageUrl || null,
      JSON.stringify(template.actionButtons || []),
      JSON.stringify(template.variables),
    ]
  );

  return { id, ...template };
}

/**
 * Render notification from template
 */
export async function renderNotificationFromTemplate(
  templateId: string,
  variables: Record<string, string>
): Promise<Omit<PushNotification, 'id' | 'userId' | 'createdAt' | 'deliveryStatus' | 'deliveryAttempts'>> {
  const result = await query(
    'SELECT * FROM notification_templates WHERE id = $1',
    [templateId]
  );

  if (result.rows.length === 0) {
    throw new Error('Template not found');
  }

  const template = result.rows[0];

  // Replace template variables
  let title = template.title_template;
  let body = template.body_template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    title = title.replace(new RegExp(placeholder, 'g'), value);
    body = body.replace(new RegExp(placeholder, 'g'), value);
  }

  return {
    title,
    body,
    category: template.category,
    priority: NotificationPriority.NORMAL,
    channels: [NotificationChannel.BROWSER, NotificationChannel.IN_APP],
    imageUrl: template.image_url,
    actionButtons: template.action_buttons,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Create notification database record
 */
async function createNotificationRecord(
  userId: string,
  notification: Omit<
    PushNotification,
    'id' | 'userId' | 'createdAt' | 'deliveryStatus' | 'deliveryAttempts'
  >,
  status: 'pending' | 'dismissed' = 'pending'
): Promise<PushNotification> {
  const id = uuidv4();
  const now = new Date();

  await query(
    `INSERT INTO push_notifications (id, user_id, title, body, category, priority, channels, deep_link, image_url, action_buttons, data, scheduled_for, expires_at, created_at, delivery_status, delivery_attempts)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [
      id,
      userId,
      notification.title,
      notification.body,
      notification.category,
      notification.priority,
      JSON.stringify(notification.channels),
      notification.deepLink || null,
      notification.imageUrl || null,
      JSON.stringify(notification.actionButtons || []),
      JSON.stringify(notification.data || {}),
      notification.scheduledFor || null,
      notification.expiresAt,
      now,
      status,
      0,
    ]
  );

  return {
    id,
    userId,
    ...notification,
    createdAt: now,
    deliveryStatus: status,
    deliveryAttempts: 0,
  };
}

/**
 * Update notification delivery status
 */
async function updateNotificationDelivery(
  notificationId: string,
  successCount: number,
  failureCount: number
): Promise<void> {
  const now = new Date();

  await query(
    `UPDATE push_notifications
     SET delivery_status = CASE WHEN delivery_status = 'pending' THEN 'delivered' ELSE delivery_status END,
         sent_at = $1,
         delivery_attempts = delivery_attempts + 1
     WHERE id = $2`,
    [now, notificationId]
  );
}

/**
 * Update notification status
 */
async function updateNotificationStatus(
  notificationId: string,
  status: string,
  errorMessage?: string
): Promise<void> {
  await query(
    `UPDATE push_notifications
     SET delivery_status = $1, last_error_message = $2, delivery_attempts = delivery_attempts + 1
     WHERE id = $3`,
    [status, errorMessage || null, notificationId]
  );
}

/**
 * Build FCM web push configuration
 */
function buildWebpushConfig(
  notification: Omit<
    PushNotification,
    'id' | 'userId' | 'createdAt' | 'deliveryStatus' | 'deliveryAttempts'
  >
): admin.messaging.WebpushNotification {
  return {
    title: notification.title,
    body: notification.body,
    icon: notification.imageUrl,
    badge: '/icon-badge.png',
    tag: notification.category,
    requireInteraction: notification.priority === NotificationPriority.HIGH,
    actions: notification.actionButtons?.map((btn) => ({
      action: btn.id,
      title: btn.label,
    })),
    data: {
      deepLink: notification.deepLink,
      category: notification.category,
    },
  };
}

/**
 * Build APNS configuration
 */
function buildApnsConfig(
  notification: Omit<
    PushNotification,
    'id' | 'userId' | 'createdAt' | 'deliveryStatus' | 'deliveryAttempts'
  >
): admin.messaging.ApnsConfig {
  return {
    payload: {
      aps: {
        alert: {
          title: notification.title,
          body: notification.body,
        },
        badge: 1,
        sound: 'default',
        'mutable-content': true,
        'custom-key': notification.deepLink,
      },
    },
  };
}

/**
 * Build Android configuration
 */
function buildAndroidConfig(
  notification: Omit<
    PushNotification,
    'id' | 'userId' | 'createdAt' | 'deliveryStatus' | 'deliveryAttempts'
  >
): admin.messaging.AndroidConfig {
  return {
    priority: notification.priority === NotificationPriority.HIGH ? 'high' : 'normal',
    notification: {
      title: notification.title,
      body: notification.body,
      imageUrl: notification.imageUrl,
      tag: notification.category,
      clickAction: notification.deepLink,
    },
    // FCM data payloads must be string-valued.
    data: {
      category: notification.category,
      deepLink: notification.deepLink ?? '',
    },
  };
}

export default {
  initializeFirebase,
  registerDevice,
  unregisterDevice,
  getUserDevices,
  getNotificationPreferences,
  updateNotificationPreferences,
  isInQuietHours,
  sendNotification,
  sendBatchNotifications,
  sendScheduledNotifications,
  trackNotificationDelivery,
  trackNotificationRead,
  trackNotificationClick,
  getNotificationAnalytics,
  createNotificationTemplate,
  renderNotificationFromTemplate,
};
