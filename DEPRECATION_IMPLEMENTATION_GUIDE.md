# Deprecation & Migration Management Implementation Guide

## Overview

This guide provides a comprehensive deprecation management system with:
- 6-month advance notice timeline
- Automatic feature disabling
- Legacy API version support
- Migration tracking and progress monitoring
- End-of-life removal
- UI warnings and migration guides

---

## 1. Backend Service: `deprecationService.ts`

### 1.1 Database Initialization

```typescript
import { initializeDeprecationTables } from './services/deprecationService';

// Initialize tables on startup
await initializeDeprecationTables();
```

**Creates these tables:**
- `deprecated_features` - Track feature deprecations
- `migration_records` - Track user migrations
- `legacy_api_versions` - Support old API versions
- `deprecation_warnings` - User-facing warnings
- `migration_history` - Migration audit trail

### 1.2 Announcing Feature Deprecation

```typescript
import {
  announceFeatureDeprecation,
  getMigrationGuide,
  getDeprecatedFeatures,
} from './services/deprecationService';

// Announce feature deprecation (6 months before disabling)
const deprecation = await announceFeatureDeprecation(
  'oldServiceName',                              // featureName
  '/api/v1/old-service',                         // featurePath
  'newServiceName',                              // replacementFeature
  '/api/v2/new-service',                         // replacementPath
  'The old service is being replaced with a more efficient version',
  'high',                                        // severity
  'https://docs.example.com/migration-guide',   // migrationGuideUrl
  [                                              // breakingChanges
    'Response format changed from XML to JSON',
    'Endpoint moved from /api/v1 to /api/v2',
    'Authentication now requires OAuth2',
  ],
  ['service-a', 'service-b']                     // affectedServices
);

console.log(deprecation);
// {
//   id: 'uuid',
//   featureName: 'oldServiceName',
//   status: 'announced',
//   announcedDate: Date,
//   disabledDate: Date (6 months from now),
//   endOfLifeDate: Date (9 months from now),
//   replacementFeature: 'newServiceName',
//   ...
// }
```

**Timeline:**
- **Announced**: Immediately
- **Disabled**: 6 months from announcement
- **End of Life**: 9 months from announcement (3 months after disabled)

### 1.3 Managing Deprecation Status

```typescript
// Update status as timeline progresses
await updateDeprecationStatus(
  deprecationId,
  'disabled',  // 'announced' | 'active' | 'disabled' | 'removed'
  adminId
);

// Get all deprecated features
const deprecated = await getDeprecatedFeatures('active');

// Get upcoming removals (within 30 days)
const upcomingRemovals = await getUpcomingRemovals();
```

### 1.4 Automatic Feature Disabling

```typescript
// Run on schedule (e.g., daily cron job)
import { autoDisableDeprecatedFeatures, autoRemoveEOLFeatures } from './services/deprecationService';

// Disable features past their disabled_date
const disabled = await autoDisableDeprecatedFeatures();
console.log(`Disabled ${disabled.disabled} features`);

// Remove features past their end_of_life_date
const removed = await autoRemoveEOLFeatures();
console.log(`Removed ${removed.removed} features`);
```

### 1.5 Check Feature Status

```typescript
import { isFeatureDeprecated, isFeatureDisabled, getRedirectTarget } from './services/deprecationService';

// Check if feature is deprecated (in announcement or active phase)
const deprecated = await isFeatureDeprecated('oldServiceName');

// Check if feature is disabled or removed
const disabled = await isFeatureDisabled('oldServiceName');

// Get redirect target for UI
const redirectPath = await getRedirectTarget('oldServiceName');
if (redirectPath) {
  // Redirect user to new feature
  res.redirect(redirectPath);
}
```

---

## 2. Migration Tracking

### 2.1 Create Migration Record

```typescript
import {
  createMigrationRecord,
  updateMigrationProgress,
  recordMigrationHistory,
  getUserMigrationProgress,
} from './services/deprecationService';

// Start migration for a user
const migration = await createMigrationRecord(
  userId,
  'oldServiceName',
  'newServiceName',
  'User initiated manual migration'
);

// Track progress
await updateMigrationProgress(
  migration.id,
  'in_progress'  // 'not_started' | 'in_progress' | 'completed' | 'failed' | 'skipped'
);

// Record migration history with rollback capability
const historyId = await recordMigrationHistory(
  userId,
  'oldServiceName',
  'data_transformation',
  oldData,      // Original data
  newData,      // Transformed data
  true,         // success
  undefined     // error message
);

// Update to completed
await updateMigrationProgress(
  migration.id,
  'completed',
  undefined,
  { historyId, transformedRecords: 1000 }
);
```

