# KYC (Know Your Customer) Progressive Verification System

## Overview

A comprehensive 6-stage progressive verification system designed for Transcend Law Platform with full FinCEN AML/KYC compliance, progressive feature unlocking, admin review queues, and audit logging.

## Architecture

### 6 Verification Stages

Each stage is sequential, time-limited (24 hours), and allows 3 retry attempts:

#### Stage 1: Email Verification (Basic Access)
- **Purpose**: Verify email ownership
- **Method**: OTP link sent via email
- **Unlocks**: Account access, basic search
- **Time Limit**: 24 hours
- **Attempts**: 3

#### Stage 2: Phone Verification (Messaging & Cases)
- **Purpose**: Verify phone number
- **Method**: SMS OTP (6-digit code)
- **Unlocks**: Messaging, case creation
- **Time Limit**: 24 hours
- **Attempts**: 3
- **Prerequisite**: Stage 1 completed

#### Stage 3: Government ID (Service Provider Access)
- **Purpose**: Identity verification (FinCEN Required)
- **Documents**: Driver License or Passport
- **Method**: Document upload + Manual admin review
- **Unlocks**: Service provider access, higher transaction limits
- **Time Limit**: 24 hours
- **Attempts**: 3
- **Prerequisite**: Stage 2 completed
- **Admin Review**: Yes, estimated 24-48 hours

#### Stage 4: Address Verification (Payment Processing)
- **Purpose**: Address verification (FinCEN Required)
- **Documents**: Utility bill or government document
- **Method**: Document upload + Manual admin review
- **Unlocks**: Payment processing
- **Time Limit**: 24 hours
- **Attempts**: 3
- **Prerequisite**: Stage 3 completed
- **Admin Review**: Yes, estimated 24-48 hours

#### Stage 5: Bank Account Verification (Premium Features)
- **Purpose**: Bank account verification (FinCEN Required)
- **Method**: Plaid integration with microdeposit verification
- **Unlocks**: Premium features, instant payments
- **Time Limit**: 24 hours
- **Attempts**: 3
- **Prerequisite**: Stage 4 completed
- **Microdeposits**: 2-5 business days

#### Stage 6: Video Call Verification (Full Access)
- **Purpose**: Final verification with human agent
- **Method**: Live video call (5-10 minutes)
- **Unlocks**: Unlimited transactions, VIP support
- **Time Limit**: 24 hours
- **Attempts**: 3
- **Prerequisite**: Stage 5 completed
- **Admin Review**: Video agent verification

## File Structure

```
transcend-api/src/
├── services/
│   └── kycService.ts                 # Core KYC logic (6 stages)
├── routes/
│   └── kyc.ts                        # API endpoints
└── database/
    └── kyc_schema.sql                # Database schema & migrations

transcend-frontend/src/
└── components/
    ├── KYCVerification.tsx           # Main UI component
    └── KYCVerification.css           # Styling
```

## Database Schema

### Tables

#### `kyc_verification`
Main verification records table tracking all 6 stages.

**Columns:**
- `id`: UUID (Primary Key)
- `user_id`: UUID (References users)
- `stage`: VARCHAR (email, phone, government_id, address_verification, bank_account, video_call)
- `email`: VARCHAR (for email stage)
- `phone_number`: VARCHAR (for phone stage)
- `otp`: VARCHAR (SMS OTP)
- `id_type`: VARCHAR (driver_license, passport)
- `document_url`: TEXT (S3/storage URL)
- `address`: TEXT (for address stage)
- `bank_token`: TEXT (Plaid token)
- `status`: VARCHAR (pending, pending_review, verified, rejected, expired)
- `token`: VARCHAR (verification link token)
- `expires_at`: TIMESTAMP (24-hour expiration)
- `verified_at`: TIMESTAMP
- `attempt_number`: INT (1-3, tracks retry attempts)
- `reviewed_by`: UUID (admin user who reviewed)
- `rejection_reason`: TEXT
- `notes`: TEXT (admin/agent notes)
- `created_at`: TIMESTAMP

#### `kyc_user_progress`
Tracks completion status of all 6 stages per user.

