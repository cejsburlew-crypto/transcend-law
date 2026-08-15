# Conflict of Interest Checker - Setup & Deployment

## Files Created

### Backend Services

1. **`/transcend-api/services/conflictChecker.ts`** (847 lines)
   - Core service implementing all conflict checking logic
   - Parallel conflict detection algorithms
   - Appeal management
   - Database operations

2. **`/transcend-api/routes/conflictRoutes.ts`** (325 lines)
   - RESTful API endpoints
   - Authentication & authorization middleware
   - Request validation
   - Error handling

3. **`/transcend-api/database/schema-conflict-checker.sql`** (350+ lines)
   - 8 database tables
   - Indexes for performance
   - Views for common queries
   - Stored procedures for conflict detection
   - Trigger-based audit logging
   - Sample data

### Frontend Components

4. **`/transcend-frontend/src/components/ConflictWarning.tsx`** (410 lines)
   - React component for conflict display
   - Appeal submission form
   - Document upload support
   - Responsive design

5. **`/transcend-frontend/src/components/ConflictWarning.css`** (380 lines)
   - Severity-based color coding
   - Responsive layouts
   - Dark mode support
   - Animations & transitions

### Documentation

6. **`/CONFLICT_CHECKER_IMPLEMENTATION.md`** (650+ lines)
   - Complete technical documentation
   - Database schema details
   - API reference
   - Integration examples
   - Testing guidelines

## Deployment Steps

### Step 1: Database Migration

```bash
# Connect to your PostgreSQL database
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f transcend-api/database/schema-conflict-checker.sql

# Verify tables were created
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\dt conflict_*"
```

Expected output:
```
public | conflict_appeals             | table
public | conflict_checks              | table
public | conflict_database_updates    | table
public | conflict_matches             | table
public | disqualifying_relationships  | table
public | family_connections           | table
public | opposing_counsel             | table
public | prior_representations        | table
```

### Step 2: Environment Variables

Add to `.env`:

```env
# Conflict Checker
CONFLICT_CHECKER_ENABLED=true
CONFLICT_DB_HOST=localhost
CONFLICT_DB_PORT=5432
CONFLICT_DB_NAME=transcend_ssp
CONFLICT_DB_USER=postgres
CONFLICT_DB_PASSWORD=xxxxx

# Appeal Process
CONFLICT_APPEAL_TIMEOUT_DAYS=30
CONFLICT_APPEAL_NOTIFICATION_EMAIL=compliance@transcend-law.com

# Audit Logging
CONFLICT_AUDIT_RETENTION_YEARS=7

# File Upload
FILE_UPLOAD_MAX_SIZE_MB=10
FILE_UPLOAD_ALLOWED_TYPES=pdf,doc,docx,jpg,png
```

### Step 3: Install Backend Service

```bash
# Navigate to API directory
cd transcend-api

# Install dependencies (if not already installed)
npm install uuid

# Copy service files
cp services/conflictChecker.ts services/conflictChecker.ts
cp routes/conflictRoutes.ts routes/conflictRoutes.ts

# Verify TypeScript compilation
npm run build
```

### Step 4: Register API Routes

In `transcend-api/app.ts`:

```typescript
import conflictRoutes from './routes/conflictRoutes';

// Add to Express app
app.use('/api/conflicts', conflictRoutes);
```

### Step 5: Install Frontend Component

```bash
# Navigate to frontend directory
cd transcend-frontend

# Copy component files
cp src/components/ConflictWarning.tsx src/components/ConflictWarning.tsx
cp src/components/ConflictWarning.css src/components/ConflictWarning.css
```

### Step 6: Integrate Component in Application

Example integration in attorney selection page:

