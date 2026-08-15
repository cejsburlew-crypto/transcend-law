# Master Deployment System - Complete Implementation Guide

## Overview

The Master Deployment System is a comprehensive Express.js backend for managing application deployments, tracking activities, maintaining immutable audit records, and preventing unauthorized deletions.

## Architecture

### Components

1. **Deployment Routes** (`src/routes/deployment.ts`)
   - 10 RESTful endpoints for deployment management
   - Input validation and error handling
   - Authentication and authorization middleware

2. **Deployment Service** (`src/services/deploymentService.ts`)
   - Business logic for deployments, auditing, and document management
   - Cryptographic hashing for immutable records
   - Chain verification for audit trails

3. **Database Schema** (extensions to `src/database/schema.sql`)
   - `deployments` - Deployment request tracking
   - `activity_logs` - User activities with GPS coordinates
   - `immutable_documents` - Tamper-proof audit records
   - `deletion_attempts` - Deletion attempt tracking
   - `deployment_metrics_daily` - Metrics aggregation view

## Installation & Integration

### 1. Add Dependencies

```bash
npm install uuid crypto
npm install --save-dev @types/uuid
```

### 2. Update Main Express App

In `src/index.ts` or your main server file:

```typescript
import deploymentRouter from './routes/deployment';

// ... existing middleware setup ...

// Mount deployment routes
app.use('/api/admin', deploymentRouter);

// Initialize database (existing)
await initializeDatabase();
```

### 3. Database Migration

Run the schema extensions:

```bash
# Connect to your PostgreSQL database
psql -U transcend_admin -d transcend_law < transcend-api/src/database/schema.sql
```

Or use a migration tool to apply incrementally.

## API Endpoints

### 1. POST /api/admin/deployment-request
**Create a new deployment request**

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "environmentId": "production",
  "deploymentType": "feature",
  "description": "Deploy new user authentication module",
  "scheduledAt": "2026-08-15T14:30:00Z"
}
```

**Response (201):**
```json
{
  "success": true,
  "deployment": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "environment_id": "production",
    "deployment_type": "feature",
    "description": "Deploy new user authentication module",
    "status": "pending",
    "requested_by": "user-id",
    "scheduled_at": "2026-08-15T14:30:00.000Z",
    "created_at": "2026-08-15T10:00:00.000Z"
  }
}
```

**Error Responses:**
- `400`: Missing or invalid required fields
- `401`: Unauthorized
- `403`: Insufficient permissions

---

### 2. GET /api/admin/deployments
**Get all deployments with filters and pagination**

**Authentication:** Required (Admin only)

**Query Parameters:**
- `status` (optional): 'pending', 'approved', 'deploying', 'completed', 'failed', 'rolled_back'
- `environmentId` (optional): Filter by environment
- `limit` (optional): Default 20, max 100
- `offset` (optional): Default 0

**Example:**
```
GET /api/admin/deployments?status=completed&environmentId=production&limit=50&offset=0
```

**Response (200):**
```json
{
  "success": true,
  "deployments": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "environment_id": "production",
      "deployment_type": "feature",
      "status": "completed",
      "description": "Deploy new user authentication module",
      "completed_at": "2026-08-15T15:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

---

### 3. GET /api/admin/deployments/:id
**Get specific deployment with activity logs**

**Authentication:** Required (Admin only)

**Response (200):**
```json
{
  "success": true,
  "deployment": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "environment_id": "production",
    "deployment_type": "feature",
    "status": "completed",
    "description": "Deploy new user authentication module"
  },
  "activityLogs": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "action": "deployment_status_updated",
      "resource": "deployment",
      "changes": {
        "oldStatus": "pending",
        "newStatus": "completed"
      },
      "timestamp": "2026-08-15T15:00:00.000Z"
    }
  ]
}
```

---

### 4. PUT /api/admin/deployments/:id
**Update deployment status**

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "status": "completed",
  "errorMessage": null
}
```

**Valid Status Transitions:**
- `pending` → `approved` → `deploying` → `completed`
- `pending` → `approved` → `deploying` → `failed`
- `completed` → `rolled_back`

**Response (200):**
```json
{
  "success": true,
  "deployment": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "completed",
    "completed_at": "2026-08-15T15:00:00.000Z"
  }
}
```

---

### 5. POST /api/admin/activity-log
**Log user activities with GPS tracking**

**Authentication:** Required

**Request Body:**
```json
{
  "action": "data_export",
  "resource": "case",
  "resourceId": "case-uuid",
  "changes": {
    "format": "pdf",
    "pages": "1-5"
  },
  "gpsCoordinates": {
    "latitude": 40.7128,
    "longitude": -74.0060
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "activityLog": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "user_id": "user-uuid",
    "action": "data_export",
    "resource": "case",
    "resource_id": "case-uuid",
    "gps_coordinates": {
      "latitude": 40.7128,
      "longitude": -74.0060
    },
    "ip_address": "203.0.113.42",
    "timestamp": "2026-08-15T10:15:00.000Z"
  }
}
```

---

### 6. GET /api/admin/deployment-metrics
**Get deployment metrics and statistics**

**Authentication:** Required (Admin only)

**Query Parameters:**
- `days` (optional): Analyze last N days, default 30

**Response (200):**
```json
{
  "success": true,
  "metrics": {
    "period": "Last 30 days",
    "successRate": 94.55,
    "totalDeployments": 110,
    "completed": 104,
    "failed": 4,
    "rolledBack": 2,
    "averageDeploymentTimeSeconds": 1847,
    "byDeploymentType": [
      {
        "deployment_type": "feature",
        "count": 45,
        "successful": 44
      },
      {
        "deployment_type": "bugfix",
        "count": 50,
        "successful": 48
      },
      {
        "deployment_type": "hotfix",
        "count": 15,
        "successful": 12
      }
    ],
    "byEnvironment": [
      {
        "environment_id": "production",
        "count": 85,
        "successful": 82
      },
      {
        "environment_id": "staging",
        "count": 25,
        "successful": 22
      }
    ]
  }
}
```

---

### 7. POST /api/admin/immutable-documents
**Create immutable audit document**

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "documentType": "deployment_manifest",
  "content": {
    "version": "1.2.3",
    "deploymentId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-08-15T15:00:00Z",
    "changes": [
      {
        "file": "auth.ts",
        "lines": 245,
        "hash": "abc123def456"
      }
    ]
  },
  "previousDocumentId": "previous-doc-uuid"
}
```

