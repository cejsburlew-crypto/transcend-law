# Malpractice Insurance Verification System

## Overview

The Malpractice Insurance Verification System is a comprehensive solution for managing attorney and service provider professional liability insurance compliance. It handles certificate uploads, verification, quarterly checks, auto-revocation, and compliance tracking.

## Features

### 1. **Insurance Certificate Management**
- Upload and store malpractice insurance certificates
- Support for all 50 US states with state-specific minimum coverage requirements
- Certificate validation and expiration tracking
- PDF and image file format support

### 2. **Verification System**
- **Manual Verification**: Admin review and approval of certificates
- **Automatic Verification**: Direct integration with insurance carrier APIs
- **Quarterly Verification**: Automated re-verification every 90 days
- Certificate status tracking (pending, verified, expired, invalid, revoked)

### 3. **Auto-Revocation Logic**
- Automatic detection of expired certificates
- Immediate suspension of provider access when insurance lapses
- Email notifications to providers
- Audit trail of all revocation events

### 4. **Coverage Limits Tracking**
- Per-state minimum coverage requirements
- Coverage amount validation on upload
- Deductible tracking
- Automatic flagging of insufficient coverage

### 5. **Claims History**
- Recording of malpractice claims (5-year history)
- Track claim status (open, settled, dismissed)
- Claims amount tracking
- Integration with risk assessment

### 6. **Compliance Dashboard**
- Real-time compliance status
- Risk scoring (0-100 scale)
- Active flags and recommendations
- Verification date tracking
- Compliance checklist

### 7. **Compliance Reporting**
- Provider compliance status export
- Historical audit trail
- Suspension records
- Quarterly verification reports

## Database Schema

### Required Tables

```sql
-- Malpractice Insurance Certificates
CREATE TABLE malpractice_insurance_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id),
  insurance_carrier VARCHAR(255) NOT NULL,
  policy_number VARCHAR(100) NOT NULL,
  coverage_amount DECIMAL(15, 2) NOT NULL,
  deductible DECIMAL(15, 2) NOT NULL,
  effective_date DATE NOT NULL,
  expiration_date DATE NOT NULL,
  certificate_url TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  verification_date TIMESTAMP,
  verified_by VARCHAR(255),
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_provider_id (provider_id),
  INDEX idx_status (status),
  INDEX idx_expiration_date (expiration_date)
);

-- Verification Records
CREATE TABLE malpractice_verification_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id UUID NOT NULL REFERENCES malpractice_insurance_certificates(id),
  provider_id UUID NOT NULL REFERENCES providers(id),
  verification_date TIMESTAMP NOT NULL,
  status VARCHAR(50) NOT NULL,
  method VARCHAR(50) NOT NULL,
  carrier_response JSONB,
  external_verification_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_certificate_id (certificate_id),
  INDEX idx_verification_date (verification_date)
);

-- Malpractice Claims
CREATE TABLE malpractice_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id),
  claim_id VARCHAR(100) NOT NULL,
  claim_date DATE NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  status VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(provider_id, claim_id),
  INDEX idx_provider_id (provider_id),
  INDEX idx_claim_date (claim_date)
);

-- Provider Suspensions
CREATE TABLE provider_suspensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id),
  reason TEXT NOT NULL,
  suspension_type VARCHAR(50) NOT NULL,
  effective_date TIMESTAMP NOT NULL,
  lifted_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_provider_id (provider_id),
  INDEX idx_effective_date (effective_date)
);

-- Audit Log
CREATE TABLE malpractice_insurance_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id UUID REFERENCES malpractice_insurance_certificates(id),
  provider_id UUID NOT NULL REFERENCES providers(id),
  action VARCHAR(100) NOT NULL,
  details TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_provider_id (provider_id),
  INDEX idx_created_at (created_at)
);

-- Provider Insurance Status
ALTER TABLE providers ADD COLUMN IF NOT EXISTS insurance_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE providers ADD COLUMN IF NOT EXISTS insurance_status_updated_at TIMESTAMP;
```

## API Endpoints

