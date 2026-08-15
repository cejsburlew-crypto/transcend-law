# OFAC Sanctions Screening API Reference

## Base URL

```
http://localhost:3000/api/sanctions
```

## Authentication

All endpoints require JWT token in `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

Admin endpoints require user with `admin` role.

---

## User Endpoints

### 1. Screen User Against Sanctions

**Endpoint:** `POST /screen`

**Description:** Screen user/entity against all sanctions lists

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "phone": "+1-555-0123",
  "address": "123 Main St, Springfield, USA",
  "dateOfBirth": "1980-01-15",
  "passportNumber": "ABC123456",
  "taxId": "12-3456789",
  "companyName": "Acme Corp",
  "checkType": "account_creation"
}
```

**checkType Values:**
- `account_creation` - During user registration
- `payment_processing` - During payment transaction
- `manual_review` - Manual review request

**Response (200 OK):**
```json
{
  "success": true,
  "screening": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "660e8400-e29b-41d4-a716-446655440001",
    "checkType": "account_creation",
    "status": "clear",
    "riskScore": 15,
    "matches": [],
    "sanctionsLists": ["OPEN_SANCTIONS", "OFAC_SDN"],
    "autoBlocked": false,
    "createdAt": "2026-08-15T10:30:00Z",
    "updatedAt": "2026-08-15T10:30:00Z",
    "expiresAt": "2026-08-22T10:30:00Z"
  }
}
```

**Response Status Values:**
- `clear` - No matches found (Risk Score: 0-20)
- `potential_match` - Possible match, review recommended (Risk Score: 21-50)
- `confirmed_match` - Match confirmed (Risk Score: 51-75)
- `manual_review` - Requires manual review (Risk Score: 51-90)
- `blocked` - User is blocked (Risk Score: 90-100)

**Error Responses:**
```json
{
  "error": "Missing required fields: firstName, lastName, checkType"
}
```

---

### 2. Get Screening Result

**Endpoint:** `GET /screening/:screeningId`

**Description:** Retrieve detailed results of a specific screening

**Request:**
```
GET /api/sanctions/screening/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "screening": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "660e8400-e29b-41d4-a716-446655440001",
    "checkType": "account_creation",
    "status": "clear",
    "riskScore": 15,
    "matches": [
      {
        "id": "match-001",
        "matchType": "individual",
        "sanctionsList": ["OFAC_SDN"],
        "listNames": ["OFAC Specially Designated Nationals List"],
        "matchScore": 0.65,
        "names": ["John Doe"],
        "addresses": ["123 Main St"],
        "passportNumbers": [],
        "taxIds": [],
        "details": {}
      }
    ],
    "sanctionsLists": ["OPEN_SANCTIONS", "OFAC_SDN"],
    "autoBlocked": false,
    "reviewedBy": null,
    "reviewedAt": null,
    "reviewNotes": null,
    "createdAt": "2026-08-15T10:30:00Z",
    "updatedAt": "2026-08-15T10:30:00Z",
    "expiresAt": "2026-08-22T10:30:00Z"
  }
}
```

---

### 3. Get User Screening History

**Endpoint:** `GET /user/history`

**Query Parameters:**
- `limit` (optional): Number of records (default: 10, max: 100)

**Request:**
```
GET /api/sanctions/user/history?limit=20
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "count": 5,
  "screenings": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "660e8400-e29b-41d4-a716-446655440001",
      "checkType": "account_creation",
      "status": "clear",
      "riskScore": 15,
      "createdAt": "2026-08-15T10:30:00Z"
    }
  ]
}
```

---

### 4. Submit Appeal

**Endpoint:** `POST /appeal`

**Description:** Submit appeal for blocked user account

**Request Body:**
```json
{
  "reason": "This is a case of mistaken identity. My name is similar but I am a different person with different DOB.",
  "supportingDocuments": [
    "https://s3.example.com/passport.pdf",
    "https://s3.example.com/id_verification.pdf"
  ]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Appeal submitted successfully",
  "appeal": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "userId": "660e8400-e29b-41d4-a716-446655440001",
    "status": "pending",
    "reason": "This is a case of mistaken identity...",
    "supportingDocuments": [...],
    "createdAt": "2026-08-15T11:00:00Z",
    "updatedAt": "2026-08-15T11:00:00Z"
  }
}
```

---

### 5. Get Appeal Status

**Endpoint:** `GET /appeal/status`

