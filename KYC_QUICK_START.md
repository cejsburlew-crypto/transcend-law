# KYC System Quick Start Guide

## Files Created

### Backend Services
```
transcend-api/src/services/kycService.ts (680 lines)
├── Email verification (Stage 1)
├── Phone verification (Stage 2)
├── Government ID verification (Stage 3)
├── Address verification (Stage 4)
├── Bank account verification (Stage 5)
├── Video call verification (Stage 6)
└── Admin utilities (approve, reject, queue management)
```

### API Routes
```
transcend-api/src/routes/kyc.ts (200+ lines)
├── User endpoints (6 stages)
├── Admin endpoints (review, approve, reject)
├── Status endpoint
└── Maintenance endpoint
```

### Frontend Components
```
transcend-frontend/src/components/
├── KYCVerification.tsx (500+ lines)
│   └── KYCVerification.css (500+ lines)
└── Admin/
    ├── KYCAdminDashboard.tsx (400+ lines)
    └── KYCAdminDashboard.css (400+ lines)
```

### Database
```
transcend-api/src/database/kyc_schema.sql (400+ lines)
├── 7 new tables
├── 3 views
├── 2 functions
└── Triggers & indexes
```

### Documentation
```
KYC_IMPLEMENTATION_GUIDE.md (800+ lines)
KYC_DEPLOYMENT_CHECKLIST.md (600+ lines)
KYC_QUICK_START.md (this file)
```

## Quick Integration (10 minutes)

### Step 1: Add Routes (Backend)
```typescript
// transcend-api/src/index.ts
import kycRoutes from './routes/kyc';

app.use('/api/kyc', kycRoutes);
```

### Step 2: Run Database Migrations
```bash
psql -U transcend_admin -d transcend_law < transcend-api/src/database/kyc_schema.sql
```

### Step 3: Add Frontend Routes
```typescript
// transcend-frontend/src/App.tsx
import KYCVerification from './components/KYCVerification';
import KYCAdminDashboard from './components/Admin/KYCAdminDashboard';

<Route path="/kyc" element={<KYCVerification />} />
<Route path="/admin/kyc" element={<KYCAdminDashboard />} />
```

### Step 4: Configure Environment
```env
# Email
SENDGRID_API_KEY=...
EMAIL_FROM=noreply@transcendlaw.com

# SMS
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...

# S3 (File Storage)
AWS_REGION=us-west-2
AWS_S3_BUCKET=transcend-kyc-documents

# Plaid
PLAID_CLIENT_ID=...
PLAID_SECRET=...
```

### Step 5: Test Flow
1. Start backend: `npm run dev`
2. Start frontend: `npm run dev`
3. Navigate to http://localhost:3000/kyc
4. Complete email verification
5. Complete phone verification
6. Admin: Go to http://localhost:3000/admin/kyc
7. Review and approve documents

## API Quick Reference

### User Endpoints (Authenticated Required)

#### Stage 1: Email
```bash
# Send verification email
curl -X POST http://localhost:4000/api/kyc/email/initiate \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'

# Verify email (uses token from link)
curl -X POST http://localhost:4000/api/kyc/email/verify/TOKEN_FROM_EMAIL
```

#### Stage 2: Phone
```bash
# Send SMS OTP
curl -X POST http://localhost:4000/api/kyc/phone/initiate \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+1 (555) 000-0000"}'

# Verify OTP
curl -X POST http://localhost:4000/api/kyc/phone/verify \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"otp":"123456"}'
```

#### Stage 3: Government ID
```bash
# Upload ID document
# First upload to S3, get URL
curl -X POST http://localhost:4000/api/kyc/government-id/initiate \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "idType":"driver_license",
    "documentUrl":"https://s3.../document.pdf"
  }'
```

#### Stage 4: Address
```bash
curl -X POST http://localhost:4000/api/kyc/address/initiate \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "address":"123 Main Street, City, State 12345",
    "documentUrl":"https://s3.../utility_bill.pdf"
  }'
```

#### Stage 5: Bank Account
```bash
# Link bank account
curl -X POST http://localhost:4000/api/kyc/bank/initiate \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bankAccountToken":"plaid_token_..."}'

# Verify microdeposits (after 2-5 business days)
curl -X POST http://localhost:4000/api/kyc/bank/verify-microdeposits \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amounts":[23, 45]}'
```

