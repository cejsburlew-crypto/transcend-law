# Session Timeout & Auto-Logout Integration Guide

## Overview

The session timeout middleware provides configurable inactivity timeouts with role-based settings, warning systems, and comprehensive audit logging for the Transcend Law platform.

## Features

- **Configurable Inactivity Timeouts**: Different timeout durations per user role
  - Client: 15 minutes (default)
  - Attorney: 30 minutes
  - Firm: 25 minutes
  - Admin: 20 minutes (configurable)

- **Warning System**: Users receive a 5-minute warning before automatic logout

- **Session Extension**: Users can extend their session before timeout occurs

- **Audit Logging**: All logouts are logged with reason, IP address, and user agent

- **Multi-Session Support**: Track multiple sessions per user and revoke specific sessions

- **Re-authentication Required**: After timeout, users must re-login

## Setup

### 1. Add Middleware to Express App

```typescript
// src/index.ts
import express from 'express';
import { sessionTimeoutMiddleware } from './middleware/sessionTimeout';
import { authMiddleware } from './middleware/authMiddleware';

const app = express();

// Session timeout should come AFTER authentication
app.use(authMiddleware);
app.use(sessionTimeoutMiddleware);
```

### 2. Add Session Routes

```typescript
// src/routes/sessions.ts
import express from 'express';
import {
  extendSessionHandler,
  logoutHandler,
  sessionStatusHandler,
  getUserSessionsHandler,
  revokeAllSessionsHandler
} from '../middleware/sessionTimeout';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Extend current session
router.post('/extend', extendSessionHandler);

// Get current session status
router.get('/status', sessionStatusHandler);

// Get all active sessions for user
router.get('/active', getUserSessionsHandler);

// Revoke all other sessions (keep current)
router.post('/revoke-all', revokeAllSessionsHandler);

// Logout
router.post('/logout', logoutHandler);

export default router;
```

### 3. Register Session Routes in Main App

```typescript
// src/index.ts
import sessionRoutes from './routes/sessions';

app.use('/api/sessions', sessionRoutes);
```

### 4. Run Database Migration

```bash
# Apply the migration to create necessary indexes and views
psql -U postgres -d transcend_law < src/database/migrations/003_session_timeout_tracking.sql
```

## Usage

### Client-Side Implementation

#### 1. Handle Session Warnings

```typescript
// Front-end code to handle session timeout warnings
async function checkSessionStatus() {
  const response = await fetch('/api/sessions/status', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Session-ID': sessionId
    }
  });

  const data = await response.json();

  if (data.shouldWarn) {
    // Show warning to user
    showSessionWarningDialog({
      remainingTime: data.remainingTime,
      onExtend: () => extendSession(),
      onLogout: () => logout()
    });
  }

  if (response.status === 401) {
    // Session expired, redirect to login
    redirectToLogin();
  }
}

// Check session every 30 seconds
setInterval(checkSessionStatus, 30000);
```

#### 2. Extend Session

```typescript
async function extendSession() {
  const response = await fetch('/api/sessions/extend', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Session-ID': sessionId
    }
  });

  if (response.ok) {
    const data = await response.json();
    console.log('Session extended until:', new Date(data.expiresAt));
    dismissWarning();
  }
}
```

#### 3. Handle Logout

```typescript
async function logout() {
  const response = await fetch('/api/sessions/logout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Session-ID': sessionId
    }
  });

  if (response.ok) {
    // Clear local storage and redirect
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
  }
}
```

#### 4. Store Session ID from Headers

```typescript
// After login, capture session ID from response headers
async function login(email: string, password: string) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (response.ok) {
    const data = await response.json();
    const sessionId = response.headers.get('X-Session-ID');
    
    // Store session ID
    sessionStorage.setItem('sessionId', sessionId);
    sessionStorage.setItem('accessToken', data.accessToken);
  }
}
```

### Server-Side: Custom Timeout Configuration

```typescript
// src/middleware/sessionTimeout.ts
import { SessionManager, ROLE_TIMEOUT_CONFIGS } from './sessionTimeout';

// Customize timeouts for your deployment
const customTimeouts = {
  ...ROLE_TIMEOUT_CONFIGS,
  client: {
    inactivityTimeout: 10 * 60 * 1000,    // 10 minutes for clients
    warningTime: 3 * 60 * 1000,           // 3 minutes warning
    extendSessionDuration: 5 * 60 * 1000,
    requireReauth: true
  },
  admin: {
    inactivityTimeout: 30 * 60 * 1000,    // 30 minutes for admins
    warningTime: 5 * 60 * 1000,
    extendSessionDuration: 15 * 60 * 1000,
    requireReauth: true
  }
};

const sessionManager = new SessionManager(customTimeouts);
```

## API Endpoints

### 1. GET /api/sessions/status

Get current session status and timeout information.

**Request Headers:**
```
Authorization: Bearer {accessToken}
X-Session-ID: {sessionId}
```

**Response:**
```json
{
  "sessionId": "1692115200000-abc123def",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "userType": "attorney",
  "createdAt": 1692115200000,
  "lastActivityAt": 1692115800000,
  "expiresAt": 1692117000000,
  "remainingTime": 1200000,
  "warningThreshold": 300000,
  "shouldWarn": false,
  "config": {
    "inactivityTimeout": 1800000,
    "warningTime": 300000,
    "extendSessionDuration": 600000
  }
}
```

### 2. POST /api/sessions/extend

