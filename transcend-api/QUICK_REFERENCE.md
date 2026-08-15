# Session Timeout - Quick Reference Guide

## 30-Second Setup

### 1. Update Express App (src/index.ts)

```typescript
import express from 'express';
import { sessionTimeoutMiddleware } from './middleware/sessionTimeout';
import { authMiddleware } from './middleware/authMiddleware';
import sessionRoutes from './routes/sessions';

const app = express();

// Order matters: Auth → Session → Routes
app.use(authMiddleware);
app.use(sessionTimeoutMiddleware);
app.use('/api/sessions', sessionRoutes);
```

### 2. Create Session Routes (src/routes/sessions.ts)

```typescript
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

### 3. Apply Database Migration

```bash
psql -U postgres -d transcend_law < \
  src/database/migrations/003_session_timeout_tracking.sql
```

### 4. Set Environment Variables

```bash
export NODE_ENV=production
export SESSION_SECURITY_LEVEL=default
```

---

## Client-Side Implementation

### Capture Session ID on Login

```javascript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

const data = await response.json();
const sessionId = response.headers.get('X-Session-ID');

localStorage.setItem('accessToken', data.accessToken);
sessionStorage.setItem('sessionId', sessionId);
```

### Monitor Session & Show Warning

```javascript
setInterval(async () => {
  const response = await fetch('/api/sessions/status', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      'X-Session-ID': sessionStorage.getItem('sessionId')
    }
  });

  if (response.status === 401) {
    // Session expired
    window.location.href = '/login';
    return;
  }

  const session = await response.json();
  if (session.shouldWarn) {
    showWarningDialog(
      session.remainingTime,
      () => extendSession(),
      () => logout()
    );
  }
}, 30000);
```

### Extend Session

```javascript
async function extendSession() {
  const response = await fetch('/api/sessions/extend', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      'X-Session-ID': sessionStorage.getItem('sessionId')
    }
  });

  if (response.ok) {
    dismissWarning();
  }
}
```

### Logout

```javascript
async function logout() {
  await fetch('/api/sessions/logout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      'X-Session-ID': sessionStorage.getItem('sessionId')
    }
  });

  localStorage.clear();
  sessionStorage.clear();
  window.location.href = '/login';
}
```

---

## Default Timeouts

```
CLIENT:   15 minutes  (warns at 10 min)
ATTORNEY: 30 minutes  (warns at 25 min)
FIRM:     25 minutes  (warns at 20 min)
ADMIN:    20 minutes  (warns at 15 min)
```

---

## API Reference

### GET /api/sessions/status
```bash
curl -X GET /api/sessions/status \
  -H "Authorization: Bearer TOKEN" \
  -H "X-Session-ID: SESSION_ID"
```

### POST /api/sessions/extend
```bash
curl -X POST /api/sessions/extend \
  -H "Authorization: Bearer TOKEN" \
  -H "X-Session-ID: SESSION_ID"
```

### POST /api/sessions/logout
```bash
curl -X POST /api/sessions/logout \
  -H "Authorization: Bearer TOKEN" \
  -H "X-Session-ID: SESSION_ID"
```

### GET /api/sessions/active
```bash
curl -X GET /api/sessions/active \
  -H "Authorization: Bearer TOKEN"
```

### POST /api/sessions/revoke-all
```bash
curl -X POST /api/sessions/revoke-all \
  -H "Authorization: Bearer TOKEN" \
  -H "X-Session-ID: SESSION_ID"
```

---

## Configuration Options

### Change Timeouts (src/config/sessionTimeoutConfig.ts)

```typescript
const productionConfig: RoleTimeoutConfig = {
  client: {
    inactivityTimeout: 10 * 60 * 1000,    // 10 minutes
    warningTime: 3 * 60 * 1000,           // 3 minutes warning
    extendSessionDuration: 5 * 60 * 1000,
    requireReauth: true
  },
  // ... other roles
};
```

### Security Levels

```bash
# High Security
export SESSION_SECURITY_LEVEL=high

# Default (recommended)
export SESSION_SECURITY_LEVEL=default

# Relaxed
export SESSION_SECURITY_LEVEL=relaxed
```

---

## Response Headers

Every request returns:
```
X-Session-ID: {sessionId}
X-Session-Expires: {timestamp}
X-Session-Remaining: {seconds}
X-Session-Warning: true (if warning threshold reached)
```

---

## Audit Queries

### View All Timeouts
```sql
SELECT * FROM audit_log
WHERE action = 'logout'
AND changes->>'reason' = 'timeout'
ORDER BY created_at DESC;
```

### Logout Statistics
```sql
SELECT 
  changes->>'reason' as reason,
  COUNT(*) as count
FROM audit_log
WHERE action = 'logout'
GROUP BY changes->>'reason';
```

### User Session History
```sql
SELECT * FROM audit_log
WHERE user_id = 'USER_ID'
AND action = 'logout'
ORDER BY created_at DESC;
```

---

## Testing

### Run Tests
```bash
npm test -- sessionTimeout.test.ts
```

### Manual Test Endpoints
```bash
# Create session (via login)
curl -X POST /api/auth/login

# Check status
curl -X GET /api/sessions/status \
  -H "Authorization: Bearer TOKEN" \
  -H "X-Session-ID: SESSION_ID"

# Extend
curl -X POST /api/sessions/extend \
  -H "Authorization: Bearer TOKEN" \
  -H "X-Session-ID: SESSION_ID"

# Logout
curl -X POST /api/sessions/logout \
  -H "Authorization: Bearer TOKEN" \
  -H "X-Session-ID: SESSION_ID"
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Session expires immediately | Check timeout config in sessionTimeoutConfig.ts |
| Warning not showing | Frontend must check `shouldWarn` flag |
| Extension fails | Include `X-Session-ID` header |
| No audit logs | Verify audit_log table exists |
| Session ID missing | Check response headers after login |

---

## File Locations

```
/transcend-api/
├── src/
│   ├── middleware/sessionTimeout.ts        ← Main middleware
│   ├── config/sessionTimeoutConfig.ts      ← Configuration
│   ├── routes/sessions.ts                  ← API routes (create this)
│   └── database/migrations/
│       └── 003_session_timeout_tracking.sql
├── SESSION_TIMEOUT_README.md               ← Full documentation
├── SESSION_TIMEOUT_INTEGRATION.md          ← Integration guide
└── QUICK_REFERENCE.md                      ← This file
```

---

## Requirements Met

✅ Configurable inactivity timeout (default 15 mins)
✅ Warning before logout (5 min)
✅ Option to extend session
✅ Re-authentication required after logout
✅ Audit log of all logouts
✅ Different timeouts per role (admin vs user)

---

## Next Steps

1. Copy `src/routes/sessions.ts` code above
2. Update `src/index.ts` with middleware
3. Run database migration
4. Add environment variables
5. Implement frontend monitoring
6. Test with sample requests
7. Review audit logs

For detailed information, see:
- `SESSION_TIMEOUT_README.md` - Full guide
- `SESSION_TIMEOUT_INTEGRATION.md` - Step-by-step
- `SESSION_TIMEOUT_IMPLEMENTATION_SUMMARY.md` - Overview
