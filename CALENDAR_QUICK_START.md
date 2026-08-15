# Calendar Integration - Quick Start Guide

## Files Created

### Backend Services
- **`transcend-api/src/services/calendarService.ts`** - Core calendar service (1000+ lines)
  - Provider registration and management
  - Appointment fetching and booking
  - Slot availability calculation
  - Time zone and buffer management
  - Real-time synchronization

- **`transcend-api/src/services/calendarIntegrationExample.ts`** - API routes and examples
  - Express route handlers
  - OAuth callback implementations
  - Comprehensive API endpoints
  - Error handling patterns

- **`transcend-api/database/calendar-schema.sql`** - Database schema
  - 8 core tables with proper indexing
  - Views for common queries
  - Stored procedures
  - Audit logging

### Frontend Components
- **`transcend-frontend/src/components/AvailabilityCalendar.tsx`** - React component
  - Calendar UI with month navigation
  - Provider management
  - Real-time slot display
  - Booking interface
  - Blackout date management

- **`transcend-frontend/src/components/AvailabilityCalendar.css`** - Styling
  - Responsive design
  - Light/dark theme support
  - Accessible UI patterns

### Documentation
- **`CALENDAR_INTEGRATION_GUIDE.md`** - Comprehensive guide
  - Architecture overview
  - Feature descriptions
  - API documentation
  - Usage examples

## 5-Minute Setup

### Step 1: Database Setup

```bash
# Connect to your MySQL database
mysql -u root -p your_database

# Run the schema
source transcend-api/database/calendar-schema.sql
```

### Step 2: Environment Variables

Add to `.env`:

```env
# Google Calendar
GOOGLE_OAUTH_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your_secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:5000/api/calendar/auth/google/callback

# Outlook Calendar
OUTLOOK_OAUTH_CLIENT_ID=your_client_id
OUTLOOK_OAUTH_CLIENT_SECRET=your_secret
OUTLOOK_OAUTH_REDIRECT_URI=http://localhost:5000/api/calendar/auth/outlook/callback

# Calendly
CALENDLY_API_KEY=your_api_key

# Application
APP_URL=http://localhost:5000
```

### Step 3: Install Dependencies

```bash
cd transcend-api
npm install axios node-cache uuid
npm install --save-dev @types/node-cache

cd ../transcend-frontend
npm install axios
```

### Step 4: Register Routes

In `transcend-api/src/server.ts` or your main Express file:

```typescript
import calendarRoutes from './services/calendarIntegrationExample';

// After other middleware
app.use('/api/calendar', calendarRoutes);
```

### Step 5: Use Component

In `transcend-frontend/src/pages/BookingPage.tsx`:

```tsx
import AvailabilityCalendar from '../components/AvailabilityCalendar';

export default function BookingPage() {
  const userId = getCurrentUserId(); // Your auth method

  return (
    <AvailabilityCalendar
      userId={userId}
      serviceType="legal-consultation"
      onBookingComplete={(appointmentId) => {
        // Handle successful booking
        alert(`Appointment booked: ${appointmentId}`);
      }}
    />
  );
}
```

## Core Features Checklist

### Multi-Provider Support
- [x] Google Calendar integration
- [x] Outlook Calendar integration
- [x] Calendly integration
- [x] OAuth 2.0 authentication
- [x] Token refresh mechanism

### Availability Management
- [x] Recurring availability patterns
- [x] Blackout dates (single, recurring)
- [x] Time zone handling
- [x] Buffer time between appointments
- [x] Minimum notice requirements

### Booking System
- [x] Real-time slot availability
- [x] Overbooking prevention
- [x] Appointment creation
- [x] Appointment cancellation
- [x] Conflict detection

### User Interface
- [x] Month-view calendar
- [x] Provider selector
- [x] Time slot grid
- [x] Booking form
- [x] Responsive design
- [x] Dark mode support

### Backend Architecture
- [x] Service layer pattern
- [x] Event emitter for notifications
- [x] Caching strategy
- [x] Error handling
- [x] Logging/audit trail

## Common Tasks

### Add a Google Calendar Provider

```typescript
// Backend
const result = await calendarService.registerProvider('user123', {
  type: 'google',
  accessToken: 'gtoken_...',
  refreshToken: 'refresh_...',
  expiresAt: Date.now() + 3600000,
});

console.log('Provider ID:', result.providerId);
```

### Get Available Slots for Tomorrow

```typescript
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);

const slots = await calendarService.getAvailableSlots(
  'user123',
  tomorrow,
  {
    durationMinutes: 60,
    bufferMinutes: 15,
    timezone: 'America/Los_Angeles',
    minNoticeMinutes: 60,
    maxAdvanceDaysForBooking: 90,
  },
  patterns,
  blackoutDates
);

console.log(`Found ${slots.length} available slots`);
```

### Book an Appointment

```typescript
const booking = await calendarService.bookAppointment(
  'user123',
  'slot_id_456',
  {
    title: 'Consultation',
    startTime: slot.startTime,
    endTime: slot.endTime,
    attendees: ['client@example.com'],
    provider: 'google',
  },
  'google'
);

console.log('Booked appointment:', booking.appointmentId);
```

