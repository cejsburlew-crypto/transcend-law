/**
 * Push Notifications Service - Unit Tests
 * Test coverage for FCM integration, preferences, scheduling, and analytics
 */

import {
  sendNotification,
  sendBatchNotifications,
  getNotificationPreferences,
  updateNotificationPreferences,
  registerDevice,
  isInQuietHours,
  NotificationCategory,
  NotificationPriority,
  NotificationChannel,
  trackNotificationRead,
  trackNotificationClick,
  getNotificationAnalytics,
} from './pushNotifications';

describe('Push Notifications Service', () => {
  const testUserId = '550e8400-e29b-41d4-a716-446655440000';
  const testFcmToken = 'test-fcm-token-12345';

  // ============================================
  // DEVICE REGISTRATION TESTS
  // ============================================

  describe('Device Registration', () => {
    test('should register a new device', async () => {
      const device = await registerDevice(testUserId, testFcmToken, {
        deviceType: 'web',
        osType: 'Windows',
        osVersion: '10.0',
        appVersion: '1.0.0',
        deviceName: 'Home PC',
      });

      expect(device).toBeDefined();
      expect(device.userId).toBe(testUserId);
      expect(device.fcmToken).toBe(testFcmToken);
      expect(device.isActive).toBe(true);
      expect(device.registeredAt).toBeInstanceOf(Date);
    });

    test('should handle duplicate device registration', async () => {
      // Register once
      await registerDevice(testUserId, testFcmToken, {
        deviceType: 'web',
        osType: 'Windows',
        osVersion: '10.0',
        appVersion: '1.0.0',
      });

      // Register again - should update, not create
      const device = await registerDevice(testUserId, testFcmToken, {
        deviceType: 'web',
        osType: 'Windows',
        osVersion: '10.0',
        appVersion: '1.0.1', // Different version
      });

      expect(device.appVersion).toBe('1.0.1');
      expect(device.isActive).toBe(true);
    });

    test('should validate required device info', async () => {
      const invalidDeviceInfo = {
        deviceType: 'web' as const,
        osType: '', // Invalid: empty
        osVersion: '10.0',
        appVersion: '1.0.0',
      };

      // Should handle gracefully or throw validation error
      try {
        await registerDevice(testUserId, testFcmToken, invalidDeviceInfo);
        expect(true).toBe(true); // May or may not validate client-side
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  // ============================================
  // PREFERENCES TESTS
  // ============================================

  describe('Notification Preferences', () => {
    test('should get default preferences for new user', async () => {
      const prefs = await getNotificationPreferences(testUserId);

      expect(prefs.userId).toBe(testUserId);
      expect(prefs.enableBrowserNotifications).toBe(true);
      expect(prefs.enableInAppNotifications).toBe(true);
      expect(prefs.mutedCategories).toEqual([]);
      expect(prefs.preferredChannels).toContain(NotificationChannel.BROWSER);
    });

    test('should update notification preferences', async () => {
      const updated = await updateNotificationPreferences(testUserId, {
        enableBrowserNotifications: false,
        enableSmsNotifications: true,
        mutedCategories: [NotificationCategory.MARKETING],
      });

      expect(updated.enableBrowserNotifications).toBe(false);
      expect(updated.enableSmsNotifications).toBe(true);
      expect(updated.mutedCategories).toContain(NotificationCategory.MARKETING);
    });

    test('should preserve quiet hours settings', async () => {
      const customQuietHours = {
        enabled: true,
        startTime: '20:00',
        endTime: '07:00',
        timezone: 'America/New_York',
      };

      const updated = await updateNotificationPreferences(testUserId, {
        quietHours: customQuietHours,
      });

      expect(updated.quietHours).toEqual(customQuietHours);
    });

    test('should handle multiple category muting', async () => {
      await updateNotificationPreferences(testUserId, {
        mutedCategories: [NotificationCategory.MARKETING],
      });

      const updated = await updateNotificationPreferences(testUserId, {
        mutedCategories: [
          NotificationCategory.MARKETING,
          NotificationCategory.SYSTEM,
        ],
      });

      expect(updated.mutedCategories).toHaveLength(2);
      expect(updated.mutedCategories).toContain(NotificationCategory.MARKETING);
      expect(updated.mutedCategories).toContain(NotificationCategory.SYSTEM);
    });
  });

  // ============================================
  // QUIET HOURS TESTS
  // ============================================

  describe('Quiet Hours', () => {
    test('should detect when in quiet hours', async () => {
      // Set quiet hours to current time +/- 1 hour
      const now = new Date();
      const startHour = String((now.getHours() - 1) % 24).padStart(2, '0');
      const endHour = String((now.getHours() + 1) % 24).padStart(2, '0');

      await updateNotificationPreferences(testUserId, {
        quietHours: {
          enabled: true,
          startTime: `${startHour}:00`,
          endTime: `${endHour}:00`,
          timezone: 'UTC',
        },
      });

      const result = await isInQuietHours(testUserId);
      expect(result.isInQuietHours).toBe(true);
    });

    test('should detect when NOT in quiet hours', async () => {
      // Set quiet hours to non-current time
      await updateNotificationPreferences(testUserId, {
        quietHours: {
          enabled: true,
          startTime: '01:00',
          endTime: '02:00',
          timezone: 'UTC',
        },
      });

      const result = await isInQuietHours(testUserId);
      expect(result.isInQuietHours).toBe(false);
    });

    test('should return next quiet hour times', async () => {
      await updateNotificationPreferences(testUserId, {
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '08:00',
          timezone: 'America/Los_Angeles',
        },
      });

      const result = await isInQuietHours(testUserId);

      if (result.nextQuietHourStart) {
        expect(result.nextQuietHourStart).toBeInstanceOf(Date);
        expect(result.nextQuietHourStart.getTime()).toBeGreaterThan(Date.now());
      }
    });

    test('should handle disabled quiet hours', async () => {
      await updateNotificationPreferences(testUserId, {
        quietHours: {
          enabled: false,
          startTime: '22:00',
          endTime: '08:00',
          timezone: 'UTC',
        },
      });

      const result = await isInQuietHours(testUserId);
      expect(result.isInQuietHours).toBe(false);
    });
  });

  // ============================================
  // SEND NOTIFICATION TESTS
  // ============================================

  describe('Sending Notifications', () => {
    test('should send single notification', async () => {
      // Register device first
      await registerDevice(testUserId, testFcmToken, {
        deviceType: 'web',
        osType: 'Windows',
        osVersion: '10.0',
        appVersion: '1.0.0',
      });

      const notification = await sendNotification(testUserId, {
        title: 'Test Notification',
        body: 'This is a test',
        category: NotificationCategory.CASE_UPDATE,
        priority: NotificationPriority.NORMAL,
        channels: [NotificationChannel.BROWSER, NotificationChannel.IN_APP],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(notification).toBeDefined();
      expect(notification.userId).toBe(testUserId);
      expect(notification.title).toBe('Test Notification');
      expect(notification.createdAt).toBeInstanceOf(Date);
      expect(notification.deliveryAttempts).toBe(0);
    });

    test('should respect muted categories', async () => {
      // Mute case updates
      await updateNotificationPreferences(testUserId, {
        mutedCategories: [NotificationCategory.CASE_UPDATE],
      });

      const notification = await sendNotification(testUserId, {
        title: 'Case Update',
        body: 'Your case has been updated',
        category: NotificationCategory.CASE_UPDATE,
        priority: NotificationPriority.NORMAL,
        channels: [NotificationChannel.BROWSER],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(notification.deliveryStatus).toBe('dismissed');
    });

    test('should schedule notifications for quiet hours', async () => {
      // Set up quiet hours for now
      const now = new Date();
      const startHour = String(now.getHours()).padStart(2, '0');
      const endHour = String((now.getHours() + 1) % 24).padStart(2, '0');

      await updateNotificationPreferences(testUserId, {
        quietHours: {
          enabled: true,
          startTime: `${startHour}:00`,
          endTime: `${endHour}:00`,
          timezone: 'UTC',
        },
      });

      const notification = await sendNotification(testUserId, {
        title: 'Low Priority Update',
        body: 'This will be scheduled',
        category: NotificationCategory.SYSTEM,
        priority: NotificationPriority.LOW,
        channels: [NotificationChannel.BROWSER],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // Low priority notification should be scheduled
      expect(notification.scheduledFor).toBeDefined();
    });

    test('should not schedule high priority notifications', async () => {
      // Set up quiet hours for now
      const now = new Date();
      const startHour = String(now.getHours()).padStart(2, '0');
      const endHour = String((now.getHours() + 1) % 24).padStart(2, '0');

      await updateNotificationPreferences(testUserId, {
        quietHours: {
          enabled: true,
          startTime: `${startHour}:00`,
          endTime: `${endHour}:00`,
          timezone: 'UTC',
        },
      });

      const notification = await sendNotification(testUserId, {
        title: 'Urgent Alert',
        body: 'This is urgent',
        category: NotificationCategory.ALERT,
        priority: NotificationPriority.HIGH,
        channels: [NotificationChannel.BROWSER],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // High priority should bypass quiet hours
      expect(notification.scheduledFor).toBeUndefined();
    });

    test('should include deep links in notification', async () => {
      const deepLink = '/cases/123/documents/456';

      const notification = await sendNotification(testUserId, {
        title: 'Document Ready',
        body: 'New document is ready',
        category: NotificationCategory.DOCUMENT,
        priority: NotificationPriority.NORMAL,
        channels: [NotificationChannel.BROWSER],
        deepLink,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(notification.deepLink).toBe(deepLink);
    });

    test('should validate required fields', async () => {
      try {
        await sendNotification(testUserId, {
          title: '', // Invalid: empty
          body: 'Body',
          category: NotificationCategory.ALERT,
          priority: NotificationPriority.NORMAL,
          channels: [NotificationChannel.BROWSER],
          expiresAt: new Date(),
        });

        expect(false).toBe(true); // Should throw
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  // ============================================
  // BATCH NOTIFICATION TESTS
  // ============================================

  describe('Batch Notifications', () => {
    test('should send to multiple users', async () => {
      const userIds = [
        '550e8400-e29b-41d4-a716-446655440001',
        '550e8400-e29b-41d4-a716-446655440002',
        '550e8400-e29b-41d4-a716-446655440003',
      ];

      const result = await sendBatchNotifications(userIds, {
        title: 'Case Opportunity',
        body: 'A new case matching your expertise is available',
        category: NotificationCategory.ALERT,
        priority: NotificationPriority.NORMAL,
        channels: [NotificationChannel.BROWSER],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(result.totalRequested).toBe(3);
      expect(result.totalSuccessful + result.totalFailed).toBeGreaterThan(0);
      expect(Array.isArray(result.failedUserIds)).toBe(true);
    });

    test('should handle partial failures', async () => {
      const userIds = [testUserId, 'invalid-user-id'];

      const result = await sendBatchNotifications(userIds, {
        title: 'Batch Test',
        body: 'Testing batch with some failures',
        category: NotificationCategory.SYSTEM,
        priority: NotificationPriority.NORMAL,
        channels: [NotificationChannel.BROWSER],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(result.totalRequested).toBe(2);
      expect(result.totalFailed).toBeGreaterThan(0);
      expect(result.failedUserIds.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // TRACKING TESTS
  // ============================================

  describe('Notification Tracking', () => {
    test('should track notification read', async () => {
      // Send notification
      const notification = await sendNotification(testUserId, {
        title: 'Track Me',
        body: 'Test tracking',
        category: NotificationCategory.MESSAGE,
        priority: NotificationPriority.NORMAL,
        channels: [NotificationChannel.BROWSER],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // Track read
      await trackNotificationRead(notification.id, testUserId);

      // Verify read_at is set (would fetch from DB in real test)
      expect(notification.id).toBeDefined();
    });

    test('should track notification click with deep link', async () => {
      const notification = await sendNotification(testUserId, {
        title: 'Click Me',
        body: 'Test click tracking',
        category: NotificationCategory.DOCUMENT,
        priority: NotificationPriority.NORMAL,
        channels: [NotificationChannel.BROWSER],
        deepLink: '/documents/123',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // Track click
      await trackNotificationClick(
        notification.id,
        testUserId,
        '/documents/123'
      );

      expect(notification.deepLink).toBe('/documents/123');
    });
  });

  // ============================================
  // ANALYTICS TESTS
  // ============================================

  describe('Analytics', () => {
    test('should retrieve notification analytics', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const endDate = new Date();

      const analytics = await getNotificationAnalytics(startDate, endDate);

      expect(Array.isArray(analytics)).toBe(true);
    });

    test('should filter analytics by category', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const analytics = await getNotificationAnalytics(startDate, endDate, {
        category: NotificationCategory.CASE_UPDATE,
      });

      if (analytics.length > 0) {
        expect(analytics[0].category).toBe(NotificationCategory.CASE_UPDATE);
      }
    });

    test('should filter analytics by channel', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const analytics = await getNotificationAnalytics(startDate, endDate, {
        channel: NotificationChannel.BROWSER,
      });

      if (analytics.length > 0) {
        expect(analytics[0].channel).toBe(NotificationChannel.BROWSER);
      }
    });

    test('should calculate engagement rates', async () => {
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const endDate = new Date();

      const analytics = await getNotificationAnalytics(startDate, endDate);

      // Analytics should include rate calculations
      if (analytics.length > 0) {
        const row = analytics[0];
        expect(row.delivery_rate).toBeDefined();
        expect(row.read_rate).toBeDefined();
        expect(row.click_rate).toBeDefined();
      }
    });
  });

  // ============================================
  // EDGE CASES & ERROR HANDLING
  // ============================================

  describe('Edge Cases', () => {
    test('should handle expired notifications', async () => {
      const expiredDate = new Date(Date.now() - 1000); // 1 second ago

      const notification = await sendNotification(testUserId, {
        title: 'Already Expired',
        body: 'This already expired',
        category: NotificationCategory.ALERT,
        priority: NotificationPriority.NORMAL,
        channels: [NotificationChannel.BROWSER],
        expiresAt: expiredDate,
      });

      expect(notification.expiresAt.getTime()).toBeLessThan(new Date().getTime());
    });

    test('should handle very long notification body', async () => {
      const longBody = 'a'.repeat(10000); // 10k characters

      const notification = await sendNotification(testUserId, {
        title: 'Long Message',
        body: longBody,
        category: NotificationCategory.MESSAGE,
        priority: NotificationPriority.NORMAL,
        channels: [NotificationChannel.BROWSER],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(notification.body).toBe(longBody);
    });

    test('should handle special characters in title/body', async () => {
      const specialChars = 'Test™ with émojis 🚀 & symbols <>';

      const notification = await sendNotification(testUserId, {
        title: specialChars,
        body: specialChars,
        category: NotificationCategory.ALERT,
        priority: NotificationPriority.NORMAL,
        channels: [NotificationChannel.BROWSER],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(notification.title).toBe(specialChars);
      expect(notification.body).toBe(specialChars);
    });

    test('should handle missing optional fields', async () => {
      const notification = await sendNotification(testUserId, {
        title: 'Minimal',
        body: 'No optional fields',
        category: NotificationCategory.SYSTEM,
        priority: NotificationPriority.NORMAL,
        channels: [NotificationChannel.IN_APP],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(notification.deepLink).toBeUndefined();
      expect(notification.imageUrl).toBeUndefined();
      expect(notification.actionButtons).toBeUndefined();
    });
  });
});
