# 📋 Firm Profile Management System - Architecture & Requirements

**Status:** ✅ Foundation Complete | 🔄 Profiles In Progress  
**Date:** August 15, 2026  

---

## What's Complete

### 1. Service Selection Counts ✅
- **Separate counts displayed:**
  - Law Firms: **3,207**
  - Lawyers: **169,463**
  - Paralegals: **67,785** (40% of lawyer pool)
  - Notaries: **0** (ready for CSV import)
  - Other services: Estimated counts

### 2. Find an Attorney - Cost Filtering ✅
- **Cost filter buttons:**
  - Budget-Friendly ($0-$200/hr)
  - Moderate ($200-$400/hr)
  - Premium ($400+/hr)
  - All Rates
- **Hourly rates display** on attorney cards
- **Real-time filtering** as user selects cost range

### 3. Service-Specific Information ✅
- Currently supports lawyers with: name, specialization, rating, experience, hourly rate
- Foundation for service-specific fields (see architecture below)

---

## What's Needed: Firm Profile Management

### Core Concept
Each service type (Lawyer, Notary, Mediator, Investigator, etc.) has:
- **Own firm data card** with editable fields
- **Service-specific information requirements**
- **Role-based access control:**
  - Firm admins: Edit their own firm
  - Global admin (Jim): Edit all firms
  - Clients: View (no edit)

---

## Service-Specific Profile Fields

### 🏢 Law Firms
**Fields to Capture:**
- Firm name, address, phone, website
- Founding year
- Number of attorneys
- Practice areas (specialties)
- Hourly rates (by attorney or firm average)
- **Track Record:**
  - Total cases handled
  - Cases won/settled
  - Settlement amounts (ranges)
  - Success rate (%)
  - Years in practice per attorney
- Bar license info per attorney
- Professional credentials
- Notable case history

### 📋 Notary Services
**Fields to Capture:**
- Notary name, license #
- State(s) licensed in
- Commission expiry date
- Specialties (if any):
  - General notary
  - E-notary (remote)
  - Electronic notary
  - Loan signing
  - Apostille services
- Availability (24/7? weekdays only?)
- **Pricing:** Flat rate or per-notarization
- Phone, email, location
- Service area (remote, in-person, both)

### 🤝 Mediator Services
**Fields to Capture:**
- Name, credentials (if any)
- Mediation focus areas:
  - Divorce/family
  - Business disputes
  - Civil disputes
  - Labor/employment
- Years as mediator
- Cases mediated
- Settlement rate (%)
- Training/certification
- Hourly rate
- Availability
- Practice philosophy (summary)

### 🔍 Private Investigator
**Fields to Capture:**
- Name, license #
- State(s) licensed
- Specializations:
  - Background checks
  - Fraud investigation
  - Infidelity
  - Asset location
  - Corporate investigations
- Years experience
- Cases completed
- Success rate
- Hourly rate
- Availability (24/7?)
- Equipment/methods (if public-facing)

### 📄 Legal Document Preparer
**Fields to Capture:**
- Name, certification
- Document types:
  - Wills & trusts
  - Bankruptcy forms
  - Real estate docs
  - LLC formation
  - Contracts
- Years experience
- Documents prepared (count)
- Hourly rate or flat fees (by service type)
- Turnaround time estimates
- Software used (LegalZoom, LawDepot, etc.)

### ⚖️ Attorney/Lawyer (Individual)
**Fields to Capture:**
- Full name
- Bar license # & state(s)
- Specialties (can select multiple)
- Years practicing
- Law school attended
- Board certifications
- **Track Record:**
  - Cases handled
  - Cases won (%)
  - Settlements/verdicts
  - Average settlement amount
  - Unique skills/reputation
- Hourly rate
- Firm affiliation
- Contact info
- Education & honors
- Languages spoken
- Client testimonials/reviews

