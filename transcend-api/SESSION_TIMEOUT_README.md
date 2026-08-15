# Session Timeout & Auto-Logout Implementation

## Overview

This implementation provides a comprehensive session management system for the Transcend Law platform with the following features:

- **Configurable Inactivity Timeouts**: Different timeout durations per user role
- **Warning System**: 5-minute warning before automatic logout
- **Session Extension**: Users can extend sessions before expiration
- **Audit Logging**: Complete audit trail of all logouts
- **Multi-Session Support**: Track multiple concurrent sessions per user
- **Role-Based Timeouts**: Different timeouts for admin, attorney, firm, and client roles
- **Production-Ready**: Includes tests, monitoring, and security best practices

## Architecture

### Core Components

1. **SessionManager Class** (`sessionTimeout.ts`)
   - Manages session lifecycle (create, update, destroy)
   - Tracks inactivity and timeout states
   - Handles session extension logic

2. **Middleware** (`sessionTimeout.ts`)
   - Express middleware for automatic session tracking
   - Updates activity on each request
   - Enforces timeout policies

3. **HTTP Handlers** (`sessionTimeout.ts`)
   - `/api/sessions/extend` - Extend current session
   - `/api/sessions/logout` - Manual logout
   - `/api/sessions/status` - Get session info
   - `/api/sessions/active` - List all active sessions
   - `/api/sessions/revoke-all` - Revoke other sessions

4. **Configuration** (`sessionTimeoutConfig.ts`)
   - Environment-specific settings
   - Security levels (high, default, relaxed)
   - Role-based timeouts

5. **Database Support** (`migrations/003_session_timeout_tracking.sql`)
   - Audit logging schema
   - Session analytics views
   - Cleanup procedures

## File Structure

```
transcend-api/
├── src/
│   ├── middleware/
│   │   ├── sessionTimeout.ts              # Main middleware implementation
│   │   └── sessionTimeout.test.ts         # Unit tests
│   ├── config/
│   │   └── sessionTimeoutConfig.ts        # Configuration management
│   ├── database/
│   │   └── migrations/
│   │       └── 003_session_timeout_tracking.sql  # Database schema
│   └── routes/
│       └── sessions.ts                    # Session API routes (example)
├── SESSION_TIMEOUT_README.md              # This file
├── SESSION_TIMEOUT_INTEGRATION.md         # Integration guide
└── SESSION_TIMEOUT_IMPLEMENTATION.md      # Implementation details
```

## Quick Start

### 1. Install Dependencies

```bash
cd transcend-api
npm install
```

### 2. Apply Database Migration

```bash
# PostgreSQL
psql -U postgres -d transcend_law < src/database/migrations/003_session_timeout_tracking.sql

# Or using your migration tool
npm run migrate
```

### 3. Configure Session Timeouts

Edit `src/config/sessionTimeoutConfig.ts` or set environment variables:

```bash
# Set security level
export NODE_ENV=production
export SESSION_SECURITY_LEVEL=default  # high, default, or relaxed
```

### 4. Integrate into Express App

```typescript
// src/index.ts
import express from 'express';
import { sessionTimeoutMiddleware } from './middleware/sessionTimeout';
import sessionRoutes from './routes/sessions';

const app = express();

// Authentication must come first
app.use(authMiddleware);

// Then session timeout
app.use(sessionTimeoutMiddleware);

// Session routes
app.use('/api/sessions', sessionRoutes);
```

### 5. Create Session Routes File

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
router.use(authMiddleware);

router.post('/extend', extendSessionHandler);
router.get('/status', sessionStatusHandler);
router.get('/active', getUserSessionsHandler);
router.post('/revoke-all', revokeAllSessionsHandler);
router.post('/logout', logoutHandler);

