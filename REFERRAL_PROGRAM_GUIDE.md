# Referral Program Implementation Guide

## Overview

The Transcend Referral Program enables users to refer friends and family, earning $50 in account credit for each successful referral while referred users receive 20% off their first month.

## System Architecture

### Backend Service (`referralService.ts`)

Located at: `/transcend-api/services/referralService.ts`

**Key Classes:**
- `ReferralService` - Main service handling all referral operations
- `createReferralService()` - Factory function for service instantiation

**Enums:**
- `ReferralStatus` - PENDING, VERIFIED, EXPIRED, CANCELLED
- `RewardStatus` - PENDING, APPROVED, PAID, REJECTED

### Frontend Component (`ReferralWidget.tsx`)

Located at: `/transcend-frontend/src/components/ReferralWidget.tsx`

**Features:**
- Display user's referral code
- Share code via multiple platforms (Email, Twitter, Facebook, LinkedIn, WhatsApp)
- Track referral statistics and earnings
- View reward status
- Generate new referral codes

### Database Schema (`schema-referral.sql`)

Located at: `/transcend-api/database/schema-referral.sql`

**Tables:**
- `referral_codes` - Active referral codes
- `referrals` - Referral tracking
- `referral_rewards` - Rewards for referrer and referred
- `referral_stats_cache` - Cached stats for performance
- `referral_payout_history` - Payout audit trail
- `referral_events` - Event logging for auditing

## Installation

### 1. Database Setup

Run the schema migration:

```bash
psql -U postgres -d transcend -f transcend-api/database/schema-referral.sql
```

### 2. Environment Variables

Add to `.env`:

```env
# Referral Program
REFERRAL_EXPIRATION_DAYS=90
REFERRAL_MAX_CODES_PER_USER=5
REFERRAL_REFERRER_REWARD=50
REFERRAL_REFERRED_DISCOUNT=0.2

# Payout Processing
STRIPE_API_KEY=sk_test_xxx
PAYPAL_API_KEY=xxx
```

### 3. Service Initialization

```typescript
import { createReferralService } from './services/referralService';
import Redis from 'ioredis';

// Create service instance
const redisClient = new Redis();
const referralService = createReferralService(redisClient, dbClient);

// Export for use in routes/middleware
export { referralService };
```

### 4. API Routes

Create routes file: `/transcend-api/routes/referralRoutes.ts`

```typescript
import express from 'express';
import { referralService } from '../services/referralService';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Generate new referral code
router.post('/generate-code', authenticateToken, async (req, res) => {
  try {
    const { userId, expirationDays = 90, maxUses = 100 } = req.body;
    const code = await referralService.generateReferralCode(
      userId,
      expirationDays,
      maxUses
    );
    res.json(code);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get user's referral codes
router.get('/codes/:userId', authenticateToken, async (req, res) => {
  try {
    const codes = await referralService.getUserReferralCodes(req.params.userId);
    res.json(codes);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Validate referral code (used during signup)
router.post('/validate', async (req, res) => {
  try {
    const { code } = req.body;
    const validCode = await referralService.validateReferralCode(code);
    if (validCode) {
      res.json({ valid: true, code: validCode });
    } else {
      res.json({ valid: false });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get referral statistics
router.get('/stats/:userId', authenticateToken, async (req, res) => {
  try {
    const stats = await referralService.getReferralStats(req.params.userId);
    res.json(stats);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get user rewards
router.get('/rewards/:userId', authenticateToken, async (req, res) => {
  try {
    const rewards = await referralService.getUserRewards(req.params.userId);
    res.json(rewards);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Admin: Get dashboard data
router.get('/admin/dashboard', authenticateToken, adminOnly, async (req, res) => {
  try {
    const data = await referralService.getAdminDashboardData();
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Admin: Get leaderboard
router.get('/admin/leaderboard', authenticateToken, adminOnly, async (req, res) => {
  try {
    const leaderboard = await referralService.getReferralLeaderboard(10);
    res.json(leaderboard);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Admin: Process payouts
router.post('/admin/process-payouts', authenticateToken, adminOnly, async (req, res) => {
  try {
    const { limit = 100, payoutMethod = 'stripe' } = req.body;
    const results = await referralService.processPayouts(limit, payoutMethod);
    res.json(results);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Admin: Export data
router.get('/admin/export', authenticateToken, adminOnly, async (req, res) => {
  try {
    const filters = req.query;
    const data = await referralService.exportReferralData(filters);
    const csv = referralService.generateCSVContent(data);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="referrals.csv"');
    res.send(csv);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
```