#### Stage 6: Video Call
```bash
curl -X POST http://localhost:4000/api/kyc/video/initiate \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json"
```

#### Get Status
```bash
curl http://localhost:4000/api/kyc/status \
  -H "Authorization: Bearer TOKEN"

# Response:
{
  "completedStages": ["email", "phone"],
  "currentStage": "government_id",
  "progress": 33,
  "kyc_completed": false,
  "unlockedFeatures": ["account_access", "basic_search", "messaging", "case_creation"]
}
```

### Admin Endpoints (Admin Auth Required)

#### Get Review Queue
```bash
curl http://localhost:4000/api/kyc/admin/review-queue \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

#### Approve Verification
```bash
curl -X POST http://localhost:4000/api/kyc/admin/approve/VERIFICATION_ID \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

#### Reject Verification
```bash
curl -X POST http://localhost:4000/api/kyc/admin/reject/VERIFICATION_ID \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Document is unclear"}'
```

#### Get Video Call Queue
```bash
curl http://localhost:4000/api/kyc/admin/video-calls \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

#### Complete Video Call
```bash
curl -X POST http://localhost:4000/api/kyc/video/complete/VERIFICATION_ID \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"USER_ID",
    "agentNotes":"Identity verified, documents authentic"
  }'
```

## Database Queries

### Check User KYC Status
```sql
SELECT 
  u.email,
  u.kyc_completed,
  kp.email as stage_email,
  kp.phone as stage_phone,
  kp.government_id,
  kp.address_verification,
  kp.bank_account,
  kp.video_call,
  kp.total_stages_completed as completed_out_of_6
FROM users u
LEFT JOIN kyc_user_progress kp ON u.id = kp.user_id
WHERE u.email = 'user@example.com';
```

### Pending Reviews
```sql
SELECT * FROM kyc_pending_verifications
ORDER BY created_at ASC
LIMIT 20;
```

### Admin Dashboard
```sql
SELECT * FROM kyc_admin_dashboard;
```

### Audit Log
```sql
SELECT * FROM kyc_audit_log
WHERE user_id = 'USER_ID'
ORDER BY created_at DESC;
```

### Feature Access Check
```sql
SELECT has_kyc_access('USER_ID', 'payment_processing') as can_process_payments;
```

## Feature Access Matrix

| Feature | Required Stage | Access Level |
|---------|---|---|
| Account access | Email verified | Basic |
| Basic search | Email verified | Basic |
| Messaging | Phone verified | User |
| Case creation | Phone verified | User |
| Service provider access | Government ID | Professional |
| Higher transaction limits | Government ID | Professional |
| Payment processing | Address verified | Professional |
| Premium features | Bank account | Premium |
| Instant payments | Bank account | Premium |
| Unlimited transactions | Video verified | VIP |
| VIP support | Video verified | VIP |

## Staging Test Flow

### Test User 1: Complete Full KYC
```
Email: testuser@example.com
Phone: +1 (555) 000-0001
ID: Driver License
Address: 123 Main St, San Francisco, CA 94102
Bank: Sandbox account from Plaid
```

### Test User 2: Rejected Document
```
Email: testuser2@example.com
→ Complete Stage 1-2
→ Submit blurry ID (admin should reject)
→ Verify retry possible
```

### Test User 3: Document Resubmission
```
Email: testuser3@example.com
→ Complete Stages 1-2
→ Submit ID (admin rejects)
→ Resubmit with better quality
→ Verify approval
```

## Monitoring & Alerts

### Key Metrics to Monitor
```
1. Email verification completion rate
2. Phone verification completion rate
3. Document rejection rate per stage
4. Average review time
5. Video call wait time
6. System error rate
7. Database query performance
8. API response time (p95, p99)
```

### Sample Monitoring Query
```sql
SELECT 
  stage,
  COUNT(*) as total_submissions,
  COUNT(CASE WHEN status = 'verified' THEN 1 END) as verified,
  COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
  ROUND(
    COUNT(CASE WHEN status = 'verified' THEN 1 END)::NUMERIC 
    / COUNT(*) * 100, 2
  ) as completion_rate,
  ROUND(AVG(EXTRACT(EPOCH FROM (verified_at - created_at)))/3600, 1) as avg_hours_to_verify