**Request:**
```
GET /api/sanctions/appeal/status
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "appeal": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "userId": "660e8400-e29b-41d4-a716-446655440001",
    "status": "pending",
    "reason": "This is a case of mistaken identity...",
    "reviewerNote": null,
    "reviewedAt": null,
    "createdAt": "2026-08-15T11:00:00Z"
  }
}
```

**Status Values:**
- `pending` - Awaiting review
- `under_review` - Being reviewed by admin
- `approved` - Appeal approved, user unblocked
- `rejected` - Appeal rejected

---

## Admin Endpoints

### 1. Get Pending Reviews

**Endpoint:** `GET /admin/pending-reviews`

**Query Parameters:**
- `limit` (optional): Number of records (default: 50, max: 200)

**Request:**
```
GET /api/sanctions/admin/pending-reviews?limit=100
Authorization: Bearer <admin-token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "count": 3,
  "screenings": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "660e8400-e29b-41d4-a716-446655440001",
      "checkType": "payment_processing",
      "status": "manual_review",
      "riskScore": 65,
      "matches": [...],
      "createdAt": "2026-08-15T10:30:00Z"
    }
  ]
}
```

---

### 2. Submit Manual Review

**Endpoint:** `POST /admin/review/:screeningId`

**Request Body:**
```json
{
  "status": "clear",
  "reviewNotes": "Verified identity through alternate sources. Name match is coincidental. DOB does not match."
}
```

**Status Values:**
- `clear` - Mark as clear (no match)
- `potential_match` - Possible match
- `confirmed_match` - Confirmed match
- `blocked` - Block user
- `manual_review` - Keep for further review

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Screening status updated to clear",
  "screening": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "660e8400-e29b-41d4-a716-446655440001",
    "status": "clear",
    "riskScore": 15,
    "reviewedBy": "admin-user-id",
    "reviewedAt": "2026-08-15T10:45:00Z",
    "reviewNotes": "Verified identity through alternate sources..."
  }
}
```

---

### 3. Get Statistics

**Endpoint:** `GET /admin/statistics`

**Request:**
```
GET /api/sanctions/admin/statistics
Authorization: Bearer <admin-token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "statistics": {
    "total_screened_users": 1250,
    "total_screenings": 1450,
    "clear_screenings": 1400,
    "potential_match_count": 35,
    "confirmed_match_count": 10,
    "blocked_screenings": 5,
    "pending_reviews": 8,
    "auto_blocked_count": 5,
    "average_risk_score": "18.5",
    "highest_risk_score": 98,
    "lowest_risk_score": 0,
    "report_date": "2026-08-15"
  }
}
```

---

### 4. Get Update Status

**Endpoint:** `GET /admin/update-status`

**Request:**
```
GET /api/sanctions/admin/update-status
Authorization: Bearer <admin-token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "updates": [
    {
      "id": "update-001",
      "listName": "OPEN_SANCTIONS",
      "lastUpdated": "2026-08-15T02:00:00Z",
      "recordCount": 25000,
      "status": "success"
    },
    {
      "id": "update-002",
      "listName": "OFAC_SDN",
      "lastUpdated": "2026-08-15T02:15:00Z",
      "recordCount": 3500,
      "status": "success"
    }
  ]
}
```

---

### 5. Force Update

**Endpoint:** `POST /admin/force-update`

**Request:**
```
POST /api/sanctions/admin/force-update
Authorization: Bearer <admin-token>
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "message": "Update job initiated",
  "note": "Update is running in the background. Check update-status endpoint for progress."
}
```

---

### 6. Get Audit Log

**Endpoint:** `GET /admin/audit-log`

**Query Parameters:**
- `userId` (optional): Filter by specific user
- `limit` (optional): Number of records (default: 100, max: 500)

**Request:**
```
GET /api/sanctions/admin/audit-log?userId=user-id&limit=50
Authorization: Bearer <admin-token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "count": 25,
  "logs": [
    {
      "id": "log-001",
      "user_id": "user-id",
      "action": "SCREENING_CHECK",
      "check_type": "account_creation",
      "status": "clear",
      "risk_score": 15,
      "matches_count": 0,
      "created_at": "2026-08-15T10:30:00Z"
    }
  ]
}
```

---

### 7. Get Blocked Users

**Endpoint:** `GET /admin/blocked-users`

**Query Parameters:**
- `limit` (optional): Number of records (default: 50, max: 200)

**Request:**
```
GET /api/sanctions/admin/blocked-users?limit=100
Authorization: Bearer <admin-token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "count": 5,
  "blockedUsers": [
    {
      "id": "block-001",
      "user_id": "user-id",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "reason": "High risk score match",
      "blocked_at": "2026-08-15T10:30:00Z",
      "appeal_submitted_at": "2026-08-15T11:00:00Z",
      "appeal_reason": "Mistaken identity",
      "risk_score": 92,
      "screening_status": "blocked"
    }
  ]
}
```

---

### 8. Unblock User

**Endpoint:** `POST /admin/unblock-user/:userId`

**Request Body:**
```json
{
  "reason": "Appeal approved - confirmed as different person"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "User unblocked successfully",
  "blockedUser": {
    "id": "block-001",
    "user_id": "user-id",
    "unblocked_at": "2026-08-15T12:00:00Z",
    "unblocked_by": "admin-id",
    "unblock_reason": "Appeal approved - confirmed as different person"
  }
}
```

---

### 9. Get Pending Appeals

**Endpoint:** `GET /admin/appeals`

**Request:**
```
GET /api/sanctions/admin/appeals
Authorization: Bearer <admin-token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "count": 2,
  "appeals": [
    {
      "id": "appeal-001",
      "user_id": "user-id",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "reason": "This is a case of mistaken identity",
      "status": "pending",
      "created_at": "2026-08-15T11:00:00Z",
      "review_notes": null
    }
  ]
}
```

---

### 10. Review Appeal

**Endpoint:** `POST /admin/appeal/review/:appealId`

**Request Body:**
```json
{
  "status": "approved",
  "reviewNotes": "Verified through additional documentation. Different person confirmed."
}
```

**Status Values:**
- `approved` - Approve appeal and unblock user
- `rejected` - Reject appeal
- `under_review` - Continue reviewing

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Appeal approved",
  "appeal": {
    "id": "appeal-001",
    "user_id": "user-id",
    "status": "approved",
    "reason": "This is a case of mistaken identity",
    "reviewer_id": "admin-id",
    "review_notes": "Verified through additional documentation...",
    "reviewed_at": "2026-08-15T12:00:00Z"
  }
}
```

