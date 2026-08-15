# Data Residency Implementation Guide

## Overview

The Data Residency Service provides comprehensive GDPR/CCPA/PIPEDA compliance with regional data residency enforcement. This implementation ensures user data never leaves their selected region and maintains strict regulatory compliance.

## Architecture

### Supported Regions

```typescript
type Region = 'us-east-1' | 'eu-west-1' | 'uk-west-2' | 'ca-central-1'
```

| Region | Location | Compliance | Key Regulations |
|--------|----------|-----------|-----------------|
| us-east-1 | US East Coast | CCPA, HIPAA, SOC2 | CCPA, HIPAA, FCRA |
| eu-west-1 | Ireland | GDPR | GDPR, EDPB |
| uk-west-2 | London | UK GDPR | UK GDPR, DPA 2018 |
| ca-central-1 | Toronto | PIPEDA | PIPEDA, Provincial Laws |

### Compliance Frameworks

#### GDPR (EU - eu-west-1)
- **Requirements:**
  - Data subject rights enforcement
  - Data processing agreements
  - Data protection impact assessments
  - Privacy by design
  - 72-hour breach notification
  - Data retention limits
  - International transfer restrictions
- **Audit Frequency:** Quarterly
- **Max Retention:** 2,555 days (7 years for legal holds)
- **Auto-Delete:** Enabled

#### CCPA (US - us-east-1)
- **Requirements:**
  - Consumer data access rights
  - Data deletion requests
  - Opt-out of data sale
  - Non-discrimination
  - Annual audits
  - Security safeguards
- **Audit Frequency:** Annually
- **Max Retention:** 1,825 days (5 years)
- **Auto-Delete:** Enabled

#### PIPEDA (Canada - ca-central-1)
- **Requirements:**
  - Consent-based collection
  - Purpose limitation
  - Data accuracy
  - Access/correction/deletion rights
  - Privacy breach notification
  - Reasonable safeguards
- **Audit Frequency:** Annually
- **Max Retention:** 1,825 days (5 years)
- **Auto-Delete:** Enabled

#### UK GDPR (UK - uk-west-2)
- **Requirements:**
  - Post-Brexit data protection
  - Data subject rights
  - UK adequacy determination
  - International transfer mechanisms
  - Data processing agreements
  - Privacy by design
  - 72-hour breach notification
- **Audit Frequency:** Quarterly
- **Max Retention:** 2,555 days (7 years)
- **Auto-Delete:** Enabled

## Implementation Steps

### 1. Database Setup

Run the migration to create residency tables:

```bash
psql -U transcend_admin -d transcend_law < src/database/migrations/001_data_residency_tables.sql
```

This creates:
- `user_residency` - User region configuration
- `user_encryption_keys` - Per-region encryption keys
- `data_transfer_requests` - Transfer audit trail
- `compliance_reports` - Generated reports
- `regional_access_log` - Cross-region access attempts
- `data_transfer_log` - Transfer history
- `encryption_key_rotation` - Key rotation audit
- `compliance_audit` - Compliance audit trail

### 2. Initialize Residency on Signup

```typescript
import { setUserResidency, initializeRegionalEncryption } from './services/dataResidencyService';

// During signup
const residency = await setUserResidency(
  userId,
  'eu-west-1', // or user selected region
  'Germany',   // user country
  req.ip,
  req.get('user-agent')
);

// Initialize encryption
await initializeRegionalEncryption(userId, 'eu-west-1');
```

### 3. Enforce Data Access Restrictions

Add regional validation middleware:

```typescript
import { validateRegionalAccess } from './routes/residency';

// Add to sensitive data routes
app.get('/api/cases/:id', validateRegionalAccess, getCaseHandler);
app.get('/api/documents/:id', validateRegionalAccess, getDocumentHandler);
```

### 4. Block Cross-Region Data Transfer

```typescript
import { blockExternalDataTransfer } from './services/dataResidencyService';

// Check before any data export
const result = await blockExternalDataTransfer(
  userId,
  dataSize,
  targetRegion,
  req.ip
);

if (result.blocked) {
  throw new Error(result.reason);
}
```

## API Endpoints

### Region Selection

#### GET `/api/residency/regions`
Get available regions for user selection.