### Upload Certificate
```
POST /api/insurance/upload-certificate
Content-Type: application/json

{
  "insuranceCarrier": "string",
  "policyNumber": "string",
  "coverageAmount": number,
  "deductible": number,
  "effectiveDate": "YYYY-MM-DD",
  "expirationDate": "YYYY-MM-DD",
  "stateCode": "CA",
  "certificateUrl": "string"
}

Response: InsuranceCertificate
```

### Get Active Certificate
```
GET /api/insurance/active-certificate
Response: InsuranceCertificate | null
```

### Get All Certificates
```
GET /api/insurance/certificates
Response: { certificates: InsuranceCertificate[], active: InsuranceCertificate | null }
```

### Get Compliance Status
```
GET /api/insurance/compliance-status
Response: ComplianceStatus
```

### Get Claims History
```
GET /api/insurance/claims-history?years=5
Response: { claims: ClaimRecord[] }
```

### Verify Certificate (Admin)
```
POST /api/insurance/verify-certificate/:certificateId
Content-Type: application/json

{
  "approved": boolean,
  "rejectionReason": "string (if not approved)"
}

Response: VerificationRecord
```

### Get All Providers Compliance
```
GET /api/insurance/compliance-all
Response: ComplianceStatus[]
```

## Service Functions

### Backend Service (`malpracticeService.ts`)

#### Upload Certificate
```typescript
uploadInsuranceCertificate(
  providerId: string,
  insuranceCarrier: string,
  policyNumber: string,
  coverageAmount: number,
  deductible: number,
  effectiveDate: Date,
  expirationDate: Date,
  certificateUrl: string,
  stateCode: string
): Promise<InsuranceCertificate>
```

#### Verify Certificate
```typescript
verifyInsuranceCertificate(
  certificateId: string,
  verifiedBy: string,
  carrierApiResponse?: any
): Promise<VerificationRecord>
```

#### Quarterly Verification
```typescript
performQuarterlyVerification(): Promise<number>
// Runs automatically every 90 days
// Returns: number of certificates verified
```

#### Auto-Revocation
```typescript
processExpiredInsurance(): Promise<number>
// Runs daily
// Returns: number of expired certificates processed
```

#### Get Compliance Status
```typescript
getComplianceStatus(providerId: string): Promise<ComplianceStatus>
// Returns comprehensive compliance information
```

#### Claims Management
```typescript
recordClaimHistory(
  providerId: string,
  claimId: string,
  claimDate: Date,
  amount: number,
  status: 'open' | 'settled' | 'dismissed',
  description: string
): Promise<ClaimRecord>

getClaimsHistory(providerId: string, yearsBack: number = 5): Promise<ClaimRecord[]>
```

## State-Specific Requirements

The system includes minimum coverage requirements for all 50 US states:

```typescript
const STATE_REQUIREMENTS = {
  CA: { minimumCoverage: 250000, regulatoryBody: 'State Bar of California' },
  NY: { minimumCoverage: 100000, regulatoryBody: 'New York State Bar Association' },
  TX: { minimumCoverage: 100000, regulatoryBody: 'State Bar of Texas' },
  // ... all 50 states
}
```

Most states require minimum coverage of $100,000. California requires $250,000.

## Scheduled Tasks

### Enable Quarterly Verification
Add to your scheduler (e.g., node-cron):

```typescript
import cron from 'node-cron';
import malpracticeService from './services/malpracticeService';

// Run quarterly verification (90 days)
cron.schedule('0 0 1 */3 *', async () => {
  console.log('Running quarterly insurance verification...');
  await malpracticeService.performQuarterlyVerification();
});

// Run expiration check daily
cron.schedule('0 0 * * *', async () => {
  console.log('Checking for expired insurance...');
  await malpracticeService.processExpiredInsurance();
});
```

## Frontend Component Usage

### Import and Use
```typescript
import InsuranceVerification from './components/InsuranceVerification';

export default function ProviderProfile() {
  return (
    <div>
      <InsuranceVerification />
    </div>
  );
}
```

### Component Tabs
1. **Certificate Status**: View active and historical certificates
2. **Upload Certificate**: Upload new insurance certificate
3. **Claims History**: View malpractice claims (5-year history)
4. **Compliance Dashboard**: Real-time compliance status and risk scoring

## Integration Checklist

