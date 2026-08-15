# 🏗️ Master Architecture Reference

**Complete System Design**  
**Status:** Ready for implementation  
**Last Updated:** August 15, 2026

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     TRANSCEND LEGAL PLATFORM                     │
└─────────────────────────────────────────────────────────────────┘

LAYER 1: USER (CLIENT / PROFESSIONAL)
├─ Client / General Public (searches for services)
├─ Lawyer (hires support services + uses left-menu tools)
├─ Paralegal (uses similar tools to lawyers)
├─ Notary (manages notary services)
├─ Private Investigator (investigates cases)
├─ Expert Witness (testifies in court)
├─ Process Server, Court Reporter, Mediator, etc. (15 total personas)
└─ Each persona sees different marketplace order + different left-menu

LAYER 2: MARKETPLACE (Service Discovery)
├─ All 48 services available as hireable entities
├─ Persona-specific priority ranking (service order changes per persona)
├─ Service counts (3,207 law firms, 169,463 lawyers, etc.)
├─ Search + filtering by practice area, jurisdiction, cost
└─ B2B subscription tiers for featured visibility

LAYER 3: TOOLS (Persona-Specific Workflows)
├─ Lawyer: 22 tools (Legal Research, Discovery, Billing, etc.)
├─ Paralegal: 13 tools (subset of lawyer tools + their own)
├─ Notary: 5 tools (Notary Directory, Scheduling, Templates, etc.)
├─ Process Server: 7 tools (Service Tracking, Address Verification, etc.)
├─ Each tool belongs to a category (Research, Discovery, Admin, etc.)
└─ Tools are same across users of same persona (no customization per user)

LAYER 4: BACKEND (Data & APIs)
├─ Services Table: 48 services (Lawyer, Notary, PI, etc.)
├─ Tools Table: 300+ tools (Free Legal Research, E-Discovery, etc.)
├─ Personas Table: 15 personas (Client, Lawyer, Paralegal, etc.)
├─ Persona_Marketplace_Priority: How each persona ranks services
├─ Persona_Tools: Which tools belong to each persona
├─ Companies Table: Actual law firms, notaries, etc. (migrated from law_firms)
├─ Company_Services: Links companies to the services they offer
├─ Subscription_Tiers: Free, Starter, Professional, Enterprise pricing
└─ Legacy Tables: law_firms, notaries (maintained for backward compatibility)

LAYER 5: FRONTEND (User Interface)
├─ Existing Pages (continue unchanged):
│  ├─ Dashboard (overview)
│  ├─ ServiceSelection (shows counts: 3,207 firms, 169,463 lawyers)
│  ├─ Directory (searchable directory of all providers)
│  └─ LawSpecialties (practice area deep-dives with cost filtering)
├─ New Pages (persona-driven):
│  ├─ PersonalizedMarketplace (services ranked by persona priority)
│  ├─ DynamicLeftMenu (tools specific to persona)
│  ├─ SubscriptionManagement (tier upgrade/downgrade)
│  └─ CompanyProfile (edit company details + credentials)
└─ Feature Flags (gradual rollout control)
```

---

## Core Data Model

### Relationship Diagram

```
PERSONAS (15 rows)
├── Client / General Public
├── Lawyer
├── Paralegal
├── Notary
├── Private Investigator
├── Process Server
├── Court Reporter
├── Expert Witness
├── Legal Researcher
├── Mediator
├── Legal Document Preparer
├── Tax Preparation Advisor
├── Tax Preparation & Filing
├── Title Agent
└── [Forensic Accountant]
    │
    ├─────────────────────────────────┐
    │                                 │
    v                                 v
PERSONA_MARKETPLACE_PRIORITY      PERSONA_TOOLS
(720 rows: 15 personas × 48)      (300 rows: tools per persona)
    │                                 │
    ├─ Priority_Rank: 1-48           ├─ Can_View: true/false
    ├─ Service_ID: which service      ├─ Can_Create: true/false
    │                                 ├─ Can_Edit: true/false
    v                                 └─ Tool_ID: which tool
SERVICES (48 rows)                    │
├── Arbitrator                        v
├── Background Check                  TOOLS (300+ rows)
├── Bail Bondsman                     ├─ Free Legal Research Library
├── Lawyer                            ├─ Case Law Search
├── Notary                            ├─ E-Discovery Workspace
├── Private Investigator              ├─ Legal Billing/Timekeeping
├── Process Server                    ├─ Expert Witness Directory
├── Court Reporter                    ├─ [48 different tool sets,
├── Expert Witness                    │   one per service type]
├── Mediator                          └─ Custom tools per service
├── Legal Document Preparer
├── Tax Preparation Advisor
├── Tax Preparation & Filing
├── Title Agent
└── [31 more services]
    │
    ├─ Each has:
    │  ├─ ID
    │  ├─ Service_Name
    │  ├─ Tool_Count (4-22 tools each)
    │  └─ Is_Hireable (true for all 48)
    │
    v
