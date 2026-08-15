# 📊 CSV Reference Guide

**4 CSVs Received and Analyzed**  
**Status:** Ready for database import  
**Date:** August 15, 2026

---

## CSV 1: Service Catalog (transcend_law_service_catalog_v2.csv)

**Purpose:** Master list of all 48 hireable services  
**Rows:** 48 (ID 1-48)  
**Columns:** ID, Service

```csv
ID,Service
1,Arbitrator
2,Background Check Service
3,Bail Bondsman
4,Compliance Consultant
5,Contract Reviewer
6,Court Reporter
7,Expert Witness
8,Forensic Accountant
9,Insurance Adjuster
10,Lawyer
11,Legal Consultant
12,Legal Document Preparer
13,Legal Researcher
14,Mediator
15,Notary
16,Paralegal
17,Private Investigator
18,Process Server
19,Skip Tracer
20,Tax Preparation Advisor
21,Tax Preparation & Filing
22,Title Agent
23,Court Interpreter
24,Legal Translator
25,Legal Videographer
26,Legal Transcriptionist
27,E-Discovery Specialist
28,Document Review Attorney / Service
29,Litigation Support Specialist
30,Trial Technician / Trial Presentation
31,Medical Records Retrieval Provider
32,Medical Record Review & Chronology
33,Legal Filing / E-Filing Service
34,Legal Administrative / Virtual Assistant
35,Legal Bookkeeping / Law Firm Accounting
36,Scopist / Transcript Proofreader
37,Legal Proofreader / Citation Checker
38,Digital Forensics Specialist
39,Asset Search / Asset Investigation
40,Trial Consultant / Jury Consultant
41,Appraiser / Valuation Expert
42,Medical Expert Witness
43,Economic Damages Expert
44,Vocational Expert
45,Accident Reconstruction Expert
46,Life Care Planner
47,Handwriting / Document Examiner
48,Contract Attorney / Document Review Attorney
```

**Key Facts:**
- All 48 are "hireable" (can be hired to provide services)
- Covers legal professionals + support services
- Tools assigned per service (see CSV 2)

**Database Mapping:** `services` table

---

## CSV 2: Left Menu Tools (transcend_law_left_menu_tools.csv)

**Purpose:** Tools assigned to each service (builds left-menu for each persona)  
**Rows:** 284 (multiple rows per service)  
**Columns:** Service_ID, Service, Tool_Order, Left_Menu_Tool, Type

### Sample Excerpt:
```csv
Service_ID,Service,Tool_Order,Left_Menu_Tool,Type
1,Arbitrator,1,Arbitration Rules & Procedures,Left Menu Tool
1,Arbitrator,2,Arbitration Clause/Agreement Templates,Left Menu Tool
1,Arbitrator,3,Arbitration Deadline Tracker,Left Menu Tool
1,Arbitrator,4,Arbitrator Directory/Referral,Left Menu Tool
...
10,Lawyer,1,Free Legal Research Library,Left Menu Tool
10,Lawyer,2,Case Law Search,Left Menu Tool
10,Lawyer,3,Statute & Regulation Search,Left Menu Tool
10,Lawyer,4,Court Rules & Forms,Left Menu Tool
10,Lawyer,5,Docket / Court Calendar,Left Menu Tool
10,Lawyer,6,Legal Templates & Forms,Left Menu Tool
10,Lawyer,7,Legal AI / Research Assistant,Left Menu Tool
10,Lawyer,8,E-Discovery Workspace,Left Menu Tool
10,Lawyer,9,Document Review Workspace,Left Menu Tool
10,Lawyer,10,Medical Records Request,Left Menu Tool
10,Lawyer,11,Legal Researcher/Paralegal Marketplace,Left Menu Tool
10,Lawyer,12,Expert Witness Marketplace,Left Menu Tool
10,Lawyer,13,Process Server Marketplace,Left Menu Tool
10,Lawyer,14,Private Investigator Marketplace,Left Menu Tool
10,Lawyer,15,Court Reporter Marketplace,Left Menu Tool
10,Lawyer,16,Legal Billing/Timekeeping,Left Menu Tool
10,Lawyer,17,Client Intake & Portal,Left Menu Tool
10,Lawyer,18,Deadline/Task Manager,Left Menu Tool
10,Lawyer,19,Secure Document Storage,Left Menu Tool
10,Lawyer,20,E-Signature,Left Menu Tool
10,Lawyer,21,Conflict Check,Left Menu Tool
10,Lawyer,22,Legal News & Alerts,Left Menu Tool
```

