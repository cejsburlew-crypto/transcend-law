// Notification fatigue preferences.
//
// NotificationPreferences.tsx imported this module, which did not exist - so
// that component never typechecked. The shapes below are derived from the
// component's own usage (channels, categories, quiet hours, batching, metrics).
//
// The type is named NotificationPreferencesConfig rather than
// NotificationPreferences: the component exports a React component under that
// name, and importing a same-named type produced a merged-declaration error.
//
// Persistence goes through the API; nothing here caches privileged content.

export type AutoReduceMode = 'digest' | 'hide_low_priority' | 'defer' | 'disabled';

export type NotificationChannel = 'push' | 'email' | 'sms' | 'in_app';

export interface ChannelPreference {
  enabled: boolean;
  /** Immediate, or rolled into a digest. */
  frequency?: 'immediate' | 'hourly' | 'daily' | 'weekly';
  /** Cap on notifications per day for this channel. */
  dailyLimit?: number;
}

export interface CategoryPreference {
  enabled: boolean;
  /** Lowest priority that still notifies for this category. */
  minPriority?: 'low' | 'normal' | 'high' | 'urgent';
  /** Channels this category may use; empty means inherit the global setting. */
  channels?: NotificationChannel[];
}

export interface QuietHours {
  enabled: boolean;
  /** 24h local time, "HH:MM". */
  startTime: string;
  endTime: string;
  timezone?: string;
  /** Urgent notifications may still break through quiet hours. */
  allowUrgentDuringQuietHours?: boolean;
}

export interface BatchingPreferences {
  enabled: boolean;
  batchWindowMinutes: number;
  minNotificationsToTriggerBatch: number;
}

export interface NotificationPreferencesConfig {
  userId: string;
  channels: Record<NotificationChannel, ChannelPreference>;
  categories: Record<string, CategoryPreference>;
  quietHours: QuietHours;
  batchingPreferences: BatchingPreferences;
  /**
   * How to throttle once the daily count crosses the threshold. Was typed
   * boolean, but the UI offers four strategies and compares by name.
   */
  autoReduceMode: AutoReduceMode;
  autoReduceThreshold: number;
  mutedCategories: string[];
  /** Date so callers can compare directly with `new Date()`. */
  mutedUntil: Date | null;
  snoozedUntil: Date | null;
}

export interface NotificationMetrics {
  totalSent: number;
  totalEngaged: number;
  /** Percentage, 0-100. */
  engagementRate: number;
  date: string;
}

const DEFAULTS: Omit<NotificationPreferencesConfig, 'userId'> = {
  channels: {
    push: { enabled: true, frequency: 'immediate', dailyLimit: 20 },
    email: { enabled: true, frequency: 'immediate', dailyLimit: 20 },
    sms: { enabled: false, frequency: 'immediate', dailyLimit: 5 },
    in_app: { enabled: true, frequency: 'immediate', dailyLimit: 50 },
  },
  categories: {
    case_update: { enabled: true, minPriority: 'normal', channels: ['push', 'email', 'in_app'] },
    message: { enabled: true, minPriority: 'normal', channels: ['push', 'email', 'in_app'] },
    payment: { enabled: true, minPriority: 'normal', channels: ['email', 'in_app'] },
    deadline: { enabled: true, minPriority: 'high', channels: ['push', 'email', 'sms', 'in_app'] },
    system: { enabled: true, minPriority: 'low', channels: ['in_app'] },
  },
  quietHours: { enabled: false, startTime: '22:00', endTime: '07:00', allowUrgentDuringQuietHours: true },
  batchingPreferences: { enabled: false, batchWindowMinutes: 30, minNotificationsToTriggerBatch: 3 },
  autoReduceMode: 'disabled',
  autoReduceThreshold: 20,
  mutedCategories: [],
  mutedUntil: null,
  snoozedUntil: null,
};

const BASE = '/api/v2/notifications/preferences';

/** JSON has no Date type; revive the two timestamp fields after transport. */
const reviveDates = (prefs: NotificationPreferencesConfig): NotificationPreferencesConfig => ({
  ...prefs,
  mutedUntil: prefs.mutedUntil ? new Date(prefs.mutedUntil) : null,
  snoozedUntil: prefs.snoozedUntil ? new Date(prefs.snoozedUntil) : null,
});

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!response.ok) throw new Error(`${init?.method || 'GET'} ${url} failed: ${response.status}`);
  return (await response.json()) as T;
};

export const NotificationFatigueService = {
  /**
   * Load preferences, falling back to defaults so the UI always renders.
   * A preferences fetch failure must not blank the settings screen.
   */
  async getOrCreatePreferences(userId: string): Promise<NotificationPreferencesConfig> {
    try {
      return reviveDates(await request<NotificationPreferencesConfig>(`${BASE}/${encodeURIComponent(userId)}`));
    } catch (error) {
      console.warn('[notifications] using default preferences:', (error as Error).message);
      return { userId, ...DEFAULTS };
    }
  },

  async updatePreferences(
    userId: string,
    updates: Partial<NotificationPreferencesConfig>
  ): Promise<NotificationPreferencesConfig> {
    return reviveDates(
      await request<NotificationPreferencesConfig>(`${BASE}/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      })
    );
  },

  async getNotificationMetrics(userId: string, date: Date): Promise<NotificationMetrics> {
    const day = date.toISOString().slice(0, 10);
    try {
      return await request<NotificationMetrics>(
        `${BASE}/${encodeURIComponent(userId)}/metrics?date=${day}`
      );
    } catch {
      return { totalSent: 0, totalEngaged: 0, engagementRate: 0, date: day };
    }
  },

  /** Mute everything for a duration in minutes. */
  async muteNotifications(userId: string, durationMinutes: number): Promise<NotificationPreferencesConfig> {
    return this.updatePreferences(userId, {
      mutedUntil: new Date(Date.now() + durationMinutes * 60_000),
    });
  },

  /** Snooze everything for a duration in minutes. */
  async snoozeNotifications(userId: string, durationMinutes: number): Promise<NotificationPreferencesConfig> {
    return this.updatePreferences(userId, {
      snoozedUntil: new Date(Date.now() + durationMinutes * 60_000),
    });
  },
};

export default NotificationFatigueService;
