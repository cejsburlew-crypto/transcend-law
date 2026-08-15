/**
 * Calendar Integration Type Definitions
 * Comprehensive type system for all calendar-related operations
 */

// ============================================
// Provider Types
// ============================================

export type CalendarProviderType = 'google' | 'outlook' | 'calendly';

export interface CalendarProvider {
  type: CalendarProviderType;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface CalendarProviderWithId extends CalendarProvider {
  providerId: string;
  registeredAt: number;
}

export interface ProviderStatus {
  type: CalendarProviderType;
  isConnected: boolean;
  lastSync?: number;
}

export interface ProviderStatusResponse {
  providers: Record<CalendarProviderType, ProviderStatus>;
}

// ============================================
// Appointment Types
// ============================================

export interface Appointment {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  attendees: string[];
  providerId: string;
  provider: CalendarProviderType;
  metadata?: Record<string, any>;
}

export interface AppointmentCreateRequest {
  title: string;
  startTime: Date;
  endTime: Date;
  attendees: string[];
  provider: CalendarProviderType;
  metadata?: Record<string, any>;
}

export interface AppointmentResponse {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  attendees: string[];
  provider: CalendarProviderType;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
}

export type AppointmentStatus = 'confirmed' | 'cancelled' | 'tentative';

// ============================================
// Time Slot Types
// ============================================

export interface TimeSlot {
  id: string;
  startTime: Date;
  endTime: Date;
  isAvailable: boolean;
  provider: string;
  bufferTimeBefore?: number;
  bufferTimeAfter?: number;
}

export interface TimeSlotsResponse {
  slots: TimeSlot[];
  totalCount: number;
  date: string;
}

// ============================================
// Availability Pattern Types
// ============================================

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sunday-Saturday

export interface AvailabilityPattern {
  id: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  isRecurring: boolean;
  timezone: string;
}

export interface AvailabilityPatternCreateRequest {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  timezone: string;
}

export interface AvailabilityPatternResponse {
  id: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  timezone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Blackout Date Types
// ============================================

export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface BlackoutDate {
  id: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
  isRecurring: boolean;
  recurrencePattern?: RecurrencePattern;
}

export interface BlackoutDateCreateRequest {
  startDate: Date;
  endDate: Date;
  reason?: string;
  isRecurring?: boolean;
  recurrencePattern?: RecurrencePattern;
}

export interface BlackoutDateResponse {
  id: string;
  startDate: string;
  endDate: string;
  reason?: string;
  isRecurring: boolean;
  recurrencePattern?: RecurrencePattern;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Booking Configuration Types
// ============================================

export interface BookingSlotConfig {
  durationMinutes: number;
  bufferMinutes: number;
  timezone: string;
  minNoticeMinutes: number;
  maxAdvanceDaysForBooking: number;
}

export interface BookingConfiguration extends BookingSlotConfig {
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BookingConfigUpdateRequest {
  durationMinutes?: number;
  bufferMinutes?: number;
  timezone?: string;
  minNoticeMinutes?: number;
  maxAdvanceDaysForBooking?: number;
}

// ============================================
// Booking Request/Response Types
// ============================================

export interface BookingRequest {
  userId: string;
  slotId: string;
  appointment: AppointmentCreateRequest;
}

export interface BookingResponse {
  success: boolean;
  appointmentId: string;
  confirmationDetails?: {
    bookingTime: string;
    estimatedDuration: number;
    attendees: string[];
    provider: CalendarProviderType;
  };
}

export interface BookingCancellationRequest {
  userId: string;
  appointmentId: string;
  provider: CalendarProviderType;
  reason?: string;
}

export interface BookingCancellationResponse {
  success: boolean;
  cancelledAt: string;
}

// ============================================
// Sync Types
// ============================================

export type SyncAction = 'created' | 'updated' | 'deleted';

export interface CalendarSyncEvent {
  eventId: string;
  provider: CalendarProviderType;
  action: SyncAction;
  timestamp: number;
}

export interface SyncStatus {
  isSyncing: boolean;
  queueLength: number;
  lastSync: number;
}

export interface SyncRequest {
  userId: string;
  providers: CalendarProviderType[];
}

export interface SyncResponse {
  success: boolean;
  syncStatus: SyncStatus;
}

export interface SyncLog {
  id: string;
  userId: string;
  provider: CalendarProviderType;
  syncAction: SyncAction;
  eventId?: string;
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
  syncTimestamp: Date;
  completedAt?: Date;
}

// ============================================
// OAuth Types
// ============================================

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType?: string;
  scope?: string;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface GoogleOAuthToken extends OAuthToken {
  idToken?: string;
}

export interface OutlookOAuthToken extends OAuthToken {
  refreshTokenExpiresIn?: number;
}

// ============================================
// Query Parameter Types
// ============================================

export interface GetSlotsQuery {
  userId: string;
  date: string; // YYYY-MM-DD
  provider?: CalendarProviderType;
  durationMinutes?: number;
  bufferMinutes?: number;
  timezone?: string;
  minNoticeMinutes?: number;
}

export interface GetAppointmentsQuery {
  userId: string;
  startDate: string; // ISO string
  endDate: string; // ISO string
  provider?: CalendarProviderType;
  status?: AppointmentStatus;
  pageSize?: number;
  page?: number;
}

export interface GetPatternsQuery {
  userId: string;
  isActive?: boolean;
}

export interface GetBlackoutDatesQuery {
  userId: string;
  startDate?: string;
  endDate?: string;
  isRecurring?: boolean;
}

// ============================================
// Error Types
// ============================================

export class CalendarError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, any>;