```tsx
import ConflictWarning from './components/ConflictWarning';
import { ConflictCheckerService } from '../services/conflictChecker';

export function AttorneySelectionPage() {
  const [selectedAttorneyId, setSelectedAttorneyId] = useState<string | null>(null);
  const { currentUser } = useAuth();

  const handleAttorneySelect = async (attorneyId: string) => {
    // Check for conflicts
    const result = await ConflictCheckerService.checkAttorneyClientMatch(
      attorneyId,
      currentUser.id
    );

    if (result.conflictFound && result.severity === 'critical') {
      // Show error and prevent selection
      showAlert('This attorney cannot be selected due to a conflict.');
      return;
    }

    setSelectedAttorneyId(attorneyId);
  };

  return (
    <div>
      {selectedAttorneyId && (
        <ConflictWarning
          attorneyId={selectedAttorneyId}
          clientId={currentUser.id}
        />
      )}

      {/* Attorney list */}
    </div>
  );
}
```

### Step 7: Middleware Integration

Add conflict check middleware to attorney-client matching endpoints:

```typescript
import { ConflictCheckerService } from '../services/conflictChecker';

const conflictCheckMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { attorneyId, clientId } = req.body;

  if (attorneyId && clientId) {
    const isBlocked = await ConflictCheckerService.isMatchBlocked(
      attorneyId,
      clientId
    );

    if (isBlocked) {
      return res.status(409).json({
        error: 'Conflict of interest prevents this match',
        details: await ConflictCheckerService.getConflictDetails(
          attorneyId,
          clientId
        ),
      });
    }
  }

  next();
};

// Apply middleware
app.post('/api/attorney-match', conflictCheckMiddleware, createMatch);
```

### Step 8: Data Import

Import existing conflict data:

```bash
# Create import script
cat > scripts/import-conflicts.js << 'EOF'
const { ConflictCheckerService } = require('../services/conflictChecker');
const fs = require('fs');

async function importConflicts() {
  // Import opposing counsel from CSV
  const opposingCounselData = fs.readFileSync('data/opposing-counsel.csv', 'utf-8');
  const records = parseCSV(opposingCounselData);

  for (const record of records) {
    await ConflictCheckerService.addOpposingCounsel(record);
    console.log(`Imported opposing counsel: ${record.case_name}`);
  }

  console.log(`Imported ${records.length} opposing counsel records`);
}

importConflicts().catch(console.error);
EOF

# Run import
node scripts/import-conflicts.js
```

CSV Format (`data/opposing-counsel.csv`):
```csv
attorneyId,opposingAttorneyId,caseId,caseName,matterType,courtJurisdiction,caseNumber,startDate,status
uuid1,uuid2,CASE-001,Smith v. Johnson,civil,Superior Court - CA,2024-12345,2023-01-15,active
```

### Step 9: Testing

Run tests:

```bash
# Unit tests for conflict checker
npm test -- conflictChecker.test.ts

# Integration tests
npm test -- conflictRoutes.integration.test.ts

# E2E tests
npm run test:e2e -- conflict-checker.e2e.ts
```

### Step 10: Monitoring & Alerts

Set up monitoring:

```typescript
// Monitor conflict checks
app.get('/api/admin/conflict-stats', async (req, res) => {
  const result = await query(`
    SELECT
      COUNT(*) as total_checks,
      COUNT(CASE WHEN conflict_found THEN 1 END) as conflicts_found,
      AVG(EXTRACT(EPOCH FROM (checked_at - NOW()))) as avg_age_seconds
    FROM conflict_checks
    WHERE checked_at > NOW() - INTERVAL '24 hours'
  `);

  res.json(result.rows[0]);
});
```

## Compliance Checklist

- [ ] Database schema installed
- [ ] API routes registered
- [ ] Frontend component imported
- [ ] Middleware configured
- [ ] Conflict data imported
- [ ] Audit logging enabled
- [ ] Appeals process tested
- [ ] Admin override logging verified
- [ ] Email notifications configured
- [ ] Documentation reviewed
- [ ] Legal review completed
- [ ] Compliance training scheduled

## Configuration Recommendations

