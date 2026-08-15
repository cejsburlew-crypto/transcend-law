# 🗺️ Implementation Roadmap

**Complete Step-by-Step Plan to Ship**  
**Status:** Ready to execute  
**Estimated Time:** 4 weeks  
**Risk Level:** Low (backward compatible)

---

## Quick Links to All Documentation

| Document | Purpose | Time |
|----------|---------|------|
| [ARCHITECTURE_MASTER_REFERENCE.md](ARCHITECTURE_MASTER_REFERENCE.md) | System overview | 10 min |
| [DATABASE_SCHEMA_UNIFIED.md](DATABASE_SCHEMA_UNIFIED.md) | Database design | 15 min |
| [CSV_REFERENCE_GUIDE.md](CSV_REFERENCE_GUIDE.md) | CSV structure guide | 5 min |
| [IMPLEMENTATION_GUIDE_CSV_TO_DB.md](IMPLEMENTATION_GUIDE_CSV_TO_DB.md) | Import scripts & backend | 20 min |
| [MIGRATION_PRESERVE_EXISTING.md](MIGRATION_PRESERVE_EXISTING.md) | Safety & rollback | 15 min |
| [LEFT_MENU_ARCHITECTURE_REFINED.md](LEFT_MENU_ARCHITECTURE_REFINED.md) | Core + specialty workflows | 10 min |
| [LEFT_MENU_UI_DESIGN.md](LEFT_MENU_UI_DESIGN.md) | UI/UX design | 10 min |

---

## What You're Building

```
BEFORE (Current State):
├─ ServiceSelection: 3,207 firms, 169,463 lawyers
├─ Directory: Searchable provider list
├─ Attorney Cost Filtering: $0-200, $200-400, $400+
└─ Law Specialties: Practice area cards

AFTER (New System):
├─ SAME: All above continues to work
├─ NEW: Persona-specific marketplace (48 services)
├─ NEW: Dynamic left menu (core + specialty tools)
├─ NEW: B2B subscription tiers (Free/Starter/Pro/Enterprise)
├─ NEW: Practice area-specific workflows
└─ NEW: Company profiles + verification system
```

---

## Phase Breakdown

### Phase 1: Database Foundation (Days 1-5)

**Goal:** Import CSV data, set up new tables

#### Tasks:

1. **Day 1: Create SQL Migration Files**
   - [ ] Create `migrations/010_create_services_table.sql`
   - [ ] Create `migrations/011_create_tools_table.sql`
   - [ ] Create `migrations/012_create_personas_table.sql`
   - [ ] Create `migrations/013_create_persona_tables.sql`
   - [ ] Create `migrations/014_create_companies_table.sql`
   - [ ] Create `migrations/015_create_subscription_tiers.sql`
   
   **Time:** 2 hours  
   **Ref:** DATABASE_SCHEMA_UNIFIED.md

2. **Day 2: Write Python Import Scripts**
   - [ ] Create `import_services.py` (CSV 1 → services table)
   - [ ] Create `import_tools.py` (CSV 2 → tools table)
   - [ ] Create `import_persona_priority.py` (CSV 3 → persona_marketplace_priority)
   - [ ] Validate counts match CSV 4 (Claude Import)
   
   **Time:** 3 hours  
   **Ref:** IMPLEMENTATION_GUIDE_CSV_TO_DB.md

3. **Day 3: Run Migrations & Imports**
   - [ ] Run all SQL migrations
   - [ ] Execute Python import scripts
   - [ ] Validate data integrity
   - [ ] Test with sample queries
   - [ ] Create rollback backup
   
   **Time:** 2 hours  
   **Ref:** IMPLEMENTATION_GUIDE_CSV_TO_DB.md

4. **Day 4-5: Extend Schema for Specialty Workflows**
   - [ ] Add `practice_area_id` to tools table
   - [ ] Add `is_core` flag to tools table
   - [ ] Create `practice_areas` reference table
   - [ ] Populate 20 practice areas
   - [ ] Migrate existing tools to have `is_core=true`
   - [ ] Import specialty tools per practice area
   
   **Time:** 4 hours  
   **Ref:** LEFT_MENU_ARCHITECTURE_REFINED.md

**Deliverables:**
- ✅ 48 services in database
- ✅ 300+ tools assigned to services
- ✅ 15 personas defined
- ✅ 720 persona-service priorities loaded
- ✅ 20 practice areas created

---

### Phase 2: Backend APIs (Days 6-10)

**Goal:** Build /api/v2 endpoints (v1 remains unchanged)

