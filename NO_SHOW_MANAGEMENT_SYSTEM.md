# No-Show Tracking & Consequences System

## Overview

Complete no-show management system for Transcend Law platform with auto-detection, escalating fees, account consequences, notifications, and appeal process.

## System Architecture

### Backend Service (`noShowService.ts`)
- **Location**: `/transcend-api/services/noShowService.ts`
- **Type**: TypeScript service with Stripe integration
- **Dependencies**: 
  - PostgreSQL database
  - Stripe API for payment processing
  - Email notification service

### Frontend Component (`NoShowWarning.tsx`)
- **Location**: `/transcend-frontend/src/components/NoShowWarning.tsx`
- **Type**: React functional component with TypeScript
- **Features**: Metrics display, history tracking, appeal submission, account action monitoring

### Styling (`NoShowWarning.css`)
- **Location**: `/transcend-frontend/src/components/NoShowWarning.css`
- **Features**: Responsive design, dark/light mode support, mobile-optimized

## Core Features

### 1. Auto-Detection of No-Shows
```typescript
autoDetectNoShows(): Promise<number>
```
- Scans appointments scheduled in the past without completion
- Auto-creates no-show records
- Can be run as scheduled background job
- Detects within 24-hour window of scheduled time

**Triggers**: Daily cron job or manual API call

### 2. Escalating Fee Structure
```
1st No-Show:  $0 (Free)
2nd No-Show:  $25
3rd+ No-Show: $50 each
```

**Implementation**:
- `calculateNoShowFee(noShowCount: number): number` - Calculates fee based on count
- Fee charged automatically via Stripe
- Payment processed on confirmation
- Refundable through appeal process

### 3. Escalating Consequences

#### Account Status Progression
```
3 No-Shows   → Account Warning (notification)
5 No-Shows   → Account Suspension (30 days, no new appointments)
10 No-Shows  → Account Termination (permanent, admin review needed)
```

**Implementation**:
- `triggerAccountAction(clientId: string)` - Auto-triggers at thresholds
- `getAccountActions(clientId: string)` - Retrieve active actions
- 30-day appeal window for suspensions/terminations

### 4. Notification System

**Multi-channel notifications**:
- Database notifications (in-app)
- Email notifications (background job)
- Real-time alerts for suspended/terminated accounts

**Notification Types**:
- `no_show_detected` - No-show recorded
- `fee_charged` - Fee applied
- `account_warning` - Warning issued
- `account_suspended` - Account suspended
- `account_terminated` - Account terminated
- `appeal_approved` - Appeal accepted
- `appeal_denied` - Appeal rejected

**Functions**:
```typescript
sendNoShowNotification(clientId, noShowId, type, title, message)
getClientNotifications(clientId, unreadOnly?)
markNotificationAsRead(notificationId)
```

### 5. Appeal Process

**Timeline**:
1. Client submits appeal with reason + supporting docs
2. Admin team reviews within 5 business days
3. Decision notification sent
4. If approved: fee waived, status updated, refund processed

**Functions**:
```typescript
submitNoShowAppeal(noShowId, clientId, reason, supportingDocuments)
reviewNoShowAppeal(appealId, approved, reviewedBy, resolutionNotes)
getNoShowAppeals(clientId, status?)
```

**Appeal Statuses**: `submitted` | `under_review` | `approved` | `denied`

**Appeal Window**: 30 days from action effective date

### 6. Refund Policy

**Automatic Refunds** (on approved appeals):
- Full fee refund via Stripe
- Funds appear in 3-5 business days
- Refund tracked in system

**Manual Refunds** (admin):
```typescript
issueRefund(noShowId, clientId, refundReason, refundAmount)
getRefundPolicies(clientId)
```

**Refund Statuses**: `pending` | `processed` | `failed`

## Database Schema

### Required Tables