### 5. Signup Integration

During user signup with referral code:

```typescript
// In signup endpoint
if (referralCode) {
  // Validate the code first
  const validCode = await referralService.validateReferralCode(referralCode);
  if (!validCode) {
    return res.status(400).json({ error: 'Invalid referral code' });
  }

  // Create user first
  const newUser = await createUser(userData);

  // Create referral record
  const referral = await referralService.createReferral(
    validCode.referrerId,
    referralCode,
    newUser.id,
    newUser.email
  );

  // Apply discount to new user
  await applyDiscount(newUser.id, 20); // 20% off first month
}
```

### 6. Verification Trigger

When referred user completes first purchase:

```typescript
// In order completion handler
const referral = await referralService.getReferral(referralId);
if (referral && referral.status === 'pending') {
  // Verify the referral
  const verified = await referralService.verifyReferral(referral.id);
  
  // This automatically creates rewards for both parties
  // Referrer gets $50 credit
  // Referred user discount is already applied
}
```

## Frontend Integration

### Using the Referral Widget

```tsx
import ReferralWidget from './components/ReferralWidget';

function Dashboard() {
  return (
    <div>
      <ReferralWidget
        userId={currentUser.id}
        onSuccess={(msg) => showNotification(msg)}
        onError={(err) => showError(err)}
      />
    </div>
  );
}
```

### Custom Integration

If you prefer custom UI:

```tsx
import { referralService } from '@/api/services';

function CustomReferralUI() {
  const [code, setCode] = useState('');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    // Fetch referral data
    const fetchData = async () => {
      const c = await fetch(`/api/v2/referrals/codes/${userId}`);
      const s = await fetch(`/api/v2/referrals/stats/${userId}`);
      setCode((await c.json())[0]?.code);
      setStats(await s.json());
    };
    fetchData();
  }, [userId]);

  const handleShare = () => {
    const url = `${window.location.origin}/signup?ref=${code}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <div>
      <p>Your code: {code}</p>
      <p>Referrals: {stats?.totalReferrals}</p>
      <button onClick={handleShare}>Share</button>
    </div>
  );
}
```

## Reward System

### For Referrer (Person who refers)
- **Reward Type**: Credit
- **Amount**: $50 USD
- **When**: Triggered when referral is verified
- **Status**: PENDING → APPROVED → PAID

### For Referred (New user)
- **Reward Type**: Discount
- **Amount**: 20% off
- **When**: Applied immediately on signup with code
- **Duration**: First month only

## Payout Processing

### Manual Payout Process

```bash
curl -X POST http://localhost:3000/api/v2/referrals/admin/process-payouts \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "limit": 100,
    "payoutMethod": "stripe"
  }'
```

### Automated Payout (Recommended)

Set up a cron job:

```typescript
// In your job scheduler
import { schedule } from 'node-cron';

// Process payouts daily at 2 AM
schedule('0 2 * * *', async () => {
  try {
    const results = await referralService.processPayouts(100, 'stripe');
    console.log(`Payouts processed: ${results.successful} successful, ${results.failed} failed`);
  } catch (error) {
    console.error('Payout processing failed:', error);
  }
});

