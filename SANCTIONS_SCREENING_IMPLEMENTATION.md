# OFAC/Sanctions Screening Implementation Guide

## Overview

This document describes the complete OFAC/Sanctions Screening system for Transcend Law Platform. The system screens users against multiple international sanctions lists (OFAC, EU, UN, UK) in real-time with daily updates, risk scoring, and comprehensive audit trails.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Transcend Law Platform                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐                                             │
│  │   Frontend   │                                             │
│  │  (Account    │                                             │
│  │  Creation)   │                                             │
│  └──────┬───────┘                                             │
│         │                                                      │
│         ▼                                                      │
│  ┌──────────────────────┐                                     │
│  │   Sanctions Router   │◄──────────────┐                     │
│  │  /api/sanctions/*    │               │                     │
│  └──────┬───────────────┘               │                     │
│         │                                │                     │
│         ▼                                │                     │
│  ┌──────────────────────┐        ┌──────┴──────────┐          │
│  │ Sanctions Service    │───────►│  External APIs  │          │
│  │ (Core Logic)         │        │ • OpenSanctions │          │
│  │ • Screening          │        │ • OFAC SDN      │          │
│  │ • Risk Scoring       │        │ • EU Sanctions  │          │
│  │ • Matching           │        │ • UN Sanctions  │          │
│  │ • Audit Logging      │        │ • UK Sanctions  │          │
│  └──────┬───────────────┘        └─────────────────┘          │
│         │                                                      │
│         ▼                                                      │
│  ┌──────────────────────────────────────┐                     │
│  │    PostgreSQL Database               │                     │
│  │ • sanctions_screenings               │                     │
│  │ • sanctions_matches                  │                     │
│  │ • sanctions_blocked_users            │                     │
│  │ • sanctions_appeals                  │                     │
│  │ • sanctions_audit_log                │                     │
│  │ • sanctions_list_updates             │                     │
│  └──────────────────────────────────────┘                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Core Service (`sanctionsService.ts`)

**Location:** `/transcend-api/src/services/sanctionsService.ts`

**Key Functions:**

- `initializeSanctionsData()` - Load sanctions data on startup
- `screenAgainstSanctions(payload)` - Primary screening function
- `getUserScreeningHistory(userId)` - Fetch user's screening history
- `getScreeningResult(screeningId)` - Get detailed screening result
- `reviewScreening(screeningId, ...)` - Admin manual review
- `getPendingReviews()` - Get screenings pending manual review
- `performDailyUpdate()` - Daily sanctions list update
- `getSanctionsAuditTrail()` - Fetch audit logs

### 2. API Routes (`sanctionsRoutes.ts`)

**Location:** `/transcend-api/src/routes/sanctionsRoutes.ts`

**Endpoints:**

#### User Endpoints
- `POST /sanctions/screen` - Screen user during account creation/payment
- `GET /sanctions/screening/:screeningId` - Get screening result
- `GET /sanctions/user/history` - Get user's screening history
- `POST /sanctions/appeal` - Submit appeal for blocked user
- `GET /sanctions/appeal/status` - Check appeal status

#### Admin Endpoints
- `GET /sanctions/admin/pending-reviews` - List screenings pending review
- `POST /sanctions/admin/review/:screeningId` - Submit manual review
- `GET /sanctions/admin/statistics` - Screening statistics
- `GET /sanctions/admin/update-status` - Sanctions list update status
- `POST /sanctions/admin/force-update` - Force immediate update
- `GET /sanctions/admin/audit-log` - View audit trail
- `GET /sanctions/admin/blocked-users` - List blocked users
- `POST /sanctions/admin/unblock-user/:userId` - Unblock user
- `GET /sanctions/admin/appeals` - View pending appeals
- `POST /sanctions/admin/appeal/review/:appealId` - Review appeal

### 3. Database Schema

**Location:** `/transcend-api/src/database/migrations/002_sanctions_screening.sql`

**Tables:**

- `sanctions_screenings` - Screening results
- `sanctions_matches` - Detected matches
- `sanctions_list_updates` - Update history
- `sanctions_audit_log` - Activity audit trail
- `sanctions_blocked_users` - Blocked user tracking
- `sanctions_appeals` - Appeal submissions

## Integration Steps

### Step 1: Install Dependencies

```bash
npm install axios
```

### Step 2: Run Database Migration

```bash
psql -U postgres -d transcend_law_db -f transcend-api/src/database/migrations/002_sanctions_screening.sql
```

### Step 3: Register Routes in Main App

**File:** `/transcend-api/src/index.ts`

```typescript
import sanctionsRoutes from './routes/sanctionsRoutes';

// Mount sanctions routes
app.use('/api/sanctions', sanctionsRoutes);
```

### Step 4: Initialize Sanctions Data on Startup

**File:** `/transcend-api/src/index.ts`

```typescript
import { initializeSanctionsData } from './services/sanctionsService';

// Initialize after server starts
const server = app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  try {
    await initializeSanctionsData();
  } catch (error) {
    console.error('Failed to initialize sanctions data:', error);
  }
});
```

### Step 5: Schedule Daily Updates

**File:** `/transcend-api/src/index.ts`

```typescript
import { performDailyUpdate } from './services/sanctionsService';

// Schedule daily update at 2 AM
const schedule = require('node-schedule');

schedule.scheduleJob('0 2 * * *', async () => {
  console.log('Running scheduled sanctions list update...');
  await performDailyUpdate();
});
```

Install node-schedule:
```bash
npm install node-schedule
npm install --save-dev @types/node-schedule
```

### Step 6: Add Screening Check to Account Creation

**File:** `/transcend-api/src/services/authService.ts`

```typescript
import { screenAgainstSanctions } from './sanctionsService';

export async function registerUser(
  email: string,
  password: string,
  userType: 'client' | 'attorney' | 'firm',
  firstName?: string,
  lastName?: string
) {
  // ... existing code ...

  // Perform sanctions screening
  const screening = await screenAgainstSanctions({
    userId: newUserId,
    firstName: firstName || '',
    lastName: lastName || '',
    email,
    checkType: 'account_creation',
  });

  // Block account if sanctioned
  if (screening.status === 'blocked') {
    // Update user record
    await query(
      `UPDATE users SET sanctions_blocked = true WHERE id = $1`,
      [newUserId]
    );
    
    throw new Error('Account creation blocked due to sanctions compliance check');
  }

  // Log screening
  console.log(`User ${newUserId} passed sanctions screening`);

  return { userId: newUserId, accessToken, refreshToken };
}
```

### Step 7: Add Screening Check to Payment Processing

**File:** `/transcend-api/src/services/stripeService.ts`

```typescript
import { screenAgainstSanctions } from './sanctionsService';

export async function processPayment(userId: string, amount: number, paymentMethod: string) {
  // ... existing code ...

  // Get user details
  const userResult = await query(
    `SELECT first_name, last_name, email FROM users WHERE id = $1`,
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new Error('User not found');
  }

  const user = userResult.rows[0];

  // Screen for sanctions
  const screening = await screenAgainstSanctions({
    userId,
    firstName: user.first_name,
    lastName: user.last_name,
    email: user.email,
    checkType: 'payment_processing',
  });

  if (screening.autoBlocked) {
    throw new Error('Payment blocked due to sanctions compliance');
  }

  if (screening.status === 'manual_review' || screening.status === 'potential_match') {
    // Require manual review before processing
    console.log(`Payment for user ${userId} flagged for manual review`);
    // Return error or pending status
  }

  // Process payment as normal
  return processWithStripe(userId, amount, paymentMethod);
}
```

## Configuration

### Risk Score Thresholds

Edit in `sanctionsService.ts`:

```typescript
const RISK_SCORE_THRESHOLDS = {
  CLEAR: 20,                    // 0-20: Clear
  MANUAL_REVIEW: 50,            // 21-50: Potential match
  CONFIRMED_MATCH: 75,          // 51-75: Confirmed match
  AUTO_BLOCK: 90,               // 76-100: Auto-block
};
```

### Sanctions Lists

Configured lists in `sanctionsService.ts`:

```typescript
const SANCTIONS_LISTS = {
  'OFAC_SDN': {
    url: 'https://www.treasury.gov/ofac/downloads/sdnlist.txt',
    name: 'OFAC Specially Designated Nationals List',
    weight: 1.0,
  },
  'EU_SANCTIONS': {
    url: 'https://webgate.ec.europa.eu/...',
    name: 'EU Consolidated Sanctions List',
    weight: 0.85,
  },
  'UN_SANCTIONS': {
    url: 'https://scsanctions.un.org/resources/xml/en/consolidated.xml',
    name: 'UN Consolidated Sanctions List',
    weight: 0.9,
  },
  'UK_SANCTIONS': {
    url: 'https://www.trade-tariff.service.gov.uk/sanctions-list',
    name: 'UK Consolidated Sanctions List',
    weight: 0.8,
  },
  'OPEN_SANCTIONS': {
    url: 'https://www.opensanctions.org/api/v1/sanctions/',
    name: 'OpenSanctions Aggregated List',
    weight: 0.95,
  },
};
```

## Usage Examples

### Example 1: Screen User During Registration

```typescript
const response = await fetch('http://localhost:3000/api/sanctions/screen', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <token>',
  },
  body: JSON.stringify({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    phone: '+1-555-0123',
    dateOfBirth: '1980-01-15',
    checkType: 'account_creation',
  }),
});

const result = await response.json();
console.log('Screening Result:', result);
// {
//   "success": true,
//   "screening": {
//     "id": "uuid",
//     "userId": "uuid",
//     "status": "clear",
//     "riskScore": 15,
//     "matches": [],
//     "autoBlocked": false,
//     ...
//   }
// }
```

### Example 2: Admin Manual Review

```typescript
const response = await fetch(
  'http://localhost:3000/api/sanctions/admin/review/screening-id',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer <admin-token>',
    },
    body: JSON.stringify({
      status: 'clear',
      reviewNotes: 'Similar name match but different DOB. Confirmed not on list.',
    }),
  }
);

const result = await response.json();
console.log('Review Result:', result);
```

### Example 3: Get Pending Reviews

```typescript
const response = await fetch(
  'http://localhost:3000/api/sanctions/admin/pending-reviews?limit=50',
  {
    headers: {
      'Authorization': 'Bearer <admin-token>',
    },
  }
);

const data = await response.json();
console.log('Pending Reviews:', data.screenings);
```

### Example 4: Submit Appeal

```typescript
const response = await fetch('http://localhost:3000/api/sanctions/appeal', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <user-token>',
  },
  body: JSON.stringify({
    reason: 'This is a case of mistaken identity. My name is similar but I am a different person.',
    supportingDocuments: ['passport_url', 'id_verification_url'],
  }),
});

const result = await response.json();
console.log('Appeal submitted:', result.appeal);
```

## Risk Scoring Algorithm

The system calculates risk scores (0-100) based on:

1. **Name Matching** (Primary Factor)
   - Uses Levenshtein distance similarity
   - Threshold: 75% match required
   - Score: 0-100 based on match percentage

2. **Address Matching** (Secondary Factor)
   - Compares provided address with sanctions list addresses
   - Adds 5% to match score if address matches

3. **Date of Birth Matching** (Confirmation Factor)
   - Exact match adds 10% to score
   - Used to confirm/deny false positives

4. **Sanctions List Weight** (Multiplier)
   - OFAC SDN: 1.0x
   - OpenSanctions: 0.95x
   - UN Sanctions: 0.9x
   - EU Sanctions: 0.85x
   - UK Sanctions: 0.8x

5. **Final Calculation**
   ```
   Risk Score = (Base Match Score × List Weight) × Confirmation Factor
   Range: 0-100
   ```

## Database Views

### sanctions_statistics

Real-time sanctions screening statistics:

```sql
SELECT * FROM sanctions_statistics;
```

Returns:
- total_screened_users
- total_screenings
- clear_screenings
- potential_match_count
- confirmed_match_count
- blocked_screenings
- pending_reviews
- auto_blocked_count
- average_risk_score

## Monitoring & Maintenance

### Daily Update Job

Automatically runs at 2 AM daily:
- Downloads latest sanctions lists
- Updates database cache
- Records update status
- Logs any errors

### Manual Update

Force immediate update:

```bash
curl -X POST http://localhost:3000/api/sanctions/admin/force-update \
  -H "Authorization: Bearer <admin-token>"
```

### Update Status

Check last update times:

```bash
curl http://localhost:3000/api/sanctions/admin/update-status \
  -H "Authorization: Bearer <admin-token>"
```

## Compliance & Audit Trail

All sanctions activities are logged in `sanctions_audit_log`:

- User screening checks
- Status changes
- Manual reviews
- Blocks/Unblocks
- Appeals

**Query audit log:**

```sql
SELECT * FROM sanctions_audit_log
WHERE user_id = 'user-uuid'
ORDER BY created_at DESC;
```

## Performance Considerations

### Caching Strategy

- In-memory cache: ~24 hours
- Database cache: Full screening results
- Expiration: 7 days for clean screenings

### Optimization Tips

1. **Batch Screening**: For bulk imports
   ```typescript
   for (const user of users) {
     await screenAgainstSanctions({...});
   }
   ```

2. **Use Indexes**: Queries on:
   - `sanctions_screenings.user_id`
   - `sanctions_screenings.status`
   - `sanctions_screenings.risk_score`
   - `sanctions_audit_log.created_at`

3. **Archive Old Records**: Remove expired clear screenings
   ```sql
   DELETE FROM sanctions_screenings
   WHERE expires_at < CURRENT_TIMESTAMP AND status = 'clear';
   ```

## Error Handling

### Common Issues

1. **API Timeout**
   - Retry up to 3 times
   - Fallback to cached data

2. **Invalid Response**
   - Log error
   - Mark as 'pending'
   - Retry next update cycle

3. **Database Connection**
   - Use connection pool
   - Implement retry logic

## Legal Compliance

**IMPORTANT:** This system helps ensure compliance with:

- **OFAC Regulations** (Office of Foreign Assets Control)
- **AML/KYC Requirements** (Anti-Money Laundering/Know Your Customer)
- **EU Sanctions Regulations**
- **UN Sanctions Protocols**
- **UK Sanctions Regime**

**Note:** This system should be used in conjunction with other KYC/AML procedures and is not a substitute for comprehensive compliance review.

## Support & Maintenance

### Troubleshooting

**Issue:** API data fetch fails
```
Solution: Check external API availability, retry with exponential backoff
```

**Issue:** High risk scores for legitimate users
```
Solution: Adjust similarity threshold, add DOB verification
```

**Issue:** Database growth
```
Solution: Archive old records, implement retention policy
```

### Scheduled Tasks

- Daily: Sanctions list updates
- Weekly: Archive cleanup
- Monthly: Audit log review
- Quarterly: Compliance audit

## Future Enhancements

- [ ] Real-time streaming updates
- [ ] ML-based false positive detection
- [ ] Facial recognition integration
- [ ] Blockchain-based sanctions registry
- [ ] Multi-language name matching
- [ ] Geographic sanctions zones
- [ ] Industry-specific risk profiles
- [ ] API webhooks for integrations
