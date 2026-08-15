# Security Scan System Setup Guide

## Overview

The Security Scan System provides comprehensive threat detection, reporting, and isolation capabilities for the Transcend Law platform. It integrates with industry-leading security services to detect malware, phishing, and suspicious content.

## Architecture

### Components

1. **Threat Scan Service** (`threatScanService.ts`)
   - Core threat detection engine
   - Integration with external security APIs
   - Threat classification and risk assessment
   - Isolation and quarantine mechanisms

2. **External APIs**
   - **Google Safe Browsing**: URL threat detection
   - **VirusTotal**: File hash analysis and malware detection
   - **AWS Inspector**: Infrastructure vulnerability scanning

3. **Database Schema**
   - Threat reports storage
   - Error tracking and logging
   - Isolation records
   - API status monitoring

4. **Alert System**
   - Email notifications for critical threats
   - Audit trail of all security events
   - Real-time threat isolation

## Prerequisites

### Required Environment Variables

```bash
# Google Safe Browsing API
GOOGLE_SAFE_BROWSING_API_KEY=your-api-key-here

# VirusTotal API
VIRUSTOTAL_API_KEY=your-api-key-here

# AWS Credentials
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1

# Security Configuration
SECURITY_ALERT_EMAIL=security@transcend-law.com
THREAT_ISOLATION_BUCKET=transcend-isolated-threats
NODE_ENV=production
```

### Required AWS S3 Bucket

Create an S3 bucket for threat isolation:

```bash
aws s3 mb s3://transcend-isolated-threats --region us-east-1

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket transcend-isolated-threats \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'

# Block public access
aws s3api put-public-access-block \
  --bucket transcend-isolated-threats \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Enable versioning for audit trail
aws s3api put-bucket-versioning \
  --bucket transcend-isolated-threats \
  --versioning-configuration Status=Enabled
```

## Setup Instructions

### 1. Database Setup

Run the migration to create required tables:

```bash
# Navigate to project root
cd /Users/jbconsultingassociatesinc./code/transcend-ssp

# Run migration
npm run migrate:up -- transcend-api/migrations/005-threat-scan-tables.sql

# Verify tables created
npm run db:query -- "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='transcend' LIKE 'threat%'"
```

### 2. API Configuration

#### Google Safe Browsing API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Safe Browsing API
4. Create API key (Credentials → Create Credentials → API Key)
5. Add to `.env`:
   ```
   GOOGLE_SAFE_BROWSING_API_KEY=AIza...
   ```

#### VirusTotal API

