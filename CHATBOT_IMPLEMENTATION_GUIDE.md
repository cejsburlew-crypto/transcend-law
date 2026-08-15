# AI Chatbot Support Implementation Guide

## Overview

This guide provides comprehensive instructions for implementing the AI Chatbot Support system in the Transcend platform. The chatbot is powered by GPT-4, includes knowledge base integration, and provides automatic escalation to human support agents.

---

## Architecture

### Components

1. **Backend Service** (`/transcend-api/services/aiChatbot.ts`)
   - Conversation management
   - GPT-4 API integration
   - Knowledge base operations
   - Analytics tracking
   - Escalation logic

2. **Frontend Component** (`/transcend-frontend/src/components/Chatbot.tsx`)
   - Chat UI with bubble design
   - Message history display
   - Satisfaction rating
   - Escalation form
   - Real-time updates

3. **API Routes** (`/transcend-api/routes/chatbotRoutes.ts`)
   - RESTful endpoints for all operations
   - Authentication & authorization
   - Admin-only analytics endpoints

4. **Custom Hook** (`/transcend-frontend/src/hooks/useChatbot.ts`)
   - State management
   - Message queue handling
   - Conversation caching
   - Error handling

---

## Setup Instructions

### 1. Database Setup

Run the migration to create chatbot tables:

```bash
# Using a migration tool or direct SQL execution
psql -U postgres -d transcend_db -f /transcend-api/migrations/001_create_chatbot_tables.sql
```

This creates:
- `chatbot_conversations` - Conversation records
- `chatbot_messages` - Chat messages
- `knowledge_base_docs` - FAQ/support documents
- `common_questions` - Tracked common questions
- `chatbot_analytics` - Analytics data
- `chatbot_satisfaction_feedback` - User ratings
- `chatbot_escalation_log` - Escalation tracking
- `chatbot_configuration` - System configuration

### 2. Environment Variables

Add to your `.env` file:

```env
# OpenAI Configuration
OPENAI_API_KEY=your_gpt4_api_key_here
OPENAI_MODEL=gpt-4
OPENAI_API_ENDPOINT=https://api.openai.com/v1

# Chatbot Configuration
CHATBOT_MAX_CONTEXT=4000
CHATBOT_ESCALATION_THRESHOLD=0.4
CHATBOT_CONVERSATION_TIMEOUT=30
```

### 3. Backend Integration

Register the chatbot routes in your Express app:

```typescript
// In your main server file (e.g., server.ts)
import chatbotRoutes from './routes/chatbotRoutes';

app.use('/api/chatbot', chatbotRoutes);
```

### 4. Frontend Integration

Add the Chatbot component to your main layout:

```typescript
// In your App.tsx or main layout component
import { Chatbot } from './components/Chatbot';

export function App() {
  return (
    <>
      <YourMainContent />
      <Chatbot />
    </>
  );
}
```

Or use the custom hook for more control:

```typescript
import useChatbot from '../hooks/useChatbot';

export function YourComponent() {
  const {
    conversation,
    isOpen,
    sendMessage,
    escalate,
    submitRating,
  } = useChatbot();

  // Use the chatbot functionality
}
```

### 5. Initialize Knowledge Base

Make an admin API call to initialize the knowledge base:

```bash
curl -X POST http://localhost:3000/api/chatbot/kb/init \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

Or add your custom knowledge base documents:

```bash
curl -X POST http://localhost:3000/api/chatbot/kb/docs \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "How do I update my profile?",
    "content": "To update your profile: 1. Go to Settings 2. Click Profile 3. Edit your information 4. Click Save",
    "category": "Account Management",
    "tags": ["profile", "account", "settings"]
  }'
```

---

## API Endpoints

### Conversation Management

#### Create Conversation
```
POST /api/chatbot/conversations
Authorization: Required (User)
Response: Conversation object
```

#### Get Conversation
```
GET /api/chatbot/conversations/:conversationId
Authorization: Required (User)
Response: Conversation with full message history
```

#### Get User Conversations
```
GET /api/chatbot/conversations
Authorization: Required (User)
Query Params: limit (default: 20)
Response: Array of Conversation objects
```

### Messages

#### Send Message
```
POST /api/chatbot/messages
Authorization: Required (User)
Body: {
  conversationId: string,
  content: string
}
Response: Bot message with confidence score
```

### Escalation

#### Escalate to Agent
```
POST /api/chatbot/escalate
Authorization: Required (User)
Body: {
  conversationId: string,
  reason: string (optional)
}
Response: Escalated Conversation
```

### Feedback

#### Submit Satisfaction Rating
```
POST /api/chatbot/satisfaction
Authorization: Required (User)
Body: {
  conversationId: string,
  rating: 1-5,
  feedback: string (optional)
}
Response: {success: true}
```

#### Close Conversation
```
POST /api/chatbot/close
Authorization: Required (User)
Body: {
  conversationId: string,
  resolution: string (optional)
}
Response: {success: true}
```

### Analytics (Admin Only)

#### Get Chatbot Analytics
```
GET /api/chatbot/analytics
Authorization: Required (Admin)
Query Params:
  - startDate (ISO format, default: 30 days ago)
  - endDate (ISO format, default: today)