COMPANIES (law_firms migrated + new entities)
├── Company_Name
├── Company_Type (law_firm, notary, pi, etc.)
├── City, State
├── Subscription_Tier (free, starter, pro, enterprise)
└── [Details: website, phone, team members, etc.]
    │
    └─ Company_Services (junction)
       ├── Company_ID
       ├── Service_ID (links to SERVICES)
       └── [Hourly_Rate, Practice_Area, Jurisdiction, etc.]
```

---

## The Three Engines

### Engine 1: Marketplace Discovery
```
User logs in
  │
  v
System determines: Who are you? (Client, Lawyer, Notary, etc.)
  │
  v
Query: persona_marketplace_priority
WHERE persona_id = X
ORDER BY priority_rank
  │
  v
Result: Services in priority order for this persona
  │
  Example for Lawyer:
  ├─ 1. Process Server (highest priority)
  ├─ 2. Private Investigator
  ├─ 3. Court Reporter
  ├─ 4. Expert Witness
  └─ ... [48 services total, Lawyer ranked last]
  │
  v
Display: Marketplace cards in this order
  │
  v
Show: Clickable filters (practice area, location, cost)
```

### Engine 2: Left-Menu Tools
```
User switches to Lawyer persona
  │
  v
Query: persona_tools
WHERE persona_id = 2 (Lawyer)
ORDER BY tool_order
  │
  v
Result: 22 tools organized by category
  │
  Example for Lawyer:
  ├─ Legal Research (5 tools)
  │  ├─ Free Legal Research Library
  │  ├─ Case Law Search
  │  ├─ Statute & Regulation Search
  │  ├─ Court Rules & Forms
  │  └─ Docket / Court Calendar
  ├─ Discovery (3 tools)
  │  ├─ E-Discovery Workspace
  │  ├─ Document Review Workspace
  │  └─ Medical Records Request
  ├─ Marketplaces (5 tools)
  │  ├─ Legal Researcher/Paralegal Marketplace
  │  ├─ Expert Witness Marketplace
  │  ├─ Process Server Marketplace
  │  ├─ Private Investigator Marketplace
  │  └─ Court Reporter Marketplace
  ├─ Billing (1 tool)
  │  └─ Legal Billing/Timekeeping
  └─ [More categories...] (22 total)
  │
  v
Render: Left menu with collapsible sections
  │
  v
Click any tool: Navigate to that tool (either Transcend built-in or external link)
```

### Engine 3: Service Provider Directory
```
User searches marketplace
  │
  v
Query: companies
WHERE company_type = 'lawyer' (or any service type)
AND subscription_tier IN (free, starter, pro, enterprise)
AND [filters applied]
  │
  v
Join: company_services
ON companies.id = company_services.company_id
WHERE company_services.service_id = 10 (Lawyer service)
  │
  v
Result: All law firms/lawyers matching criteria
  │
  Example:
  ├─ Company: "Smith & Associates Law Firm"
  │  ├─ Subscription: Professional ($149/month)
  │  ├─ Featured Visibility: 40%
  │  ├─ Rating: 4.8/5
  │  ├─ Practice Areas: Corporate Law, Tax Law
  │  ├─ Hourly Rate: $350
  │  └─ [3 attorneys listed]
  ├─ Company: "Jane Solo Lawyer"
  │  ├─ Subscription: Starter ($49/month)
  │  ├─ Featured Visibility: 10%
  │  ├─ Rating: 4.9/5
  │  ├─ Practice Areas: Family Law
  │  ├─ Hourly Rate: $200
  │  └─ [Solo practitioner]
  └─ [More providers...] (3,207 law firms total)
  │
  v
Sort by: Featured visibility, rating, hourly rate
  │
  v
Display: Ranked list of providers
```

---

## Data Flow: Four Key Scenarios

### Scenario 1: New Lawyer Logs In

```
Step 1: Authentication
  Login → User creates account as "Lawyer"
  │
  v Step 2: Persona Assignment
  CREATE user_personas (user_id, persona_id=2)
  WHERE persona = 'lawyer'
  │
  v Step 3: Menu Population
  SELECT * FROM persona_tools WHERE persona_id = 2
  Result: 22 tools arranged by category
  Render: Left menu appears
  │
  v Step 4: Marketplace Display
  SELECT s.* FROM services s
  JOIN persona_marketplace_priority pmp 
    ON s.id = pmp.service_id
  WHERE pmp.persona_id = 2
  ORDER BY pmp.priority_rank
  Result: Process Server first, Lawyer last (48 services)
  Render: Marketplace cards in lawyer-specific order
