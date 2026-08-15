# Phase 2 Deployment Guide - Option B

**Goal:** Run database migrations → Deploy to staging → Test all v2 endpoints → Then Phase 3

**Timeline:** 2-3 hours total

---

## Step 1: Run Database Migrations (30 min)

### 1.1 Ensure PostgreSQL is running
```bash
# Check if postgres is running
psql --version

# If using Docker
docker-compose up -d postgres redis
```

### 1.2 Run migrations
```bash
cd transcend-law/backend

# Run all migrations (010-015)
npm run migrate

# Or manually:
psql -U transcend -d transcend_db < src/migrations/010_create_services_table.sql
psql -U transcend -d transcend_db < src/migrations/011_create_tools_table.sql
psql -U transcend -d transcend_db < src/migrations/012_create_personas_table.sql
psql -U transcend -d transcend_db < src/migrations/013_create_persona_junctions.sql
psql -U transcend -d transcend_db < src/migrations/014_extend_tools_and_practice_areas.sql
psql -U transcend -d transcend_db < src/migrations/015_add_subscription_gating.sql
```

### 1.3 Verify migrations ran
```bash
psql -U transcend -d transcend_db -c "SELECT COUNT(*) FROM services;"
# Should return: count = 48

psql -U transcend -d transcend_db -c "SELECT COUNT(*) FROM personas;"
# Should return: count = 15

psql -U transcend -d transcend_db -c "SELECT COUNT(*) FROM tools;"
# Should return: count > 300
```

---

## Step 2: Start Backend (15 min)

### 2.1 Install dependencies
```bash
cd transcend-law/backend
npm install
```

### 2.2 Configure environment
```bash
# Copy .env.example to .env if not already done
cp .env.example .env

# Update .env with:
DATABASE_URL=postgresql://transcend:password@localhost:5432/transcend_db
REDIS_URL=redis://localhost:6379
NODE_ENV=development
PORT=3000
```

### 2.3 Start backend
```bash
npm run dev

# Output should show:
# Transcend Law API listening on port 3000
# Environment: development
```

---

## Step 3: Test All Phase 2 API Endpoints (60 min)

### Test Group 1: Core Personas & Marketplace (Phase 1 - should still work)

```bash
# Get all personas (15)
curl http://localhost:3000/api/v2/personas

# Get Lawyer persona
curl http://localhost:3000/api/v2/personas/2

# Get Lawyer's menu (tools)
curl http://localhost:3000/api/v2/personas/2/menu

# Get Lawyer's marketplace (services in priority order)
curl http://localhost:3000/api/v2/personas/2/marketplace

# Get all services (48)
curl http://localhost:3000/api/v2/services
```

**Expected:** All return 200 with correct counts

---

### Test Group 2: Companies (NEW - Phase 2)

```bash
# Get companies offering "Lawyer" service (id=1)
curl http://localhost:3000/api/v2/companies/service/1

# Search companies
curl "http://localhost:3000/api/v2/companies/search/smith"

# Get verified companies only
curl "http://localhost:3000/api/v2/companies/service/1/verified"

# Get companies by subscription tier
curl "http://localhost:3000/api/v2/companies/tier/starter"
```

