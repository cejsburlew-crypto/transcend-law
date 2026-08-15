/**
 * Frontend Notification Service
 * Firebase Cloud Messaging + In-App Notifications
 * Features: Browser push, in-app toasts, permission handling, deep linking,
 * analytics tracking, and user preferences management
 */

import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';

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

export interface NotificationPayload {
  title: string;
  body: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  deepLink?: string;
  imageUrl?: string;
  actionButtons?: Array<{
    id: string;
    label: string;
    deepLink?: string;
  }>;
  data?: Record<string, string>;
}

export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category: NotificationCategory;
  duration?: number; // ms, 0 = sticky
  dismissible: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  deepLink?: string;
}

export interface NotificationPreferences {
  enableBrowserNotifications: boolean;
  enableInAppNotifications: boolean;
  enableEmailNotifications: boolean;
  enableSmsNotifications: boolean;
  quietHours: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    timezone: string;
  };
  mutedCategories: NotificationCategory[];
  preferredChannels: NotificationChannel[];
  deliveryFrequency: 'immediate' | 'daily_digest' | 'weekly_digest';
}

export interface PermissionStatus {
  browserNotifications: 'granted' | 'denied' | 'default';
  pushNotifications: 'granted' | 'denied' | 'default';
  notifications: 'granted' | 'denied' | 'default';
}

// ============================================
// IN-APP NOTIFICATION QUEUE
// ============================================

class InAppNotificationQueue {
  private notifications: Map<string, InAppNotification> = new Map();
  private listeners: Set<(notifications: InAppNotification[]) => void> = new Set();

  add(notification: InAppNotification): string {
    this.notifications.set(notification.id, notification);
    this.notify();

    if (notification.duration !== 0 && notification.duration !== undefined) {
      setTimeout(
        () => this.remove(notification.id),
        notification.duration || 5000
      );
    }

    return notification.id;
  }

  remove(id: string): void {
    this.notifications.delete(id);
    this.notify();
  }

  get(): InAppNotification[] {
    return Array.from(this.notifications.values());
  }

  subscribe(listener: (notifications: InAppNotification[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.get());

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const notifications = this.get();
    this.listeners.forEach((listener) => listener(notifications));
  }

  clear(): void {
    this.notifications.clear();
    this.notify();
  }
}

// ============================================
// NOTIFICATION SERVICE CLASS
// ============================================

class NotificationService {
  private messaging: Messaging | null = null;
  private inAppQueue: InAppNotificationQueue = new InAppNotificationQueue();
  private preferences: NotificationPreferences | null = null;
  private fcmToken: string | null = null;
  private userId: string | null = null;
  private isInitialized = false;
  private baseApiUrl: string;