**Response:**
```json
{
  "success": true,
  "regions": [
    {
      "region": "eu-west-1",
      "name": "EU - Ireland",
      "country": "Ireland",
      "compliance": ["GDPR", "Standard Contractual Clauses"],
      "regulations": ["GDPR", "EDPB", "National Privacy Laws"]
    }
  ]
}
```

#### POST `/api/residency/select`
User selects data residency region during signup.

**Request:**
```json
{
  "region": "eu-west-1",
  "country": "Germany"
}
```

**Response:**
```json
{
  "success": true,
  "residency": {
    "userId": "user-123",
    "region": "eu-west-1",
    "complianceFramework": "GDPR",
    "dataRetentionDays": 2555,
    "encryptionKeyRegion": "eu-west-1",
    "status": "active"
  }
}
```

#### GET `/api/residency/config`
Get current user's residency configuration.

**Response:**
```json
{
  "success": true,
  "residency": {
    "userId": "user-123",
    "region": "eu-west-1",
    "complianceFramework": "GDPR",
    "dataRetentionDays": 2555,
    "status": "active"
  },
  "regionConfig": {
    "region": "eu-west-1",
    "name": "EU - Ireland",
    "compliance": ["GDPR"],
    "timeZone": "Europe/Dublin"
  }
}
```

### Compliance & Reporting

#### POST `/api/residency/compliance-report`
Generate compliance report for date range.

**Request:**
```json
{
  "startDate": "2024-01-01",
  "endDate": "2024-03-31"
}
```

**Response:**
```json
{
  "success": true,
  "report": {
    "reportId": "report_user-123_1704067200000",
    "userId": "user-123",
    "region": "eu-west-1",
    "generatedDate": "2024-03-31T23:59:59Z",
    "reportPeriod": {
      "startDate": "2024-01-01T00:00:00Z",
      "endDate": "2024-03-31T23:59:59Z"
    },
    "dataAccessEvents": 1250,
    "externalAccessAttempts": 0,
    "dataTransferEvents": 0,
    "retentionCompliance": true,
    "encryptionStatus": "compliant",
    "findings": [
      "Residency: eu-west-1",
      "Compliance Framework: GDPR",
      "Encryption verified for regional residency"
    ]
  }
}
```

#### GET `/api/residency/audit-trail`
Get residency audit trail with pagination.

**Query Parameters:**
- `limit` (default: 50) - Number of records to return

**Response:**
```json
{
  "success": true,
  "auditTrail": [
    {
      "userId": "user-123",
      "action": "residency_set",
      "details": {
        "region": "eu-west-1",
        "complianceFramework": "GDPR"
      },
      "ip": "192.168.1.1",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "count": 15
}
```

#### GET `/api/residency/export`
Export compliance data as CSV.

**Response:** CSV file download

### Data Transfer Management

#### POST `/api/residency/transfer-request`
Request data transfer to different region.

**Request:**
```json
{
  "toRegion": "us-east-1",
  "reason": "Business relocation to USA"
}
```

**Response:**
```json
{
  "success": true,
  "transferRequest": {
    "requestId": "transfer_user-123_1704067200000",
    "userId": "user-123",
    "fromRegion": "eu-west-1",
    "toRegion": "us-east-1",
    "reason": "Business relocation",
    "status": "pending",
    "requestedAt": "2024-03-31T12:00:00Z"
  }
}
```

#### POST `/api/residency/transfer/approve/:requestId` *(Admin)*
Approve data transfer request.

**Response:**
```json
{
  "success": true,
  "transfer": {
    "requestId": "transfer_user-123_1704067200000",
    "status": "approved",
    "approvedBy": "admin-456"
  }
}
```

#### POST `/api/residency/transfer/execute/:requestId` *(Admin)*
Execute approved data transfer.

**Response:**
```json
{
  "success": true,
  "message": "Data transfer execution started",
  "requestId": "transfer_user-123_1704067200000"
}
```

### Encryption Key Management

#### POST `/api/residency/rotate-keys`
Rotate encryption keys (required for compliance).

**Response:**
```json
{
  "success": true,
  "newKeyId": "key_user-123_eu-west-1_1704067200000",
  "message": "Encryption keys rotated successfully"
}
```

### Monitoring

#### GET `/api/residency/compliance-frameworks`
Get compliance framework details.