```

### Scenario 2: Looking for a Lawyer (Client View)

```
Step 1: Navigate to Marketplace
  Click "Find a Lawyer"
  │
  v Step 2: Search
  GET /api/v2/services/10/directory
  Result: All 3,207 law firms
  │
  v Step 3: Filter
  Filter by:
  ├─ State: California
  ├─ Practice Area: Corporate Law
  └─ Cost: $200-400/hour
  │
  v Step 4: Sort
  Sort by:
  ├─ Featured Visibility (Tier-based)
  ├─ Rating
  └─ Hourly Rate
  │
  v Step 5: Display Results
  "550 law firms found matching 'Corporate Law' in California"
  ├─ Firm 1: "Smith & Associates" (Professional tier, 40% featured)
  ├─ Firm 2: "West Coast Legal" (Starter tier, 10% featured)
  └─ [More results...]
  │
  v Step 6: Contact
  Click "View Details" → See company profile
  Click "Hire" → Send inquiry or book consultation
```

### Scenario 3: Lawyer Hiring a Process Server

```
Step 1: Click Marketplace
  User persona = Lawyer
  │
  v Step 2: Check Menu
  Left menu shows "Process Server Marketplace" (Tool #13 for Lawyer)
  │
  v Step 3: Open Marketplace
  GET /api/v2/personas/2/marketplace
  WHERE priority_rank = 1 (Process Server is #1 for Lawyer)
  │
  v Step 4: See Process Servers
  100+ process servers displayed in Lawyer's priority order
  │
  v Step 5: Filter
  Filter by:
  ├─ State: California
  ├─ Service Area: San Francisco Bay Area
  └─ Price: Budget-friendly
  │
  v Step 6: Select & Hire
  "Quick Service Process Servers" 
  → Click "Send Service Request" 
  → Opens intake form
  → Submit details of case
  │
  v Step 7: Tracking
  Left menu tool: "Service Request Status Tracker"
  → Monitor where process server is in handling case
```

### Scenario 4: Process Server Upgrading Subscription

```
Step 1: Log In
  User persona = Process Server
  │
  v Step 2: See "Upgrade" Prompt
  Current tier: Free (0% featured, no messaging)
  │
  v Step 3: Navigate to Subscription
  GET /api/v2/subscription-management
  │
  v Step 4: View Options
  ├─ Starter ($49/month)
  │  ├─ 10% featured visibility
  │  ├─ Can message 5 companies/month
  │  └─ Basic analytics
  ├─ Professional ($149/month)
  │  ├─ 40% featured visibility
  │  ├─ Can message 20 companies/month
  │  ├─ Advanced analytics
  │  └─ CRM integration
  └─ Enterprise (Custom)
     ├─ 80% featured visibility
     ├─ Unlimited messaging
     └─ Dedicated account manager
  │
  v Step 5: Select & Upgrade
  Click "Upgrade to Professional"
  │
  v Step 6: Billing
  Recurring monthly charge: $149
  Auto-renews unless cancelled
  │
  v Step 7: Marketplace Impact
  Re-query: Marketplace visibility increases
  → Process server now appears in 40% of lawyer searches
  → Was appearing in 0% before
  → Inquiry volume increases
```

---

## API Endpoint Map

### Existing APIs (v1 - Unchanged)
```
GET  /api/v1/service-counts
     → {firms: 3207, lawyers: 169463, paralegals: 67785, notaries: N}
     
GET  /api/v1/service-counts/breakdown/lawyer
     → {firmCount: 3207, lawyerCount: 169463}
     
GET  /api/v1/service-counts/breakdown/notary
     → {notaryCount: N}
     
GET  /api/v1/law-firms/stats
     → [{practice_area: "Corporate Law", firms: 530, attorneys: 19465}, ...]
     
GET  /api/v1/directory/firms
     → [{id, name, city, state, practice_areas, hourlyRate}, ...]
     
GET  /api/v1/directory/notaries
     → [{id, name, state, commission_date}, ...]
     
GET  /api/v1/directory/firms/:firmId
     → {id, name, address, phone, website, attorneys: [...]}
```

### New APIs (v2 - Persona-Based)
```
GET  /api/v2/personas
     → [{id, persona_key, persona_name, can_hire, can_be_hired}, ...]
     
GET  /api/v2/personas/:id/marketplace
     → [{service_id, service_name, priority_rank, count}, ...] (ordered)
     
GET  /api/v2/personas/:id/menu
     → [{category, tools: [{tool_id, tool_name, tool_key}, ...]}, ...]
     
GET  /api/v2/services
     → [{id, name, is_hireable, tool_count}, ...] (all 48)
     
GET  /api/v2/services/:id/directory
     → [{company_id, company_name, tier, rating, price}, ...] (by service)
     
GET  /api/v2/services/:id/directory?filter=state:CA&sort=featured
     → Filtered/sorted directory for specific service
     
GET  /api/v2/companies
     → [{id, name, company_type, city, state, subscription_tier}, ...]
     
GET  /api/v2/companies/:id
     → {id, name, website, team_members, services_offered, ratings}
     
GET  /api/v2/subscription-tiers
     → [{tier_id, name, price, features: [...]}, ...]
     
POST /api/v2/companies/:id/subscribe
     → {tier_id} → Subscribe to tier
     
POST /api/v2/companies/:id/add-featured-listing
     → {specialty_id, location_id} → Add featured listing
```

---

## Feature Rollout Timeline

### Week 1: Foundation
- [x] Database schema finalized
- [ ] Create migration SQL files
- [ ] Import CSV data
- [ ] Create backend services

### Week 2: Backend
- [ ] Implement persona APIs
- [ ] Implement marketplace APIs
- [ ] Implement subscription APIs
- [ ] Add data refresh scheduler for new tables

### Week 3: Frontend
- [ ] DynamicLeftMenu component
- [ ] PersonalizedMarketplace component
- [ ] PersonaSwitcher component
- [ ] Feature flags added

### Week 4: Launch
- [ ] Beta rollout (10% users)
- [ ] Monitor & collect feedback
- [ ] Fix issues
- [ ] Gradual rollout to 100%

---

## Success Metrics

### Data
- ✅ 48 services in database
- ✅ 300+ tools properly categorized
- ✅ 15 personas with distinct priorities
- ✅ 720 persona-service priority mappings
- ✅ 3,207 law firms migrated to companies table

### Performance
- ✅ v1 API response time < 200ms
- ✅ v2 API response time < 300ms
- ✅ Page load time < 2 seconds

### Functionality
- ✅ Marketplace shows persona-specific priority
- ✅ Left menu shows persona-specific tools
- ✅ All 48 services searchable and filterable
- ✅ Subscription tiers working end-to-end
- ✅ Zero data loss from existing system

### User Experience
- ✅ Smooth persona switching
- ✅ Intuitive left menu navigation
- ✅ Clear featured visibility distinction
- ✅ Easy subscription upgrades

---

## Key Files Reference

### Database
```
migrations/001-010_existing.sql          (legacy tables)
migrations/010-016_new_persona.sql       (new tables)
migrations/017_import_csv_data.sql       (populate from CSVs)
```

### Backend Services
```
services/persona.service.ts              (persona queries)
services/marketplace.service.ts          (ranking/filtering)
services/company.service.ts              (company profiles)
services/subscription.service.ts         (tier management)
```

### Backend Routes
```
routes/personas.routes.ts                (/api/v2/personas/*)
routes/marketplace.routes.ts             (/api/v2/services/*)
routes/companies.routes.ts               (/api/v2/companies/*)
routes/subscriptions.routes.ts           (/api/v2/subscription-tiers/*)
```

### Frontend Components
```
components/LeftMenu/DynamicLeftMenu.tsx
components/Marketplace/PersonalizedMarketplace.tsx
components/PersonaSwitcher/PersonaSwitcher.tsx
components/Directory/ServiceDirectory.tsx
```

### Configuration
```
config/features.ts                       (feature flags)
config/personas.ts                       (persona definitions)
config/services.ts                       (service definitions)
```

---

## Documentation Cross-References

- **DATABASE_SCHEMA_UNIFIED.md** → Complete table design + queries
- **IMPLEMENTATION_GUIDE_CSV_TO_DB.md** → CSV import scripts + backend
- **MIGRATION_PRESERVE_EXISTING.md** → Safety plan for existing features
- **B2B_SUBSCRIPTION_TIERS.md** → Subscription tier details
- **LAWYER_WORKFLOWS_COMPREHENSIVE.md** → 15 lawyer workflow categories
- **FIRM_PROFILE_MANAGEMENT_SYSTEM.md** → Firm editing + verification

---

## Next Steps

1. **Create SQL migration files** (Week 1)
2. **Import CSV data** (Week 1)
3. **Build backend APIs** (Week 2)
4. **Build frontend components** (Week 3)
5. **Launch beta** (Week 4)

All while preserving 100% of existing functionality.

---

**Status: Ready for Implementation** ✅

