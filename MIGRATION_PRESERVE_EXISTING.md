# 🔒 Migration Guide: Add New Features Without Breaking Existing

**Goal:** Preserve all working functionality while adding:
- Persona-based left menu system
- Dynamic marketplace reordering
- Service catalog from CSVs
- B2B subscription tiers

**Status:** No existing features will be removed  
**Approach:** Parallel tables + gradual feature rollout

---

## Currently Working (DO NOT BREAK)

### 1. Service Counts Display ✅
**Current Implementation:**
- `/api/v1/service-counts` → Returns all 22 services with provider counts
- `/api/v1/service-counts/breakdown/lawyer` → Separate firm vs lawyer counts
- `/api/v1/service-counts/breakdown/notary` → Notary count only
- Frontend: `ServiceSelection.tsx` displays counts on cards

**Keep as-is:** This endpoint will continue to work exactly as-is
**Add alongside:** New persona-specific count aggregation

**Files affected (PRESERVE):**
- `transcend-law/backend/src/services/serviceCountsService.ts`
- `transcend-law/backend/src/routes/serviceCounts.ts`
- `transcend-frontend/src/pages/ServiceSelection.tsx`
- `transcend-frontend/src/pages/ServiceSelection.css`

---

### 2. Directory System ✅
**Current Implementation:**
- `/api/v1/directory/firms` → Searchable law firm directory
- `/api/v1/directory/notaries` → Notary directory
- Frontend: `Directory.tsx` with tabs, search, filtering

**Keep as-is:** Continue to work for all providers
**Enhance with:** Persona-specific filtering and priority ordering

**Files affected (PRESERVE):**
- `transcend-law/backend/src/services/directoryService.ts`
- `transcend-law/backend/src/routes/directory.ts`
- `transcend-frontend/src/pages/Directory.tsx`
- `transcend-frontend/src/pages/Directory.css`

---

### 3. Attorney Cost Filtering ✅
**Current Implementation:**
- `LawSpecialtyDetail.tsx` → Cost filter buttons ($0-200, $200-400, $400+)
- Hourly rate display on attorney cards
- State + Firm + Attorney multi-step selection

**Keep as-is:** Cost filtering remains exactly as-is
**Add alongside:** Integrate with new persona/service system

**Files affected (PRESERVE):**
- `transcend-frontend/src/pages/LawSpecialtyDetail.tsx`
- `transcend-frontend/src/pages/LawSpecialtyDetail.css`

---

### 4. Law Specialties System ✅
**Current Implementation:**
- `/api/v1/law-firms/stats` → Returns practice areas with firm/attorney counts
- `LawSpecialties.tsx` → Display practice area cards
- `LawSpecialtyDetail.tsx` → Deep-dive per specialty

**Keep as-is:** All existing queries and displays continue
**Enhance with:** Map practice areas to new service catalog

**Files affected (PRESERVE):**
- `transcend-law/backend/src/services/lawFirmStats.ts`
- `transcend-law/backend/src/routes/lawFirms.ts`
- `transcend-frontend/src/pages/LawSpecialties.tsx`
- `transcend-frontend/src/pages/LawSpecialties.css`

---

### 5. Data Refresh Scheduler ✅
**Current Implementation:**
- Hourly automatic refresh of law firm and notary stats
- `dataRefreshScheduler.ts` → Runs on server start

**Keep as-is:** Continue hourly refresh
**Enhance with:** Also refresh new persona/service data

**Files affected (PRESERVE):**
- `transcend-law/backend/src/services/dataRefreshScheduler.ts`

---

## New Features (Add in Parallel)

### New Database Tables (Don't touch existing)
```
EXISTING:
├── law_firms (3,207 rows from CSV)
├── law_firm_stats (aggregated counts)
└── notaries (notary data)

NEW (Parallel system):
├── services (48 rows from service_catalog_v2.csv)
├── tools (300+ rows from left_menu_tools.csv)
├── personas (15 rows from persona_priority.csv)
├── persona_marketplace_priority (720 rows)
├── persona_tools (300 rows)
├── companies (replaces law_firm with more general structure)
├── company_services (links companies to services they offer)
└── subscription_tiers (B2B tier data)
```

**Key Point:** Old tables continue to exist and serve old routes. New tables support new routes.

---

### New Routes (Don't modify existing routes)

**Existing Routes (Keep working):**
```
GET /api/v1/service-counts
GET /api/v1/service-counts/breakdown/lawyer
GET /api/v1/service-counts/breakdown/notary
GET /api/v1/law-firms/stats
GET /api/v1/directory/firms
GET /api/v1/directory/notaries
GET /api/v1/directory/firms/:firmId
```

**New Routes (Add alongside):**
```
GET /api/v2/personas
GET /api/v2/personas/:id/marketplace
GET /api/v2/personas/:id/menu
GET /api/v2/services
GET /api/v2/services/:id/directory
GET /api/v2/marketplace/discover
GET /api/v2/companies
GET /api/v2/subscription-tiers
```

**Approach:** Use `/v2/` prefix to avoid any conflicts with existing `/v1/` routes.

