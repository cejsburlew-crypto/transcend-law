# Bulk Operations Service - Implementation Guide

## Overview

The Bulk Operations Service provides enterprise-grade CSV import/export capabilities with comprehensive validation, error reporting, dry-run mode, progress tracking, and job scheduling.

## Features

### 1. CSV Import with Validation
- **Template-Based Validation**: Pre-defined schemas for users, attorneys, cases, services
- **Field Type Checking**: email, phone, number, date, boolean, enum, string
- **Custom Validators**: Support for complex validation logic
- **Duplicate Detection**: Identify duplicate rows in CSV
- **Batch Processing**: Process large files in configurable batches (default 100 rows)

### 2. Bulk Operations
- **Create**: Insert new records from CSV
- **Update**: Modify existing records
- **Delete**: Remove records in bulk
- **Dry-Run Mode**: Test operations without saving to database
- **Stop on Error**: Option to halt processing on first error

### 3. Error Reporting
- **Row-Level Errors**: Identify exactly which rows failed and why
- **Field-Level Details**: Know which field caused the error
- **Error Download**: Export detailed error reports as CSV
- **Severity Levels**: Distinguish between errors and warnings

### 4. Progress Tracking
- **Real-Time Updates**: WebSocket or polling for job progress
- **Performance Metrics**: Track success/failure rates
- **Job Queue**: Queue jobs when at max concurrent operations
- **Job History**: Maintain records of all bulk operations

### 5. Export Functionality
- **CSV Export**: Export data as CSV files
- **Format Support**: CSV, JSON, XLSX (extensible)
- **Filtered Export**: Apply filters to export subset of data
- **Field Selection**: Choose which fields to export

### 6. Template Management
- **Predefined Templates**: User, Attorney, Case, Service, Document
- **Custom Templates**: Register custom templates with validation rules
- **Template Download**: Download empty CSV templates with headers
- **Template Validation**: Validate data against template rules

### 7. Job Management
- **Async Processing**: Non-blocking job processing
- **Job Cancellation**: Cancel running jobs
- **Job Retry**: Retry failed jobs with exponential backoff
- **Job Cleanup**: Automatic cleanup of old completed jobs

## Architecture

### Backend Service Structure

```
transcend-api/services/bulkOperations.ts
├── BulkOperationsService (Main class)
├── Templates (Pre-configured schemas)
├── Validation Engine
├── Job Manager
└── Export Engine

transcend-api/routes/bulkOperations.ts
├── Import Endpoints
├── Export Endpoints
├── Job Status Endpoints
├── Template Endpoints
└── Cleanup Endpoints
```

### Frontend Component Structure

```
transcend-frontend/src/components/BulkImportWizard.tsx
├── Template Selection
├── File Upload (Drag & Drop)
├── Validation
├── Preview
├── Configuration
├── Processing
└── Results & Error Reporting
```

## API Endpoints

### Import Operations

#### POST `/api/bulk/import`
Create and process bulk import job
```bash
curl -X POST /api/bulk/import \
  -F "file=@data.csv" \
  -H "Authorization: Bearer TOKEN" \
  -G \
  --data-urlencode "template=user" \
  --data-urlencode "dryRun=true" \
  --data-urlencode "stopOnError=false"
```

**Query Parameters:**
- `template`: Template type (user, attorney, case, service)
- `dryRun`: Test without saving (true/false)
- `stopOnError`: Halt on first error (true/false)

**Response:**
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "totalRows": 1000,
  "dryRun": true,
  "validationErrorCount": 5,
  "warnings": []
}
```

#### POST `/api/bulk/import/validate`
Validate CSV without processing
```bash
curl -X POST /api/bulk/import/validate \
  -F "file=@data.csv" \
  -H "Authorization: Bearer TOKEN" \
  -G --data-urlencode "template=user"
```

**Response:**
```json
{
  "isValid": true,
  "totalRows": 1000,
  "validationErrors": [],
  "totalErrors": 0,
  "warnings": [],
  "summary": {
    "valid": 1000,
    "invalid": 0
  }
}
```

#### GET `/api/bulk/import/template/:templateName`
Download CSV template
```bash
curl -X GET /api/bulk/import/template/user \
  -H "Authorization: Bearer TOKEN" \
  -o template-user.csv
```

### Export Operations

#### POST `/api/bulk/export`
Export data as CSV
```bash
curl -X POST /api/bulk/export \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "template": "user",
    "format": "csv",
    "fields": ["email", "firstName", "lastName"],
    "filters": { "role": "attorney" }
  }'
```

### Job Management

#### GET `/api/bulk/jobs/:jobId`
Get job status
```bash
curl -X GET /api/bulk/jobs/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer TOKEN"
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Import users - data.csv",
  "type": "import",
  "status": "processing",
  "totalRows": 1000,
  "processedRows": 450,
  "failedRows": 5,
  "successRows": 445,
  "progress": 45,
  "dryRun": false,
  "startTime": "2024-01-15T10:00:00Z",
  "errors": [...],
  "warnings": [...]
}
```

#### GET `/api/bulk/jobs`
Get all jobs for user
```bash
curl -X GET /api/bulk/jobs \
  -H "Authorization: Bearer TOKEN"
