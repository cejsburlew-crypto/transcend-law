# Availability Calendar Integration Guide

## Overview

The Availability Calendar Integration system provides a comprehensive solution for managing appointment scheduling across multiple calendar providers (Google Calendar, Outlook, Calendly). It handles real-time availability, overbooking prevention, timezone management, and recurring availability patterns.

## Architecture

### Backend Services

#### Calendar Service (`transcend-api/src/services/calendarService.ts`)

The core service that handles all calendar operations:

- **Provider Management**: Register and manage multiple calendar providers
- **Appointment Sync**: Fetch appointments from external providers
- **Slot Availability**: Calculate available booking slots based on patterns and blackout dates
- **Booking Management**: Create and cancel appointments across providers
- **Real-time Sync**: Periodically sync calendars with external providers

### Frontend Component

#### Availability Calendar (`transcend-frontend/src/components/AvailabilityCalendar.tsx`)

React component that provides:

- Calendar view with month navigation
- Provider connection management
- Real-time slot availability display
- Appointment booking interface
- Blackout date management

## Key Features

### 1. Multi-Provider Support

#### Google Calendar
- OAuth 2.0 authentication
- Full calendar read/write permissions
- Event synchronization
- Attendee management

#### Outlook Calendar
- Microsoft Graph API integration
- OAuth 2.0 authentication
- Calendar events management
- Real-time synchronization

#### Calendly
- Event type management
- Automated scheduling
- Attendee tracking
- Integration with Calendly ecosystem

### 2. Real-time Availability

- **Appointment Fetching**: Retrieves all appointments from connected providers
- **Slot Calculation**: Generates available booking slots based on:
  - Availability patterns (recurring hours)
  - Appointment conflicts
  - Buffer times between appointments
  - Minimum notice requirements
  - Timezone conversions

### 3. Overbooking Prevention

The system prevents overbooking through:

- Slot verification at booking time
- Buffer time enforcement between appointments
- Conflict detection with existing appointments
- Real-time appointment syncing
- Transactional booking confirmation

### 4. Time Zone Handling

- Provider-level timezone support
- Client-side timezone conversion
- UTC-based storage and calculation
- Automatic DST adjustment
- User-configurable timezone preference

### 5. Booking Configuration

```typescript
interface BookingSlotConfig {
  durationMinutes: number;        // Length of booking slots (default: 60)
  bufferMinutes: number;          // Buffer time between appointments (default: 15)
  timezone: string;               // User's timezone (default: America/Los_Angeles)
  minNoticeMinutes: number;       // Advance notice required (default: 60)
  maxAdvanceDaysForBooking: number; // How far in advance bookings allowed (default: 90)
}
```

### 6. Recurring Availability Patterns

Define availability by day of week:

```typescript
interface AvailabilityPattern {
  id: string;
  dayOfWeek: number;        // 0-6 (Sunday-Saturday)
  startTime: string;        // HH:mm format
  endTime: string;          // HH:mm format
  isRecurring: boolean;     // Is this a recurring pattern
  timezone: string;         // Timezone for this pattern
}
```

**Example Patterns**:
- Monday-Friday: 9:00 AM - 5:00 PM (Eastern Time)
- Wednesday: 2:00 PM - 4:00 PM (Office hours only)
- Saturday: 10:00 AM - 12:00 PM (Available alternate weeks)

### 7. Blackout Dates

Block unavailable dates with recurring support:

```typescript
interface BlackoutDate {
  id: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
  isRecurring: boolean;
  recurrencePattern?: 'daily' | 'weekly' | 'monthly' | 'yearly';
}
```

**Examples**:
- Single day: Office closed (2024-08-15)
- Date range: Company retreat (2024-08-20 to 2024-08-23)
- Annual: July 4th holiday (recurring yearly)
- Monthly: Third Friday of each month

## Installation

### Backend Setup

1. **Install Dependencies**

```bash
npm install axios node-cache uuid
npm install --save-dev @types/node-cache
```

2. **Environment Variables**

Add to `.env`:

```env
# Google Calendar OAuth
GOOGLE_OAUTH_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:5000/api/calendar/auth/google/callback

# Outlook Calendar OAuth
OUTLOOK_OAUTH_CLIENT_ID=your_client_id
OUTLOOK_OAUTH_CLIENT_SECRET=your_client_secret
OUTLOOK_OAUTH_REDIRECT_URI=http://localhost:5000/api/calendar/auth/outlook/callback

# Calendly API
CALENDLY_API_KEY=your_api_key

# Application
APP_URL=http://localhost:5000
```

