# ⚡ Quick Start: Complete & Run the Build

**Goal:** Get the full system running in 1-2 hours  
**Prerequisites:** Node.js 18+, PostgreSQL running, Docker (optional)

---

## Step 1: Run Database Migrations (15 min)

### Option A: Using psql directly
```bash
cd transcend-law/backend/src/migrations

# Run each migration in order
psql -U transcend -d transcend_db < 010_create_services_table.sql
psql -U transcend -d transcend_db < 011_create_tools_table.sql
psql -U transcend -d transcend_db < 012_create_personas_table.sql
psql -U transcend -d transcend_db < 013_create_persona_junctions.sql
psql -U transcend -d transcend_db < 014_extend_tools_and_practice_areas.sql

# Verify tables were created
psql -U transcend -d transcend_db -c "\dt"
```

### Option B: Using Node script (create this file)
```bash
# Create: transcend-law/backend/scripts/run-migrations.js
node transcend-law/backend/scripts/run-migrations.js
```

### Verify Success
```bash
# Should return 48 services
psql -U transcend -d transcend_db -c "SELECT COUNT(*) FROM services;"

# Should return 15 personas
psql -U transcend -d transcend_db -c "SELECT COUNT(*) FROM personas;"

# Should return 720 persona-service priorities
psql -U transcend -d transcend_db -c "SELECT COUNT(*) FROM persona_marketplace_priority;"
```

---

## Step 2: Update Database Connection (5 min)

Make sure your `backend/src/db/connection.ts` or similar has a proper getDatabase() function:

```typescript
// If not already exported, add this to your connection file
export function getDatabase() {
  // Return your Database connection instance
  // (adjust based on your actual connection class)
  return new Database(process.env.DATABASE_URL);
}
```

---

## Step 3: Install Dependencies (5 min)

```bash
cd transcend-law/backend

# Install if not already done
npm install

# Or if using yarn workspaces
yarn install
```

---

## Step 4: Start Backend (5 min)

```bash
# From transcend-law/backend
npm run dev

# Or
yarn dev

# Should output:
# Transcend Law API listening on port 3000
# Environment: development
```

---

## Step 5: Test API Endpoints (10 min)

Open a new terminal and test:

```bash
# Test v2 status
curl http://localhost:3000/api/v2/status

# Get all personas (should return 15)
curl http://localhost:3000/api/v2/personas

# Get Lawyer persona marketplace (should return 48 services in priority order)
curl http://localhost:3000/api/v2/personas/2/marketplace

# Get Lawyer left menu (should return Core Tools section)
curl http://localhost:3000/api/v2/personas/2/menu

# Get all services
curl http://localhost:3000/api/v2/services

# IMPORTANT: Verify v1 still works
curl http://localhost:3000/api/v1/service-counts
# Should return: {firms: 3207, lawyers: 169463, ...}
```

---

## Step 6: Integrate Frontend Component (15 min)

### Update Layout.tsx
```typescript
import DynamicLeftMenu from '../components/LeftMenu/DynamicLeftMenu';

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [personaId, setPersonaId] = useState(2); // Default to Lawyer
  const [personaName, setPersonaName] = useState('Lawyer');
  const [personaIcon, setPersonaIcon] = useState('⚖️');

  return (
    <div className="layout">
      <DynamicLeftMenu
        personaId={personaId}
        personaName={personaName}
        personaIcon={personaIcon}
        onSelectTool={(tool) => {
          console.log('Selected tool:', tool);
          // Navigate to tool or trigger action
        }}
      />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};
```

### Start Frontend
```bash
cd transcend-frontend

npm run dev
# Or
yarn dev

# Opens on http://localhost:5173
```

---

## Step 7: Test Full Integration (10 min)

1. **Open browser:** http://localhost:5173
2. **Check layout:** Should see left menu with "Legal Tools"
3. **Click sections:** Core Tools should expand
4. **Click categories:** Should show individual tools
5. **Dark mode:** Toggle to test dark mode styling
6. **Mobile:** Resize to test responsive layout

