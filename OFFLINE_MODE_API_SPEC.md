# Offline Mode - API Specification

Backend API endpoints required for offline mode support.

## Base URL

```
https://transcend-law.com/api
```

## Authentication

All endpoints require Bearer token authentication:

```
Authorization: Bearer {access_token}
```

## 1. Sync Single Entity

**Endpoint:** `POST /sync/{entityType}/{entityId}`

**Purpose:** Sync a single offline operation to the server.

### Request

```http
POST /api/sync/user/123 HTTP/1.1
Host: transcend-law.com
Authorization: Bearer eyJhbGc...
Content-Type: application/json
X-Client-Timestamp: 1692345600000
X-Conflict-Resolution: client-wins

{
  "type": "update",
  "data": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "clientTimestamp": 1692345600000
}
```

### Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| Authorization | string | Yes | Bearer token for authentication |
| X-Client-Timestamp | number | No | Client timestamp for conflict detection |
| X-Conflict-Resolution | string | No | Strategy: client-wins, server-wins, manual |

### Request Body

```typescript
{
  type: "create" | "update" | "delete",
  data: Record<string, any>,
  clientTimestamp: number,
  version?: number // Optional for optimistic locking
}
```

### Response - Success (200 OK)

```json
{
  "success": true,
  "version": 2,
  "timestamp": 1692345600100,
  "data": {
    "id": "123",
    "name": "John Doe",
    "email": "john@example.com",
    "updatedAt": 1692345600100
  }
}
```

### Response - Conflict (409 Conflict)