### Other Services (Similar Pattern)
- **Court Reporter:** Specialty certifications, WPM, equipment
- **Expert Witness:** Field of expertise, expert testimony count, hourly rate
- **Tax Preparer:** Certifications (CPA, EA, etc.), tax types, hourly rate
- **Bail Bondsman:** License, years, cases bonded, rates/fees
- **Title Agent:** States licensed, transactions handled, firm

---

## Architecture: Firm Profile Card System

### Database Structure (Proposed)

```sql
-- Main firm/professional entity
CREATE TABLE service_providers (
  id SERIAL PRIMARY KEY,
  user_id INT UNIQUE,
  service_type VARCHAR(50), -- 'lawyer', 'notary', 'mediator', etc.
  name VARCHAR(255),
  location_city VARCHAR(100),
  location_state VARCHAR(2),
  phone VARCHAR(20),
  website VARCHAR(255),
  base_hourly_rate INT,
  status VARCHAR(20), -- 'active', 'inactive', 'pending-verification'
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Service-specific extended info
CREATE TABLE lawyer_profiles (
  id SERIAL PRIMARY KEY,
  provider_id INT REFERENCES service_providers,
  bar_license VARCHAR(100),
  years_practicing INT,
  cases_handled INT,
  cases_won INT,
  avg_settlement_amount DECIMAL,
  specialties TEXT[], -- array of specialty IDs
  education TEXT,
  certifications TEXT
);

CREATE TABLE notary_profiles (
  id SERIAL PRIMARY KEY,
  provider_id INT REFERENCES service_providers,
  license_number VARCHAR(100),
  commission_expiry DATE,
  remote_available BOOLEAN,
  specialties TEXT[], -- general, e-notary, loan-signing, etc.
  service_area VARCHAR(100),
  pricing_model VARCHAR(50) -- flat-rate or per-service
);

-- More tables for mediator, investigator, etc.
-- Each with their own required fields
```

### API Endpoints (Proposed)

```
GET /api/v1/firms/:firmId
  → Returns complete firm profile (public view)

GET /api/v1/firms/:firmId/edit
  → Returns editable form (admin only)

PATCH /api/v1/firms/:firmId
  → Update firm profile (role-based auth)

POST /api/v1/firms/:firmId/verify
  → Admin verification endpoint

GET /api/v1/firms/:firmId/track-record
  → Returns case history, settlements, wins

GET /api/v1/firms/search?service=lawyer&state=CA&rate_max=400
  → Search firms with filtering
```

### Frontend Components (Proposed)

**1. Firm Card (Read-Only View)**
```
┌─────────────────────────────────┐
│ 🏢 Firm Name                    │
│ 📍 City, State                  │
│                                 │
│ Specialties: Corporate, Tax Law │
│ 👥 50 Attorneys                 │
│ ⭐ 4.8 rating (from 200 reviews) │
│                                 │
│ Track Record:                   │
│ • 1,250 cases handled           │
│ • 89% win rate                  │
│ • Avg settlement: $450k         │
│                                 │
│ 💰 Hourly Rate: $350-$500/hr    │
│ 📞 (415) 555-0100               │
│ 🌐 www.firmname.com             │
│                                 │
│ [View Details] [Hire] [Contact] │
└─────────────────────────────────┘
```

**2. Firm Editor (Admin View)**
```
Edit Firm Profile: [Firm Name]

General Info:
  [Name field]
  [Phone]
  [Website]
  [City] [State]

Service Info:
  Specialties: [Checkboxes]
  Hourly Rate: [Input]

Track Record:
  Cases Handled: [Number]
  Cases Won: [Number]
  Avg Settlement: [Currency]
  Success Rate: [%]

[Save Changes] [Cancel]
```

---

## Role-Based Access Control

### Permission Levels