  constructor(
    message: string,
    code: string,
    statusCode: number = 400,
    details?: Record<string, any>
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, CalendarError.prototype);
  }
}

export class ProviderAuthError extends CalendarError {
  constructor(provider: CalendarProviderType, message?: string) {
    super(
      message || `Failed to authenticate with ${provider}`,
      'PROVIDER_AUTH_ERROR',
      401,
      { provider }
    );
  }
}

export class SlotNotAvailableError extends CalendarError {
  constructor(slotId: string) {
    super(
      `Slot ${slotId} is no longer available`,
      'SLOT_NOT_AVAILABLE',
      409,
      { slotId }
    );
  }
}

export class BookingConflictError extends CalendarError {
  constructor(message: string, conflictingAppointments: Appointment[]) {
    super(
      message,
      'BOOKING_CONFLICT',
      409,
      { conflicts: conflictingAppointments }
    );
  }
}

export class ProviderNotRegisteredError extends CalendarError {
  constructor(userId: string, provider: CalendarProviderType) {
    super(
      `Provider ${provider} is not registered for user ${userId}`,
      'PROVIDER_NOT_REGISTERED',
      404,
      { userId, provider }
    );
  }
}

// ============================================
// Event Types
// ============================================

export interface AppointmentBookedEvent {
  userId: string;
  appointmentId: string;
  provider: CalendarProviderType;
  timestamp: number;
}

export interface AppointmentCancelledEvent {
  userId: string;
  appointmentId: string;
  provider: CalendarProviderType;
  timestamp: number;
}

export interface PatternUpdatedEvent {
  userId: string;
  patternId: string;
  timestamp: number;
}

export interface BlackoutAddedEvent {
  userId: string;
  blackoutId: string;
  timestamp: number;
}

export interface ProviderRegisteredEvent {
  userId: string;
  provider: CalendarProviderType;
  providerId: string;
}

export interface CalendarSyncedEvent {
  eventId: string;
  provider: CalendarProviderType;
  action: SyncAction;
  timestamp: number;
}

// ============================================
// API Response Wrapper Types
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

// ============================================
// Utility Types
// ============================================

export type DateRange = {
  startDate: Date;
  endDate: Date;
};

export type TimeRange = {
  startTime: string;
  endTime: string;
};

export type TimezoneOffset = {
  timezone: string;
  offset: number;
  isDst: boolean;
};

// ============================================
// Database Model Types (if using ORM)
// ============================================

export interface CalendarProviderModel {
  id: string;
  userId: string;
  provider_type: CalendarProviderType;
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AvailabilityPatternModel {
  id: string;
  userId: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  is_recurring: boolean;
  timezone: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AppointmentModel {
  id: string;
  userId: string;
  title: string;
  start_time: Date;
  end_time: Date;
  attendees: string[];
  provider: CalendarProviderType;
  provider_event_id?: string;
  status: AppointmentStatus;
  timezone: string;
  created_at: Date;
  updated_at: Date;
  cancelled_at?: Date;
}

export interface BlackoutDateModel {
  id: string;
  userId: string;
  start_date: Date;
  end_date: Date;
  reason?: string;
  is_recurring: boolean;
  recurrence_pattern?: RecurrencePattern;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// Configuration Types
// ============================================

export interface CalendarServiceConfig {
  providers: {
    google?: OAuthConfig;
    outlook?: OAuthConfig;
    calendly?: {
      apiKey: string;
      baseUrl: string;
    };
  };
  cache: {
    defaultTtl: number;
    slotsCacheTtl: number;
  };
  sync: {
    interval: number; // milliseconds
    batchSize: number;
  };
  booking: {
    defaultDuration: number;
    defaultBuffer: number;
    maxAdvanceDays: number;
  };
}

// ============================================
// Utility Functions Type
// ============================================

export type TimeZoneConverter = (
  date: Date,
  fromTz: string,
  toTz: string
) => Date;

export type SlotValidator = (
  slot: TimeSlot,
  config: BookingSlotConfig,
  appointments: Appointment[]
) => boolean;

export type PatternMatcher = (
  date: Date,
  patterns: AvailabilityPattern[]
) => AvailabilityPattern | null;
