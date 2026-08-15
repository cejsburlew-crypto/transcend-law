// Wait Time Display Component
// Real-time wait time tracking, provider metrics, alerts, and satisfaction correlation

import React, { useState, useEffect } from 'react';
import './WaitTimeDisplay.css';

interface WaitTimeEvent {
  id: string;
  caseId: string;
  clientId: string;
  providerId: string;
  serviceType: string;
  clientArrivalTime: Date;
  providerResponseTime?: Date;
  serviceCompletionTime?: Date;
  clientWaitTime?: number;
  totalServiceTime?: number;
  status: 'waiting' | 'in_progress' | 'completed' | 'no_show' | 'cancelled';
  exceedsResponseThreshold: boolean;
  exceedsCompletionThreshold: boolean;
}

interface ProviderMetrics {
  providerId: string;
  providerName: string;
  totalServices: number;
  averageClientWaitTime: number;
  averageTotalServiceTime: number;
  medianClientWaitTime: number;
  medianTotalServiceTime: number;
  maxClientWaitTime: number;
  maxTotalServiceTime: number;
  minClientWaitTime: number;
  minTotalServiceTime: number;
  percentageResponseThresholdExceeded: number;
  percentageCompletionThresholdExceeded: number;
  averageClientSatisfaction: number;
  responseThresholdSla: number;
  completionThresholdSla: number;
  slaCompliancePercentage: number;
}

interface WaitTimeAlert {
  id: string;
  eventId: string;
  caseId: string;
  clientId: string;
  providerId: string;
  alertType: 'response_time_exceeded' | 'completion_time_exceeded' | 'no_show';
  severity: 'low' | 'medium' | 'high' | 'critical';
  threshold: number;
  actualValue: number;
  message: string;
  status: 'active' | 'acknowledged' | 'resolved';
  createdAt: Date;
}

interface ClientSatisfactionCorrelation {
  waitTimeRange: string;
  averageSatisfactionScore: number;
  totalResponses: number;
  percentageNegative: number;
}

interface HistoricalAnalytics {
  period: string;
  totalServices: number;
  averageClientWaitTime: number;
  averageTotalServiceTime: number;
  percentageThresholdExceeded: number;
  totalAlertsGenerated: number;
  averageClientSatisfaction: number;
  topProviders: Array<{
    providerId: string;
    providerName: string;
    averageWaitTime: number;
  }>;
  slowestProviders: Array<{
    providerId: string;
    providerName: string;
    averageWaitTime: number;
  }>;
}

interface WaitTimeDisplayProps {
  userType: 'client' | 'provider' | 'admin';
  userId: string;
  caseId?: string;
  providerId?: string;
}

type TabType = 'real-time' | 'alerts' | 'metrics' | 'satisfaction' | 'historical';

