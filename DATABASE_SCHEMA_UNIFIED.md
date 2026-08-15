# 🗄️ Unified Database Schema

**Architecture:** Persona → Tool → Permission → Practice Area → Jurisdiction → Free/Paid → Provider  
**Purpose:** One system drives both marketplace + persona-specific left menu

---

## Core Tables

### 1. PERSONAS
```sql
CREATE TABLE personas (
  id SERIAL PRIMARY KEY,
  persona_key VARCHAR(50) UNIQUE, -- 'lawyer', 'paralegal', 'notary', 'client', etc.
  persona_name VARCHAR(100),
  description TEXT,
  icon VARCHAR(100), -- emoji or icon reference
  priority_order INT, -- affects marketplace listing order
  can_hire_others BOOLEAN, -- can this persona hire from marketplace?
  can_be_hired BOOLEAN, -- can this persona be hired?
  marketplace_visibility BOOLEAN, -- appears in marketplace?
  requires_verification BOOLEAN, -- needs license/credential verification?
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Example data:
-- ('lawyer', 'Lawyer', true, true, true, true)
-- ('notary', 'Notary', true, true, true, true)
-- ('client', 'Client', true, false, false, false)
-- ('paralegal', 'Paralegal', false, true, false, false)
```

---

### 2. TOOLS
```sql
CREATE TABLE tools (
  id SERIAL PRIMARY KEY,
  tool_key VARCHAR(100) UNIQUE, -- 'case_management', 'legal_research', 'e_discovery', etc.
  tool_name VARCHAR(255),
  description TEXT,
  icon VARCHAR(100),
  category VARCHAR(50), -- 'core', 'optional', 'free', 'paid', 'workflow'
  is_free BOOLEAN,
  provider VARCHAR(100), -- 'transcend', 'clio', 'mycase', 'external', etc.
  provider_url VARCHAR(255),
  integration_type VARCHAR(50), -- 'native', 'api', 'link', 'iframe'
  priority_order INT,
  requires_payment BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Example data:
-- ('case_management', 'Case Management', true, true, false, 'transcend')
-- ('legal_research', 'Legal Research Library', true, true, true, 'transcend')
-- ('e_discovery', 'E-Discovery Platform', false, true, false, 'relativity')
-- ('time_billing', 'Time & Billing', false, true, false, 'clio')
```

---

### 3. PERSONA_TOOLS (Junction)
```sql
CREATE TABLE persona_tools (
  id SERIAL PRIMARY KEY,
  persona_id INT REFERENCES personas(id),
  tool_id INT REFERENCES tools(id),
  menu_section VARCHAR(100), -- 'Legal Research', 'Discovery', 'Billing', etc.
  menu_order INT, -- order within section
  can_view BOOLEAN DEFAULT true,
  can_create BOOLEAN,
  can_edit BOOLEAN,
  can_delete BOOLEAN,
  can_share BOOLEAN,
  is_featured BOOLEAN DEFAULT false, -- shows prominently in menu
  created_at TIMESTAMP,
  UNIQUE(persona_id, tool_id)
);

-- Example data:
-- (lawyer_id, case_management_id, 'My Matters', 1, true, true, true, true, true)
-- (lawyer_id, legal_research_id, 'Legal Research', 2, true, true, false, false, false)
-- (client_id, case_management_id, 'My Matter', 1, true, false, false, false, false) -- read-only
-- (paralegal_id, legal_research_id, 'Legal Research', 1, true, true, true, true, true)
```

---

### 4. PRACTICE_AREAS
```sql
CREATE TABLE practice_areas (
  id SERIAL PRIMARY KEY,
  practice_key VARCHAR(100) UNIQUE, -- 'corporate_law', 'family_law', etc.
  practice_name VARCHAR(255),
  description TEXT,
  icon VARCHAR(100),
  parent_category VARCHAR(100), -- for hierarchies
  created_at TIMESTAMP
);

-- Example data:
-- ('corporate_law', 'Corporate Law', 'Business formation, M&A, governance')
-- ('family_law', 'Family Law', 'Divorce, custody, adoption')
-- ('tax_law', 'Tax Law', 'Tax planning, IRS disputes, returns')
```

---

### 5. JURISDICTIONS
```sql
CREATE TABLE jurisdictions (
  id SERIAL PRIMARY KEY,
  jurisdiction_key VARCHAR(50) UNIQUE, -- 'us_fed', 'ca', 'ny', 'tx', etc.
  jurisdiction_name VARCHAR(100),
  jurisdiction_type VARCHAR(50), -- 'federal', 'state', 'county', 'local'
  parent_jurisdiction VARCHAR(50), -- 'ca' for 'ca_san_francisco'
  created_at TIMESTAMP
);

-- Example data:
-- ('us_fed', 'Federal', 'federal')
-- ('ca', 'California', 'state')
-- ('ca_sf', 'San Francisco', 'county', 'ca')
-- ('ny', 'New York', 'state')
```

