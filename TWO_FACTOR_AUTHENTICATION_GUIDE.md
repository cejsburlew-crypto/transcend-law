# Two-Factor Authentication (2FA) Implementation Guide

## Overview

This guide explains the complete 2FA implementation for the Transcend Legal platform, supporting SMS OTP, Time-based OTP (TOTP/Authenticator apps), and backup codes.

## Features

✅ **Multiple Authentication Methods:**
- Time-based OTP (TOTP) using authenticator apps (Google Authenticator, Authy, etc.)
- SMS-based OTP
- Backup codes for emergency recovery

✅ **Admin Controls:**
- Require 2FA by user type (client, attorney, firm)
- Configurable grace period for enforcement (default: 30 days)
- Audit logging for all 2FA events

✅ **User Experience:**
- Step-by-step guided setup wizard
- QR code scanning for TOTP apps
- Manual entry key option for offline scanning
- Fallback to SMS if primary method unavailable
- Trusted device management

✅ **Security Features:**
- Rate limiting on verification attempts
- Session expiration (10 minutes)
- Backup code single-use enforcement
- Device fingerprinting and trust tokens
- Complete audit trail

## File Structure

```
transcend-api/
├── src/
│   ├── middleware/
│   │   └── twoFactorAuth.ts          # 2FA middleware & utilities
│   ├── services/
│   │   ├── twoFactorService.ts       # TOTP & SMS logic
│   │   └── smsService.ts             # SMS provider integration
│   ├── routes/
│   │   └── twoFactorRoutes.ts        # 2FA API endpoints
│   └── database/
│       └── migrations/
│           └── 007_two_factor_authentication.sql  # DB tables
│
transcend-frontend/
└── src/
    └── components/
        ├── 2FASetup.tsx              # Setup wizard component
        └── 2FASetup.css              # Styling
```

## Database Schema

### Tables Created

1. **user_2fa_settings** - User 2FA configuration
   - Tracks which methods are enabled
   - Stores TOTP secrets and phone numbers
   - Primary method preference

2. **backup_codes** - Recovery codes
   - One-time use codes
   - Tracks usage

3. **sms_otp_sessions** - SMS verification sessions
   - OTP storage with hash
   - Attempt tracking
   - Expiration management

4. **totp_sessions** - TOTP verification sessions
   - Session management for app-based 2FA

5. **two_factor_sessions** - Generic 2FA sessions
   - Unified session tracking

6. **trusted_devices** - Device trust management
   - Device fingerprints
   - Trust tokens
   - Expiration dates

7. **admin_settings** - Admin 2FA policies
   - Per user-type requirements
   - Grace period configuration

8. **two_factor_audit_log** - User-level audit
   - Event tracking
   - Details in JSON format

9. **admin_audit_log** - System-level audit
   - Admin action tracking

## Implementation Steps

### 1. Database Setup

Run the migration:

```bash
psql -U postgres -d transcend_legal < transcend-api/src/database/migrations/007_two_factor_authentication.sql
```

### 2. Environment Configuration

Add to `.env`:

```env
# 2FA Configuration
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# SMS Provider (Twilio)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX

# 2FA Settings
TWO_FA_GRACE_PERIOD_DAYS=30
TWO_FA_SESSION_EXPIRY_MINUTES=10
```

### 3. Install Dependencies

```bash
npm install speakeasy qrcode bcrypt jsonwebtoken
npm install --save-dev @types/speakeasy
```

### 4. Integrate Routes

In `transcend-api/src/index.ts`:

```typescript
import twoFactorRoutes from './routes/twoFactorRoutes';

// Add route
app.use('/api/v2/2fa', twoFactorRoutes);
```

### 5. Integrate Middleware

In your Express app setup:

```typescript
import { twoFactorAuthMiddleware } from './middleware/twoFactorAuth';

// Add middleware after auth middleware
app.use(authMiddleware);
app.use(twoFactorAuthMiddleware);
```

### 6. Frontend Integration

Import and use the component:

```typescript
import TwoFactorSetup from './components/2FASetup';

function AccountSettings() {
  const [show2FASetup, setShow2FASetup] = useState(false);

  if (show2FASetup) {
    return (
      <TwoFactorSetup
        userId={userId}
        onSetupComplete={() => {
          setShow2FASetup(false);
          // Refresh user settings
        }}
        onSkip={() => setShow2FASetup(false)}
      />
    );
  }

  // Regular account settings UI
}
```

## API Endpoints

### TOTP Setup

**POST** `/api/v2/2fa/totp/initialize`
- Initialize TOTP setup
- Returns QR code and manual entry key
- Auth required

**POST** `/api/v2/2fa/totp/verify`
- Verify TOTP code and enable
- Body: `{ userId, code, secret }`
- Auth required

