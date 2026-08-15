# Push Notifications Integration - Practical Guide

Step-by-step instructions for integrating push notifications into the Transcend application.

## Phase 1: Backend Setup

### 1.1 Firebase Configuration

```bash
# 1. Download Firebase service account JSON
#    Firebase Console → Project Settings → Service Accounts → Generate private key
#    Save to: transcend-api/firebase-service-account.json

# 2. Create .env file
cat >> transcend-api/.env << EOF
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
EOF
```

### 1.2 Database Setup

```bash
# Run schema migration
psql -U transcend_admin -d transcend_law -f transcend-api/services/pushNotifications.schema.sql

# Verify tables created
psql -U transcend_admin -d transcend_law -c "\dt" | grep notification
```

Expected output:
```
 public | device_registrations
 public | notification_preferences
 public | push_notifications
 public | notification_analytics
 public | notification_templates
 public | notification_history
 public | notification_batch_jobs
```

### 1.3 Initialize Firebase Admin

In your Express app initialization (e.g., `transcend-api/server.ts`):

```typescript
import { initializeFirebase } from './services/pushNotifications';
import pushNotificationRoutes from './routes/pushNotificationRoutes';

// Initialize Firebase
await initializeFirebase();

// Add routes
app.use('/api/v2/notifications', pushNotificationRoutes);

console.log('✓ Push notifications initialized');
```

### 1.4 Setup Scheduled Job

In your job scheduler (cron, agenda, etc.):

```typescript
import { sendScheduledNotifications } from './services/pushNotifications';

// Run every minute
schedule.scheduleJob('* * * * *', async () => {
  try {
    const sent = await sendScheduledNotifications();
    if (sent > 0) {
      console.log(`Processed ${sent} scheduled notifications`);
    }
  } catch (error) {
    console.error('Scheduled notification job failed:', error);
  }
});
```

## Phase 2: Frontend Setup

### 2.1 Firebase Configuration

```bash
# 1. Create .env file
cat >> transcend-frontend/.env << EOF
REACT_APP_FCM_VAPID_KEY=your-vapid-key
REACT_APP_FIREBASE_API_KEY=your-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
REACT_APP_VERSION=1.0.0
EOF
```

### 2.2 Service Worker Setup

```bash
# Create service worker file
mkdir -p transcend-frontend/public
touch transcend-frontend/public/firebase-messaging-sw.js
```

Copy the service worker code from `PUSH_NOTIFICATIONS_GUIDE.md`.

### 2.3 App Root Integration

In your main app component (e.g., `transcend-frontend/src/App.tsx`):

```typescript
import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext'; // Your auth context
import { getNotificationService } from '@/services/notificationService';

export function App() {
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    // Initialize notification service
    const initNotifications = async () => {
      try {
        const notificationService = getNotificationService();

        await notificationService.initialize(user.id, {
          apiKey: process.env.REACT_APP_FIREBASE_API_KEY!,
          authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN!,
          projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID!,
          storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET!,
          messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID!,
          appId: process.env.REACT_APP_FIREBASE_APP_ID!,
        });

        // Check permissions
        const permissions = await notificationService.checkPermissions();
        if (permissions.notifications === 'default') {
          // Optionally show UI to request permissions
          console.log('Notifications not yet permitted');
        }
      } catch (error) {
        console.error('Failed to initialize notifications:', error);
      }
    };

    initNotifications();
  }, [user?.id, isAuthenticated]);

  return (
    <>
      <NotificationCenter />
      {/* Rest of app */}
    </>
  );
}
```

### 2.4 Create Notification Center Component

