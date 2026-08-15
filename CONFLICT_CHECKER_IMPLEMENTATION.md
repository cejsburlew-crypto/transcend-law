# Conflict of Interest Checker - Implementation Guide

## Overview

The Conflict of Interest Checker is a comprehensive system designed to prevent attorney-client matches that would create professional conflicts. It automatically checks attorneys against opposing counsel lists, prior representations, family connections, and disqualifying relationships before allowing engagement.

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Conflict Checker System                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐        ┌──────────────────┐           │
│  │  Frontend UI     │        │   Backend API    │           │
│  │  ConflictWarning │◄──────►│ conflictRoutes   │           │
│  └──────────────────┘        └──────────────────┘           │
│                                      ▲                        │
│                                      │                        │
│                              ┌───────┴────────┐              │
│                              │  Service Layer │              │
│                              │ ConflictChecker│              │
│                              └───────┬────────┘              │
│                                      │                        │
│          ┌───────────────────────────┼───────────────────┐   │
│          │                           │                   │   │
│  ┌───────▼────────┐  ┌──────────────▼──┐  ┌───────────▼─┐  │
│  │  Database      │  │  Audit Logging   │  │  Functions  │  │
│  │  - Conflicts   │  │  - All checks    │  │  - Check    │  │
│  │  - Appeals     │  │  - Overrides     │  │  - Record   │  │
│  │  - Audit Trail │  │  - Appeals       │  │  - Appeal   │  │
│  └────────────────┘  └──────────────────┘  └─────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### Tables

#### 1. `opposing_counsel`
Records attorneys who previously opposed each other in cases.

```sql
- id (UUID, PRIMARY KEY)
- attorney_id (UUID, FK to users)
- opposing_attorney_id (UUID, FK to users)
- case_id (VARCHAR)
- case_name (VARCHAR)
- matter_type (VARCHAR) - civil, criminal, family, bankruptcy
- court_jurisdiction (VARCHAR)
- case_number (VARCHAR)
- start_date (DATE)
- end_date (DATE, nullable)
- status (VARCHAR) - active, closed, settled, dismissed
- notes (TEXT)
```

**Index**: `idx_opposing_counsel_attorney`, `idx_opposing_counsel_opposing`, `idx_opposing_counsel_status`

#### 2. `prior_representations`
Tracks client representations to detect ongoing confidentiality concerns.

```sql
- id (UUID, PRIMARY KEY)
- attorney_id (UUID, FK to users)
- client_id (UUID, FK to users, nullable)
- client_name (VARCHAR)
- case_type (VARCHAR)
- case_description (TEXT)
- case_outcome (VARCHAR) - won, lost, settled, dismissed
- representation_start (DATE)
- representation_end (DATE, nullable)
- conflict_potential (BOOLEAN)
```

**Index**: `idx_prior_representations_attorney`, `idx_prior_representations_conflict`

#### 3. `family_connections`
Records family relationships that could create conflicts.

```sql
- id (UUID, PRIMARY KEY)
- attorney_id (UUID, FK to users)
- related_person_id (UUID, FK to users, nullable)
- related_person_name (VARCHAR)
- relationship_type (VARCHAR)
  - spouse, parent, child, sibling, parent-in-law, business-partner
- relationship_status (VARCHAR) - current, former, estranged
- potential_conflict (BOOLEAN)
- verified_at (TIMESTAMP)
- verified_by (UUID, FK to users)
```

**Index**: `idx_family_connections_attorney`, `idx_family_connections_conflict`

#### 4. `disqualifying_relationships`
Core table for permanent disqualifications.

```sql
- id (UUID, PRIMARY KEY)
- attorney_id (UUID, FK to users)
- disqualified_from_id (UUID, FK to users, nullable)
- disqualified_from_name (VARCHAR)
- relationship_type (VARCHAR)
  - former-client, adverse-party, opposing-counsel, 
    business-associate, witness
- reason_code (VARCHAR)
  - attorney-client, adverse-representation, material-witness, 
    financial-interest
- description (TEXT)
- severity (VARCHAR) - standard, elevated, critical
- expiration_date (DATE, nullable) - Null = indefinite
- status (VARCHAR) - active, inactive, appealed, expired
```

**Index**: `idx_disqualifying_relationships_attorney`, `idx_disqualifying_relationships_status`

#### 5. `conflict_checks`
Audit trail of all conflict checks performed.

```sql
- id (UUID, PRIMARY KEY)
- attorney_id (UUID, FK to users)
- client_id (UUID, FK to users, nullable)
- check_type (VARCHAR)
  - opposing-counsel, prior-representation, family, 
    disqualifying, attorney-client-match
- conflict_found (BOOLEAN)
- conflict_severity (VARCHAR)
  - none, low, medium, high, critical
- conflicts_identified (JSONB)
  - Array of ConflictDetail objects
- check_status (VARCHAR)
  - completed, under-review, appealed, resolved
- requested_by (UUID, FK to users)
- checked_at (TIMESTAMP)
- notes (TEXT)
```