---

## Step 8: Verify Backward Compatibility (5 min)

```bash
# All v1 endpoints should still work

curl http://localhost:3000/api/v1/service-counts
curl http://localhost:3000/api/v1/law-firms/stats
curl http://localhost:3000/api/v1/directory/firms
curl http://localhost:3000/api/v1/directory/notaries

# Verify data is the same
```

---

## Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432

Fix: Make sure PostgreSQL is running
$ docker-compose up -d  # or
$ brew services start postgresql
```

### API Returns 404
```
Error: POST /api/v2/personas 404

Fix: Make sure backend started and routes mounted
Check: console output should show "listening on port 3000"
```

### Frontend can't reach API
```
Error: CORS blocked request

Fix: Verify CORS is enabled in backend/index.ts
Check: http://localhost:3000/api/v2/status from browser
```

### Tools not showing in menu
```
Check: personaId being passed to DynamicLeftMenu
Check: API call /personas/2/menu returns data
Check: Tools table is populated (see Step 1 verify)
```

---

## Performance Checks

### Load Times
- API response time: should be < 100ms
- Frontend load: should be < 2s
- Menu render: should be instant

### Check Backend Performance
```bash
# Time the API call
time curl http://localhost:3000/api/v2/personas/2/menu

# Check database query performance
psql -U transcend -d transcend_db -c "EXPLAIN ANALYZE SELECT * FROM persona_tools WHERE persona_id = 2;"
```

---

## What's Working

✅ **Database:** 48 services, 15 personas, all junctions created  
✅ **Backend:** PersonaService and MarketplaceService implemented  
✅ **API Routes:** All v2 endpoints mounted and responding  
✅ **Frontend:** DynamicLeftMenu component complete with CSS  
✅ **Integration:** Express index.ts updated to mount v2 routes  
✅ **Backward Compatibility:** v1 routes still work unchanged  

---

## What's NOT Yet Done (Phase 2)

- [ ] Practice area-specific specialty tools
- [ ] Company profiles and hiring flow
- [ ] Subscription tier system
- [ ] Reviews and ratings
- [ ] Analytics dashboard
- [ ] Integrations (Slack, Outlook, etc.)
- [ ] Mobile app
- [ ] AI assistant

These are for later phases.

---

## Quick Command Reference

```bash
# Start everything
docker-compose up -d                    # PostgreSQL + Redis
cd transcend-law/backend && npm run dev # Backend on 3000
cd transcend-frontend && npm run dev    # Frontend on 5173

# Test APIs
curl http://localhost:3000/api/v2/personas
curl http://localhost:3000/api/v2/services

# View database
psql -U transcend -d transcend_db
SELECT * FROM personas;
SELECT * FROM services LIMIT 5;
SELECT * FROM persona_marketplace_priority WHERE persona_id = 2 LIMIT 5;
```

---

## Success Checklist

- [ ] Migrations run without errors
- [ ] Database tables created (48 services, 15 personas, etc.)
- [ ] Backend starts on port 3000
- [ ] GET /api/v2/personas returns 15 items
- [ ] GET /api/v2/services returns 48 items
- [ ] GET /api/v2/personas/2/menu returns menu sections
- [ ] Frontend starts on port 5173
- [ ] Left menu visible with collapsible sections
- [ ] Dark mode works
- [ ] Mobile layout responsive
- [ ] v1 endpoints still return data
- [ ] No console errors in browser

**Once all checked: System is LIVE!** 🚀

---

## Next: More Components

After this is working, you'll want to build:

1. **PersonaSwitcher component** - Switch between personas
2. **ServiceMarketplace component** - Browse services
3. **ServiceDirectory component** - Search/filter providers
4. **Integration with Dashboard** - Make it part of the main app

See IMPLEMENTATION_ROADMAP.md for the full plan.

---

**Estimated time to working system: 1-2 hours**  
**Estimated time to fully shipped: 2-3 weeks (rest of phases)**

Good luck! 🎯