Create `transcend-frontend/src/components/NotificationCenter.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { getNotificationService } from '@/services/notificationService';
import type { InAppNotification } from '@/services/notificationService';
import './NotificationCenter.css';

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const notificationService = getNotificationService();

  useEffect(() => {
    const unsubscribe = notificationService.subscribeToInAppNotifications(
      setNotifications
    );
    return unsubscribe;
  }, []);

  return (
    <div className="notification-center">
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={() =>
            notificationService.dismissInAppNotification(notification.id)
          }
          onTrackRead={() =>
            // Track that user has read this
          }
        />
      ))}
    </div>
  );
}

interface NotificationToastProps {
  notification: InAppNotification;
  onDismiss: () => void;
  onTrackRead: () => void;
}

function NotificationToast({
  notification,
  onDismiss,
  onTrackRead,
}: NotificationToastProps) {
  useEffect(() => {
    onTrackRead();
  }, []);

  return (
    <div className={`notification-toast notification-toast--${notification.type}`}>
      <div className="notification-toast__content">
        <h4 className="notification-toast__title">{notification.title}</h4>
        <p className="notification-toast__message">{notification.message}</p>
      </div>

      <div className="notification-toast__actions">
        {notification.action && (
          <button
            onClick={() => {
              notification.action?.onClick();
              onDismiss();
            }}
            className="notification-toast__action-button"
          >
            {notification.action.label}
          </button>
        )}

        {notification.dismissible && (
          <button
            onClick={onDismiss}
            className="notification-toast__close"
            aria-label="Close notification"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export default NotificationCenter;
```

Create `transcend-frontend/src/components/NotificationCenter.css`:

```css
.notification-center {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.notification-toast {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: slideIn 0.3s ease-out;
  gap: 12px;
}

@keyframes slideIn {
  from {
    transform: translateX(400px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.notification-toast--info {
  background-color: #e3f2fd;
  border-left: 4px solid #2196f3;
  color: #1976d2;
}

.notification-toast--success {
  background-color: #e8f5e9;
  border-left: 4px solid #4caf50;
  color: #388e3c;
}

.notification-toast--warning {
  background-color: #fff3e0;
  border-left: 4px solid #ff9800;
  color: #f57c00;
}

.notification-toast--error {
  background-color: #ffebee;
  border-left: 4px solid #f44336;
  color: #c62828;
}

.notification-toast__content {
  flex: 1;
}

.notification-toast__title {
  margin: 0 0 4px 0;
  font-weight: 600;
  font-size: 14px;
}

.notification-toast__message {
  margin: 0;
  font-size: 13px;
}

.notification-toast__actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-shrink: 0;
}

.notification-toast__action-button {
  padding: 4px 12px;
  font-size: 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background-color: rgba(0, 0, 0, 0.1);
  color: inherit;
  transition: background-color 0.2s;
}

.notification-toast__action-button:hover {
  background-color: rgba(0, 0, 0, 0.15);
}

.notification-toast__close {
  padding: 0;
  width: 24px;
  height: 24px;
  border: none;
  background: none;
  cursor: pointer;
  color: inherit;
  font-size: 18px;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.notification-toast__close:hover {
  opacity: 1;
}

@media (max-width: 600px) {
  .notification-center {
    left: 10px;
    right: 10px;
    max-width: none;
  }
}
```

## Phase 3: Feature Integration

### 3.1 Send Case Update Notification

When a case is updated, send a notification:

```typescript
// In your case update endpoint
import { sendNotification, NotificationCategory, NotificationPriority } from '@/services/pushNotifications';

async function updateCase(req: Request, res: Response) {
  const { caseId, updates } = req.body;
  const userId = req.user.id;

  // Update case in DB
  const updatedCase = await db.updateCase(caseId, updates);

  // Notify user
  if (updates.status) {
    await sendNotification(updatedCase.clientId, {
      title: 'Case Status Updated',
      body: `Your case status changed to: ${updates.status}`,
      category: NotificationCategory.CASE_UPDATE,
      priority: NotificationPriority.HIGH,
      channels: ['browser', 'in_app'],
      deepLink: `/cases/${caseId}`,
      imageUrl: 'https://your-domain.com/case-icon.png',
      data: {
        caseId,
        previousStatus: updatedCase.previousStatus,
        newStatus: updates.status,
      },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  }

  res.json({ success: true, case: updatedCase });
}
```

### 3.2 Send Message Notification

When a message is sent:

```typescript
import { sendNotification, NotificationCategory } from '@/services/pushNotifications';

async function sendMessage(req: Request, res: Response) {
  const { recipientId, message } = req.body;
  const senderId = req.user.id;

  // Save message
  const savedMessage = await db.saveMessage({
    senderId,
    recipientId,
    content: message,
  });

  // Get sender name
  const sender = await db.getUser(senderId);

  // Notify recipient
  await sendNotification(recipientId, {
    title: 'New Message',
    body: `${sender.name}: ${message.substring(0, 100)}`,
    category: NotificationCategory.MESSAGE,
    priority: 'normal',
    channels: ['browser', 'in_app', 'email'],
    deepLink: `/messages/${senderId}`,
    data: {
      messageId: savedMessage.id,
      senderId,
    },
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  res.json({ success: true, message: savedMessage });
}
```

### 3.3 Send Appointment Reminder

Scheduled notification before appointment:

```typescript
import { sendNotification, NotificationCategory } from '@/services/pushNotifications';

async function scheduleAppointmentReminder(appointment: Appointment) {
  // Schedule for 24 hours before
  const reminderTime = new Date(appointment.dateTime.getTime() - 24 * 60 * 60 * 1000);

  await sendNotification(appointment.clientId, {
    title: 'Appointment Reminder',
    body: `You have an appointment tomorrow with ${appointment.attorneyName}`,
    category: NotificationCategory.APPOINTMENT,
    priority: 'normal',
    channels: ['browser', 'in_app', 'sms'],
    deepLink: `/appointments/${appointment.id}`,
    scheduledFor: reminderTime,
    expiresAt: new Date(appointment.dateTime.getTime() + 60 * 60 * 1000), // 1 hour after appointment
    data: {
      appointmentId: appointment.id,
      time: appointment.dateTime.toISOString(),
    },
  });
}
```

### 3.4 Settings Page

Create `transcend-frontend/src/pages/NotificationSettings.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { getNotificationService } from '@/services/notificationService';
import type { NotificationPreferences } from '@/services/notificationService';
import { NotificationCategory } from '@/services/notificationService';

export function NotificationSettings() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const notificationService = getNotificationService();

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefs = notificationService.getPreferences();
        setPreferences(prefs);
      } catch (error) {
        console.error('Failed to load preferences:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, []);

  if (loading || !preferences) {
    return <div>Loading notification settings...</div>;
  }

  const handleToggleBrowserNotifications = async () => {
    const updated = await notificationService.updatePreferences({
      enableBrowserNotifications: !preferences.enableBrowserNotifications,
    });
    setPreferences(updated);
  };

  const handleToggleQuietHours = async () => {
    const updated = await notificationService.toggleQuietHours(
      !preferences.quietHours.enabled
    );
    setPreferences(updated);
  };

  const handleMuteCategory = async (category: NotificationCategory) => {
    const updated = await notificationService.muteCategory(category);
    setPreferences(updated);
  };

  const handleUnmuteCategory = async (category: NotificationCategory) => {
    const updated = await notificationService.unmuteCategory(category);
    setPreferences(updated);
  };

  return (
    <div className="notification-settings">
      <h2>Notification Settings</h2>

      <section>
        <h3>Channels</h3>
        <label>
          <input
            type="checkbox"
            checked={preferences.enableBrowserNotifications}
            onChange={handleToggleBrowserNotifications}
          />
          Browser Notifications
        </label>
        <label>
          <input
            type="checkbox"
            checked={preferences.enableInAppNotifications}
            readOnly
          />
          In-App Notifications
        </label>
        <label>
          <input
            type="checkbox"
            checked={preferences.enableEmailNotifications}
            readOnly
          />
          Email Notifications
        </label>
      </section>

      <section>
        <h3>Quiet Hours</h3>
        <label>
          <input
            type="checkbox"
            checked={preferences.quietHours.enabled}
            onChange={handleToggleQuietHours}
          />
          Enable Quiet Hours ({preferences.quietHours.startTime} -
          {preferences.quietHours.endTime})
        </label>
      </section>

      <section>
        <h3>Notification Categories</h3>
        {Object.values(NotificationCategory).map((category) => (
          <label key={category}>
            <input
              type="checkbox"
              checked={!preferences.mutedCategories.includes(category)}
              onChange={() => {
                if (preferences.mutedCategories.includes(category)) {
                  handleUnmuteCategory(category);
                } else {
                  handleMuteCategory(category);
                }
              }}
            />
            {category.replace('_', ' ').title}
          </label>
        ))}
      </section>
    </div>
  );
}
```