**Index**: `idx_conflict_checks_attorney`, `idx_conflict_checks_conflict_found`, `idx_conflict_checks_checked_at`

#### 6. `conflict_matches`
Blocks or flags specific attorney-client pairings.

```sql
- id (UUID, PRIMARY KEY)
- attorney_id (UUID, FK to users)
- client_id (UUID, FK to users)
- conflict_check_id (UUID, FK to conflict_checks)
- match_type (VARCHAR)
  - blocked (automatic enforcement), 
    flagged-for-review (needs compliance review),
    pending-appeal (appeal in progress)
- conflict_details (JSONB)
- block_reason (TEXT)
- blocked_at (TIMESTAMP)
- blocks_until (DATE, nullable)
- metadata (JSONB)
- UNIQUE(attorney_id, client_id)
```

**Index**: `idx_conflict_matches_attorney`, `idx_conflict_matches_type`

#### 7. `conflict_appeals`
Appeal process for blocked matches.

```sql
- id (UUID, PRIMARY KEY)
- conflict_match_id (UUID, FK to conflict_matches)
- attorney_id (UUID, FK to users)
- appeal_status (VARCHAR)
  - pending, under-review, approved, denied, withdrawn
- appeal_reason (TEXT)
- supporting_documents (JSONB) - Array of document URLs
- submitted_by (UUID, FK to users)
- submitted_at (TIMESTAMP)
- reviewed_by (UUID, FK to users, nullable)
- reviewed_at (TIMESTAMP, nullable)
- review_notes (TEXT)
- decision (VARCHAR) - approved, denied
- decision_rationale (TEXT)
```

**Index**: `idx_conflict_appeals_status`, `idx_conflict_appeals_submitted`

#### 8. `conflict_database_updates`
Track bulk imports and data maintenance.

```sql
- id (UUID, PRIMARY KEY)
- update_type (VARCHAR) - import, sync, manual-entry, bulk-upload
- source (VARCHAR)
- record_count (INTEGER)
- records_added (INTEGER)
- records_updated (INTEGER)
- records_deleted (INTEGER)
- errors (JSONB)
- updated_by (UUID, FK to users)
- completed_at (TIMESTAMP)
```

## Service API

### `ConflictCheckerService`

#### Core Methods

##### `checkAttorneyClientMatch(attorneyId, clientId, requestedBy?)`

Performs comprehensive conflict check.

**Parameters**:
- `attorneyId`: UUID of attorney
- `clientId`: UUID of client
- `requestedBy`: UUID of user requesting check (optional)

**Returns**: `ConflictCheckResult`
```typescript
{
  conflictFound: boolean;
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  conflicts: ConflictDetail[];
  recommendedAction: 'allow' | 'review' | 'block';
  blockedUntil?: Date;
}
```

**Flow**:
1. Runs 4 parallel checks:
   - Opposing counsel
   - Prior representations
   - Family connections
   - Disqualifying relationships
2. Aggregates severity levels (higher severity wins)
3. Records check in `conflict_checks` table
4. Creates match in `conflict_matches` if conflict found
5. Logs audit trail

**Example**:
```typescript
const result = await ConflictCheckerService.checkAttorneyClientMatch(
  'attorney-uuid',
  'client-uuid',
  'user-uuid'
);

if (result.conflictFound) {
  if (result.severity === 'critical') {
    // Block immediately
    return res.status(409).json({ blocked: true, conflicts: result.conflicts });
  } else {
    // Flag for review
    return res.status(202).json({ flagged: true, conflicts: result.conflicts });
  }
}
```

##### `isMatchBlocked(attorneyId, clientId)`

Quick check if specific match is blocked.

**Returns**: `boolean`

##### `getConflictDetails(attorneyId, clientId)`

Retrieves full conflict information for a match.

**Returns**: `ConflictMatch | null`

##### `submitConflictAppeal(...)`

Submits appeal for blocked match.

**Parameters**:
- `conflictMatchId`: UUID
- `attorneyId`: UUID
- `appealReason`: string
- `supportingDocuments`: string[] (URLs)
- `submittedBy`: UUID

**Returns**: `string` (appeal ID)

**Process**:
1. Creates appeal record with `status: 'pending'`
2. Updates conflict match to `match_type: 'pending-appeal'`
3. Triggers notification to compliance team
4. Awaits review

##### `reviewConflictAppeal(appealId, decision, rationale, reviewedBy)`

Reviews and decides on appeal.

**Parameters**:
- `appealId`: UUID
- `decision`: 'approved' | 'denied'
- `rationale`: string
- `reviewedBy`: UUID