### 2.2 Track User Progress

```typescript
const progress = await getUserMigrationProgress(userId);
console.log(progress);
// {
//   totalFeatures: 10,
//   completedMigrations: 7,
//   inProgressMigrations: 2,
//   failedMigrations: 1,
//   skippedMigrations: 0,
//   percentageComplete: 70,
//   estimatedCompletionDate: Date,
//   blockers: []
// }
```

---

## 3. Legacy API Version Support

### 3.1 Register Legacy API Version

```typescript
import {
  registerLegacyAPIVersion,
  transformLegacyRequest,
  getLegacyAPIVersion,
  deactivateLegacyAPIVersion,
} from './services/deprecationService';

// Register v1 API as legacy
await registerLegacyAPIVersion(
  'v1',                          // version
  'v2',                          // replacementVersion
  {                              // endpointMappings
    '/api/v1/users': '/api/v2/users',
    '/api/v1/services': '/api/v2/services',
  },
  {                              // transformationRules
    'user_id': 'userId',
    'service_id': 'serviceId',
  },
  'https://docs.example.com/api/v1'  // supportUrl
);
```

### 3.2 Transform Legacy Requests

```typescript
// In middleware/handler
const legacyRequest = req.body;

const { newEndpoint, transformedData } = await transformLegacyRequest(
  'v1',                    // apiVersion
  '/api/v1/users',        // endpoint
  legacyRequest
);

// Forward to new endpoint with transformed data
const response = await fetch(newEndpoint, {
  method: 'POST',
  body: JSON.stringify(transformedData),
});
```

### 3.3 Deactivate Legacy Version

```typescript
// When support ends
await deactivateLegacyAPIVersion('v1', adminId);
```

---

## 4. Deprecation Warnings

### 4.1 Issue Warnings to Users

```typescript
import {
  issueDeprecationWarning,
  acknowledgeDeprecationWarning,
  getUnacknowledgedWarnings,
} from './services/deprecationService';

// Issue warning when user accesses deprecated feature
const warning = await issueDeprecationWarning(
  userId,
  deprecationId,
  'The oldService feature is deprecated. Migrate to newService by December 1, 2024.',
  'high',
  'https://docs.example.com/migration'
);

// User acknowledges warning
await acknowledgeDeprecationWarning(warning.id);

// Get unacknowledged warnings for dashboard
const warnings = await getUnacknowledgedWarnings(userId);
```

---

## 5. Reporting & Monitoring

### 5.1 Generate Deprecation Report

```typescript
import {
  generateDeprecationReport,
  getDeprecationStats,
} from './services/deprecationService';

// Generate comprehensive report
const report = await generateDeprecationReport(adminId);
console.log(report);
// {
//   id: 'uuid',
//   reportDate: Date,
//   deprecatedFeatures: [...],
//   migrationProgress: {
//     totalFeatures: 20,
//     completedMigrations: 15,
//     percentageComplete: 75,
//     ...
//   },
//   upcomingRemovals: [...],
//   recommendations: [...]
// }

// Get deprecation statistics
const stats = await getDeprecationStats();
console.log(stats);
// {
//   byStatus: { announced: 5, active: 10, disabled: 3 },
//   bySeverity: { low: 3, medium: 8, high: 7 },
//   total: 18
// }
```

---

## 6. Frontend Component: `DeprecationWarning.tsx`

### 6.1 Deprecation Banner

Display a dismissible warning banner:

```typescript
import { DeprecationBanner } from './components/DeprecationWarning';

function MyComponent() {
  return (
    <DeprecationBanner
      featureId="feature-uuid"
      featureName="oldServiceName"
      severity="high"
      message="The Old Service is being deprecated. Please migrate to New Service by December 1, 2024."
      replacementFeature="newServiceName"
      replacementPath="/new-service"
      migrationGuideUrl="https://docs.example.com/migration"
      daysUntilDisabled={45}
      daysUntilRemoved={75}
      breakingChanges={[
        'Response format changed to JSON',
        'New authentication required',
      ]}
      onAcknowledge={(warningId) => {
        console.log('User acknowledged:', warningId);
      }}
      onMigrate={(fromFeature, toFeature) => {
        console.log(`Migrating from ${fromFeature} to ${toFeature}`);
      }}
      persistent={true}
      autoHideDays={7}
      showMigrationGuide={false}
    />
  );
}
```

