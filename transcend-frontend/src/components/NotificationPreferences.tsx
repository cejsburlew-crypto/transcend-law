// Notification Preferences Component
// User interface for managing notification settings, quiet hours, batching, and fatigue controls

import React, { useState, useEffect } from 'react';
// Aliased: this file exports a React component named NotificationPreferences,
// so importing a type of the same name is a merged-declaration conflict.
import {
  NotificationPreferencesConfig as NotificationPreferencesData,
  NotificationFatigueService,
} from '../services/notificationFatigue';
import './NotificationPreferences.css';

interface TabType {
  id: 'channels' | 'categories' | 'schedule' | 'batching' | 'analytics';
  label: string;
  icon: string;
}

const TABS: TabType[] = [
  { id: 'channels', label: 'Channels', icon: '📱' },
  { id: 'categories', label: 'Categories', icon: '📂' },
  { id: 'schedule', label: 'Quiet Hours', icon: '🌙' },
  { id: 'batching', label: 'Batching', icon: '📦' },
  { id: 'analytics', label: 'Analytics', icon: '📊' },
];

// Formatting helpers.
// These were attached via `NotificationPreferences.prototype` and called as
// `this.getChannelIcon(...)` inside a function component - where `this` is
// undefined, so every call threw at runtime. Now plain module functions.
const getChannelIcon = (channel: string) => {
  const icons: Record<string, string> = {
    push: '📲',
    email: '📧',
    sms: '💬',
    in_app: '🔔',
  };
  return icons[channel] || '📬';
};

const getCategoryIcon = (category: string) => {
  const icons: Record<string, string> = {
    case_update: '📋',
    message: '💬',
    payment: '💰',
    deadline: '⏰',
    system: '⚙️',
    marketing: '📢',
  };
  return icons[category] || '📬';
};