### Set Availability Pattern

```typescript
await calendarService.updateAvailabilityPattern('user123', {
  id: 'pattern_monday',
  dayOfWeek: 1, // Monday
  startTime: '09:00',
  endTime: '17:00',
  isRecurring: true,
  timezone: 'America/Los_Angeles',
});
```

### Add Blackout Date

```typescript
await calendarService.addBlackoutDate('user123', {
  id: 'vacation_2024',
  startDate: new Date('2024-08-20'),
  endDate: new Date('2024-08-27'),
  reason: 'Summer vacation',
  isRecurring: false,
});
```

## Deployment Checklist

### Pre-Deployment
- [ ] OAuth credentials obtained from all providers
- [ ] Environment variables configured
- [ ] Database schema applied
- [ ] SSL certificates installed
- [ ] CORS properly configured
- [ ] Rate limiting configured
- [ ] Error monitoring set up (Sentry, etc.)

### Database
- [ ] Schema migration completed
- [ ] Indexes verified
- [ ] Backups configured
- [ ] Permissions set up

### Security
- [ ] Token encryption enabled
- [ ] HTTPS enforced
- [ ] CSRF protection active
- [ ] Input validation enabled
- [ ] Rate limiting active
- [ ] Audit logging enabled

### Testing
- [ ] Unit tests for calendar service
- [ ] Integration tests with mock providers
- [ ] E2E tests for booking flow
- [ ] Load testing completed
- [ ] Error scenarios tested

### Monitoring
- [ ] Error tracking enabled
- [ ] Performance monitoring active
- [ ] Sync status logging
- [ ] API response times tracked
- [ ] Provider availability monitored

## Performance Optimization

### Cache Configuration
```typescript
// In calendarService.ts
private cache: nodeCache.NodeCache;

constructor() {
  // 5-minute TTL for slots
  this.cache = new nodeCache({ stdTTL: 300 });
  
  // Override for specific cache keys
  this.cache.set(key, value, 600); // 10 minutes
}
```

### Database Optimization
```sql
-- Index critical columns
CREATE INDEX idx_user_date ON appointments(userId, DATE(start_time));
CREATE INDEX idx_provider_sync ON calendar_providers(provider_type, last_sync);

-- Regular maintenance
ANALYZE TABLE calendar_providers;
OPTIMIZE TABLE appointments;
```

### Frontend Performance
- Component memoization with React.memo
- CSS Grid for calendar rendering
- Lazy loading of month data
- Virtual scrolling for large slot lists

## Troubleshooting

### Issue: "Provider not registered"
```typescript
// Check if provider is registered
const provider = await db.query(
  'SELECT * FROM calendar_providers WHERE userId = ? AND provider_type = ?',
  [userId, providerType]
);

if (!provider) {
  // Register provider first
  await calendarService.registerProvider(userId, providerData);
}
```

### Issue: Slots showing as unavailable
```typescript
// Check appointment conflicts
const conflicts = await db.query(
  `SELECT * FROM appointments 
   WHERE userId = ? AND DATE(start_time) = ? 
   AND status = 'confirmed'`,
  [userId, selectedDate]
);

// Verify pattern exists for day
const pattern = await db.query(
  'SELECT * FROM availability_patterns WHERE userId = ? AND day_of_week = ?',
  [userId, dayOfWeek]
);
```

### Issue: Token refresh failing
```typescript
// Manually refresh token
try {
  const result = await calendarService.refreshAccessToken(
    userId,
    provider,
    refreshToken
  );
  console.log('New token expires in:', result.expiresIn);
} catch (error) {
  console.error('Token refresh failed:', error);
  // Re-authenticate required
}
```

## API Response Examples

### Get Available Slots
```json
{
  "slots": [
    {
      "id": "slot_123",
      "startTime": "2024-08-20T09:00:00.000Z",
      "endTime": "2024-08-20T10:00:00.000Z",
      "isAvailable": true,
      "provider": "transcend",
      "bufferTimeBefore": 15,
      "bufferTimeAfter": 15
    }
  ]
}
```

### Book Appointment
```json
{
  "success": true,
  "appointmentId": "apt_xyz789"
}
```

### Get Sync Status
```json
{
  "syncStatus": {
    "isSyncing": false,
    "queueLength": 0,
    "lastSync": 1724163142000
  }
}
```

## Next Steps

1. **Customize UI**: Modify colors/styles in `AvailabilityCalendar.css`
2. **Add Notifications**: Integrate email/SMS reminders
3. **Analytics**: Track booking trends and availability
4. **AI Integration**: Predict optimal availability slots
5. **Mobile App**: Create React Native version of component

## Support Resources

- **Google Calendar API**: https://developers.google.com/calendar
- **Microsoft Graph API**: https://docs.microsoft.com/graph
- **Calendly API**: https://calendly.com/api-docs
- **Database**: MySQL 5.7+

## Version History

- **v1.0.0** (2024-08-15)
  - Initial release
  - Multi-provider support
  - Calendar UI component
  - Full booking workflow

---

**Last Updated**: August 15, 2024
**Maintained By**: Transcend Development Team