**Features:**
- Severity-based styling (low, medium, high, critical)
- Auto-hide after N days
- Persistent option
- Migration guide modal
- Breaking changes accordion
- Redirect button to new feature

### 6.2 Migration Guide Modal

Triggered from banner or standalone:

```typescript
import { MigrationGuideModal } from './components/DeprecationWarning';

<MigrationGuideModal
  featureName="oldServiceName"
  replacementFeature="newServiceName"
  replacementPath="/new-service"
  migrationGuideUrl="https://docs.example.com/migration"
  breakingChanges={breakingChanges}
  onClose={() => setShowGuide(false)}
/>
```

**Tabs:**
- Overview with migration steps
- Breaking changes list
- Detailed guide link

### 6.3 Deprecation Timeline

Show deprecation timeline:

```typescript
import { DeprecationTimeline } from './components/DeprecationWarning';

<DeprecationTimeline
  announcedDate={new Date('2024-01-01')}
  disabledDate={new Date('2024-07-01')}
  endOfLifeDate={new Date('2024-10-01')}
  removalDate={new Date('2024-10-01')}
  currentStatus="active"
/>
```

**Shows:**
- Announcement date
- Disabled date with countdown
- End of life date
- Removal date
- Visual progress indicator

### 6.4 Migration Progress Bar

Display global migration progress:

```typescript
import { MigrationProgressBar } from './components/DeprecationWarning';

<MigrationProgressBar
  totalFeatures={20}
  completedMigrations={15}
  inProgressMigrations={3}
  failedMigrations={1}
  estimatedCompletionDate={new Date('2024-09-01')}
/>
```

**Shows:**
- Percentage complete
- Completed/in-progress/failed counts
- Estimated completion date

### 6.5 Deprecation Badge

Quick indicator badge:

```typescript
import { DeprecationBadge } from './components/DeprecationWarning';

<DeprecationBadge
  featureName="oldServiceName"
  daysUntilDisabled={45}
  severity="high"
/>
```

**Features:**
- Severity-based color
- Pulsing alert for <30 days
- Hover tooltip

---

## 7. Integration Examples

### 7.1 API Middleware for Feature Access

```typescript
import { isFeatureDisabled, getRedirectTarget, issueDeprecationWarning } from './services/deprecationService';

async function checkFeatureDeprecation(req, res, next) {
  const feature = req.query.feature;
  const userId = req.user.id;

  // Check if feature is disabled
  if (await isFeatureDisabled(feature)) {
    const redirectPath = await getRedirectTarget(feature);
    if (redirectPath) {
      return res.status(301).redirect(redirectPath);
    }
    return res.status(410).json({ error: 'Feature has been removed' });
  }

  // Issue warning if deprecated
  const deprecated = await isFeatureDeprecated(feature);
  if (deprecated) {
    await issueDeprecationWarning(userId, featureId, message, 'medium');
  }

  next();
}

app.use(checkFeatureDeprecation);
```

### 7.2 Scheduled Jobs

```typescript
import cron from 'node-cron';
import { 
  autoDisableDeprecatedFeatures, 
  autoRemoveEOLFeatures,
  generateDeprecationReport 
} from './services/deprecationService';

// Daily: Check and disable deprecated features
cron.schedule('0 2 * * *', async () => {
  try {
    const result = await autoDisableDeprecatedFeatures();
    console.log(`Auto-disabled ${result.disabled} features`);
  } catch (error) {
    console.error('Error disabling features:', error);
  }
});

// Daily: Remove EOL features
cron.schedule('0 3 * * *', async () => {
  try {
    const result = await autoRemoveEOLFeatures();
    console.log(`Auto-removed ${result.removed} features`);
  } catch (error) {
    console.error('Error removing features:', error);
  }
});

// Weekly: Generate report
cron.schedule('0 9 * * 1', async () => {
  try {
    const report = await generateDeprecationReport('system');
    // Send to admins or slack
    console.log('Weekly deprecation report generated');
  } catch (error) {
    console.error('Error generating report:', error);
  }
});
```

### 7.3 Dashboard Integration

```typescript
import { 
  getUpcomingRemovals,
  getUserMigrationProgress,
  getDeprecationStats 
} from './services/deprecationService';

async function getDeprecationDashboard(userId) {
  return {
    upcomingRemovals: await getUpcomingRemovals(),
    userProgress: await getUserMigrationProgress(userId),
    statistics: await getDeprecationStats(),
  };
}
```

---

## 8. Database Queries Reference

### Get All Active Deprecations