  constructor(baseApiUrl: string = '/api/v2') {
    this.baseApiUrl = baseApiUrl;
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  /**
   * Initialize Firebase Cloud Messaging
   */
  async initialize(
    userId: string,
    firebaseConfig: {
      apiKey: string;
      authDomain: string;
      projectId: string;
      storageBucket: string;
      messagingSenderId: string;
      appId: string;
    }
  ): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.userId = userId;

      // Initialize Firebase
      const app = initializeApp(firebaseConfig);
      this.messaging = getMessaging(app);

      // Load preferences
      await this.loadPreferences();

      // Request permissions
      const permissions = await this.checkPermissions();

      if (
        permissions.browserNotifications === 'granted' ||
        permissions.pushNotifications === 'granted'
      ) {
        await this.requestToken();
        this.setupMessageListener();
      }

      this.isInitialized = true;
      console.log('Notification service initialized');
    } catch (error) {
      console.error('Notification service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Load user preferences from backend
   */
  async loadPreferences(): Promise<NotificationPreferences> {
    try {
      const response = await fetch(
        `${this.baseApiUrl}/notifications/preferences`,
        {
          headers: {
            Authorization: `Bearer ${this.getAuthToken()}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to load preferences');

      this.preferences = await response.json();
      return this.preferences;
    } catch (error) {
      console.warn('Failed to load preferences, using defaults:', error);
      this.preferences = this.getDefaultPreferences();
      return this.preferences;
    }
  }

  /**
   * Get default preferences
   */
  private getDefaultPreferences(): NotificationPreferences {
    return {
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
    };
  }

  // ============================================
  // PERMISSIONS & SETUP
  // ============================================

  /**
   * Check notification permissions
   */
  async checkPermissions(): Promise<PermissionStatus> {
    const status: PermissionStatus = {
      browserNotifications: 'default',
      pushNotifications: 'default',
      notifications: 'default',
    };

    // Browser notifications API
    if ('Notification' in window) {
      status.notifications = Notification.permission as
        | 'granted'
        | 'denied'
        | 'default';
    }

    // Check push notifications capability
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration.pushManager) {
          status.pushNotifications = 'granted'; // Device supports push
        }
      } catch (error) {
        console.warn('Push notifications check failed:', error);
      }
    }

    // Browser notifications
    if (
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      status.browserNotifications = 'granted';
    }

    return status;
  }

  /**
   * Request user permission for notifications
   */
  async requestPermission(): Promise<boolean> {
    try {
      if (!('Notification' in window)) {
        console.warn('Notifications not supported in this browser');
        return false;
      }

      if (Notification.permission === 'granted') {
        return true;
      }

      if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      }

      return false;
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  }

  /**
   * Get FCM token
   */
  private async requestToken(): Promise<string> {
    try {
      if (!this.messaging) {
        throw new Error('Messaging not initialized');
      }

      this.fcmToken = await getToken(this.messaging, {
        vapidKey: process.env.REACT_APP_FCM_VAPID_KEY,
      });

      if (this.fcmToken) {
        // Register device with backend
        await this.registerDevice(this.fcmToken);
      }

      return this.fcmToken;
    } catch (error) {
      console.error('Failed to get FCM token:', error);
      throw error;
    }
  }

  /**
   * Register device with backend
   */
  private async registerDevice(fcmToken: string): Promise<void> {
    try {
      const deviceInfo = this.getDeviceInfo();

      const response = await fetch(
        `${this.baseApiUrl}/notifications/devices/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.getAuthToken()}`,
          },
          body: JSON.stringify({
            fcmToken,
            ...deviceInfo,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to register device');
      }

      console.log('Device registered for push notifications');
    } catch (error) {
      console.error('Device registration failed:', error);
    }
  }

  /**
   * Get device information
   */
  private getDeviceInfo(): {
    deviceType: 'web' | 'mobile' | 'tablet';
    osType: string;
    osVersion: string;
    appVersion: string;
    deviceName?: string;
  } {
    const ua = navigator.userAgent;
    let deviceType: 'web' | 'mobile' | 'tablet' = 'web';
    let osType = 'Unknown';
    let osVersion = 'Unknown';

    // Detect device type
    if (/mobile|android|iphone|ipod|phone/i.test(ua)) {
      deviceType = /ipad|android(?!.*mobile)/i.test(ua) ? 'tablet' : 'mobile';
    }

    // Detect OS
    if (/windows/i.test(ua)) {
      osType = 'Windows';
      osVersion = ua.match(/windows nt (\d+\.\d+)/i)?.[1] || 'Unknown';
    } else if (/macintosh/i.test(ua)) {
      osType = 'macOS';
      osVersion = ua.match(/mac os x (\d+[._]\d+)/i)?.[1]?.replace(/_/g, '.') || 'Unknown';
    } else if (/linux/i.test(ua)) {
      osType = 'Linux';
      osVersion = 'Unknown';
    } else if (/iphone|ipad|ipod/i.test(ua)) {
      osType = 'iOS';
      osVersion = ua.match(/os (\d+[._]\d+)/i)?.[1]?.replace(/_/g, '.') || 'Unknown';
    } else if (/android/i.test(ua)) {
      osType = 'Android';
      osVersion = ua.match(/android (\d+\.\d+)/i)?.[1] || 'Unknown';
    }

    return {
      deviceType,
      osType,
      osVersion,
      appVersion: process.env.REACT_APP_VERSION || '1.0.0',
    };
  }

  /**
   * Setup message listener for foreground notifications
   */
  private setupMessageListener(): void {
    if (!this.messaging) return;

    onMessage(this.messaging, (payload) => {
      console.log('Message received in foreground:', payload);

      if (payload.notification) {
        this.handleForegroundNotification(payload);
      }
    });
  }

  // ============================================
  // HANDLE INCOMING NOTIFICATIONS
  // ============================================

  /**
   * Handle notification received in foreground
   */
  private handleForegroundNotification(payload: any): void {
    const notification = payload.notification;
    const data = payload.data || {};

    // Show browser notification if enabled
    if (
      this.preferences?.enableBrowserNotifications &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      this.showBrowserNotification({
        title: notification.title,
        options: {
          body: notification.body,
          icon: notification.image_url || data.imageUrl,
          tag: data.category || 'notification',
          requireInteraction: data.priority === NotificationPriority.HIGH,
          data: {
            deepLink: data.deepLink,
            notificationId: data.notificationId,
            category: data.category,
          },
        },
      });
    }

    // Show in-app notification if enabled
    if (this.preferences?.enableInAppNotifications) {
      this.showInAppNotification({
        title: notification.title || '',
        message: notification.body || '',
        type: this.getCategoryType(data.category),
        category: data.category || NotificationCategory.SYSTEM,
        duration: 5000,
        dismissible: true,
        deepLink: data.deepLink,
      });
    }

    // Track delivery
    if (data.notificationId) {
      this.trackDelivery(data.notificationId);
    }
  }

  /**
   * Map category to notification type
   */
  private getCategoryType(
    category: string
  ): 'info' | 'success' | 'warning' | 'error' {
    switch (category) {
      case NotificationCategory.ALERT:
        return 'warning';
      case NotificationCategory.PAYMENT:
        return 'success';
      case NotificationCategory.SYSTEM:
        return 'error';
      default:
        return 'info';
    }
  }

  // ============================================
  // DISPLAY NOTIFICATIONS
  // ============================================

  /**
   * Show browser notification
   */
  private showBrowserNotification(options: {
    title: string;
    options: NotificationOptions;
  }): void {
    if (!('Notification' in window)) {
      console.warn('Browser notifications not supported');
      return;
    }

    if (Notification.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    const notification = new Notification(options.title, options.options);

    notification.onclick = () => {
      if (options.options.data?.deepLink) {
        window.location.href = options.options.data.deepLink;
      }
      notification.close();

      // Track click
      if (options.options.data?.notificationId) {
        this.trackClick(
          options.options.data.notificationId,
          options.options.data.deepLink
        );
      }
    };

    notification.onclose = () => {
      // Track dismissal
      if (options.options.data?.notificationId) {
        this.trackDismissal(options.options.data.notificationId);
      }
    };
  }

  /**
   * Show in-app notification (toast)
   */
  showInAppNotification(
    notification: Omit<InAppNotification, 'id'>
  ): string {
    const id = `notification_${Date.now()}_${Math.random()}`;

    const fullNotification: InAppNotification = {
      id,
      ...notification,
    };

    return this.inAppQueue.add(fullNotification);
  }

  /**
   * Dismiss in-app notification
   */
  dismissInAppNotification(id: string): void {
    this.inAppQueue.remove(id);
  }

  /**
   * Clear all in-app notifications
   */
  clearAllNotifications(): void {
    this.inAppQueue.clear();
  }

  // ============================================
  // PREFERENCES MANAGEMENT
  // ============================================

  /**
   * Update notification preferences
   */
  async updatePreferences(
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    try {
      const updated = {
        ...this.preferences,
        ...preferences,
      };

      const response = await fetch(
        `${this.baseApiUrl}/notifications/preferences`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.getAuthToken()}`,
          },
          body: JSON.stringify(updated),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }

      this.preferences = await response.json();
      return this.preferences;
    } catch (error) {
      console.error('Failed to update preferences:', error);
      throw error;
    }
  }

  /**
   * Toggle quiet hours
   */
  async toggleQuietHours(enabled: boolean): Promise<NotificationPreferences> {
    if (!this.preferences) {
      throw new Error('Preferences not loaded');
    }

    return this.updatePreferences({
      quietHours: {
        ...this.preferences.quietHours,
        enabled,
      },
    });
  }

  /**
   * Mute category
   */
  async muteCategory(
    category: NotificationCategory
  ): Promise<NotificationPreferences> {
    if (!this.preferences) {
      throw new Error('Preferences not loaded');
    }

    const mutedCategories = Array.from(
      new Set([...this.preferences.mutedCategories, category])
    );

    return this.updatePreferences({ mutedCategories });
  }

  /**
   * Unmute category
   */
  async unmuteCategory(
    category: NotificationCategory
  ): Promise<NotificationPreferences> {
    if (!this.preferences) {
      throw new Error('Preferences not loaded');
    }

    const mutedCategories = this.preferences.mutedCategories.filter(
      (c) => c !== category
    );

    return this.updatePreferences({ mutedCategories });
  }

  /**
   * Get current preferences
   */
  getPreferences(): NotificationPreferences | null {
    return this.preferences;
  }

  /**
   * Subscribe to in-app notifications
   */
  subscribeToInAppNotifications(
    listener: (notifications: InAppNotification[]) => void
  ): () => void {
    return this.inAppQueue.subscribe(listener);
  }

  // ============================================
  // ANALYTICS & TRACKING
  // ============================================

  /**
   * Track notification delivery
   */
  private async trackDelivery(notificationId: string): Promise<void> {
    try {
      await fetch(
        `${this.baseApiUrl}/notifications/${notificationId}/delivered`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.getAuthToken()}`,
          },
        }
      );
    } catch (error) {
      console.error('Failed to track delivery:', error);
    }
  }

  /**
   * Track notification read
   */
  async trackRead(notificationId: string): Promise<void> {
    try {
      await fetch(
        `${this.baseApiUrl}/notifications/${notificationId}/read`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.getAuthToken()}`,
          },
        }
      );
    } catch (error) {
      console.error('Failed to track read:', error);
    }
  }