Response: ChatbotAnalytics object
```

#### Get Common Questions
```
GET /api/chatbot/common-questions
Authorization: Required (Admin)
Query Params: limit (default: 10)
Response: Array of CommonQuestion objects
```

#### Get Conversation Analytics
```
GET /api/chatbot/analytics/conversation/:conversationId
Authorization: Required (User who owns conversation)
Response: Conversation analytics
```

### Knowledge Base

#### Search Knowledge Base
```
GET /api/chatbot/kb/search
Authorization: Required (User)
Query Params: 
  - q (search query, required)
  - limit (default: 5)
Response: Array of KnowledgeBaseDoc objects
```

#### Add Knowledge Base Document
```
POST /api/chatbot/kb/docs
Authorization: Required (Admin)
Body: {
  title: string,
  content: string,
  category: string,
  tags: string[] (optional)
}
Response: KnowledgeBaseDoc object
```

#### Initialize Knowledge Base
```
POST /api/chatbot/kb/init
Authorization: Required (Admin)
Response: {success: true, message: string}
```

---

## Features

### 1. Conversation Management

- **Create Conversations**: Automatically create new conversations per user session
- **Conversation History**: Maintain full message history with timestamps
- **Conversation States**: active, resolved, escalated, closed
- **Timeout Handling**: Auto-close inactive conversations after 30 minutes

### 2. GPT-4 Integration

- **Natural Language Understanding**: Process complex user queries
- **Context Awareness**: Leverage conversation history for context
- **Knowledge Base Integration**: Reference KB documents in responses
- **Confidence Scoring**: Assess response quality (0-1 scale)

### 3. Knowledge Base

- **Document Management**: Add, update, and manage support documents
- **Semantic Search**: Find relevant documents by keywords or similarity
- **Tagging System**: Organize documents with categories and tags
- **Default Documents**: Pre-populated with common questions

### 4. Escalation Management

- **Automatic Escalation**: Escalate when confidence score is below threshold (40%)
- **Manual Escalation**: Users can request escalation anytime
- **Agent Assignment**: Connect to human support agents
- **Escalation Tracking**: Log all escalations for analysis

### 5. User Satisfaction

- **Star Rating**: 1-5 star satisfaction rating after resolution
- **Optional Feedback**: Collect detailed feedback text
- **Analytics**: Track average satisfaction scores over time
- **Improvement Tracking**: Identify problem areas

### 6. Analytics & Insights

**Available Metrics:**
- Total conversations count
- Resolution rate (resolved / total)
- Escalation rate (escalated / total)
- Average response time
- User satisfaction average
- Top topics discussed
- Most common questions
- Unknown question tracking

**Admin Dashboard Shows:**
- Real-time conversation metrics
- Satisfaction trends
- Escalation patterns
- Knowledge gap identification

---

## Configuration

### Chatbot Configuration Table

System settings are managed in `chatbot_configuration` table:

```sql
SELECT * FROM chatbot_configuration;
```

**Key Configuration Parameters:**

| Key | Value | Description |
|-----|-------|-------------|
| max_context_length | 4000 | Max context for GPT-4 |
| escalation_threshold | 0.4 | Confidence threshold for escalation |
| allowed_model_id | gpt-4 | AI model to use |
| conversation_timeout_minutes | 30 | Session timeout |
| enable_satisfaction_rating | true | Enable feedback collection |
| enable_analytics | true | Track analytics |
| max_escalation_wait_time | 300 | Max wait for agent (seconds) |

---

## UI Customization

### Chatbot Component Props

The Chatbot component uses CSS variables for theming:

```css
:root {
  --chatbot-primary: #2563eb;
  --chatbot-secondary: #f3f4f6;
  --chatbot-border: #e5e7eb;
  --chatbot-text: #1f2937;
  --user-bubble-bg: #2563eb;
  --user-bubble-text: #ffffff;
  --bot-bubble-bg: #f3f4f6;
  --bot-bubble-text: #1f2937;
}
```

### Custom Styling

Override colors in your app's CSS:

```css
:root {
  --chatbot-primary: #your-color;
  --chatbot-secondary: #your-color;
  /* ... other variables */
}
```

### Custom Welcome Messages

Modify the welcome message in `Chatbot.tsx`:

```typescript
<div className="welcome-message">
  <h4>Your Custom Title</h4>
  <p>Your custom message</p>
  <div className="quick-actions">
    <button onClick={() => setMessageInput('Custom action')}>
      Custom Action
    </button>
  </div>