---

### 6. TOOL_PRACTICE_AREA (Junction)
```sql
CREATE TABLE tool_practice_area (
  id SERIAL PRIMARY KEY,
  tool_id INT REFERENCES tools(id),
  practice_area_id INT REFERENCES practice_areas(id),
  is_specialized BOOLEAN DEFAULT false, -- tool specifically designed for this area
  created_at TIMESTAMP,
  UNIQUE(tool_id, practice_area_id)
);

-- Example data:
-- (case_management_id, corporate_law_id, false)
-- (family_law_calculator_id, family_law_id, true) -- specialized for family law
-- (patent_search_id, ip_law_id, true) -- specialized for IP
```

---

### 7. TOOL_JURISDICTION (Junction)
```sql
CREATE TABLE tool_jurisdiction (
  id SERIAL PRIMARY KEY,
  tool_id INT REFERENCES tools(id),
  jurisdiction_id INT REFERENCES jurisdictions(id),
  is_primary BOOLEAN DEFAULT false, -- primary jurisdiction for this tool
  content_version VARCHAR(50), -- version of jurisdiction-specific content
  created_at TIMESTAMP,
  UNIQUE(tool_id, jurisdiction_id)
);

-- Example data:
-- (legal_research_id, us_fed_id, true)
-- (legal_research_id, ca_id, true)
-- (court_filing_id, ca_id, false)
```

---

### 8. USERS
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  primary_persona_id INT REFERENCES personas(id),
  company_id INT REFERENCES companies(id),
  is_company_admin BOOLEAN DEFAULT false,
  is_global_admin BOOLEAN DEFAULT false,
  status VARCHAR(50), -- 'active', 'pending', 'suspended'
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  last_login TIMESTAMP
);

-- A user CAN have multiple personas (switch roles)
```

---

### 9. USER_PERSONAS (Multi-role Support)
```sql
CREATE TABLE user_personas (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  persona_id INT REFERENCES personas(id),
  is_primary BOOLEAN DEFAULT false,
  credentials TEXT, -- JSON: {license_number, bar_state, verified: true/false}
  verification_status VARCHAR(50), -- 'verified', 'pending', 'failed'
  created_at TIMESTAMP,
  UNIQUE(user_id, persona_id)
);

-- Example: A person could be both a Lawyer and an Expert Witness
```

---

### 10. COMPANIES
```sql
CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  company_name VARCHAR(255),
  company_type VARCHAR(50), -- 'law_firm', 'solo', 'service_provider', 'external'
  logo_url VARCHAR(255),
  website VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(255),
  founded_year INT,
  company_size VARCHAR(50), -- 'solo', '2-10', '11-50', '51-200', '200+'
  description TEXT,
  subscription_tier VARCHAR(50), -- 'free', 'starter', 'professional', 'enterprise'
  subscription_status VARCHAR(50), -- 'active', 'expired', 'cancelled'
  subscription_renewal_date DATE,
  billing_email VARCHAR(255),
  is_verified BOOLEAN DEFAULT false,
  verification_status VARCHAR(50), -- 'verified', 'pending', 'rejected'
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

### 11. COMPANY_LOCATIONS
```sql
CREATE TABLE company_locations (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(2),
  zip VARCHAR(10),
  country VARCHAR(2),
  phone VARCHAR(20),
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP
);
```

---

### 12. COMPANY_SERVICES
```sql
CREATE TABLE company_services (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id),
  service_persona_id INT REFERENCES personas(id), -- what service do they offer? (lawyer, notary, investigator, etc.)
  practice_area_id INT REFERENCES practice_areas(id), -- optional: specific practice area
  jurisdiction_id INT REFERENCES jurisdictions(id), -- optional: where they serve
  hourly_rate DECIMAL,
  flat_fee DECIMAL,
  description TEXT,
  years_experience INT,
  cases_handled INT,
  success_rate DECIMAL, -- percentage
  avg_settlement_amount DECIMAL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Example:
-- Company: "Smith & Associates", Service: Lawyer, Practice: Corporate Law, Jurisdiction: CA, Rate: $350/hr
-- Company: "Jane's Notary", Service: Notary, Jurisdiction: NY, Flat Fee: $150 per notarization
```

---