**Response (201):**
```json
{
  "success": true,
  "immutableDocument": {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "document_type": "deployment_manifest",
    "hash": "sha256_hash_of_content",
    "previous_hash": "previous_sha256_hash",
    "immutable": true,
    "created_by": "admin-user-id",
    "created_at": "2026-08-15T15:00:00.000Z"
  }
}
```

---

### 8. GET /api/admin/immutable-documents/:id
**Retrieve and verify immutable document**

**Authentication:** Required

**Response (200):**
```json
{
  "success": true,
  "immutableDocument": {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "document_type": "deployment_manifest",
    "content": {
      "version": "1.2.3",
      "deploymentId": "550e8400-e29b-41d4-a716-446655440000"
    },
    "hash": "sha256_hash_of_content",
    "hashVerified": true,
    "immutable": true
  }
}
```

**Hash Verification:**
- The system automatically computes the SHA-256 hash of the document content
- Compares with stored hash to detect tampering
- Returns `hashVerified: true/false` in response

---

### 9. POST /api/admin/deletion-attempts
**Log and block deletion attempts**

**Authentication:** Required

**Request Body:**
```json
{
  "targetType": "case",
  "targetId": "case-uuid",
  "reason": "User requested case removal"
}
```

**Response (201 or 403):**
```json
{
  "success": false,
  "deletionAttempt": {
    "id": "990e8400-e29b-41d4-a716-446655440004",
    "target_type": "case",
    "target_id": "case-uuid",
    "attempted_by": "user-id",
    "reason": "User requested case removal",
    "timestamp": "2026-08-15T10:20:00.000Z",
    "blocked": true,
    "block_reason": "Insufficient permissions for deletion"
  },
  "message": "Deletion blocked - insufficient permissions"
}
```

**Deletion Rules:**
- Only admins can delete
- All attempts are logged regardless of permission
- Attempts are marked as "blocked" for audit trail
- No data is actually deleted; only attempt is recorded

---

### 10. POST /api/admin/rollback/:deploymentId
**Rollback deployment to previous version**

**Authentication:** Required (Admin only)

**Request Body:**
```json
{
  "reason": "Critical bug discovered in production"
}
```

**Response (200):**
```json
{
  "success": true,
  "rollback": {
    "id": "aa0e8400-e29b-41d4-a716-446655440005",
    "environment_id": "production",
    "deployment_type": "rollback",
    "status": "completed",
    "description": "Rollback: Critical bug discovered in production",
    "rollback_from_id": "550e8400-e29b-41d4-a716-446655440000"
  },
  "previousDeployment": {
    "id": "bb0e8400-e29b-41d4-a716-446655440006",
    "environment_id": "production",
    "deployment_type": "feature",
    "status": "completed"
  },
  "message": "Deployment rolled back successfully"
}
```