**Process**:
1. Updates appeal with decision
2. If approved, removes block from match
3. Logs audit trail for compliance

##### `getPendingAppeals()`

Gets all appeals awaiting review.

**Returns**: `ConflictAppeal[]`

#### Data Management Methods

##### `addOpposingCounsel(opposing)`

Records opposing counsel relationship.

##### `addFamilyConnection(connection)`

Records family member relationship.

##### `addDisqualifyingRelationship(relationship)`

Records permanent disqualification.

##### `getConflictSummary(attorneyId)`

Gets summary of all conflicts for attorney.

**Returns**:
```typescript
{
  totalConflicts: number;
  activeConflicts: number;
  criticalConflicts: number;
  blockedMatches: number;
  pendingAppeals: number;
  lastCheck?: Date;
}
```

## API Endpoints

### Conflict Checks

#### `POST /api/conflicts/perform-check`
Performs full conflict check.

**Request**:
```json
{
  "attorneyId": "uuid",
  "clientId": "uuid"
}
```

**Response**: `ConflictCheckResult`

#### `GET /api/conflicts/check/:attorneyId/:clientId`
Gets existing conflict details.

#### `GET /api/conflicts/is-blocked/:attorneyId/:clientId`
Quick block status check.

#### `GET /api/conflicts/summary/:attorneyId`
Gets conflict summary for attorney.

### Data Management

#### `POST /api/conflicts/opposing-counsel` (Admin/Compliance)
Adds opposing counsel record.

#### `POST /api/conflicts/family-connection` (Admin/Compliance)
Adds family connection.

#### `POST /api/conflicts/disqualifying-relationship` (Admin/Compliance)
Adds disqualifying relationship.

### Appeals

#### `POST /api/conflicts/appeal/:conflictMatchId`
Submits appeal for blocked match.

**Request**:
```json
{
  "reason": "Appeal reason text",
  "documents": ["url1", "url2"],
  "additionalInfo": "Extra context"
}
```

#### `GET /api/conflicts/appeals/pending` (Admin/Compliance)
Lists pending appeals.

#### `POST /api/conflicts/appeals/:appealId/review` (Admin/Compliance)
Reviews appeal.

**Request**:
```json
{
  "decision": "approved|denied",
  "rationale": "Decision rationale"
}
```

### Admin

#### `POST /api/conflicts/:conflictMatchId/override` (Admin)
Overrides conflict block (logged for audit).

#### `GET /api/conflicts/matches` (Admin/Compliance)
Lists all conflict matches.

#### `GET /api/conflicts/export` (Admin/Compliance)
Exports conflict report.

**Query Parameters**:
- `format`: json, csv, pdf (default: json)
- `startDate`: ISO date
- `endDate`: ISO date

## Frontend Component

### `ConflictWarning` Component

React component for displaying conflicts and managing appeals.

#### Props

```typescript
interface ConflictWarningProps {
  attorneyId?: string;          // UUID of attorney
  clientId?: string;            // UUID of client
  onConflictDetected?: (conflict: ConflictMatch) => void;
  onConflictResolved?: () => void;
  compact?: boolean;            // Show compact version
  isAdmin?: boolean;            // Show admin controls
}
```

#### Features

1. **Auto-Detection**: Checks on component mount
2. **Severity Display**: Color-coded severity levels
3. **Details Expansion**: Expandable conflict details
4. **Appeal Form**: Built-in appeal submission
5. **File Upload**: Support for supporting documents
6. **Admin Override**: Admin-only controls
7. **Responsive**: Mobile-friendly design
8. **Dark Mode**: Full dark mode support

#### Usage

```tsx
import ConflictWarning from './ConflictWarning';

export function AttorneySelection() {
  const handleConflictDetected = (conflict) => {
    console.log('Conflict detected:', conflict);
    // Show warning, disable selection, etc.
  };

  return (
    <ConflictWarning
      attorneyId={selectedAttorneyId}
      clientId={clientId}
      onConflictDetected={handleConflictDetected}
    />
  );
}
```

#### CSS Classes

- `.conflict-warning`: Main container
- `.severity-critical`: Critical conflict styling
- `.severity-high`: High severity
- `.severity-medium`: Medium severity
- `.severity-low`: Low severity
- `.conflict-clear`: No conflict found

## Integration Points

### 1. Attorney-Client Matching

Check conflicts before displaying match:

```typescript
// In attorney selection flow
const result = await ConflictCheckerService.checkAttorneyClientMatch(
  attorneyId,
  clientId
);

if (result.conflictFound && result.severity === 'critical') {
  return { allowed: false, reason: 'Conflict detected' };
}

// Proceed with match
```

### 2. Intake Form

Display warning on form:

```tsx
<ConflictWarning
  attorneyId={selectedAttorneyId}
  clientId={currentUser.id}
/>
```

