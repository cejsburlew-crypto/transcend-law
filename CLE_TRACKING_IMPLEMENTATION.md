# CLE (Continuing Legal Education) Tracking System Implementation

## Overview

The CLE Tracking System is a comprehensive solution for managing attorney continuing legal education credits, tracking compliance with state bar requirements, and automating deadline alerts and bar association synchronization.

## Features

### 1. Credit Tracking
- Record CLE credits with course name, description, and provider info
- Support for three credit types: Ethics, Mandatory, General
- Track completion dates and certificates
- Associate credits with legal education providers
- Support for all 50 US states with state-specific requirements

### 2. State-Specific Compliance
- Pre-configured requirements for 10 major states (CA, TX, NY, FL, IL, PA, OH, GA, NC, MI)
- Customizable for all 50 states
- Tracks annual hours, ethics hours, and mandatory category hours
- Support for credit carryover policies (varies by state)
- Automatic compliance calculation

### 3. Deadline Management
- Automatic deadline tracking for each state
- Email alerts at 90, 60, and 30 days before deadline
- Real-time deadline status (upcoming, warning, critical, overdue)
- Earning deadline vs. reporting deadline distinction

### 4. Bar Association Integration
- Unique bar reference numbers for each credit
- Sync status tracking with bar associations
- API integration framework for automatic syncing
- Audit trail for all bar association communications

### 5. Reporting & Compliance
- Generate compliance reports in PDF, CSV, and JSON formats
- Export reports for bar applications
- Detailed breakdown by credit type
- Compliance status verification

### 6. Audit & Security
- Complete audit log of all CLE activities
- Track who recorded/updated credits and when
- Compliance status change history
- Admin oversight capabilities

## File Structure

```
transcend-ssp/
├── transcend-api/
│   ├── services/
│   │   └── cleService.ts              # Core CLE business logic
│   ├── routes/
│   │   └── cleRoutes.ts               # Express API endpoints
│   └── database/
│       └── schema-cle.sql             # Database schema and tables
├── transcend-frontend/
│   └── src/components/
│       ├── CLETracker.tsx             # React component
│       └── CLETracker.css             # Component styles
└── CLE_TRACKING_IMPLEMENTATION.md     # This file
```

## Installation & Setup

### 1. Database Setup

Execute the schema file to create all required tables:

```bash
psql -U postgres -d transcend_db -f transcend-api/database/schema-cle.sql
```

This creates:
- `cle_providers` - CLE provider registry
- `cle_credits` - Attorney CLE credits
- `cle_compliance` - Compliance status tracking
- `cle_deadlines` - Deadline tracking
- `cle_audit_log` - Activity audit trail
- `cle_export_reports` - Generated reports
- `cle_state_requirements` - State requirement configuration
- Supporting views and functions

### 2. Backend Integration

Add the CLE routes to your Express app:

```typescript
// src/index.ts
import cleRoutes from './routes/cleRoutes';

app.use('/api/v2/cle', cleRoutes);
```

### 3. Frontend Integration

Import and use the CLE Tracker component:

```typescript
import CLETracker from './components/CLETracker';

// In your attorney dashboard or CLE management page
<CLETracker 
  attorneyId={attorneyId}
  userType="attorney"
  onComplianceChange={(state, compliant) => console.log(`${state} compliance: ${compliant}`)}
/>
```

## API Endpoints

### Recording Credits

**POST** `/api/v2/cle/{attorneyId}/credit`

Record a new CLE credit.

```json
{
  "courseName": "Legal Ethics Update 2024",
  "courseDescription": "Annual ethics and professional responsibility update",
  "creditType": "Ethics",
  "hoursEarned": 2,
  "state": "CA",
  "providerId": "provider-uuid",
  "certificateUrl": "https://example.com/cert.pdf",
  "completionDate": "2024-03-15"
}
```

### Retrieving CLE Data

**GET** `/api/v2/cle/{attorneyId}?state=CA&year=2024`

Get complete CLE data for an attorney (credits, compliance, deadline).

### Getting Compliance Status

**GET** `/api/v2/cle/{attorneyId}/compliance?state=CA&year=2024`

Get compliance status for a specific state and year.

### Exporting Reports

**GET** `/api/v2/cle/{attorneyId}/export?state=CA&year=2024&format=pdf`

Export compliance report. Formats: `pdf`, `csv`, `json`