---

## Data Models

### Deployment
```typescript
{
  id: UUID;
  environment_id: string;
  deployment_type: 'feature' | 'bugfix' | 'hotfix' | 'rollback';
  description: string;
  requested_by: UUID;
  status: 'pending' | 'approved' | 'deploying' | 'completed' | 'failed' | 'rolled_back';
  scheduled_at?: Date;
  rollback_from_id?: UUID;
  error_message?: string;
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
}
```

### ActivityLog
```typescript
{
  id: UUID;
  user_id: UUID;
  action: string;
  resource: string;
  resource_id: UUID;
  changes: Record<string, any>;
  gps_coordinates?: { latitude: number; longitude: number };
  ip_address?: string;
  user_agent?: string;
  session_id: UUID;
  timestamp: Date;
}
```

### ImmutableDocument
```typescript
{
  id: UUID;
  document_type: string;
  content: Record<string, any>;
  hash: string; // SHA-256
  previous_hash?: string;
  created_by: UUID;
  created_at: Date;
  immutable: boolean;
}
```

### DeletionAttempt
```typescript
{
  id: UUID;
  target_type: string;
  target_id: UUID;
  attempted_by: UUID;
  reason?: string;
  timestamp: Date;
  blocked: boolean;
  block_reason?: string;
}
```

---

## Authentication & Authorization

### Required Middleware

All endpoints require authentication. Admin endpoints additionally require `admin` user type.

```typescript
// Apply to all deployment routes
app.use('/api/admin', authMiddleware);
app.use('/api/admin/deployment-request', requireUserType('admin'));
app.use('/api/admin/deployments', requireUserType('admin'));
app.use('/api/admin/immutable-documents', requireUserType('admin'));
```

### JWT Token Format
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### User Types
- `admin` - Full system access
- `attorney` - Limited to own data
- `client` - Limited to own cases

---

## Usage Examples

### Example 1: Full Deployment Lifecycle

```bash
# 1. Create deployment request
curl -X POST http://localhost:3000/api/admin/deployment-request \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "environmentId": "production",
    "deploymentType": "feature",
    "description": "Deploy new authentication system"
  }'

# Response: deployment-id = "550e8400-e29b-41d4-a716-446655440000"

# 2. Update status to deploying
curl -X PUT http://localhost:3000/api/admin/deployments/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "deploying"}'

# 3. Create immutable deployment manifest
curl -X POST http://localhost:3000/api/admin/immutable-documents \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "documentType": "deployment_manifest",
    "content": {
      "deploymentId": "550e8400-e29b-41d4-a716-446655440000",
      "version": "1.2.3"
    }
  }'

# 4. Update status to completed
curl -X PUT http://localhost:3000/api/admin/deployments/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'

# 5. Check metrics
curl -X GET "http://localhost:3000/api/admin/deployment-metrics?days=7" \
  -H "Authorization: Bearer TOKEN"
```

### Example 2: Activity Logging with GPS

```typescript
// From client
const activityData = {
  action: 'case_viewed',
  resource: 'case',
  resourceId: 'case-123',
  changes: {
    viewDuration: 300,
    sectionsViewed: ['overview', 'documents']
  },
  gpsCoordinates: {
    latitude: navigator.geolocation.coords.latitude,
    longitude: navigator.geolocation.coords.longitude
  }
};

fetch('/api/admin/activity-log', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(activityData)
});
```

### Example 3: Rollback on Failure

```bash
# Rollback deployment if critical bug found
curl -X POST http://localhost:3000/api/admin/rollback/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Critical authentication bypass vulnerability discovered"
  }'
```

---

## Security Considerations

### 1. Immutable Audit Trail
- All deployments and activities are logged
- Records are cryptographically hashed
- Tampering is detectable via hash verification

### 2. Deletion Prevention
- No data is actually deleted
- All deletion attempts are logged
- Only admins can attempt deletions
- Blocks are recorded for audit

### 3. GPS Tracking
- Enables geographic audit trails
- Useful for detecting unauthorized access
- Optional field (included if provided)

### 4. Rate Limiting
- Implement rate limiting in production
- Suggest: 100 requests/minute per authenticated user
- Use `express-rate-limit` middleware

### 5. Data Retention
- Activity logs: 1 year minimum
- Immutable documents: Permanent
- Deletion attempts: 2 years minimum
- Consider GDPR compliance

---