### 3. Dashboard

Show conflict summary:

```typescript
const summary = await ConflictCheckerService.getConflictSummary(attorneyId);
if (summary.activeConflicts > 0) {
  displayAlert(`You have ${summary.activeConflicts} active conflicts`);
}
```

### 4. Admin Dashboard

List pending appeals:

```typescript
const appeals = await ConflictCheckerService.getPendingAppeals();
displayAppealQueue(appeals);
```

## Data Import & Maintenance

### Bulk Import

Load opposing counsel from bar database:

```typescript
const opposingCounsels = await fetchFromBarDatabase();
for (const record of opposingCounsels) {
  await ConflictCheckerService.addOpposingCounsel(record);
}
```

### Database View: `vw_active_conflicts`

Get all active conflicts by attorney:

```sql
SELECT * FROM vw_active_conflicts WHERE attorney_id = $1;
```

### Database View: `vw_blocked_matches`

Get all blocked attorney-client matches:

```sql
SELECT * FROM vw_blocked_matches ORDER BY blocked_at DESC;
```

### Database View: `vw_pending_appeals`

Get appeals awaiting decision:

```sql
SELECT * FROM vw_pending_appeals;
```

## Severity Levels

### Determination Logic

```
Opposing Counsel:      HIGH (3)
Prior Representation:  MEDIUM (2)
Family Connection:     MEDIUM (2)
Disqualifying:         CRITICAL (4)

Recommendation:
- CRITICAL (4)  → Block immediately
- HIGH (3)      → Flag for review
- MEDIUM (2)    → Flag for review
- LOW (1)       → Allow with notation
- NONE (0)      → Allow
```

## Audit & Compliance

All conflict checks are logged with:
- Timestamp
- Requesting user
- Attorney ID
- Client ID
- Conflicts found
- Severity level
- Action taken

Access audit trail:
```sql
SELECT * FROM conflict_checks 
WHERE attorney_id = $1 
ORDER BY checked_at DESC;
```

## Migration Script

Install schema:

```bash
psql -h $DB_HOST -U $DB_USER $DB_NAME -f transcend-api/database/schema-conflict-checker.sql
```

## Testing

### Test Cases

1. **No Conflicts**: Attorney-client pair with no history
2. **Opposing Counsel**: Active opposition in recent case
3. **Prior Representation**: Former client with ongoing confidentiality
4. **Family Connection**: Spouse relationship
5. **Disqualifying Relationship**: Permanent disqualification
6. **Multi-Conflict**: Multiple conflicts detected
7. **Appeal Approval**: Appeal process succeeds
8. **Appeal Denial**: Appeal process fails

### Example Test

```typescript
test('Block match with critical conflict', async () => {
  // Setup
  const attorneyId = 'attorney-uuid';
  const clientId = 'client-uuid';
  
  // Create disqualifying relationship
  await ConflictCheckerService.addDisqualifyingRelationship({
    attorneyId,
    disqualifiedFromId: clientId,
    relationshipType: 'former-client',
    reasonCode: 'attorney-client',
    description: 'Former client in related matter',
    severity: 'critical',
  });

  // Check
  const result = await ConflictCheckerService.checkAttorneyClientMatch(
    attorneyId,
    clientId
  );

  // Assert
  expect(result.conflictFound).toBe(true);
  expect(result.severity).toBe('critical');
  expect(result.recommendedAction).toBe('block');
});
```

## Performance Considerations

1. **Parallel Checks**: 4 checks run in parallel to minimize latency
2. **Indexing**: Strategic indexes on attorney_id, status, and dates
3. **Caching**: Consider caching recent checks (5-minute TTL)
4. **Database**: Use connection pooling for high volume

## Security

1. **Authentication**: All endpoints require authentication
2. **Authorization**: Role-based access control (admin, compliance)
3. **Audit Logging**: All checks and overrides logged
4. **Data Protection**: Sensitive data encrypted at rest
5. **HIPAA Compliance**: Audit trail retention per legal requirements

## Future Enhancements

1. **ML-Based Detection**: Detect conflicts from case descriptions
2. **Real-Time Sync**: Integrate with bar association databases
3. **Conflict Waiver**: Formalized waiver process
4. **Advanced Analytics**: Conflict patterns and trends
5. **API Integrations**: Connect to external conflict databases
6. **Blockchain Audit**: Immutable audit trail for compliance

## Support & Troubleshooting

### Common Issues

**Q: Check is running slowly**
A: Verify indexes are created and database is optimized.

**Q: Appeals stuck in pending**
A: Check compliance team notifications, verify reviewer has access.

**Q: Conflicts not appearing**
A: Verify data was imported, check attorney_id references.

### Contact

For issues or questions, contact: compliance@transcend-law.com
