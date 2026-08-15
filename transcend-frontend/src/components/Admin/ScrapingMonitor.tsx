import React, { useState, useEffect } from 'react';
import './ScrapingMonitor.css';

interface ScrapingStats {
  currentUsers: number;
  currentProviders: number;
  totalScraped: {
    users: number;
    providers: number;
  };
  sources: {
    name: string;
    users: number;
    providers: number;
    lastRun: string;
  }[];
  scrapingStatus: 'active' | 'idle' | 'error';
  uptime: number;
}

export default function ScrapingMonitor() {
  const [stats, setStats] = useState<ScrapingStats | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/platform/statistics');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
          setIsRunning(data.scrapingStatus === 'active');
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    setLoading(true);
    try {
      await fetch('/api/admin/scraping/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervalMinutes: 10 }),
      });
      setIsRunning(true);
    } catch (error) {
      console.error('Failed to start scraping:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await fetch('/api/admin/scraping/stop', { method: 'POST' });
      setIsRunning(false);
    } catch (error) {
      console.error('Failed to stop scraping:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (window.confirm('Reset all counters? This cannot be undone.')) {
      setLoading(true);
      try {
        await fetch('/api/admin/scraping/reset', { method: 'POST' });
      } catch (error) {
        console.error('Failed to reset:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  if (!stats) {
    return <div className="scraping-monitor loading">Loading...</div>;
  }

  const formatSeconds = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="scraping-monitor">
      <div className="header">
        <h2>🔄 Continuous Scraping Monitor</h2>
        <div className="status-indicator">
          <span className={`dot ${stats.scrapingStatus}`} />
          <span className="text">
            {stats.scrapingStatus === 'active' ? 'Scraping Active' :
             stats.scrapingStatus === 'error' ? 'Error' :
             'Idle'}
          </span>
        </div>
      </div>

      <div className="controls">
        <button
          onClick={handleStart}
          disabled={isRunning || loading}
          className="btn btn-primary"
        >
          ▶️ Start Scraping
        </button>
        <button
          onClick={handleStop}
          disabled={!isRunning || loading}
          className="btn btn-danger"
        >
          ⏸️ Stop Scraping
        </button>
        <button
          onClick={handleReset}
          disabled={loading}
          className="btn btn-warning"
        >
          🔄 Reset Counters
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card large">
          <div className="label">Current Users</div>
          <div className="value">{stats.currentUsers.toLocaleString()}</div>
          <div className="sublabel">Total Scraped: {stats.totalScraped.users.toLocaleString()}</div>
        </div>

        <div className="stat-card large">
          <div className="label">Current Service Providers</div>
          <div className="value">{stats.currentProviders.toLocaleString()}</div>
          <div className="sublabel">Total Scraped: {stats.totalScraped.providers.toLocaleString()}</div>
        </div>

        <div className="stat-card">
          <div className="label">Uptime</div>
          <div className="value">{formatSeconds(stats.uptime)}</div>
        </div>

        <div className="stat-card">
          <div className="label">Combined Total</div>
          <div className="value">
            {(stats.currentUsers + stats.currentProviders).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="sources-section">
        <h3>📊 Scraping Sources</h3>
        <div className="sources-grid">
          {stats.sources.map((source, idx) => (
            <div key={idx} className="source-card">
              <h4>{source.name}</h4>
              <div className="source-stats">
                <div className="stat">
                  <span className="label">Users:</span>
                  <span className="value">{source.users.toLocaleString()}</span>
                </div>
                <div className="stat">
                  <span className="label">Providers:</span>
                  <span className="value">{source.providers.toLocaleString()}</span>
                </div>
              </div>
              <div className="last-run">
                Last run: {new Date(source.lastRun).toLocaleString()}
              </div>
              <div className="progress-bar">
                <div
                  className="progress"
                  style={{
                    width: `${Math.min((source.users + source.providers) / 100000, 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="info-box">
        <h4>ℹ️ How It Works</h4>
        <ul>
          <li>Scrapers run continuously in the background</li>
          <li>Three data sources: Legal Directories, Bar Associations, LinkedIn</li>
          <li>Legal Directories & Bar Associations: Every 10 minutes</li>
          <li>LinkedIn: Every 2 minutes (more frequent)</li>
          <li>Numbers update live in the header: Users & Service Providers</li>
          <li>Only displays when counts exceed 1 million</li>
          <li>All data is tracked and stored for analytics</li>
        </ul>
      </div>
    </div>
  );
}