export const WaitTimeDisplay: React.FC<WaitTimeDisplayProps> = ({
  userType,
  userId,
  caseId,
  providerId,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('real-time');
  const [currentEvents, setCurrentEvents] = useState<WaitTimeEvent[]>([]);
  const [alerts, setAlerts] = useState<WaitTimeAlert[]>([]);
  const [metrics, setMetrics] = useState<ProviderMetrics | null>(null);
  const [satisfaction, setSatisfaction] = useState<ClientSatisfactionCorrelation[]>([]);
  const [historical, setHistorical] = useState<HistoricalAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth());

  // Auto-refresh current events
  useEffect(() => {
    const loadCurrentEvents = async () => {
      try {
        let endpoint = '/api/wait-times/current';
        if (caseId) {
          endpoint += `?caseId=${caseId}`;
        } else if (providerId && userType === 'provider') {
          endpoint += `?providerId=${providerId}`;
        }

        const response = await fetch(endpoint);
        if (!response.ok) throw new Error('Failed to load wait time events');

        const data = await response.json();
        setCurrentEvents(Array.isArray(data) ? data : [data]);
      } catch (err) {
        console.error('Error loading current events:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      }
    };

    if (activeTab === 'real-time') {
      loadCurrentEvents();
      const interval = setInterval(loadCurrentEvents, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [activeTab, caseId, providerId, userType, refreshInterval]);

  // Load alerts
  useEffect(() => {
    const loadAlerts = async () => {
      try {
        let endpoint = '/api/wait-times/alerts';
        if (providerId) {
          endpoint += `?providerId=${providerId}`;
        }

        const response = await fetch(endpoint);
        if (!response.ok) throw new Error('Failed to load alerts');

        const data = await response.json();
        setAlerts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error loading alerts:', err);
      }
    };

    if (activeTab === 'alerts') {
      loadAlerts();
      const interval = setInterval(loadAlerts, 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [activeTab, providerId]);

  // Load metrics
  useEffect(() => {
    const loadMetrics = async () => {
      try {
        if (!providerId && userType !== 'admin') {
          setMetrics(null);
          return;
        }

        const targetProviderId = providerId || userId;
        const response = await fetch(`/api/wait-times/metrics/${targetProviderId}`);
        if (!response.ok) throw new Error('Failed to load metrics');

        const data = await response.json();
        setMetrics(data);
      } catch (err) {
        console.error('Error loading metrics:', err);
      }
    };

    if (activeTab === 'metrics') {
      loadMetrics();
      const interval = setInterval(loadMetrics, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [activeTab, providerId, userType, userId]);

  // Load satisfaction correlation
  useEffect(() => {
    const loadSatisfaction = async () => {
      try {
        const response = await fetch('/api/wait-times/satisfaction-correlation');
        if (!response.ok) throw new Error('Failed to load satisfaction data');

        const data = await response.json();
        setSatisfaction(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error loading satisfaction:', err);
      }
    };

    if (activeTab === 'satisfaction') {
      loadSatisfaction();
    }
  }, [activeTab]);

  // Load historical analytics
  useEffect(() => {
    const loadHistorical = async () => {
      try {
        const response = await fetch(`/api/wait-times/analytics/${selectedMonth}`);
        if (!response.ok) throw new Error('Failed to load historical data');

        const data = await response.json();
        setHistorical(data);
      } catch (err) {
        console.error('Error loading historical:', err);
      }
    };

    if (activeTab === 'historical') {
      loadHistorical();
    }
  }, [activeTab, selectedMonth]);

  useEffect(() => {
    setLoading(false);
  }, []);

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/wait-times/alerts/${alertId}/acknowledge`, {
        method: 'PATCH',
      });

      if (!response.ok) throw new Error('Failed to acknowledge alert');

      setAlerts(alerts.map((a) => (a.id === alertId ? { ...a, status: 'acknowledged' } : a)));
    } catch (err) {
      console.error('Error acknowledging alert:', err);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/wait-times/alerts/${alertId}/resolve`, {
        method: 'PATCH',
      });

      if (!response.ok) throw new Error('Failed to resolve alert');

      setAlerts(alerts.map((a) => (a.id === alertId ? { ...a, status: 'resolved' } : a)));
    } catch (err) {
      console.error('Error resolving alert:', err);
    }
  };

  if (loading) {
    return <div className="wait-time-display loading">Loading wait time data...</div>;
  }

  return (
    <div className="wait-time-display">
      <div className="wait-time-header">
        <h2>Wait Time Analytics</h2>
        <div className="tab-navigation">
          <button
            className={`tab-button ${activeTab === 'real-time' ? 'active' : ''}`}
            onClick={() => setActiveTab('real-time')}
          >
            Real-Time
          </button>
          <button
            className={`tab-button ${activeTab === 'alerts' ? 'active' : ''}`}
            onClick={() => setActiveTab('alerts')}
          >
            Alerts {alerts.filter((a) => a.status === 'active').length > 0 && `(${alerts.filter((a) => a.status === 'active').length})`}
          </button>
          <button
            className={`tab-button ${activeTab === 'metrics' ? 'active' : ''}`}
            onClick={() => setActiveTab('metrics')}
          >
            Metrics
          </button>
          <button
            className={`tab-button ${activeTab === 'satisfaction' ? 'active' : ''}`}
            onClick={() => setActiveTab('satisfaction')}
          >
            Satisfaction
          </button>
          <button
            className={`tab-button ${activeTab === 'historical' ? 'active' : ''}`}
            onClick={() => setActiveTab('historical')}
          >
            Historical
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Real-Time Tab */}
      {activeTab === 'real-time' && (
        <div className="tab-content">
          <div className="real-time-controls">
            <label>
              Refresh Interval:
              <select value={refreshInterval} onChange={(e) => setRefreshInterval(Number(e.target.value))}>
                <option value={10}>10 seconds</option>
                <option value={30}>30 seconds</option>
                <option value={60}>1 minute</option>
                <option value={300}>5 minutes</option>
              </select>
            </label>
          </div>

          {currentEvents.length === 0 ? (
            <div className="no-data">No active wait time events</div>
          ) : (
            <div className="wait-time-events">
              {currentEvents.map((event) => (
                <div
                  key={event.id}
                  className={`wait-time-event ${event.status} ${event.exceedsResponseThreshold ? 'exceeds-threshold' : ''}`}
                >
                  <div className="event-header">
                    <span className="event-id">Case: {event.caseId}</span>
                    <span className={`event-status ${event.status}`}>{event.status.toUpperCase()}</span>
                  </div>

                  <div className="event-details">
                    <div className="detail-item">
                      <span className="label">Service Type:</span>
                      <span className="value">{event.serviceType}</span>
                    </div>

                    {event.status === 'waiting' && (
                      <div className="detail-item highlight">
                        <span className="label">Current Wait Time:</span>
                        <span className="value">{formatSeconds(getCurrentWaitTime(event.clientArrivalTime))}</span>
                      </div>
                    )}

                    {event.clientWaitTime !== undefined && (
                      <div className="detail-item">
                        <span className="label">Client Wait Time:</span>
                        <span className={`value ${event.exceedsResponseThreshold ? 'exceeded' : ''}`}>
                          {formatSeconds(event.clientWaitTime)}
                        </span>
                      </div>
                    )}

                    {event.totalServiceTime !== undefined && (
                      <div className="detail-item">
                        <span className="label">Total Service Time:</span>
                        <span className={`value ${event.exceedsCompletionThreshold ? 'exceeded' : ''}`}>
                          {formatSeconds(event.totalServiceTime)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="tab-content">
          {alerts.length === 0 ? (
            <div className="no-data">No wait time alerts</div>
          ) : (
            <div className="alerts-list">
              {alerts.map((alert) => (
                <div key={alert.id} className={`alert-item severity-${alert.severity} status-${alert.status}`}>
                  <div className="alert-header">
                    <span className={`severity-badge severity-${alert.severity}`}>{alert.severity.toUpperCase()}</span>
                    <span className={`status-badge status-${alert.status}`}>{alert.status.toUpperCase()}</span>
                    <span className="alert-time">{formatDateTime(new Date(alert.createdAt))}</span>
                  </div>

                  <div className="alert-message">{alert.message}</div>

                  <div className="alert-details">
                    <div className="detail">
                      <span className="label">Threshold:</span>
                      <span className="value">{formatSeconds(alert.threshold)}</span>
                    </div>
                    <div className="detail">
                      <span className="label">Actual:</span>
                      <span className="value">{formatSeconds(alert.actualValue)}</span>
                    </div>
                    <div className="detail">
                      <span className="label">Case:</span>
                      <span className="value">{alert.caseId}</span>
                    </div>
                  </div>

                  {alert.status === 'active' && (
                    <div className="alert-actions">
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleAcknowledgeAlert(alert.id)}
                      >
                        Acknowledge
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={() => handleResolveAlert(alert.id)}
                      >
                        Resolve
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Metrics Tab */}
      {activeTab === 'metrics' && (
        <div className="tab-content">
          {metrics ? (
            <div className="metrics-container">
              <div className="metrics-header">
                <h3>{metrics.providerName}</h3>
                <div className="sla-compliance">
                  <span className="label">SLA Compliance:</span>
                  <div className={`compliance-bar compliance-${getComplianceLevel(metrics.slaCompliancePercentage)}`}>
                    <div className="compliance-fill" style={{ width: `${metrics.slaCompliancePercentage}%` }}></div>
                  </div>
                  <span className="percentage">{metrics.slaCompliancePercentage}%</span>
                </div>
              </div>

              <div className="metrics-grid">
                <div className="metric-card">
                  <h4>Response Times</h4>
                  <div className="metric-stat">
                    <span className="stat-label">Average:</span>
                    <span className="stat-value">{formatSeconds(metrics.averageClientWaitTime)}</span>
                  </div>
                  <div className="metric-stat">
                    <span className="stat-label">Median:</span>
                    <span className="stat-value">{formatSeconds(metrics.medianClientWaitTime)}</span>
                  </div>
                  <div className="metric-stat">
                    <span className="stat-label">Max:</span>
                    <span className="stat-value">{formatSeconds(metrics.maxClientWaitTime)}</span>
                  </div>
                  <div className="metric-stat">
                    <span className="stat-label">Min:</span>
                    <span className="stat-value">{formatSeconds(metrics.minClientWaitTime)}</span>
                  </div>
                </div>

                <div className="metric-card">
                  <h4>Service Times</h4>
                  <div className="metric-stat">
                    <span className="stat-label">Average:</span>
                    <span className="stat-value">{formatSeconds(metrics.averageTotalServiceTime)}</span>
                  </div>
                  <div className="metric-stat">
                    <span className="stat-label">Median:</span>
                    <span className="stat-value">{formatSeconds(metrics.medianTotalServiceTime)}</span>
                  </div>
                  <div className="metric-stat">
                    <span className="stat-label">Max:</span>
                    <span className="stat-value">{formatSeconds(metrics.maxTotalServiceTime)}</span>
                  </div>
                  <div className="metric-stat">
                    <span className="stat-label">Min:</span>
                    <span className="stat-value">{formatSeconds(metrics.minTotalServiceTime)}</span>
                  </div>
                </div>

                <div className="metric-card">
                  <h4>Performance</h4>
                  <div className="metric-stat">
                    <span className="stat-label">Total Services:</span>
                    <span className="stat-value">{metrics.totalServices}</span>
                  </div>
                  <div className="metric-stat">
                    <span className="stat-label">Response Threshold Exceeded:</span>
                    <span className="stat-value">{metrics.percentageResponseThresholdExceeded}%</span>
                  </div>
                  <div className="metric-stat">
                    <span className="stat-label">Completion Threshold Exceeded:</span>
                    <span className="stat-value">{metrics.percentageCompletionThresholdExceeded}%</span>
                  </div>
                </div>

                <div className="metric-card">
                  <h4>Satisfaction</h4>
                  <div className="metric-stat">
                    <span className="stat-label">Average Score:</span>
                    <span className="stat-value satisfaction-score">
                      {metrics.averageClientSatisfaction.toFixed(1)}/5.0
                    </span>
                  </div>
                  <div className="metric-stat">
                    <span className="stat-label">SLA Targets:</span>
                    <span className="stat-value">
                      {formatSeconds(metrics.responseThresholdSla)} / {formatSeconds(metrics.completionThresholdSla)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="no-data">No metrics available</div>
          )}
        </div>
      )}

      {/* Satisfaction Tab */}
      {activeTab === 'satisfaction' && (
        <div className="tab-content">
          {satisfaction.length === 0 ? (
            <div className="no-data">No satisfaction correlation data available</div>
          ) : (
            <div className="satisfaction-container">
              <h3>Wait Time vs. Client Satisfaction</h3>
              <div className="satisfaction-chart">
                {satisfaction.map((item) => (
                  <div key={item.waitTimeRange} className="satisfaction-item">
                    <div className="wait-time-range">{item.waitTimeRange}</div>
                    <div className="satisfaction-stats">
                      <div className="stat">
                        <span className="label">Avg Satisfaction:</span>
                        <div className="satisfaction-bar">
                          <div
                            className="satisfaction-fill"
                            style={{ width: `${(item.averageSatisfactionScore / 5) * 100}%` }}
                          ></div>
                        </div>
                        <span className="value">{item.averageSatisfactionScore.toFixed(1)}/5</span>
                      </div>
                      <div className="stat">
                        <span className="label">Responses:</span>
                        <span className="value">{item.totalResponses}</span>
                      </div>
                      <div className="stat">
                        <span className="label">Negative:</span>
                        <span className="value">{item.percentageNegative}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Historical Analytics Tab */}
      {activeTab === 'historical' && (
        <div className="tab-content">
          <div className="historical-controls">
            <label>
              Select Month:
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </label>
          </div>

          {historical ? (
            <div className="historical-container">
              <div className="historical-header">
                <h3>Analytics for {formatPeriod(historical.period)}</h3>
              </div>

              <div className="historical-metrics">
                <div className="historical-metric">
                  <span className="label">Total Services:</span>
                  <span className="value">{historical.totalServices}</span>
                </div>
                <div className="historical-metric">
                  <span className="label">Avg Client Wait Time:</span>
                  <span className="value">{formatSeconds(historical.averageClientWaitTime)}</span>
                </div>
                <div className="historical-metric">
                  <span className="label">Avg Total Service Time:</span>
                  <span className="value">{formatSeconds(historical.averageTotalServiceTime)}</span>
                </div>
                <div className="historical-metric">
                  <span className="label">Threshold Exceeded:</span>
                  <span className="value">{historical.percentageThresholdExceeded}%</span>
                </div>
                <div className="historical-metric">
                  <span className="label">Total Alerts:</span>
                  <span className="value">{historical.totalAlertsGenerated}</span>
                </div>
                <div className="historical-metric">
                  <span className="label">Avg Satisfaction:</span>
                  <span className="value">{historical.averageClientSatisfaction.toFixed(1)}/5</span>
                </div>
              </div>

              <div className="historical-providers">
                <div className="provider-section">
                  <h4>Top Performing Providers</h4>
                  <div className="provider-list">
                    {historical.topProviders.map((provider) => (
                      <div key={provider.providerId} className="provider-item">
                        <span className="name">{provider.providerName}</span>
                        <span className="wait-time">
                          Avg Wait: {formatSeconds(provider.averageWaitTime)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="provider-section">
                  <h4>Slowest Providers</h4>
                  <div className="provider-list">
                    {historical.slowestProviders.map((provider) => (
                      <div key={provider.providerId} className="provider-item">
                        <span className="name">{provider.providerName}</span>
                        <span className="wait-time">
                          Avg Wait: {formatSeconds(provider.averageWaitTime)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="no-data">No historical data available for the selected period</div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatSeconds(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatPeriod(period: string): string {
  const [year, month] = period.split('-');
  const date = new Date(Number(year), Number(month) - 1);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
  }).format(date);
}

function getCurrentWaitTime(arrivalTime: Date): number {
  const now = new Date();
  return Math.floor((now.getTime() - new Date(arrivalTime).getTime()) / 1000);
}

function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getComplianceLevel(percentage: number): string {
  if (percentage >= 95) return 'excellent';
  if (percentage >= 90) return 'good';
  if (percentage >= 80) return 'fair';
  return 'poor';
}

export default WaitTimeDisplay;
