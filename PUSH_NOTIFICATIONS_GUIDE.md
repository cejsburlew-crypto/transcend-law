# Push Notifications Implementation Guide

Complete Firebase Cloud Messaging (FCM) integration for Transcend platform with browser push, in-app notifications, preferences, scheduling, and analytics.

## Overview

The push notification system provides:
- **Firebase Cloud Messaging (FCM)** integration for browser & mobile push
- **In-app toast notifications** with customizable types
- **User preference management** (quiet hours, muted categories)
- **Notification scheduling** for future delivery
- **Deep linking** for seamless app navigation
- **Click tracking & analytics** for engagement metrics
- **Batch notification sending** with rate limiting
- **Multi-channel delivery** (browser, in-app, email, SMS)

## Setup

### 1. Firebase Configuration

#### Install Dependencies

```bash
# Backend
npm install firebase-admin

# Frontend
npm install firebase
```

#### Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (or use existing)
3. Enable Cloud Messaging
4. Download service account key
5. Create web app and get config

#### Environment Variables

**Backend (.env)**
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
```

**Frontend (.env)**
```env
REACT_APP_FCM_VAPID_KEY=your-vapid-key
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
```

### 2. Database Setup

Run the schema migration:

```bash
psql -U postgres -d transcend_law -f transcend-api/services/pushNotifications.schema.sql
```

This creates:
- `device_registrations` - Device FCM tokens
- `notification_preferences` - User settings
- `push_notifications` - Notification records
- `notification_analytics` - Engagement metrics
- `notification_templates` - Reusable templates
- `notification_history` - Audit trail
- `notification_batch_jobs` - Bulk send tracking

### 3. Service Worker Setup

Create `public/firebase-messaging-sw.js`:

```javascript
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'YOUR_API_KEY',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: 'your-sender-id',
  appId: 'your-app-id',
});

const messaging = firebase.messaging();

// Handle background notifications
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.image_url || '/icon.png',
    badge: '/badge.png',
    tag: payload.data.category,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const deepLink = event.notification.data?.deepLink;
  if (deepLink) {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === '/' && 'focus' in client) {
            client.focus();
            client.navigate(deepLink);
            return;
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(deepLink);
        }
      })
    );
  }
});
```

### 4. API Routes Integration

Add to your Express app:

```typescript
import pushNotificationRoutes from './routes/pushNotificationRoutes';

app.use('/api/v2/notifications', pushNotificationRoutes);
```

### 5. Initialize Firebase Admin

In your server startup:

```typescript
import { initializeFirebase } from './services/pushNotifications';

// During app initialization
await initializeFirebase();
```

## Frontend Usage

### Initialize Notification Service

```typescript
import { getNotificationService } from '@/services/notificationService';

// In app component or authentication handler
const notificationService = getNotificationService();

await notificationService.initialize(userId, {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
});
```

### Request Permission

```typescript
// Ask user for permission
const granted = await notificationService.requestPermission();

if (granted) {
  console.log('Notifications enabled');
}
```

### Show In-App Notification

```typescript
notificationService.showInAppNotification({
  title: 'Case Update',
  message: 'Your case has been updated',
  type: 'success',
  category: NotificationCategory.CASE_UPDATE,
  duration: 5000,
  dismissible: true,
  deepLink: '/cases/123',
});
```

### Subscribe to In-App Notifications

```typescript
const unsubscribe = notificationService.subscribeToInAppNotifications(
  (notifications) => {
    // Update UI with notifications
    setNotifications(notifications);
  }
);

// Cleanup on unmount
useEffect(() => {
  return unsubscribe;
}, []);
```

### Update User Preferences

```typescript
// Toggle quiet hours
await notificationService.toggleQuietHours(true);

// Mute category
await notificationService.muteCategory(NotificationCategory.MARKETING);

// Unmute category
await notificationService.unmuteCategory(NotificationCategory.MARKETING);

// Update all preferences
await notificationService.updatePreferences({
  enableBrowserNotifications: true,
  enableInAppNotifications: true,
  quietHours: {
    enabled: true,
    startTime: '22:00',
    endTime: '08:00',
    timezone: 'America/Los_Angeles',
  },
});
```

### React Component Example

```typescript
import React, { useEffect, useState } from 'react';
import { getNotificationService } from '@/services/notificationService';
import { NotificationCategory } from '@/services/notificationService';

