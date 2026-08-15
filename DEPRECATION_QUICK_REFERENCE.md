# Deprecation & Migration Management - Quick Reference

## Files Created

### Backend Services
1. **`/transcend-api/services/deprecationService.ts`** (1000+ lines)
   - Core deprecation management logic
   - Database initialization and queries
   - Feature lifecycle management
   - Migration tracking
   - Legacy API version support
   - Warning system
   - Auto-disable and removal functions

### Frontend Components
2. **`/transcend-frontend/src/components/DeprecationWarning.tsx`** (650+ lines)
   - `DeprecationBanner` - Dismissible warning banner
   - `MigrationGuideModal` - Interactive migration guide
   - `DeprecationTimeline` - Timeline visualization
   - `MigrationProgressBar` - Progress tracking UI
   - `DeprecationBadge` - Quick status indicator

### Styling
3. **`/transcend-frontend/src/components/DeprecationWarning.css`** (600+ lines)
   - Responsive design
   - Dark mode support
   - Accessibility features
   - Animations and interactions

### API Routes
4. **`/transcend-api/routes/deprecationRoutes.ts`** (450+ lines)
   - Feature deprecation endpoints
   - Migration tracking endpoints
   - Legacy API management
   - Warning acknowledgment
   - Reporting endpoints
   - Legacy API middleware

### Documentation
5. **`DEPRECATION_IMPLEMENTATION_GUIDE.md`** (comprehensive guide)
   - Step-by-step integration instructions
   - Code examples
   - Database schema reference
   - Best practices
   - Testing guidelines

---

## Quick Start (5 minutes)

### 1. Initialize Database

```typescript
import { initializeDeprecationTables } from './services/deprecationService';

await initializeDeprecationTables();
```

### 2. Announce Deprecation

```typescript
const deprecation = await announceFeatureDeprecation(
  'oldFeature',
  '/api/v1/old',
  'newFeature',
  '/api/v2/new',
  'Migrating to improved service',
  'high'
);
// Timeline: announced → disabled in 6 months → removed in 9 months
```

### 3. Display Warning in UI

```typescript
<DeprecationBanner
  featureId={deprecation.id}
  featureName="oldFeature"
  severity="high"
  message="This feature will be disabled in 6 months"
  replacementFeature="newFeature"
  daysUntilDisabled={180}
/>
```

### 4. Schedule Auto-Disable

```typescript
// Daily cron job
cron.schedule('0 2 * * *', async () => {
  const result = await autoDisableDeprecatedFeatures();
  console.log(`Disabled ${result.disabled} features`);
});
```

---

## Core Functions

### Feature Management
```typescript
announceFeatureDeprecation()        // Start deprecation process
updateDeprecationStatus()           // Update lifecycle status
getDeprecatedFeatures()             // List all deprecations
getUpcomingRemovals()               // Features removing soon
isFeatureDeprecated()               // Check deprecation status
isFeatureDisabled()                 // Check if disabled
getRedirectTarget()                 // Get new feature path
getMigrationGuide()                 // Get migration instructions
```

### Migration Tracking
```typescript
createMigrationRecord()             // Start user migration
updateMigrationProgress()           // Track progress
recordMigrationHistory()            // Audit trail + rollback
getUserMigrationProgress()          // Get user's progress
```

### Legacy API Support
```typescript
registerLegacyAPIVersion()          // Support old API version
getLegacyAPIVersion()               // Retrieve version info
transformLegacyRequest()            // Transform old → new
deactivateLegacyAPIVersion()        // End support
```

### Warnings
```typescript
issueDeprecationWarning()           // Send user warning
acknowledgeDeprecationWarning()     // User acknowledges
getUnacknowledgedWarnings()         // Get pending warnings
```

### Automation
```typescript
autoDisableDeprecatedFeatures()     // Scheduled disabling
autoRemoveEOLFeatures()             // Scheduled removal
```

### Reporting
```typescript
generateDeprecationReport()         // Comprehensive report
getDeprecationStats()               // Summary statistics
```

---

## Database Schema

### deprecated_features
```
id (UUID PK)
feature_name (VARCHAR UNIQUE)
feature_path (VARCHAR)
status (announced | active | disabled | removed)
severity (low | medium | high | critical)
announced_date (TIMESTAMP)
disabled_date (TIMESTAMP)
end_of_life_date (TIMESTAMP)
removal_date (TIMESTAMP)
replacement_feature (VARCHAR)
migration_guide_url (TEXT)
breaking_changes (TEXT[])
api_versions (TEXT[])
```

