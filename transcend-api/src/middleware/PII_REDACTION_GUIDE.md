# PII Redaction Middleware Guide

## Overview

The PII Redaction Middleware provides automatic detection and redaction of sensitive personally identifiable information (PII) across your application's logs, requests, and responses.

## Features

- **Auto-Detection**: Automatically detects common PII patterns:
  - Social Security Numbers (XXX-XX-XXXX)
  - Credit Card Numbers (****-****-****-1234)
  - Passport Numbers
  - Bank Account Numbers
  - Phone Numbers (***-***-5555)
  - Email Addresses
  - Physical Addresses

- **Custom Patterns**: Define custom PII patterns for your specific needs
- **Audit Trail**: Complete audit log of all redactions with timestamps
- **Searchable Logs**: Store hashes of original data to enable searching without exposing PII
- **Console Interception**: Automatically redact console.log, console.error, console.warn
- **Non-Invasive**: Redact before logging without modifying original request/response body

## Installation & Setup

### 1. Basic Setup in Express App

```typescript
import express from 'express';
import { piiRedactionMiddleware, piiRedactionLoggingMiddleware, LogRedactor } from './middleware/piiRedaction';

const app = express();

// Apply PII redaction middleware early in your middleware stack
app.use(piiRedactionMiddleware({ enableResponseRedaction: true }));
app.use(piiRedactionLoggingMiddleware({ verbose: true }));

// Intercept console logs
const logRedactor = new LogRedactor();
logRedactor.interceptConsole();

// Your routes
app.post('/api/users', (req, res) => {
  // req.body will have PII redacted before reaching your handler
  res.json({ success: true });
});

app.listen(3000);
```

### 2. Custom PII Patterns

```typescript
import { redactionEngine } from './middleware/piiRedaction';

// Add custom pattern for driver's license numbers
redactionEngine.addCustomPattern({
  name: 'Driver License',
  regex: /\b[A-Z]{1,2}\d{5,8}\b/g,
  redactionFormat: '[DL_REDACTED]',
  dataType: 'custom',
});

// Add pattern for medical record numbers
redactionEngine.addCustomPattern({
  name: 'Medical Record',
  regex: /MR-\d{6,10}/g,
  redactionFormat: '[MED_RECORD_REDACTED]',
  dataType: 'custom',
});
```

### 3. Manual Redaction in Code

```typescript
import { redactionEngine } from './middleware/piiRedaction';

// Redact a single string
const result = redactionEngine.redact('My SSN is 123-45-6789');
console.log(result.redacted); // My SSN is XXX-XX-XXXX
console.log(result.redactionCount); // 1
console.log(result.detectedPii); // ['SSN']

// Redact an object
const userData = {
  name: 'John Doe',
  ssn: '123-45-6789',
  phone: '(555) 123-4567',
  address: '123 Main Street, Springfield, IL',
};

const redactedResult = redactionEngine.redactObject(userData);
console.log(redactedResult.redacted);
// {
//   name: 'John Doe',
//   ssn: 'XXX-XX-XXXX',
//   phone: '***-***-4567',
//   address: '[ADDRESS_REDACTED]'
// }
```

### 4. Audit Log Access

```typescript
import { redactionEngine } from './middleware/piiRedaction';

// Get all audit entries
const allEntries = redactionEngine.getAuditLog();

// Filter by user
const userEntries = redactionEngine.getAuditLog({
  userId: 'user-123',
  startTime: new Date('2024-01-01'),
  endTime: new Date('2024-01-31'),
});

// Filter by PII type
const ssnRedactions = redactionEngine.getAuditLog({
  piiType: 'SSN',
});

console.log(userEntries);
// [
//   {
//     timestamp: '2024-01-15T10:30:00Z',
//     piiType: 'SSN,Phone',
//     hash: 'abc123...',
//     path: '/api/register',
//     method: 'POST',
//     userId: 'user-123',
//     redactionCount: 2
//   }
// ]
```

### 5. Searchable Logs

```typescript
import { redactionEngine } from './middleware/piiRedaction';
import crypto from 'crypto';

// When you want to search for a specific user's data:
const originalData = '123-45-6789';
const hash = crypto.createHash('sha256').update(originalData).digest('hex');

// Retrieve the redacted log entry
const logEntry = redactionEngine.searchLogs(hash);
console.log(logEntry);
// {
//   originalHash: 'abc123...',
//   redactedContent: 'XXX-XX-XXXX',
//   timestamp: '2024-01-15T10:30:00Z'
// }
```

### 6. Statistics & Monitoring

```typescript
import { getPiiRedactionStats } from './middleware/piiRedaction';

const stats = getPiiRedactionStats();
console.log(stats);
// {
//   totalRedactions: 1523,
//   totalAuditEntries: 456,
//   searchableLogs: 456,
//   piiTypes: {
//     'SSN': 234,
//     'Phone Number': 189,
//     'Credit Card': 45,
//     'Email': 233,
//     'Address': 156,
//     'Passport': 8,
//     'Bank Account': 12
//   }
// }
```

### 7. Export Audit Logs

```typescript
import { exportAuditLog } from './middleware/piiRedaction';

// Export all logs
const allLogs = exportAuditLog();

// Export with filters
const filteredLogs = exportAuditLog({
  userId: 'user-123',
  piiType: 'SSN',
  startTime: new Date('2024-01-01'),
  endTime: new Date('2024-01-31'),
});

// Save to file
const fs = require('fs');
fs.writeFileSync('audit_logs.json', filteredLogs);
```