### SMS Setup

**POST** `/api/v2/2fa/sms/send`
- Send SMS OTP to phone number
- Body: `{ userId, phoneNumber }`
- Auth required
- Returns: `{ sessionId, expiresAt }`

**POST** `/api/v2/2fa/sms/verify`
- Verify SMS OTP and enable
- Body: `{ userId, sessionId, code, phoneNumber }`
- Auth required

### Status & Configuration

**GET** `/api/v2/2fa/status`
- Get user's 2FA status
- Returns enabled methods, backup code count, requirement info
- Auth required

**POST** `/api/v2/2fa/set-primary-method`
- Set primary 2FA method (totp or sms)
- Body: `{ userId, method }`
- Auth required

### Backup Codes

**POST** `/api/v2/2fa/backup-codes/generate`
- Generate 10 backup codes
- Body: `{ userId, primaryMethod }`
- Auth required
- Returns: `{ codes: string[] }`

**GET** `/api/v2/2fa/backup-codes/count`
- Get available backup codes count
- Auth required

### Verification

**POST** `/api/v2/2fa/initiate`
- Initiate 2FA verification (create session)
- Returns session info for verification
- Auth required

**POST** `/api/v2/2fa/verify`
- Verify 2FA code (totp, sms, or backup)
- Body: `{ userId, code, method }`
- Returns: `{ verified: true }`

**POST** `/api/v2/2fa/fallback-sms`
- Request fallback SMS if primary method unavailable
- Auth required

### Trusted Devices

**POST** `/api/v2/2fa/trust-device`
- Mark device as trusted (skip 2FA for 30 days)
- Body: `{ deviceFingerprint, deviceName }`
- Auth required

**GET** `/api/v2/2fa/trusted-devices`
- Get list of trusted devices
- Auth required

**DELETE** `/api/v2/2fa/trusted-devices/:deviceId`
- Revoke trusted device
- Auth required

### Audit Log

**GET** `/api/v2/2fa/audit-log`
- Get 2FA audit log for user
- Query params: `?limit=50`
- Auth required

### Admin Endpoints

**POST** `/api/v2/2fa/admin/require-2fa`
- Require 2FA for user type
- Body: `{ userType, required, gracePeriodDays }`
- Admin access required

**GET** `/api/v2/2fa/admin/requirements`
- Get 2FA requirements by user type
- Admin access required

## Usage Flows

### User First-Time Setup

1. User sees 2FA setup prompt
2. User selects method (TOTP or SMS)
3. For TOTP:
   - Scan QR code with authenticator app
   - Enter 6-digit code from app
   - Verify code
4. For SMS:
   - Enter phone number
   - Receive SMS with OTP
   - Enter OTP
   - Verify
5. Generate and save backup codes
6. Complete setup

### Login with 2FA

1. User enters email/password
2. If 2FA enabled:
   - Show verification options (primary method or fallback)
   - User enters code
   - Verify code
   - Issue 2FA-verified token
3. User access to account

### Grace Period Flow

1. Admin requires 2FA for "attorney" user type
2. Existing attorneys get 30-day grace period
3. After 30 days, 2FA becomes required for login
4. During grace period, users see setup prompt but can proceed

### Fallback SMS Flow

1. User tries to verify with primary TOTP method
2. If code fails or TOTP method unavailable:
   - Show option for fallback SMS
   - SMS sent to configured phone
   - User enters SMS code
   - Verification succeeds

## Security Considerations

### Rate Limiting

```typescript
// Implement in verification endpoints
const MAX_VERIFICATION_ATTEMPTS = 3;
const ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes

// Check attempts before verification
if (attempts >= MAX_VERIFICATION_ATTEMPTS) {
  // Block further attempts in window
}
```

### Session Management

- All 2FA sessions expire after 10 minutes
- Sessions are invalidated after successful verification
- Expired sessions are auto-cleaned via database cleanup procedures

### TOTP Security

- Use 32-character base32 encoded secrets
- Window parameter set to 1 (±30 seconds tolerance)
- Generate new secret each time user sets up TOTP

### SMS Security

- OTP hashed before storage
- Rate limit SMS sends to 1 per minute per user
- Use Twilio's Verify API for production (recommended over raw SMS)

### Backup Codes

- 10 alphanumeric codes generated
- Each code hashed before storage
- Single-use enforcement
- Never transmitted unencrypted

## Admin Management

### Setting 2FA Requirements

```bash
curl -X POST http://localhost:3000/api/v2/2fa/admin/require-2fa \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userType": "attorney",
    "required": true,
    "gracePeriodDays": 30
  }'
```

### Viewing Requirements