#### Tasks:

1. **Day 6: Persona APIs**
   - [ ] `GET /api/v2/personas` - List all personas
   - [ ] `GET /api/v2/personas/:id` - Get single persona
   - [ ] `GET /api/v2/personas/:id/marketplace` - Priority-ordered services
   - [ ] `GET /api/v2/personas/:id/menu` - Left-menu tools
   
   **Files:**
   ```
   services/persona.service.ts
   routes/personas.routes.ts
   ```
   
   **Time:** 2 hours

2. **Day 7: Service & Directory APIs**
   - [ ] `GET /api/v2/services` - All 48 services
   - [ ] `GET /api/v2/services/:id` - Single service details
   - [ ] `GET /api/v2/services/:id/directory` - Providers for service
   - [ ] `GET /api/v2/services/:id/directory?filter=state:CA` - Filtered providers
   
   **Files:**
   ```
   services/marketplace.service.ts
   routes/marketplace.routes.ts
   ```
   
   **Time:** 3 hours

3. **Day 8: Company & Subscription APIs**
   - [ ] Migrate law_firms → companies table (parallel, not replacing)
   - [ ] `GET /api/v2/companies` - List companies
   - [ ] `GET /api/v2/companies/:id` - Company profile
   - [ ] `GET /api/v2/subscription-tiers` - Tier options
   - [ ] `POST /api/v2/companies/:id/subscribe` - Upgrade subscription
   
   **Files:**
   ```
   services/company.service.ts
   services/subscription.service.ts
   routes/companies.routes.ts
   routes/subscriptions.routes.ts
   ```
   
   **Time:** 3 hours

4. **Day 9: Data Refresh Scheduler**
   - [ ] Update dataRefreshScheduler to refresh new tables
   - [ ] Refresh persona marketplace priorities every hour
   - [ ] Refresh tools every hour
   - [ ] Test scheduler with cron simulation
   
   **Files:**
   ```
   services/dataRefreshScheduler.ts (updated)
   ```
   
   **Time:** 1 hour

5. **Day 10: Testing & API Documentation**
   - [ ] Test all endpoints with Postman/curl
   - [ ] Verify backward compatibility (v1 routes still work)
   - [ ] Document API responses
   - [ ] Create integration test suite
   
   **Time:** 2 hours

**Deliverables:**
- ✅ 15+ working API endpoints
- ✅ Full CRUD for personas/services/companies
- ✅ Subscription tier system functional
- ✅ v1 routes still working (backward compatible)

---

### Phase 3: Frontend Components (Days 11-18)

**Goal:** Build UI components (use feature flags for rollout)

#### Tasks:

1. **Day 11: Project Setup & Config**
   - [ ] Create `config/features.ts` with feature flags
   - [ ] Create `config/personas.ts` with persona definitions
   - [ ] Create `config/services.ts` with service definitions
   - [ ] Set all flags to `false` initially
   - [ ] Add feature flag toggle UI (admin only)
   
   **Files:**
   ```
   config/features.ts
   config/personas.ts
   config/services.ts
   hooks/useFeatureFlag.ts
   ```
   
   **Time:** 1 hour

2. **Day 12-13: Left Menu Component**
   - [ ] Create `components/LeftMenu/CollapsibleLeftMenu.tsx`
   - [ ] Implement core section (always expanded)
   - [ ] Implement specialty section (collapsible)
   - [ ] Implement tool categories (collapsible)
   - [ ] Add practice area switcher
   - [ ] Add quick stats widget
   
   **Files:**
   ```
   components/LeftMenu/CollapsibleLeftMenu.tsx
   components/LeftMenu/CollapsibleLeftMenu.css
   hooks/useLeftMenuData.ts
   ```
   
   **Time:** 4 hours  
   **Ref:** LEFT_MENU_UI_DESIGN.md

3. **Day 14: Marketplace Component**
   - [ ] Create `components/Marketplace/PersonalizedMarketplace.tsx`
   - [ ] Display services in persona-specific priority order
   - [ ] Show service counts (3,207 firms, 169,463 lawyers, etc.)
   - [ ] Add search & filtering
   - [ ] Add service category cards
   
   **Files:**
   ```
   components/Marketplace/PersonalizedMarketplace.tsx
   components/Marketplace/ServiceCard.tsx
   components/Marketplace/Marketplace.css
   hooks/useMarketplace.ts
   ```
   
   **Time:** 3 hours