**Expected:** All return 200 (may be empty if no sample data - that's OK)

---

### Test Group 3: Subscriptions (NEW - Phase 2)

```bash
# Get all subscription tiers (should return 4: free, starter, professional, enterprise)
curl http://localhost:3000/api/v2/subscriptions/tiers

# Get tier details
curl http://localhost:3000/api/v2/subscriptions/tiers/1

# Get user's active subscription (user_id=42)
curl http://localhost:3000/api/v2/subscriptions/user/42

# Get user's subscription tier
curl http://localhost:3000/api/v2/subscriptions/user/42/tier

# Get tier popularity (adoption stats)
curl http://localhost:3000/api/v2/subscriptions/admin/popularity

# Expire old subscriptions (admin/cron)
curl -X POST http://localhost:3000/api/v2/subscriptions/admin/expire
```

**Expected:** All return 200. Subscription queries may be empty (no users yet).

---

### Test Group 4: Verification & Credentials (NEW - Phase 2)

```bash
# Get pending verifications
curl http://localhost:3000/api/v2/verification/admin/pending

# Get verification analytics
curl http://localhost:3000/api/v2/verification/admin/stats

# Get company verification status
curl http://localhost:3000/api/v2/verification/status/company/1

# Get expiring verifications (30 days)
curl http://localhost:3000/api/v2/verification/admin/expiring-soon

# Expire old credentials (admin/cron)
curl -X POST http://localhost:3000/api/v2/verification/admin/expire-credentials
```

**Expected:** All return 200. Verification data may be empty (no verifications yet).

---

### Test Group 5: Messaging (NEW - Phase 2)

```bash
# Get messaging statistics
curl http://localhost:3000/api/v2/messages/admin/stats

# Get unread messages for user (user_id=42, user_type=client)
curl "http://localhost:3000/api/v2/messages/unread/42?userType=client"

# Get user's conversations
curl "http://localhost:3000/api/v2/messages/conversations/42?userType=client"

# Get unread count
curl "http://localhost:3000/api/v2/messages/unread-count/42?userType=client"
```

**Expected:** All return 200. Message data may be empty (no conversations yet).

---

### Test Group 6: Legacy v1 Endpoints (MUST still work!)

```bash
# Check v1 status
curl http://localhost:3000/api/v1/status

# Check service counts (should return lawfirms, lawyers, notaries)
curl http://localhost:3000/api/v1/service-counts

# Check directory (must still work)
curl http://localhost:3000/api/v1/directory/search?q=law
```

**Expected:** All return 200. v1 should be completely unaffected by Phase 2 changes.

---

## Step 4: Test Error Handling (15 min)

### 4.1 Test invalid persona ID
```bash
curl http://localhost:3000/api/v2/personas/9999
# Expected: 404 Not Found
```

### 4.2 Test invalid service ID
```bash
curl http://localhost:3000/api/v2/services/9999
# Expected: 404 Not Found
```

### 4.3 Test missing required fields (create hire request)
```bash
curl -X POST http://localhost:3000/api/v2/companies/hire-request \
  -H "Content-Type: application/json" \
  -d '{"missingFields": "yes"}'
# Expected: 400 Bad Request
```

### 4.4 Test invalid subscription tier
```bash
curl http://localhost:3000/api/v2/subscriptions/tiers/9999
# Expected: 404 Not Found
```

---

## Step 5: Verify Backward Compatibility (15 min)

Run the following to ensure v1 APIs work exactly as before:

```bash
# Test all v1 routes still return correct structure
curl http://localhost:3000/api/v1/status | jq '.'
curl http://localhost:3000/api/v1/service-counts | jq '.'
curl http://localhost:3000/api/v1/law-firms | jq '.'
curl http://localhost:3000/api/v1/notaries | jq '.'
```

**Expected:** All v1 endpoints return exactly the same response format as before.

---

## Step 6: Load Testing (Optional - 10 min)

```bash
# Install Apache Bench if needed
# On Mac: brew install httpd
# On Linux: sudo apt-get install apache2-utils

# Test personas endpoint (should handle concurrent requests)
ab -n 100 -c 10 http://localhost:3000/api/v2/personas

# Test marketplace endpoint
ab -n 100 -c 10 http://localhost:3000/api/v2/services
```

**Expected:** All requests succeed, no errors.

---

## Step 7: Database State Checks (10 min)

```bash
# Check services table
psql -U transcend -d transcend_db -c "SELECT service_name, icon FROM services LIMIT 10;"

# Check persona marketplace priority (should have 720 rows = 15×48)
psql -U transcend -d transcend_db -c "SELECT COUNT(*) as priority_count FROM persona_marketplace_priority;"

# Check subscription tiers (should have 4)
psql -U transcend -d transcend_db -c "SELECT tier_name, monthly_price FROM subscription_tiers ORDER BY tier_level;"

# Check persona-tools mappings
psql -U transcend -d transcend_db -c "SELECT COUNT(*) as tool_mappings FROM persona_tools;"
```

**Expected:**
- services: 48 rows
- persona_marketplace_priority: 720 rows
- subscription_tiers: 4 rows
- persona_tools: 100+ rows

---

## Step 8: Checklist Before Phase 3

- [ ] All 5 migrations ran successfully
- [ ] Database has correct row counts
- [ ] Backend starts without errors
- [ ] All Phase 1 endpoints work (personas, marketplace)
- [ ] All Phase 2 endpoints return 200 (companies, subscriptions, verification, messaging)
- [ ] Error handling works (404s, 400s)
- [ ] All v1 endpoints still work (backward compatible)
- [ ] Load test passes (no bottlenecks)

---

## Troubleshooting

### Issue: "Database connection failed"
```bash
# Check postgres is running
docker-compose ps

# Or start it
docker-compose up -d postgres

# Verify connection
psql -U transcend -d transcend_db -c "SELECT 1;"
```

### Issue: "Migration already applied"
```bash
# Check migration status
psql -U transcend -d transcend_db -c "SELECT * FROM schema_migrations;" 2>/dev/null

# Or manually check tables
psql -U transcend -d transcend_db -c "\dt"
```

### Issue: "Port 3000 already in use"
```bash
# Kill process on port 3000
lsof -i :3000
kill -9 <PID>

# Or use different port
PORT=3001 npm run dev
```

### Issue: "Service returns 500 error"
```bash
# Check backend logs for details
tail -f backend/logs/server.log

# Or enable verbose logging
DEBUG=* npm run dev
```

---

## Next: Phase 3 Frontend

Once all tests pass, you're ready for Phase 3:

1. **PersonaSwitcher** - Allow users to switch between personas
2. **ServiceMarketplace** - Browse and filter services
3. **HireFlow** - Request quotes, manage hiring
4. **ConferencingIntegration** - Zoom/Teams one-click calls
5. **SubscriptionUI** - Tier selection and upgrades

**Phase 3 estimated time:** 50 hours (6-7 developer days)

---

## Deploy to Staging (Optional)

Once tests pass locally:

```bash
# Build production bundle
npm run build

# Deploy to staging environment
git push staging main

# Run migrations on staging
# (your deployment process here)

# Run smoke tests on staging
curl https://staging-api.transcend-law.com/api/v2/status
```

---

**Status:** Phase 2 ready for testing ✅

All endpoints built, integrated, and waiting for verification.

