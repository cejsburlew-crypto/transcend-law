// Real-Time Status Page
// Public status monitoring dashboard with live component health, incidents, and maintenance info

import React, { useState, useEffect, useCallback } from 'react';
import './StatusPage.css';

// ============================================================================
// Type Definitions
// ============================================================================

interface SystemComponent {
  id: string;
  name: string;
  status: 'operational' | 'degraded' | 'outage';
  uptime: number;
  responseTime: number;
  description?: string;
  lastUpdate: string;
}

interface IncidentUpdate {
  timestamp: string;
  message: string;
  status: string;
}

interface Incident {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'major' | 'minor';
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  affectedComponents: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  updates: IncidentUpdate[];
}

interface ScheduledMaintenance {
  id: string;
  title: string;
  description: string;
  affectedComponents: string[];
  scheduledStart: string;
  scheduledEnd: string;
  status: 'scheduled' | 'in-progress' | 'completed';
}

interface SystemStatus {
  status: 'operational' | 'degraded' | 'major-outage';
  lastUpdate: string;
  components: SystemComponent[];
  incidents: Incident[];
  scheduledMaintenance: ScheduledMaintenance[];
  uptime24h: number;
  uptime7d: number;
  uptime30d: number;
}

interface SubscriptionForm {
  email: string;
  notifyAll: boolean;
  notifyIncidents: boolean;
  notifyMaintenance: boolean;
}

// ============================================================================
// Status Page Component
// ============================================================================