```sql
-- No-Show Records
CREATE TABLE no_shows (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL,
  provider_id UUID NOT NULL,
  appointment_id UUID NOT NULL,
  appointment_date TIMESTAMP NOT NULL,
  no_show_date TIMESTAMP NOT NULL,
  no_show_reason TEXT,
  detection_method VARCHAR(50),
  fee DECIMAL(10,2),
  fee_status VARCHAR(50),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (client_id) REFERENCES users(id),
  FOREIGN KEY (provider_id) REFERENCES users(id)
);

-- Client Metrics
CREATE TABLE client_no_show_metrics (
  id UUID PRIMARY KEY,
  client_id UUID UNIQUE NOT NULL,
  total_no_shows INT DEFAULT 0,
  current_month INT DEFAULT 0,
  last_30_days INT DEFAULT 0,
  last_90_days INT DEFAULT 0,
  total_fees_charged DECIMAL(10,2) DEFAULT 0,
  total_fees_pending DECIMAL(10,2) DEFAULT 0,
  account_status VARCHAR(50) DEFAULT 'active',
  last_no_show_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (client_id) REFERENCES users(id)
);

-- No-Show Fees
CREATE TABLE no_show_fees (
  id UUID PRIMARY KEY,
  no_show_id UUID NOT NULL,
  client_id UUID NOT NULL,
  amount DECIMAL(10,2),
  fee_level INT,
  currency VARCHAR(10),
  charge_id VARCHAR(255),
  status VARCHAR(50),
  charged_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (no_show_id) REFERENCES no_shows(id),
  FOREIGN KEY (client_id) REFERENCES users(id)
);

-- Account Actions (Warning/Suspension/Termination)
CREATE TABLE account_actions (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL,
  action_type VARCHAR(50),
  trigger_threshold INT,
  reason TEXT,
  status VARCHAR(50),
  effective_date TIMESTAMP,
  expiry_date TIMESTAMP,
  appeal_window_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (client_id) REFERENCES users(id)
);

-- No-Show Appeals
CREATE TABLE no_show_appeals (
  id UUID PRIMARY KEY,
  no_show_id UUID,
  account_action_id UUID,
  client_id UUID NOT NULL,
  reason TEXT,
  supporting_documents JSONB,
  status VARCHAR(50),
  reviewed_by UUID,
  resolution_notes TEXT,
  submitted_at TIMESTAMP,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (no_show_id) REFERENCES no_shows(id),
  FOREIGN KEY (account_action_id) REFERENCES account_actions(id),
  FOREIGN KEY (client_id) REFERENCES users(id)
);

-- Refund Policies
CREATE TABLE no_show_refund_policies (
  id UUID PRIMARY KEY,
  no_show_id UUID NOT NULL,
  client_id UUID NOT NULL,
  original_fee DECIMAL(10,2),
  refund_amount DECIMAL(10,2),
  refund_reason TEXT,
  refund_status VARCHAR(50),
  processed_date TIMESTAMP,
  refund_transaction_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (no_show_id) REFERENCES no_shows(id),
  FOREIGN KEY (client_id) REFERENCES users(id)
);

-- Notifications
CREATE TABLE no_show_notifications (
  id UUID PRIMARY KEY,
  client_id UUID NOT NULL,
  no_show_id UUID,
  account_action_id UUID,
  notification_type VARCHAR(100),
  title VARCHAR(255),
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (client_id) REFERENCES users(id)
);

-- Audit Log
CREATE TABLE no_show_audit_log (
  id UUID PRIMARY KEY,
  no_show_id UUID,
  action VARCHAR(100),
  user_id UUID,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (no_show_id) REFERENCES no_shows(id)
);
```

## API Endpoints

### No-Show Recording
```
POST /api/v2/no-shows
  - recordNoShow(clientId, providerId, appointmentId, appointmentDate, detectionMethod, reason)
  - Returns: NoShowRecord

POST /api/v2/no-shows/detect
  - autoDetectNoShows()
  - Returns: { detectedCount: number }

GET /api/v2/no-shows/client/:clientId
  - Get all no-shows for client
  - Returns: NoShowRecord[]
```

### Metrics
```
GET /api/v2/no-shows/metrics/:clientId
  - getClientNoShowMetrics(clientId)
  - Returns: ClientNoShowMetrics

PUT /api/v2/no-shows/metrics/:clientId
  - updateClientNoShowMetrics(clientId)
  - Returns: ClientNoShowMetrics
```

### Fee Management
```
POST /api/v2/no-shows/:noShowId/charge-fee
  - chargeNoShowFee(noShowId)
  - Returns: NoShowFee

GET /api/v2/no-shows/fees/:clientId
  - getNoShowFees(clientId, status?)
  - Returns: NoShowFee[]

POST /api/v2/no-shows/:noShowId/refund
  - issueRefund(noShowId, clientId, reason, amount)
  - Returns: NoShowRefundPolicy
```

### Account Actions
```
GET /api/v2/account-actions/:clientId
  - getAccountActions(clientId)
  - Returns: AccountAction[]

POST /api/v2/account-actions/:clientId/trigger
  - triggerAccountAction(clientId)
  - Returns: AccountAction | null
```