**Columns:**
- `id`: UUID
- `user_id`: UUID (UNIQUE, References users)
- `email`: BOOLEAN
- `phone`: BOOLEAN
- `government_id`: BOOLEAN
- `address_verification`: BOOLEAN
- `bank_account`: BOOLEAN
- `video_call`: BOOLEAN
- `kyc_completed`: BOOLEAN (auto-updated when all 6 complete)
- `kyc_completed_at`: TIMESTAMP
- `total_stages_completed`: INT (generated/stored, for performance)
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

#### `kyc_admin_review_queue`
Admin review assignment queue for manual document verification.

**Columns:**
- `id`: UUID
- `user_id`: UUID
- `verification_id`: UUID (References kyc_verification)
- `stage`: VARCHAR
- `status`: VARCHAR (pending, in_progress, approved, rejected, expired)
- `assigned_to`: UUID (admin user)
- `assigned_at`: TIMESTAMP
- `created_at`: TIMESTAMP
- `completed_at`: TIMESTAMP

#### `kyc_video_call_queue`
Scheduling queue for video call verifications.

**Columns:**
- `id`: UUID
- `user_id`: UUID
- `status`: VARCHAR (pending, scheduled, in_progress, completed, cancelled)
- `scheduled_at`: TIMESTAMP
- `scheduled_for_time`: TIMESTAMP
- `duration_minutes`: INT
- `assigned_agent_id`: UUID
- `video_room_id`: VARCHAR
- `video_meeting_url`: TEXT
- `created_at`: TIMESTAMP
- `started_at`: TIMESTAMP
- `completed_at`: TIMESTAMP

#### `kyc_audit_log`
Compliance audit log (FinCEN requirements).

**Columns:**
- `id`: UUID
- `user_id`: UUID
- `stage`: VARCHAR
- `event`: VARCHAR (initiated, completed, approved_by_admin, rejected_by_admin, etc)
- `metadata`: JSONB
- `ip_address`: INET
- `user_agent`: TEXT
- `created_at`: TIMESTAMP

#### `kyc_documents`
Document metadata and extraction results.

**Columns:**
- `id`: UUID
- `user_id`: UUID
- `verification_id`: UUID
- `document_type`: VARCHAR
- `file_url`: TEXT
- `file_name`: VARCHAR
- `file_size`: INT
- `file_hash`: VARCHAR (for dedup)
- `extracted_data`: JSONB (OCR results)
- `status`: VARCHAR
- `uploaded_at`: TIMESTAMP
- `verified_at`: TIMESTAMP

#### `kyc_sanctions_check`
PEP/OFAC sanctions list checking.

**Columns:**
- `id`: UUID
- `user_id`: UUID
- `check_type`: VARCHAR (pep, ofac, worldcheck)
- `status`: VARCHAR (pending, clear, match_found, manual_review_required)
- `result`: JSONB
- `checked_at`: TIMESTAMP
- `created_at`: TIMESTAMP

### Views

- **`kyc_status_overview`**: User KYC completion status
- **`kyc_pending_verifications`**: All pending verifications with time until expiry
- **`kyc_admin_dashboard`**: Admin metrics (pending reviews, video calls, alerts)

### Functions

- **`has_kyc_access(user_id, feature)`**: Check if user has access to feature
- **`get_kyc_percentage(user_id)`**: Get KYC completion percentage

## API Endpoints

### User Endpoints (Authenticated)

#### Stage 1: Email
```
POST /api/kyc/email/initiate
  { email: "user@example.com" }
  -> { success: true, verificationId: "...", message: "..." }

POST /api/kyc/email/verify/:token
  -> { success: true, userId: "...", message: "..." }
```

#### Stage 2: Phone
```
POST /api/kyc/phone/initiate
  { phoneNumber: "+1 (555) 000-0000" }
  -> { success: true, verificationId: "...", expiresIn: 600 }

POST /api/kyc/phone/verify
  { otp: "123456" }
  -> { success: true, userId: "...", message: "..." }
```

#### Stage 3: Government ID
```
POST /api/kyc/government-id/initiate
  { idType: "driver_license" | "passport", documentUrl: "s3://..." }
  -> { success: true, verificationId: "...", estimatedReviewTime: "24-48 hours" }
```

#### Stage 4: Address Verification
```
POST /api/kyc/address/initiate
  { address: "123 Main St...", documentUrl: "s3://..." }
  -> { success: true, verificationId: "...", estimatedReviewTime: "24-48 hours" }
```

