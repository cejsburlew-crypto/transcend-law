import React, { useState, useEffect } from 'react';

interface NotaryStatsData {
  totalNotaries: number;
  remoteNotaries: number;
  statesCovered: number;
  specialtyBreakdown: Record<string, number>;
  topStates: Array<{ state: string; count: number }>;
  lastUpdate: string | null;
}

export const NotaryStats: React.FC = () => {
  const [stats, setStats] = useState<NotaryStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/v1/notaries/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch notary stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return <div className="notary-stats loading">Loading notary data...</div>;
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="notary-stats-container">
      <div className="notary-stats-header">
        <h2>📋 Notary Services Network</h2>
      </div>

      <div className="notary-stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📍</div>
          <div className="stat-content">
            <div className="stat-label">Total Notaries</div>
            <div className="stat-value">{stats.totalNotaries.toLocaleString()}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🌐</div>
          <div className="stat-content">
            <div className="stat-label">Remote Available</div>
            <div className="stat-value">{stats.remoteNotaries.toLocaleString()}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🗺️</div>
          <div className="stat-content">
            <div className="stat-label">States Covered</div>
            <div className="stat-value">{stats.statesCovered}</div>
          </div>
        </div>
      </div>

      {stats.topStates.length > 0 && (
        <div className="top-states">
          <h3>Top States by Notary Count</h3>
          <ul>
            {stats.topStates.map(({ state, count }) => (
              <li key={state}>
                <span>{state}</span>
                <span className="count">{count} notaries</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stats.lastUpdate && (
        <div className="last-update">
          Last updated: {new Date(stats.lastUpdate).toLocaleString()}
        </div>
      )}
    </div>
  );
};