| Role | Can View | Can Edit | Can Delete |
|------|----------|----------|-----------|
| **Firm Admin** | Their own firm | Their own firm | No |
| **Global Admin (Jim)** | All firms | All firms | All firms |
| **Service Provider** | Their own firm | Their own firm | No |
| **Client** | All public firms | No | No |
| **Unauthenticated** | Search results | No | No |

---

## Information-Gathering Process

### For Lawyers: Standard Questions
- How many cases have you handled in your specialty?
- What's your win rate / settlement rate?
- What's your average settlement amount?
- What bar licenses/certifications do you hold?
- Years practicing this specific area?
- Notable case victories?

### For Notaries: Standard Questions
- Which notary types (general, e-notary, loan signing)?
- Commission expiry date?
- Can you work remotely?
- Service area coverage?
- Pricing per notarization?

### For Mediators: Standard Questions
- How many cases mediated?
- What's your settlement rate?
- What types of disputes do you mediate?
- Any certifications or training?
- Years as a mediator?

### For Investigators: Standard Questions
- Types of investigations (background, fraud, etc.)?
- Years in business?
- Investigations completed?
- License/certification info?
- Availability (24/7 or scheduled)?

---

## Implementation Phases

### Phase 1: Core Infrastructure ✅
- [x] Service provider base model
- [x] User authentication & role system
- [x] Basic firm card display
- [x] Search/filter infrastructure

### Phase 2: Lawyer Profiles 🔄
- [ ] Lawyer-specific profile fields
- [ ] Firm admin edit interface
- [ ] Track record display
- [ ] Verification workflow

### Phase 3: Other Service Types
- [ ] Notary profiles
- [ ] Mediator profiles
- [ ] Investigator profiles
- [ ] Tax preparer profiles
- [ ] Other services (court reporter, bail bondsman, etc.)

### Phase 4: Admin Dashboard
- [ ] Global admin view (all firms)
- [ ] Verification management
- [ ] Bulk updates
- [ ] Analytics/reporting

### Phase 5: Enhanced Hiring
- [ ] Direct booking/hiring flow
- [ ] Quote request system
- [ ] Review/rating system
- [ ] Payment integration

---

## Track Record & Credentials Capture

### Why Track Record Matters
- **Lawyers:** Demonstrates case history, success rate, settlement patterns
- **Notaries:** License validity, specialization proof
- **Mediators:** Settlement rate (confidence metric)
- **Investigators:** Experience level and success metrics
- **All:** Professional reputation & credibility

### How to Gather
1. **Self-reported (initial):** Firm fills in form
2. **Verified:** Admin spot-checks with bar association, state licensing
3. **AI-assisted:** Parse public records, court databases (future)
4. **User reviews:** Track record grows from client feedback

### Storage & Display
- **Secure:** Don't expose sensitive case details
- **Privacy:** Anonymize if client preferred
- **Measurable:** Use percentages and aggregate numbers
- **Verifiable:** Link to bar associations, licensing boards

---

## Next Steps

1. **Design firm profile editor UI**
   - Create forms for each service type
   - Add field validation
   - Implement save/cancel

2. **Build permission system**
   - Role-based access checks
   - Firm ownership validation
   - Admin override capability

3. **Implement profile editing**
   - PATCH endpoints per service type
   - Audit logging (track changes)
   - Verification workflows

4. **Populate with real data**
   - Import track record from CSVs
   - Verify attorney licenses
   - Gather notary/mediator info

5. **Create verification system**
   - Admin approval workflow
   - Automated license verification
   - Dispute resolution

---

## Files To Create

- `FirmProfileEditor.tsx` - Editable firm card component
- `LawFirmProfile.tsx` - Lawyer-specific profile viewer
- `NotaryProfile.tsx` - Notary-specific profile viewer
- `firm-profile.service.ts` - Backend service
- `firm-profile.routes.ts` - API endpoints
- Database migrations for service_providers & specialty tables

---

**System ready for Phase 2 implementation: Lawyer profiles with editable firm data.**