1. Visit [VirusTotal](https://www.virustotal.com/)
2. Sign up for account
3. Go to Settings → API key
4. Copy API key
5. Add to `.env`:
   ```
   VIRUSTOTAL_API_KEY=<your-key>
   ```

#### AWS Configuration

```bash
# Configure AWS credentials
aws configure

# Verify credentials
aws sts get-caller-identity

# Create IAM policy for threat scanning
cat > threatScanPolicy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::transcend-isolated-threats/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "inspector:DescribeFindings",
        "inspector:ListFindings"
      ],
      "Resource": "*"
    }
  ]
}
EOF

# Apply policy
aws iam put-user-policy --user-name <username> --policy-name ThreatScanPolicy --policy-document file://threatScanPolicy.json
```

### 3. Email Configuration

Configure email alerts for critical threats:

```bash
# Add to .env
SECURITY_ALERT_EMAIL=security@transcend-law.com
SMTP_HOST=mail.example.com
SMTP_PORT=587
SMTP_USER=alerts@transcend-law.com
SMTP_PASS=password
```

### 4. Install Dependencies

```bash
# Install required packages
npm install axios aws-sdk

# Verify installation
npm list axios aws-sdk
```

## Running Tests

### Execute Full Test Suite

```bash
# Navigate to project root
cd /Users/jbconsultingassociatesinc./code/transcend-ssp

# Run test runner
npx ts-node scripts/test-security-scan.ts

# Expected output:
# SECURITY SCAN SYSTEM - FINAL TEST REPORT
# - Threat Detection: X/X passed
# - External API Integration: X/X passed
# - Threat Isolation: X/X passed
# - Error Reporting & Handling: X/X passed
# - System Scanning & Reporting: X/X passed
# - Security Compliance: X/X passed
```

### Run Specific Test Suite

```bash
# Run Jest tests
npm test -- threatScanService.test.ts

# Generate coverage report
npm test -- threatScanService.test.ts --coverage

# Watch mode
npm test -- threatScanService.test.ts --watch
```

## Usage Examples

### Scan URL for Threats

```typescript
import { scanUrl } from './services/threatScanService';

const report = await scanUrl('https://example.com');

console.log(report);
// Output:
// {
//   id: 'url-1692...',
//   resourceId: 'https://example.com',
//   resourceType: 'url',
//   threatLevel: 'medium',
//   detectedThreats: [...],
//   isolated: false,
//   status: 'scanned'
// }
```

### Scan File Hash

```typescript
import { scanFileHash } from './services/threatScanService';

const report = await scanFileHash('a1b2c3d4e5f6...');

console.log(report);
// Output:
// {
//   id: 'file-1692...',
//   resourceId: 'a1b2c3d4e5f6...',
//   resourceType: 'file',
//   threatLevel: 'critical',
//   detectedThreats: [...],
//   isolated: true,
//   isolationReason: 'Critical threat detected'
// }
```

### Get Threat Reports

```typescript
import { getThreatReports } from './services/threatScanService';

// Get all critical threats
const critical = await getThreatReports({ 
  threatLevel: 'critical',
  limit: 50 
});

// Get isolated items
const isolated = await getThreatReports({ 
  status: 'isolated',
  limit: 100 
});
```

### Generate Security Report

```typescript
import { generateSecurityReport, performSystemScan } from './services/threatScanService';

// Get statistics
const stats = await performSystemScan();
console.log(stats);
// {
//   totalScans: 1234,
//   threatsDetected: 45,
//   itemsIsolated: 12,
//   errors: 2
// }

// Generate detailed report
const report = await generateSecurityReport();
console.log(report);
```

## Error Handling

### Retry Logic

The system automatically retries transient failures:

- **Retryable Errors**: 500, 429, timeout, network errors
- **Non-Retryable**: 401, 403, 404
- **Max Retries**: 3
- **Backoff**: Exponential with jitter

### Error Monitoring

View recent errors:

```typescript
import { getScanErrors } from './services/threatScanService';

const errors = await getScanErrors(50);
errors.forEach(error => {
  console.log(`[${error.service}] ${error.error}`);
  console.log(`  Retryable: ${error.retryable}`);
  console.log(`  Retry Count: ${error.retryCount}`);
});
```

## Security Best Practices

### 1. API Key Management

- **Never commit API keys** to version control
- **Use environment variables** for all credentials
- **Rotate keys regularly** (every 90 days)
- **Monitor API usage** for unusual patterns

### 2. Data Privacy

- **Encrypt all sensitive data** at rest and in transit
- **Use TLS 1.2+** for all API communications
- **Implement access controls** on isolated threat bucket
- **Maintain audit logs** of all security events

### 3. Threat Isolation

- **Automatic isolation** of critical threats
- **Encrypted storage** in isolated S3 bucket
- **Restricted access** to isolated items
- **Retention policies** for old threats (default: 90 days)

### 4. Monitoring & Alerting

- **Real-time alerts** for critical threats
- **Daily summary reports** of security activity
- **API health monitoring** with automatic failover
- **Error tracking** with retry analysis

## Performance Tuning

### Database Optimization

```sql
-- Create indexes for frequently queried columns
CREATE INDEX idx_threat_level ON threat_reports(threat_level);
CREATE INDEX idx_scan_date ON threat_reports(scan_date DESC);
CREATE INDEX idx_isolated ON threat_reports(isolated);

-- Analyze table statistics
ANALYZE threat_reports;
ANALYZE scan_errors;
```

### Caching Strategy

```typescript
// Implement caching for API responses
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 3600000; // 1 hour

function getCachedReport(resourceId: string) {
  const cached = cache.get(resourceId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}
```

### Parallel Processing

```typescript
// Process multiple scans concurrently
const urls = [...]; // array of URLs
const reports = await Promise.all(
  urls.map(url => scanUrl(url))
);
```

## Troubleshooting

### Issue: "API key not configured"

**Solution**: Verify environment variables are set
```bash
echo $GOOGLE_SAFE_BROWSING_API_KEY
echo $VIRUSTOTAL_API_KEY
```

### Issue: "S3 bucket access denied"

**Solution**: Verify AWS credentials and bucket permissions
```bash
aws s3 ls s3://transcend-isolated-threats/
aws iam get-user-policy --user-name <username> --policy-name ThreatScanPolicy
```

### Issue: "Database connection failed"

**Solution**: Check database status and migration
```bash
npm run db:status
npm run migrate:status
```

### Issue: "High error rate on API calls"

**Solution**: Check API status and rate limits
```bash
# View recent errors
npm run db:query -- "SELECT * FROM scan_errors ORDER BY created_at DESC LIMIT 20"

# Check API health
npm run db:query -- "SELECT * FROM external_api_status"
```

## Compliance & Auditing

### Audit Logging

All security events are logged in the database:

```sql
SELECT * FROM threat_reports;
SELECT * FROM scan_errors;
SELECT * FROM threat_isolation_log;
SELECT * FROM threat_alert_history;
```

### Compliance Reports

Generate compliance reports:

```typescript
import { generateSecurityReport } from './services/threatScanService';

const report = await generateSecurityReport();
// Save to file for compliance records
fs.writeFileSync(`security-report-${date}.txt`, report);
```

### Data Retention

- **Threat reports**: 90 days
- **Scan errors**: 30 days
- **Isolation logs**: 90 days
- **API status**: 7 days

## Support & Escalation

### Critical Issues

If critical threats are detected:

1. Email alert sent to `SECURITY_ALERT_EMAIL`
2. Threat automatically isolated
3. Resource ID and threat details logged
4. Escalate to security team immediately

### API Integration Issues

For API failures or rate limiting:

1. Check external API status dashboard
2. Review error logs in `scan_errors` table
3. Contact API provider support
4. Implement temporary throttling if needed

## Maintenance

### Regular Tasks

```bash
# Daily: Review critical threats
npm run db:query -- "SELECT * FROM critical_threats_view LIMIT 10"

# Weekly: Check API health
npm run db:query -- "SELECT * FROM external_api_status"

# Monthly: Archive old threats
npm run db:exec -- "CALL archive_old_threats(90)"

# Quarterly: Rotate API keys
# - Generate new keys in API provider dashboards
# - Update environment variables
# - Test before full rollout
# - Revoke old keys
```

## References

- [Google Safe Browsing API Docs](https://developers.google.com/safe-browsing)
- [VirusTotal API Documentation](https://developers.virustotal.com/)
- [AWS Inspector Documentation](https://docs.aws.amazon.com/inspector/)
- [OWASP Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
