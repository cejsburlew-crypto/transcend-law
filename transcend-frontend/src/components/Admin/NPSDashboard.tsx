// NPS Admin Dashboard Component
// Displays NPS metrics, trends, action items, and feedback analysis

import React, { useState, useEffect } from 'react';
import '../AnalyticsDashboard.css'; // Reuse analytics styling

interface NPSDashboardData {
  currentNPS: number;
  monthlyNPS: number;
  quarterlyNPS: number;
  annualNPS: number;
  promoterPercentage: number;
  passivePercentage: number;
  detractorPercentage: number;
  totalResponses: number;
  responseRate: number;
  segmentBreakdown: any[];
  topFeedbackThemes: any[];
  actionItems: any[];
  trends: any[];
  alerts: any[];
}

export const NPSDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<NPSDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'feedback' | 'actions'>('overview');

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/nps/admin/dashboard', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch NPS dashboard');
      }

      const data = await response.json();
      setDashboardData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      console.error('Error fetching NPS dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const getNPSColor = (nps: number): string => {
    if (nps >= 50) return '#10b981'; // Green
    if (nps >= 0) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };

  const getNPSLabel = (nps: number): string => {
    if (nps >= 75) return 'Excellent';
    if (nps >= 50) return 'Good';
    if (nps >= 0) return 'Fair';
    return 'Poor';
  };

  if (loading && !dashboardData) {
    return <div className="analytics-loading">Loading NPS Dashboard...</div>;
  }

  if (error) {
    return <div className="analytics-error">Error: {error}</div>;
  }

  if (!dashboardData) {
    return <div className="analytics-error">No data available</div>;
  }

  return (
    <div className="nps-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <h1>NPS Dashboard</h1>
        <p className="subtitle">Net Promoter Score Analysis & Trend Tracking</p>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        {/* Current NPS */}
        <div className="metric-card nps-card">
          <div className="metric-icon">
            <span style={{ fontSize: '32px' }}>⭐</span>
          </div>
          <div className="metric-content">
            <h3>Current NPS</h3>
            <div
              className="metric-value"
              style={{ color: getNPSColor(dashboardData.currentNPS) }}
            >
              {dashboardData.currentNPS.toFixed(0)}
            </div>
            <p className="metric-label">
              {getNPSLabel(dashboardData.currentNPS)}
            </p>
          </div>
        </div>

        {/* Monthly NPS */}
        <div className="metric-card">
          <div className="metric-icon">📅</div>
          <div className="metric-content">
            <h3>Monthly NPS</h3>
            <div
              className="metric-value"
              style={{ color: getNPSColor(dashboardData.monthlyNPS) }}
            >
              {dashboardData.monthlyNPS.toFixed(0)}
            </div>
          </div>
        </div>

        {/* Quarterly NPS */}
        <div className="metric-card">
          <div className="metric-icon">📊</div>
          <div className="metric-content">
            <h3>Quarterly NPS</h3>
            <div
              className="metric-value"
              style={{ color: getNPSColor(dashboardData.quarterlyNPS) }}
            >
              {dashboardData.quarterlyNPS.toFixed(0)}
            </div>
          </div>
        </div>

        {/* Response Rate */}
        <div className="metric-card">
          <div className="metric-icon">📝</div>
          <div className="metric-content">
            <h3>Response Rate</h3>
            <div className="metric-value" style={{ color: '#3b82f6' }}>
              {dashboardData.responseRate.toFixed(1)}%
            </div>
            <p className="metric-label">
              {dashboardData.totalResponses} responses
            </p>
          </div>
        </div>
      </div>

      {/* Sentiment Distribution */}
      <div className="section">
        <h2>Sentiment Distribution</h2>
        <div className="sentiment-grid">
          <div className="sentiment-item">
            <div className="sentiment-label">Promoters</div>
            <div className="sentiment-bar">
              <div
                className="sentiment-fill"
                style={{
                  width: `${dashboardData.promoterPercentage}%`,
                  backgroundColor: '#10b981',
                }}
              ></div>
            </div>
            <div className="sentiment-value">
              {dashboardData.promoterPercentage.toFixed(1)}%
            </div>
          </div>

          <div className="sentiment-item">
            <div className="sentiment-label">Passives</div>
            <div className="sentiment-bar">
              <div
                className="sentiment-fill"
                style={{
                  width: `${dashboardData.passivePercentage}%`,
                  backgroundColor: '#f59e0b',
                }}
              ></div>
            </div>
            <div className="sentiment-value">
              {dashboardData.passivePercentage.toFixed(1)}%
            </div>
          </div>

          <div className="sentiment-item">
            <div className="sentiment-label">Detractors</div>
            <div className="sentiment-bar">
              <div
                className="sentiment-fill"
                style={{
                  width: `${dashboardData.detractorPercentage}%`,
                  backgroundColor: '#ef4444',
                }}
              ></div>
            </div>
            <div className="sentiment-value">
              {dashboardData.detractorPercentage.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="dashboard-tabs">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'trends' ? 'active' : ''}`}
          onClick={() => setActiveTab('trends')}
        >
          Trends
        </button>
        <button
          className={`tab-btn ${activeTab === 'feedback' ? 'active' : ''}`}
          onClick={() => setActiveTab('feedback')}
        >
          Feedback Themes
        </button>
        <button
          className={`tab-btn ${activeTab === 'actions' ? 'active' : ''}`}
          onClick={() => setActiveTab('actions')}
        >
          Action Items
        </button>
      </div>

      {/* Segment Breakdown */}
      {activeTab === 'overview' && (
        <div className="section">
          <h2>Segment Breakdown</h2>
          <div className="segment-table">
            <table>
              <thead>
                <tr>
                  <th>User Type</th>
                  <th>Count</th>
                  <th>Avg Score</th>
                  <th>NPS</th>
                  <th>Promoters</th>
                  <th>Passives</th>
                  <th>Detractors</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.segmentBreakdown.map((segment: any) => (
                  <tr key={segment.userType}>
                    <td className="segment-type">{segment.userType}</td>
                    <td>{segment.count}</td>
                    <td>{segment.averageScore.toFixed(1)}</td>
                    <td>
                      <span
                        style={{
                          color: getNPSColor(segment.npsScore),
                          fontWeight: 'bold',
                        }}
                      >
                        {segment.npsScore.toFixed(0)}
                      </span>
                    </td>
                    <td className="sentiment-promoter">
                      {segment.sentiment.promoter}
                    </td>
                    <td className="sentiment-passive">
                      {segment.sentiment.passive}
                    </td>
                    <td className="sentiment-detractor">
                      {segment.sentiment.detractor}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trends */}
      {activeTab === 'trends' && (
        <div className="section">
          <h2>NPS Trends</h2>
          <div className="trends-list">
            {dashboardData.trends.map((trend: any) => (
              <div key={trend.id} className="trend-item">
                <div className="trend-period">
                  {new Date(trend.startDate).toLocaleDateString()} -
                  {new Date(trend.endDate).toLocaleDateString()}
                </div>
                <div className="trend-score">
                  <span
                    style={{
                      fontSize: '24px',
                      fontWeight: 'bold',
                      color: getNPSColor(trend.npsScore),
                    }}
                  >
                    {trend.npsScore.toFixed(0)}
                  </span>
                </div>
                <div className="trend-details">
                  <span>Promoters: {trend.promoterCount}</span>
                  <span>Passives: {trend.passiveCount}</span>
                  <span>Detractors: {trend.detractorCount}</span>
                </div>
                {trend.trends && (
                  <div className="trend-direction">
                    {trend.trends.direction === 'improving' && '📈 Improving'}
                    {trend.trends.direction === 'declining' && '📉 Declining'}
                    {trend.trends.direction === 'stable' && '➡️ Stable'}
                    {trend.trends.changePercentage !== 0 && (
                      <span>
                        {' '}
                        ({Math.abs(trend.trends.changePercentage).toFixed(1)}%)
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback Themes */}
      {activeTab === 'feedback' && (
        <div className="section">
          <h2>Top Feedback Themes</h2>
          <div className="themes-grid">
            {dashboardData.topFeedbackThemes.map((theme: any, idx: number) => (
              <div key={idx} className="theme-card">
                <div className="theme-header">
                  <h3>{theme.theme}</h3>
                  <span className="theme-frequency">
                    {theme.frequency} mentions
                  </span>
                </div>
                <div
                  className="theme-sentiment"
                  style={{
                    color:
                      theme.sentiment === 'positive'
                        ? '#10b981'
                        : theme.sentiment === 'negative'
                        ? '#ef4444'
                        : '#f59e0b',
                  }}
                >
                  {theme.sentiment === 'positive' ? '👍' : '👎'}{' '}
                  {theme.sentiment}
                </div>
                <div className="theme-examples">
                  {theme.examples.slice(0, 2).map((example: string, i: number) => (
                    <p key={i} className="example-text">
                      "{example.substring(0, 80)}..."
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Items */}
      {activeTab === 'actions' && (
        <div className="section">
          <h2>Action Items</h2>
          <div className="action-items-list">
            {dashboardData.actionItems.map((item: any) => (
              <div key={item.id} className="action-item">
                <div className="action-header">
                  <h3>{item.category}</h3>
                  <span className={`action-priority priority-${item.priority}`}>
                    {item.priority}
                  </span>
                  <span className={`action-status status-${item.status}`}>
                    {item.status}
                  </span>
                </div>
                <p className="action-description">{item.description}</p>
                <p className="action-suggested">
                  <strong>Suggested Action:</strong> {item.suggestedAction}
                </p>
                {item.linkedSurveyIds.length > 0 && (
                  <p className="action-surveys">
                    Related to {item.linkedSurveyIds.length} survey response(s)
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      {dashboardData.alerts.length > 0 && (
        <div className="section">
          <h2>Alerts</h2>
          <div className="alerts-list">
            {dashboardData.alerts.map((alert: any) => (
              <div
                key={alert.id}
                className={`alert alert-${alert.severity}`}
              >
                <span className="alert-icon">
                  {alert.severity === 'critical' ? '🚨' : '⚠️'}
                </span>
                <div className="alert-content">
                  <h4>{alert.message}</h4>
                  <p>
                    Threshold: {alert.threshold} | Current: {alert.currentValue.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NPSDashboard;
