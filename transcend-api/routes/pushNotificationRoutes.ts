/**
 * Push Notification Routes
 * HTTP endpoints for notification management, preferences, and analytics
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth'; // Assuming auth middleware exists
import {
  sendNotification,
  sendBatchNotifications,
  sendScheduledNotifications,
  trackNotificationRead,
  trackNotificationClick,
  getNotificationAnalytics,
  getNotificationPreferences,
  updateNotificationPreferences,
  registerDevice,
  unregisterDevice,
  getUserDevices,
  createNotificationTemplate,
  renderNotificationFromTemplate,
  isInQuietHours,
  NotificationCategory,
  NotificationPriority,
  NotificationChannel,
} from '../services/pushNotifications';

const router = Router();

// ============================================
// DEVICE MANAGEMENT ROUTES
// ============================================

/**
 * Register device for push notifications
 * POST /api/v2/notifications/devices/register
 */
router.post('/devices/register', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { fcmToken, deviceType, osType, osVersion, appVersion, deviceName } =
      req.body;

    if (!fcmToken) {
      return res.status(400).json({ error: 'FCM token required' });
    }

    const device = await registerDevice(userId, fcmToken, {
      deviceType,
      osType,
      osVersion,
      appVersion,
      deviceName,
    });

    res.status(201).json({
      success: true,
      device,
    });
  } catch (error) {
    console.error('Device registration error:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

/**
 * Unregister device
 * POST /api/v2/notifications/devices/unregister
 */
router.post('/devices/unregister', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { fcmToken } = req.body;

    if (!fcmToken) {
      return res.status(400).json({ error: 'FCM token required' });
    }

    await unregisterDevice(userId, fcmToken);

    res.json({
      success: true,
      message: 'Device unregistered',
    });
  } catch (error) {
    console.error('Device unregistration error:', error);
    res.status(500).json({ error: 'Failed to unregister device' });
  }
});

/**
 * Get user devices
 * GET /api/v2/notifications/devices
 */
router.get('/devices', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const devices = await getUserDevices(userId);

    res.json({
      success: true,
      devices,
    });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// ============================================
// PREFERENCES ROUTES
// ============================================

/**
 * Get notification preferences
 * GET /api/v2/notifications/preferences
 */
router.get('/preferences', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const preferences = await getNotificationPreferences(userId);

    res.json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

/**
 * Update notification preferences
 * PUT /api/v2/notifications/preferences
 */
router.put('/preferences', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const preferences = await updateNotificationPreferences(userId, req.body);

    res.json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

/**
 * Toggle quiet hours
 * POST /api/v2/notifications/quiet-hours/toggle
 */
router.post('/quiet-hours/toggle', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { enabled } = req.body;

    const preferences = await getNotificationPreferences(userId);
    const updated = await updateNotificationPreferences(userId, {
      quietHours: {
        ...preferences.quietHours,
        enabled,
      },
    });

    res.json({
      success: true,
      preferences: updated,
    });
  } catch (error) {
    console.error('Toggle quiet hours error:', error);
    res.status(500).json({ error: 'Failed to toggle quiet hours' });
  }
});

/**
 * Check quiet hours status
 * GET /api/v2/notifications/quiet-hours/status
 */
router.get('/quiet-hours/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const status = await isInQuietHours(userId);

    res.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error('Get quiet hours error:', error);
    res.status(500).json({ error: 'Failed to check quiet hours' });
  }
});

/**
 * Mute notification category
 * POST /api/v2/notifications/categories/:category/mute
 */
router.post(
  '/categories/:category/mute',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { category } = req.params;

      const preferences = await getNotificationPreferences(userId);
      const mutedCategories = Array.from(
        new Set([...preferences.mutedCategories, category])
      );

      const updated = await updateNotificationPreferences(userId, {
        mutedCategories: mutedCategories as NotificationCategory[],
      });

      res.json({
        success: true,
        preferences: updated,
      });
    } catch (error) {
      console.error('Mute category error:', error);
      res.status(500).json({ error: 'Failed to mute category' });
    }
  }
);

/**
 * Unmute notification category
 * POST /api/v2/notifications/categories/:category/unmute
 */
router.post(
  '/categories/:category/unmute',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { category } = req.params;

      const preferences = await getNotificationPreferences(userId);
      const mutedCategories = preferences.mutedCategories.filter(
        (c) => c !== category
      );

      const updated = await updateNotificationPreferences(userId, {
        mutedCategories,
      });

      res.json({
        success: true,
        preferences: updated,
      });
    } catch (error) {
      console.error('Unmute category error:', error);
      res.status(500).json({ error: 'Failed to unmute category' });
    }
  }
);

// ============================================
// NOTIFICATION SENDING ROUTES
// ============================================

/**
 * Send notification to user
 * POST /api/v2/notifications/send
 */
