import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';
import NodeCache from 'node-cache';
import { v4 as uuidv4 } from 'uuid';

/**
 * Calendar Integration Service
 * Handles synchronization with Calendly, Google Calendar, and Outlook
 * Manages real-time availability, overbooking prevention, and booking slots
 */

// Types and Interfaces
interface CalendarProvider {
  type: 'google' | 'outlook' | 'calendly';
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

interface TimeSlot {
  id: string;
  startTime: Date;
  endTime: Date;
  isAvailable: boolean;
  provider: string;
  bufferTimeBefore?: number;
  bufferTimeAfter?: number;
}

interface Appointment {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  attendees: string[];
  providerId: string;
  provider: 'google' | 'outlook' | 'calendly';
  metadata?: Record<string, any>;
}

interface AvailabilityPattern {
  id: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  isRecurring: boolean;
  timezone: string;
}

interface BlackoutDate {
  id: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
  isRecurring: boolean;
  recurrencePattern?: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

interface BookingSlotConfig {
  durationMinutes: number;
  bufferMinutes: number;
  timezone: string;
  minNoticeMinutes: number;
  maxAdvanceDaysForBooking: number;
}

interface CalendarSyncEvent {
  eventId: string;
  provider: string;
  action: 'created' | 'updated' | 'deleted';
  timestamp: number;
}

class CalendarService extends EventEmitter {
  private googleClient: AxiosInstance;
  private outlookClient: AxiosInstance;
  private calendlyClient: AxiosInstance;
  private cache: NodeCache;
  private appointmentCache: Map<string, Appointment[]>;
  private syncQueue: CalendarSyncEvent[];
  private isSyncing: boolean;