### Appeals
```
POST /api/v2/no-shows/appeals
  - submitNoShowAppeal(noShowId, clientId, reason, docs)
  - Returns: NoShowAppeal

GET /api/v2/no-shows/appeals/:clientId
  - getNoShowAppeals(clientId, status?)
  - Returns: NoShowAppeal[]

POST /api/v2/no-shows/appeals/:appealId/review
  - reviewNoShowAppeal(appealId, approved, reviewedBy, notes)
  - Body: { approved: boolean, reviewedBy: string, resolutionNotes: string }
  - Returns: NoShowAppeal
```

### Notifications
```
GET /api/v2/notifications/client/:clientId
  - getClientNotifications(clientId, unreadOnly?)
  - Returns: NoShowNotification[]

PUT /api/v2/notifications/:notificationId/read
  - markNotificationAsRead(notificationId)
```

### Batch Operations
```
POST /api/v2/no-shows/batch/process-monthly
  - processMonthlyNoShowBatch()
  - Returns: { noShowsProcessed: number, feesCharged: number, actionsTriggered: number }
```

## Integration Steps

### 1. Database Setup
```bash
# Run migration scripts to create tables
npm run migrate no-show-schema
```

### 2. Add Cron Jobs
```typescript
// In your cron/scheduler configuration
import { autoDetectNoShows, processMonthlyNoShowBatch } from './services/noShowService';

// Daily auto-detection (1 AM)
cron.schedule('0 1 * * *', async () => {
  await autoDetectNoShows();
});

// Monthly batch processing (first of month, 2 AM)
cron.schedule('0 2 1 * *', async () => {
  await processMonthlyNoShowBatch();
});
```

### 3. Import in Routes
```typescript
// In your API routes file
import noShowService from '../services/noShowService';

router.post('/api/v2/no-shows', async (req, res) => {
  const { clientId, providerId, appointmentId, appointmentDate, reason } = req.body;
  const result = await noShowService.recordNoShow(
    clientId, providerId, appointmentId, appointmentDate, 'provider_reported', reason
  );
  res.json(result);
});

// Add other routes as needed...
```

### 4. Add Frontend Component
```typescript
// In your page/component that needs no-show tracking
import NoShowWarning from '../components/NoShowWarning';

export const ClientDashboard = () => {
  const clientId = getCurrentClientId(); // Your implementation
  
  return (
    <div>
      <NoShowWarning 
        clientId={clientId} 
        userType="client"
        onAppealSubmitted={() => {
          // Refresh data or navigate
        }}
      />
    </div>
  );
};
```

### 5. Environment Variables
```bash
# .env
STRIPE_SECRET_KEY=sk_test_...
ADMIN_EMAIL=admin@transcend-law.com
NO_SHOW_APPEAL_WINDOW_DAYS=30
NO_SHOW_SUSPENSION_DAYS=30
```

## Fee Flow Diagram

```
No-Show Detected
    ↓
Calculate Fee (based on count)
    ↓
Create Fee Record
    ↓
Charge via Stripe
    ↓
Send Notification (In-app + Email)
    ↓
Client Can:
├─ Accept and Pay
├─ Submit Appeal
└─ Let it accumulate
```

## Account Action Flow

```
No-Show Confirmed
    ↓
Update Metrics
    ↓
Check Thresholds
    ↓
    ├─ 3 No-Shows → Issue Warning
    ├─ 5 No-Shows → Issue Suspension (30 days)
    └─ 10 No-Shows → Issue Termination
    ↓
Send Notifications
    ↓
Set Appeal Window (30 days)
    ↓
Client Can Appeal
    ├─ If Approved → Lift Action, Issue Refund
    └─ If Denied → Action Remains Active
```

## Appeal Process Flow

```
Client Submits Appeal
    ↓
Store in Database
    ↓
Notify Admin
    ↓
Admin Reviewer Examines
    ├─ Evidence
    ├─ Circumstances
    └─ History
    ↓
Decision:
    ├─ APPROVED
    │   ├─ Mark as Disputed
    │   ├─ Waive Fee
    │   ├─ Process Refund
    │   └─ Notify Client ✓
    └─ DENIED
        ├─ Keep Fee
        ├─ Keep Action Active
        └─ Notify Client ✗
```

## Key Functions Reference

### Service Functions