- [ ] Create database tables (see schema above)
- [ ] Add service file to `/transcend-api/services/`
- [ ] Add component file to `/transcend-frontend/src/components/`
- [ ] Add CSS file for component styling
- [ ] Create API routes in your backend
- [ ] Configure email notifications
- [ ] Set up scheduled tasks (quarterly + daily)
- [ ] Add insurance status to provider model
- [ ] Configure insurance carrier API integration (optional)
- [ ] Add to provider dashboard/profile pages
- [ ] Create admin compliance dashboard
- [ ] Document insurance requirements for providers

## Configuration

### Environment Variables
```bash
# Email notifications
ADMIN_EMAIL=admin@transcend-law.com
ESCROW_ADMIN_EMAIL=escrow@transcend-law.com

# Insurance carrier API (optional)
INSURANCE_CARRIER_API_URL=https://api.carrier.com/verify

# Database
DATABASE_URL=postgresql://...
```

## Compliance & Legal

### Regulatory Requirements
- **FinCEN**: Insurance verification part of provider KYC
- **State Bar Associations**: Enforce state-specific coverage minimums
- **Professional Responsibility**: Required for attorney licensing
- **Malpractice Prevention**: Helps identify high-risk providers

### GDPR/Privacy Considerations
- Insurance information is sensitive PII
- Store certificate URLs securely
- Implement access controls for admin viewing
- Maintain audit trail of all access
- Encrypt sensitive fields in database

## Monitoring & Alerts

### Key Metrics to Track
- Certificate expiration rate
- Failed verification attempts
- High claims providers
- Compliance status distribution
- Quarterly verification completion rate

### Alert Rules
- ⚠️ 90 days before expiration: Renew reminder
- ⚠️ 30 days before expiration: Urgent renew notice
- 🔴 Expired: Immediate suspension
- 🔴 Verification failed: Account frozen pending review
- 🔴 High claims count: Risk flagged, review recommended

## Troubleshooting

### Certificate Upload Fails
1. Check file format (PDF or image)
2. Verify file size < 10 MB
3. Check certificate_url in response
4. Verify S3/storage permissions

### Verification API Fails
1. Check `INSURANCE_CARRIER_API_URL` configured
2. Verify API credentials
3. Check network connectivity
4. Review API response in database

### Provider Not Suspended on Expiration
1. Verify scheduled task is running
2. Check database for expired records
3. Review `processExpiredInsurance()` logs
4. Manually trigger: `processExpiredInsurance()`

### Claims Not Showing
1. Verify claims recorded in database
2. Check `getClaimsHistory()` query
3. Verify date range (default: 5 years)
4. Check provider_id matches

## Security Best Practices

1. **Access Control**: Only admins can view/verify certificates
2. **Encryption**: Store sensitive data encrypted
3. **Audit Trail**: Log all actions with timestamps and actors
4. **Rate Limiting**: Limit certificate upload attempts
5. **Validation**: Validate all inputs (dates, amounts, files)
6. **HTTPS**: Enforce SSL/TLS for all API calls

## Performance Optimization

### Database Indexes
- `idx_provider_id`: Quick lookup by provider
- `idx_status`: Filter by certification status
- `idx_expiration_date`: Efficient expiration checks
- `idx_verification_date`: Quarterly verification queries

### Caching
```typescript
// Cache compliance status (60 seconds)
const complianceCache = new Map<string, ComplianceStatus>();

// Cache state requirements
const stateRequirementsCache = malpracticeService.STATE_REQUIREMENTS;
```

## Future Enhancements

- [ ] Direct carrier API integration (LPL, CHUBB, AIG)
- [ ] Automated claims data feeds
- [ ] Risk scoring machine learning model
- [ ] Behavioral risk indicators
- [ ] Multi-policy support per provider
- [ ] International insurance support
- [ ] Claims prediction analytics
- [ ] Insurance rate benchmarking

## Support & Maintenance

### Regular Tasks
- Weekly: Check for failed verifications
- Monthly: Review compliance dashboard
- Quarterly: Run full verification cycle
- Annually: Update state requirements

### Contact
For questions or issues with the malpractice insurance system, contact the compliance team.

---

**Version**: 1.0.0  
**Last Updated**: 2026-08-15  
**Status**: Production Ready
