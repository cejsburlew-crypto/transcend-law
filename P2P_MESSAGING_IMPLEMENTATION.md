# Provider-to-Provider (P2P) Messaging System Implementation

## Overview

The P2P Messaging System enables attorney-to-attorney communication for referrals, sub-contracting negotiations, dispute resolution, and general inquiries. This system includes real-time messaging, file attachments, rate limiting, and comprehensive tracking capabilities.

## Architecture

### Backend Components

#### 1. **P2P Messaging Service** (`/transcend-api/services/p2pMessaging.ts`)

Core business logic service with the following features:

- **Conversation Management**: Create, retrieve, archive conversations between attorneys
- **Message Operations**: Send, retrieve, mark as read
- **Referral Tracking**: Create, manage, and track referrals between attorneys
- **Subcontract Negotiations**: Propose, negotiate, and accept subcontracts
- **Dispute Resolution**: Create and resolve disputes with mediation support
- **Rate Limiting**: Prevents abuse with configurable message limits (100 messages/hour)
- **Message Statistics**: Comprehensive analytics on messaging activity

**Key Classes & Interfaces:**

```typescript
// Message Types
enum MessageType {
  REFERRAL = 'referral',
  SUBCONTRACT = 'subcontract',
  DISPUTE = 'dispute',
  GENERAL = 'general',
  NEGOTIATION = 'negotiation',
}

// Conversation Status
enum ConversationStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
  RESOLVED = 'resolved',
  DISPUTED = 'disputed',
}

// Main Data Models
interface P2PMessage { ... }
interface P2PConversation { ... }
interface ReferralTracking { ... }
interface SubcontractNegotiation { ... }
interface DisputeResolution { ... }
```

#### 2. **API Routes** (`/transcend-api/routes/p2pMessagingRoutes.ts`)

RESTful API endpoints for P2P messaging operations:

```
POST   /api/p2p/conversations              - Create conversation
GET    /api/p2p/conversations              - List conversations
GET    /api/p2p/conversations/:id          - Get conversation details
POST   /api/p2p/conversations/:id/archive  - Archive conversation

POST   /api/p2p/conversations/:id/messages - Send message
GET    /api/p2p/conversations/:id/messages - Get messages
PUT    /api/p2p/messages/:id/read          - Mark as read
POST   /api/p2p/upload                     - Upload attachment
GET    /api/p2p/files/:filename            - Download attachment

POST   /api/p2p/referrals                  - Create referral
GET    /api/p2p/referrals/:id              - Get referral
PATCH  /api/p2p/referrals/:id              - Update status

POST   /api/p2p/subcontracts               - Propose subcontract
GET    /api/p2p/subcontracts/:id           - Get subcontract
PATCH  /api/p2p/subcontracts/:id           - Update status

POST   /api/p2p/disputes                   - Create dispute
GET    /api/p2p/disputes/:id               - Get dispute
PATCH  /api/p2p/disputes/:id/resolve       - Resolve dispute

GET    /api/p2p/stats                      - Get statistics
GET    /api/p2p/rate-limit                 - Check rate limit
```

#### 3. **Database Schema** (`/transcend-api/database/schema-p2p-messaging.sql`)

PostgreSQL tables with proper indexing and audit logging:

- **p2p_conversations**: Tracks conversations between attorneys
- **p2p_messages**: Stores individual messages with attachments
- **p2p_referrals**: Records referral agreements and status
- **p2p_subcontract_negotiations**: Manages subcontract proposals and negotiations
- **p2p_disputes**: Handles dispute resolution records

### Frontend Components

#### 1. **Provider Messaging Component** (`/transcend-frontend/src/components/ProviderMessaging.tsx`)

Comprehensive React component with:

- **Conversation Management**: Create, list, filter, and search conversations
- **Real-time Messaging**: Send and receive messages with typing indicators
- **File Attachments**: Upload and download documents
- **Referral Management**: Create and track referral opportunities
- **Subcontract Proposals**: Propose work with rate negotiation
- **Dispute Resolution**: Report and track disputes
- **Message Statistics**: Dashboard with unread counts and activity metrics

**Key Features:**
- Responsive design (mobile-first)
- Full-text search across conversations
- Status filtering (active, disputed, resolved, archived)
- Message type icons and visual indicators
- Rate limiting feedback