**Response:**
```json
{
  "success": true,
  "frameworks": [
    {
      "name": "GDPR",
      "framework": "General Data Protection Regulation",
      "region": "eu-west-1",
      "requirements": [
        "Data subject rights enforcement",
        "Data processing agreements",
        "..."
      ],
      "auditFrequency": "quarterly"
    }
  ]
}
```

#### GET `/api/residency/volume/:region` *(Admin)*
Get data volume for specific region.

**Response:**
```json
{
  "success": true,
  "volume": {
    "region": "eu-west-1",
    "totalUsers": 542,
    "totalDataSize": 1073741824,
    "lastUpdated": "2024-03-31T23:59:59Z"
  }
}
```

## Usage Examples

### Signup Flow

```typescript
// 1. Show region selection screen
const regions = await fetch('/api/residency/regions').then(r => r.json());

// 2. User selects region
const residency = await fetch('/api/residency/select', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    region: 'eu-west-1',
    country: 'Germany'
  })
}).then(r => r.json());

// 3. Continue with account creation
```

### Access Case with Residency Validation

```typescript
// In request handler
export async function getCaseHandler(req: Request, res: Response) {
  // validateRegionalAccess middleware ensures regional compliance
  
  const caseId = req.params.id;
  const case = await getCaseFromDatabase(caseId);
  
  res.json(case);
}
```

### Generate Monthly Compliance Report

```typescript
import { generateComplianceReport } from './services/dataResidencyService';

const startDate = new Date('2024-03-01');
const endDate = new Date('2024-03-31');

const report = await generateComplianceReport(userId, startDate, endDate);

// Send to compliance officer
await sendEmail(complianceOfficer, 'compliance-report', report);
```

## Audit & Compliance

### Automatic Logging

All residency operations are logged:
- Region selection
- Cross-region access attempts
- Data transfer requests/approvals/executions
- Encryption key rotations
- Compliance report generation

### Compliance Reports

Reports include:
- Data access event count
- External access attempt count
- Data retention compliance
- Encryption status
- Violations and findings

### Export for Auditors

```bash
GET /api/residency/export

# Response: CSV file with all compliance events
```

## Security Considerations

1. **Encryption at Rest:** All data encrypted with region-specific keys
2. **Encryption in Transit:** TLS 1.3+ for all data transfers
3. **Key Rotation:** Automatic quarterly rotation for compliance
4. **Access Logging:** All data access logged with region tracking
5. **Transfer Restrictions:** Cross-region transfers blocked by default
6. **Admin Approval:** Data transfers require admin approval

## Troubleshooting

### User Blocked from Accessing Data

**Issue:** `Cross-region access blocked`

**Solution:**
1. Check user residency: `GET /api/residency/config`
2. Verify request origin region matches residency
3. Check `X-Region` header in request

### Data Transfer Stuck

**Issue:** Transfer status remains `in-progress`

**Solution:**
1. Check regional database connectivity
2. Verify data volume hasn't changed
3. Check for replication lag

### Compliance Report Errors

**Issue:** Report generation fails

**Solution:**
1. Verify audit logs exist in database
2. Check data retention policy compliance
3. Verify encryption keys are active

## Best Practices

1. **Show Region Info During Signup**
   - Display compliance requirements per region
   - Show data retention policies
   - Explain regulatory implications

2. **Regular Key Rotation**
   - Rotate keys quarterly minimum
   - Automate rotation for compliance
   - Maintain rotation audit trail

3. **Monitor Regional Volumes**
   - Track data growth per region
   - Plan capacity per region
   - Monitor transfer requests

4. **Regular Compliance Audits**
   - Generate monthly reports
   - Review cross-region access attempts
   - Verify encryption compliance

5. **Document All Transfers**
   - Require business justification
   - Obtain admin approval
   - Maintain audit trail

## Performance Considerations

- Regional encryption adds ~50ms latency per operation
- Cross-region validation adds ~10ms latency
- Compliance reports cached for 24 hours
- Data transfer progress checked every 5 seconds

## Future Enhancements

1. Multi-region failover with data residency maintenance
2. Automated compliance report scheduling
3. Regional disaster recovery strategies
4. Blockchain audit trail for immutability
5. AI-powered compliance violation detection