### 13. COMPANY_TEAM_MEMBERS
```sql
CREATE TABLE company_team_members (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id),
  user_id INT REFERENCES users(id),
  role VARCHAR(50), -- 'admin', 'attorney', 'paralegal', 'staff', 'member'
  title VARCHAR(100),
  license_number VARCHAR(100),
  license_state VARCHAR(2),
  bar_association_id VARCHAR(100),
  years_experience INT,
  specialties TEXT, -- JSON array
  bio TEXT,
  is_public BOOLEAN DEFAULT true, -- show on company profile?
  created_at TIMESTAMP
);
```

---

### 14. FEATURED_LISTINGS
```sql
CREATE TABLE featured_listings (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id),
  listing_type VARCHAR(50), -- 'specialty', 'location', 'service_area', 'top_banner'
  practice_area_id INT REFERENCES practice_areas(id), -- nullable
  jurisdiction_id INT REFERENCES jurisdictions(id), -- nullable
  featured_start_date DATE,
  featured_end_date DATE,
  monthly_cost DECIMAL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP
);

-- Example:
-- Company: "Smith Lawyers", Type: specialty, Practice: Corporate Law, Cost: $29/month
-- Company: "Jane's Notary", Type: location, Jurisdiction: NY, Cost: $29/month
-- Company: "Expert Witnesses Inc", Type: service_area, Service: Expert Witness, Practice: Medical Malpractice, Cost: $49/month
```

---

### 15. MARKETPLACE_LISTINGS (Company Profile in Marketplace)
```sql
CREATE TABLE marketplace_listings (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) UNIQUE,
  profile_completeness INT, -- percentage 0-100
  featured_visibility INT, -- percentage based on tier
  search_ranking INT, -- computed ranking
  total_views INT,
  total_impressions INT,
  total_clicks INT,
  total_messages INT,
  total_hires INT,
  rating DECIMAL, -- 1-5 stars
  review_count INT,
  response_time_hours INT,
  last_updated TIMESTAMP,
  created_at TIMESTAMP
);
```

---

### 16. COMPANY_MESSAGING
```sql
CREATE TABLE company_messaging (
  id SERIAL PRIMARY KEY,
  from_company_id INT REFERENCES companies(id),
  to_company_id INT REFERENCES companies(id),
  subject VARCHAR(255),
  message TEXT,
  message_type VARCHAR(50), -- 'connection_request', 'service_inquiry', 'partnership', 'message'
  status VARCHAR(50), -- 'sent', 'viewed', 'replied', 'archived'
  is_template_based BOOLEAN DEFAULT false,
  created_at TIMESTAMP,
  viewed_at TIMESTAMP,
  replied_at TIMESTAMP
);
```

---

### 17. USER_MENU_PREFERENCES
```sql
CREATE TABLE user_menu_preferences (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  persona_id INT REFERENCES personas(id),
  tool_id INT REFERENCES tools(id),
  is_favorite BOOLEAN DEFAULT false,
  is_hidden BOOLEAN DEFAULT false,
  custom_order INT,
  created_at TIMESTAMP,
  UNIQUE(user_id, persona_id, tool_id)
);
```

---

## Sample Queries

### Query 1: Get Left Menu for Lawyer in California

```sql
SELECT 
  pt.menu_section,
  pt.menu_order,
  t.tool_name,
  t.icon,
  t.is_free,
  t.provider,
  t.tool_key
FROM persona_tools pt
JOIN tools t ON pt.tool_id = t.id
JOIN personas p ON pt.persona_id = p.id
WHERE p.persona_key = 'lawyer'
  AND pt.menu_section IS NOT NULL
  AND pt.can_view = true
ORDER BY pt.menu_section, pt.menu_order;
```

**Result:** Menu sections like "Legal Research", "Discovery", "Billing", etc. with tools listed in order.

---

### Query 2: Get Marketplace for Notaries in New York

```sql
SELECT 
  c.company_name,
  c.subscription_tier,
  cs.hourly_rate,
  cs.years_experience,
  ml.featured_visibility,
  ml.total_views,
  ml.rating
FROM companies c
JOIN company_services cs ON c.id = cs.company_id
JOIN personas p ON cs.service_persona_id = p.id
JOIN marketplace_listings ml ON c.id = ml.company_id
JOIN jurisdictions j ON cs.jurisdiction_id = j.id
WHERE p.persona_key = 'notary'
  AND j.jurisdiction_key = 'ny'
  AND c.is_verified = true
ORDER BY ml.featured_visibility DESC, ml.rating DESC;
```

**Result:** Ranked list of Notaries in NY based on tier + rating + featured status.

---

### Query 3: Get All Tools for Lawyer by Practice Area (Family Law)