</div>
```

---

## Performance Optimization

### 1. Message Caching
- Implemented in `useChatbot` hook
- Reduces redundant API calls
- Cache stored in useRef

### 2. Message Batching
- Queue messages for batch processing
- Reduces database writes
- Improves response time

### 3. Database Indexes
- Indexes on frequently queried columns
- Fast conversation lookup by user_id
- Message retrieval by conversation_id

### 4. Lazy Loading
- Load older messages on demand
- Implement pagination in conversation history

---

## Security Considerations

### Authentication & Authorization

1. **User Authentication**: All endpoints require valid JWT token
2. **Conversation Ownership**: Verify user owns conversation before access
3. **Admin-Only Endpoints**: Analytics and KB management restricted to admins
4. **Data Isolation**: Users only see their own conversations

### Data Protection

1. **Encryption**: Sensitive data encrypted at rest and in transit
2. **GDPR Compliance**: Support user data deletion
3. **PII Handling**: Avoid storing sensitive personal information
4. **Audit Logging**: Track all admin actions

### API Security

1. **Rate Limiting**: Implement rate limits on message sending
2. **Input Validation**: Validate all user inputs
3. **SQL Injection Prevention**: Use parameterized queries (already done)
4. **CORS Configuration**: Restrict cross-origin requests

---

## Troubleshooting

### Common Issues

#### 1. GPT-4 API Errors
```
Error: OpenAI API key not configured
Solution: Set OPENAI_API_KEY in .env file
```

#### 2. Database Connection Errors
```
Error: Failed to create conversation
Solution: Verify database tables are created via migration
```

#### 3. Escalation Not Working
```
Issue: Low-confidence responses not escalating
Solution: Check escalation_threshold in chatbot_configuration
```

#### 4. Knowledge Base Empty
```
Issue: No documents in knowledge base
Solution: Run POST /api/chatbot/kb/init endpoint
```

---

## Testing

### Unit Tests Example

```typescript
describe('Chatbot Service', () => {
  test('should create conversation', async () => {
    const conv = await createConversation('user-123');
    expect(conv.id).toBeDefined();
    expect(conv.userId).toBe('user-123');
    expect(conv.status).toBe('active');
  });

  test('should save message', async () => {
    const msg = await saveMessage(
      'conv-123',
      'user-123',
      'user',
      'Hello'
    );
    expect(msg.content).toBe('Hello');
    expect(msg.senderType).toBe('user');
  });

  test('should escalate conversation', async () => {
    const escalated = await escalateConversation(
      'conv-123',
      'Need human help'
    );
    expect(escalated.isEscalated).toBe(true);
    expect(escalated.status).toBe('escalated');
  });
});
```

### Integration Tests

```typescript
describe('Chatbot API', () => {
  test('POST /api/chatbot/conversations should create conversation', async () => {
    const response = await request(app)
      .post('/api/chatbot/conversations')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
  });

  test('POST /api/chatbot/messages should send message', async () => {
    const response = await request(app)
      .post('/api/chatbot/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({
        conversationId: 'conv-123',
        content: 'Hello'
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('content');
  });
});
```

---

## Monitoring & Maintenance

### Key Metrics to Monitor

1. **Performance**
   - Average response time (target: <2s)
   - Message processing time
   - Database query performance

2. **Quality**
   - Resolution rate (target: >75%)
   - User satisfaction (target: >4.0/5.0)
   - Escalation rate (monitor for trends)

3. **Reliability**
   - API uptime (target: 99.9%)
   - Failed conversations
   - Database connectivity

### Maintenance Tasks

1. **Weekly**
   - Review escalation logs
   - Update FAQ with common questions
   - Check error logs

2. **Monthly**
   - Analyze analytics reports
   - Update knowledge base
   - Performance review

3. **Quarterly**
   - Full system audit
   - Security review
   - Feature evaluation

---

## Future Enhancements

1. **Multi-language Support**
   - Detect user language
   - Translate conversations
   - Localized KB documents

2. **Advanced Analytics**
   - Predictive escalation
   - Chatbot performance scoring
   - Customer journey mapping

3. **AI Improvements**
   - Fine-tuning on custom data
   - Custom training documents
   - Sentiment analysis

4. **Integration Capabilities**
   - Slack integration
   - Email support tickets
   - SMS notifications

5. **Rich Content**
   - File attachments
   - Image uploads
   - Video support

---

## Support & Resources

- **API Documentation**: See inline comments in route handlers
- **Schema Documentation**: Review SQL migration file
- **Type Definitions**: Check TypeScript interfaces in service files
- **Examples**: See test files for usage examples

---

## Version History

- **v1.0.0** (Initial Release)
  - Conversation management
  - GPT-4 integration
  - Knowledge base search
  - Escalation system
  - Analytics tracking
  - User satisfaction ratings

---

## License

All code follows the Transcend platform licensing terms.