```bash
curl http://localhost:3000/api/v2/2fa/admin/requirements \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

## Audit Trail Events

### User Events

- `TOTP_ENABLED` - User enabled TOTP
- `SMS_ENABLED` - User enabled SMS
- `BACKUP_CODES_GENERATED` - Backup codes created
- `BACKUP_CODE_USED` - User used a backup code
- `VERIFICATION_SUCCESS` - Successful 2FA verification
- `VERIFICATION_FAILED` - Failed verification attempt
- `DEVICE_TRUSTED` - Device marked as trusted
- `DEVICE_TRUST_REVOKED` - Device trust revoked
- `PRIMARY_METHOD_CHANGED` - Primary method updated
- `SETUP_COMPLETED` - 2FA setup completed

### Admin Events

- `2FA_REQUIREMENT_UPDATED` - Admin changed requirement

## Testing

### Unit Tests

```typescript
import { verifyTOTP, generateSMSOTP } from '../services/twoFactorService';

describe('TOTP Verification', () => {
  it('should verify valid TOTP code', () => {
    const secret = 'JBSWY3DPEBLW64TMMQ======';
    const code = '123456'; // Get from authenticator
    expect(verifyTOTP(secret, code)).toBe(true);
  });
});
```

### Integration Tests

```typescript
describe('2FA Setup Flow', () => {
  it('should complete full TOTP setup', async () => {
    // 1. Initialize setup
    // 2. Verify code
    // 3. Generate backup codes
    // 4. Complete setup
  });
});
```

### Manual Testing

1. **TOTP Setup:**
   - Use `JBSWY3DPEBLW64TMMQ======` as test secret
   - Use Google Authenticator, Authy, or Microsoft Authenticator
   - Verify 6-digit code

2. **SMS Testing:**
   - Use test phone numbers from Twilio (if in sandbox)
   - Or configure test credentials in `.env`

3. **Grace Period:**
   - Create new user with attorney type
   - Require 2FA for attorneys
   - Verify 30-day grace period

## Troubleshooting

### "Invalid OTP" Errors

**Cause:** Time sync issues or TOTP window mismatch
**Solution:**
- Sync device clock with NTP
- Check TOTP window parameter (default: 1)
- Regenerate QR code and rescan

### "SMS Not Received"

**Cause:** Twilio credentials invalid or phone number not in E.164 format
**Solution:**
- Verify Twilio credentials in `.env`
- Ensure phone includes country code
- Check Twilio logs for delivery status

### Grace Period Not Working

**Cause:** Admin settings not configured
**Solution:**
- Run admin API to set requirement
- Check `admin_settings` table
- Verify user creation timestamp

## Performance Optimization

### Database Indexes

All indices are pre-created in migration:
- User ID indexes for fast lookup
- Session ID indexes for quick validation
- Expiration indexes for cleanup queries

### Cleanup Procedures

```sql
-- Call daily via cron job
SELECT cleanup_expired_2fa_sessions();
```

### Caching

Consider caching 2FA settings:

```typescript
// Redis cache example
const cacheKey = `2fa:settings:${userId}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// Fetch and cache
const settings = await get2FASettings(userId);
await redis.setex(cacheKey, 3600, JSON.stringify(settings));
```

## Migration Path for Existing Users

### Phase 1: Opt-in (2 weeks)

- 2FA available but optional
- Users can enable at will

### Phase 2: Recommended (2 weeks)

- Dashboard notifications encourage setup
- "Secure your account" prompts

### Phase 3: Enforcement (with grace period)

- Admin requires 2FA for user types
- Grace period active (default 30 days)

### Phase 4: Mandatory

- Grace period ends
- 2FA required for login

## Support & Monitoring

### Key Metrics

```sql
-- Users with 2FA enabled
SELECT COUNT(*) FROM user_2fa_settings WHERE enabled = true;

-- Failed verification attempts
SELECT COUNT(*) FROM two_factor_audit_log 
WHERE event_type = 'VERIFICATION_FAILED' 
AND created_at > NOW() - INTERVAL '24 hours';

-- Backup codes used
SELECT COUNT(*) FROM two_factor_audit_log
WHERE event_type = 'BACKUP_CODE_USED';
```

### Monitoring Alerts

- Alert on > 10 failed 2FA attempts per user in 1 hour
- Alert on 0 users with 2FA during enforcement phase
- Monitor SMS delivery success rate
- Track TOTP verification success rate

## References

- [RFC 4226: HMAC-Based One-Time Password Algorithm](https://tools.ietf.org/html/rfc4226)
- [RFC 6238: Time-Based One-Time Password Algorithm](https://tools.ietf.org/html/rfc6238)
- [NIST SP 800-63B: Authentication and Lifecycle Management](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [Speakeasy Documentation](https://github.com/speakeasy-js/speakeasy)
- [Twilio Verify API](https://www.twilio.com/verify)