## Phase 4: Testing

### 4.1 Manual Testing

```typescript
// In browser console, test sending in-app notification
const notificationService = window.notificationService;
notificationService.showInAppNotification({
  title: 'Test Notification',
  message: 'This is a test',
  type: 'success',
  category: 'case_update',
  duration: 5000,
  dismissible: true,
});
```

### 4.2 API Testing

```bash
# Request permission and get devices
curl -X GET http://localhost:3000/api/v2/notifications/devices \
  -H "Authorization: Bearer YOUR_TOKEN"

# Send test notification
curl -X POST http://localhost:3000/api/v2/notifications/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test",
    "body": "Test notification",
    "category": "alert",
    "priority": "normal",
    "channels": ["browser", "in_app"],
    "deepLink": "/test"
  }'

# Get analytics
curl -X GET "http://localhost:3000/api/v2/notifications/analytics?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4.3 Automated Testing

Run the test suite:

```bash
npm test -- transcend-api/services/pushNotifications.test.ts
```

## Phase 5: Monitoring & Maintenance

### 5.1 Monitor Delivery Rates

```sql
-- Check daily delivery stats
SELECT
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as total,
  COUNT(CASE WHEN delivery_status = 'delivered' THEN 1 END) as delivered,
  ROUND(COUNT(CASE WHEN delivery_status = 'delivered' THEN 1 END)::NUMERIC / COUNT(*) * 100, 2) as delivery_rate
FROM push_notifications
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;
```

### 5.2 Cleanup Expired Notifications

```bash
# Run manual cleanup
curl -X POST http://localhost:3000/api/v2/notifications/process-scheduled \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### 5.3 Monitor FCM Token Failures

```sql
-- Check devices with high failure rates
SELECT
  dr.user_id,
  dr.device_type,
  dr.os_type,
  COUNT(pn.id) as failed_notifications,
  MAX(pn.created_at) as last_failed
FROM device_registrations dr
LEFT JOIN push_notifications pn ON pn.user_id = dr.user_id AND pn.delivery_status = 'failed'
WHERE dr.is_active = true
GROUP BY dr.user_id, dr.device_type, dr.os_type
HAVING COUNT(pn.id) > 10
ORDER BY COUNT(pn.id) DESC;
```

## Troubleshooting

### Push notifications not received

1. Verify Firebase config is correct
2. Check user has granted permissions
3. Check device is registered
4. Check browser console for errors
5. Review Firebase Cloud Messaging quota

### High failure rate

1. Check FCM token expiry (auto-renewed, but may fail)
2. Monitor Firebase Cloud Messaging errors
3. Check device is still active
4. Verify network connectivity

### Slow delivery

1. Check scheduled notification job is running
2. Monitor database query performance
3. Check Firebase API rate limits
4. Review batch size (max 1000 per request)

## Security Checklist

- [ ] Firebase service account key stored securely
- [ ] API endpoints protected with authentication
- [ ] Rate limiting enabled on notification endpoints
- [ ] Sensitive data never in notification body
- [ ] VAPID key kept private
- [ ] Deep links validated before navigation
- [ ] Admin endpoints require admin role
- [ ] Audit trail enabled for all notifications
- [ ] Data exported from DB is encrypted
- [ ] Device tokens rotated regularly

## Performance Optimization

- Use batch sending for multiple users (up to 1000 per request)
- Schedule non-urgent notifications during off-peak hours
- Enable delivery frequency preferences (immediate/daily/weekly digest)
- Monitor and clean up inactive devices regularly
- Use notification templates to reduce payload size
- Implement exponential backoff for retries

## Next Steps

1. [ ] Configure Firebase project
2. [ ] Set up database tables
3. [ ] Initialize Firebase Admin
4. [ ] Implement notification service on frontend
5. [ ] Create NotificationCenter component
6. [ ] Add permissions request UI
7. [ ] Integrate into case update flow
8. [ ] Add settings page
9. [ ] Test end-to-end
10. [ ] Monitor and optimize