#### Stage 5: Bank Account
```
POST /api/kyc/bank/initiate
  { bankAccountToken: "plaid_token_..." }
  -> { success: true, message: "Check for microdeposits..." }

POST /api/kyc/bank/verify-microdeposits
  { amounts: [23, 45] }
  -> { success: true, message: "Bank account verified" }
```

#### Stage 6: Video Call
```
POST /api/kyc/video/initiate
  -> { success: true, verificationId: "...", estimatedWaitTime: "2-4 hours" }
```

#### Status
```
GET /api/kyc/status
  -> {
    completedStages: ["email", "phone"],
    currentStage: "government_id",
    progress: 33,
    kyc_completed: false,
    unlockedFeatures: ["account_access", "basic_search", "messaging", "case_creation"]
  }
```

### Admin Endpoints (Admin-only)

```
GET /api/kyc/admin/review-queue
  -> [{ id: "...", user_id: "...", stage: "government_id", status: "pending" }, ...]

POST /api/kyc/admin/approve/:verificationId
  -> { success: true, message: "Verification approved" }

POST /api/kyc/admin/reject/:verificationId
  { reason: "Document unclear" }
  -> { success: true, message: "Verification rejected" }

GET /api/kyc/admin/video-calls
  -> [{ id: "...", user_id: "...", status: "pending" }, ...]

POST /api/kyc/video/complete/:verificationId
  { userId: "...", agentNotes: "..." }
  -> { success: true, message: "Video verification completed" }

POST /api/kyc/maintenance/cleanup-expired
  -> { success: true, message: "Expired verifications cleaned up" }
```

## Service Implementation

### Core Functions

#### `initiateEmailVerification(userId, email)`
- Generates verification token
- Stores in database with 24-hour expiration
- Sends verification email
- Tracks attempt number

#### `verifyEmail(token)`
- Validates token and expiration
- Updates verification status
- Updates user KYC progress
- Logs event for compliance

#### `initiatePhoneVerification(userId, phoneNumber)`
- Checks Stage 1 completion (prerequisite)
- Generates 6-digit OTP
- Stores OTP with 10-minute expiration
- Sends SMS (Twilio integration needed)
- Tracks attempt number

#### `verifyPhoneOTP(userId, otp)`
- Validates OTP and expiration
- Updates verification status
- Updates user KYC progress
- Logs event

#### `initiateGovernmentIDVerification(userId, idType, documentUrl)`
- Checks Stage 2 completion
- Stores document for manual review
- Adds to admin review queue
- Estimated 24-48 hours

#### `initiateAddressVerification(userId, address, documentUrl)`
- Checks Stage 3 completion
- Stores document for manual review
- Adds to admin review queue
- Estimated 24-48 hours

#### `initiateBankAccountVerification(userId, bankAccountToken)`
- Checks Stage 4 completion
- Integrates with Plaid for bank linking
- Initiates microdeposit process

#### `verifyBankAccountMicrodeposits(userId, amounts)`
- Verifies microdeposit amounts
- Completes bank verification

#### `initiateVideoVerification(userId)`
- Checks Stage 5 completion
- Schedules with video call agent
- Adds to video call queue

#### `completeVideoVerification(userId, verificationId, agentNotes)`
- Marks final stage as verified
- Sets `kyc_completed = true` on user
- Logs agent notes for compliance

#### `getUserKYCStatus(userId)`
Returns:
```typescript
{
  completedStages: string[],
  currentStage: string,
  progress: number (0-100),
  kyc_completed: boolean,
  kyc_completed_at?: string,
  unlockedFeatures: string[]
}
```

#### `getAdminReviewQueue()`
Returns pending document reviews.

#### `approveVerification(verificationId, reviewedBy)`
- Approves document
- Updates user progress
- Sends approval email

#### `rejectVerification(verificationId, reviewedBy, reason)`
- Rejects document
- Sends rejection email with reason
- User can retry

#### `cleanupExpiredVerifications()`
Scheduled job to:
- Mark expired verifications as 'expired'
- Clean up old review queue items

### Feature Access Control

Use database function `has_kyc_access(user_id, feature)`:

```sql
SELECT has_kyc_access(user_id, 'payment_processing') as can_process_payments;
```

## Frontend Component

### KYCVerification.tsx

**Features:**
- Progressive stage navigation
- Real-time status updates (every 30 seconds)
- Form validation per stage
- File upload handling
- OTP input with masking
- Microdeposit verification
- Admin controls (admin panel)
- Compliance notifications
- Feature unlock display