  /**
   * Track notification click
   */
  private async trackClick(
    notificationId: string,
    deepLink?: string
  ): Promise<void> {
    try {
      await fetch(
        `${this.baseApiUrl}/notifications/${notificationId}/clicked`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.getAuthToken()}`,
          },
          body: JSON.stringify({ deepLink }),
        }
      );
    } catch (error) {
      console.error('Failed to track click:', error);
    }
  }

  /**
   * Track notification dismissal
   */
  private async trackDismissal(notificationId: string): Promise<void> {
    try {
      await fetch(
        `${this.baseApiUrl}/notifications/${notificationId}/dismissed`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.getAuthToken()}`,
          },
        }
      );
    } catch (error) {
      console.error('Failed to track dismissal:', error);
    }
  }

  // ============================================
  // UTILITIES
  // ============================================

  /**
   * Get auth token from storage/session
   */
  private getAuthToken(): string {
    // Get from localStorage, sessionStorage, or cookie
    const token =
      localStorage.getItem('authToken') ||
      sessionStorage.getItem('authToken') ||
      '';
    return token;
  }

  /**
   * Check if notifications are enabled
   */
  isEnabled(): boolean {
    return this.isInitialized && this.messaging !== null;
  }

  /**
   * Unregister device and cleanup
   */
  async unregister(): Promise<void> {
    try {
      if (this.fcmToken) {
        await fetch(
          `${this.baseApiUrl}/notifications/devices/unregister`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.getAuthToken()}`,
            },
            body: JSON.stringify({ fcmToken: this.fcmToken }),
          }
        );
      }

      this.messaging = null;
      this.fcmToken = null;
      this.isInitialized = false;
      this.clearAllNotifications();
    } catch (error) {
      console.error('Failed to unregister device:', error);
    }
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

let notificationServiceInstance: NotificationService | null = null;

export function getNotificationService(baseApiUrl?: string): NotificationService {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationService(baseApiUrl);
  }
  return notificationServiceInstance;
}

export default getNotificationService;