4. **Day 15: Service Directory Component**
   - [ ] Create `components/Directory/ServiceDirectory.tsx`
   - [ ] Show providers for selected service
   - [ ] Add state/practice area/cost filters
   - [ ] Show tier-based featured visibility
   - [ ] Integrate with existing directory logic
   
   **Files:**
   ```
   components/Directory/ServiceDirectory.tsx
   components/Directory/ProviderCard.tsx
   ```
   
   **Time:** 2 hours

5. **Day 16: Persona Switcher Component**
   - [ ] Create `components/PersonaSwitcher/PersonaSwitcher.tsx`
   - [ ] Show available personas for user
   - [ ] Allow persona switching (updates menu + marketplace)
   - [ ] Show persona icon + name
   - [ ] Display current persona
   
   **Files:**
   ```
   components/PersonaSwitcher/PersonaSwitcher.tsx
   hooks/usePersona.ts
   ```
   
   **Time:** 2 hours

6. **Day 17: Page Integration**
   - [ ] Create `pages/PersonalizedMarketplace.tsx` (new page)
   - [ ] Integrate LeftMenu into layout
   - [ ] Integrate PersonaSwitcher into header
   - [ ] Add feature flag checks
   - [ ] Test with feature flags OFF (old UI shows)
   
   **Time:** 2 hours

7. **Day 18: Styling & Polish**
   - [ ] Implement dark mode support
   - [ ] Mobile responsive design
   - [ ] Animation polish
   - [ ] Accessibility testing (keyboard, screen reader)
   - [ ] Performance optimization (memoization, code splitting)
   
   **Time:** 2 hours

**Deliverables:**
- ✅ All components implemented
- ✅ Dark mode support
- ✅ Mobile responsive
- ✅ Feature flags in place
- ✅ Backward compatible (old UI still works)

---

### Phase 4: Testing & Launch (Days 19-22)

**Goal:** Test everything, launch gradually

#### Tasks:

1. **Day 19: Manual Testing**
   - [ ] Login as Lawyer → See lawyer menu
   - [ ] Login as Notary → See notary menu
   - [ ] Login as PI → See PI menu
   - [ ] Verify marketplace order changes per persona
   - [ ] Test practice area switcher
   - [ ] Verify specialty tools load correctly
   
   **Time:** 2 hours

2. **Day 20: Automated Testing**
   - [ ] Write Cypress E2E tests
   - [ ] Test persona switching flow
   - [ ] Test practice area switching flow
   - [ ] Test service search & filtering
   - [ ] Test feature flag behavior
   - [ ] Test backward compatibility (v1 routes)
   
   **Time:** 3 hours

3. **Day 21: Soft Launch (10% Beta)**
   - [ ] Enable feature flags for 10% of users
   - [ ] Monitor error logs
   - [ ] Collect user feedback
   - [ ] Watch performance metrics
   - [ ] Fix any issues found
   - [ ] Document findings
   
   **Time:** Full day monitoring

4. **Day 22: Gradual Rollout**
   - [ ] Day 1: 10% beta (done Day 21)
   - [ ] Day 1-2: Monitor, fix issues
   - [ ] Day 2: Expand to 50%
   - [ ] Day 2-3: Monitor, fix issues
   - [ ] Day 3: Expand to 100%
   - [ ] Day 4: Monitor final metrics
   - [ ] Keep old routes running (3 months)
   
   **Time:** 2 hours setup + ongoing monitoring

**Deliverables:**
- ✅ All features tested & working
- ✅ No regressions in existing functionality
- ✅ Performance metrics tracked
- ✅ User feedback collected
- ✅ Gradual rollout executed

---

## Critical Path Summary

```
Week 1: Database (Days 1-5)
├─ Day 1: SQL migrations
├─ Day 2: Python imports
├─ Day 3: Run & validate
└─ Day 4-5: Specialty workflows

Week 2: Backend (Days 6-10)
├─ Day 6: Persona APIs
├─ Day 7: Service/Directory APIs
├─ Day 8: Company/Subscription APIs
├─ Day 9: Scheduler
└─ Day 10: Testing

Week 3: Frontend (Days 11-18)
├─ Day 11: Setup & config
├─ Day 12-13: Left Menu
├─ Day 14: Marketplace
├─ Day 15: Directory
├─ Day 16: Persona Switcher
├─ Day 17: Integration
└─ Day 18: Polish

Week 4: Launch (Days 19-22)
├─ Day 19: Manual testing
├─ Day 20: Automated testing
├─ Day 21: Beta launch (10%)
└─ Day 22: Gradual rollout (50% → 100%)
```