```

#### POST `/api/bulk/jobs/:jobId/cancel`
Cancel running job
```bash
curl -X POST /api/bulk/jobs/550e8400-e29b-41d4-a716-446655440000/cancel \
  -H "Authorization: Bearer TOKEN"
```

#### POST `/api/bulk/jobs/:jobId/retry`
Retry failed job
```bash
curl -X POST /api/bulk/jobs/550e8400-e29b-41d4-a716-446655440000/retry \
  -H "Authorization: Bearer TOKEN"
```

#### DELETE `/api/bulk/jobs/:jobId`
Delete job (admin only)
```bash
curl -X DELETE /api/bulk/jobs/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer TOKEN"
```

### Template Management

#### GET `/api/bulk/templates`
Get all available templates
```bash
curl -X GET /api/bulk/templates \
  -H "Authorization: Bearer TOKEN"
```

**Response:**
```json
{
  "templates": [
    {
      "name": "user",
      "config": { ... }
    },
    {
      "name": "attorney",
      "config": { ... }
    }
  ]
}
```

#### POST `/api/bulk/cleanup`
Clean up old jobs (admin only)
```bash
curl -X POST /api/bulk/cleanup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{ "olderThanHours": 24 }'
```

## CSV Template Formats

### User Template
```csv
email*,firstName*,lastName*,phone,role
user1@example.com,John,Doe,+1-555-0100,user
user2@example.com,Jane,Smith,+1-555-0101,attorney
```

### Attorney Template
```csv
barNumber*,firstName*,lastName*,email*,specialties,yearsExperience,licenseState*
NY123456,John,Attorney,john@law.com,"Immigration, Tax",10,NY
CA789012,Jane,Lawyer,jane@law.com,Employment,15,CA
```

### Case Template
```csv
caseNumber*,clientEmail*,caseType*,filedDate,status*
CASE-001,client@example.com,Immigration,2024-01-15,open
CASE-002,another@example.com,Employment,2024-01-16,pending
```

### Service Template
```csv
name*,category*,description,price*,available
Legal Review,Legal,Document review service,250,true
Contract Drafting,Legal,Custom contract drafting,500,true
```

## Validation Rules

### Field Types

1. **Email**: Validates RFC 5322 compliant email addresses
2. **Phone**: Validates phone numbers with optional country codes
3. **Number**: Validates numeric values with decimal support
4. **Date**: Validates ISO 8601 date formats
5. **Boolean**: Accepts true/false, yes/no, 1/0
6. **String**: Validates string length constraints
7. **Enum**: Validates against predefined list of values

### Validation Example

```typescript
const validationRules = [
  {
    field: 'email',
    required: true,
    type: 'email',
    errorMessage: 'Invalid email address',
  },
  {
    field: 'yearsExperience',
    required: false,
    type: 'number',
    min: 0,
    max: 70,
  },
  {
    field: 'specialties',
    required: true,
    type: 'enum',
    enum: ['Immigration', 'Employment', 'Tax', 'Corporate'],
  },
];
```

## Integration Steps

### 1. Backend Integration

Add routes to Express server:

```typescript
import bulkOperationsRoutes from './routes/bulkOperations';

app.use('/api/bulk', bulkOperationsRoutes);
```

Add required dependencies to `package.json`:

```json
{
  "dependencies": {
    "papaparse": "^5.4.1",
    "uuid": "^9.0.0",
    "multer": "^1.4.5-lts.1"
  }
}
```

### 2. Frontend Integration

Import component in your admin dashboard:

```typescript
import BulkImportWizard from './components/BulkImportWizard';

export default function AdminDashboard() {
  return (
    <div>
      <BulkImportWizard />
    </div>
  );
}
```

### 3. Database Integration

Implement data handlers for each template type:

```typescript
async function processImportJob(
  jobId: string,
  data: Record<string, any>[],
  template: string,
  dryRun: boolean
): Promise<void> {
  const operationHandler = async (batch: Record<string, any>[]) => {
    // Insert/update batch in database based on template
    if (template === 'user') {
      return await createUsers(batch, dryRun);
    } else if (template === 'attorney') {
      return await createAttorneys(batch, dryRun);
    }
    // ... etc
  };

  await bulkOperationsService.processBulkImport(
    jobId,
    data,
    operationHandler,
    dryRun
  );
}
```

## Usage Examples

### Basic Import Flow

```typescript
// 1. Parse and validate CSV
const { data, validationErrors } = await bulkOperationsService.parseCSV(
  csvContent,
  'user'
);

if (validationErrors.length > 0) {
  // Show errors to user
  return;
}

// 2. Create job
const job = bulkOperationsService.createJob(
  'Import users',
  'import',
  userId,
  { dryRun: false }
);

// 3. Process import
await bulkOperationsService.processBulkImport(
  job.id,
  data,
  operationHandler,
  false
);

// 4. Monitor progress
job.on('progress', (progress) => {
  console.log(`Progress: ${progress}%`);
});
```

### Export Data

```typescript
// Fetch data
const data = await fetchData('user', { role: 'attorney' });

