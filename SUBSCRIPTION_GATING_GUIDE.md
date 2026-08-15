# 💳 Subscription Tier Gating for Tools

**Added:** Migration 015  
**Feature:** Gate left-menu tools behind subscription tiers  
**Status:** Ready to use

---

## How It Works

### Subscription Tiers
```sql
free       → $0/month   (tier_level: 0)
starter    → $49/month  (tier_level: 1)
professional → $149/month (tier_level: 2)
enterprise → $499/month (tier_level: 3)
```

### Tool Gating
```sql
-- In persona_tools table, each tool has:
min_subscription_tier VARCHAR(50)

-- Examples:
Core Tools:
  "Legal Research Library"        → free
  "Case Management Workspace"     → free
  "Deadline/Task Manager"         → free
  
Starter Tools:
  "E-Discovery Workspace"         → starter
  "Legal Billing/Timekeeping"     → starter
  
Professional Tools:
  "Legal AI / Research Assistant" → professional
  "CRM Integration"               → professional
  
Enterprise Tools:
  "Custom Integrations"           → enterprise
  "White-glove Support"           → enterprise
```

---

## Database Schema

### subscription_tiers
```sql
CREATE TABLE subscription_tiers (
  id SERIAL PRIMARY KEY,
  tier_key VARCHAR(100) UNIQUE,     -- 'free', 'starter', 'professional', 'enterprise'
  tier_name VARCHAR(255),           -- Display name
  tier_level INT,                   -- 0, 1, 2, 3 (for comparison)
  monthly_price DECIMAL(10,2),
  features TEXT[],                  -- ['feature1', 'feature2']
  description TEXT
);
```

### persona_tools (UPDATED)
```sql
ALTER TABLE persona_tools ADD COLUMN min_subscription_tier VARCHAR(50) DEFAULT 'free';

-- Example row:
INSERT INTO persona_tools (persona_id, tool_id, min_subscription_tier)
VALUES (2, 100, 'professional');  -- This tool requires Professional tier

-- Query to check access:
SELECT t.tool_name, pt.min_subscription_tier
FROM persona_tools pt
JOIN tools t ON pt.tool_id = t.id
WHERE pt.persona_id = 2 -- Lawyer
  AND pt.min_subscription_tier = 'professional' -- Only Professional tier tools
```

### user_subscriptions
```sql
CREATE TABLE user_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  subscription_tier_id INT REFERENCES subscription_tiers(id),
  status VARCHAR(50), -- 'active', 'expired', 'cancelled'
  expires_at TIMESTAMP,
  auto_renew BOOLEAN DEFAULT true
);

-- Example:
-- User 42 has Professional tier
INSERT INTO user_subscriptions (user_id, subscription_tier_id, status, expires_at)
VALUES (42, 2, 'active', '2027-08-15');
```

### companies (UPDATED)
```sql
ALTER TABLE companies ADD COLUMN subscription_tier_id INT REFERENCES subscription_tiers(id);
ALTER TABLE companies ADD COLUMN subscription_status VARCHAR(50) DEFAULT 'free';
ALTER TABLE companies ADD COLUMN subscription_expires_at TIMESTAMP;

-- Track which company has what tier
UPDATE companies SET subscription_tier_id = 2, subscription_status = 'active'
WHERE id = 1; -- Company 1 has Professional tier
```

---

## How to Use in Code

### Backend: Get Menu with Subscription Gating

```typescript
// Get user's subscription tier
const subscription = await db.query(
  `SELECT st.tier_key FROM user_subscriptions us
   JOIN subscription_tiers st ON us.subscription_tier_id = st.id
   WHERE us.user_id = $1 AND us.status = 'active'`,
  [userId]
);

const userTier = subscription.rows[0]?.tier_key || 'free';

// Get menu (only tools they have access to)
const menu = await personaService.getMenuForPersona(
  personaId,
  practiceAreaId,
  userId,
  userTier  // ← NEW: Pass subscription tier
);

// Response automatically filters tools by tier
// Free users see: Legal Research, Case Management, Deadline Manager
// Pro users see: ^^ + E-Discovery, Legal AI, Custom Features
```

### Frontend: Show Locked Tools

```typescript
<DynamicLeftMenu
  personaId={2}
  personaName="Lawyer"
  personaIcon="⚖️"
  subscriptionTier="professional"  // ← NEW: Pass current tier
  onSelectTool={(tool) => {
    if (!tool.is_available) {
      // Show upgrade prompt
      setShowUpgradeModal(tool.min_subscription_tier);
    } else {
      // Open tool
      openTool(tool);
    }
  }}
/>
```

### Update Frontend Component

```typescript
interface DynamicLeftMenuProps {
  personaId: number;
  personaName: string;
  personaIcon: string;
  practiceAreaId?: number;
  subscriptionTier?: 'free' | 'starter' | 'professional' | 'enterprise'; // ← NEW
  onSelectTool?: (tool: Tool) => void;
}

export const DynamicLeftMenu: React.FC<DynamicLeftMenuProps> = ({
  personaId,
  personaName,
  personaIcon,
  subscriptionTier = 'free',
  onSelectTool
}) => {
  // Fetch menu with tier filter
  const url = new URL(`/api/v2/personas/${personaId}/menu`, location.origin);
  if (subscriptionTier !== 'free') {
    url.searchParams.append('tier', subscriptionTier);
  }
  
  // Rest of component...
};
```

---

## Setting Up Tiers

### For a New Company