router.post('/send', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { title, body, category, priority, deepLink, imageUrl, channels, data } =
      req.body;

    if (!title || !body || !category) {
      return res.status(400).json({
        error: 'title, body, and category required',
      });
    }

    const notification = await sendNotification(userId, {
      title,
      body,
      category: category as NotificationCategory,
      priority: priority || NotificationPriority.NORMAL,
      channels: channels || [
        NotificationChannel.BROWSER,
        NotificationChannel.IN_APP,
      ],
      deepLink,
      imageUrl,
      data,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    res.status(201).json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

/**
 * Send batch notifications
 * POST /api/v2/notifications/send-batch
 */
router.post('/send-batch', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { userIds, title, body, category, priority, deepLink, imageUrl, channels, data } =
      req.body;

    if (!userIds || !Array.isArray(userIds) || !title || !body || !category) {
      return res.status(400).json({
        error: 'userIds array, title, body, and category required',
      });
    }

    const result = await sendBatchNotifications(userIds, {
      title,
      body,
      category: category as NotificationCategory,
      priority: priority || NotificationPriority.NORMAL,
      channels: channels || [
        NotificationChannel.BROWSER,
        NotificationChannel.IN_APP,
      ],
      deepLink,
      imageUrl,
      data,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    res.status(201).json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('Send batch notifications error:', error);
    res.status(500).json({ error: 'Failed to send batch notifications' });
  }
});

/**
 * Process scheduled notifications
 * POST /api/v2/notifications/process-scheduled (admin only)
 */
router.post('/process-scheduled', authenticateToken, async (req: Request, res: Response) => {
  try {
    // Check admin role (adjust based on your auth system)
    const isAdmin = (req as any).user?.role === 'admin';
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const sentCount = await sendScheduledNotifications();

    res.json({
      success: true,
      sentCount,
    });
  } catch (error) {
    console.error('Process scheduled notifications error:', error);
    res.status(500).json({ error: 'Failed to process scheduled notifications' });
  }
});

// ============================================
// TRACKING ROUTES
// ============================================

/**
 * Track notification read
 * POST /api/v2/notifications/:id/read
 */
router.post('/:id/read', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    await trackNotificationRead(id, userId);

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    console.error('Track read error:', error);
    res.status(500).json({ error: 'Failed to track read' });
  }
});

/**
 * Track notification click
 * POST /api/v2/notifications/:id/clicked
 */
router.post('/:id/clicked', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    const { deepLink } = req.body;

    await trackNotificationClick(id, userId, deepLink);

    res.json({
      success: true,
      message: 'Notification click tracked',
    });
  } catch (error) {
    console.error('Track click error:', error);
    res.status(500).json({ error: 'Failed to track click' });
  }
});

/**
 * Track notification delivered
 * POST /api/v2/notifications/:id/delivered
 */
router.post('/:id/delivered', authenticateToken, async (req: Request, res: Response) => {
  try {
    // This is tracked server-side, but client can confirm delivery
    res.json({
      success: true,
      message: 'Delivery confirmed',
    });
  } catch (error) {
    console.error('Track delivery error:', error);
    res.status(500).json({ error: 'Failed to track delivery' });
  }
});

/**
 * Track notification dismissed
 * POST /api/v2/notifications/:id/dismissed
 */
router.post('/:id/dismissed', authenticateToken, async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      message: 'Dismissal tracked',
    });
  } catch (error) {
    console.error('Track dismissal error:', error);
    res.status(500).json({ error: 'Failed to track dismissal' });
  }
});

// ============================================
// ANALYTICS ROUTES
// ============================================

/**
 * Get notification analytics
 * GET /api/v2/notifications/analytics
 * Query params: startDate, endDate, userId, category, channel
 */
router.get('/analytics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, userId, category, channel } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'startDate and endDate required',
      });
    }

    const analytics = await getNotificationAnalytics(
      new Date(startDate as string),
      new Date(endDate as string),
      {
        userId: userId as string,
        category: category as NotificationCategory,
        channel: channel as NotificationChannel,
      }
    );

    res.json({
      success: true,
      analytics,
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ============================================
// TEMPLATE ROUTES
// ============================================

/**
 * Create notification template
 * POST /api/v2/notifications/templates (admin only)
 */
router.post('/templates', authenticateToken, async (req: Request, res: Response) => {
  try {
    const isAdmin = (req as any).user?.role === 'admin';
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { name, category, titleTemplate, bodyTemplate, imageUrl, actionButtons, variables } =
      req.body;

    const template = await createNotificationTemplate({
      name,
      category: category as NotificationCategory,
      titleTemplate,
      bodyTemplate,
      imageUrl,
      actionButtons,
      variables,
    });

    res.status(201).json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

/**
 * Render notification from template
 * POST /api/v2/notifications/templates/:id/render
 */
router.post(
  '/templates/:id/render',
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { variables } = req.body;

      if (!variables) {
        return res.status(400).json({ error: 'variables required' });
      }

      const notification = await renderNotificationFromTemplate(id, variables);

      res.json({
        success: true,
        notification,
      });
    } catch (error) {
      console.error('Render template error:', error);
      res.status(500).json({ error: 'Failed to render template' });
    }
  }
);

export default router;
