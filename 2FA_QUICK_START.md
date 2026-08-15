# 2FA Quick Start Guide

## 5-Minute Setup

### 1. Database Setup (1 minute)

```bash
# Run migration
psql -U postgres -d transcend_legal < transcend-api/src/database/migrations/007_two_factor_authentication.sql
```

### 2. Environment Configuration (1 minute)

Add to `.env`:

```env
# SMS Provider (Twilio)
TWILIO_ACCOUNT_SID=your-sid
TWILIO_AUTH_TOKEN=your-token
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
```

### 3. Install Dependencies (1 minute)

```bash
cd transcend-api
npm install speakeasy qrcode
```

### 4. Integrate Routes (1 minute)

In `transcend-api/src/index.ts`:

```typescript
import twoFactorRoutes from './routes/twoFactorRoutes';

app.use('/api/v2/2fa', twoFactorRoutes);
```

### 5. Add Middleware (1 minute)

```typescript
import { twoFactorAuthMiddleware } from './middleware/twoFactorAuth';

app.use(authMiddleware);
app.use(twoFactorAuthMiddleware);
```

## Frontend Integration

### Basic Usage

```typescript
import TwoFactorSetup from './components/2FASetup';

function AccountSettings() {
  return (
    <TwoFactorSetup
      userId={userId}
      onSetupComplete={() => console.log('Setup complete')}
    />
  );
}
```

## Testing 2FA

### Test TOTP

1. Copy test secret: `JBSWY3DPEBLW64TMMQ======`
2. Open Google Authenticator / Authy
3. Add account manually
4. Use 6-digit code for verification

### Test SMS

1. Configure Twilio test credentials in `.env`
2. Use test phone number
3. OTP will be printed to console in development

### Test Backup Codes

1. Complete TOTP/SMS setup
2. Copy backup codes
3. Use during verification if primary method fails

## Admin Commands

### Enable 2FA for Attorneys

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

### Check Requirements

```bash
curl http://localhost:3000/api/v2/2fa/admin/requirements \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

### View User Audit Log

```bash
curl http://localhost:3000/api/v2/2fa/audit-log \
  -H "Authorization: Bearer USER_TOKEN"
```

## Common Issues

| Issue | Solution |
|-------|----------|
| "Invalid OTP" | Sync device clock with NTP |
| "SMS not received" | Check Twilio credentials |
| Grace period not working | Run admin require-2fa endpoint |
| QR code won't scan | Use manual entry key instead |

## File Reference

| File | Purpose |
|------|---------|
| `twoFactorAuth.ts` | Middleware & utilities |
| `twoFactorService.ts` | TOTP & SMS logic |
| `twoFactorRoutes.ts` | API endpoints |
| `smsService.ts` | SMS provider integration |
| `2FASetup.tsx` | Frontend component |
| `2FASetup.css` | Styling |
| `007_two_factor_authentication.sql` | Database tables |

## Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v2/2fa/totp/initialize` | Start TOTP setup |
| POST | `/api/v2/2fa/totp/verify` | Verify TOTP code |
| POST | `/api/v2/2fa/sms/send` | Send SMS OTP |
| POST | `/api/v2/2fa/sms/verify` | Verify SMS OTP |
| GET | `/api/v2/2fa/status` | Get 2FA status |
| POST | `/api/v2/2fa/verify` | Verify code during login |
| GET | `/api/v2/2fa/audit-log` | View audit trail |

## Security Checklist

- ✅ TOTP secrets hashed and stored securely
- ✅ SMS OTPs sent over HTTPS only
- ✅ Session expiration set to 10 minutes
- ✅ Backup codes single-use enforced
- ✅ Rate limiting on verification attempts
- ✅ Audit log for all 2FA events
- ✅ Device trust with 30-day tokens
- ✅ Admin controls per user type

## Next Steps

1. Test full setup flow in development
2. Deploy database migration
3. Deploy API and routes
4. Integrate frontend component
5. Configure admin 2FA requirements
6. Monitor audit logs
7. Collect user feedback
8. Plan for enforcement phase

## Support

For questions or issues:
1. Check `TWO_FACTOR_AUTHENTICATION_GUIDE.md` for detailed docs
2. Review API endpoint descriptions in `twoFactorRoutes.ts`
3. Check database schema in migration file
4. Review error messages in browser console and server logs