#### 2. **Styling** (`/transcend-frontend/src/components/ProviderMessaging.css`)

Professional, responsive styling with:
- Dark mode support
- Mobile-optimized layout
- Accessible color contrasts
- Touch-friendly buttons (44x44px minimum)

## Setup Instructions

### 1. Database Migration

Run the schema migration to create all necessary tables:

```bash
psql -U postgres -d transcend_db -f transcend-api/database/schema-p2p-messaging.sql
```

This creates:
- 5 main tables
- 30+ indexes for performance
- 2 triggers for audit logging
- 1 materialized view for analytics
- 3 helper functions

### 2. Backend Integration

1. Register the routes in your Express app:

```typescript
// app.ts or server.ts
import p2pMessagingRoutes from './routes/p2pMessagingRoutes';

app.use('/api/p2p', p2pMessagingRoutes);
```

2. Ensure authentication middleware is properly configured:

```typescript
import { authenticate, requireRole } from './middleware/auth';
```

3. Configure environment variables:

```env
# .env
REDIS_HOST=localhost
REDIS_PORT=6379
UPLOAD_DIR=./uploads/p2p
```

4. Install required dependencies:

```bash
npm install redis multer uuid
```

### 3. Frontend Integration

1. Import the component:

```typescript
import { ProviderMessaging } from './components/ProviderMessaging';
```

2. Use in your application:

```typescript
<ProviderMessaging
  currentUserId={userId}
  currentUserName={userName}
  onSendMessage={(message) => {
    // Handle message sent
    console.log('Message sent:', message);
  }}
/>
```

3. Add to your routing:

```typescript
<Route path="/provider/messages" element={<ProviderMessaging />} />
```

## Feature Details

### 1. Referral Tracking

**Creating a Referral:**
```typescript
const referral = await P2PMessagingService.createReferral(
  conversationId,
  referrerId,           // Current attorney
  referredAttorneyId,   // Attorney being referred
  caseId,
  fee,                  // Optional: fixed fee
  feePercentage,        // Optional: percentage fee
  notes
);
```

**Updating Referral Status:**
- `pending` → `accepted`: Attorney accepts referral
- `pending` → `declined`: Attorney declines referral
- `accepted` → `completed`: Case/referral completed

### 2. Subcontract Negotiations

**Creating a Proposal:**
```typescript
const subcontract = await P2PMessagingService.createSubcontractProposal(
  conversationId,
  principalAttorneyId,  // Attorney requesting work
  subcontractorId,      // Attorney being requested
  caseId,
  serviceScope,         // Description of work needed
  proposedRate,         // $/hour
  estimatedHours,       // Optional
  timeline              // Optional
);
```

**Negotiation Flow:**
- `proposal`: Initial offer sent
- `counter_offer`: Recipient responds with different rate
- `accepted`: Agreement reached
- `rejected`: Offer declined
- `completed`: Work finished

### 3. Dispute Resolution

**Creating a Dispute:**
```typescript
const dispute = await P2PMessagingService.createDispute(
  conversationId,
  initiatedBy,          // Current user
  party1Id,
  party2Id,
  disputeReason         // Description of issue
);
```

**Dispute Lifecycle:**
- `open`: Dispute created
- `mediation`: Mediator assigned
- `escalated`: Requires higher-level intervention
- `resolved`: Issue resolved

### 4. Rate Limiting

Prevents message abuse:
- **Limit**: 100 messages per hour
- **Window**: 60 minutes (3600 seconds)
- **Redis-based**: Distributed rate limiting support

```typescript
const rateLimitStatus = await P2PMessagingService.checkRateLimit(userId);
// Returns: { remaining: 95, resetTime: 1800, isLimited: false }
```

### 5. File Attachments

**Supported Types:**
- PDF files
- Word documents (.doc, .docx)
- Excel spreadsheets (.xls, .xlsx)
- Images (JPEG, PNG, GIF)
- Text files

**Size Limit**: 10MB per file

## API Usage Examples

### Create Conversation

```bash
curl -X POST http://localhost:3000/api/p2p/conversations \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "recipientId": "attorney-2-id",
    "subject": "Referral Opportunity - Medical Malpractice",
    "messageType": "referral",
    "caseId": "case-id"
  }'
```

### Send Message

```bash
curl -X POST http://localhost:3000/api/p2p/conversations/conv-id/messages \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "I have a client needing representation...",
    "messageType": "referral",
    "attachments": []
  }'
```