**Props:** None (uses authentication context)

**State Management:**
- `status`: Current KYC status
- `currentStageView`: Which stage to display
- `loading`: Form submission state
- `error`/`success`: Messages

**Key Methods:**
- `fetchKYCStatus()`: Get current progress
- `handleEmailVerification()`: Submit email
- `handlePhoneVerification()`: Send OTP
- `handlePhoneOTPVerify()`: Verify OTP
- `handleIDDocumentUpload()`: Submit ID
- `handleAddressVerification()`: Submit address
- `handleBankAccountLink()`: Link bank
- `handleMicrodepositVerify()`: Verify amounts
- `handleVideoVerification()`: Schedule video

### Styling

**CSS Variables:**
- Primary color: `#2196f3` (blue)
- Success color: `#4caf50` (green)
- Alert color: `#ffc107` (yellow)
- Error color: `#c62828` (red)

**Responsive:**
- Desktop (1200px+): 3-column grid
- Tablet (768px): 2-column grid
- Mobile: 1-column grid

## FinCEN & AML/KYC Compliance

### Regulatory Framework

This system implements FinCEN requirements (31 CFR Chapter X):

1. **Customer Identification Program (CIP)**
   - Stages 1-4 collect required identifying information
   - Customer name, address, DOB
   - Government-issued ID

2. **Customer Due Diligence (CDD)**
   - Understanding customer's nature/purpose
   - Business type and activities

3. **Beneficial Ownership**
   - For corporate accounts
   - Ultimate beneficial owners

4. **Ongoing Monitoring**
   - Suspicious activity detection
   - Transaction monitoring (future phase)

### Data Collection Map

| FinCEN Requirement | Stage | Data Collected |
|---|---|---|
| Name | Email/Profile | First name, Last name |
| DOB | Government ID | From ID document |
| Address | Address Verification | Full address verified |
| ID Proof | Government ID | Driver license or Passport |
| Tax ID | Bank Account | Will collect on bank link |
| Beneficial Owners | Bank Account | Entity structure |

### Audit Trail

All KYC activities logged in `kyc_audit_log`:
- Who performed action
- What action (initiated, verified, approved, rejected)
- When (timestamp)
- IP address and user agent
- Stage and result

### Data Security

- Documents encrypted at rest (S3 SSE)
- Encrypted in transit (TLS 1.3)
- No PII in logs (except audit trail)
- Access controls (admin only)
- Data retention policy (5+ years for compliance)

### SAR (Suspicious Activity Report)

Flag users for SAR if:
- Multiple rejections
- Suspicious documents
- PEP/OFAC match
- Unusual patterns
- Manual admin flagging

## Integration Points

### Required Integrations

1. **Email Service** (Already implemented)
   - Send verification emails
   - Send rejection emails

2. **SMS Service** (Twilio/Vonage)
   ```typescript
   // TODO: Implement in emailService.ts
   sendSMS(phoneNumber, otp)
   ```

3. **Document Storage** (S3)
   - Upload and store ID documents
   - Upload and store address proofs

4. **Plaid** (Bank verification)
   - Link bank accounts
   - Verify microdeposits
   ```typescript
   // TODO: Integrate Plaid API
   plaid.linkToken.create()
   plaid.institutions.getById()
   ```

5. **Video Call Service** (Zoom/Vonage)
   - Schedule video calls
   - Generate meeting links
   - Record sessions (compliance)
   ```typescript
   // TODO: Implement video scheduling
   ```

6. **OCR Service** (AWS Textract / Google Vision)
   - Extract data from ID documents
   - Validate document authenticity
   ```typescript
   // TODO: Implement document extraction
   ```

## Database Migrations

### Initial Setup

```bash
# 1. Run KYC schema
psql -U transcend_admin -d transcend_law -f transcend-api/src/database/kyc_schema.sql

# 2. Update users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_completed_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMP;

# 3. Verify tables exist
\dt kyc_*
```

## Configuration

### Environment Variables

```env
# Email
SENDGRID_API_KEY=...
EMAIL_FROM=noreply@transcendlaw.com

# SMS (Twilio)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...

# File Storage (S3)
AWS_REGION=us-west-2
AWS_S3_BUCKET=transcend-kyc-documents

# Plaid
PLAID_CLIENT_ID=...
PLAID_SECRET=...

# Video Calls (Zoom)
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...

# App URLs
APP_URL=https://transcendlaw.com
KYC_REDIRECT_URL=https://transcendlaw.com/kyc

# FinCEN (for reporting)
FINCEN_REPORTING_EMAIL=compliance@transcendlaw.com
```