```typescript
// Recording
recordNoShow(clientId, providerId, appointmentId, date, method?, reason?)
autoDetectNoShows()

// Metrics
getClientNoShowMetrics(clientId)
updateClientNoShowMetrics(clientId)

// Fees
calculateNoShowFee(noShowCount)
chargeNoShowFee(noShowId)
getNoShowFees(clientId, status?)
issueRefund(noShowId, clientId, reason, amount)

// Account Actions
determineAccountAction(noShowCount)
triggerAccountAction(clientId)
getAccountActions(clientId)

// Appeals
submitNoShowAppeal(noShowId, clientId, reason, docs)
reviewNoShowAppeal(appealId, approved, reviewedBy, notes)
getNoShowAppeals(clientId, status?)

// Notifications
sendNoShowNotification(clientId, noShowId, type, title, message)
sendProviderNotification(providerId, clientId, subject, message)
getClientNotifications(clientId, unreadOnly?)
markNotificationAsRead(notificationId)

// Batch
processMonthlyNoShowBatch()
```

### Component Props

```typescript
interface NoShowWarningProps {
  clientId: string;           // Client ID to display
  userType: 'client' | 'admin' | 'provider';
  onAppealSubmitted?: () => void; // Callback when appeal submitted
}
```

## Validation & Error Handling

### Backend Validation
- ✓ Client exists
- ✓ Appointment date is in past
- ✓ No duplicate no-show record
- ✓ Sufficient balance for refund
- ✓ Appeal within 30-day window
- ✓ Fee > 0 before charging

### Frontend Validation
- ✓ Appeal reason required
- ✓ At least 10 characters
- ✓ Max 1000 characters
- ✓ Supporting documents optional
- ✓ Real-time validation

## Security Considerations

### Backend
- ✓ JWT authentication on all endpoints
- ✓ Authorization checks (client can only see own data)
- ✓ Admin-only review endpoints
- ✓ Audit logging of all actions
- ✓ PII redaction in audit logs

### Payment Security
- ✓ Stripe tokenization (no raw card data)
- ✓ Webhook validation for Stripe events
- ✓ Idempotent fee charging
- ✓ Refund verification

### Data Privacy
- ✓ Encrypted PII in database
- ✓ Appeal documents handled securely
- ✓ Email notifications GDPR-compliant
- ✓ Data retention policies

## Monitoring & Metrics

### Key Metrics to Track
```
- Total no-shows per month
- Fee revenue per month
- Appeal approval rate
- Average appeal review time
- Account suspension/termination rate
- Recidivism rate (repeat offenders)
```

### Logging
All actions logged to `no_show_audit_log`:
- No-show recorded/confirmed
- Fee charged/waived
- Account action triggered
- Appeal submitted/reviewed
- Refund issued

## Testing

### Unit Tests
```typescript
// Example test
describe('No-Show Service', () => {
  test('calculateNoShowFee returns correct amount', () => {
    expect(calculateNoShowFee(1)).toBe(0);
    expect(calculateNoShowFee(2)).toBe(25);
    expect(calculateNoShowFee(3)).toBe(50);
  });

  test('determineAccountAction returns correct action', () => {
    expect(determineAccountAction(3)).toBe('warning');
    expect(determineAccountAction(5)).toBe('suspension');
    expect(determineAccountAction(10)).toBe('termination');
  });
});
```

### Integration Tests
- Test full no-show flow end-to-end
- Test Stripe payment integration
- Test email notification sending
- Test appeal workflow
- Test metrics calculation

## Future Enhancements

1. **ML-based Prediction**: Predict likely no-shows
2. **Early Warning**: Pro-active notifications 24h before appointment
3. **Automated Appeals**: Auto-approve appeals with strong supporting docs
4. **Waitlist Management**: Automatically fill slots from waitlist
5. **Reputation System**: Client reputation score based on attendance
6. **Smart Suspensions**: Progressive notification instead of hard suspension
7. **Analytics Dashboard**: Admin dashboard for no-show trends
8. **SMS Reminders**: 24h SMS reminder to reduce no-shows
9. **Payment Plans**: Allow clients to pay fees over time
10. **Vendor Integration**: Sync with calendar/appointment systems

## Support & Troubleshooting

### Common Issues

**Issue**: Fees not charging
- Check Stripe API key
- Verify customer has payment method
- Check payment_intent status

**Issue**: Emails not sending
- Verify email service credentials
- Check email templates
- Review error logs

**Issue**: Appeals not appearing
- Verify database connectivity
- Check client ID format
- Review appeal submission response

## Contact & Support

For questions or issues:
- Backend: Check `/transcend-api/services/noShowService.ts`
- Frontend: Check `/transcend-frontend/src/components/NoShowWarning.tsx`
- Database: Check schema in `NO_SHOW_MANAGEMENT_SYSTEM.md`

---

**Version**: 1.0.0
**Last Updated**: 2024
**Status**: Production Ready
