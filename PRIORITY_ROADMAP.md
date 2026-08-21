# Transcend Law - Complete Priority Roadmap

## TIER 1: MVP Case Management (IN PROGRESS)

### Phase 1: Tasks & Notes ✅ 90% COMPLETE
- [x] TasksTab, TaskCard, CreateTaskModal, TaskEditModal components
- [x] NotesTab, NoteCard, CreateNoteModal, EditNoteModal components  
- [x] API methods for all CRUD operations
- [x] UI integration into CaseDetails tabs
- [ ] **FIX: JWT authentication 403 errors** (BLOCKER - 1 session)
- [ ] End-to-end testing (create, edit, delete tasks/notes)

### Phase 2: Appointments (2-3 sessions)
- [ ] Add case_id FK to appointments table (database)
- [ ] appointmentsRoutes.ts with case-scoped endpoints
- [ ] AppointmentsTab component with calendar/timeline view
- [ ] Link appointments to cases on creation
- [ ] Frontend API methods for CRUD
- [ ] Appointment modal forms

### Phase 3: Workflow Stages / Case Status (2-3 sessions)
- [ ] Create workflow_states table in database
- [ ] Define state transitions (open → in_progress → awaiting_client → resolved → closed)
- [ ] WorkflowTab component for status management
- [ ] Add status indicators throughout UI
- [ ] Status history/audit log

### Phase 4: Time Tracking / Billable Hours (2-3 sessions)
- [ ] Create time_entries table
- [ ] Timer component for case work
- [ ] Bulk entry form for past time
- [ ] Time reports by attorney/case/period
- [ ] Integration with billing export

---

## TIER 2: Client Portal & Communication (4-6 sessions)

### Phase 5: Client Portal
- [ ] Read-only case view for clients
- [ ] Document access control (public/confidential)
- [ ] Communication thread visibility (messages only, not internal notes)
- [ ] Payment portal (LawPay integration)
- [ ] Client dashboard

### Phase 6: Advanced Messaging
- [ ] Email integration (IMAP/SMTP)
- [ ] SMS notifications (Twilio)
- [ ] Push notifications
- [ ] Real-time WebSocket sync

---

## TIER 3: Integration & Automation (6-10 sessions)

### Phase 7: Connector Framework
- [ ] Complete BaseConnector pattern implementation
- [ ] Clio connector (syncs contacts → cases, documents, tasks)
- [ ] MyCase connector
- [ ] Smokeball connector
- [ ] HubSpot CRM connector

### Phase 8: Advanced Features
- [ ] AI document summarization (Filevine API)
- [ ] Automated task creation from documents
- [ ] Smart case routing
- [ ] Conflict of interest checking

---

## TIER 4: Mobile & Scale (4-8 sessions)

### Phase 9: React Native Mobile App
- [ ] App shell with native file access
- [ ] Offline-first sync
- [ ] Camera for document capture
- [ ] Push notification handling

### Phase 10: Performance & Operations
- [ ] Database indexing optimization
- [ ] Caching layer (Redis)
- [ ] Monitoring (Sentry, Prometheus)
- [ ] Load testing

---

## PRIORITY EXECUTION ORDER (RECOMMENDED)

### Session 1: **FIX TIER 1 PHASE 1 AUTH** (CRITICAL BLOCKER)
1. Debug JWT token issue in demo mode
2. Create test user in database OR fix token generation
3. Verify Tasks & Notes work end-to-end
4. Write integration tests

### Session 2-3: TIER 1 PHASE 2 (Appointments)
1. Database migration for case_id FK
2. Backend routes + services
3. Frontend components + API methods
4. Testing

### Session 4-5: TIER 1 PHASE 3 (Workflow Stages)
1. Database schema for workflow_states
2. State machine logic
3. Frontend status selector
4. Audit log

### Session 6-7: TIER 1 PHASE 4 (Time Tracking)
1. time_entries table
2. Timer component
3. Report generation
4. Billing export

### Session 8+: TIER 2 & BEYOND
Proceed based on business priorities

---

## KNOWN BLOCKERS & QUICK WINS

### 🔴 BLOCKERS (Fix immediately)
1. **JWT Auth**: Tasks/Notes API returning 403 (Session 1)
2. **Provider Skills Display**: User requirement from earlier (1 session)

### 🟢 QUICK WINS (High ROI, <1 session each)
1. Appointments calendar view (use existing appointments table)
2. Case status indicator (simple enum field)
3. Time summary card on dashboard

### 🟡 MEDIUM EFFORT (1-2 sessions)
1. Workflow state transitions
2. Time entry forms
3. Client portal basics

---

## SUCCESS METRICS BY TIER

**Tier 1 Complete When:**
- ✅ Tasks: Create → Edit → Complete → Delete (all working)
- ✅ Notes: Create → Edit → Delete (all working)
- ✅ Appointments: Calendar view showing case appointments
- ✅ Workflow: Status changes persist and show in case header
- ✅ Time: Timer running and logging hours

**Tier 2 Complete When:**
- ✅ Clients can view cases (read-only)
- ✅ Clients can download documents
- ✅ Email/SMS notifications working

**Tier 3 Complete When:**
- ✅ At least 1 connector syncing data bidirectionally
- ✅ Automated task creation from documents working

---

## RESOURCE ALLOCATION

- **Frontend**: React 18 + TypeScript (Haiku 4.5 efficient)
- **Backend**: Express.js + PostgreSQL (existing infrastructure)
- **Mobile**: Phase 9 (later)
- **Integrations**: Phase 7+ (defer unless client-critical)

---

## ESTIMATED COMPLETION

- **Tier 1 (MVP)**: 5-7 sessions (~1-2 weeks)
- **Tier 2 (Portal)**: 4-6 sessions (~1 week after Tier 1)
- **Tier 3 (Integrations)**: 6-10 sessions (~2-3 weeks after Tier 2)
- **Total MVP→Market**: 3-4 weeks from today

---

## NEXT IMMEDIATE ACTION

**Start Session 1: Fix JWT Auth Blocker**
1. Check backend's JWT verification logic
2. Either create test user OR fix demo token generation
3. Verify end-to-end: Create task → Save → Reload page → Task persists
4. Once auth works, start Phase 2 (Appointments)