const formatChannelName = (channel: string) => {
  return channel.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

const formatCategoryName = (category: string) => {
  return category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

const formatMode = (mode: string) => {
  const modes: Record<string, string> = {
    digest: 'Daily Digest',
    hide_low_priority: 'Hide Low Priority',
    defer: 'Defer to Later',
    disabled: 'Disabled',
  };
  return modes[mode] || mode;
};

const getCategoryDescription = (category: string) => {
  const descriptions: Record<string, string> = {
    case_update: 'Updates on your cases and legal matters',
    message: 'Messages from attorneys and service providers',
    payment: 'Payment confirmations and billing updates',
    deadline: 'Important upcoming deadlines and reminders',
    system: 'System maintenance and status updates',
    marketing: 'Promotional content and announcements',
  };
  return descriptions[category] || 'Notification category';
};

const getFatigueClass = (score: number) => {
  if (score < 25) return 'low';
  if (score < 50) return 'medium';
  if (score < 75) return 'high';
  return 'critical';
};

const getFatigueLevel = (score: number) => {
  if (score < 25) return 'Low - You\'re managing notifications well';
  if (score < 50) return 'Medium - Consider adjusting your preferences';
  if (score < 75) return 'High - You may be receiving too many notifications';
  return 'Critical - Notifications are significantly reduced';
};


export const NotificationPreferences: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType['id']>('channels');
  const [preferences, setPreferences] = useState<NotificationPreferencesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [muteDropdown, setMuteDropdown] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    void loadPreferences();
    void loadMetrics();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const userId = (window as any).currentUserId; // Get from auth context
      const prefs = await NotificationFatigueService.getOrCreatePreferences(userId);
      setPreferences(prefs);
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async () => {
    try {
      const userId = (window as any).currentUserId;
      const todayMetrics = await NotificationFatigueService.getNotificationMetrics(userId, new Date());
      setMetrics(todayMetrics);
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
  };

  const savePreferences = async () => {
    if (!preferences) return;

    try {
      setSaving(true);
      const userId = (window as any).currentUserId;
      await NotificationFatigueService.updatePreferences(userId, preferences);
      setSavedMessage('Preferences saved successfully!');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Error saving preferences:', error);
      setSavedMessage('Error saving preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleChannelChange = (channel: keyof typeof preferences.channels, field: string, value: any) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      channels: {
        ...preferences.channels,
        [channel]: {
          ...preferences.channels[channel],
          [field]: value,
        },
      },
    });
  };

  const handleCategoryChange = (category: string, field: string, value: any) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      categories: {
        ...preferences.categories,
        [category]: {
          ...preferences.categories[category],
          [field]: value,
        },
      },
    });
  };

  const handleQuietHoursChange = (field: string, value: any) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      quietHours: {
        ...preferences.quietHours,
        [field]: value,
      },
    });
  };

  const handleBatchingChange = (field: string, value: any) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      batchingPreferences: {
        ...preferences.batchingPreferences,
        [field]: value,
      },
    });
  };

  const handleMute = async (durationMinutes: number, category?: string) => {
    try {
      const userId = (window as any).currentUserId;
      if (category) {
        if (!preferences?.mutedCategories.includes(category)) {
          setPreferences({
            ...preferences,
            mutedCategories: [...(preferences?.mutedCategories || []), category],
          });
        }
      } else {
        await NotificationFatigueService.muteNotifications(userId, durationMinutes);
        setPreferences({
          ...preferences,
          mutedUntil: new Date(Date.now() + durationMinutes * 60 * 1000),
        });
      }
      setMuteDropdown(false);
      setSavedMessage(`Notifications muted for ${durationMinutes} minutes`);
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Error muting notifications:', error);
    }
  };

  const handleSnooze = async (durationMinutes: number) => {
    try {
      const userId = (window as any).currentUserId;
      await NotificationFatigueService.snoozeNotifications(userId, durationMinutes);
      setPreferences({
        ...preferences,
        snoozedUntil: new Date(Date.now() + durationMinutes * 60 * 1000),
      });
      setSavedMessage(`Notifications snoozed for ${durationMinutes} minutes`);
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Error snoozing notifications:', error);
    }
  };

  const isMuted = preferences?.mutedUntil && new Date() < preferences.mutedUntil;
  const isSnoozed = preferences?.snoozedUntil && new Date() < preferences.snoozedUntil;

  if (loading) {
    return <div className="notification-prefs-loading">Loading notification preferences...</div>;
  }

  if (!preferences) {
    return <div className="notification-prefs-error">Failed to load preferences</div>;
  }

  return (
    <div className="notification-preferences">
      <div className="notification-prefs-header">
        <h1>📬 Notification Preferences</h1>
        <p>Control how and when you receive notifications</p>

        {/* Quick Actions */}
        <div className="quick-actions">
          <div className="mute-dropdown">
            <button
              className={`quick-action-btn ${isMuted ? 'active' : ''}`}
              onClick={() => setMuteDropdown(!muteDropdown)}
              title="Mute notifications"
            >
              🔕 Mute {isMuted && '(Active)'}
            </button>
            {muteDropdown && (
              <div className="dropdown-menu">
                <button onClick={() => void handleMute(15)}>15 minutes</button>
                <button onClick={() => void handleMute(60)}>1 hour</button>
                <button onClick={() => void handleMute(480)}>8 hours</button>
                <button onClick={() => void handleMute(1440)}>1 day</button>
              </div>
            )}
          </div>

          <button
            className={`quick-action-btn ${isSnoozed ? 'active' : ''}`}
            onClick={() => void handleSnooze(120)}
            title="Snooze notifications"
          >
            ⏸️ Snooze 2h
          </button>

          <button className="quick-action-btn" onClick={() => void loadMetrics()} title="Refresh metrics">
            🔄 Refresh
          </button>
        </div>

        {/* Status Messages */}
        {isMuted && (
          <div className="status-banner muted">
            🔕 Notifications muted until {preferences.mutedUntil?.toLocaleTimeString()}
          </div>
        )}
        {isSnoozed && (
          <div className="status-banner snoozed">
            ⏸️ Notifications snoozed until {preferences.snoozedUntil?.toLocaleTimeString()}
          </div>
        )}
        {savedMessage && <div className="status-banner saved">{savedMessage}</div>}
      </div>

      {/* Tab Navigation */}
      <div className="notification-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="notification-prefs-content">
        {/* Channels Tab */}
        {activeTab === 'channels' && (
          <div className="tab-pane channels-tab">
            <h2>Notification Channels</h2>
            <p className="section-description">Configure which channels you want to receive notifications through</p>

            <div className="channels-grid">
              {Object.entries(preferences.channels).map(([channel, config]) => (
                <div key={channel} className="channel-card">
                  <div className="channel-header">
                    <h3>{getChannelIcon(channel as any)} {formatChannelName(channel)}</h3>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={config.enabled}
                        onChange={(e) => void handleChannelChange(channel as any, 'enabled', e.target.checked)}
                      />
                      <span className="toggle-switch"></span>
                    </label>
                  </div>

                  {config.enabled && (
                    <div className="channel-settings">
                      <div className="setting-group">
                        <label>
                          Daily Limit:
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={config.dailyLimit || 20}
                            onChange={(e) => void handleChannelChange(channel as any, 'dailyLimit', parseInt(e.target.value))}
                          />
                          <span className="setting-help">notifications/day</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="section-group">
              <h3>Auto-Reduce Settings</h3>
              <div className="setting-group">
                <label>
                  Reduce notifications if exceeding:
                  <input
                    type="number"
                    min="5"
                    max="50"
                    value={preferences.autoReduceThreshold}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        autoReduceThreshold: parseInt(e.target.value),
                      })
                    }
                  />
                  <span className="setting-help">notifications/day</span>
                </label>
              </div>

              <div className="setting-group">
                <label>Auto-Reduce Mode:</label>
                <div className="radio-group">
                  {['digest', 'hide_low_priority', 'defer', 'disabled'].map((mode) => (
                    <label key={mode} className="radio-label">
                      <input
                        type="radio"
                        checked={preferences.autoReduceMode === mode}
                        onChange={() =>
                          setPreferences({
                            ...preferences,
                            autoReduceMode: mode as any,
                          })
                        }
                      />
                      <span>{formatMode(mode)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div className="tab-pane categories-tab">
            <h2>Notification Categories</h2>
            <p className="section-description">Choose which notification types you want to receive</p>

            <div className="categories-list">
              {Object.entries(preferences.categories).map(([category, config]) => (
                <div key={category} className="category-item">
                  <div className="category-header">
                    <div className="category-info">
                      <h3>{getCategoryIcon(category)} {formatCategoryName(category)}</h3>
                      <p className="category-description">{getCategoryDescription(category)}</p>
                    </div>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={config?.enabled || false}
                        onChange={(e) => void handleCategoryChange(category, 'enabled', e.target.checked)}
                      />
                      <span className="toggle-switch"></span>
                    </label>
                  </div>

                  {config?.enabled && (
                    <div className="category-settings">
                      <div className="setting-group">
                        <label>Minimum Priority:</label>
                        <select
                          value={config.minPriority || 'normal'}
                          onChange={(e) => void handleCategoryChange(category, 'minPriority', e.target.value)}
                        >
                          <option value="urgent">Urgent</option>
                          <option value="high">High</option>
                          <option value="normal">Normal</option>
                          <option value="low">Low</option>
                          <option value="info">Info Only</option>
                        </select>
                      </div>

                      <div className="setting-group">
                        <label>Channels:</label>
                        <div className="checkbox-group">
                          {['push', 'email', 'sms', 'in_app'].map((ch) => (
                            <label key={ch} className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={config.channels?.includes(ch as any) || false}
                                onChange={(e) => {
                                  const channels = config.channels || [];
                                  const updated = e.target.checked
                                    ? [...channels, ch as any]
                                    : channels.filter((c) => c !== ch);
                                  handleCategoryChange(category, 'channels', updated);
                                }}
                              />
                              <span>{formatChannelName(ch)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="section-group">
              <h3>Muted Categories</h3>
              <div className="muted-categories">
                {preferences.mutedCategories.length > 0 ? (
                  preferences.mutedCategories.map((cat) => (
                    <div key={cat} className="muted-tag">
                      <span>{getCategoryIcon(cat)} {formatCategoryName(cat)}</span>
                      <button
                        className="remove-btn"
                        onClick={() =>
                          setPreferences({
                            ...preferences,
                            mutedCategories: preferences.mutedCategories.filter((c) => c !== cat),
                          })
                        }
                      >
                        ✕
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-muted">No categories muted</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Quiet Hours Tab */}
        {activeTab === 'schedule' && (
          <div className="tab-pane schedule-tab">
            <h2>Quiet Hours</h2>
            <p className="section-description">Set times when notifications are reduced or disabled</p>

            <div className="section-group quiet-hours-config">
              <div className="setting-group toggle-group">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={preferences.quietHours.enabled}
                    onChange={(e) => void handleQuietHoursChange('enabled', e.target.checked)}
                  />
                  <span>Enable Quiet Hours</span>
                </label>
              </div>

              {preferences.quietHours.enabled && (
                <>
                  <div className="time-picker-group">
                    <div className="time-input">
                      <label>Start Time (24h):</label>
                      <input
                        type="time"
                        value={preferences.quietHours.startTime}
                        onChange={(e) => void handleQuietHoursChange('startTime', e.target.value)}
                      />
                    </div>

                    <div className="time-input">
                      <label>End Time (24h):</label>
                      <input
                        type="time"
                        value={preferences.quietHours.endTime}
                        onChange={(e) => void handleQuietHoursChange('endTime', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="setting-group">
                    <label>Timezone:</label>
                    <input
                      type="text"
                      placeholder="America/Los_Angeles"
                      value={preferences.quietHours.timezone}
                      onChange={(e) => void handleQuietHoursChange('timezone', e.target.value)}
                    />
                  </div>

                  <div className="setting-group toggle-group">
                    <label className="toggle-label">
                      <input
                        type="checkbox"
                        checked={preferences.quietHours.allowUrgentDuringQuietHours}
                        onChange={(e) => void handleQuietHoursChange('allowUrgentDuringQuietHours', e.target.checked)}
                      />
                      <span>Allow urgent notifications during quiet hours</span>
                    </label>
                  </div>

                  <div className="quiet-hours-preview">
                    <strong>Preview:</strong> Quiet from {preferences.quietHours.startTime} to {preferences.quietHours.endTime}{' '}
                    ({preferences.quietHours.timezone})
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Batching Tab */}
        {activeTab === 'batching' && (
          <div className="tab-pane batching-tab">
            <h2>Notification Batching</h2>
            <p className="section-description">Combine multiple notifications into single updates</p>

            <div className="section-group">
              <div className="setting-group toggle-group">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={preferences.batchingPreferences.enabled}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        batchingPreferences: {
                          ...preferences.batchingPreferences,
                          enabled: e.target.checked,
                        },
                      })
                    }
                  />
                  <span>Enable Notification Batching</span>
                </label>
              </div>

              {preferences.batchingPreferences.enabled && (
                <>
                  <div className="setting-group">
                    <label>
                      Batch Window:
                      <input
                        type="number"
                        min="5"
                        max="240"
                        value={preferences.batchingPreferences.batchWindowMinutes}
                        onChange={(e) =>
                          void handleBatchingChange('batchWindowMinutes', parseInt(e.target.value))
                        }
                      />
                      <span className="setting-help">minutes</span>
                    </label>
                    <p className="setting-description">Group notifications received within this time window</p>
                  </div>

                  <div className="setting-group">
                    <label>
                      Minimum Notifications to Batch:
                      <input
                        type="number"
                        min="2"
                        max="10"
                        value={preferences.batchingPreferences.minNotificationsToTriggerBatch}
                        onChange={(e) =>
                          void handleBatchingChange('minNotificationsToTriggerBatch', parseInt(e.target.value))
                        }
                      />
                      <span className="setting-help">notifications</span>
                    </label>
                    <p className="setting-description">Only batch when you have this many or more notifications</p>
                  </div>

                  <div className="batching-preview">
                    <strong>How it works:</strong> If you receive {preferences.batchingPreferences.minNotificationsToTriggerBatch} or
                    more notifications within {preferences.batchingPreferences.batchWindowMinutes} minutes, they'll be combined
                    into a single digest.
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="tab-pane analytics-tab">
            <h2>Notification Analytics</h2>
            <p className="section-description">View your notification engagement and fatigue metrics</p>

            {metrics && (
              <div className="analytics-dashboard">
                <div className="metrics-grid">
                  <div className="metric-card">
                    <div className="metric-label">Sent Today</div>
                    <div className="metric-value">{metrics.totalSent}</div>
                    <div className="metric-bar">
                      <div
                        className="metric-bar-fill"
                        style={{
                          width: `${Math.min(100, (metrics.totalSent / preferences.autoReduceThreshold) * 100)}%`,
                        }}
                      ></div>
                    </div>
                    <div className="metric-threshold">
                      Threshold: {preferences.autoReduceThreshold}/day
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-label">Engagement Rate</div>
                    <div className="metric-value">{metrics.engagementRate.toFixed(1)}%</div>
                    <div className="metric-description">
                      {metrics.totalEngaged} of {metrics.totalSent} viewed
                    </div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-label">Fatigue Score</div>
                    <div className={`metric-value ${getFatigueClass(metrics.fatigueScore)}`}>
                      {metrics.fatigueScore}
                    </div>
                    <div className="metric-description">{getFatigueLevel(metrics.fatigueScore)}</div>
                  </div>

                  <div className="metric-card">
                    <div className="metric-label">Auto-Reduce Status</div>
                    <div className="metric-status">{metrics.autoReduceTriggered ? '🔴 Active' : '🟢 Inactive'}</div>
                    <div className="metric-description">
                      {metrics.autoReduceTriggered ? 'Notifications are being reduced' : 'Normal notification delivery'}
                    </div>
                  </div>
                </div>

                <div className="info-box">
                  <h3>About Your Metrics</h3>
                  <ul>
                    <li>
                      <strong>Sent Today:</strong> Total notifications delivered so far today
                    </li>
                    <li>
                      <strong>Engagement Rate:</strong> Percentage of notifications you've viewed or interacted with
                    </li>
                    <li>
                      <strong>Fatigue Score:</strong> 0-100 indicating notification overwhelm (higher = more fatigued)
                    </li>
                    <li>
                      <strong>Auto-Reduce:</strong> Automatically reduces low-priority notifications when you're getting too many
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save Button */}
      <div className="notification-prefs-footer">
        <button className="btn-cancel" onClick={() => void loadPreferences()} disabled={saving}>
          Cancel
        </button>
        <button className="btn-save" onClick={() => void savePreferences()} disabled={saving}>
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
};

export default NotificationPreferences;
