# 🛠️ Implementation Guide: CSV Data to Database Schema

**Status:** Ready to implement  
**Date:** August 15, 2026  
**CSVs Processed:** 4 files with 48 services and 15 personas

---

## Executive Summary

Your CSV files define:
- **48 Services** (all hireable entities)
- **15 Personas** (Client, Lawyer, Paralegal, PI, Process Server, Court Reporter, Expert Witness, Forensic Accountant, Legal Researcher, Notary, Mediator, Legal Document Preparer, Tax Advisor, Tax Preparation & Filing, Title Agent)
- **300+ Left-Menu Tools** (service-specific tools each persona accesses)
- **Persona-to-Service Priority Rankings** (determines marketplace search order and left-menu visibility)

This guide maps your CSVs directly to the database schema and provides SQL import scripts.

---

## CSV Structure Analysis

### CSV 1: Service Catalog
```
ID | Service
1  | Arbitrator
2  | Background Check Service
...
48 | Contract Attorney / Document Review Attorney
```
**Mapping:** `services` table

### CSV 2: Left Menu Tools
```
Service_ID | Service | Tool_Order | Left_Menu_Tool | Type
1          | Arbitrator | 1 | Arbitration Rules & Procedures | Left Menu Tool
```
**Mapping:** `tools` + `service_tools` (junction)

### CSV 3: Persona Priority
```
Persona | Priority_Rank | Service_ID | Service
Client / General Public | 1 | 10 | Lawyer
Lawyer | 1 | 18 | Process Server
```
**Mapping:** `personas` + `persona_marketplace_priority` (junction)

### CSV 4: Claude Import
```
ID | Service | Hireable_Entity | Left_Menu_Tools_Count
10 | Lawyer | Yes (legal service) | 22
```
**Mapping:** Validation/summary data

---

## Database Schema Mapping

### Phase 1: Core Tables (Import CSVs Directly)