3. **Register Routes**

In your Express app:

```typescript
import calendarRoutes from './services/calendarIntegrationExample';

app.use('/api/calendar', calendarRoutes);
```

### Frontend Setup

1. **Import Component**

```tsx
import AvailabilityCalendar from './components/AvailabilityCalendar';

function App() {
  return (
    <AvailabilityCalendar
      userId="user123"
      serviceType="legal-consultation"
      onSlotSelected={(slot) => console.log('Selected:', slot)}
      onBookingComplete={(appointmentId) => console.log('Booked:', appointmentId)}
      defaultTimeZone="America/New_York"
    />
  );
}
```

2. **CSS Integration**

The component includes all required styles in `AvailabilityCalendar.css`. Ensure CSS is imported:

```tsx
import './AvailabilityCalendar.css';
```

## API Endpoints

### Calendar Management

#### Get Provider Status
```
GET /api/calendar/providers/status?userId=USER_ID
```

Returns connection status and last sync time for all providers.

#### Get Availability Patterns
```
GET /api/calendar/patterns?userId=USER_ID
```

Retrieves recurring availability patterns for the user.

#### Create Availability Patterns
```
POST /api/calendar/patterns
Body: { userId, patterns: AvailabilityPattern[] }
```

### Appointment Management

#### Get Available Slots
```
GET /api/calendar/slots?userId=USER_ID&date=YYYY-MM-DD&durationMinutes=60
```

Returns available booking slots for the specified date.

#### Book Appointment
```
POST /api/calendar/book
Body: {
  userId,
  slotId,
  appointment: {
    title,
    startTime,
    endTime,
    attendees: string[],
    provider: 'google' | 'outlook' | 'calendly'
  }
}
```

#### Cancel Appointment
```
POST /api/calendar/cancel
Body: { userId, appointmentId, provider }
```

#### Fetch Appointments
```
GET /api/calendar/appointments?userId=USER_ID&startDate=ISO_DATE&endDate=ISO_DATE&provider=google
```

### Blackout Dates

#### Get Blackout Dates
```
GET /api/calendar/blackout-dates?userId=USER_ID
```

#### Add Blackout Date
```
POST /api/calendar/blackout-dates
Body: {
  userId,
  blackoutDate: {
    startDate,
    endDate,
    reason?: string,
    isRecurring: boolean,
    recurrencePattern?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  }
}
```

### Synchronization

#### Sync Calendars
```
POST /api/calendar/sync
Body: { userId, providers: string[] }
```

Triggers synchronization with specified providers.

#### Get Sync Status
```
GET /api/calendar/sync/status
```

Returns current sync status and queue information.

## OAuth Implementation

### Google Calendar OAuth Flow

1. **Generate Authorization URL**

```typescript
const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.append('client_id', GOOGLE_OAUTH_CLIENT_ID);
authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
authUrl.searchParams.append('response_type', 'code');
authUrl.searchParams.append('scope', 'https://www.googleapis.com/auth/calendar');
authUrl.searchParams.append('prompt', 'consent');
```

2. **Handle Callback**

Exchange authorization code for tokens at `/api/calendar/auth/google/callback`

3. **Store Tokens**

Securely store access and refresh tokens in database

### Outlook Calendar OAuth Flow

Similar process using Microsoft Graph endpoints:
- Authorization: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
- Token Exchange: `https://login.microsoftonline.com/common/oauth2/v2.0/token`

### Calendly Integration

Calendly uses a simpler token-based approach:
1. User provides API token
2. Register token with calendar service
3. Long-lived tokens (no refresh needed)

## Usage Examples

### Example 1: Basic Calendar Display

```tsx
<AvailabilityCalendar
  userId="john@example.com"
  serviceType="legal-consultation"
  showProviderSelector={true}
/>
```

### Example 2: With Booking Callback

```tsx
const handleBookingComplete = (appointmentId: string) => {
  console.log('Appointment booked:', appointmentId);
  // Redirect to confirmation page
  window.location.href = `/confirmation/${appointmentId}`;
};

<AvailabilityCalendar
  userId="john@example.com"
  onBookingComplete={handleBookingComplete}
/>
```

### Example 3: Custom Configuration