### migration_records
```
id (UUID PK)
user_id (UUID FK)
from_feature (VARCHAR)
to_feature (VARCHAR)
status (not_started | in_progress | completed | failed | skipped)
started_at (TIMESTAMP)
completed_at (TIMESTAMP)
migration_data (JSONB)
failure_reason (TEXT)
```

### legacy_api_versions
```
id (UUID PK)
version (VARCHAR UNIQUE)
deprecation_date (TIMESTAMP)
end_of_life_date (TIMESTAMP)
replacement_version (VARCHAR)
endpoint_mappings (JSONB)
transformation_rules (JSONB)
is_active (BOOLEAN)
```

### deprecation_warnings
```
id (UUID PK)
feature_id (UUID FK)
user_id (UUID FK)
issued_at (TIMESTAMP)
acknowledged_at (TIMESTAMP)
severity (low | medium | high | critical)
message (TEXT)
days_until_disabled (INT)
days_until_removed (INT)
```

### migration_history
```
id (UUID PK)
user_id (UUID FK)
feature_name (VARCHAR)
migration_type (VARCHAR)
old_data (JSONB)
new_data (JSONB)
migration_timestamp (TIMESTAMP)
success (BOOLEAN)
rollback_available (BOOLEAN)
rollback_data (JSONB)
```

---

## Timeline Overview

```
Month 0:        ANNOUNCE
                ↓ 6 months
Month 6:        DISABLE (feature stops working)
                ↓ 3 months
Month 9:        REMOVE (feature deleted from codebase)
```

**User Actions:**
- Month 0: Receive announcement & warning
- Month 0-5: Migrate to new feature
- Month 5: Final reminders
- Month 6: Feature stops working (error on access)
- Month 9: Feature completely removed

---

## API Endpoints

### Admin Endpoints
```
POST   /api/admin/deprecations
GET    /api/admin/deprecations
GET    /api/admin/deprecations/upcoming
PATCH  /api/admin/deprecations/:featureId
GET    /api/admin/deprecations/stats
POST   /api/admin/deprecations/auto-disable
POST   /api/admin/deprecations/auto-remove

POST   /api/admin/legacy-versions
GET    /api/admin/legacy-versions/:version
POST   /api/admin/legacy-versions/:version/deactivate

GET    /api/admin/deprecations/reports/overview
```

### User Endpoints
```
POST   /api/user/migrations
GET    /api/user/migrations
PATCH  /api/user/migrations/:migrationId
GET    /api/user/migrations/progress

GET    /api/user/warnings
POST   /api/user/warnings/:warningId/acknowledge
```

### Public Endpoints
```
GET    /api/public/deprecations/:featureName/guide
GET    /api/public/deprecations/:featureName/status
```

---

## Frontend Components

### DeprecationBanner
```tsx
<DeprecationBanner
  featureId="uuid"
  featureName="oldService"
  severity="high|medium|low|critical"
  message="Feature deprecation notice"
  replacementFeature="newService"
  replacementPath="/new-service"
  migrationGuideUrl="https://docs.example.com"
  daysUntilDisabled={180}
  daysUntilRemoved={270}
  breakingChanges={['Change 1', 'Change 2']}
  onAcknowledge={(warningId) => {}}
  persistent={true}
  autoHideDays={7}
/>
```

**Features:**
- Severity-based styling (critical = red, high = orange, etc.)
- Auto-dismiss after N days
- Manual dismiss options
- Breaking changes accordion
- Direct redirect to new feature
- Migration guide modal

### DeprecationTimeline
```tsx
<DeprecationTimeline
  announcedDate={new Date('2024-01-01')}
  disabledDate={new Date('2024-07-01')}
  endOfLifeDate={new Date('2024-10-01')}
  removalDate={new Date('2024-10-01')}
  currentStatus="active"
/>
```

**Shows:** Announcement → Active → Disabled → Removal timeline with countdown

### MigrationProgressBar
```tsx
<MigrationProgressBar
  totalFeatures={20}
  completedMigrations={15}
  inProgressMigrations={3}
  failedMigrations={1}
  estimatedCompletionDate={new Date('2024-09-01')}
/>
```

**Shows:** Overall migration progress across all features

