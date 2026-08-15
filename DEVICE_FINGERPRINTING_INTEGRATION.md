# Device Fingerprinting & Session Fingerprinting Integration Guide

## Overview

Comprehensive session fingerprinting system for the Transcend Law platform with:
- Secure device fingerprinting (CPU, GPU, screen resolution, browser)
- IP-based location tracking
- Geo-velocity checks (impossible travel detection)
- Device whitelisting and trust management
- Admin alerts and suspicious activity monitoring
- Comprehensive audit logging

## Architecture

### Components

1. **Middleware Layer** (`deviceFingerprinting.ts`)
   - Fingerprint generation and hashing
   - Device matching
   - Geo-velocity checks
   - Database logging

2. **Database Schema** (`001_device_fingerprinting.sql`)
   - Device fingerprints table
   - Device whitelist
   - Mismatch audit trail
   - Admin alerts
   - Location history
   - Compromise flags

3. **API Routes** (`deviceFingerprintingRoutes.ts`)
   - User device management
   - Security status endpoints
   - Admin management endpoints
   - Mismatch verification

4. **Types** (`types/deviceFingerprinting.ts`)
   - Complete TypeScript interfaces
   - Type-safe fingerprint data

## Implementation Steps

### Step 1: Database Setup

Run the migration to create all necessary tables:

```bash
# Using your database connection
psql -U postgres -h localhost -d transcend_law < transcend-api/src/database/migrations/001_device_fingerprinting.sql
```

Tables created:
- `device_fingerprints` - Stores all device fingerprints
- `device_whitelist` - Trusted devices
- `fingerprint_mismatches` - Audit trail
- `admin_alerts` - Security alerts
- `login_sessions` - Session tracking
- `location_history` - Geographic data
- `device_compromise_flags` - Compromise indicators

### Step 2: Express Setup

Integrate middleware into your Express app:

```typescript
// app.ts or server.ts
import express from 'express';
import { deviceFingerprintingMiddleware } from './src/middleware/deviceFingerprinting';
import deviceFingerprintingRoutes from './src/routes/deviceFingerprintingRoutes';

const app = express();

// Add middleware early in the chain
app.use(express.json());
app.use(deviceFingerprintingMiddleware);

// Register routes
app.use('/api/device', deviceFingerprintingRoutes);

// Add to login endpoint
app.post('/api/auth/login', deviceFingerprintingMiddleware, (req, res) => {
  // Login logic
});
```

### Step 3: Client-Side Integration

Collect fingerprint data before login:

```typescript
// Client: utils/deviceFingerprinting.ts
export interface ClientFingerprint {
  screenResolution: string;
  cpuCores: number;
  timezone: string;
  language: string;
  plugins: string[];
  canvasFingerprint: string;
  webglFingerprint: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export async function collectDeviceFingerprint(): Promise<ClientFingerprint> {
  // Screen resolution
  const screenResolution = `${window.screen.width}x${window.screen.height}`;

  // CPU cores (estimated)
  const cpuCores = navigator.hardwareConcurrency || 1;

  // Timezone
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Language
  const language = navigator.language.split('-')[0];

  // Browser plugins
  const plugins = Array.from(navigator.plugins || [])
    .map(p => p.name)
    .slice(0, 5); // Limit to 5 plugins

  // Canvas fingerprint
  const canvasFingerprint = getCanvasFingerprint();

  // WebGL fingerprint
  const webglFingerprint = getWebGLFingerprint();

  // Geo-location (with permission)
  let latitude, longitude, country;
  try {
    const position = await getCurrentPosition();
    latitude = position.coords.latitude;
    longitude = position.coords.longitude;
  } catch (e) {
    // Geo-location denied, will use IP-based geo
  }

  return {
    screenResolution,
    cpuCores,
    timezone,
    language,
    plugins,
    canvasFingerprint,
    webglFingerprint,
    latitude,
    longitude
  };
}

// Canvas fingerprint generation
function getCanvasFingerprint(): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.textBaseline = 'top';
  ctx.font = '14px "Arial"';
  ctx.fillStyle = '#f60';
  ctx.fillRect(125, 1, 62, 20);
  ctx.fillStyle = '#069';
  ctx.fillText('Browser Fingerprint', 2, 15);

  return canvas.toDataURL();
}

// WebGL fingerprint generation
function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return '';

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    }
    return '';
  } catch (e) {
    return '';
  }
}

function getCurrentPosition(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      position => resolve(position.coords),
      () => reject('Geolocation denied')
    );
  });
}
```

### Step 4: Login Flow Integration

Integrate fingerprinting into your login endpoint:

```typescript
// Login endpoint
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password, fingerprint } = req.body;

    // Validate credentials
    const user = await validateCredentials(email, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Store fingerprint data in body for middleware
    req.body.screenResolution = fingerprint.screenResolution;
    req.body.cpuCores = fingerprint.cpuCores;
    req.body.timezone = fingerprint.timezone;
    req.body.plugins = fingerprint.plugins;
    req.body.canvasFingerprint = fingerprint.canvasFingerprint;
    req.body.webglFingerprint = fingerprint.webglFingerprint;
    req.body.latitude = fingerprint.latitude;
    req.body.longitude = fingerprint.longitude;

    // Middleware will check device fingerprint
    // If suspicious, middleware returns 403

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Device is trusted or matches, send tokens
    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        userType: user.user_type
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});
```

### Step 5: Handle Device Mismatch

If middleware returns 403, trigger re-authentication:

```typescript
// Client: Login handler
async function handleLogin(email: string, password: string) {
  try {
    const fingerprint = await collectDeviceFingerprint();

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fingerprint })
    });

    if (response.status === 403) {
      const data = await response.json();
      // Device mismatch detected
      showMFAVerification(data.suspiciousActivity);
      return;
    }

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('accessToken', data.accessToken);
      redirectToDashboard();
    }
  } catch (error) {
    console.error('Login error:', error);
  }
}

// MFA/Verification flow for device mismatch
async function showMFAVerification(suspiciousFlags: string[]) {
  // Show modal explaining the issue
  const verificationCode = await requestVerificationCode();

  // Send verification
  const response = await fetch('/api/auth/verify-device', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      verificationCode,
      trustDevice: true // User can choose to trust this device
    })
  });

  if (response.ok) {
    redirectToDashboard();
  }
}
```

## API Endpoints

### User Endpoints

#### Get Trusted Devices
```
GET /api/device/trusted-devices
Authorization: Bearer {token}

Response:
{
  "success": true,
  "devices": [
    {
      "id": "uuid",
      "deviceName": "Chrome on MacOS",
      "createdAt": "2026-08-15T10:00:00Z",
      "isActive": true
    }
  ]
}
```

#### Trust Current Device
```
POST /api/device/trust-device
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "deviceName": "My Laptop",
  "fingerprintHash": "sha256hash"
}

Response:
{
  "success": true,
  "message": "Device 'My Laptop' has been added to trusted devices",
  "trustedAt": "2026-08-15T10:00:00Z"
}
```

#### Get Security Status
```
GET /api/device/security-status
Authorization: Bearer {token}

Response:
{
  "success": true,
  "status": {
    "totalDevices": 3,
    "trustedDevices": 2,
    "mismatches24h": 1,
    "lastLogin": "2026-08-15T09:30:00Z",
    "activeCompromiseFlags": 0,
    "riskLevel": "LOW",
    "recommendations": [
      "Your account security status is good. Continue monitoring regularly"
    ]
  }
}
```

#### Get Mismatch History
```
GET /api/device/mismatch-history?limit=50
Authorization: Bearer {token}

Response:
{
  "success": true,
  "count": 5,
  "mismatches": [
    {
      "id": "uuid",
      "ipAddress": "203.0.113.42",
      "reason": "Fingerprint mismatch detected",
      "suspiciousFlags": ["FINGERPRINT_MISMATCH", "IMPOSSIBLE_TRAVEL"],
      "createdAt": "2026-08-15T08:00:00Z"
    }
  ]
}
```

#### Verify Mismatch
```
POST /api/device/verify-mismatch/{mismatchId}
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "trusted": true  // Add device to whitelist if true
}

Response:
{
  "success": true,
  "message": "Device added to trusted list",
  "verifiedAt": "2026-08-15T10:00:00Z"
}
```

#### Report Device Compromise
```
POST /api/device/report-compromise
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "deviceId": "uuid",
  "details": "Suspicious activity detected"
}

Response:
{
  "success": true,
  "message": "Device compromise reported to administrators",
  "reportedAt": "2026-08-15T10:00:00Z",
  "nextSteps": [
    "Change your password immediately",
    "Review recent login activity",
    "Consider enabling two-factor authentication"
  ]
}
```

### Admin Endpoints

#### Get Admin Alerts
```
GET /api/device/admin/alerts?severity=HIGH&limit=100
Authorization: Bearer {admin_token}

Response:
{
  "success": true,
  "count": 10,
  "alerts": [
    {
      "id": "uuid",
      "alertType": "SUSPICIOUS_LOGIN_PATTERN",
      "userId": "uuid",
      "details": { ... },
      "severity": "HIGH",
      "acknowledged": false,
      "createdAt": "2026-08-15T09:00:00Z"
    }
  ]
}
```

#### Get Suspicious Activities
```
GET /api/device/admin/suspicious-activities
Authorization: Bearer {admin_token}

Response:
{
  "success": true,
  "count": 25,
  "activities": [
    {
      "activityType": "mismatch|compromise_flag|admin_alert",
      "userId": "uuid",
      "createdAt": "2026-08-15T09:00:00Z",
      "ipAddress": "203.0.113.42",
      "reason": "FINGERPRINT_MISMATCH",
      "severity": "HIGH"
    }
  ]
}
```