```tsx
<AvailabilityCalendar
  userId="john@example.com"
  serviceType="tax-preparation"
  defaultTimeZone="America/New_York"
  onSlotSelected={(slot) => {
    console.log('Selected slot:', slot);
  }}
/>
```

### Example 4: Backend Service Usage

```typescript
import calendarService from './services/calendarService';

// Register a provider
const result = await calendarService.registerProvider('user123', {
  type: 'google',
  accessToken: 'token_abc123',
  refreshToken: 'refresh_xyz789',
  expiresAt: Date.now() + 3600000,
});

// Get available slots
const slots = await calendarService.getAvailableSlots(
  'user123',
  new Date('2024-08-20'),
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

// Book appointment
const booking = await calendarService.bookAppointment(
  'user123',
  slotId,
  {
    title: 'Consultation',
    startTime: slot.startTime,
    endTime: slot.endTime,
    attendees: ['client@example.com'],
    provider: 'google',
  },
  'google'
);
```

## Database Schema

### Providers Table

```sql
CREATE TABLE calendar_providers (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL,
  provider_type ENUM('google', 'outlook', 'calendly') NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at BIGINT,
  connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_sync TIMESTAMP,
  UNIQUE KEY unique_provider (userId, provider_type)
);
```

### Availability Patterns Table

```sql
CREATE TABLE availability_patterns (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL,
  day_of_week INT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_recurring BOOLEAN DEFAULT TRUE,
  timezone VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_pattern (userId, day_of_week)
);
```

### Blackout Dates Table

```sql
CREATE TABLE blackout_dates (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason VARCHAR(255),
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern ENUM('daily', 'weekly', 'monthly', 'yearly'),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Appointments Table

```sql
CREATE TABLE appointments (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  attendees JSON,
  provider ENUM('google', 'outlook', 'calendly') NOT NULL,
  provider_event_id VARCHAR(255),
  status ENUM('confirmed', 'cancelled') DEFAULT 'confirmed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## Security Considerations

### Token Management
- Store tokens encrypted in database
- Use secure cookies for token transmission
- Implement token refresh before expiration
- Clear tokens on logout

### API Protection
- Require authentication middleware on all endpoints
- Validate user ownership of resources
- Rate limiting per user
- CSRF protection

### Data Privacy
- Encrypt sensitive data in transit (HTTPS)
- Encrypt sensitive data at rest
- Comply with GDPR/CCPA requirements
- Audit all calendar access

## Performance Optimization

### Caching Strategy

The service implements multi-level caching:

1. **In-Memory Cache**: 5-minute TTL for slots and appointments
2. **Database Cache**: Long-lived storage for patterns and blackout dates
3. **Client-Side Cache**: Redux or context for UI state

### Optimization Tips

1. Batch fetch appointments for multiple days
2. Use timezone-aware queries
3. Index on userId and date columns
4. Implement pagination for large result sets
5. Use background jobs for sync operations

## Troubleshooting

### Common Issues

#### Issue: "Slot no longer available"
**Solution**: Implement optimistic locking or check slot availability immediately before booking

#### Issue: Timezone mismatches
**Solution**: Always store times in UTC, convert for display only

#### Issue: Sync delays
**Solution**: Implement real-time webhooks with calendar providers instead of polling

#### Issue: Token expiration errors
**Solution**: Implement automatic token refresh before expiration

## Monitoring & Logging

### Key Metrics to Track

- Average slot availability
- Booking success rate
- Sync frequency and performance
- API response times
- Error rates by provider

### Logging Example

```typescript
calendarService.on('appointment:booked', (event) => {
  logger.info('Appointment booked', {
    userId: event.userId,
    appointmentId: event.appointmentId,
    provider: event.provider,
    timestamp: event.timestamp,
  });
});

calendarService.on('calendar:synced', (event) => {
  logger.info('Calendar synced', {
    provider: event.provider,
    action: event.action,
    timestamp: event.timestamp,
  });
});
```

## Future Enhancements

1. **AI-Powered Slot Prediction**: Use ML to predict optimal availability
2. **Automated Rescheduling**: Auto-reschedule conflicts
3. **SMS/Email Reminders**: Send appointment reminders
4. **Video Conference Integration**: Auto-generate Zoom/Teams links
5. **Analytics Dashboard**: Track booking trends and availability

## Support & Contributing

For issues or improvements:
1. Check existing documentation
2. Review error logs and sync status
3. Consult API provider documentation
4. Submit bug reports with detailed logs

## License

This calendar integration system is part of the Transcend platform.