### 8. With Winston Logger

```typescript
import winston from 'winston';
import { LogRedactor, redactionEngine } from './middleware/piiRedaction';

const logRedactor = new LogRedactor(redactionEngine);

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'transcend-api' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Add custom format to redact before logging
const redactedFormat = winston.format((info) => {
  if (typeof info.message === 'string') {
    info.message = logRedactor.redactLog(info.message);
  }
  return info;
});

logger.format = winston.format.combine(
  redactedFormat(),
  winston.format.json()
);

// Usage
logger.info('User registered: SSN=123-45-6789'); // Logs: User registered: SSN=XXX-XX-XXXX
```

### 9. Cleanup & Maintenance

```typescript
import { redactionEngine } from './middleware/piiRedaction';

// Clear audit logs (monthly cleanup)
redactionEngine.clearAuditLog();

// Clear searchable logs
redactionEngine.clearSearchableLogs();

// Get current stats before cleanup
const stats = redactionEngine.getStats();
console.log(`Clearing ${stats.totalAuditEntries} audit entries`);
redactionEngine.clearAuditLog();
```

### 10. Advanced: Compliance Reporting

```typescript
import { redactionEngine, exportAuditLog } from './middleware/piiRedaction';
import fs from 'fs';

// Generate compliance report
const today = new Date();
const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

const monthlyReport = {
  period: {
    start: startOfMonth.toISOString(),
    end: today.toISOString(),
  },
  stats: redactionEngine.getStats(),
  auditLog: redactionEngine.getAuditLog({
    startTime: startOfMonth,
    endTime: today,
  }),
};

fs.writeFileSync(
  `compliance_report_${today.toISOString().split('T')[0]}.json`,
  JSON.stringify(monthlyReport, null, 2)
);
```

## API Reference

### PiiRedactionEngine

#### Methods

**`redact(content: string, context?: object)`**
- Redacts a single string value
- Returns: `{ redacted: string, redactionCount: number, detectedPii: string[] }`

**`redactObject(obj: any, context?: object)`**
- Recursively redacts an object
- Returns: `{ redacted: any, totalRedactions: number, detectedPii: string[] }`

**`addCustomPattern(pattern: PiiPattern)`**
- Adds a custom PII pattern

**`removeCustomPattern(name: string)`**
- Removes a custom pattern by name

**`getAuditLog(filter?: object)`**
- Returns audit log entries, optionally filtered

**`searchLogs(hash: string)`**
- Searches for a log entry by hash

**`getStats()`**
- Returns redaction statistics

**`clearAuditLog()`**
- Clears all audit log entries

**`clearSearchableLogs()`**
- Clears all searchable log entries

### LogRedactor

#### Methods

**`interceptConsole()`**
- Overrides console.log, console.error, console.warn to auto-redact

**`restoreConsole()`**
- Restores original console methods

**`redactLog(message: string, context?: object)`**
- Manually redacts a log message

## Default Redaction Formats

| PII Type | Format | Example |
|----------|--------|---------|
| SSN | XXX-XX-XXXX | 123-45-6789 → XXX-XX-XXXX |
| Credit Card | ****-****-****-[LAST4] | 4111-1111-1111-1111 → ****-****-****-1111 |
| Phone | ***-***-[LAST4] | (555) 123-4567 → ***-***-4567 |
| Passport | [PASSPORT_REDACTED] | AB123456 → [PASSPORT_REDACTED] |
| Bank Account | [ACCOUNT_REDACTED] | 987654321 → [ACCOUNT_REDACTED] |
| Address | [ADDRESS_REDACTED] | 123 Main St → [ADDRESS_REDACTED] |
| Email | [EMAIL_REDACTED] | user@example.com → [EMAIL_REDACTED] |

## Performance Considerations

- **Pattern Matching**: Regex patterns are cached and reused
- **Audit Log Size**: Limited to 10,000 entries to prevent memory bloat
- **Searchable Logs**: Uses in-memory Map for O(1) lookups
- **Non-Blocking**: Redaction runs synchronously but is optimized for performance

## Security Best Practices

1. **Never Log Unhashed PII**: Always use the audit trail for compliance
2. **Secure Audit Storage**: Store audit logs in secure, encrypted storage
3. **Access Control**: Restrict access to audit logs to authorized personnel
4. **Regular Review**: Audit logs should be reviewed regularly for compliance
5. **Retention Policy**: Define and enforce audit log retention policies
6. **Compliance**: Ensure redaction meets GDPR, HIPAA, CCPA requirements

## Troubleshooting

### Pattern Not Matching

```typescript
// Test regex pattern
const testPattern = /\b(\d{3}[-]?\d{2}[-]?\d{4})\b/g;
const testString = 'SSN: 123-45-6789';
console.log(testString.match(testPattern)); // ['123-45-6789']
```

### Console Interception Not Working

```typescript
// Make sure to call interceptConsole() after logger initialization
const logRedactor = new LogRedactor();
logRedactor.interceptConsole(); // Must be called before logging starts
```

### Audit Log Growing Too Large

```typescript
// Clear old entries periodically
const stats = redactionEngine.getStats();
if (stats.totalAuditEntries > 8000) {
  redactionEngine.clearAuditLog();
}
```

## Examples

See `/transcend-api/examples/piiRedaction.example.ts` for complete working examples.