#### 1. SERVICES Table
```sql
CREATE TABLE services (
  id SERIAL PRIMARY KEY,
  service_key VARCHAR(100) UNIQUE,
  service_name VARCHAR(255),
  description TEXT,
  icon VARCHAR(100),
  is_hireable BOOLEAN DEFAULT true,
  priority_rank INT, -- from CSV import
  tool_count INT, -- from CSV import
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Import Script:**
```sql
INSERT INTO services (id, service_key, service_name, is_hireable, tool_count) VALUES
(1, 'arbitrator', 'Arbitrator', true, 4),
(2, 'background_check', 'Background Check Service', true, 4),
(3, 'bail_bondsman', 'Bail Bondsman', true, 4),
...
(10, 'lawyer', 'Lawyer', true, 22),
...
(48, 'contract_attorney_dr', 'Contract Attorney / Document Review Attorney', true, 6);
```

#### 2. TOOLS Table
```sql
CREATE TABLE tools (
  id SERIAL PRIMARY KEY,
  tool_key VARCHAR(100) UNIQUE,
  tool_name VARCHAR(255),
  service_id INT REFERENCES services(id),
  tool_order INT, -- from CSV left_menu_tools.csv
  is_free BOOLEAN DEFAULT true,
  category VARCHAR(50), -- 'research', 'discovery', 'admin', etc.
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Import Script (Sample - Lawyer tools):**
```sql
INSERT INTO tools (tool_name, service_id, tool_order, category) VALUES
('Free Legal Research Library', 10, 1, 'research'),
('Case Law Search', 10, 2, 'research'),
('Statute & Regulation Search', 10, 3, 'research'),
('Court Rules & Forms', 10, 4, 'research'),
('Docket / Court Calendar', 10, 5, 'court'),
('Legal Templates & Forms', 10, 6, 'templates'),
('Legal AI / Research Assistant', 10, 7, 'ai'),
('E-Discovery Workspace', 10, 8, 'discovery'),
('Document Review Workspace', 10, 9, 'discovery'),
('Medical Records Request', 10, 10, 'admin'),
('Legal Researcher/Paralegal Marketplace', 10, 11, 'marketplace'),
('Expert Witness Marketplace', 10, 12, 'marketplace'),
('Process Server Marketplace', 10, 13, 'marketplace'),
('Private Investigator Marketplace', 10, 14, 'marketplace'),
('Court Reporter Marketplace', 10, 15, 'marketplace'),
('Legal Billing/Timekeeping', 10, 16, 'billing'),
('Client Intake & Portal', 10, 17, 'client'),
('Deadline/Task Manager', 10, 18, 'admin'),
('Secure Document Storage', 10, 19, 'storage'),
('E-Signature', 10, 20, 'e-signature'),
('Conflict Check', 10, 21, 'compliance'),
('Legal News & Alerts', 10, 22, 'news');
```

#### 3. PERSONAS Table
```sql
CREATE TABLE personas (
  id SERIAL PRIMARY KEY,
  persona_key VARCHAR(100) UNIQUE,
  persona_name VARCHAR(255),
  description TEXT,
  icon VARCHAR(100),
  can_hire BOOLEAN DEFAULT true,
  can_be_hired BOOLEAN DEFAULT false,
  marketplace_order INT, -- display order in marketplace
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Import Script:**
```sql
INSERT INTO personas (persona_key, persona_name, can_hire, can_be_hired) VALUES
('client', 'Client / General Public', true, false),
('lawyer', 'Lawyer', true, true),
('paralegal', 'Paralegal', false, true),
('private_investigator', 'Private Investigator', false, true),
('process_server', 'Process Server', false, true),
('court_reporter', 'Court Reporter', false, true),
('expert_witness', 'Expert Witness', false, true),
('forensic_accountant', 'Forensic Accountant', false, true),
('legal_researcher', 'Legal Researcher', false, true),
('notary', 'Notary', false, true),
('mediator', 'Mediator', false, true),
('legal_document_preparer', 'Legal Document Preparer', false, true),
('tax_preparation_advisor', 'Tax Preparation Advisor', false, true),
('tax_preparation_filing', 'Tax Preparation & Filing', false, true),
('title_agent', 'Title Agent', false, true);
```

#### 4. PERSONA_MARKETPLACE_PRIORITY (Junction)
```sql
CREATE TABLE persona_marketplace_priority (
  id SERIAL PRIMARY KEY,
  persona_id INT REFERENCES personas(id),
  service_id INT REFERENCES services(id),
  priority_rank INT, -- 1-48 from CSV
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(persona_id, service_id)
);
```

**Import Script (Sample - Lawyer persona):**
```sql
INSERT INTO persona_marketplace_priority (persona_id, service_id, priority_rank) VALUES
(2, 18, 1),  -- Lawyer sees Process Server as #1 option
(2, 17, 2),  -- Private Investigator #2
(2, 6, 3),   -- Court Reporter #3
(2, 7, 4),   -- Expert Witness #4
...
(2, 1, 48);  -- Arbitrator #48
```

#### 5. PERSONA_TOOLS (Junction)
```sql
CREATE TABLE persona_tools (
  id SERIAL PRIMARY KEY,
  persona_id INT REFERENCES personas(id),
  tool_id INT REFERENCES tools(id),
  can_view BOOLEAN DEFAULT true,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_share BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(persona_id, tool_id)
);
```

**Import Logic:** 
- Extract tools for each persona from CSV 2 (left_menu_tools.csv)
- For Lawyer persona: Insert 22 tools (rows 41-62 from CSV2)
- For Paralegal persona: Insert 13 tools (rows 92-104 from CSV2)
- For each persona: Insert only their tools in order

---

## Import Process: Step-by-Step

### Step 1: Create Base Tables
```bash
# Run this SQL file
psql transcend_db < create_base_tables.sql
```

### Step 2: Import Services
```bash
# Import from CSV1: transcend_law_service_catalog_v2.csv
psql transcend_db -c "
COPY services (id, service_name, is_hireable) 
FROM '/path/to/transcend_law_service_catalog_v2.csv' 
WITH (FORMAT csv, HEADER true);
"
```

### Step 3: Generate service_key values
```sql
UPDATE services 
SET service_key = LOWER(REPLACE(service_name, ' ', '_'))
WHERE service_key IS NULL;
```

### Step 4: Import Tools from CSV2
```python
# Python script to process CSV2 and generate INSERT statements
import csv

with open('transcend_law_left_menu_tools.csv', 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        service_id = row['Service_ID']
        tool_name = row['Left_Menu_Tool']
        tool_order = row['Tool_Order']
        
        # Generate tool_key
        tool_key = tool_name.lower().replace(' ', '_').replace('/', '_')
        
        print(f"""
        INSERT INTO tools (tool_key, tool_name, service_id, tool_order)
        VALUES ('{tool_key}', '{tool_name}', {service_id}, {tool_order});
        """)
```

### Step 5: Import Persona Priority from CSV3
```python
# Python script to process CSV3 and generate INSERT statements
import csv

with open('transcend_law_persona_priority_v2.csv', 'r') as f:
    reader = csv.DictReader(f)
    
    # Group by persona
    personas_data = {}
    for row in reader:
        persona = row['Persona']
        service_id = row['Service_ID']
        priority = row['Priority_Rank']
        
        if persona not in personas_data:
            personas_data[persona] = []
        personas_data[persona].append((service_id, priority))
    
    # Generate INSERT statements
    for persona, services in personas_data.items():
        persona_id = get_persona_id(persona)  # lookup
        for service_id, priority in services:
            print(f"""
            INSERT INTO persona_marketplace_priority 
            (persona_id, service_id, priority_rank)
            VALUES ({persona_id}, {service_id}, {priority});
            """)
```

### Step 6: Populate persona_tools (Join tools with personas)
```sql
-- For each persona, insert their tools from the CSV
-- Example: Lawyer persona gets all tools from service_id=10 (Lawyer service)
-- where tool_order IN (1-22)

INSERT INTO persona_tools (persona_id, tool_id, can_view, can_create)
SELECT 
  (SELECT id FROM personas WHERE persona_key = 'lawyer'),
  t.id,
  true,
  (CASE WHEN t.tool_order <= 15 THEN true ELSE false END) -- primary tools can create
FROM tools t
WHERE t.service_id = 10
ORDER BY t.tool_order;
```

---

## Frontend Components to Build

### 1. Marketplace View (Dynamic by Persona)
```typescript
// src/components/Marketplace/ServiceMarketplace.tsx
interface ServiceMarketplaceProps {
  personaId: number;
}

export const ServiceMarketplace: React.FC<ServiceMarketplaceProps> = ({ personaId }) => {
  // Query: persona_marketplace_priority JOIN services
  // Result: Services ordered by priority_rank for this persona
  // Display: Service cards in priority order with counts
};
```

**Query:**
```sql
SELECT s.* 
FROM services s
JOIN persona_marketplace_priority pmp ON s.id = pmp.service_id
WHERE pmp.persona_id = ?
ORDER BY pmp.priority_rank
```

### 2. Left Menu (Dynamic by Persona)
```typescript
// src/components/LeftMenu/DynamicLeftMenu.tsx
interface DynamicLeftMenuProps {
  personaId: number;
  userId: number;
}

export const DynamicLeftMenu: React.FC<DynamicLeftMenuProps> = ({ personaId, userId }) => {
  // Query: persona_tools JOIN tools, grouped by category
  // Result: Menu sections with tools for this persona
  // Display: Collapsible sections with tool links
};
```

**Query:**
```sql
SELECT 
  t.category,
  t.tool_name,
  t.tool_key,
  pt.can_view,
  pt.can_create
FROM persona_tools pt
JOIN tools t ON pt.tool_id = t.id
WHERE pt.persona_id = ?
  AND pt.can_view = true
ORDER BY t.category, t.tool_order
```

### 3. Service Directory (Filterable by Persona)
```typescript
// src/components/Directory/ServiceDirectory.tsx
export const ServiceDirectory: React.FC<{ personaId: number }> = ({ personaId }) => {
  // Query: services ordered by persona's priority
  // Result: Full directory with counts and links
  // Display: Directory grid/list with search/filter
};
```

---

## Sample Data: After Import

### Services Table (48 rows)
```
ID | Service_Name | Service_Key | Is_Hireable | Tool_Count
1  | Arbitrator | arbitrator | true | 4
10 | Lawyer | lawyer | true | 22
15 | Notary | notary | true | 5
```

### Tools Table (300+ rows)
```
ID | Tool_Name | Service_ID | Tool_Order | Tool_Key
1  | Arbitration Rules & Procedures | 1 | 1 | arbitration_rules
...
100| Free Legal Research Library | 10 | 1 | free_legal_research
101| Case Law Search | 10 | 2 | case_law_search
```

### Personas Table (15 rows)
```
ID | Persona_Key | Persona_Name | Can_Hire | Can_Be_Hired
1  | client | Client / General Public | true | false
2  | lawyer | Lawyer | true | true
3  | paralegal | Paralegal | false | true
```

### Persona_Marketplace_Priority Table (15 × 48 = 720 rows)
```
ID | Persona_ID | Service_ID | Priority_Rank
1  | 1 | 10 | 1  -- Client sees Lawyer first
2  | 1 | 14 | 2  -- Client sees Mediator second
...
721| 2 | 18 | 1  -- Lawyer sees Process Server first
722| 2 | 17 | 2  -- Lawyer sees PI second
```

### Persona_Tools Table (15 × avg 20 tools = 300 rows)
```
ID | Persona_ID | Tool_ID | Can_View | Can_Create
1  | 2 | 100 | true | true   -- Lawyer can view/create "Legal Research"
2  | 2 | 101 | true | true   -- Lawyer can view/create "Case Law Search"
...
300| 3 | 200 | true | true   -- Paralegal can view their tools
```

---

## Implementation Timeline

### Week 1: Database Setup
- [ ] Create SQL schema files
- [ ] Write Python import scripts
- [ ] Import all data from CSVs
- [ ] Validate data integrity
- [ ] Create migration files

### Week 2: Backend APIs
- [ ] GET /api/v1/personas (list all personas)
- [ ] GET /api/v1/personas/:id/marketplace (priority-ordered services)
- [ ] GET /api/v1/personas/:id/menu (left-menu tools)
- [ ] GET /api/v1/services (all services with counts)
- [ ] GET /api/v1/services/:id (single service details)

### Week 3: Frontend Components
- [ ] DynamicLeftMenu component
- [ ] ServiceMarketplace component
- [ ] ServiceDirectory component
- [ ] Persona switcher UI
- [ ] Integration with existing Dashboard

### Week 4: Testing & Polish
- [ ] E2E testing all personas
- [ ] Performance optimization
- [ ] Dark mode support
- [ ] Responsive design
- [ ] Analytics/tracking

---

## Key Files to Create

```
transcend-law/backend/src/
├── migrations/
│   ├── 001_create_services_table.sql
│   ├── 002_create_tools_table.sql
│   ├── 003_create_personas_table.sql
│   ├── 004_create_persona_marketplace_priority.sql
│   ├── 005_create_persona_tools.sql
│   └── 006_import_csv_data.sql
├── scripts/
│   ├── import_services.py
│   ├── import_tools.py
│   └── import_persona_priority.py
├── services/
│   └── marketplace.service.ts
├── routes/
│   ├── personas.routes.ts
│   ├── marketplace.routes.ts
│   └── services.routes.ts
└── types/
    └── persona.types.ts

transcend-frontend/src/
├── components/
│   ├── LeftMenu/
│   │   └── DynamicLeftMenu.tsx
│   ├── Marketplace/
│   │   ├── ServiceMarketplace.tsx
│   │   └── ServiceCard.tsx
│   ├── Directory/
│   │   └── ServiceDirectory.tsx
│   └── PersonaSwitcher/
│       └── PersonaSwitcher.tsx
├── pages/
│   └── Marketplace.tsx
└── hooks/
    ├── usePersona.ts
    ├── useMarketplace.ts
    └── useProfessionalMenu.ts
```

---

## Next Steps

1. **Create SQL migration files** using the schema above
2. **Write Python import scripts** to process CSVs
3. **Run imports** and validate data
4. **Build backend APIs** to query the data
5. **Build frontend components** using the APIs
6. **Deploy** and test with real personas

This architecture ensures:
- ✅ One persona sees different marketplace priorities
- ✅ Different left-menu tools per persona
- ✅ Scalable to new personas/services
- ✅ No code changes needed when adding new data
- ✅ Database-driven UI rendering

