# OFAC Sanctions Screening - Deployment Checklist

## Pre-Deployment Review

- [ ] Review SANCTIONS_SCREENING_IMPLEMENTATION.md
- [ ] Review SANCTIONS_API_REFERENCE.md
- [ ] Review code for sanctionsService.ts
- [ ] Review database migration SQL
- [ ] Review sanctionsRoutes.ts
- [ ] Discuss compliance requirements with legal team
- [ ] Verify OFAC/EU/UN/UK API access

## Environment Setup

### Step 1: Install Dependencies

```bash
# Navigate to project root
cd /Users/jbconsultingassociatesinc./code/transcend-ssp

# Install new dependency
npm install axios

# Verify installation
npm list axios
```

- [ ] axios installed
- [ ] package.json updated
- [ ] package-lock.json updated

### Step 2: Database Migration

```bash
# Connect to PostgreSQL
psql -U postgres -d transcend_law_db

# Run migration
\i transcend-api/src/database/migrations/002_sanctions_screening.sql

# Verify tables created
\dt sanctions_*
\dt | grep sanctions
```

**Verify these tables exist:**
- [ ] sanctions_screenings
- [ ] sanctions_matches
- [ ] sanctions_list_updates
- [ ] sanctions_audit_log
- [ ] sanctions_blocked_users
- [ ] sanctions_appeals

**Verify these views exist:**
- [ ] sanctions_statistics

**Verify columns added to users:**
- [ ] sanctions_blocked
- [ ] last_sanctions_screening_at
- [ ] last_sanctions_screening_status

### Step 3: Code Integration

**File: `/transcend-api/src/index.ts`**

Add imports:
```typescript
import sanctionsRoutes from './routes/sanctionsRoutes';
import { initializeSanctionsData, performDailyUpdate } from './services/sanctionsService';
import schedule from 'node-schedule';
```

Add route registration:
```typescript
// Mount sanctions routes (before other routes)
app.use('/api/sanctions', sanctionsRoutes);
```

Add initialization:
```typescript
const server = app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  try {
    console.log('Initializing sanctions data...');
    await initializeSanctionsData();
    console.log('Sanctions data initialized');
  } catch (error) {
    console.error('Failed to initialize sanctions data:', error);
    // Don't crash - sanctions is not critical for startup
  }
});
```

Add daily update job:
```typescript
// Schedule daily sanctions list update at 2 AM
schedule.scheduleJob('0 2 * * *', async () => {
  console.log('Running scheduled sanctions list update...');
  try {
    await performDailyUpdate();
  } catch (error) {
    console.error('Scheduled update failed:', error);
  }
});

// Initial update on startup (after 1 minute)
setTimeout(async () => {
  try {
    await performDailyUpdate();
  } catch (error) {
    console.error('Initial update failed:', error);
  }
}, 60000);
```

- [ ] Imports added
- [ ] Routes registered
- [ ] Initialization code added
- [ ] Daily job scheduled
- [ ] Error handling in place

### Step 4: Auth Service Integration

**File: `/transcend-api/src/services/authService.ts`**

Add import:
```typescript
import { screenAgainstSanctions } from './sanctionsService';
```