#### Get User Security Status (Admin)
```
GET /api/device/admin/user-security-status/{userId}
Authorization: Bearer {admin_token}

Response:
{
  "success": true,
  "userStatus": { ... },
  "recentMismatches": [ ... ],
  "devices": [ ... ],
  "compromiseFlags": [ ... ]
}
```

## Security Features

### 1. Device Fingerprinting
- SHA256 hashing of combined device attributes
- Captures: CPU cores, screen resolution, browser, timezone, language
- Secure hash comparison on subsequent logins

### 2. Geo-Velocity Checks
- Calculates distance between login locations
- Uses Haversine formula for accurate distance
- Maximum human travel speed: ~900 km/h
- Flags impossible travel patterns

### 3. Device Whitelisting
- Users can trust known devices
- Bypasses re-authentication for trusted devices
- Device can be revoked any time

### 4. Comprehensive Logging
- All mismatches logged with reasons
- Suspicious flags tracked
- IP addresses and locations recorded
- Complete audit trail

### 5. Admin Alerts
- Automatic alerts for suspicious patterns
- 3+ mismatches in 1 hour = HIGH alert
- CRITICAL alerts for device compromises
- Admin dashboard for monitoring

### 6. Compromise Flags
- Tracks: Impossible travel, multiple mismatches, VPN/proxy detection
- Marks devices as suspicious
- Prevents login from compromised devices
- Detailed historical tracking

## Database Views

### user_device_security_status
Shows aggregate security data for each user:
```sql
SELECT * FROM user_device_security_status;
```

### recent_suspicious_activities
Shows all suspicious activities from past 24 hours:
```sql
SELECT * FROM recent_suspicious_activities;
```

## Configuration

### Environment Variables
```bash
# Geo-location service (optional)
GEO_SERVICE_API_KEY=your_key

# Admin notification email
ADMIN_EMAIL=admin@transcend.law

# Session timeout
SESSION_TIMEOUT_MINUTES=30

# Max login attempts before lockout
MAX_LOGIN_ATTEMPTS=5
MAX_LOGIN_ATTEMPTS_WINDOW=15m
```

## Testing

### Test Cases

1. **First Login on Device**
   - Should succeed
   - Device fingerprint stored
   - No mismatch triggered

2. **Same Device, Next Login**
   - Should succeed
   - Fingerprint matched
   - Session created

3. **Different Device**
   - Should fail with 403
   - Mismatch logged
   - Requires re-authentication

4. **Impossible Travel**
   - User logs in from NY
   - User logs in from LA 10 minutes later
   - System flags impossible travel
   - Requires re-authentication

5. **Device Whitelisting**
   - User trusts new device
   - Next login succeeds without re-auth
   - Device added to whitelist

## Monitoring

### Admin Dashboard Queries

```sql
-- Users with highest mismatch count (24h)
SELECT user_id, COUNT(*) as mismatch_count
FROM fingerprint_mismatches
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY user_id
ORDER BY mismatch_count DESC
LIMIT 10;

-- Impossible travel attempts
SELECT * FROM fingerprint_mismatches
WHERE suspicious_flags @> '"IMPOSSIBLE_TRAVEL"'
ORDER BY created_at DESC;

-- Compromised devices
SELECT * FROM device_compromise_flags
WHERE resolved = FALSE AND severity IN ('HIGH', 'CRITICAL');

-- Login patterns by location
SELECT country, COUNT(*) as login_count
FROM location_history
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY country
ORDER BY login_count DESC;
```

## Troubleshooting

### Issue: Legitimate Users Blocked
**Solution**: Review mismatches, verify legitimate logins, add to whitelist

### Issue: High False Positives
**Solution**: Adjust distance threshold or increase time window for geo-velocity check

### Issue: VPN Users Blocked
**Solution**: Allow users to pre-whitelist VPN IP ranges or mark as trusted

## Performance Considerations

- Fingerprint hashing: O(1)
- Geo-velocity check: Query indexed on (user_id, created_at)
- Device matching: Single query with hash index
- Admin alerts: Async insertion, indexed queries
- Cleanup: Use scheduled job for expired sessions

## Security Best Practices

1. **Always hash fingerprints** - Never store raw fingerprint data
2. **Rotate salt regularly** - Change hashing algorithm periodically
3. **Secure geo-location** - Validate against trusted sources
4. **Rate limit login attempts** - Prevent brute force
5. **Monitor admin alerts** - Regular review of security events
6. **Audit trail retention** - Keep minimum 90 days
7. **User privacy** - Allow location data opt-out
8. **HTTPS only** - Encrypt all communication

## References

- [OWASP Device Fingerprinting](https://owasp.org/www-community/attacks/Fingerprinting)
- [Haversine Formula](https://en.wikipedia.org/wiki/Haversine_formula)
- [RFC 6960 - X.509 Certificate](https://tools.ietf.org/html/rfc6960)