## Performance Optimization

### Database Indexes
Already created for:
- `deployments(environment_id, status, created_at)`
- `activity_logs(user_id, timestamp, action)`
- `immutable_documents(hash, created_at)`
- `deletion_attempts(blocked, timestamp)`

### Query Optimization
- Always use pagination for list endpoints
- Limit: max 100 items per request
- Use composite indexes for filtering

### Caching Strategy
- Cache metrics for 5 minutes
- Cache immutable documents (indefinite, hash verified)
- Invalidate on new deployments

---

## Error Handling

### Standard Error Response
```json
{
  "error": "Deployment not found",
  "details": "No deployment with ID xxx"
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad request / validation error
- `401` - Unauthorized
- `403` - Forbidden / insufficient permissions
- `404` - Not found
- `500` - Server error

---

## Monitoring & Alerts

### Key Metrics to Monitor
1. **Deployment Success Rate** - Should be > 90%
2. **Average Deployment Time** - Track degradation
3. **Failed Rollbacks** - Immediate alert
4. **Failed Deletion Attempts** - Potential security issue
5. **GPS Anomalies** - Unusual geographic patterns

### Recommended Alerts
- Deployment success rate < 80%
- Deployment time > 2x average
- Multiple failed deletions from same user
- GPS coordinates outside expected region
- Hash verification failures

---

## Testing

### Unit Tests
```typescript
describe('DeploymentService', () => {
  it('should create deployment', async () => {
    const deployment = await DeploymentService.createDeployment({
      environmentId: 'test',
      deploymentType: 'feature',
      description: 'Test',
      requestedBy: 'user-id'
    });
    expect(deployment.status).toBe('pending');
  });

  it('should verify immutable document', async () => {
    const doc = await DeploymentService.createImmutableDocument({
      documentType: 'test',
      content: { test: true }
    }, 'user-id');
    
    const verified = await DeploymentService.getImmutableDocument(doc.id);
    expect(verified.hashVerified).toBe(true);
  });
});
```

### Integration Tests
```typescript
describe('Deployment API', () => {
  it('POST /deployment-request should create deployment', async () => {
    const res = await request(app)
      .post('/api/admin/deployment-request')
      .set('Authorization', `Bearer ${token}`)
      .send({
        environmentId: 'test',
        deploymentType: 'feature',
        description: 'Test deployment'
      });
    
    expect(res.status).toBe(201);
    expect(res.body.deployment.status).toBe('pending');
  });
});
```

---

## Maintenance

### Database Cleanup
```sql
-- Archive old activity logs (keep 2 years)
DELETE FROM activity_logs 
WHERE timestamp < NOW() - INTERVAL '2 years';

-- Archive old deployment records (keep 5 years)
DELETE FROM deployments 
WHERE created_at < NOW() - INTERVAL '5 years'
AND status IN ('completed', 'failed');
```

### Metrics Recalculation
```sql
-- Refresh deployment metrics view
REFRESH MATERIALIZED VIEW deployment_metrics_daily;
```

---

## File Structure

```
transcend-api/
├── src/
│   ├── routes/
│   │   └── deployment.ts          # Main deployment routes
│   ├── services/
│   │   └── deploymentService.ts   # Business logic
│   ├── middleware/
│   │   ├── authMiddleware.ts      # Auth & permission checks
│   │   └── validationMiddleware.ts
│   └── database/
│       ├── schema.sql             # DB schema with extensions
│       └── connection.ts          # DB connection pool
└── DEPLOYMENT_SYSTEM_GUIDE.md     # This file
```

---

## Support & Troubleshooting

### Common Issues

**1. 401 Unauthorized**
- Verify JWT token is valid
- Check token expiration
- Ensure Authorization header format: `Bearer TOKEN`

**2. 403 Forbidden**
- User must be admin for protected endpoints
- Check user type in JWT payload

**3. Hash Verification Failed**
- Indicates document tampering
- Investigate immediately
- Alert security team

**4. Rollback Not Available**
- Ensure previous deployment exists and completed
- Check environment_id matches

### Debugging
Enable verbose logging:
```typescript
process.env.DEBUG = 'deployment:*';
```

---

## Version History

- **v1.0.0** - Initial release with all 10 endpoints
- Database schema complete
- Service layer implemented
- Full API documentation

---

## License & Compliance

This deployment system is designed to meet:
- HIPAA requirements (for law firm data)
- GDPR compliance (data retention, audit trails)
- SOC 2 Type II standards
- PCI DSS (if payment data involved)

Ensure proper data retention policies are enforced.