```json
{
  "conflict": true,
  "status": 409,
  "message": "Entity has been modified",
  "serverData": {
    "id": "123",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "updatedAt": 1692345599000,
    "version": 3
  },
  "clientData": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "conflictStrategy": "manual",
  "suggestedMerge": {
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

### Response - Not Found (404)

```json
{
  "error": "Entity not found",
  "status": 404,
  "entityType": "user",
  "entityId": "123"
}
```

### Response - Server Error (500+)

Retryable error - client should retry with exponential backoff.

```json
{
  "error": "Internal server error",
  "status": 500,
  "message": "Database connection failed",
  "retryAfter": 5000
}
```

## 2. Batch Sync Operations

**Endpoint:** `POST /sync/batch`

**Purpose:** Sync multiple operations in one request.

### Request

```http
POST /api/sync/batch HTTP/1.1
Host: transcend-law.com
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "operations": [
    {
      "id": "op-1",
      "type": "update",
      "entityType": "user",
      "entityId": "123",
      "data": { "name": "John" },
      "clientTimestamp": 1692345600000,
      "conflictStrategy": "client-wins"
    },
    {
      "id": "op-2",
      "type": "create",
      "entityType": "intake",
      "entityId": "new-456",
      "data": { "type": "legal", "status": "draft" },
      "clientTimestamp": 1692345601000
    }
  ]
}
```

### Request Body

```typescript
{
  operations: Array<{
    id?: string,
    type: "create" | "update" | "delete",
    entityType: string,
    entityId: string,
    data: Record<string, any>,
    clientTimestamp: number,
    conflictStrategy?: string
  }>
}
```

### Response - Success (200 OK)

```json
{
  "success": true,
  "results": [
    {
      "id": "op-1",
      "operationId": "op-1",
      "status": "success",
      "version": 2,
      "timestamp": 1692345600100
    },
    {
      "id": "op-2",
      "operationId": "op-2",
      "status": "success",
      "version": 1,
      "timestamp": 1692345601100
    }
  ],
  "summary": {
    "total": 2,
    "successful": 2,
    "failed": 0,
    "conflicts": 0
  }
}
```

### Response - Partial Success (207 Multi-Status)

```json
{
  "results": [
    {
      "id": "op-1",
      "status": "success",
      "version": 2
    },
    {
      "id": "op-2",
      "status": "conflict",
      "conflict": true,
      "serverData": { ... },
      "clientData": { ... }
    },
    {
      "id": "op-3",
      "status": "error",
      "error": "Invalid data",
      "message": "Field 'email' is required"
    }
  ],
  "summary": {
    "total": 3,
    "successful": 1,
    "failed": 1,
    "conflicts": 1
  }
}
```

## 3. Check Sync Status

**Endpoint:** `GET /sync/status`

**Purpose:** Check sync status and pending operations.

### Request

```http
GET /api/sync/status HTTP/1.1
Host: transcend-law.com
Authorization: Bearer eyJhbGc...
```

### Response (200 OK)

```json
{
  "status": "idle",
  "isOnline": true,
  "lastSync": 1692345600000,
  "nextSync": 1692345630000,
  "pendingOperations": 0,
  "failedOperations": 0,
  "conflictedOperations": 0,
  "cacheSize": 1024000,
  "cacheHits": 152,
  "cacheMisses": 28
}
```

## 4. Validate Offline Cache

**Endpoint:** `POST /sync/validate`

**Purpose:** Validate cached data integrity.

### Request

```http
POST /api/sync/validate HTTP/1.1
Host: transcend-law.com
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "entityType": "user",
  "entityId": "123",
  "hash": "abc123def456"
}
```

### Response (200 OK)

```json
{
  "valid": true,
  "serverHash": "abc123def456",
  "timestamp": 1692345600000,
  "needsUpdate": false
}
```

### Response - Invalid Cache (409 Conflict)

```json
{
  "valid": false,
  "message": "Cache is stale",
  "serverHash": "new456hash",
  "timestamp": 1692345600100,
  "needsUpdate": true,
  "serverData": { ... }
}
```

## 5. Get Sync Health

**Endpoint:** `GET /sync/health`

**Purpose:** Check sync service health.

### Request

```http
GET /api/sync/health HTTP/1.1
Host: transcend-law.com
Authorization: Bearer eyJhbGc...
```

### Response (200 OK)

```json
{
  "status": "healthy",
  "uptime": 3600000,
  "averageSyncTime": 250,
  "successRate": 0.98,
  "conflictRate": 0.02,
  "queueDepth": 0,
  "storageUsage": {
    "cache": 1024000,
    "queue": 256000,
    "total": 1280000
  }
}
```

## 6. Clear Cache

**Endpoint:** `DELETE /sync/cache`

**Purpose:** Clear all cached data on server side.

### Request

```http
DELETE /api/sync/cache HTTP/1.1
Host: transcend-law.com
Authorization: Bearer eyJhbGc...
```

### Response (200 OK)

```json
{
  "success": true,
  "message": "Cache cleared",
  "timestamp": 1692345600000
}
```

## 7. Resolve Conflict

**Endpoint:** `POST /sync/{operationId}/resolve`

**Purpose:** Manually resolve a sync conflict.

### Request

```http
POST /api/sync/op-123/resolve HTTP/1.1
Host: transcend-law.com
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "resolution": "client-wins",
  "mergedData": {
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

### Response (200 OK)

```json
{
  "success": true,
  "resolution": "client-wins",
  "version": 3,
  "timestamp": 1692345600100
}
```

## Error Codes

| Code | Status | Meaning | Retry? |
|------|--------|---------|--------|
| 200 | OK | Success | No |
| 201 | Created | Resource created | No |
| 204 | No Content | No content | No |
| 207 | Multi-Status | Partial success | Conditional |
| 400 | Bad Request | Invalid request | No |
| 401 | Unauthorized | Invalid token | No |
| 403 | Forbidden | Access denied | No |
| 404 | Not Found | Entity not found | No |
| 409 | Conflict | Data conflict | Conditional |
| 429 | Too Many Requests | Rate limited | Yes (with backoff) |
| 500 | Server Error | Server error | Yes (with backoff) |
| 502 | Bad Gateway | Gateway error | Yes (with backoff) |
| 503 | Service Unavailable | Service down | Yes (with backoff) |
| 504 | Gateway Timeout | Timeout | Yes (with backoff) |

## Retry Logic

### Exponential Backoff

```
delay = retryDelay * (backoffMultiplier ^ attempt)
delay = 1000 * (2 ^ 0) = 1000ms (attempt 0)
delay = 1000 * (2 ^ 1) = 2000ms (attempt 1)
delay = 1000 * (2 ^ 2) = 4000ms (attempt 2)
delay = 1000 * (2 ^ 3) = 8000ms (attempt 3)
```

### Retryable Status Codes

- 429 (Too Many Requests)
- 5xx (Server Errors)
- Network timeouts
- Connection refused

### Non-Retryable Status Codes

- 400 (Bad Request)
- 401 (Unauthorized)
- 403 (Forbidden)
- 404 (Not Found)

## Rate Limiting

All endpoints support rate limiting headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1692345660
```

When rate limited (429):

```json
{
  "error": "Too many requests",
  "status": 429,
  "retryAfter": 60,
  "message": "Rate limit exceeded. Retry after 60 seconds"
}
```

## Pagination (for List Endpoints)

For endpoints that return lists:

```http
GET /api/sync/pending?page=1&limit=50
```

Response:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 250,
    "hasMore": true,
    "nextPage": 2
  }
}
```

## Data Types

### Operation Type

```typescript
type OperationType = "create" | "update" | "delete";
```

### Conflict Resolution Strategy

```typescript
type ConflictStrategy = "client-wins" | "server-wins" | "manual";
```

### Entity Types

Supported entity types:

- `user` - User profiles
- `professional` - Service professionals
- `intake` - Client intake forms
- `referral` - Service referrals
- `payment` - Payments
- `document` - Documents
- `message` - Messages
- `appointment` - Appointments
- `review` - Reviews
- `credential` - Credentials

## Timestamps

All timestamps are in milliseconds since Unix epoch (UTC):

```javascript
1692345600000 // 2023-08-18 10:00:00 UTC
```

## Idempotency

Sync operations should be idempotent. Use idempotency keys:

```http
X-Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

Server should recognize duplicate requests and return the same response.

## Versioning

API uses entity versioning for conflict detection:

```json
{
  "version": 3,
  "data": { ... }
}
```

Increment version on each successful update.

## Implementation Example (Node.js/Express)

```javascript
// Sync single operation
app.post('/api/sync/:entityType/:entityId', authenticate, async (req, res) => {
  const { type, data, clientTimestamp } = req.body;
  const { entityType, entityId } = req.params;
  const userId = req.user.id;

  try {
    // Check authorization
    if (!canUserModify(userId, entityType, entityId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Get current version
    const current = await getEntity(entityType, entityId);

    // Check for conflicts
    if (current && current.updatedAt > clientTimestamp) {
      return res.status(409).json({
        conflict: true,
        serverData: current,
        clientData: data
      });
    }

    // Update entity
    const updated = await updateEntity(entityType, entityId, data, {
      userId,
      timestamp: Date.now()
    });

    res.json({
      success: true,
      version: updated.version,
      timestamp: updated.updatedAt
    });

  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});
```

## Testing

### Test Cases

1. **Successful sync** - Single entity update
2. **Batch sync** - Multiple entities
3. **Conflict detection** - Modified on both sides
4. **Retry logic** - Network failure and recovery
5. **Rate limiting** - Exceeded quota
6. **Authentication** - Invalid token
7. **Authorization** - User cannot modify
8. **Validation** - Invalid data format
9. **Idempotency** - Duplicate requests
10. **Timeout** - Long-running operation

### cURL Examples

```bash
# Single sync
curl -X POST https://transcend-law.com/api/sync/user/123 \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "update",
    "data": {"name": "John"},
    "clientTimestamp": 1692345600000
  }'

# Batch sync
curl -X POST https://transcend-law.com/api/sync/batch \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "operations": [
      {"type":"update", "entityType":"user", ...}
    ]
  }'

# Check status
curl https://transcend-law.com/api/sync/status \
  -H "Authorization: Bearer TOKEN"

# Check health
curl https://transcend-law.com/api/sync/health \
  -H "Authorization: Bearer TOKEN"
```

## Performance Targets

| Operation | Target | SLA |
|-----------|--------|-----|
| Single sync | <500ms | 95% |
| Batch sync (10) | <2s | 95% |
| Get status | <100ms | 99% |
| Validate cache | <200ms | 95% |
| Health check | <100ms | 99% |

## Monitoring

Track these metrics:

```
- Sync success rate
- Conflict detection rate
- Average sync time
- Failed sync attempts
- Retry count distribution
- Cache hit/miss ratio
- Queue depth
- Storage usage
- Error rate by type
```

## Security Considerations

1. **Authentication** - Verify Bearer token
2. **Authorization** - Check user can modify entity
3. **Validation** - Validate all input data
4. **Rate limiting** - Prevent abuse
5. **Encryption** - Use HTTPS only
6. **Audit logging** - Log all sync operations
7. **Data sanitization** - Sanitize user input

## Changelog

- v1.0 - Initial API specification
- v1.1 - Added batch sync endpoint
- v1.2 - Added health check endpoint
- v1.3 - Added idempotency support