export function NotificationCenter() {
  const [notifications, setNotifications] = useState([]);
  const notificationService = getNotificationService();

  useEffect(() => {
    const unsubscribe = notificationService.subscribeToInAppNotifications(
      setNotifications
    );
    return unsubscribe;
  }, []);

  return (
    <div className="notification-container">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`notification notification--${notification.type}`}
        >
          <h3>{notification.title}</h3>
          <p>{notification.message}</p>
          {notification.action && (
            <button onClick={notification.action.onClick}>
              {notification.action.label}
            </button>
          )}
          {notification.dismissible && (
            <button
              onClick={() =>
                notificationService.dismissInAppNotification(notification.id)
              }
            >
              Close
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

## Backend Usage

### Send Single Notification

```typescript
import {
  sendNotification,
  NotificationCategory,
  NotificationPriority,
  NotificationChannel,
} from './services/pushNotifications';

const notification = await sendNotification(userId, {
  title: 'Case Update',
  body: 'Your case has been assigned to an attorney',
  category: NotificationCategory.CASE_UPDATE,
  priority: NotificationPriority.HIGH,
  channels: [NotificationChannel.BROWSER, NotificationChannel.IN_APP],
  deepLink: `/cases/${caseId}`,
  imageUrl: 'https://example.com/image.png',
  data: {
    caseId,
    attorneyId,
  },
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
});
```

### Send Batch Notifications

```typescript
const result = await sendBatchNotifications(
  [userId1, userId2, userId3],
  {
    title: 'New Case Opportunity',
    body: 'A new case matching your expertise is available',
    category: NotificationCategory.ALERT,
    priority: NotificationPriority.NORMAL,
    channels: [NotificationChannel.BROWSER, NotificationChannel.IN_APP],
    deepLink: '/cases',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  }
);

console.log(`Sent: ${result.totalSuccessful}, Failed: ${result.totalFailed}`);
```

### Use Notification Templates

```typescript
import {
  createNotificationTemplate,
  renderNotificationFromTemplate,
} from './services/pushNotifications';

// Create template (admin)
const template = await createNotificationTemplate({
  name: 'case_assigned',
  category: NotificationCategory.CASE_UPDATE,
  titleTemplate: 'New Case: {{caseName}}',
  bodyTemplate: 'Assigned by {{attorneyName}} - {{caseType}} case',
  variables: ['caseName', 'attorneyName', 'caseType'],
});

// Use template to send
const notification = await renderNotificationFromTemplate(template.id, {
  caseName: 'Smith v. Jones',
  attorneyName: 'John Doe',
  caseType: 'Personal Injury',
});

await sendNotification(userId, notification);
```

### Schedule Notifications

```typescript
// Send notification in the future
await sendNotification(userId, {
  title: 'Reminder',
  body: 'Your appointment is tomorrow at 2 PM',
  category: NotificationCategory.APPOINTMENT,
  priority: NotificationPriority.NORMAL,
  channels: [NotificationChannel.BROWSER, NotificationChannel.IN_APP],
  scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
});

// Process scheduled notifications (run periodically)
const sent = await sendScheduledNotifications();
console.log(`Processed ${sent} scheduled notifications`);
```

### Track Engagement

```typescript
import { getNotificationAnalytics } from './services/pushNotifications';

const analytics = await getNotificationAnalytics(
  new Date('2024-01-01'),
  new Date('2024-01-31'),
  {
    category: NotificationCategory.CASE_UPDATE,
    channel: NotificationChannel.BROWSER,
  }
);

// Results include:
// - total_notifications: number sent
// - delivered: successfully delivered
// - read: opened by user
// - clicked: user clicked on notification
// - failed: delivery failed
// - delivery_rate: percentage delivered
// - read_rate: percentage read
// - click_rate: percentage clicked
```

### Check User Preferences

```typescript
import {
  getNotificationPreferences,
  isInQuietHours,
} from './services/pushNotifications';

const prefs = await getNotificationPreferences(userId);
console.log('Browser notifications enabled:', prefs.enableBrowserNotifications);
console.log('Muted categories:', prefs.mutedCategories);

// Check if user is in quiet hours
const quietStatus = await isInQuietHours(userId);
console.log('In quiet hours:', quietStatus.isInQuietHours);
```

## Notification Categories

- **CASE_UPDATE** - Case status changes, assignments
- **MESSAGE** - New messages from attorneys/clients
- **ALERT** - Important alerts and warnings
- **DOCUMENT** - Document uploads, signatures needed
- **APPOINTMENT** - Appointment reminders, scheduling
- **PAYMENT** - Payment confirmations, invoices
- **SYSTEM** - System notifications, maintenance
- **MARKETING** - Marketing communications

## Best Practices

### 1. Permission Handling

```typescript
// Always request permission before showing notifications
if (Notification.permission === 'default') {
  const granted = await notificationService.requestPermission();
  if (!granted) {
    console.log('User denied notification permission');
  }
}
```

### 2. Respect Quiet Hours

```typescript
// Backend automatically respects quiet hours
// Low-priority notifications are delayed after quiet hours
// HIGH priority notifications are still sent (emergencies only)
```

### 3. Use Deep Links

```typescript
// Always include deep links for better user experience
await sendNotification(userId, {
  title: 'Case Update',
  body: 'New document available',
  category: NotificationCategory.DOCUMENT,
  deepLink: `/cases/${caseId}/documents/${docId}`,
  // User clicks notification → app navigates to document
});
```

### 4. Analytics & Monitoring

```typescript
// Monitor notification performance
const stats = await getNotificationAnalytics(
  new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
  new Date()
);

// Track:
// - Delivery rates (should be > 95%)
// - Read rates (engagement metric)
// - Click rates (actionability)
```

### 5. Undeliverable Device Cleanup

```typescript
// Automatically handle invalid FCM tokens
// Backend retries with exponential backoff
// After 3 failed attempts, device is marked inactive
// Frontend should re-register on first use
```

## API Endpoints

### Device Management

- `POST /api/v2/notifications/devices/register` - Register device
- `POST /api/v2/notifications/devices/unregister` - Unregister device
- `GET /api/v2/notifications/devices` - List user devices

### Preferences

- `GET /api/v2/notifications/preferences` - Get preferences
- `PUT /api/v2/notifications/preferences` - Update preferences
- `POST /api/v2/notifications/quiet-hours/toggle` - Toggle quiet hours
- `GET /api/v2/notifications/quiet-hours/status` - Check quiet hours
- `POST /api/v2/notifications/categories/:category/mute` - Mute category
- `POST /api/v2/notifications/categories/:category/unmute` - Unmute category

### Sending

- `POST /api/v2/notifications/send` - Send single notification
- `POST /api/v2/notifications/send-batch` - Send batch
- `POST /api/v2/notifications/process-scheduled` - Process scheduled (admin)

### Tracking

- `POST /api/v2/notifications/:id/read` - Mark as read
- `POST /api/v2/notifications/:id/clicked` - Track click
- `POST /api/v2/notifications/:id/delivered` - Confirm delivery
- `POST /api/v2/notifications/:id/dismissed` - Track dismissal

### Analytics

- `GET /api/v2/notifications/analytics` - Get analytics

### Templates

- `POST /api/v2/notifications/templates` - Create template (admin)
- `POST /api/v2/notifications/templates/:id/render` - Render template

## Troubleshooting

### Notifications Not Received

1. Check FCM token is registered
2. Verify user preferences allow notifications
3. Check device is active
4. Verify Firebase configuration
5. Check browser console for errors

### Quiet Hours Not Working

1. Verify timezone is correct
2. Check user preferences are saved
3. Ensure time format is HH:MM (24-hour)

### Analytics Not Tracking

1. Verify events are being sent
2. Check database connectivity
3. Review notification_analytics table

### High Failure Rate

1. Check Firebase quota
2. Monitor FCM token expiry
3. Review device registration process

## Security Considerations

- All API endpoints require authentication
- FCM tokens stored securely in database
- Sensitive data never in notification body
- Deep links validated before navigation
- Admin-only endpoints for batch sending
- Audit trail for all notification events

## Performance

- Batch sending: up to 1000 notifications per request
- Scheduling: processed every minute
- Analytics: aggregated views for performance
- Cleanup: expired notifications auto-deleted after 30 days
- Rate limiting: 100 requests/minute per user

## Support

For issues or questions:
1. Check logs for errors
2. Review database state
3. Test Firebase credentials
4. Verify network connectivity
5. Contact support team