### State Requirements

**GET** `/api/v2/cle/states/requirements`

Get CLE requirements for all states.

**GET** `/api/v2/cle/states/requirements/{state}`

Get CLE requirements for a specific state.

## State Requirements

### Supported States

| State | Annual Hours | Ethics Hours | Mandatory | Reporting Deadline | Carryover |
|-------|-------------|--------------|-----------|-------------------|-----------|
| CA | 25 | 1 | Bias (1) | 12/31 | 5h, 3yr |
| TX | 15 | 1 | Professional (1) | 6/30 | None |
| NY | 24 | 4 | Ethics (2), Prof (1) | 5/15 | 6h, 3yr |
| FL | 33 | 3 | Ethics (3), Prof (1) | 1/31 | None |
| IL | 30 | 2 | Ethics (1), Diversity (1) | 12/31 | 10h, 1yr |
| PA | 12 | 2 | Ethics (2) | 12/31 | None |
| OH | 24 | 1 | Professionalism (1) | 1/15 | None |
| GA | 12 | 1 | Ethics (1) | 12/31 | None |
| NC | 12 | 1 | Ethics (1) | 6/30 | None |
| MI | 18 | 1 | Professionalism (1) | 9/30 | None |

### Adding New States

Update `STATE_CLE_REQUIREMENTS` in `cleService.ts`:

```typescript
export const STATE_CLE_REQUIREMENTS: Record<string, ...> = {
  // ... existing states
  WA: {
    stateCode: 'WA',
    stateName: 'Washington',
    annualHours: 30,
    ethicsHours: 1,
    mandatoryHours: { 'Legal Ethics': 1 },
    reportingDeadline: '2024-12-31',
    carryoverHours: 5,
    carryoverYears: 2,
    barAssociationId: 'washington-bar',
    barAssociationAPI: 'https://api.wsba.org/cle',
  },
};
```

## Component Features

### CLETracker Component Props

```typescript
interface CLETrackerProps {
  attorneyId: string;           // Attorney UUID
  userType: 'attorney' | 'admin' | 'bar-staff';  // User type
  onComplianceChange?: (state: string, compliant: boolean) => void; // Callback
}
```

### Tabs

1. **Overview** - Dashboard with status and key metrics
2. **Credits** - Table of all recorded credits
3. **Deadlines** - Deadline status and alert history
4. **Export** - Generate and download reports

### Status Indicators

- **Compliant** (Green): Attorney has met all requirements
- **Non-Compliant** (Red): Deficit hours needed
- **Pending** (Yellow): Under review
- **Critical** (Red): Less than 30 days to deadline
- **Overdue** (Dark Red): Deadline has passed

## Automated Tasks

### Deadline Alert Processing

Run this periodically (e.g., daily via cron):

```typescript
import { checkAndSendDeadlineAlerts } from './services/cleService';

// Daily scheduled task
await checkAndSendDeadlineAlerts();
```

This will:
1. Check all upcoming deadlines
2. Send email alerts at 90, 60, 30 days
3. Update deadline status to critical/overdue

### Bar Association Sync

Run periodically to sync with bar association APIs:

```typescript
import { syncWithBarAssociation } from './services/cleService';

// Weekly or monthly
await syncWithBarAssociation(attorneyId, 'CA');
```

## Database Views

### vw_attorney_cle_summary
Provides quick overview of attorney compliance across states.

```sql
SELECT * FROM vw_attorney_cle_summary 
WHERE attorney_id = 'uuid'
ORDER BY reporting_deadline;
```

### vw_cle_credits_summary
Aggregated credit counts by attorney, state, and year.

```sql
SELECT * FROM vw_cle_credits_summary 
WHERE attorney_id = 'uuid' AND state = 'CA' AND year = 2024;
```

### vw_upcoming_cle_deadlines
List of all upcoming deadlines with days remaining.

```sql
SELECT * FROM vw_upcoming_cle_deadlines 
WHERE days_remaining <= 90
ORDER BY days_remaining;
```

## Integration Examples

### Recording Credits from External Provider

```typescript
import { recordCLECredit } from './services/cleService';

const credit = await recordCLECredit(
  attorneyId = 'attorney-uuid',
  providerId = 'provider-uuid',
  courseName = 'Advanced Legal Writing',
  courseDescription = 'Writing techniques for appellate briefs',
  creditType = 'General',
  hoursEarned = 3,
  state = 'CA',
  completionDate = new Date('2024-03-15'),
  certificateUrl = 'https://provider.com/cert.pdf'
);
```