export default router;
```

## Configuration

### Default Timeouts (Production)

```typescript
{
  admin: {
    inactivityTimeout: 20 * 60 * 1000,      // 20 minutes
    warningTime: 5 * 60 * 1000,             // 5 minutes before
    extendSessionDuration: 10 * 60 * 1000,  // +10 minutes
    requireReauth: true,
  },
  attorney: {
    inactivityTimeout: 30 * 60 * 1000,      // 30 minutes
    warningTime: 5 * 60 * 1000,
    extendSessionDuration: 10 * 60 * 1000,
    requireReauth: true,
  },
  firm: {
    inactivityTimeout: 25 * 60 * 1000,      // 25 minutes
    warningTime: 5 * 60 * 1000,
    extendSessionDuration: 10 * 60 * 1000,
    requireReauth: true,
  },
  client: {
    inactivityTimeout: 15 * 60 * 1000,      // 15 minutes
    warningTime: 5 * 60 * 1000,
    extendSessionDuration: 5 * 60 * 1000,
    requireReauth: true,
  },
}
```

### Security Levels

```bash
# High Security (sensitive operations)
SESSION_SECURITY_LEVEL=high

# Default (recommended)
SESSION_SECURITY_LEVEL=default

# Relaxed (internal tools)
SESSION_SECURITY_LEVEL=relaxed
```

### Environment Variables

```bash
# Logging
DEBUG=transcend:session              # Enable debug logging
SESSION_LOG_LEVEL=debug              # Log level

# Cleanup
SESSION_CLEANUP_INTERVAL=60000       # Run cleanup every 60s
SESSION_MAX_AGE=86400000             # Keep sessions max 24h

# Security
SESSION_REQUIRE_REAUTH=true          # Require re-auth after timeout
SESSION_SECURITY_LEVEL=default
```

## API Usage

### Check Session Status

```bash
curl -X GET http://localhost:3000/api/sessions/status \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Session-ID: YOUR_SESSION_ID"
```

Response:
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

### Extend Session

```bash
curl -X POST http://localhost:3000/api/sessions/extend \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Session-ID: YOUR_SESSION_ID"
```

Response:
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

### Manual Logout

```bash
curl -X POST http://localhost:3000/api/sessions/logout \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Session-ID: YOUR_SESSION_ID"
```

### Get All Active Sessions

```bash
curl -X GET http://localhost:3000/api/sessions/active \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Revoke All Other Sessions

```bash
curl -X POST http://localhost:3000/api/sessions/revoke-all \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Session-ID: YOUR_SESSION_ID"
```

## Frontend Integration

### 1. Capture Session ID on Login

```javascript
async function login(email, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (response.ok) {
    const data = await response.json();
    const sessionId = response.headers.get('X-Session-ID');
    
    localStorage.setItem('accessToken', data.accessToken);
    sessionStorage.setItem('sessionId', sessionId);
  }
}
```

### 2. Monitor Session Status

```javascript
async function checkSessionStatus() {
  const sessionId = sessionStorage.getItem('sessionId');
  const token = localStorage.getItem('accessToken');

  const response = await fetch('/api/sessions/status', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Session-ID': sessionId
    }
  });

  if (response.status === 401) {
    // Session expired
    showLoginPage();
    return;
  }

  const data = await response.json();

  if (data.shouldWarn) {
    showSessionWarning({
      remainingTime: data.remainingTime,
      onExtend: extendSession,
      onLogout: logout
    });
  }
}

// Check every 30 seconds
setInterval(checkSessionStatus, 30000);
```

### 3. Extend Session

```javascript
async function extendSession() {
  const sessionId = sessionStorage.getItem('sessionId');
  const token = localStorage.getItem('accessToken');

  const response = await fetch('/api/sessions/extend', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Session-ID': sessionId
    }
  });

  if (response.ok) {
    dismissWarning();
    console.log('Session extended');
  }
}
```

### 4. Handle Logout

```javascript
async function logout() {
  const sessionId = sessionStorage.getItem('sessionId');
  const token = localStorage.getItem('accessToken');

  await fetch('/api/sessions/logout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Session-ID': sessionId
    }
  });

  localStorage.clear();
  sessionStorage.clear();
  window.location.href = '/login';
}
```

## Audit Logging

All session events are logged to the `audit_log` table:

### Logout Reasons

- `timeout`: Session expired due to inactivity
- `manual`: User manually logged out
- `extended_inactivity`: Extended inactivity timeout
- `forced`: Admin revoked all user sessions

### Query Examples