Extend the current session by the configured duration.

**Request Headers:**
```
Authorization: Bearer {accessToken}
X-Session-ID: {sessionId}
```

**Response:**
```json
{
  "success": true,
  "message": "Session extended",
  "sessionId": "1692115200000-abc123def",
  "expiresAt": 1692118600000,
  "remainingTime": 1800000,
  "extendedDuration": 600000
}
```

### 3. POST /api/sessions/logout

Manually logout and terminate the session.

**Request Headers:**
```
Authorization: Bearer {accessToken}
X-Session-ID: {sessionId}
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### 4. GET /api/sessions/active

Get all active sessions for the current user.

**Request Headers:**
```
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "activeSessions": 2,
  "sessions": [
    {
      "sessionId": "1692115200000-abc123def",
      "createdAt": 1692115200000,
      "lastActivityAt": 1692115800000,
      "ipAddress": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "remainingTime": 1200000,
      "isExpired": false
    }
  ]
}
```

### 5. POST /api/sessions/revoke-all

Revoke all other sessions for the current user (keeps current session active).

**Request Headers:**
```
Authorization: Bearer {accessToken}
X-Session-ID: {sessionId}
```

**Response:**
```json
{
  "success": true,
  "message": "All other sessions revoked",
  "revokedCount": 1
}
```

## Response Headers

All authenticated endpoints return the following headers:

```
X-Session-ID: {sessionId}
X-Session-Expires: {expiresAtTimestamp}
X-Session-Remaining: {remainingSeconds}
X-Session-Warning: true (only if warning threshold reached)
```

## Audit Logging

All session logouts are logged to the `audit_log` table with:

- **action**: 'logout'
- **resource_type**: 'session'
- **resource_id**: session ID
- **changes**: JSON with logout reason and timestamp
- **ip_address**: User's IP address
- **user_agent**: User's browser/client information

### Logout Reasons

- `timeout`: Session expired due to inactivity
- `manual`: User manually logged out
- `extended_inactivity`: Extended inactivity timeout (configurable)
- `forced`: Admin revoked all user sessions

### Query Audit Logs

```sql
-- Get all timeouts for a user
SELECT * FROM audit_log
WHERE user_id = '550e8400-e29b-41d4-a716-446655440000'
AND action = 'logout'
AND changes->>'reason' = 'timeout'
ORDER BY created_at DESC;

-- Get logout statistics by day
SELECT 
  DATE(created_at) as date,
  changes->>'reason' as reason,
  COUNT(*) as count
FROM audit_log
WHERE action = 'logout'
GROUP BY DATE(created_at), changes->>'reason'
ORDER BY date DESC;
```

## Configuration

### Timeout Configuration Structure

```typescript
interface TimeoutConfig {
  inactivityTimeout: number;      // milliseconds
  warningTime: number;             // milliseconds before logout
  extendSessionDuration: number;   // milliseconds to extend
  requireReauth: boolean;          // require re-authentication
}
```

### Default Timeouts

```typescript
const ROLE_TIMEOUT_CONFIGS = {
  admin: {
    inactivityTimeout: 20 * 60 * 1000,      // 20 minutes
    warningTime: 5 * 60 * 1000,              // 5 minutes warning
    extendSessionDuration: 10 * 60 * 1000,   // Extend by 10 min
    requireReauth: true,
  },
  attorney: {
    inactivityTimeout: 30 * 60 * 1000,       // 30 minutes
    warningTime: 5 * 60 * 1000,
    extendSessionDuration: 10 * 60 * 1000,
    requireReauth: true,
  },
  firm: {
    inactivityTimeout: 25 * 60 * 1000,       // 25 minutes
    warningTime: 5 * 60 * 1000,
    extendSessionDuration: 10 * 60 * 1000,
    requireReauth: true,
  },
  client: {
    inactivityTimeout: 15 * 60 * 1000,       // 15 minutes
    warningTime: 5 * 60 * 1000,
    extendSessionDuration: 5 * 60 * 1000,
    requireReauth: true,
  },
};
```

## Security Considerations

1. **Session IDs**: Generated with timestamp and random component for uniqueness
2. **IP Address Tracking**: All sessions log IP addresses for security audit
3. **User Agent Tracking**: Browser/client information stored for analysis
4. **Audit Trail**: All logouts logged with reason and timestamp
5. **Token Validation**: Sessions must correspond to valid JWT tokens
6. **Multi-Session Support**: Users can have multiple active sessions
7. **Forced Logout**: Admins can revoke all sessions for a user

## Monitoring and Analytics

### View Session Analytics

```sql
-- Session timeout analytics view
SELECT * FROM session_timeout_analytics
ORDER BY date DESC;
```

### Cleanup Old Logs

```sql
-- Remove logs older than 90 days
SELECT cleanup_old_session_logs();
```

## Troubleshooting

### Session Expires Too Quickly

1. Check the timeout configuration for the user's role
2. Verify `X-Session-Remaining` header value
3. Check system time synchronization

### Warning Not Showing

1. Verify frontend is checking `shouldWarn` flag
2. Confirm `X-Session-Warning` header is being sent
3. Check warning threshold value in configuration

### Session Not Extending

1. Verify session exists before extend attempt
2. Check that extend request includes `X-Session-ID` header
3. Ensure user is properly authenticated

### Audit Logs Not Recording

1. Verify audit_log table exists and is accessible
2. Check database connection in application
3. Review error logs for SQL errors