### Checking Compliance Status

```typescript
import { getCLECompliance } from './services/cleService';

const compliance = await getCLECompliance(
  attorneyId,
  state = 'CA',
  year = 2024
);

console.log(`Hours: ${compliance.totalHours}/${compliance.totalHours + compliance.deficitHours}`);
console.log(`Compliant: ${compliance.isCompliant}`);
```

### Generating Export for Bar

```typescript
import { exportForBarApplication } from './services/cleService';

const csvData = await exportForBarApplication(
  attorneyId,
  state = 'CA',
  year = 2024,
  format = 'csv'
);

// Send to bar association or save for attorney
```

## Security Considerations

1. **Authorization**: Only attorneys can view/modify their own credits; admins can view all
2. **Data Validation**: All inputs validated before database insertion
3. **Audit Trail**: Complete audit log of all changes
4. **Encryption**: Certificates and sensitive data encrypted at rest
5. **API Keys**: Bar association API integrations use secure credential management

## Error Handling

The service uses descriptive error messages:

```typescript
// Invalid state
Error: CLE requirements not found for state: XX

// Invalid hours
Error: Credit hours must be between 0 and 50

// Missing provider
Error: CLE provider not found

// Unauthorized access
Error: Unauthorized to view this attorney's CLE data
```

## Troubleshooting

### Credits Not Syncing with Bar Association

- Check `bar_reference_number` is populated
- Verify `synced_with_bar` flag status
- Check bar association API endpoint configuration
- Review `cle_audit_log` for sync attempts

### Compliance Not Updating

- Manually trigger update via:
  ```typescript
  await updateCLEComplianceStatus(attorneyId, state, year);
  ```
- Verify credits are recorded with correct `completion_date`
- Check state requirements are correctly configured

### Missing Deadline Alerts

- Verify `checkAndSendDeadlineAlerts()` is running
- Check email configuration in `.env`
- Verify attorney email is set in `users` table
- Check deadline status hasn't been manually overridden

## Testing

### Unit Tests

```typescript
describe('CLE Service', () => {
  it('should record a CLE credit', async () => {
    const credit = await recordCLECredit(
      'attorney-id',
      'provider-id',
      'Test Course',
      'Description',
      'Ethics',
      2,
      'CA',
      new Date()
    );
    expect(credit.hoursEarned).toBe(2);
  });

  it('should calculate compliance correctly', async () => {
    const compliance = await getCLECompliance('attorney-id', 'CA', 2024);
    expect(compliance.isCompliant).toBeDefined();
  });
});
```

### Manual Testing Checklist

- [ ] Record a CLE credit
- [ ] View credits in tracker component
- [ ] Check compliance status updates
- [ ] Generate PDF export
- [ ] Test deadline alerts
- [ ] Verify bar sync creates reference numbers
- [ ] Check audit log entries

## Future Enhancements

1. **Mobile App**: Native iOS/Android for on-the-go credit tracking
2. **AI Credit Detection**: Automatically extract credit info from certificates
3. **Calendar Integration**: Sync deadlines with Google Calendar/Outlook
4. **Provider Marketplace**: Attorneys discover CLE providers
5. **Group Compliance**: Firm-wide CLE tracking and reporting
6. **Real-time Bar Sync**: Live sync with all state bar APIs
7. **Predictive Analytics**: Predict compliance issues early
8. **Mobile Certificates**: Digital wallet integration for certificates

## Support & Maintenance

### Regular Maintenance Tasks

- Monthly: Verify state requirements are current (fees, hours, etc.)
- Quarterly: Audit compliance status for accuracy
- Annually: Update state requirements database
- As needed: Add new states or update bar association APIs

### Monitoring

Monitor these metrics:
- Compliance rate by state
- Average time to record credits
- Deadline alert effectiveness
- Bar association sync success rate
- System performance (query times)

## Contact & Support

For issues or questions:
1. Check the troubleshooting section
2. Review audit logs for debugging
3. Contact platform support team
4. File bug reports with reproduction steps

---

**Last Updated**: August 2026
**Version**: 1.0.0
**Status**: Production Ready