Update registerUser function:
```typescript
export async function registerUser(
  email: string,
  password: string,
  userType: 'client' | 'attorney' | 'firm',
  firstName?: string,
  lastName?: string
): Promise<{ userId: string; accessToken: string; refreshToken: string }> {
  return transaction(async (client) => {
    try {
      // ... existing code ...

      // Perform sanctions screening BEFORE creating user
      const screening = await screenAgainstSanctions({
        userId: 'temp', // Use temp ID for screening
        firstName: firstName || '',
        lastName: lastName || '',
        email,
        checkType: 'account_creation',
      });

      // Check if auto-blocked
      if (screening.status === 'blocked') {
        throw new Error('Account creation blocked: User appears on sanctions list. Please contact support.');
      }

      // If manual review needed, allow but flag
      if (screening.status === 'manual_review' || screening.status === 'confirmed_match') {
        console.warn(`User registration flagged for manual review: ${email}`, {
          screeningId: screening.id,
          riskScore: screening.riskScore,
        });
        // Could add flag to user record for review
      }

      // Create user (rest of existing code)
      const userResult = await query(
        `INSERT INTO users (email, password_hash, user_type, first_name, last_name)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [email, passwordHash, userType, firstName, lastName]
      );

      const userId = userResult.rows[0].id;

      // Update user's sanctions screening record
      await query(
        `UPDATE sanctions_screenings
         SET user_id = $1 WHERE user_id = $2`,
        [userId, 'temp']
      );

      // Rest of existing code...
      return { userId, accessToken, refreshToken };
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  });
}
```

- [ ] Sanctions screening added to registration
- [ ] Auto-block check implemented
- [ ] Manual review flagging added
- [ ] Error handling for blocked users

### Step 5: Payment Service Integration (Optional)

**File: `/transcend-api/src/services/stripeService.ts`**

Add import:
```typescript
import { screenAgainstSanctions } from './sanctionsService';
```

Update payment processing:
```typescript
export async function processPayment(userId: string, amount: number) {
  try {
    // Get user info
    const userResult = await query(
      `SELECT first_name, last_name, email, sanctions_blocked FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult.rows[0];

    // Check if already blocked
    if (user.sanctions_blocked) {
      throw new Error('Payment rejected: Account is blocked for compliance reasons');
    }

    // Perform screening
    const screening = await screenAgainstSanctions({
      userId,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      checkType: 'payment_processing',
    });

    // Check result
    if (screening.autoBlocked) {
      throw new Error('Payment blocked: Sanctions list match detected');
    }

    if (screening.status === 'confirmed_match' || screening.status === 'manual_review') {
      throw new Error('Payment pending compliance review. Please contact support.');
    }

    // Proceed with payment
    return processWithStripe(userId, amount);
  } catch (error) {
    console.error('Payment processing error:', error);
    throw error;
  }
}
```

- [ ] Sanctions check added to payment processing
- [ ] Block check implemented
- [ ] Manual review flag added

### Step 6: Testing

**Unit Tests:**

```bash
# Create test file
touch transcend-api/src/services/__tests__/sanctionsService.test.ts
```

```typescript
import {
  screenAgainstSanctions,
  calculateSimilarity,
  getStatusFromRiskScore,
} from '../sanctionsService';

describe('Sanctions Service', () => {
  it('should screen clean user', async () => {
    const result = await screenAgainstSanctions({
      userId: 'test-user',
      firstName: 'John',
      lastName: 'Smith',
      email: 'test@example.com',
      checkType: 'account_creation',
    });

    expect(result.status).toBe('clear');
    expect(result.riskScore).toBeLessThan(20);
  });

  it('should calculate name similarity', () => {
    const similarity = calculateSimilarity('John Doe', 'John Doe');
    expect(similarity).toBe(1.0);

    const similarity2 = calculateSimilarity('John Doe', 'Jon Doe');
    expect(similarity2).toBeGreaterThan(0.75);
  });

  it('should determine status from risk score', () => {
    expect(getStatusFromRiskScore(15)).toBe('clear');
    expect(getStatusFromRiskScore(35)).toBe('potential_match');
    expect(getStatusFromRiskScore(65)).toBe('confirmed_match');
    expect(getStatusFromRiskScore(95)).toBe('blocked');
  });
});
```

- [ ] Unit tests created
- [ ] Tests passing
- [ ] Edge cases covered

**Integration Tests:**

```bash
# Test endpoints with live database
npm test -- sanctionsRoutes.test.ts
```

- [ ] API endpoint tests
- [ ] Database tests
- [ ] Error handling tests

**Manual Testing:**

1. **Test screening endpoint:**
```bash
curl -X POST http://localhost:3000/api/sanctions/screen \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "checkType": "account_creation"
  }'
```

- [ ] Screening endpoint working
- [ ] Returns proper response format
- [ ] Status codes correct

2. **Test history endpoint:**
```bash
curl http://localhost:3000/api/sanctions/user/history \
  -H "Authorization: Bearer $TOKEN"
```

- [ ] History endpoint working
- [ ] Returns screening records

3. **Test admin endpoints:**
```bash
curl http://localhost:3000/api/sanctions/admin/pending-reviews \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

- [ ] Admin pending reviews working
- [ ] Requires admin token
- [ ] Returns pending screenings

4. **Test registration:**
- [ ] Register new user
- [ ] Verify sanctions screening occurs
- [ ] Check database records created
- [ ] Verify audit log entry

- [ ] Manual endpoint testing complete
- [ ] Database records verified
- [ ] Audit trail verified

### Step 7: Configuration

**Environment Variables:**

Add to `.env`:
```
# Sanctions Screening
SANCTIONS_ENABLED=true
SANCTIONS_UPDATE_SCHEDULE="0 2 * * *"
SANCTIONS_RISK_THRESHOLD_AUTO_BLOCK=90
SANCTIONS_RISK_THRESHOLD_MANUAL_REVIEW=50
```

- [ ] Environment variables set
- [ ] Config validated

**Update limits and weights (if needed):**

Edit `sanctionsService.ts`:
- [ ] Risk score thresholds adjusted
- [ ] Sanctions list weights configured
- [ ] Cache duration set

### Step 8: Monitoring & Logging

Setup monitoring:

```typescript
// Add to index.ts
setInterval(async () => {
  try {
    const stats = await query(`SELECT * FROM sanctions_statistics`);
    console.log('Sanctions Statistics:', stats.rows[0]);
  } catch (error) {
    console.error('Stats check failed:', error);
  }
}, 3600000); // Every hour
```

- [ ] Monitoring setup
- [ ] Logging configured
- [ ] Alert system ready

### Step 9: Documentation

- [ ] SANCTIONS_SCREENING_IMPLEMENTATION.md reviewed
- [ ] SANCTIONS_API_REFERENCE.md reviewed
- [ ] SANCTIONS_DEPLOYMENT_CHECKLIST.md completed
- [ ] Team trained on endpoints
- [ ] Support procedures documented

### Step 10: Deployment

**Staging Deployment:**

```bash
# Build
npm run build

# Test in staging
npm start

# Run tests
npm test

# Check database migrations
psql -c "SELECT COUNT(*) FROM sanctions_screenings"
```

- [ ] Build successful
- [ ] Tests passing
- [ ] Database migrations applied
- [ ] Staging deployment verified

**Production Deployment:**

```bash
# Backup database
pg_dump transcend_law_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Deploy code
git push production main

# Run migrations
psql -d transcend_law_db -f migrations/002_sanctions_screening.sql

# Initialize data
curl -X POST http://production.example.com/api/sanctions/admin/force-update \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Verify
curl http://production.example.com/api/sanctions/admin/statistics \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

- [ ] Database backup created
- [ ] Production code deployed
- [ ] Migrations applied
- [ ] Initial data loaded
- [ ] Verification passed

### Step 11: Post-Deployment

**Monitoring:**

- [ ] Check application logs
- [ ] Verify screening records in database
- [ ] Check update status
- [ ] Monitor performance metrics

**Operations:**

- [ ] Team notified of new feature
- [ ] Support documentation updated
- [ ] Legal/Compliance team briefed
- [ ] Incident response procedures updated

**Optimization:**

- [ ] Profile database queries
- [ ] Optimize indexes if needed
- [ ] Adjust cache settings based on usage
- [ ] Monitor API response times

## Maintenance Schedule

### Daily
- [ ] Review pending reviews (manual_review queue)
- [ ] Check sanctioned list updates completed
- [ ] Monitor system performance

### Weekly
- [ ] Review appeals queue
- [ ] Check audit logs for anomalies
- [ ] Verify backup integrity

### Monthly
- [ ] Review screening statistics
- [ ] Analyze false positive rate
- [ ] Update risk thresholds if needed
- [ ] Compliance audit review

### Quarterly
- [ ] Full compliance audit
- [ ] Update procedures documentation
- [ ] Staff training refresh
- [ ] Performance optimization review

## Rollback Plan

If issues occur:

```bash
# Rollback code
git revert <commit-hash>
npm run build
npm restart

# Keep data (do not drop tables)
# Verify sanity with:
psql -c "SELECT COUNT(*) FROM sanctions_screenings"

# Disable sanctions checking temporarily:
UPDATE users SET sanctions_blocked = false WHERE sanctions_blocked = true
```

**Rollback Steps:**
- [ ] Stop screening checks
- [ ] Revert code to previous version
- [ ] Verify application stability
- [ ] Contact legal team if needed
- [ ] Post-mortem analysis

## Compliance & Legal

- [ ] OFAC regulations reviewed
- [ ] AML/KYC procedures documented
- [ ] Data retention policy established
- [ ] Privacy compliance verified
- [ ] Legal sign-off obtained
- [ ] Insurance coverage verified

## Success Criteria

- [ ] All endpoints functional
- [ ] Screening works on account creation
- [ ] Screening works on payments
- [ ] Admin can review results
- [ ] Audit trail complete
- [ ] Daily updates working
- [ ] Appeals process working
- [ ] Performance acceptable (<500ms screening)
- [ ] No false positives exceeding 5%
- [ ] 99.9% uptime

## Sign-Off

- Project Manager: _________________ Date: _______
- Technical Lead: _________________ Date: _______
- Compliance Officer: _________________ Date: _______
- Legal Counsel: _________________ Date: _______

## Notes

```
[Space for deployment notes and issues encountered]




```