### Production

```javascript
const config = {
  // Performance
  conflictCheckCacheTimeout: 300000, // 5 minutes
  maxConcurrentChecks: 50,
  
  // Appeals
  appealReviewTimeoutDays: 30,
  escalationTime: 7 * 24 * 60 * 60 * 1000, // 7 days
  
  // Data Retention
  auditLogRetention: 7 * 365 * 24 * 60 * 60 * 1000, // 7 years
  
  // Notifications
  enableEmailNotifications: true,
  notificationEmail: 'compliance@transcend-law.com',
};
```

### Development

```javascript
const config = {
  conflictCheckCacheTimeout: 0, // No cache
  maxConcurrentChecks: 10,
  appealReviewTimeoutDays: 1,
  enableEmailNotifications: false,
};
```

## API Authentication

All endpoints require Bearer token:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://api.transcend-law.com/api/conflicts/check/attorney-uuid/client-uuid
```

## Rate Limiting

Recommended limits:

```
- Conflict checks: 100/minute per user
- Appeals: 10/hour per user
- Admin operations: 50/minute per admin
```

## Database Performance Tuning

```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM conflict_matches 
WHERE attorney_id = 'uuid' AND client_id = 'uuid';

-- Refresh materialized views
REFRESH MATERIALIZED VIEW vw_active_conflicts;
REFRESH MATERIALIZED VIEW vw_blocked_matches;
REFRESH MATERIALIZED VIEW vw_pending_appeals;

-- Vacuum and analyze
VACUUM ANALYZE conflict_checks;
VACUUM ANALYZE conflict_appeals;
```

## Disaster Recovery

### Backup

```bash
# Daily backup
pg_dump -h $DB_HOST -U $DB_USER $DB_NAME > conflicts_backup_$(date +%Y%m%d).sql

# Backup with compression
pg_dump -h $DB_HOST -U $DB_USER $DB_NAME | gzip > conflicts_backup_$(date +%Y%m%d).sql.gz
```

### Restore

```bash
# From backup
psql -h $DB_HOST -U $DB_USER $DB_NAME < conflicts_backup_20240815.sql

# From compressed backup
gunzip -c conflicts_backup_20240815.sql.gz | psql -h $DB_HOST -U $DB_USER $DB_NAME
```

## Troubleshooting

### Issue: Conflict checks timeout

**Solution**: Increase database connection pool size
```typescript
pool: new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### Issue: Appeals not being reviewed

**Solution**: Verify email configuration and check `conflict_appeals` table
```sql
SELECT * FROM conflict_appeals 
WHERE appeal_status = 'pending' 
ORDER BY submitted_at DESC;
```

### Issue: Duplicate conflict entries

**Solution**: Use UNIQUE constraint (already in schema)
```sql
SELECT COUNT(*), attorney_id, client_id 
FROM conflict_matches 
GROUP BY attorney_id, client_id 
HAVING COUNT(*) > 1;
```

## Verification

After deployment, verify:

1. **Database Tables**:
   ```sql
   SELECT count(*) FROM information_schema.tables 
   WHERE table_name LIKE 'conflict_%' OR table_name IN (
     'opposing_counsel', 'prior_representations', 
     'family_connections', 'disqualifying_relationships'
   );
   ```
   Expected: 8 tables

2. **API Endpoints**:
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/conflicts/summary/test-uuid
   ```
   Expected: 200 response with conflict summary

3. **Component Loading**:
   - Verify ConflictWarning component renders
   - Test with no conflicts scenario
   - Test with conflicts scenario
   - Test appeal form submission

## Support

For deployment issues:
- Check logs: `tail -f logs/conflict-checker.log`
- Run diagnostics: `npm run diagnose`
- Contact: devops@transcend-law.com

## Next Steps

1. Schedule compliance review
2. Train support team
3. Monitor metrics for first week
4. Gather user feedback
5. Plan feature enhancements
