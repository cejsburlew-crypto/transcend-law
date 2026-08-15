# Escrow/Third-Party Payment Holding System
## Implementation Guide for Transcend Law Platform

---

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Components](#components)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Implementation Steps](#implementation-steps)
7. [Integration Guide](#integration-guide)
8. [Fee Handling](#fee-handling)
9. [Release Conditions](#release-conditions)
10. [Dispute Resolution](#dispute-resolution)
11. [Account Reconciliation](#account-reconciliation)
12. [Testing Guide](#testing-guide)

---

## Overview

The escrow system provides secure third-party payment holding for legal services transactions. It ensures client funds are protected until service completion conditions are met.

### Key Features
- **Secure Fund Holding**: Funds held with Stripe Connect until release conditions are met
- **Flexible Release Conditions**: Client approval, time-based holds, and provider completion
- **Dispute Resolution**: Built-in dispute handling with admin resolution
- **Automatic Processing**: Scheduled jobs for automatic fund releases
- **Account Reconciliation**: Daily reconciliation and verification
- **Audit Trail**: Complete transaction history and logging
- **Fee Management**: Flexible fee handling (platform, client, or provider pays)

### Supported Operations
- Create escrow holds
- Approve/release funds
- Automatic release based on time or conditions
- Open and resolve disputes
- Refund escrow holds
- Reconcile accounts
- Generate escrow reports

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Transcend Frontend                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ EscrowStatus │  │  Dashboard   │  │ CaseDetail   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ HTTP/REST
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Transcend API Backend                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Escrow Routes (/api/v2/escrow)            │  │
│  │ ┌────────────────────────────────────────────────┐  │  │
│  │ │  • Create Hold      • Approve Release          │  │  │
│  │ │  • Get Hold Status  • Open Dispute             │  │  │
│  │ │  • Process Release  • Resolve Dispute          │  │  │
│  │ │  • Refund Hold      • Get Stats                │  │  │
│  │ └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                      ▼                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Escrow Service Layer                         │  │
│  │ ┌────────────────────────────────────────────────┐  │  │
│  │ │ • Fund Management      • Dispute Handling      │  │  │
│  │ │ • Release Logic        • Reconciliation        │  │  │
│  │ │ • Fee Calculation      • Notifications         │  │  │
│  │ │ • Audit Logging        • Stripe Integration    │  │  │
│  │ └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                      ▼                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Database Layer (PostgreSQL)              │  │
│  │ ┌────────────────────────────────────────────────┐  │  │
│  │ │ • escrow_accounts         • escrow_disputes    │  │  │
│  │ │ • escrow_holds            • escrow_audit_log   │  │  │
│  │ │ • escrow_reconciliations  • providers          │  │  │
│  │ └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ REST/Webhooks
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                    Stripe Connect API                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ • Payment Intents    • Transfers                     │  │
│  │ • Customers          • Refunds                       │  │
│  │ • Connected Accounts • Webhooks                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Components

### Backend Service (`escrowService.ts`)

**Primary Responsibilities:**
- Fund holding with Stripe Connect
- Release condition management
- Automatic and manual release
- Dispute lifecycle management
- Account reconciliation
- Audit trail logging

**Key Functions:**
```typescript
// Account Management
initializeEscrowAccount()
getEscrowAccountBalance()

// Hold Management
createEscrowHold()
getEscrowHold()
getEscrowHoldsByCase()
getEscrowHoldsByUser()

// Release Operations
releaseEscrowFunds()
approveEscrowRelease()
processAutomaticEscrowReleases()

// Refunds
refundEscrowHold()

// Disputes
openDispute()
resolveDispute()
getDispute()

// Reconciliation
reconcileEscrowAccounts()
getReconciliationHistory()
```

### Frontend Component (`EscrowStatus.tsx`)

**Displays:**
- Escrow payment amount and status
- Release conditions checklist
- Hold period countdown
- Timeline of escrow events
- Dispute information
- Action buttons (approve, dispute, refund)

**User Interactions:**
- Approve fund release (client/provider)
- Open dispute (involved parties)
- View status and history (all users)
- Admin actions (release, refund, resolve)

### API Routes (`escrow.ts`)

**Endpoints:**
```
POST   /api/v2/escrow/account/initialize       - Init account
GET    /api/v2/escrow/account/balance          - Get balance
POST   /api/v2/escrow/holds                    - Create hold
GET    /api/v2/escrow/holds/:id                - Get hold
GET    /api/v2/escrow/case/:caseId             - Get case holds
GET    /api/v2/escrow/user/:userId             - Get user holds
POST   /api/v2/escrow/:id/approve              - Approve release
POST   /api/v2/escrow/:id/release              - Release funds
POST   /api/v2/escrow/:id/refund               - Refund hold
POST   /api/v2/escrow/:id/dispute              - Open dispute
POST   /api/v2/escrow/dispute/:disputeId/resolve - Resolve
GET    /api/v2/escrow/stats                    - Get stats
```

---

## Database Schema

### escrow_accounts
```sql
id (UUID, PK)
stripe_account_id (VARCHAR, UNIQUE)
balance (DECIMAL)
status (active|suspended|closed)
created_at, updated_at
```

### escrow_holds
```sql
id (UUID, PK)
case_id (FK to cases)
client_id (FK to users)
provider_id (FK to users)
amount (DECIMAL)
currency (VARCHAR)
status (held|released|refunded|disputed)
requires_client_approval (BOOL)
client_approved_at (TIMESTAMP)
requires_provider_approval (BOOL)
provider_approved_at (TIMESTAMP)
hold_period_days (INT)
hold_until_date (TIMESTAMP)
escrow_fee_amount (DECIMAL)
escrow_fee_percentage (DECIMAL)
who_pays_fee (client|provider|platform)
payment_intent_id (VARCHAR)
transfer_id (VARCHAR)
refund_id (VARCHAR)
released_at, released_by (TIMESTAMP, FK)
refunded_at (TIMESTAMP)
created_at, updated_at
```

### escrow_disputes
```sql
id (UUID, PK)
escrow_hold_id (FK to escrow_holds)
initiated_by (FK to users)
reason (TEXT)
status (open|investigating|resolved|closed)
resolution (TEXT)
resolved_at (TIMESTAMP)
resolved_by (FK to users)
created_at, updated_at
```

### escrow_audit_log
```sql
id (UUID, PK)
escrow_hold_id (FK to escrow_holds)
action (VARCHAR)
user_id (FK to users)
description (TEXT)
created_at (TIMESTAMP)
```

### escrow_reconciliations
```sql
id (UUID, PK)
date (DATE)
total_held (DECIMAL)
total_released (DECIMAL)
total_refunded (DECIMAL)
total_disputed (DECIMAL)
platform_fee_collected (DECIMAL)
status (pending|completed|verified)
verified_at (TIMESTAMP)
created_at, updated_at
```

---

## API Endpoints

### Account Management

#### Initialize Escrow Account
```http
POST /api/v2/escrow/account/initialize
Authorization: Bearer {token}
Admin: true

Response:
{
  "success": true,
  "account": {
    "id": "uuid",
    "escrowHoldingAccountId": "acct_...",
    "balance": 0,
    "status": "active",
    "createdAt": "2026-08-15T...",
    "updatedAt": "2026-08-15T..."
  }
}
```

#### Get Account Balance
```http
GET /api/v2/escrow/account/balance
Authorization: Bearer {token}
Admin: true

Response:
{
  "balance": 5000.00,
  "currency": "USD"
}
```

### Hold Management

#### Create Escrow Hold
```http
POST /api/v2/escrow/holds
Authorization: Bearer {token}
Content-Type: application/json

{
  "caseId": "uuid",
  "clientId": "uuid",
  "providerId": "uuid",
  "amount": 500.00,
  "holdPeriodDays": 30,
  "feePercentage": 2.5,
  "whoPaysFee": "platform"
}

Response:
{
  "success": true,
  "escrowHold": {
    "id": "uuid",
    "caseId": "uuid",
    "clientId": "uuid",
    "providerId": "uuid",
    "amount": 500.00,
    "currency": "usd",
    "status": "held",
    "releaseConditions": {
      "requiresClientApproval": true,
      "requiresProviderApproval": false,
      "holdPeriodDays": 30,
      "holdUntilDate": "2026-09-14T..."
    },
    "fees": {
      "escrowFeeAmount": 12.50,
      "escrowFeePercentage": 2.5,
      "whoPaysFee": "platform"
    },
    "paymentIntentId": "pi_...",
    "createdAt": "2026-08-15T..."
  },
  "clientSecret": "pi_..."
}
```

#### Get Escrow Hold
```http
GET /api/v2/escrow/holds/{holdId}
Authorization: Bearer {token}

Response:
{
  "escrowHold": { ... }
}
```

#### Get Escrow Holds for Case
```http
GET /api/v2/escrow/case/{caseId}
Authorization: Bearer {token}

Response:
{
  "escrowHold": { ... },
  "escrowHolds": [ ... ],
  "disputes": [ ... ]
}
```

### Release Operations

#### Approve Escrow Release
```http
POST /api/v2/escrow/{holdId}/approve
Authorization: Bearer {token}
Content-Type: application/json

{
  "userId": "uuid"
}

Response:
{
  "success": true,
  "message": "Escrow release approved"
}
```

#### Release Escrow Funds
```http
POST /api/v2/escrow/{holdId}/release
Authorization: Bearer {token}
Admin: true
Content-Type: application/json

{
  "reason": "Service completed successfully"
}

Response:
{
  "success": true,
  "message": "Escrow funds released",
  "escrowHold": { ... }
}
```

#### Process Automatic Releases
```http
POST /api/v2/escrow/process-auto-releases
Authorization: Bearer {token}
Admin: true

Response:
{
  "success": true,
  "message": "Processed 5 automatic escrow releases",
  "count": 5
}
```

### Refunds

#### Refund Escrow Hold
```http
POST /api/v2/escrow/{holdId}/refund
Authorization: Bearer {token}
Admin: true
Content-Type: application/json

{
  "reason": "Service not completed - client requested refund"
}

Response:
{
  "success": true,
  "message": "Escrow hold refunded",
  "escrowHold": { ... }
}
```

### Disputes

#### Open Dispute
```http
POST /api/v2/escrow/{holdId}/dispute
Authorization: Bearer {token}
Content-Type: application/json

{
  "reason": "Service was not completed as promised",
  "initiatedBy": "uuid"
}

Response:
{
  "success": true,
  "dispute": {
    "id": "uuid",
    "escrowHoldId": "uuid",
    "initiatedBy": "uuid",
    "reason": "...",
    "status": "open",
    "createdAt": "2026-08-15T..."
  }
}
```

#### Get Dispute
```http
GET /api/v2/escrow/dispute/{disputeId}
Authorization: Bearer {token}

Response:
{
  "dispute": { ... }
}
```

#### Resolve Dispute
```http
POST /api/v2/escrow/dispute/{disputeId}/resolve
Authorization: Bearer {token}
Admin: true
Content-Type: application/json

{
  "resolution": "After investigation, client claim verified. Funds refunded.",
  "resolution_action": "refund"
}

Response:
{
  "success": true,
  "message": "Dispute resolved",
  "dispute": { ... }
}
```

### Reconciliation

#### Reconcile Escrow Accounts
```http
POST /api/v2/escrow/reconcile
Authorization: Bearer {token}
Admin: true

Response:
{
  "success": true,
  "reconciliation": {
    "id": "uuid",
    "date": "2026-08-15",
    "totalHeld": 5000.00,
    "totalReleased": 3000.00,
    "totalRefunded": 500.00,
    "totalDisputed": 1500.00,
    "platformFeeCollected": 312.50,
    "status": "completed",
    "verifiedAt": "2026-08-15T..."
  }
}
```

#### Get Reconciliation History
```http
GET /api/v2/escrow/reconciliations?days=30
Authorization: Bearer {token}
Admin: true

Response:
{
  "reconciliations": [ ... ],
  "count": 30
}
```

### Statistics

#### Get Escrow Statistics
```http
GET /api/v2/escrow/stats
Authorization: Bearer {token}
Admin: true

Response:
{
  "escrowStats": {
    "currentBalance": 5000.00,
    "totalHeld": 15000.00,
    "totalReleased": 8000.00,
    "totalRefunded": 1500.00,
    "totalDisputed": 2000.00,
    "platformFeeCollected": 375.00,
    "period": "30 days"
  }
}
```

---

## Implementation Steps

### Phase 1: Database Setup

1. **Create migration file:**
   ```bash
   cd transcend-api/src/database/migrations
   # File: 001-escrow-tables.sql (already created)
   ```

2. **Run migration:**
   ```bash
   npm run migrate
   # or
   psql -U transcend -d transcend_db -f migrations/001-escrow-tables.sql
   ```

3. **Verify tables:**
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' AND table_name LIKE 'escrow%';
   ```

### Phase 2: Backend Implementation

1. **Install/verify dependencies:**
   ```bash
   npm install stripe
   ```

2. **Configure environment variables:**
   ```env
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ESCROW_ADMIN_EMAIL=escrow@transcend-law.com
   ADMIN_EMAIL=admin@transcend-law.com
   ```

3. **Register routes in main app:**
   ```typescript
   // server.ts or app.ts
   import escrowRoutes from './routes/escrow';
   app.use('/api/v2/escrow', escrowRoutes);
   ```

4. **Create admin middleware if not exists:**
   ```typescript
   // middleware/adminMiddleware.ts
   export async function adminMiddleware(req, res, next) {
     const user = await query('SELECT * FROM users WHERE id = $1', [req.userId]);
     if (user.rows[0]?.user_type !== 'admin') {
       return res.status(403).json({ error: 'Admin access required' });
     }
     next();
   }
   ```

### Phase 3: Frontend Implementation

1. **Install component:**
   ```bash
   cp transcend-frontend/src/components/EscrowStatus.tsx {project}/components/
   cp transcend-frontend/src/components/EscrowStatus.css {project}/components/
   ```

2. **Import and use in pages:**
   ```typescript
   // CaseDetail.tsx
   import { EscrowStatus } from '../components/EscrowStatus';

   export function CaseDetail() {
     const { caseId } = useParams();
     const { user } = useAuth();

     return (
       <div>
         <h1>Case Details</h1>
         <EscrowStatus
           caseId={caseId}
           userType={user.userType}
           currentUserId={user.id}
           onStatusChange={(status) => console.log('Status:', status)}
         />
       </div>
     );
   }
   ```

### Phase 4: Integration with Cases

1. **Add escrow hold creation when case is matched:**
   ```typescript
   // In case acceptance/matching logic
   const escrowHold = await escrowService.createEscrowHold(
     caseId,
     clientId,
     providerId,
     quoteAmount,
     30, // 30-day hold
     2.5, // 2.5% fee
     'platform' // platform pays fee
   );
   ```

2. **Add escrow hold check to case completion:**
   ```typescript
   // Before marking case complete, verify escrow funds are handled
   const escrowHolds = await escrowService.getEscrowHoldsByCase(caseId);
   if (escrowHolds.some(h => h.status === 'held')) {
     // Require approval or automatic release
   }
   ```

### Phase 5: Scheduled Jobs

1. **Create cron job for automatic releases:**
   ```bash
   # Add to crontab (runs daily at 2 AM)
   0 2 * * * curl -X POST http://localhost:3001/api/v2/escrow/process-auto-releases \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

2. **Or use Node.js scheduler:**
   ```typescript
   // services/schedulerService.ts
   import cron from 'node-cron';

   cron.schedule('0 2 * * *', async () => {
     console.log('Running automatic escrow release job...');
     await escrowService.processAutomaticEscrowReleases();
   });

   cron.schedule('0 3 * * *', async () => {
     console.log('Running escrow reconciliation job...');
     await escrowService.reconcileEscrowAccounts();
   });
   ```

### Phase 6: Testing

1. **Unit tests:**
   ```typescript
   // tests/escrow.test.ts
   describe('EscrowService', () => {
     it('should create escrow hold', async () => {
       const hold = await escrowService.createEscrowHold(...);
       expect(hold.status).toBe('held');
     });

     it('should release escrow funds', async () => {
       const hold = await escrowService.releaseEscrowFunds(...);
       expect(hold.status).toBe('released');
     });
   });
   ```

2. **Integration tests:**
   ```typescript
   // tests/escrow-integration.test.ts
   it('should complete escrow lifecycle', async () => {
     // Create hold
     // Approve release
     // Verify transfer
   });
   ```

---

## Integration Guide

### Case Lifecycle Integration

```typescript
// 1. When case is matched and client accepts quote
async function acceptCaseQuote(caseId, quoteId) {
  const quote = await getQuote(quoteId);
  
  // Create escrow hold
  const escrowHold = await escrowService.createEscrowHold(
    caseId,
    quote.clientId,
    quote.providerId,
    quote.amount,
    30,
    2.5,
    'platform'
  );
  
  // Update case status
  await updateCase(caseId, { 
    status: 'matched',
    escrowHoldId: escrowHold.id 
  });
}

// 2. When service is completed
async function completeService(caseId) {
  const caseData = await getCase(caseId);
  const escrowHold = await escrowService.getEscrowHold(caseData.escrowHoldId);
  
  // Approve from provider side
  await escrowService.approveEscrowRelease(
    escrowHold.id,
    caseData.providerId
  );
}

// 3. When client confirms completion
async function confirmCompletion(caseId) {
  const caseData = await getCase(caseId);
  const escrowHold = await escrowService.getEscrowHold(caseData.escrowHoldId);
  
  // Approve from client side and release
  await escrowService.approveEscrowRelease(
    escrowHold.id,
    caseData.clientId
  );
  
  // If all approvals met, auto-release
  const released = await escrowService.releaseEscrowFunds(
    escrowHold.id,
    'Service completed and approved by all parties',
    'system'
  );
  
  // Update case
  await updateCase(caseId, { 
    status: 'completed',
    completedAt: new Date()
  });
}

// 4. If dispute arises
async function initiateDispute(caseId, reason) {
  const caseData = await getCase(caseId);
  const escrowHold = await escrowService.getEscrowHold(caseData.escrowHoldId);
  
  const dispute = await escrowService.openDispute(
    escrowHold.id,
    caseData.clientId, // or providerId
    reason
  );
  
  // Notify admin for investigation
}
```

---

## Fee Handling

### Fee Structure

```typescript
// Example: $500 service with 2.5% escrow fee

// Option 1: Platform pays fee
Amount held: $500
Platform fee: $12.50
Client pays: $500
Provider receives: $500

// Option 2: Client pays fee
Amount held: $512.50
Platform fee: $12.50
Client pays: $512.50
Provider receives: $500

// Option 3: Provider pays fee
Amount held: $500
Platform fee: $12.50
Client pays: $500
Provider receives: $487.50
```

### Implementation

```typescript
function calculateEscrowAmounts(
  serviceAmount: number,
  feePercentage: number,
  whoPaysFee: 'client' | 'provider' | 'platform'
) {
  const feeAmount = (serviceAmount * feePercentage) / 100;

  switch (whoPaysFee) {
    case 'client':
      return {
        clientCharges: serviceAmount + feeAmount,
        providerReceives: serviceAmount,
        platformCollects: feeAmount,
        totalHeld: serviceAmount + feeAmount,
      };

    case 'provider':
      return {
        clientCharges: serviceAmount,
        providerReceives: serviceAmount - feeAmount,
        platformCollects: feeAmount,
        totalHeld: serviceAmount,
      };

    case 'platform':
      return {
        clientCharges: serviceAmount,
        providerReceives: serviceAmount,
        platformCollects: feeAmount,
        totalHeld: serviceAmount,
      };
  }
}
```

---

## Release Conditions

### Standard Release Flow

```
┌─ Escrow Hold Created
│
├─ Hold Period: 30 days
│  └─ Tick each day
│
├─ Client Approval Required
│  └─ Client confirms service completion
│
├─ All Conditions Met? (after 30 days + approval)
│  ├─ YES → Auto-release funds to provider
│  └─ NO → Await admin action
│
└─ Status: Released / Refunded / Disputed
```

### Automatic Release Logic

```typescript
async function processAutomaticEscrowReleases() {
  const holds = await query(`
    SELECT * FROM escrow_holds
    WHERE status = 'held'
    AND hold_until_date <= NOW()
    AND client_approved_at IS NOT NULL
  `);

  for (const hold of holds) {
    await releaseEscrowFunds(
      hold.id,
      'Automatic release - hold period expired',
      'system'
    );
  }
}

// Trigger conditions for release:
// 1. Time-based: hold_until_date has passed
// 2. Approval-based: client_approved_at is set
// 3. No disputes: status is still 'held' (not 'disputed')
```

### Conditional Release

```typescript
// Different conditions can be set when creating hold
const escrowHold = await createEscrowHold(
  caseId,
  clientId,
  providerId,
  amount,
  holdPeriodDays = 0, // Immediate release if approved
  feePercentage,
  whoPaysFee,
  releaseConditions = {
    requiresClientApproval: true,
    requiresProviderApproval: true, // Both must approve
    holdPeriodDays: 30,
  }
);
```

---

## Dispute Resolution

### Dispute Lifecycle

```
┌─ Party Opens Dispute
│  (Client or Provider)
│
├─ Status: OPEN
│  └─ Admin notified
│
├─ Status: INVESTIGATING
│  └─ Admin reviews evidence
│
├─ Resolution Decision
│  ├─ RELEASE: Funds go to provider
│  ├─ REFUND: Funds return to client
│  └─ SPLIT: Partial to each party (manual)
│
└─ Status: RESOLVED
   └─ Parties notified
```

### Dispute Resolution

```typescript
// Admin investigates and resolves
async function resolveDispute(disputeId, resolution, action) {
  const dispute = await getDispute(disputeId);
  
  switch (action) {
    case 'release':
      // Provider did good work, release funds
      await releaseEscrowFunds(
        dispute.escrowHoldId,
        `Dispute resolved in provider favor: ${resolution}`,
        adminUserId
      );
      break;

    case 'refund':
      // Client claim valid, refund funds
      await refundEscrowHold(
        dispute.escrowHoldId,
        `Dispute resolved in client favor: ${resolution}`,
        adminUserId
      );
      break;
  }
}

// For split decisions (manual override needed)
// - Partial refund to client
// - Partial payment to provider
// - Platform may absorb additional fees
```

---

## Account Reconciliation

### Daily Reconciliation Process

```typescript
// Runs daily at 3 AM
async function reconcileEscrowAccounts() {
  // 1. Get all escrow statistics for the day
  const stats = await query(`
    SELECT
      COUNT(CASE WHEN status = 'held' THEN 1 END) as held_count,
      SUM(CASE WHEN status = 'held' THEN amount ELSE 0 END) as total_held,
      SUM(CASE WHEN status = 'released' THEN amount ELSE 0 END) as total_released,
      SUM(CASE WHEN who_pays_fee = 'platform' THEN escrow_fee_amount ELSE 0 END) as platform_fees
    FROM escrow_holds
    WHERE DATE(created_at) = CURRENT_DATE
  `);

  // 2. Verify against actual Stripe balance
  const stripeBalance = await stripe.balance.retrieve();

  // 3. Check for discrepancies
  if (Math.abs(expectedBalance - actualBalance) > 0.01) {
    console.warn('⚠️ Escrow balance discrepancy detected');
    // Alert admin
  }

  // 4. Create reconciliation record
  await createReconciliationRecord({
    date: new Date(),
    totalHeld: stats.total_held,
    totalReleased: stats.total_released,
    totalRefunded: stats.total_refunded,
    platformFeeCollected: stats.platform_fees,
    status: 'completed',
    verifiedAt: new Date(),
  });
}
```

### Reconciliation Reports

```typescript
// Generate daily report
async function generateReconciliationReport(date) {
  const reconciliation = await query(`
    SELECT * FROM escrow_reconciliations WHERE date = $1
  `, [date]);

  return {
    date: reconciliation.date,
    summary: {
      totalFundsHeld: reconciliation.total_held,
      fundsReleased: reconciliation.total_released,
      fundsRefunded: reconciliation.total_refunded,
      fundsDisputed: reconciliation.total_disputed,
      platformFeeCollected: reconciliation.platform_fee_collected,
    },
    status: reconciliation.status,
  };
}

// Export for accounting
async function exportReconciliationData(startDate, endDate) {
  const reconciliations = await query(`
    SELECT * FROM escrow_reconciliations
    WHERE date BETWEEN $1 AND $2
    ORDER BY date
  `, [startDate, endDate]);

  return reconciliations.map(r => ({
    date: r.date,
    held: r.total_held,
    released: r.total_released,
    refunded: r.total_refunded,
    disputed: r.total_disputed,
    fees: r.platform_fee_collected,
  }));
}
```

---

## Testing Guide

### Unit Tests

```typescript
import * as escrowService from '../escrowService';

describe('EscrowService - Hold Creation', () => {
  it('should create escrow hold with correct amount', async () => {
    const hold = await escrowService.createEscrowHold(
      'case-123',
      'client-456',
      'provider-789',
      500.00,
      30,
      2.5,
      'platform'
    );

    expect(hold.amount).toBe(500);
    expect(hold.status).toBe('held');
    expect(hold.fees.escrowFeeAmount).toBe(12.50);
  });

  it('should calculate fees correctly for client payment', async () => {
    const hold = await escrowService.createEscrowHold(
      'case-123',
      'client-456',
      'provider-789',
      500.00,
      30,
      2.5,
      'client'
    );

    expect(hold.fees.whoPaysFee).toBe('client');
    expect(hold.fees.escrowFeeAmount).toBe(12.50);
  });
});

describe('EscrowService - Release Logic', () => {
  it('should release funds after approval', async () => {
    const hold = await escrowService.createEscrowHold(...);
    await escrowService.approveEscrowRelease(hold.id, clientId);
    const released = await escrowService.releaseEscrowFunds(
      hold.id,
      'Approved by client',
      adminId
    );

    expect(released.status).toBe('released');
    expect(released.transferId).toBeDefined();
  });

  it('should prevent release without approval', async () => {
    const hold = await escrowService.createEscrowHold(...);

    expect(async () => {
      await escrowService.releaseEscrowFunds(
        hold.id,
        'Trying without approval',
        adminId
      );
    }).rejects.toThrow();
  });
});

describe('EscrowService - Disputes', () => {
  it('should open dispute', async () => {
    const hold = await escrowService.createEscrowHold(...);
    const dispute = await escrowService.openDispute(
      hold.id,
      clientId,
      'Service not completed'
    );

    expect(dispute.status).toBe('open');
    expect(dispute.reason).toBe('Service not completed');
  });

  it('should resolve dispute with refund', async () => {
    const dispute = await escrowService.openDispute(...);
    const resolved = await escrowService.resolveDispute(
      dispute.id,
      'Client claim verified',
      'refund',
      adminId
    );

    expect(resolved.status).toBe('resolved');
  });
});
```

### Integration Tests

```typescript
describe('Escrow System - Full Lifecycle', () => {
  it('should handle complete escrow lifecycle', async () => {
    // 1. Create case
    const caseId = await createTestCase();

    // 2. Create escrow hold
    const hold = await escrowService.createEscrowHold(
      caseId,
      clientId,
      providerId,
      500.00,
      30,
      2.5,
      'platform'
    );

    expect(hold.status).toBe('held');

    // 3. Approve release
    await escrowService.approveEscrowRelease(hold.id, clientId);

    // 4. Release funds
    const released = await escrowService.releaseEscrowFunds(
      hold.id,
      'Service completed',
      adminId
    );

    expect(released.status).toBe('released');

    // 5. Verify provider received funds
    const providerAccount = await stripe.accounts.retrieve(providerStripeId);
    expect(providerAccount.balance_transfers > 0).toBe(true);
  });

  it('should handle dispute resolution', async () => {
    const hold = await escrowService.createEscrowHold(...);

    // Open dispute
    const dispute = await escrowService.openDispute(
      hold.id,
      clientId,
      'Service incomplete'
    );

    // Resolve with refund
    const resolved = await escrowService.resolveDispute(
      dispute.id,
      'Client claim verified',
      'refund',
      adminId
    );

    expect(resolved.status).toBe('resolved');

    // Verify hold is refunded
    const refundedHold = await escrowService.getEscrowHold(hold.id);
    expect(refundedHold.status).toBe('refunded');
  });
});
```

### Manual Testing Checklist

- [ ] Create escrow hold via API
- [ ] Verify payment intent created in Stripe
- [ ] Approve release from client side
- [ ] Release funds to provider
- [ ] Verify transfer in Stripe account
- [ ] Refund escrow hold
- [ ] Verify refund processed
- [ ] Open dispute
- [ ] Resolve dispute with release
- [ ] Resolve dispute with refund
- [ ] Run account reconciliation
- [ ] Verify reconciliation report
- [ ] Check audit logs
- [ ] Test automatic releases via scheduler

---

## Monitoring & Alerts

### Key Metrics to Monitor

```typescript
// Escrow health dashboard
{
  escrowStats: {
    currentBalance: 5000.00,
    totalHeld: 15000.00,
    totalReleased: 8000.00,
    totalRefunded: 1500.00,
    totalDisputed: 2000.00,
    activeDisputes: 3,
    unresolvedDisputes: 1,
    dueForRelease: 2, // Holds past hold_until_date
    platformFeeCollected: 375.00,
  },
  alerts: [
    'Balance discrepancy detected: expected $5000, found $5001.50',
    '2 escrow holds overdue for release',
    '1 dispute open for > 7 days',
  ],
}
```

### Alert Triggers

- Balance discrepancy > $0.01
- Hold not released past hold_until_date + 1 day
- Dispute open for > 7 days without activity
- Reconciliation failed
- Payment intent not captured
- Transfer failed

---

## Support & Troubleshooting

### Common Issues

**Issue: Escrow hold not releasing after approval**
```
Check:
1. Are all release conditions met?
2. Is hold_until_date still in future?
3. Is dispute status 'disputed'?
4. Run: SELECT * FROM escrow_holds WHERE id = ...
```

**Issue: Provider didn't receive funds**
```
Check:
1. Is transfer_id set in database?
2. Verify with Stripe: stripe.transfers.retrieve(transferId)
3. Check provider's Stripe account is connected
4. Review audit log for error messages
```

**Issue: Duplicate charges**
```
Check:
1. Payment intent status in Stripe
2. Check for multiple transfers on same intent
3. Review refund records
```

---

## Conclusion

The escrow system provides comprehensive third-party payment holding with:
- Secure Stripe Connect integration
- Flexible release conditions
- Dispute resolution
- Automatic processing
- Complete audit trails
- Daily reconciliation
- Admin oversight

For questions or issues, contact the development team or consult the Stripe documentation.

---

**Last Updated:** 2026-08-15
**Version:** 1.0
**Status:** Ready for Implementation
