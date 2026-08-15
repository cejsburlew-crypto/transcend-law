import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './AvailabilityCalendar.css';

/**
 * Availability Calendar Component
 * Manages booking slots, displays provider integrations, and handles appointments
 */

interface TimeSlot {
  id: string;
  startTime: Date;
  endTime: Date;
  isAvailable: boolean;
  provider: string;
  bufferTimeBefore?: number;
  bufferTimeAfter?: number;
}

interface AvailabilityPattern {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
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

interface CalendarProvider {
  type: 'google' | 'outlook' | 'calendly';
  isConnected: boolean;
  lastSync?: number;
}

interface AvailabilityCalendarProps {
  userId: string;
  serviceType?: string;
  onSlotSelected?: (slot: TimeSlot) => void;
  onBookingComplete?: (appointmentId: string) => void;
  showProviderSelector?: boolean;
  defaultTimeZone?: string;
}

const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = ({
  userId,
  serviceType = 'general',
  onSlotSelected,
  onBookingComplete,
  showProviderSelector = true,
  defaultTimeZone = 'America/Los_Angeles',
}) => {
  // State Management
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [providers, setProviders] = useState<Map<string, CalendarProvider>>(
    new Map([
      ['google', { type: 'google', isConnected: false }],
      ['outlook', { type: 'outlook', isConnected: false }],
      ['calendly', { type: 'calendly', isConnected: false }],
    ])
  );
  const [selectedProvider, setSelectedProvider] = useState<'google' | 'outlook' | 'calendly'>('google');
  const [patterns, setPatterns] = useState<AvailabilityPattern[]>([]);
  const [blackoutDates, setBlackoutDates] = useState<BlackoutDate[]>([]);
  const [bookingConfig, setBookingConfig] = useState<BookingSlotConfig>({
    durationMinutes: 60,
    bufferMinutes: 15,
    timezone: defaultTimeZone,
    minNoticeMinutes: 60,
    maxAdvanceDaysForBooking: 90,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingDetails, setBookingDetails] = useState({
    title: '',
    attendeeEmail: '',
    description: '',
  });
  const [syncStatus, setSyncStatus] = useState({
    isSyncing: false,
    queueLength: 0,
    lastSync: Date.now(),
  });

  // Fetch providers status
  useEffect(() => {
    fetchProvidersStatus();
  }, [userId]);

  // Fetch availability patterns
  useEffect(() => {
    fetchAvailabilityPatterns();
  }, [userId]);

  // Fetch blackout dates
  useEffect(() => {
    fetchBlackoutDates();
  }, [userId]);

  // Load time slots when date is selected
  useEffect(() => {
    if (selectedDate) {
      fetchTimeSlots(selectedDate);
    }
  }, [selectedDate, selectedProvider, bookingConfig]);

  // Sync calendar periodically
  useEffect(() => {
    const syncInterval = setInterval(() => {
      syncCalendars();
    }, 300000); // Every 5 minutes

    return () => clearInterval(syncInterval);
  }, [userId]);

  /**
   * Fetch providers connection status
   */
  const fetchProvidersStatus = async () => {
    try {
      const response = await axios.get(
        `/api/calendar/providers/status?userId=${userId}`
      );

      const newProviders = new Map(providers);
      Object.entries(response.data.providers).forEach(([key, data]: [string, any]) => {
        newProviders.set(key, {
          type: key as 'google' | 'outlook' | 'calendly',
          isConnected: data.isConnected,
          lastSync: data.lastSync,
        });
      });

      setProviders(newProviders);
    } catch (err) {
      console.error('Failed to fetch providers status:', err);
    }
  };

  /**
   * Fetch availability patterns
   */
  const fetchAvailabilityPatterns = async () => {
    try {
      const response = await axios.get(
        `/api/calendar/patterns?userId=${userId}`
      );

      const patternData = response.data.patterns || [];
      setPatterns(
        patternData.map((p: any) => ({
          ...p,
          startTime: p.startTime || '09:00',
          endTime: p.endTime || '17:00',
        }))
      );

      // If no patterns, create defaults
      if (patternData.length === 0) {
        createDefaultPatterns();
      }
    } catch (err) {
      console.error('Failed to fetch patterns:', err);
    }
  };

  /**
   * Create default availability patterns
   */
  const createDefaultPatterns = async () => {
    const defaultPatterns: AvailabilityPattern[] = [
      { id: '1', dayOfWeek: 1, startTime: '09:00', endTime: '17:00', isRecurring: true, timezone: bookingConfig.timezone }, // Monday
      { id: '2', dayOfWeek: 2, startTime: '09:00', endTime: '17:00', isRecurring: true, timezone: bookingConfig.timezone }, // Tuesday
      { id: '3', dayOfWeek: 3, startTime: '09:00', endTime: '17:00', isRecurring: true, timezone: bookingConfig.timezone }, // Wednesday
      { id: '4', dayOfWeek: 4, startTime: '09:00', endTime: '17:00', isRecurring: true, timezone: bookingConfig.timezone }, // Thursday
      { id: '5', dayOfWeek: 5, startTime: '09:00', endTime: '17:00', isRecurring: true, timezone: bookingConfig.timezone }, // Friday
    ];

    setPatterns(defaultPatterns);

    try {
      await axios.post(`/api/calendar/patterns`, {
        userId,
        patterns: defaultPatterns,
      });
    } catch (err) {
      console.error('Failed to create default patterns:', err);
    }
  };

  /**
   * Fetch blackout dates
   */
  const fetchBlackoutDates = async () => {
    try {
      const response = await axios.get(
        `/api/calendar/blackout-dates?userId=${userId}`
      );

      const blackoutData = response.data.blackoutDates || [];
      setBlackoutDates(
        blackoutData.map((b: any) => ({
          ...b,
          startDate: new Date(b.startDate),
          endDate: new Date(b.endDate),
        }))
      );
    } catch (err) {
      console.error('Failed to fetch blackout dates:', err);
    }
  };

  /**
   * Fetch available time slots
   */
  const fetchTimeSlots = useCallback(
    async (date: Date) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await axios.get(`/api/calendar/slots`, {
          params: {
            userId,
            date: date.toISOString().split('T')[0],
            provider: selectedProvider,
            durationMinutes: bookingConfig.durationMinutes,
            bufferMinutes: bookingConfig.bufferMinutes,
            timezone: bookingConfig.timezone,
            minNoticeMinutes: bookingConfig.minNoticeMinutes,
          },
        });

        setTimeSlots(
          response.data.slots.map((slot: any) => ({
            ...slot,
            startTime: new Date(slot.startTime),
            endTime: new Date(slot.endTime),
          }))
        );
      } catch (err) {
        setError('Failed to load available slots');
        console.error('Failed to fetch slots:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [userId, selectedProvider, bookingConfig]
  );

  /**
   * Sync calendars
   */
  const syncCalendars = async () => {
    try {
      const response = await axios.post(`/api/calendar/sync`, {
        userId,
        providers: Array.from(providers.keys()).filter(
          (key) => providers.get(key)?.isConnected
        ),
      });

      setSyncStatus(response.data.syncStatus);
      fetchProvidersStatus();
    } catch (err) {
      console.error('Failed to sync calendars:', err);
    }
  };

  /**
   * Connect provider
   */
  const connectProvider = async (provider: 'google' | 'outlook' | 'calendly') => {
    try {
      const response = await axios.get(`/api/calendar/auth/${provider}`, {
        params: { userId, redirectUri: window.location.href },
      });

      window.location.href = response.data.authUrl;
    } catch (err) {
      setError(`Failed to connect ${provider}`);
      console.error(`Failed to connect ${provider}:`, err);
    }
  };

  /**
   * Handle slot selection
   */
  const handleSlotSelect = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setShowBookingForm(true);
    onSlotSelected?.(slot);
  };

  /**
   * Handle booking
   */
  const handleBooking = async () => {
    if (!selectedSlot || !bookingDetails.title || !bookingDetails.attendeeEmail) {
      setError('Please fill in all required fields');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post(`/api/calendar/book`, {
        userId,
        slotId: selectedSlot.id,
        appointment: {
          title: bookingDetails.title,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          attendees: [bookingDetails.attendeeEmail],
          provider: selectedProvider,
          metadata: {
            description: bookingDetails.description,
            serviceType,
          },
        },
      });

      onBookingComplete?.(response.data.appointmentId);

      // Reset form
      setShowBookingForm(false);
      setSelectedSlot(null);
      setBookingDetails({ title: '', attendeeEmail: '', description: '' });

      // Refresh slots
      if (selectedDate) {
        fetchTimeSlots(selectedDate);
      }
    } catch (err) {
      setError('Failed to complete booking');
      console.error('Booking error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Add blackout date
   */
  const addBlackoutDate = async (startDate: Date, endDate: Date, reason?: string) => {
    try {
      const response = await axios.post(`/api/calendar/blackout-dates`, {
        userId,
        blackoutDate: {
          startDate,
          endDate,
          reason,
          isRecurring: false,
        },
      });

      setBlackoutDates([...blackoutDates, response.data.blackoutDate]);
      setError(null);
    } catch (err) {
      setError('Failed to add blackout date');
      console.error('Failed to add blackout date:', err);
    }
  };

  /**
   * Get days in month
   */
  const getDaysInMonth = (date: Date): Date[] => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    const days: Date[] = [];
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  /**
   * Check if date is blackout
   */
  const isBlackoutDate = (date: Date): boolean => {
    return blackoutDates.some(
      (blackout) => date >= blackout.startDate && date <= blackout.endDate
    );
  };

  /**
   * Check if date has available slots
   */
  const hasAvailableSlots = (date: Date): boolean => {
    if (isBlackoutDate(date)) return false;
    if (date < new Date()) return false;

    const dayOfWeek = date.getDay();
    return patterns.some((p) => p.dayOfWeek === dayOfWeek);
  };

  const days = getDaysInMonth(currentDate);
  const firstDayOfWeek = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const emptyDays = Array(firstDayOfWeek).fill(null);

  return (
    <div className="availability-calendar">
      <div className="calendar-header">
        <h2>Availability Calendar</h2>
        <div className="sync-status">
          {syncStatus.isSyncing ? (
            <span className="syncing">Syncing...</span>
          ) : (
            <span className="synced">
              Last sync: {new Date(syncStatus.lastSync).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Provider Selector */}
      {showProviderSelector && (
        <div className="provider-section">
          <h3>Calendar Providers</h3>
          <div className="provider-selector">
            {Array.from(providers.entries()).map(([key, provider]) => (
              <div key={key} className="provider-option">
                <label>
                  <input
                    type="radio"
                    name="provider"
                    value={key}
                    checked={selectedProvider === key}
                    onChange={(e) =>
                      setSelectedProvider(e.target.value as 'google' | 'outlook' | 'calendly')
                    }
                    disabled={!provider.isConnected}
                  />
                  <span className="provider-name">
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </span>
                </label>

                {provider.isConnected ? (
                  <span className="connected-badge">Connected</span>
                ) : (
                  <button
                    className="connect-btn"
                    onClick={() => connectProvider(key as 'google' | 'outlook' | 'calendly')}
                  >
                    Connect
                  </button>
                )}

                {provider.lastSync && (
                  <span className="last-sync">
                    {new Date(provider.lastSync).toLocaleString()}
                  </span>
                )}
              </div>
            ))}
          </div>

          <button className="sync-btn" onClick={syncCalendars} disabled={syncStatus.isSyncing}>
            {syncStatus.isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      )}

      {/* Mini Calendar Navigation */}
      <div className="calendar-navigation">
        <button
          onClick={() =>
            setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
          }
        >
          ← Previous
        </button>

        <h3>
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>

        <button
          onClick={() =>
            setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
          }
        >
          Next →
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="calendar-grid">
        <div className="weekday-header">
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>

        <div className="days-grid">
          {emptyDays.map((_, index) => (
            <div key={`empty-${index}`} className="empty-day" />
          ))}

          {days.map((day) => {
            const isToday = day.toDateString() === new Date().toDateString();
            const isSelected = selectedDate?.toDateString() === day.toDateString();
            const isBlackout = isBlackoutDate(day);
            const hasSlots = hasAvailableSlots(day);

            return (
              <div
                key={day.toISOString()}
                className={`day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${
                  isBlackout ? 'blackout' : ''
                } ${hasSlots ? 'has-slots' : 'no-slots'}`}
                onClick={() => hasSlots && setSelectedDate(day)}
              >
                <span className="day-number">{day.getDate()}</span>
                {isBlackout && <span className="blackout-indicator">●</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Time Slots */}
      {selectedDate && (
        <div className="time-slots-section">
          <h3>Available Times - {selectedDate.toLocaleDateString()}</h3>

          {isLoading ? (
            <div className="loading">Loading available slots...</div>
          ) : timeSlots.length > 0 ? (
            <div className="time-slots-grid">
              {timeSlots.map((slot) => (
                <button
                  key={slot.id}
                  className={`time-slot ${selectedSlot?.id === slot.id ? 'selected' : ''}`}
                  onClick={() => handleSlotSelect(slot)}
                >
                  {slot.startTime.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' - '}
                  {slot.endTime.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </button>
              ))}
            </div>
          ) : (
            <div className="no-slots">No available slots for this date</div>
          )}
        </div>
      )}

      {/* Booking Form */}
      {showBookingForm && selectedSlot && (
        <div className="booking-form-section">
          <h3>Book Appointment</h3>

          <div className="form-group">
            <label>Appointment Title *</label>
            <input
              type="text"
              value={bookingDetails.title}
              onChange={(e) =>
                setBookingDetails({ ...bookingDetails, title: e.target.value })
              }
              placeholder="e.g., Consultation with Attorney"
            />
          </div>

          <div className="form-group">
            <label>Your Email *</label>
            <input
              type="email"
              value={bookingDetails.attendeeEmail}
              onChange={(e) =>
                setBookingDetails({ ...bookingDetails, attendeeEmail: e.target.value })
              }
              placeholder="your.email@example.com"
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={bookingDetails.description}
              onChange={(e) =>
                setBookingDetails({ ...bookingDetails, description: e.target.value })
              }
              placeholder="Additional details about your appointment..."
              rows={3}
            />
          </div>

          <div className="form-actions">
            <button
              className="btn-primary"
              onClick={handleBooking}
              disabled={isLoading}
            >
              {isLoading ? 'Booking...' : 'Confirm Booking'}
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setShowBookingForm(false);
                setSelectedSlot(null);
              }}
              disabled={isLoading}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AvailabilityCalendar;