// Cleanup expired referrals daily at 3 AM
schedule('0 3 * * *', async () => {
  try {
    const count = await referralService.cleanupExpiredReferrals();
    console.log(`Cleaned up ${count} expired referrals`);
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
});
```

## Admin Dashboard

### Access Admin Features

1. **Dashboard Data**
```bash
GET /api/v2/referrals/admin/dashboard
```

Response:
```json
{
  "totalReferrals": 1250,
  "verifiedReferrals": 890,
  "conversionRate": 71.2,
  "totalRewards": 44500,
  "paidRewards": 35200,
  "totalRewardAmount": 44500,
  "totalPaidAmount": 35200
}
```

2. **Leaderboard**
```bash
GET /api/v2/referrals/admin/leaderboard?limit=10
```

3. **Export Data**
```bash
GET /api/v2/referrals/admin/export?startDate=2024-01-01&endDate=2024-12-31
```

## Data Export

### CSV Format

Export includes:
- Referral ID
- Referrer Name & Email
- Referred Name & Email
- Status
- Referral Code
- Created At
- Verified At
- Reward Amount
- Reward Status

### Export Example

```typescript
const data = await referralService.exportReferralData({
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  status: 'verified'
});

const csv = referralService.generateCSVContent(data);
// Download as file
```

## Security Considerations

1. **Code Uniqueness**: Codes are 8-character random alphanumeric strings with collision detection
2. **Expiration**: Codes expire after 90 days (configurable)
3. **Limitations**: Each user can have max 5 active codes
4. **Fraud Prevention**: 
   - Only one referral per referred user per code
   - Referrer cannot refer themselves
   - Verification required for reward activation

## Monitoring & Analytics

### Key Metrics

```sql
-- Conversion rate
SELECT
  COUNT(CASE WHEN status = 'verified' THEN 1 END)::float / 
  COUNT(*)::float * 100 as conversion_rate
FROM referrals;

-- Top referrers
SELECT
  referrer_id,
  COUNT(*) as referral_count,
  SUM(CASE WHEN status = 'verified' THEN 1 ELSE 0 END) as verified_count
FROM referrals
GROUP BY referrer_id
ORDER BY verified_count DESC
LIMIT 10;

-- Revenue impact
SELECT
  COUNT(*) as referred_users,
  COUNT(CASE WHEN status = 'verified' THEN 1 END) as verified_users,
  (COUNT(CASE WHEN status = 'verified' THEN 1 END) * 50.00) as referrer_costs,
  (COUNT(CASE WHEN status = 'verified' THEN 1 END) * avg_customer_lifetime_value * 0.20) as discount_costs
FROM referrals r
LEFT JOIN customers c ON r.referred_user_id = c.user_id;
```

## Testing

### Unit Tests

```typescript
import { createReferralService } from './referralService';
import Redis from 'ioredis';

describe('ReferralService', () => {
  let service: ReferralService;
  let redis: Redis;

  beforeEach(() => {
    redis = new Redis();
    service = createReferralService(redis, dbClient);
  });

  it('should generate unique referral code', async () => {
    const code1 = await service.generateReferralCode('user1');
    const code2 = await service.generateReferralCode('user1');
    expect(code1.code).not.toEqual(code2.code);
  });

  it('should validate referral code', async () => {
    const code = await service.generateReferralCode('user1');
    const validated = await service.validateReferralCode(code.code);
    expect(validated).not.toBeNull();
  });

  it('should create referral', async () => {
    const code = await service.generateReferralCode('user1');
    const referral = await service.createReferral(
      'user1',
      code.code,
      'user2',
      'user2@example.com'
    );
    expect(referral.status).toBe('pending');
  });

  it('should verify referral', async () => {
    // Create referral flow
    const verified = await service.verifyReferral(referral.id);
    expect(verified.status).toBe('verified');
    expect(verified.verifiedAt).not.toBeNull();
  });
});
```

### Integration Tests

```typescript
// Test full referral flow
describe('Full Referral Flow', () => {
  it('should complete referral to payout', async () => {
    // 1. Generate code
    const code = await service.generateReferralCode('referrer@example.com');
    
    // 2. Create referral
    const referral = await service.createReferral(
      'referrer_id',
      code.code,
      'referred_id',
      'referred@example.com'
    );
    
    // 3. Verify referral
    const verified = await service.verifyReferral(referral.id);
    
    // 4. Check rewards created
    const rewards = await service.getUserRewards('referrer_id');
    expect(rewards[0].status).toBe('pending');
    
    // 5. Approve reward
    const approved = await service.approveReward(rewards[0].id);
    
    // 6. Process payout
    const payout = await service.processPayouts(1, 'stripe');
    expect(payout.successful).toBe(1);
  });
});
```

## Troubleshooting

### Issue: Code not generating
- Check Redis connection
- Verify database connection
- Ensure user exists in database

### Issue: Referral not verifying
- Confirm referred user exists
- Check referral hasn't expired (90 days)
- Verify user hasn't already been referred

### Issue: Payout failing
- Check Stripe/PayPal API keys
- Verify reward status is 'approved'
- Check user payment method on file

## Support & Documentation

For issues or questions:
1. Check the service documentation in `/referralService.ts`
2. Review the database schema in `/schema-referral.sql`
3. Test using provided unit test examples
4. Check admin dashboard for metrics

## Compliance

- All referral data is encrypted in transit (HTTPS)
- Payout history is audited and logged
- GDPR compliant data export available
- PCI-DSS compliant for payment processing