```sql
SELECT * FROM deprecated_features WHERE status = 'active' ORDER BY end_of_life_date;
```

### Get User's Migration Status

```sql
SELECT 
  from_feature,
  to_feature,
  status,
  COUNT(*) as count
FROM migration_records
WHERE user_id = $1
GROUP BY from_feature, to_feature, status;
```

### Find Migration Blockers

```sql
SELECT 
  from_feature,
  failure_reason,
  COUNT(*) as error_count
FROM migration_records
WHERE status = 'failed'
GROUP BY from_feature, failure_reason
ORDER BY error_count DESC;
```

### Get Critical Deprecations

```sql
SELECT * FROM deprecated_features 
WHERE severity = 'critical' AND status IN ('announced', 'active')
ORDER BY end_of_life_date ASC;
```

---

## 9. Best Practices

### 9.1 Timeline Management

- **Announcement**: 6 months before disabling
- **Grace Period**: 6 months (from announcement to disable)
- **Extended Support**: 3 months (from disable to removal)
- **Total**: 9 months for users to migrate

### 9.2 Communication

1. Announce deprecation via email
2. Display warning in UI when feature is accessed
3. Show migration guide and timeline
4. Send weekly reminders as deadline approaches
5. Final notice 1 week before removal

### 9.3 Monitoring

- Track migration progress weekly
- Identify migration blockers early
- Provide support for difficult migrations
- Monitor legacy API usage
- Alert admins on critical deprecations

### 9.4 Data Safety

- Always record migration history
- Support rollback for migrations
- Archive old data instead of deleting
- Log all deprecation actions
- Maintain audit trail

---

## 10. API Endpoints Reference

### Feature Management

```
POST /api/admin/deprecations
  - Announce new deprecation

GET /api/admin/deprecations
  - List all deprecations

PATCH /api/admin/deprecations/:id
  - Update deprecation status

GET /api/admin/deprecations/stats
  - Get deprecation statistics

GET /api/admin/deprecations/upcoming
  - Get upcoming removals
```

### Migration Tracking

```
POST /api/user/migrations
  - Start migration

PATCH /api/user/migrations/:id
  - Update migration progress

GET /api/user/migrations
  - Get user's migrations

GET /api/user/migrations/progress
  - Get migration progress summary
```

### Warnings

```
GET /api/user/warnings
  - Get unacknowledged warnings

POST /api/user/warnings/:id/acknowledge
  - Acknowledge warning

GET /api/user/warnings/history
  - Get warning history
```

### Legacy APIs

```
POST /api/admin/legacy-versions
  - Register legacy API version

GET /api/admin/legacy-versions/:version
  - Get legacy API version info

POST /api/admin/legacy-versions/:version/deactivate
  - Deactivate legacy version
```

---

## 11. Error Handling

```typescript
import { logAction } from './services/auditLogger';

try {
  await announceFeatureDeprecation(...);
} catch (error) {
  await logAction(adminId, 'admin', 'deprecation_error', featureName, {
    ipAddress: req.ip,
    errorMessage: error.message,
    dataClassification: 'internal',
  });
  res.status(500).json({ error: 'Failed to announce deprecation' });
}
```

---

## 12. Testing

```typescript
describe('Deprecation Service', () => {
  it('should announce feature deprecation with 6-month timeline', async () => {
    const dep = await announceFeatureDeprecation('oldFeature', '/old', 'newFeature', '/new', '...', 'high');
    expect(dep.status).toBe('announced');
    expect(dep.disabledDate.getMonth()).toBe(new Date().getMonth() + 6);
  });

  it('should auto-disable features on scheduled date', async () => {
    // Mock date to after disabledDate
    await autoDisableDeprecatedFeatures();
    const feature = await getDeprecatedFeatures('disabled');
    expect(feature.length).toBeGreaterThan(0);
  });

  it('should track migration progress', async () => {
    const migration = await createMigrationRecord(userId, 'old', 'new');
    await updateMigrationProgress(migration.id, 'completed');
    const progress = await getUserMigrationProgress(userId);
    expect(progress.completedMigrations).toBe(1);
  });
});
```

---

## Summary

This deprecation management system provides:

✓ 6-month advance notice with timeline tracking
✓ Automatic feature disabling on schedule
✓ Migration tracking and progress monitoring
✓ Legacy API version support with request transformation
✓ UI warnings with migration guides
✓ End-of-life feature removal
✓ Comprehensive audit logging
✓ Admin dashboards and reporting

Use this system to ensure smooth feature transitions and maintain backward compatibility during major updates.
