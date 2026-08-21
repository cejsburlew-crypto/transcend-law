import React, { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import './TimeTracking.css';

interface TimeEntry {
  id: string;
  case_id: string;
  description?: string;
  duration_minutes: number;
  rate_per_hour?: number;
  billable: boolean;
  entry_date: string;
  created_at: string;
  updated_at: string;
}

interface TimeStats {
  total_hours: number;
  total_entries: number;
  billable_hours: number;
  billable_amount: number;
  average_duration: number;
}

interface TimeTrackingTabProps {
  caseId: string;
}

const TimeTrackingTab: React.FC<TimeTrackingTabProps> = ({ caseId }) => {
  const { token } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [stats, setStats] = useState<TimeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Timer state
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerDescription, setTimerDescription] = useState('');

  // Bulk entry form state
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [bulkDuration, setBulkDuration] = useState('');
  const [bulkDescription, setBulkDescription] = useState('');
  const [bulkRate, setBulkRate] = useState('');
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().split('T')[0]);
  const [bulkBillable, setBulkBillable] = useState(true);

  useEffect(() => {
    fetchTimeData();
  }, [caseId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const fetchTimeData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [entriesData, statsData] = await Promise.all([
        api.getTimeEntriesByCase(caseId, token),
        api.getTimeStats(caseId, token),
      ]);
      setEntries(entriesData);
      setStats(statsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load time tracking data');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTimer = () => {
    setIsTimerRunning(true);
  };

  const handleStopTimer = async () => {
    setIsTimerRunning(false);
    if (timerSeconds > 0 && token) {
      try {
        await api.createTimeEntry(
          {
            case_id: caseId,
            description: timerDescription || 'Timer entry',
            duration_minutes: Math.round(timerSeconds / 60),
            billable: true,
            entry_date: new Date().toISOString().split('T')[0],
          },
          token
        );
        setTimerSeconds(0);
        setTimerDescription('');
        await fetchTimeData();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save time entry');
      }
    }
  };

  const handleSubmitBulkEntry = async () => {
    if (!bulkDuration || !token) return;
    try {
      await api.createTimeEntry(
        {
          case_id: caseId,
          description: bulkDescription,
          duration_minutes: parseInt(bulkDuration) * 60,
          rate_per_hour: bulkRate ? parseFloat(bulkRate) : undefined,
          billable: bulkBillable,
          entry_date: bulkDate,
        },
        token
      );
      setBulkDuration('');
      setBulkDescription('');
      setBulkRate('');
      setBulkDate(new Date().toISOString().split('T')[0]);
      setShowBulkForm(false);
      await fetchTimeData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create entry');
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!token) return;
    try {
      await api.deleteTimeEntry(entryId, token);
      await fetchTimeData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry');
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="time-tracking-loading">Loading time tracking...</div>;
  }

  return (
    <div className="time-tracking-container">
      {error && <div className="time-tracking-error">{error}</div>}

      {/* Time Statistics */}
      {stats && (
        <div className="time-stats-grid">
          <div className="stat-card">
            <div className="stat-label">Total Hours</div>
            <div className="stat-value">{stats.total_hours.toFixed(2)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Billable Hours</div>
            <div className="stat-value">{stats.billable_hours.toFixed(2)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Entries</div>
            <div className="stat-value">{stats.total_entries}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Billable Amount</div>
            <div className="stat-value">${stats.billable_amount.toFixed(2)}</div>
          </div>
        </div>
      )}

      {/* Timer Section */}
      <div className="timer-section">
        <h3>Work Timer</h3>
        <div className="timer-display">{formatTime(timerSeconds)}</div>
        <input
          type="text"
          className="timer-description"
          placeholder="What are you working on?"
          value={timerDescription}
          onChange={(e) => setTimerDescription(e.target.value)}
          disabled={isTimerRunning}
        />
        <div className="timer-buttons">
          {!isTimerRunning ? (
            <button className="start-btn" onClick={handleStartTimer}>
              ▶ Start Timer
            </button>
          ) : (
            <button className="stop-btn" onClick={handleStopTimer}>
              ⏹ Stop & Save
            </button>
          )}
        </div>
      </div>

      {/* Bulk Entry Form */}
      <div className="bulk-entry-section">
        <button className="toggle-form-btn" onClick={() => setShowBulkForm(!showBulkForm)}>
          {showBulkForm ? '− Collapse' : '+ Add Manual Entry'}
        </button>

        {showBulkForm && (
          <div className="bulk-form">
            <div className="form-group">
              <label>Hours</label>
              <input
                type="number"
                placeholder="e.g., 2.5"
                value={bulkDuration}
                onChange={(e) => setBulkDuration(e.target.value)}
                step="0.5"
                min="0"
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                placeholder="What did you work on?"
                value={bulkDescription}
                onChange={(e) => setBulkDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="form-group">
              <label>Hourly Rate ($)</label>
              <input
                type="number"
                placeholder="Optional"
                value={bulkRate}
                onChange={(e) => setBulkRate(e.target.value)}
                step="10"
                min="0"
              />
            </div>

            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={bulkDate}
                onChange={(e) => setBulkDate(e.target.value)}
              />
            </div>

            <div className="form-group checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={bulkBillable}
                  onChange={(e) => setBulkBillable(e.target.checked)}
                />
                Billable
              </label>
            </div>

            <div className="form-actions">
              <button className="cancel-btn" onClick={() => setShowBulkForm(false)}>
                Cancel
              </button>
              <button className="submit-btn" onClick={handleSubmitBulkEntry} disabled={!bulkDuration}>
                Save Entry
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Time Entries List */}
      <div className="entries-section">
        <h3>Time Entries</h3>
        {entries.length === 0 ? (
          <div className="no-entries">
            No time entries yet. Use the timer or add a manual entry to get started!
          </div>
        ) : (
          <div className="entries-list">
            {entries.map((entry) => (
              <div key={entry.id} className="entry-card">
                <div className="entry-header">
                  <div className="entry-description">{entry.description || 'Timer entry'}</div>
                  <div className="entry-duration">{(entry.duration_minutes / 60).toFixed(2)}h</div>
                </div>
                <div className="entry-meta">
                  <span className="entry-date">{entry.entry_date}</span>
                  {entry.rate_per_hour && (
                    <span className="entry-amount">
                      ${((entry.duration_minutes / 60) * entry.rate_per_hour).toFixed(2)}
                    </span>
                  )}
                  <span className={`entry-billable ${entry.billable ? 'billable' : 'non-billable'}`}>
                    {entry.billable ? 'Billable' : 'Non-billable'}
                  </span>
                  <button
                    className="delete-btn"
                    onClick={() => handleDeleteEntry(entry.id)}
                    title="Delete entry"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TimeTrackingTab;