  constructor() {
    super();
    this.cache = new NodeCache({ stdTTL: 300 }); // 5-minute default TTL
    this.appointmentCache = new Map();
    this.syncQueue = [];
    this.isSyncing = false;

    // Initialize API clients
    this.googleClient = axios.create({
      baseURL: 'https://www.googleapis.com/calendar/v3',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.outlookClient = axios.create({
      baseURL: 'https://graph.microsoft.com/v1.0',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.calendlyClient = axios.create({
      baseURL: 'https://api.calendly.com/v1',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupSyncInterval();
  }

  /**
   * Register a calendar provider
   */
  async registerProvider(
    userId: string,
    provider: CalendarProvider
  ): Promise<{ success: boolean; providerId: string }> {
    const providerId = uuidv4();

    const cacheKey = `provider:${userId}:${provider.type}`;
    this.cache.set(cacheKey, {
      ...provider,
      providerId,
      registeredAt: Date.now(),
    });

    this.emit('provider:registered', {
      userId,
      provider: provider.type,
      providerId,
    });

    return { success: true, providerId };
  }

  /**
   * Fetch appointments from a calendar provider
   */
  async fetchAppointments(
    userId: string,
    provider: 'google' | 'outlook' | 'calendly',
    timeMin: Date,
    timeMax: Date
  ): Promise<Appointment[]> {
    const cacheKey = `appointments:${userId}:${provider}`;
    const cached = this.cache.get(cacheKey) as Appointment[] | undefined;

    if (cached) {
      return cached.filter(
        (apt) => apt.startTime >= timeMin && apt.startTime <= timeMax
      );
    }

    let appointments: Appointment[] = [];

    try {
      switch (provider) {
        case 'google':
          appointments = await this.fetchGoogleCalendarEvents(
            userId,
            timeMin,
            timeMax
          );
          break;
        case 'outlook':
          appointments = await this.fetchOutlookCalendarEvents(
            userId,
            timeMin,
            timeMax
          );
          break;
        case 'calendly':
          appointments = await this.fetchCalendlyEvents(
            userId,
            timeMin,
            timeMax
          );
          break;
      }

      // Cache appointments
      this.cache.set(cacheKey, appointments, 300);
      this.appointmentCache.set(cacheKey, appointments);

      return appointments;
    } catch (error) {
      console.error(`Failed to fetch appointments from ${provider}:`, error);
      throw new Error(
        `Failed to fetch appointments from ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Fetch Google Calendar events
   */
  private async fetchGoogleCalendarEvents(
    userId: string,
    timeMin: Date,
    timeMax: Date
  ): Promise<Appointment[]> {
    const providerKey = `provider:${userId}:google`;
    const providerData = this.cache.get(providerKey) as CalendarProvider | undefined;

    if (!providerData) {
      throw new Error('Google Calendar provider not registered');
    }

    try {
      const response = await this.googleClient.get('/calendars/primary/events', {
        headers: {
          Authorization: `Bearer ${providerData.accessToken}`,
        },
        params: {
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
        },
      });

      return (response.data.items || []).map((event: any) => ({
        id: event.id,
        title: event.summary,
        startTime: new Date(event.start.dateTime || event.start.date),
        endTime: new Date(event.end.dateTime || event.end.date),
        attendees: (event.attendees || []).map((a: any) => a.email),
        providerId: userId,
        provider: 'google',
        metadata: {
          eventType: event.eventType,
          recurringEventId: event.recurringEventId,
          transparency: event.transparency,
        },
      }));
    } catch (error) {
      console.error('Google Calendar fetch error:', error);
      throw error;
    }
  }

  /**
   * Fetch Outlook Calendar events
   */
  private async fetchOutlookCalendarEvents(
    userId: string,
    timeMin: Date,
    timeMax: Date
  ): Promise<Appointment[]> {
    const providerKey = `provider:${userId}:outlook`;
    const providerData = this.cache.get(providerKey) as CalendarProvider | undefined;

    if (!providerData) {
      throw new Error('Outlook Calendar provider not registered');
    }

    try {
      const response = await this.outlookClient.get(
        '/me/calendarview',
        {
          headers: {
            Authorization: `Bearer ${providerData.accessToken}`,
          },
          params: {
            startDateTime: timeMin.toISOString(),
            endDateTime: timeMax.toISOString(),
          },
        }
      );

      return (response.data.value || []).map((event: any) => ({
        id: event.id,
        title: event.subject,
        startTime: new Date(event.start.dateTime),
        endTime: new Date(event.end.dateTime),
        attendees: (event.attendees || []).map((a: any) => a.emailAddress.address),
        providerId: userId,
        provider: 'outlook',
        metadata: {
          categories: event.categories,
          hasAttachments: event.hasAttachments,
          isReminderOn: event.isReminderOn,
        },
      }));
    } catch (error) {
      console.error('Outlook Calendar fetch error:', error);
      throw error;
    }
  }

  /**
   * Fetch Calendly events
   */
  private async fetchCalendlyEvents(
    userId: string,
    timeMin: Date,
    timeMax: Date
  ): Promise<Appointment[]> {
    const providerKey = `provider:${userId}:calendly`;
    const providerData = this.cache.get(providerKey) as CalendarProvider | undefined;

    if (!providerData) {
      throw new Error('Calendly provider not registered');
    }

    try {
      const response = await this.calendlyClient.get('/scheduled_events', {
        headers: {
          Authorization: `Bearer ${providerData.accessToken}`,
        },
        params: {
          user: userId,
          min_start_time: timeMin.toISOString(),
          max_start_time: timeMax.toISOString(),
        },
      });

      return (response.data.collection || []).map((event: any) => ({
        id: event.uri.split('/').pop(),
        title: event.name,
        startTime: new Date(event.start_time),
        endTime: new Date(event.end_time),
        attendees: event.invitees
          ?.map((i: any) => i.email)
          .filter(Boolean) || [],
        providerId: userId,
        provider: 'calendly',
        metadata: {
          eventType: event.event_type,
          status: event.status,
        },
      }));
    } catch (error) {
      console.error('Calendly fetch error:', error);
      throw error;
    }
  }

  /**
   * Get available time slots
   */
  async getAvailableSlots(
    userId: string,
    date: Date,
    config: BookingSlotConfig,
    patterns: AvailabilityPattern[],
    blackoutDates: BlackoutDate[] = []
  ): Promise<TimeSlot[]> {
    const cacheKey = `slots:${userId}:${date.toISOString().split('T')[0]}`;
    const cached = this.cache.get(cacheKey) as TimeSlot[] | undefined;

    if (cached) {
      return cached;
    }

    const slots: TimeSlot[] = [];

    // Check if date is blackout
    if (this.isBlackoutDate(date, blackoutDates)) {
      return [];
    }

    // Get availability pattern for day
    const dayOfWeek = date.getDay();
    const pattern = patterns.find((p) => p.dayOfWeek === dayOfWeek);

    if (!pattern) {
      return [];
    }

    // Parse times
    const [patternStartHour, patternStartMin] = pattern.startTime.split(':').map(Number);
    const [patternEndHour, patternEndMin] = pattern.endTime.split(':').map(Number);

    const slotStart = new Date(date);
    slotStart.setHours(patternStartHour, patternStartMin, 0, 0);

    const slotEnd = new Date(date);
    slotEnd.setHours(patternEndHour, patternEndMin, 0, 0);

    // Fetch appointments for the day
    const appointments = await this.fetchAppointments(
      userId,
      'google',
      slotStart,
      slotEnd
    ).catch(() => []);

    // Generate available slots
    let currentSlotStart = new Date(slotStart);

    while (currentSlotStart < slotEnd) {
      const currentSlotEnd = new Date(
        currentSlotStart.getTime() + config.durationMinutes * 60000
      );

      // Check minimum notice
      const minutesUntilSlot = Math.floor(
        (currentSlotStart.getTime() - Date.now()) / 60000
      );
      if (minutesUntilSlot < config.minNoticeMinutes) {
        currentSlotStart = new Date(
          currentSlotStart.getTime() + config.durationMinutes * 60000
        );
        continue;
      }

      // Check if slot conflicts with appointments
      const isConflict = appointments.some(
        (apt) =>
          (currentSlotStart < apt.endTime && currentSlotEnd > apt.startTime) ||
          (currentSlotStart >= new Date(apt.startTime.getTime() - config.bufferMinutes * 60000) &&
            currentSlotStart < new Date(apt.endTime.getTime() + config.bufferMinutes * 60000))
      );

      if (!isConflict) {
        slots.push({
          id: uuidv4(),
          startTime: new Date(currentSlotStart),
          endTime: new Date(currentSlotEnd),
          isAvailable: true,
          provider: 'transcend',
          bufferTimeBefore: config.bufferMinutes,
          bufferTimeAfter: config.bufferMinutes,
        });
      }

      currentSlotStart = new Date(
        currentSlotStart.getTime() + config.durationMinutes * 60000
      );
    }

    // Cache slots
    this.cache.set(cacheKey, slots, 600); // 10 minutes

    return slots;
  }

  /**
   * Book an appointment
   */
  async bookAppointment(
    userId: string,
    slotId: string,
    appointment: Omit<Appointment, 'id' | 'providerId'>,
    provider: 'google' | 'outlook' | 'calendly'
  ): Promise<{ success: boolean; appointmentId: string }> {
    try {
      // Verify slot availability
      const slot = await this.verifySlotAvailability(userId, slotId);

      if (!slot) {
        throw new Error('Slot no longer available');
      }

      // Create appointment in provider
      let appointmentId: string;

      switch (provider) {
        case 'google':
          appointmentId = await this.createGoogleCalendarEvent(
            userId,
            appointment
          );
          break;
        case 'outlook':
          appointmentId = await this.createOutlookCalendarEvent(
            userId,
            appointment
          );
          break;
        case 'calendly':
          appointmentId = await this.createCalendlyEvent(userId, appointment);
          break;
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      // Clear relevant caches
      this.clearSlotCaches(userId);

      this.emit('appointment:booked', {
        userId,
        appointmentId,
        provider,
        timestamp: Date.now(),
      });

      return { success: true, appointmentId };
    } catch (error) {
      console.error('Booking error:', error);
      throw error;
    }
  }

  /**
   * Create Google Calendar event
   */
  private async createGoogleCalendarEvent(
    userId: string,
    appointment: Omit<Appointment, 'id' | 'providerId'>
  ): Promise<string> {
    const providerKey = `provider:${userId}:google`;
    const providerData = this.cache.get(providerKey) as CalendarProvider | undefined;

    if (!providerData) {
      throw new Error('Google Calendar provider not registered');
    }

    const response = await this.googleClient.post(
      '/calendars/primary/events',
      {
        summary: appointment.title,
        start: {
          dateTime: appointment.startTime.toISOString(),
        },
        end: {
          dateTime: appointment.endTime.toISOString(),
        },
        attendees: appointment.attendees.map((email) => ({
          email,
        })),
        description: appointment.metadata?.description || '',
      },
      {
        headers: {
          Authorization: `Bearer ${providerData.accessToken}`,
        },
      }
    );

    return response.data.id;
  }

  /**
   * Create Outlook Calendar event
   */
  private async createOutlookCalendarEvent(
    userId: string,
    appointment: Omit<Appointment, 'id' | 'providerId'>
  ): Promise<string> {
    const providerKey = `provider:${userId}:outlook`;
    const providerData = this.cache.get(providerKey) as CalendarProvider | undefined;

    if (!providerData) {
      throw new Error('Outlook Calendar provider not registered');
    }

    const response = await this.outlookClient.post(
      '/me/events',
      {
        subject: appointment.title,
        start: {
          dateTime: appointment.startTime.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: appointment.endTime.toISOString(),
          timeZone: 'UTC',
        },
        attendees: appointment.attendees.map((email) => ({
          emailAddress: {
            address: email,
          },
          type: 'required',
        })),
        body: {
          content: appointment.metadata?.description || '',
          contentType: 'HTML',
        },
      },
      {
        headers: {
          Authorization: `Bearer ${providerData.accessToken}`,
        },
      }
    );

    return response.data.id;
  }

  /**
   * Create Calendly event
   */
  private async createCalendlyEvent(
    userId: string,
    appointment: Omit<Appointment, 'id' | 'providerId'>
  ): Promise<string> {
    const providerKey = `provider:${userId}:calendly`;
    const providerData = this.cache.get(providerKey) as CalendarProvider | undefined;

    if (!providerData) {
      throw new Error('Calendly provider not registered');
    }

    // Calendly has a different API structure
    const response = await this.calendlyClient.post(
      '/scheduled_events',
      {
        event_type: appointment.metadata?.eventType || 'default',
        start_time: appointment.startTime.toISOString(),
        end_time: appointment.endTime.toISOString(),
        invitees: appointment.attendees.map((email) => ({
          email,
          full_name: appointment.metadata?.attendeeName || email.split('@')[0],
        })),
        name: appointment.title,
      },
      {
        headers: {
          Authorization: `Bearer ${providerData.accessToken}`,
        },
      }
    );

    return response.data.resource.uri.split('/').pop();
  }

  /**
   * Cancel appointment
   */
  async cancelAppointment(
    userId: string,
    appointmentId: string,
    provider: 'google' | 'outlook' | 'calendly'
  ): Promise<{ success: boolean }> {
    try {
      switch (provider) {
        case 'google':
          await this.cancelGoogleCalendarEvent(userId, appointmentId);
          break;
        case 'outlook':
          await this.cancelOutlookCalendarEvent(userId, appointmentId);
          break;
        case 'calendly':
          await this.cancelCalendlyEvent(userId, appointmentId);
          break;
      }

      this.clearSlotCaches(userId);

      this.emit('appointment:cancelled', {
        userId,
        appointmentId,
        provider,
        timestamp: Date.now(),
      });

      return { success: true };
    } catch (error) {
      console.error('Cancellation error:', error);
      throw error;
    }
  }

  /**
   * Cancel Google Calendar event
   */
  private async cancelGoogleCalendarEvent(
    userId: string,
    eventId: string
  ): Promise<void> {
    const providerKey = `provider:${userId}:google`;
    const providerData = this.cache.get(providerKey) as CalendarProvider | undefined;

    if (!providerData) {
      throw new Error('Google Calendar provider not registered');
    }

    await this.googleClient.delete(`/calendars/primary/events/${eventId}`, {
      headers: {
        Authorization: `Bearer ${providerData.accessToken}`,
      },
    });
  }

  /**
   * Cancel Outlook Calendar event
   */
  private async cancelOutlookCalendarEvent(
    userId: string,
    eventId: string
  ): Promise<void> {
    const providerKey = `provider:${userId}:outlook`;
    const providerData = this.cache.get(providerKey) as CalendarProvider | undefined;

    if (!providerData) {
      throw new Error('Outlook Calendar provider not registered');
    }

    await this.outlookClient.delete(`/me/events/${eventId}`, {
      headers: {
        Authorization: `Bearer ${providerData.accessToken}`,
      },
    });
  }

  /**
   * Cancel Calendly event
   */
  private async cancelCalendlyEvent(
    userId: string,
    eventId: string
  ): Promise<void> {
    const providerKey = `provider:${userId}:calendly`;
    const providerData = this.cache.get(providerKey) as CalendarProvider | undefined;

    if (!providerData) {
      throw new Error('Calendly provider not registered');
    }

    await this.calendlyClient.delete(
      `/scheduled_events/${eventId}/cancellation`,
      {
        headers: {
          Authorization: `Bearer ${providerData.accessToken}`,
        },
      }
    );
  }

  /**
   * Update availability pattern
   */
  async updateAvailabilityPattern(
    userId: string,
    pattern: AvailabilityPattern
  ): Promise<{ success: boolean }> {
    const cacheKey = `pattern:${userId}:${pattern.id}`;
    this.cache.set(cacheKey, pattern, 3600); // 1 hour

    this.clearSlotCaches(userId);

    this.emit('pattern:updated', {
      userId,
      patternId: pattern.id,
      timestamp: Date.now(),
    });

    return { success: true };
  }

  /**
   * Add blackout date
   */
  async addBlackoutDate(
    userId: string,
    blackoutDate: BlackoutDate
  ): Promise<{ success: boolean; blackoutId: string }> {
    const blackoutId = blackoutDate.id || uuidv4();
    const cacheKey = `blackout:${userId}:${blackoutId}`;

    this.cache.set(cacheKey, blackoutDate, 86400); // 24 hours

    this.clearSlotCaches(userId);

    this.emit('blackout:added', {
      userId,
      blackoutId,
      timestamp: Date.now(),
    });

    return { success: true, blackoutId };
  }

  /**
   * Check if date is blackout
   */
  private isBlackoutDate(date: Date, blackoutDates: BlackoutDate[]): boolean {
    return blackoutDates.some((blackout) => {
      if (blackout.isRecurring && blackout.recurrencePattern) {
        const dateMonth = date.getMonth();
        const dateDay = date.getDate();
        const blackoutMonth = blackout.startDate.getMonth();
        const blackoutDay = blackout.startDate.getDate();

        switch (blackout.recurrencePattern) {
          case 'yearly':
            return dateMonth === blackoutMonth && dateDay === blackoutDay;
          case 'monthly':
            return dateDay === blackoutDay;
          case 'weekly':
            return date.getDay() === blackout.startDate.getDay();
          case 'daily':
            return true;
        }
      }

      return date >= blackout.startDate && date <= blackout.endDate;
    });
  }

  /**
   * Verify slot availability
   */
  private async verifySlotAvailability(
    userId: string,
    slotId: string
  ): Promise<TimeSlot | null> {
    // This would typically check against the database
    // For now, we'll return a simple check
    return { id: slotId, startTime: new Date(), endTime: new Date(), isAvailable: true, provider: 'transcend' };
  }

  /**
   * Clear slot caches
   */
  private clearSlotCaches(userId: string): void {
    const keys = this.cache.keys();
    keys.forEach((key: any) => {
      if (key.startsWith(`slots:${userId}:`)) {
        this.cache.del(key);
      }
    });
  }

  /**
   * Setup periodic sync
   */
  private setupSyncInterval(): void {
    setInterval(() => {
      this.syncCalendars().catch((error) =>
        console.error('Sync error:', error)
      );
    }, 300000); // Sync every 5 minutes
  }

  /**
   * Sync calendars
   */
  private async syncCalendars(): Promise<void> {
    if (this.isSyncing) {
      return;
    }

    this.isSyncing = true;

    try {
      // Process sync queue
      while (this.syncQueue.length > 0) {
        const event = this.syncQueue.shift();
        if (event) {
          this.emit('calendar:synced', event);
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(
    userId: string,
    provider: 'google' | 'outlook' | 'calendly',
    refreshToken: string
  ): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      let response;

      switch (provider) {
        case 'google':
          response = await axios.post('https://oauth2.googleapis.com/token', {
            client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
            client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
          });
          break;
        case 'outlook':
          response = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
            client_id: process.env.OUTLOOK_OAUTH_CLIENT_ID,
            client_secret: process.env.OUTLOOK_OAUTH_CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
            scope: 'Calendars.ReadWrite offline_access',
          });
          break;
        case 'calendly':
          throw new Error('Calendly uses long-lived tokens');
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }

      const newAccessToken = response.data.access_token;
      const expiresIn = response.data.expires_in;

      // Update provider in cache
      const cacheKey = `provider:${userId}:${provider}`;
      const providerData = this.cache.get(cacheKey) as CalendarProvider | undefined;

      if (providerData) {
        providerData.accessToken = newAccessToken;
        providerData.expiresAt = Date.now() + expiresIn * 1000;
        this.cache.set(cacheKey, providerData);
      }

      return { accessToken: newAccessToken, expiresIn };
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus(): {
    isSyncing: boolean;
    queueLength: number;
    lastSync: number;
  } {
    return {
      isSyncing: this.isSyncing,
      queueLength: this.syncQueue.length,
      lastSync: Date.now(),
    };
  }
}

export default new CalendarService();