```sql
-- Option 1: Free tier (default)
INSERT INTO companies (company_name, subscription_tier_id, subscription_status)
VALUES ('New Firm LLC', NULL, 'free');
-- Tools: only those with min_subscription_tier = 'free'

-- Option 2: Paid tier
INSERT INTO companies (company_name, subscription_tier_id, subscription_status, subscription_expires_at)
VALUES ('Premium Firm Inc', 2, 'active', '2027-08-15');
-- Tools: free + professional + starter
```

### For an Existing User

```sql
-- Upgrade user to Professional
INSERT INTO user_subscriptions (user_id, subscription_tier_id, status, expires_at, auto_renew)
VALUES (42, 2, 'active', '2027-08-15', true);

-- Check what tools they now have access to
SELECT t.tool_name, pt.min_subscription_tier, true as is_available
FROM persona_tools pt
JOIN tools t ON pt.tool_id = t.id
WHERE pt.persona_id = 2
  AND pt.min_subscription_tier IN ('free', 'starter', 'professional');
```

---

## Gating Individual Tools

### Mark a Tool as Paid

```sql
-- E-Discovery is only for Professional+ tiers
UPDATE persona_tools
SET min_subscription_tier = 'professional'
WHERE tool_id = (SELECT id FROM tools WHERE tool_key = 'e_discovery');

-- Now only Professional/Enterprise users see it
```

### Tool Availability Matrix

| Tool | Free | Starter | Pro | Enterprise |
|------|------|---------|-----|------------|
| Legal Research | ✅ | ✅ | ✅ | ✅ |
| Case Management | ✅ | ✅ | ✅ | ✅ |
| E-Discovery | ❌ | ❌ | ✅ | ✅ |
| Legal AI | ❌ | ❌ | ✅ | ✅ |
| Custom Integrations | ❌ | ❌ | ❌ | ✅ |

---

## Billing Integration

### When User Upgrades

```typescript
// User clicks "Upgrade to Professional"
const createSubscription = async (userId: number, tierId: number) => {
  // 1. Create/update Stripe subscription
  const stripeSubscription = await stripe.subscriptions.create({
    customer: user.stripe_customer_id,
    items: [{ price: PROFESSIONAL_PRICE_ID }],
    metadata: { user_id: userId }
  });

  // 2. Record in database
  await db.query(
    `INSERT INTO user_subscriptions (user_id, subscription_tier_id, status, expires_at)
     VALUES ($1, $2, 'active', NOW() + INTERVAL '1 month')`,
    [userId, tierId]
  );

  // 3. Menu automatically updates (new tools now visible)
};
```

### When Subscription Expires

```typescript
// Scheduled job (daily)
const expireSubscriptions = async () => {
  await db.query(
    `UPDATE user_subscriptions
     SET status = 'expired'
     WHERE status = 'active' AND expires_at < NOW()`
  );

  // Menu automatically reverts to 'free' tier tools next login
};
```

---

## Show "Upgrade" Badges

### In Left Menu Component

```typescript
// When a tool requires a higher tier
if (tool.min_subscription_tier !== 'free' && userTier !== tool.min_subscription_tier) {
  return (
    <div className="tool-item locked">
      <span className="tool-name">{tool.tool_name}</span>
      <span className="upgrade-badge">
        Upgrade to {tool.min_subscription_tier}
      </span>
    </div>
  );
}
```

### CSS for Locked Tools

```css
.tool-item.locked {
  opacity: 0.6;
  cursor: not-allowed;
}

.upgrade-badge {
  font-size: 10px;
  background: #fbbf24;
  color: #78350f;
  padding: 2px 6px;
  border-radius: 12px;
  font-weight: 600;
  text-transform: capitalize;
}

.tool-item.locked:hover {
  background: transparent;
  cursor: pointer;
  /* Show upgrade modal on click */
}
```

---

## Migration Path

### Users Start Free
```
Day 1: User signs up → tier = free → sees basic tools
```

### User Upgrades
```
Day 30: User upgrades to Starter → tier = starter → sees starter tools unlocked
```

### Company Goes Pro
```
Day 60: Company upgrades to Professional → All users see Pro tools
```

### Feature Rollout
```
New tool "Legal AI Assistant" released:
  1. Create tool row in tools table
  2. Assign to personas via persona_tools (with min_subscription_tier = 'professional')
  3. Tool automatically appears only for Pro+ users
  4. No code changes needed!
```

---

## Why This Design

✅ **Flexible**: Add/remove tiers without code changes  
✅ **Scalable**: Works for 10 tools or 1000  
✅ **User-friendly**: Locked tools show "Upgrade to X" message  
✅ **Audit-friendly**: subscription_audit_log tracks all changes  
✅ **Revenue-friendly**: Easy to A/B test pricing & feature sets  
✅ **Backward compatible**: Default = free, existing users unaffected  

---

## Next Steps

1. **Set up Stripe integration** (billing)
2. **Add upgrade flow** (modal prompts)
3. **Create billing dashboard** (manage subscriptions)
4. **Set up webhooks** (sync Stripe + DB)
5. **Track usage** (who uses what tools, usage patterns)

---

## Questions?

- How do I charge for a tool? → Set `min_subscription_tier` to 'starter', 'professional', or 'enterprise'
- How do I give a free trial? → Set `expires_at` to future date with `auto_renew = false`
- How do I offer a discount? → Modify Stripe pricing, keep DB tier_level the same
- How do I track adoption? → Query subscription_audit_log and user_subscriptions