---

### New Frontend Pages (Don't modify existing pages)

**Existing Pages (Keep working):**
```
/dashboard
/services
/services/:specialty
/services/:specialty/attorneys
/directory
```

**New Pages (Add alongside):**
```
/marketplace (replaces /services eventually)
/left-menu/:persona
/company-profile/:companyId
/persona-switcher
/subscription-management
```

**Approach:** Create new pages while old pages remain. Gradually migrate users to new pages.

---

## Migration Strategy: 4-Phase Rollout

### Phase 1: Database Setup (Week 1)
- Create new tables (don't touch existing tables)
- Import CSV data into new tables
- Validate data integrity
- Create migration scripts (with rollback capability)

**Files to create:**
```
transcend-law/backend/src/migrations/
├── 010_create_services_table.sql
├── 011_create_tools_table.sql
├── 012_create_personas_table.sql
├── 013_create_persona_tables.sql
├── 014_create_companies_table.sql
├── 015_create_subscription_tiers.sql
└── 016_import_csv_data.sql
```

**Rollback:** Simple DROP TABLE commands if needed.

---

### Phase 2: Backend APIs v2 (Week 2)
- Create new service files for persona/marketplace logic
- Create new routes under `/api/v2/`
- Keep existing `/api/v1/` routes untouched
- Deploy v2 APIs without removing v1

**Files to create:**
```
transcend-law/backend/src/services/
├── persona.service.ts (new)
├── marketplace.service.ts (new)
├── subscription.service.ts (new)
└── company.service.ts (new)

transcend-law/backend/src/routes/
├── personas.routes.ts (new)
├── marketplace.routes.ts (new)
├── companies.routes.ts (new)
└── subscriptions.routes.ts (new)
```

**Key:** Routes file imports both old and new routers:
```typescript
app.use('/api/v1', routerV1); // existing routes
app.use('/api/v2', routerV2); // new routes
```

---

### Phase 3: Frontend Components v2 (Week 3)
- Create new components for persona/marketplace
- Keep existing components working
- Add feature flags to toggle between old/new UI

**Files to create:**
```
transcend-frontend/src/
├── components/
│   ├── LeftMenu/ (new)
│   │   ├── DynamicLeftMenu.tsx
│   │   └── LeftMenu.css
│   ├── Marketplace/ (new)
│   │   ├── ServiceMarketplace.tsx
│   │   ├── PersonaMarketplace.tsx
│   │   └── Marketplace.css
│   ├── PersonaSwitcher/ (new)
│   │   └── PersonaSwitcher.tsx
│   └── [existing components remain]
├── pages/
│   ├── PersonalizedMarketplace.tsx (new)
│   ├── Marketplace.tsx (new)
│   └── [existing pages remain]
└── hooks/
    ├── usePersona.ts (new)
    ├── useMarketplace.ts (new)
    └── [existing hooks remain]
```

**Feature Flags:**
```typescript
// src/config/features.ts
export const FEATURES = {
  USE_NEW_MARKETPLACE: false, // toggle to true when ready
  USE_DYNAMIC_MENU: false,    // toggle to true when ready
  USE_PERSONA_SWITCHER: false, // toggle to true when ready
};
```

---

### Phase 4: Gradual Migration (Week 4+)
- Enable features for beta users first
- Monitor performance and user feedback
- Gradually roll out to all users
- Sunset old features once complete

**Timeline:**
```
Week 1-2: Soft launch to 10% of users
  - New marketplace visible in sidebar
  - Old marketplace still primary
  - Collect feedback

Week 2-3: Expand to 50% of users
  - Monitor for issues
  - Fix bugs found in beta

Week 3-4: Full rollout to 100% of users
  - Make new marketplace primary
  - Keep old routes working for 3 months
  - Sunset old routes

Post-Launch: Maintain both systems
  - Keep v1 API running for legacy users
  - Actively develop v2 features
  - Eventually deprecate v1
```

---

## Data Synchronization

### Old System (Law Firms)
```
law_firms (3,207 rows)
  ├── firm_name
  ├── state
  ├── practice_areas
  └── ...
```

### New System (Services)
```
companies (3,207 + more rows)
  ├── company_name
  ├── company_type ('law_firm', 'notary', etc.)
  └── ...

company_services (links companies to services)
  ├── company_id
  ├── service_id (e.g., service_id=10 for Lawyer)
  └── ...
```

### Migration Mapping
```
law_firms → companies (with company_type='law_firm')
  Each row creates:
  - 1 company record
  - 1 company_services record linking to service_id=10 (Lawyer)
```

**SQL:**
```sql
INSERT INTO companies (company_name, company_type, state, ...)
SELECT firm_name, 'law_firm', state, ... FROM law_firms;

INSERT INTO company_services (company_id, service_id, ...)
SELECT c.id, 10, ... FROM companies c WHERE c.company_type='law_firm';
```

---

## Backward Compatibility Checklist

### Existing Functionality
- [ ] Service counts still display on service cards
- [ ] Directory search/filter still works
- [ ] Cost filtering for attorneys still works
- [ ] Law specialties page still loads all data
- [ ] Hourly refresh scheduler still runs
- [ ] All existing routes return same format
- [ ] Mobile responsiveness unchanged
- [ ] Dark mode still works
- [ ] Accessibility not broken
- [ ] Performance not degraded

### New Functionality
- [ ] New persona APIs respond correctly
- [ ] Dynamic menu loads tools per persona
- [ ] Marketplace reorders services by priority
- [ ] Subscription tier system works
- [ ] Feature flags control rollout
- [ ] Metrics tracked for new features
- [ ] Error handling for v2 APIs

---

## Rollback Plan

If anything breaks during migration:

### Database Rollback (Instant)
```sql
-- Drop new tables (data loss is acceptable for new tables)
DROP TABLE subscription_tiers;
DROP TABLE persona_tools;
DROP TABLE persona_marketplace_priority;
DROP TABLE personas;
DROP TABLE tools;
DROP TABLE company_services;
DROP TABLE companies;
DROP TABLE services;

-- Old tables remain intact
SELECT COUNT(*) FROM law_firms; -- Still 3,207 rows
SELECT COUNT(*) FROM notaries; -- Still all notaries
```

### Code Rollback (Instant)
```bash
# Revert backend to previous commit
git checkout main~1 -- transcend-law/backend/src/

# Restart server
npm run start

# Old /api/v1 routes still work
curl http://localhost:3000/api/v1/service-counts
```

### Frontend Rollback (Instant)
```bash
# Disable new features via feature flags
FEATURES.USE_NEW_MARKETPLACE = false;
FEATURES.USE_DYNAMIC_MENU = false;

# Old UI still renders
# No user-facing changes
```

---

## File Structure After Migration

```
transcend-law/
├── backend/
│   └── src/
│       ├── migrations/ (new)
│       │   ├── 001-010_existing.sql
│       │   └── 010-016_new_persona_system.sql
│       ├── services/
│       │   ├── lawFirmStats.ts (existing - unchanged)
│       │   ├── serviceCountsService.ts (existing - unchanged)
│       │   ├── directoryService.ts (existing - unchanged)
│       │   ├── persona.service.ts (new)
│       │   ├── marketplace.service.ts (new)
│       │   ├── company.service.ts (new)
│       │   └── subscription.service.ts (new)
│       ├── routes/
│       │   ├── lawFirms.ts (existing - unchanged)
│       │   ├── serviceCounts.ts (existing - unchanged)
│       │   ├── directory.ts (existing - unchanged)
│       │   ├── personas.routes.ts (new)
│       │   ├── marketplace.routes.ts (new)
│       │   ├── companies.routes.ts (new)
│       │   └── subscriptions.routes.ts (new)
│       └── index.ts (modified to load both v1 + v2 routes)

transcend-frontend/
├── src/
│   ├── components/
│   │   ├── Dashboard/ (existing - unchanged)
│   │   ├── ServiceSelection/ (existing - unchanged)
│   │   ├── Directory/ (existing - unchanged)
│   │   ├── LeftMenu/ (new)
│   │   ├── Marketplace/ (new)
│   │   └── PersonaSwitcher/ (new)
│   ├── pages/
│   │   ├── Dashboard.tsx (existing - unchanged)
│   │   ├── ServiceSelection.tsx (existing - unchanged)
│   │   ├── Directory.tsx (existing - unchanged)
│   │   ├── LawSpecialties.tsx (existing - unchanged)
│   │   ├── LawSpecialtyDetail.tsx (existing - unchanged)
│   │   ├── Marketplace.tsx (new)
│   │   ├── PersonalizedMarketplace.tsx (new)
│   │   └── SubscriptionManagement.tsx (new)
│   ├── config/
│   │   └── features.ts (new - feature flags)
│   ├── hooks/
│   │   ├── useDirectory.ts (existing)
│   │   ├── usePersona.ts (new)
│   │   ├── useMarketplace.ts (new)
│   │   └── useSubscription.ts (new)
│   └── styles/
│       └── (all existing styles remain)
```

---

## Success Metrics

### Performance
- No regression in load times
- API response time < 200ms for v1 routes
- API response time < 300ms for v2 routes

### Functionality
- 100% of existing features working
- All new features accessible
- Zero unplanned downtime

### User Experience
- Smooth transition between old/new UI
- No breaking changes for existing users
- Clear feature flag documentation

### Data Integrity
- All 3,207 law firms still accessible
- All notaries still searchable
- Cost filtering still accurate

---

## Communication Plan

### To Team
- "We're adding a new persona-based system alongside existing features"
- "No breaking changes - everything continues to work"
- "Rollout happens gradually with feature flags"

### To Users
- Old experience remains unchanged until they opt-in
- New persona features available for beta testing
- Gradual migration path announced

---

## Conclusion

This migration approach ensures:
✅ **Zero disruption** to existing users  
✅ **Parallel development** of new system  
✅ **Instant rollback** capability if needed  
✅ **Gradual rollout** to minimize risk  
✅ **Full backward compatibility** maintained  

All working functionality preserved. New functionality added safely alongside.