export const StatusPage: React.FC = () => {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'incidents' | 'maintenance'>('overview');
  const [subscriptionForm, setSubscriptionForm] = useState<SubscriptionForm>({
    email: '',
    notifyAll: true,
    notifyIncidents: true,
    notifyMaintenance: true,
  });
  const [subscriptionMessage, setSubscriptionMessage] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch system status
  const fetchStatus = useCallback(async () => {
    try {
      setRefreshing(true);
      const response = await fetch('/api/v2/status/system');
      if (!response.ok) throw new Error('Failed to fetch status');

      const data = await response.json();
      setSystemStatus(data);
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Initial load and polling
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Handle subscription
  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubscriptionMessage(null);

    try {
      const response = await fetch('/api/v2/status/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscriptionForm),
      });

      if (!response.ok) throw new Error('Subscription failed');

      setSubscriptionMessage({
        type: 'success',
        message: 'Check your email to verify your subscription!',
      });
      setSubscriptionForm({
        email: '',
        notifyAll: true,
        notifyIncidents: true,
        notifyMaintenance: true,
      });
    } catch (error) {
      setSubscriptionMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Subscription failed',
      });
    }
  };

  if (loading && !systemStatus) {
    return (
      <div className="status-page">
        <div className="status-loading">
          <div className="spinner"></div>
          <p>Loading status...</p>
        </div>
      </div>
    );
  }

  if (!systemStatus) {
    return (
      <div className="status-page">
        <div className="status-error">
          <h2>Unable to Load Status</h2>
          <p>We're having trouble loading the system status. Please try again later.</p>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return '✅';
      case 'degraded':
        return '⚠️';
      case 'outage':
      case 'major-outage':
        return '🔴';
      case 'investigating':
      case 'identified':
        return '⏳';
      case 'monitoring':
        return '👁️';
      case 'resolved':
        return '✅';
      default:
        return '❓';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
        return '#4CAF50';
      case 'degraded':
        return '#FF9800';
      case 'outage':
      case 'major-outage':
        return '#F44336';
      default:
        return '#999';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#F44336';
      case 'major':
        return '#FF9800';
      case 'minor':
        return '#FFC107';
      default:
        return '#999';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const calculateUptimeColor = (uptime: number) => {
    if (uptime >= 99.9) return '#4CAF50';
    if (uptime >= 99.0) return '#FF9800';
    return '#F44336';
  };

  const activeIncidents = systemStatus.incidents.filter((i) => i.status !== 'resolved');
  const incidentHistory = systemStatus.incidents.filter((i) => i.status === 'resolved');

  return (
    <div className="status-page">
      {/* Header */}
      <header className="status-header">
        <div className="status-header-content">
          <div className="logo-section">
            <h1>⚖️ Transcend Law Status</h1>
            <p>System Health & Incident Tracking</p>
          </div>
          <div className="header-actions">
            <button
              className={`refresh-btn ${refreshing ? 'refreshing' : ''}`}
              onClick={fetchStatus}
              disabled={refreshing}
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Status Summary Bar */}
      <div className="status-summary">
        <div className="summary-item">
          <span className="summary-label">System Status</span>
          <span className="summary-value" style={{ color: getStatusColor(systemStatus.status) }}>
            {getStatusIcon(systemStatus.status)} {systemStatus.status.toUpperCase()}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Last Updated</span>
          <span className="summary-value">{formatDate(systemStatus.lastUpdate)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Active Incidents</span>
          <span className="summary-value">{activeIncidents.length}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">30-Day Uptime</span>
          <span className="summary-value" style={{ color: calculateUptimeColor(systemStatus.uptime30d) }}>
            {systemStatus.uptime30d.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="status-tabs">
        <button
          className={`tab-button ${selectedTab === 'overview' ? 'active' : ''}`}
          onClick={() => setSelectedTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-button ${selectedTab === 'incidents' ? 'active' : ''}`}
          onClick={() => setSelectedTab('incidents')}
        >
          Incidents {activeIncidents.length > 0 && <span className="badge">{activeIncidents.length}</span>}
        </button>
        <button
          className={`tab-button ${selectedTab === 'maintenance' ? 'active' : ''}`}
          onClick={() => setSelectedTab('maintenance')}
        >
          Maintenance {systemStatus.scheduledMaintenance.length > 0 && <span className="badge">{systemStatus.scheduledMaintenance.length}</span>}
        </button>
      </div>

      {/* Tab Content */}
      <div className="status-content">
        {/* Overview Tab */}
        {selectedTab === 'overview' && (
          <div className="tab-pane active">
            {/* Components Section */}
            <section className="components-section">
              <h2>System Components</h2>
              <div className="components-grid">
                {systemStatus.components.map((component) => (
                  <div key={component.id} className="component-card">
                    <div className="component-header">
                      <span className="component-icon">
                        {getStatusIcon(component.status)}
                      </span>
                      <div className="component-info">
                        <h3>{component.name}</h3>
                        <p className="component-description">
                          {component.description}
                        </p>
                      </div>
                    </div>

                    <div className="component-status">
                      <span
                        className="status-badge"
                        style={{ color: getStatusColor(component.status) }}
                      >
                        {component.status.charAt(0).toUpperCase() +
                          component.status.slice(1)}
                      </span>
                    </div>

                    <div className="component-metrics">
                      <div className="metric">
                        <span className="metric-label">Uptime</span>
                        <span
                          className="metric-value"
                          style={{ color: calculateUptimeColor(component.uptime) }}
                        >
                          {component.uptime.toFixed(2)}%
                        </span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">Response Time</span>
                        <span className="metric-value">{component.responseTime}ms</span>
                      </div>
                    </div>

                    <div className="component-footer">
                      <small>Updated: {formatDate(component.lastUpdate)}</small>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Uptime Section */}
            <section className="uptime-section">
              <h2>Uptime History</h2>
              <div className="uptime-grid">
                <div className="uptime-card">
                  <span className="uptime-period">24 Hours</span>
                  <span
                    className="uptime-percentage"
                    style={{ color: calculateUptimeColor(systemStatus.uptime24h) }}
                  >
                    {systemStatus.uptime24h.toFixed(2)}%
                  </span>
                </div>
                <div className="uptime-card">
                  <span className="uptime-period">7 Days</span>
                  <span
                    className="uptime-percentage"
                    style={{ color: calculateUptimeColor(systemStatus.uptime7d) }}
                  >
                    {systemStatus.uptime7d.toFixed(2)}%
                  </span>
                </div>
                <div className="uptime-card">
                  <span className="uptime-period">30 Days</span>
                  <span
                    className="uptime-percentage"
                    style={{ color: calculateUptimeColor(systemStatus.uptime30d) }}
                  >
                    {systemStatus.uptime30d.toFixed(2)}%
                  </span>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Incidents Tab */}
        {selectedTab === 'incidents' && (
          <div className="tab-pane active">
            {/* Active Incidents */}
            {activeIncidents.length > 0 && (
              <section className="incidents-section">
                <h2>Active Incidents</h2>
                <div className="incidents-list">
                  {activeIncidents.map((incident) => (
                    <div key={incident.id} className="incident-card active">
                      <div className="incident-header">
                        <div className="incident-title">
                          <span className="incident-icon">
                            {getStatusIcon(incident.status)}
                          </span>
                          <div>
                            <h3>{incident.title}</h3>
                            <p className="incident-description">
                              {incident.description}
                            </p>
                          </div>
                        </div>
                        <div className="incident-meta">
                          <span
                            className="severity-badge"
                            style={{
                              backgroundColor: getSeverityColor(incident.severity),
                              color: 'white',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: 'bold',
                            }}
                          >
                            {incident.severity.toUpperCase()}
                          </span>
                          <span className="status-badge">
                            {incident.status.charAt(0).toUpperCase() +
                              incident.status.slice(1)}
                          </span>
                        </div>
                      </div>

                      <div className="incident-affected">
                        <strong>Affected Components:</strong>
                        <div className="component-tags">
                          {incident.affectedComponents.map((comp) => (
                            <span key={comp} className="component-tag">
                              {comp}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="incident-timeline">
                        <strong>Updates:</strong>
                        <div className="timeline">
                          {incident.updates.slice().reverse().map((update, idx) => (
                            <div key={idx} className="timeline-item">
                              <span className="timeline-time">
                                {formatDate(update.timestamp)}
                              </span>
                              <span className="timeline-message">{update.message}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="incident-footer">
                        <small>
                          Created: {formatDate(incident.createdAt)}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Incident History */}
            {incidentHistory.length > 0 && (
              <section className="incidents-history">
                <h2>Resolved Incidents</h2>
                <div className="incidents-list">
                  {incidentHistory.slice(0, 10).map((incident) => (
                    <div key={incident.id} className="incident-card resolved">
                      <div className="incident-header">
                        <div className="incident-title">
                          <span className="incident-icon">✅</span>
                          <div>
                            <h3>{incident.title}</h3>
                            <p className="incident-description">
                              {incident.description}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="incident-footer">
                        <small>
                          Resolved: {incident.resolvedAt && formatDate(incident.resolvedAt)}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {activeIncidents.length === 0 && incidentHistory.length === 0 && (
              <div className="empty-state">
                <p>No incidents reported. System is running smoothly!</p>
              </div>
            )}
          </div>
        )}

        {/* Maintenance Tab */}
        {selectedTab === 'maintenance' && (
          <div className="tab-pane active">
            {systemStatus.scheduledMaintenance.length > 0 ? (
              <section className="maintenance-section">
                <div className="maintenance-list">
                  {systemStatus.scheduledMaintenance.map((maintenance) => (
                    <div key={maintenance.id} className="maintenance-card">
                      <div className="maintenance-header">
                        <div className="maintenance-title">
                          <span className="maintenance-icon">
                            {getStatusIcon(maintenance.status)}
                          </span>
                          <div>
                            <h3>{maintenance.title}</h3>
                            <p className="maintenance-description">
                              {maintenance.description}
                            </p>
                          </div>
                        </div>
                        <span className="status-badge">
                          {maintenance.status.charAt(0).toUpperCase() +
                            maintenance.status.slice(1)}
                        </span>
                      </div>

                      <div className="maintenance-window">
                        <strong>Scheduled Window:</strong>
                        <p>
                          <strong>Start:</strong> {formatDate(maintenance.scheduledStart)}
                        </p>
                        <p>
                          <strong>End:</strong> {formatDate(maintenance.scheduledEnd)}
                        </p>
                      </div>

                      <div className="maintenance-affected">
                        <strong>Affected Components:</strong>
                        <div className="component-tags">
                          {maintenance.affectedComponents.map((comp) => (
                            <span key={comp} className="component-tag">
                              {comp}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <div className="empty-state">
                <p>No scheduled maintenance. All systems clear!</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Subscribe Section */}
      <section className="subscribe-section">
        <div className="subscribe-container">
          <h2>Get Status Updates</h2>
          <p>Subscribe to receive email notifications about incidents and scheduled maintenance.</p>

          <form className="subscribe-form" onSubmit={handleSubscribe}>
            <div className="form-group">
              <input
                type="email"
                placeholder="Enter your email address"
                value={subscriptionForm.email}
                onChange={(e) =>
                  setSubscriptionForm({
                    ...subscriptionForm,
                    email: e.target.value,
                  })
                }
                required
              />
            </div>

            <div className="form-options">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={subscriptionForm.notifyAll}
                  onChange={(e) =>
                    setSubscriptionForm({
                      ...subscriptionForm,
                      notifyAll: e.target.checked,
                    })
                  }
                />
                <span>Notify me about all updates</span>
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={subscriptionForm.notifyIncidents}
                  onChange={(e) =>
                    setSubscriptionForm({
                      ...subscriptionForm,
                      notifyIncidents: e.target.checked,
                    })
                  }
                />
                <span>Notify me about incidents</span>
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={subscriptionForm.notifyMaintenance}
                  onChange={(e) =>
                    setSubscriptionForm({
                      ...subscriptionForm,
                      notifyMaintenance: e.target.checked,
                    })
                  }
                />
                <span>Notify me about maintenance</span>
              </label>
            </div>

            <button type="submit" className="btn-subscribe">
              Subscribe
            </button>

            {subscriptionMessage && (
              <div className={`subscription-message ${subscriptionMessage.type}`}>
                {subscriptionMessage.message}
              </div>
            )}
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="status-footer">
        <p>Transcend Law Status Page • Real-time system monitoring</p>
        <p>Updates every 30 seconds • Last updated: {formatDate(systemStatus.lastUpdate)}</p>
      </footer>
    </div>
  );
};

export default StatusPage;