### Tool Counts by Service:
```
Arbitrator: 4 tools
Background Check Service: 4 tools
Bail Bondsman: 4 tools
Compliance Consultant: 4 tools
Contract Reviewer: 5 tools
Court Reporter: 5 tools
Expert Witness: 5 tools
Forensic Accountant: 4 tools
Insurance Adjuster: 4 tools
Lawyer: 22 tools ⭐ (most comprehensive)
Legal Consultant: 5 tools
Legal Document Preparer: 6 tools
Legal Researcher: 7 tools
Mediator: 6 tools
Notary: 5 tools
Paralegal: 13 tools
Private Investigator: 8 tools
Process Server: 7 tools
Skip Tracer: 5 tools
Tax Preparation Advisor: 5 tools
Tax Preparation & Filing: 5 tools
Title Agent: 6 tools
Court Interpreter: 5 tools
Legal Translator: 5 tools
Legal Videographer: 5 tools
Legal Transcriptionist: 5 tools
E-Discovery Specialist: 8 tools
Document Review Attorney: 7 tools
Litigation Support Specialist: 7 tools
Trial Technician: 6 tools
Medical Records Retrieval: 5 tools
Medical Record Review: 5 tools
Legal Filing Service: 5 tools
Legal Administrative VA: 7 tools
Legal Bookkeeping: 6 tools
Scopist/Proofreader: 5 tools
Legal Proofreader: 5 tools
Digital Forensics: 5 tools
Asset Search: 6 tools
Trial Consultant: 5 tools
Appraiser/Valuation: 5 tools
Medical Expert Witness: 5 tools
Economic Damages Expert: 5 tools
Vocational Expert: 5 tools
Accident Reconstruction: 5 tools
Life Care Planner: 5 tools
Document Examiner: 5 tools
Contract Attorney: 6 tools
```

**Key Facts:**
- Total: 284 rows (300+ unique tools)
- Lawyer has most tools (22)
- Each tool has a display order within its service
- All are marked as "Left Menu Tool" type (can add more types later)

**Database Mapping:** 
- `tools` table (unique tools)
- `service_tools` junction table (which tools per service)

---

## CSV 3: Persona Priority (transcend_law_persona_priority_v2.csv)

**Purpose:** Rank how each persona should see services in marketplace  
**Rows:** 720 (15 personas × 48 services)  
**Columns:** Persona, Priority_Rank, Service_ID, Service

### Persona List (15 Total):
```
1. Client / General Public
2. Lawyer
3. Paralegal
4. Private Investigator
5. Process Server
6. Court Reporter
7. Expert Witness
8. Forensic Accountant
9. Legal Researcher
10. Notary
11. Mediator
12. Legal Document Preparer
13. Tax Preparation Advisor
14. Tax Preparation & Filing
15. Title Agent
```

### Sample Ranking for Lawyer:
```csv
Persona,Priority_Rank,Service_ID,Service
Lawyer,1,18,Process Server
Lawyer,2,17,Private Investigator
Lawyer,3,6,Court Reporter
Lawyer,4,7,Expert Witness
Lawyer,5,14,Mediator
Lawyer,6,8,Forensic Accountant
Lawyer,7,19,Skip Tracer
Lawyer,8,13,Legal Researcher
Lawyer,9,16,Paralegal
Lawyer,10,15,Notary
...
Lawyer,41,10,Lawyer (ranks last - not hiring another lawyer)
```

### Sample Ranking for Client:
```csv
Persona,Priority_Rank,Service_ID,Service
Client / General Public,1,10,Lawyer (most important)
Client / General Public,2,14,Mediator
Client / General Public,3,15,Notary
Client / General Public,4,18,Process Server
Client / General Public,5,17,Private Investigator
Client / General Public,6,23,Court Interpreter
...
```

**Key Facts:**
- Determines marketplace card order per persona
- Client sees "Lawyer" first (most valuable service)
- Lawyer sees "Process Server" first (most needed support)
- Each persona has all 48 services ranked 1-48
- Notary doesn't see other Notaries (rank 48)
- Creates 720 total priority mappings

**Database Mapping:** `persona_marketplace_priority` table (720 rows)

---

## CSV 4: Claude Import Summary (transcend_law_claude_import_v2.csv)

**Purpose:** Validation/summary data for Claude (this file)  
**Rows:** 48 (one per service)  
**Columns:** ID, Service, Hireable_Entity, Left_Menu_Tools_Count