FROM kyc_verification
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY stage;
```

## Troubleshooting

### User Can't Complete Email Verification
```sql
-- Check verification record
SELECT * FROM kyc_verification 
WHERE user_id = 'USER_ID' AND stage = 'email'
ORDER BY created_at DESC;

-- Check if expired
SELECT * FROM kyc_verification 
WHERE token = 'TOKEN' AND expires_at > NOW();
```

### Phone OTP Not Received
```sql
-- Check SMS log
SELECT * FROM kyc_verification
WHERE user_id = 'USER_ID' AND stage = 'phone'
ORDER BY created_at DESC;

-- Check attempt count
SELECT COUNT(*) FROM kyc_verification
WHERE user_id = 'USER_ID' 
  AND stage = 'phone'
  AND created_at > NOW() - INTERVAL '1 day';
```

### Admin Review Stuck
```sql
-- Check review queue
SELECT * FROM kyc_admin_review_queue
WHERE status = 'pending'
ORDER BY created_at ASC;

-- Force mark as expired if > 7 days
UPDATE kyc_admin_review_queue
SET status = 'expired'
WHERE status = 'pending' 
  AND created_at < NOW() - INTERVAL '7 days';
```

### Reset User KYC (For Testing)
```sql
-- Reset user
DELETE FROM kyc_verification WHERE user_id = 'USER_ID';
DELETE FROM kyc_user_progress WHERE user_id = 'USER_ID';
DELETE FROM kyc_admin_review_queue WHERE user_id = 'USER_ID';
DELETE FROM kyc_video_call_queue WHERE user_id = 'USER_ID';

UPDATE users 
SET kyc_completed = FALSE, kyc_completed_at = NULL
WHERE id = 'USER_ID';
```

## Performance Optimization

### Database Indexes Created
- `idx_kyc_user_id` - Fast user lookups
- `idx_kyc_status` - Filter by status
- `idx_kyc_expires_at` - Cleanup queries
- `idx_kyc_token` - Token verification
- `idx_review_queue_status` - Admin queue filtering

### Caching Strategy
```typescript
// Cache KYC status per user (30-second TTL)
const kycCache = new Map<string, KYCStatus>();

// Invalidate on update
kycCache.delete(userId);
```

### Query Optimization
- Limit review queue to 50 items
- Use pagination for large result sets
- Index on frequently filtered columns

## Common Customizations

### Change Time Limits
```typescript
// In kycService.ts, STAGE_CONFIG
[KYC_STAGES.STAGE_1_EMAIL]: {
  timeLimit: 48 * 60 * 60 * 1000, // Change to 48 hours
  // ...
}
```

### Change Retry Attempts
```typescript
maxAttempts: 5, // Change from 3 to 5
```

### Add New Stage
```typescript
// 1. Add to KYC_STAGES enum
// 2. Add to STAGE_ORDER array
// 3. Add to STAGE_CONFIG
// 4. Create initiate/verify functions
// 5. Add API route
// 6. Update frontend component
```

## Support & Documentation Links

- **Full Implementation Guide**: `KYC_IMPLEMENTATION_GUIDE.md`
- **Deployment Checklist**: `KYC_DEPLOYMENT_CHECKLIST.md`
- **Database Schema**: `transcend-api/src/database/kyc_schema.sql`
- **API Routes**: `transcend-api/src/routes/kyc.ts`
- **Service Code**: `transcend-api/src/services/kycService.ts`

## Next Steps

1. **Run Database Migrations** (5 min)
   ```bash
   psql -U transcend_admin -d transcend_law < transcend-api/src/database/kyc_schema.sql
   ```

2. **Integrate Backend** (10 min)
   - Add routes to index.ts
   - Test API endpoints

3. **Integrate Frontend** (10 min)
   - Add routes to React Router
   - Update navigation

4. **Configure Integrations** (30 min)
   - Email (Sendgrid)
   - SMS (Twilio)
   - S3 (AWS)
   - Plaid (Bank verification)

5. **Run Tests** (1 hour)
   - Unit tests
   - Integration tests
   - Manual testing

6. **Deploy** (Follow KYC_DEPLOYMENT_CHECKLIST.md)

---

**Version**: 1.0.0  
**Last Updated**: 2026-08-15  
**Status**: Ready for Deployment