### Create Referral

```bash
curl -X POST http://localhost:3000/api/p2p/referrals \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "conv-id",
    "referredAttorneyId": "attorney-2-id",
    "caseId": "case-id",
    "fee": 500,
    "feePercentage": null,
    "notes": "Medical malpractice case, $50k potential"
  }'
```

### Propose Subcontract

```bash
curl -X POST http://localhost:3000/api/p2p/subcontracts \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "conv-id",
    "subcontractorId": "attorney-2-id",
    "caseId": "case-id",
    "serviceScope": "Medical expert review and deposition",
    "proposedRate": 250,
    "estimatedHours": 20,
    "timeline": "2 weeks"
  }'
```

## Security Considerations

### 1. Authentication & Authorization

- All endpoints require `authenticate` middleware
- Users can only access their own conversations
- Referral and dispute access validated

### 2. Data Protection

- All audit logs stored immutably
- Sensitive data classified appropriately
- GDPR compliance: Right to be forgotten support

### 3. Rate Limiting

- Redis-based for distributed systems
- Fail-open if Redis unavailable
- Prevents DDoS attacks

### 4. File Upload Security

- Whitelist allowed MIME types
- Size limits enforced
- Directory traversal protection

## Performance Optimization

### Indexing Strategy

```sql
-- Fast conversation lookups
CREATE INDEX idx_p2p_conversations_attorney_1
CREATE INDEX idx_p2p_conversations_attorney_2

-- Efficient message queries
CREATE INDEX idx_p2p_messages_conversation_id
CREATE INDEX idx_p2p_messages_read_at

-- Full-text search support
CREATE INDEX idx_p2p_messages_content_fts
```

### Query Optimization

- Pagination supported (limit/offset)
- Materialized view for analytics
- Connection pooling in Redis
- Batch operations where applicable

## Monitoring & Maintenance

### Key Metrics

Track using the stats endpoint:

```typescript
{
  totalMessages: number,
  totalConversations: number,
  averageResponseTime: number,      // minutes
  unreadMessages: number,
  activeReferrals: number,
  activeSubcontracts: number,
  openDisputes: number
}
```

### Database Maintenance

```sql
-- Refresh materialized view
REFRESH MATERIALIZED VIEW p2p_messaging_summary;

-- Archive old conversations (e.g., 90 days)
UPDATE p2p_conversations
SET status = 'archived'
WHERE status = 'resolved'
AND updated_at < NOW() - INTERVAL '90 days';
```

## Troubleshooting

### Issue: Rate Limit Not Working

**Solution**: Check Redis connection:
```bash
redis-cli ping  # Should return PONG
```

### Issue: Messages Not Sending

**Possible Causes:**
- Authentication token expired
- User not authorized for conversation
- Rate limit exceeded
- File size too large

### Issue: Conversations Not Loading

**Check:**
- Database connection
- User ID validity
- Query pagination parameters

## Future Enhancements

1. **Real-time Updates**: WebSocket integration
2. **Video/Audio Calls**: Integration with video service
3. **Message Encryption**: End-to-end encryption
4. **ML-based Matching**: Smart attorney recommendations
5. **Workflow Automation**: Auto-response templates
6. **Advanced Analytics**: Detailed transaction reporting

## Testing

### Unit Tests

```typescript
describe('P2PMessagingService', () => {
  it('should create conversation', async () => {
    const conv = await P2PMessagingService.createConversation(...);
    expect(conv.id).toBeDefined();
  });

  it('should enforce rate limit', async () => {
    // Send 101 messages, 101st should fail
    expect(async () => {
      await P2PMessagingService.sendMessage(...);
    }).toThrow('Rate limit exceeded');
  });
});
```

### Integration Tests

```typescript
describe('P2P Messaging API', () => {
  it('POST /api/p2p/conversations should create', async () => {
    const res = await request(app)
      .post('/api/p2p/conversations')
      .set('Authorization', `Bearer ${token}`)
      .send({ recipientId, subject });
    expect(res.status).toBe(201);
  });
});
```

## Support & Maintenance

- Review rate limit settings based on usage patterns
- Monitor Redis for performance
- Regular backup of messaging data
- Quarterly audit of disputes and resolutions

## License

This P2P Messaging System is part of the Transcend Law Platform and follows the same licensing terms.