### DeprecationBadge
```tsx
<DeprecationBadge
  featureName="oldService"
  daysUntilDisabled={45}
  severity="high"
/>
```

**Shows:** Small inline badge with severity color and pulsing alert if <30 days

---

## Configuration

### In `deprecationService.ts`, adjust:

```typescript
// Timeline settings
disabledDate.setMonth(disabledDate.getMonth() + 6);  // 6 months before disable
endOfLifeDate.setMonth(endOfLifeDate.getMonth() + 3); // 3 months before remove

// Default support period for legacy APIs
endOfLifeDate.setMonth(endOfLifeDate.getMonth() + 12); // 1 year

// In DeprecationBanner.tsx, adjust:
autoHideDays = 7;           // Auto-dismiss after 7 days
persistent = false;         // Keep showing after auto-hide
```

---

## Scheduled Jobs (Using cron)

```typescript
// Daily: Auto-disable deprecated features
cron.schedule('0 2 * * *', autoDisableDeprecatedFeatures);

// Daily: Auto-remove end-of-life features
cron.schedule('0 3 * * *', autoRemoveEOLFeatures);

// Weekly: Generate deprecation report
cron.schedule('0 9 * * 1', () => generateDeprecationReport('system'));

// Send weekly reminders
cron.schedule('0 8 * * 1', sendWeeklyReminders);
```

---

## Example: Complete Deprecation Workflow

```typescript
// STEP 1: Announce deprecation
const dep = await announceFeatureDeprecation(
  'oldAuthService',
  '/api/v1/auth',
  'newAuthService',
  '/api/v2/auth',
  'Replacing with OAuth2 compatible service',
  'high',
  'https://docs.example.com/auth-migration'
);

// STEP 2: Notify users
const users = await getAllUsers();
for (const user of users) {
  await issueDeprecationWarning(
    user.id,
    dep.id,
    'Authentication service upgrade required',
    'high'
  );
}

// STEP 3: Display UI warning (auto-shown)
// DeprecationBanner component appears when user accesses oldAuthService

// STEP 4: Track migrations
app.post('/api/user/migrate', async (req, res) => {
  const migration = await createMigrationRecord(
    req.user.id,
    'oldAuthService',
    'newAuthService'
  );
  
  // Perform migration...
  
  await updateMigrationProgress(migration.id, 'completed');
});

// STEP 5: Automatic lifecycle
// Scheduled jobs handle the rest:
// - 6 months: Auto-disable
// - 9 months: Auto-remove

// STEP 6: Reporting
const report = await generateDeprecationReport(adminId);
// Shows migration progress, blockers, recommendations
```

---

## Best Practices

✓ **Communication**
  - Announce 6 months ahead
  - Send email notifications
  - Display persistent UI warnings
  - Provide clear migration guides

✓ **Timeline**
  - 6 months from announcement to disable
  - 3 months from disable to removal
  - Total: 9 months for users to migrate

✓ **Tracking**
  - Record all migrations
  - Support rollback capability
  - Monitor blockers
  - Generate weekly reports

✓ **Data Safety**
  - Always preserve old data
  - Create audit trail
  - Support archival instead of deletion
  - Enable data recovery if needed

✓ **Testing**
  - Test legacy API transformation
  - Verify auto-disable timing
  - Validate UI warnings
  - Test migration rollback

---

## Troubleshooting

### Features not auto-disabling?
- Check cron job is running
- Verify `autoDisableDeprecatedFeatures()` is scheduled
- Check `disabled_date` in database
- Review logs for errors

### Legacy API requests not transforming?
- Verify `endpointMappings` are correct
- Check transformation rules are valid JSON
- Ensure middleware is applied before routes
- Test with `curl -H 'x-api-version: v1'`

### Users not seeing warnings?
- Verify `deprecationWarnings` table has entries
- Check `acknowledged_at` is NULL
- Ensure `DeprecationBanner` component is mounted
- Verify feature is marked as deprecated

### Migration progress not tracking?
- Verify migration records created
- Check status updates are persisted
- Ensure `getUserMigrationProgress()` query is correct
- Review migration history for failures

---

## Support

For detailed implementation instructions, see: `DEPRECATION_IMPLEMENTATION_GUIDE.md`

For API reference, see: `deprecationRoutes.ts`

For component usage, see: `DeprecationWarning.tsx` component docs