```sql
-- All timeouts for a user
SELECT * FROM audit_log
WHERE user_id = '550e8400-e29b-41d4-a716-446655440000'
AND action = 'logout'
AND changes->>'reason' = 'timeout'
ORDER BY created_at DESC;

-- Logout statistics by day
SELECT 
  DATE(created_at) as date,
  changes->>'reason' as reason,
  COUNT(*) as count
FROM audit_log
WHERE action = 'logout'
GROUP BY DATE(created_at), changes->>'reason'
ORDER BY date DESC;

-- Sessions for a specific IP
SELECT * FROM audit_log
WHERE action = 'logout'
AND ip_address = '192.168.1.1'
ORDER BY created_at DESC;
```

## Monitoring

### Session Analytics View

```sql
SELECT * FROM session_timeout_analytics
ORDER BY date DESC;
```

### Active Sessions Count

```sql
SELECT 
  al.user_id,
  COUNT(*) as active_sessions,
  MAX(al.timestamp) as last_activity
FROM activity_logs al
WHERE al.action = 'session_started'
AND NOT EXISTS (
  SELECT 1 FROM activity_logs al2
  WHERE al2.session_id = al.session_id
  AND al2.action = 'session_ended'
)
GROUP BY al.user_id;
```

### Cleanup Old Logs

```sql
-- Run cleanup procedure
SELECT cleanup_old_session_logs();

-- Or schedule it:
-- In production, run daily or weekly
```

## Testing

### Run Unit Tests

```bash
npm test -- sessionTimeout.test.ts
```

### Run Integration Tests

```bash
npm run test:integration -- sessionTimeout
```

### Manual Testing

```bash
# Test session creation
curl -X GET http://localhost:3000/api/sessions/status \
  -H "Authorization: Bearer test-token" \
  -H "X-Session-ID: test-session"

# Test timeout
# Wait for timeout duration and check status again
```

## Security Considerations

1. **Session IDs**: Generated with timestamp + random component for uniqueness
2. **HTTPS Only**: Always use HTTPS in production to protect session IDs in transit
3. **Secure Cookies**: Consider storing session IDs in httpOnly cookies
4. **IP Validation**: Optional: Validate IP matches original login IP
5. **User Agent**: Optional: Validate user agent matches original login
6. **Audit Trail**: All logouts logged with IP and user agent
7. **Cleanup**: Old logs automatically cleaned up (90+ days)

## Best Practices

1. **Test Timeouts**: Set shorter timeouts in development for faster testing
2. **Monitor Analytics**: Regularly review session analytics for patterns
3. **Update Config**: Adjust timeouts based on user behavior
4. **Security Reviews**: Audit logout logs for suspicious patterns
5. **Performance**: Session manager automatically cleans up memory every minute
6. **Errors**: Always handle 401 responses and redirect to login

## Troubleshooting

### Session Expires Too Quickly

1. Check timeout configuration for user's role
2. Verify `X-Session-Remaining` header in responses
3. Check system time synchronization

### Warning Not Showing

1. Verify frontend checks `shouldWarn` flag
2. Confirm `X-Session-Warning` header is sent
3. Check warning threshold in configuration

### Session Not Extending

1. Verify session exists before extend attempt
2. Check `X-Session-ID` header is included
3. Ensure user is properly authenticated

### Audit Logs Not Recording

1. Verify `audit_log` table exists
2. Check database connection
3. Review application error logs

## Performance

- **Memory Usage**: ~1KB per active session
- **Cleanup**: Runs every minute, removes expired sessions
- **Database Queries**: Minimal, only on logout
- **Response Headers**: 4 small headers added to each response

## Compliance

- **GDPR**: Audit logs can be purged as per retention policy
- **HIPAA**: Session data includes IP and user agent for compliance
- **SOC 2**: Comprehensive audit trail for security reviews
- **PCI-DSS**: Re-authentication required after timeout

## Future Enhancements

1. Redis integration for distributed sessions
2. Device fingerprinting for additional security
3. Configurable warning messages per role
4. Session activity dashboard
5. Geographic IP validation
6. Risk-based timeouts based on user behavior
7. One-time password support for sensitive operations

## Support

For issues or questions:
1. Check integration guide: `SESSION_TIMEOUT_INTEGRATION.md`
2. Review test file: `sessionTimeout.test.ts`
3. Check configuration: `sessionTimeoutConfig.ts`
4. Review audit logs for events

## Version

- Implementation Date: 2026-08-15
- Version: 1.0.0
- Status: Production Ready