// Generate CSV
const csv = await bulkOperationsService.exportDataAsCSV(data, {
  template: 'user',
  format: 'csv',
  fields: ['email', 'firstName', 'lastName'],
  includeHeaders: true,
});

// Send to client
res.setHeader('Content-Type', 'text/csv');
res.send(csv);
```

### Custom Template

```typescript
// Register custom template
bulkOperationsService.registerTemplate('custom-entity', {
  template: 'custom-entity',
  validationRules: [
    {
      field: 'id',
      required: true,
      type: 'string',
      minLength: 1,
      maxLength: 50,
    },
    // ... more rules
  ],
  allowDuplicates: false,
  stopOnError: false,
  batchSize: 50,
  timeout: 30000,
  enableNotifications: true,
});
```

## Performance Considerations

### Batch Size
- **Default**: 100 rows per batch
- **Small Files** (< 1,000 rows): 100-200 rows
- **Large Files** (> 100,000 rows): 50-100 rows
- **Memory Constraints**: Adjust based on available memory

### Concurrency
- **Max Concurrent Jobs**: 5 (configurable)
- **Queue System**: Automatic queuing when limit reached
- **Timeout**: 30-45 seconds per batch (configurable)

### Database Performance
- **Connection Pooling**: Use connection pool for database
- **Index Optimization**: Index fields used in lookups
- **Transaction Batching**: Commit per batch, not per row

## Error Handling

### Validation Errors
Returned immediately during CSV validation phase:
```json
{
  "error": "CSV validation failed",
  "validationErrors": [
    {
      "rowNumber": 2,
      "field": "email",
      "error": "Invalid email address",
      "severity": "error"
    }
  ],
  "totalErrors": 1
}
```

### Processing Errors
Captured during import:
```json
{
  "id": "job-id",
  "status": "completed",
  "successRows": 95,
  "failedRows": 5,
  "errors": [
    {
      "rowNumber": 10,
      "error": "Duplicate email",
      "severity": "error"
    }
  ]
}
```

### Retry Logic
- Automatic retry with exponential backoff
- Max retries: 3 (configurable)
- Manual retry available for failed jobs

## Security Considerations

1. **Authentication**: All endpoints require authentication
2. **Authorization**: Admin endpoints protected with `authorizeAdmin`
3. **File Upload**: Size limit 50MB, CSV format only
4. **Data Validation**: All input validated before database operations
5. **Error Messages**: No sensitive data in error responses
6. **Rate Limiting**: Consider adding rate limiting for bulk endpoints

## Monitoring & Logging

### Job Events
```typescript
bulkOperationsService.on('job:created', (job) => {
  console.log(`Job created: ${job.id}`);
});

bulkOperationsService.on('job:started', (job) => {
  console.log(`Job started: ${job.id}`);
});

bulkOperationsService.on('job:progress', (event) => {
  console.log(`Progress: ${event.progress}%`);
});

bulkOperationsService.on('job:completed', (job) => {
  console.log(`Job completed: ${job.id}`);
});

bulkOperationsService.on('job:failed', ({ job, error }) => {
  console.error(`Job failed: ${job.id} - ${error}`);
});
```

### Metrics to Track
- Total jobs processed
- Average success rate
- Average processing time
- Error distribution by type
- Peak concurrent jobs
- Memory usage during processing

## Future Enhancements

1. **Scheduled Imports**: Schedule imports to run at specific times
2. **Webhook Notifications**: Notify external systems of job completion
3. **Progress Webhooks**: Real-time progress updates to external systems
4. **Import History**: Store detailed history of all imports
5. **Data Transformation**: Pre-process data with custom transformations
6. **Rollback Capability**: Undo completed imports
7. **Advanced Filtering**: More complex export filters
8. **Performance Optimization**: Parallel processing for very large files
9. **Data Mapping**: Map CSV columns to database fields
10. **Integration Templates**: Pre-configured integrations with popular tools

## Testing

### Unit Tests
```typescript
describe('BulkOperationsService', () => {
  it('should validate CSV correctly', async () => {
    const csv = 'email,name\ntest@example.com,John';
    const result = await service.parseCSV(csv, 'user');
    expect(result.validationErrors).toHaveLength(0);
  });

  it('should detect duplicate rows', async () => {
    // Test duplicate detection
  });

  it('should generate templates', () => {
    const template = service.generateTemplate('user');
    expect(template).toContain('email');
  });
});
```

### Integration Tests
```typescript
describe('Bulk Operations API', () => {
  it('should import CSV file', async () => {
    const response = await request(app)
      .post('/api/bulk/import')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', 'test.csv')
      .query({ template: 'user' });

    expect(response.status).toBe(200);
    expect(response.body.jobId).toBeDefined();
  });
});
```

## Support & Documentation

For questions or issues:
1. Check this guide for common scenarios
2. Review API endpoint documentation
3. Check error messages for specific issues
4. Consult with backend team for custom implementations

## License

Transcend Law Platform - All Rights Reserved