```sql
SELECT 
  pt.menu_section,
  t.tool_name,
  t.is_free,
  tpa.is_specialized
FROM persona_tools pt
JOIN tools t ON pt.tool_id = t.id
JOIN tool_practice_area tpa ON t.id = tpa.tool_id
JOIN practice_areas pa ON tpa.practice_area_id = pa.id
JOIN personas p ON pt.persona_id = p.id
WHERE p.persona_key = 'lawyer'
  AND pa.practice_key = 'family_law'
  AND pt.can_view = true
ORDER BY tpa.is_specialized DESC, pt.menu_order;
```

**Result:** Tools relevant to family law practice, with specialized tools first.

---

### Query 4: Get Marketplace Search Results (Search by Persona + Practice Area + Jurisdiction)

```sql
SELECT 
  c.company_name,
  c.logo_url,
  c.subscription_tier,
  cs.practice_area_id,
  cs.hourly_rate,
  cs.success_rate,
  ml.rating,
  ml.featured_visibility,
  CASE 
    WHEN fl.is_active THEN 'featured'
    ELSE 'standard'
  END as listing_status
FROM companies c
JOIN company_services cs ON c.id = cs.company_id
JOIN personas p ON cs.service_persona_id = p.id
JOIN marketplace_listings ml ON c.id = ml.company_id
JOIN jurisdictions j ON cs.jurisdiction_id = j.id
LEFT JOIN featured_listings fl ON c.id = fl.company_id AND fl.is_active = true
WHERE p.persona_key = ?  -- e.g., 'lawyer'
  AND cs.practice_area_id = ? -- e.g., corporate_law
  AND j.jurisdiction_key = ? -- e.g., 'ca'
  AND c.is_verified = true
ORDER BY 
  fl.is_active DESC,  -- featured first
  ml.rating DESC,     -- highest rated
  ml.featured_visibility DESC  -- by tier visibility
LIMIT 20;
```

---

### Query 5: Get User's Left Menu (Respects Their Role + Preferences)

```sql
SELECT 
  pt.menu_section,
  pt.menu_order,
  t.tool_name,
  t.tool_key,
  t.is_free,
  COALESCE(ump.is_favorite, false) as is_favorite,
  COALESCE(ump.custom_order, pt.menu_order) as display_order
FROM user_personas up
JOIN persona_tools pt ON up.persona_id = pt.persona_id
JOIN tools t ON pt.tool_id = t.id
LEFT JOIN user_menu_preferences ump ON 
  up.user_id = ump.user_id 
  AND up.persona_id = ump.persona_id 
  AND t.id = ump.tool_id
WHERE up.user_id = ?
  AND up.is_primary = true
  AND pt.can_view = true
  AND COALESCE(ump.is_hidden, false) = false
ORDER BY pt.menu_section, COALESCE(ump.custom_order, pt.menu_order);
```

**Result:** Personalized left menu that respects user's customizations.

---

## Key Design Principles

### 1. Single Source of Truth
- One `tools` table
- One `personas` table
- One `persona_tools` junction
- **Result:** Menu and marketplace are driven by same data model

### 2. Persona-Driven UI
- User logs in → persona selected → left menu loads via `persona_tools`
- Admin views marketplace → filters by persona + practice area + jurisdiction
- **Result:** Different views for different roles without duplicate data

### 3. Permission-Based Access
- Each `persona_tool` row has `can_view`, `can_create`, `can_edit`, `can_delete`
- Lawyer can use Legal Research, Paralegal can use Discovery, Client can only view cases
- **Result:** Role-based access control at the database level

### 4. Practice Area & Jurisdiction Filtering
- Tools linked to practice areas (optional)
- Tools linked to jurisdictions (optional)
- Marketplace filters by both + persona
- **Result:** Users see only relevant tools for their practice

### 5. Subscription-Driven Visibility
- `featured_visibility` determines how often a company appears in search
- Featured listings override default ranking
- **Result:** Revenue tied directly to visibility

### 6. Extensible for New Services
- Add new persona → add to `personas` table
- Add new tool → add to `tools` table
- Link them in `persona_tools` → automatically shows in menu
- **Result:** No code changes needed to add new services

---

## Implementation Path

### Phase 1: Core Schema + Marketplace
- Tables 1-7, 10-12, 15
- Basic marketplace search
- Free tier listings

### Phase 2: Subscription & B2B
- Tables 8-9, 13-14, 16
- Subscription tier logic
- Company messaging
- Featured listings

### Phase 3: Menu System
- Table 17
- Dynamic left menu
- User customization
- Persona switching

### Phase 4: Analytics & Reporting
- Marketplace metrics (table 15)
- Conversion tracking
- Performance reports

---

**This schema enables one system to power the entire platform—marketplace, left menu, permissions, and billing—without duplication.**