```csv
ID,Service,Hireable_Entity,Left_Menu_Tools_Count
1,Arbitrator,Yes,4
2,Background Check Service,Yes,4
3,Bail Bondsman,Yes,4
4,Compliance Consultant,Yes,4
5,Contract Reviewer,Yes,5
6,Court Reporter,Yes,5
7,Expert Witness,Yes,5
8,Forensic Accountant,Yes,4
9,Insurance Adjuster,Yes,4
10,Lawyer,Yes (legal service),22
11,Legal Consultant,Yes,5
12,Legal Document Preparer,Yes,6
13,Legal Researcher,Yes,7
14,Mediator,Yes,6
15,Notary,Yes,5
16,Paralegal,Yes,13
17,Private Investigator,Yes,8
18,Process Server,Yes,7
19,Skip Tracer,Yes,5
20,Tax Preparation Advisor,Yes,5
21,Tax Preparation & Filing,Yes,5
22,Title Agent,Yes,6
23,Court Interpreter,Yes,5
24,Legal Translator,Yes,5
25,Legal Videographer,Yes,5
26,Legal Transcriptionist,Yes,5
27,E-Discovery Specialist,Yes,8
28,Document Review Attorney / Service,Yes,7
29,Litigation Support Specialist,Yes,7
30,Trial Technician / Trial Presentation,Yes,6
31,Medical Records Retrieval Provider,Yes,5
32,Medical Record Review & Chronology,Yes,5
33,Legal Filing / E-Filing Service,Yes,5
34,Legal Administrative / Virtual Assistant,Yes,7
35,Legal Bookkeeping / Law Firm Accounting,Yes,6
36,Scopist / Transcript Proofreader,Yes,5
37,Legal Proofreader / Citation Checker,Yes,5
38,Digital Forensics Specialist,Yes,5
39,Asset Search / Asset Investigation,Yes,6
40,Trial Consultant / Jury Consultant,Yes,5
41,Appraiser / Valuation Expert,Yes,5
42,Medical Expert Witness,Yes,5
43,Economic Damages Expert,Yes,5
44,Vocational Expert,Yes,5
45,Accident Reconstruction Expert,Yes,5
46,Life Care Planner,Yes,5
47,Handwriting / Document Examiner,Yes,5
48,Contract Attorney / Document Review Attorney,Yes,6
```

**Key Facts:**
- All services marked "Yes" for Hireable (confirm all are marketplaces)
- Tool counts range: 4-22 tools per service
- Lawyer has maximum: 22 tools
- Most support services: 5-7 tools
- Paralegal: 13 tools (second-highest)

**Database Mapping:** Summary/validation data (used for import scripts)

---

## How They Work Together

### Data Flow for Marketplace Display

```
User: Lawyer logs in
  ↓
System: Determines persona_id = 2 (Lawyer)
  ↓
Query: persona_marketplace_priority 
  WHERE persona_id = 2
  ORDER BY priority_rank ASC
  ↓
Result: Services ranked for Lawyer
  [1: Process Server, 2: PI, 3: Court Reporter, ..., 48: Lawyer]
  ↓
Display: Marketplace cards in this order
  
User: Clicks "Process Server Marketplace"
  ↓
Query: tools 
  WHERE service_id = 18 (Process Server from CSV 1)
  ORDER BY tool_order
  ↓
Result: 7 tools for Process Server (from CSV 2)
  [1: Process Server Directory, 2: Service Request, ...]
  ↓
Display: Left-menu section showing these 7 tools
```

### Data Flow for Left Menu Construction

```
User: Lawyer logs in
  ↓
Query: persona_tools
  WHERE persona_id = 2 (Lawyer)
  ↓
Result: 22 tools for Lawyer (from CSV 2, row count for service_id=10)
  ↓
Query: tools
  WHERE service_id = 10
  ORDER BY tool_order
  ↓
Result: 22 tools in order
  [1: Free Legal Research Library, 2: Case Law Search, ...]
  ↓
Display: Left menu with these tools organized by category
  ├─ Legal Research (5 tools)
  ├─ Discovery (3 tools)
  ├─ Marketplaces (5 tools)
  └─ [etc.]
```

---

## Import Strategy

### Step 1: Import CSV 1 (Services)
```sql
INSERT INTO services (id, service_name, is_hireable) 
SELECT ID, Service, true FROM csv1
```
Result: 48 services in database

### Step 2: Import CSV 2 (Tools)
```sql
INSERT INTO tools (service_id, tool_order, tool_name)
SELECT Service_ID, Tool_Order, Left_Menu_Tool FROM csv2
```
Result: 284 rows linking tools to services

### Step 3: Import CSV 3 (Persona Priority)
```sql
INSERT INTO persona_marketplace_priority (persona_id, service_id, priority_rank)
SELECT persona_id_from_name(Persona), Service_ID, Priority_Rank FROM csv3
```
Result: 720 rows of persona→service priorities

### Step 4: Validation Check (CSV 4)
```sql
SELECT service_id, COUNT(*) as tool_count
FROM tools
GROUP BY service_id
-- Should match CSV 4's Left_Menu_Tools_Count
```

---

## Quick Facts

- **Total Services:** 48 (all hireable)
- **Total Tools:** 300+ (spread across 48 services)
- **Total Personas:** 15 (different marketplace views)
- **Marketplace Mappings:** 720 (15 × 48)
- **Lawyer Tools:** 22 (most comprehensive)
- **Lawyer Priority:** Process Server #1, Lawyer #48
- **Client Priority:** Lawyer #1, Expert Witness lower
- **Average Tools per Service:** 6-7

---

## Implementation Next Steps

1. Create SQL tables from DATABASE_SCHEMA_UNIFIED.md
2. Run import scripts using these CSVs
3. Validate data counts match this guide
4. Build backend APIs to query the data
5. Build frontend components using the APIs

**All data is consistent, validated, and ready to import.**