---

## Key Success Metrics

### Technical
- ✅ Zero regressions in existing features
- ✅ API response time < 300ms (v2)
- ✅ API response time < 200ms (v1)
- ✅ 99.9% uptime during rollout
- ✅ Database queries < 100ms

### Feature
- ✅ All 48 services searchable
- ✅ Persona switching works
- ✅ Left menu loads correct tools
- ✅ Marketplace shows correct priorities
- ✅ Specialty workflows visible

### User
- ✅ 95%+ load success rate
- ✅ < 5% bug reports in first week
- ✅ Positive feedback on new UI
- ✅ No user complaints about lost features

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Database import fails | Low | High | Test migration scripts in dev first |
| API has bugs | Medium | Medium | Comprehensive testing before launch |
| Performance degrades | Low | High | Load testing, query optimization |
| Users can't find features | Medium | Low | Clear navigation, help docs |
| Rollback needed | Very Low | High | Instant SQL rollback capability |
| Backward compatibility breaks | Very Low | Critical | v1 routes tested end-to-end |

---

## Rollback Plan

If anything breaks during launch:

```
INSTANT ROLLBACK (< 5 minutes):

1. Disable feature flags
   FEATURES.USE_NEW_MARKETPLACE = false;
   FEATURES.USE_DYNAMIC_MENU = false;
   
2. Old UI renders
   Users see original interface
   No user-facing changes

3. Restart backend
   All v2 routes still work
   v1 routes active again

4. Database (if needed)
   Drop new tables: simple SQL
   Data remains in legacy tables
   Restore from backup if necessary
```

---

## Communication Plan

### To Team
- "We're adding new features alongside existing ones"
- "No breaking changes - full backward compatibility"
- "Gradual rollout with feature flags"
- "Easy rollback if needed"

### To Users (Beta)
- "Try new persona-based marketplace"
- "Give feedback via [form]"
- "Old interface still available"

### To Users (Full Launch)
- "New personalized marketplace launching"
- "Your menu adapts to your practice area"
- "Subscription tiers available"
- "Old features still work as before"

---

## Post-Launch Maintenance

### Week 1 After Launch
- [ ] Monitor error logs daily
- [ ] Collect user feedback
- [ ] Fix critical bugs ASAP
- [ ] Optimize slow queries
- [ ] Adjust feature flags if needed

### Month 1
- [ ] Keep v1 routes running
- [ ] Monitor v2 adoption
- [ ] Gather user feedback
- [ ] Plan v2 enhancements

### Month 3
- [ ] Plan v1 deprecation
- [ ] Migrate remaining v1 users
- [ ] Remove legacy code (optional)
- [ ] Sunset v1 routes

---

## Success Checklist

Before going live, verify:

- [ ] All database migrations tested
- [ ] All Python imports validated
- [ ] All API endpoints working
- [ ] All components rendering
- [ ] Dark mode working
- [ ] Mobile responsive
- [ ] Keyboard navigation working
- [ ] Screen reader compatible
- [ ] Feature flags functional
- [ ] v1 routes still working
- [ ] Load testing completed
- [ ] User documentation written
- [ ] Team trained
- [ ] Rollback tested
- [ ] Support team briefed

---

## Questions to Answer Before Starting

1. **Database:** Can we add new tables without affecting existing ones? **Yes** (separate schema)
2. **Performance:** Will new queries slow down existing pages? **No** (separate API endpoints)
3. **Rollback:** Can we revert instantly if something breaks? **Yes** (feature flags + SQL rollback)
4. **Users:** Will existing users see any changes? **No** (feature flags default to false)
5. **Timeline:** Is 4 weeks realistic? **Yes** (all docs ready, clear path)

---

## Next Steps (Right Now)

1. Review ARCHITECTURE_MASTER_REFERENCE.md (10 min)
2. Schedule kickoff meeting (30 min)
3. Assign database lead (Day 1 starts)
4. Assign backend lead (Day 6 starts)
5. Assign frontend lead (Day 11 starts)
6. Create Jira tickets from this roadmap
7. Set up monitoring/alerting
8. Prepare rollback procedures

---

## You're Ready to Ship! 🚀

Everything is documented. Architecture is solid. Backward compatibility guaranteed. Launch confidently with this roadmap.

**Timeline:** 4 weeks  
**Risk:** Low (feature flags + rollback)  
**Impact:** High (persona-based marketplace, dynamic menus, B2B tiers)  
**Quality:** Production-ready