---

## Error Codes

| Code | Status | Message |
|------|--------|---------|
| 400 | Bad Request | Missing required fields or invalid input |
| 401 | Unauthorized | Missing or invalid token |
| 403 | Forbidden | Admin access required / Not authorized to view |
| 404 | Not Found | Screening, user, or appeal not found |
| 500 | Server Error | Internal server error |

---

## Rate Limiting

- User endpoints: 100 requests per minute
- Admin endpoints: 500 requests per minute
- Screening endpoint: 50 requests per minute per user

---

## Examples

### cURL Examples

**Screen User:**
```bash
curl -X POST http://localhost:3000/api/sanctions/screen \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "checkType": "account_creation"
  }'
```

**Get Pending Reviews:**
```bash
curl http://localhost:3000/api/sanctions/admin/pending-reviews \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Submit Review:**
```bash
curl -X POST http://localhost:3000/api/sanctions/admin/review/screening-id \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "clear",
    "reviewNotes": "Verified - different person"
  }'
```

### JavaScript Examples

```javascript
// Screen user
async function screenUser(token, userData) {
  const response = await fetch('http://localhost:3000/api/sanctions/screen', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      checkType: 'account_creation',
    }),
  });
  
  return response.json();
}

// Get screening result
async function getScreening(token, screeningId) {
  const response = await fetch(
    `http://localhost:3000/api/sanctions/screening/${screeningId}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  
  return response.json();
}

// Submit review
async function submitReview(token, screeningId, status, notes) {
  const response = await fetch(
    `http://localhost:3000/api/sanctions/admin/review/${screeningId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: status,
        reviewNotes: notes,
      }),
    }
  );
  
  return response.json();
}
```

---

## Best Practices

1. **Always provide full information** - More data = better matching accuracy
2. **Screen on account creation** - Catch issues early
3. **Review manual flags** - Don't rely solely on automated decisions
4. **Maintain audit trail** - Keep records for compliance
5. **Update regularly** - Run daily updates for latest lists
6. **Test with known entities** - Verify system works with test cases
7. **Handle appeals fairly** - Allow users to contest blocks
8. **Monitor statistics** - Track trends and false positives

---

## Support

For issues or questions:
- Check database for recent screenings
- Review audit log for activity
- Check update status for data freshness
- Contact compliance team for policy questions