## Testing

### Unit Tests

```typescript
// tests/kycService.test.ts
describe('KYC Service', () => {
  describe('Stage 1: Email', () => {
    it('should initiate email verification', async () => { ... });
    it('should verify email token', async () => { ... });
    it('should reject expired token', async () => { ... });
  });

  describe('Stage 2: Phone', () => {
    it('should initiate phone verification', async () => { ... });
    it('should verify OTP', async () => { ... });
    it('should reject invalid OTP', async () => { ... });
  });

  // ... more tests
});
```

### Manual Testing

1. **Full KYC Flow**
   - Create test user
   - Complete all 6 stages
   - Verify progress updates
   - Check admin queue

2. **Retry Logic**
   - Submit 3 times in 24 hours
   - Verify 4th attempt rejected
   - Wait 24 hours, verify reset

3. **Admin Review**
   - Submit document
   - Admin approves
   - Verify progress updated
   - Check audit log

4. **Feature Access**
   - Check feature gates per stage
   - Verify unlocked features match

## Maintenance & Operations

### Scheduled Jobs

```typescript
// Run daily at 2 AM UTC
import schedule from 'node-schedule';

schedule.scheduleJob('0 2 * * *', async () => {
  await kycService.cleanupExpiredVerifications();
});
```

### Monitoring

Track in metrics:
- Average verification time per stage
- Rejection rate per stage
- Completion rate
- Admin queue length
- Video call wait time

### Compliance Reporting

### Monthly Report

```typescript
// Generate monthly KYC compliance report
const report = await queryAdminDashboard();
// Send to compliance@transcendlaw.com
```

## Rollout Plan

### Phase 1: Backend Implementation
- [ ] Deploy KYC service
- [ ] Deploy KYC routes
- [ ] Run database migrations
- [ ] Set up integrations (Email, SMS, S3, Plaid)

### Phase 2: Frontend Implementation
- [ ] Deploy KYC component
- [ ] Test all 6 stages
- [ ] Admin panel integration

### Phase 3: Admin Tools
- [ ] Admin review dashboard
- [ ] Video call scheduling
- [ ] Compliance reporting

### Phase 4: Full Rollout
- [ ] Internal testing (team)
- [ ] Beta testing (selected users)
- [ ] Production deployment
- [ ] Monitor and optimize

## Support & Documentation

### User Documentation
- KYC FAQ
- Troubleshooting guides
- Feature unlock guide

### Admin Documentation
- Review process guide
- Escalation procedures
- Compliance audit procedures

### Developer Documentation
- API documentation
- Integration guides
- Database schema docs

## Troubleshooting

### Common Issues

**Issue**: User gets "Too many attempts"
- **Cause**: Exceeded 3 attempts in 24 hours
- **Solution**: Wait 24 hours or admin reset

**Issue**: Email verification link not received
- **Cause**: Spam filter, wrong email
- **Solution**: Check spam, resend email

**Issue**: Microdeposits not received
- **Cause**: Bank processing delay (2-5 business days)
- **Solution**: Wait or check account

**Issue**: Video call scheduling fails
- **Cause**: Agent not available
- **Solution**: Try again later

## Future Enhancements

1. **Transaction Monitoring**
   - Flag unusual transaction patterns
   - Automated SAR generation

2. **Document Liveness**
   - Prevent fake/photoshopped documents
   - Selfie with ID verification

3. **Advanced Analytics**
   - Risk scoring per user
   - Fraud detection ML model

4. **Mobile App Integration**
   - Native camera for document upload
   - Biometric authentication

5. **International Support**
   - Multi-language forms
   - International ID types
   - Global compliance (GDPR, etc)

6. **Continuous KYC**
   - Re-verification requirements
   - Risk reassessment

## Support

For questions or issues:
- Developer: `/transcend-api/docs/KYC.md`
- Admin: `/admin/kyc-dashboard`
- User: `/help/kyc-faq`

---

**Last Updated**: 2026-08-15  
**Compliance**: FinCEN 31 CFR Chapter X  
**Version**: 1.0.0
