// SLA Status Component
// Displays current SLA compliance, incidents, credits, and historical data

import React, { useState, useEffect } from 'react';
import './SLAStatus.css';

interface Incident {
  id: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'ongoing' | 'resolved' | 'investigating';
  affectedServices: string[];
  rootCause?: string;
  impact: {
    downtime: number;
    affectedUsers: number;
    estimatedLoss: number;
  };
  resolution?: {
    resolvedAt: string;
    actionTaken: string;
    preventiveMeasures: string;
  };
  createdAt: string;
}

interface SLACredit {
  id: string;
  amount: number;
  percentage: number;
  reason: string;
  month: string;
  status: 'pending' | 'applied' | 'expired';
  appliedDate?: string;
  expiryDate: string;
  createdAt: string;
  emailSent: boolean;
}

interface ComplianceMonth {
  month: string;
  uptime: number;
  targetUptime: number;
  breached: boolean;
  totalDowntime: number;
  creditPercentage: number;
  complianceStatus: 'compliant' | 'breached' | 'critical';
}

interface SLAStatusData {
  currentUptime: number;
  targetUptime: number;
  status: 'compliant' | 'at-risk' | 'breached';
  daysIntoMonth: number;
  requiredUptimeRemaining: number;
  currentMonthIncidents: Incident[];
  projectedMonthlyCredit?: number;
  creditHistory: SLACredit[];
  lastIncident?: Incident;
  healthStatus: 'healthy' | 'degraded' | 'critical';
}

interface HealthCheckSummary {
  timestamp: string;
  allServicesUp: boolean;
  serviceStatuses: Record<string, {
    status: 'up' | 'down' | 'degraded';
    responseTime: number;
    lastCheck: string;
  }>;
  uptime24h: number;
  uptime7d: number;
  uptime30d: number;
}

interface SLAStatusProps {
  publicMode?: boolean;
  userId?: string;
  onIncidentClick?: (incident: Incident) => void;
}

export const SLAStatus: React.FC<SLAStatusProps> = ({
  publicMode = false,
  userId,
  onIncidentClick,
}) => {
  const [slaStatus, setSLAStatus] = useState<SLAStatusData | null>(null);
  const [healthCheck, setHealthCheck] = useState<HealthCheckSummary | null>(null);
  const [complianceHistory, setComplianceHistory] = useState<ComplianceMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'incidents' | 'credits' | 'history'>('overview');
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);

  useEffect(() => {
    fetchSLAData();
    const interval = setInterval(fetchSLAData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchSLAData = async () => {
    try {
      setLoading(true);

      const endpoints = publicMode ?
        ['/api/v2/sla/public/status', '/api/v2/sla/public/health'] :
        [`/api/v2/sla/status?userId=${userId}`, '/api/v2/sla/health'];

      const [statusRes, healthRes] = await Promise.all([
        fetch(endpoints[0]),
        fetch(endpoints[1]),
      ]);

      if (!statusRes.ok || !healthRes.ok) {
        throw new Error('Failed to fetch SLA data');
      }

      const statusData = await statusRes.json();
      const healthData = await healthRes.json();

      setSLAStatus(statusData);
      setHealthCheck(healthData);

      // Fetch compliance history if available
      if (!publicMode) {
        const historyRes = await fetch('/api/v2/sla/compliance/history', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          },
        });

        if (historyRes.ok) {
          const history = await historyRes.json();
          setComplianceHistory(history);
        }
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !slaStatus) {
    return (
      <div className="sla-container loading">
        <div className="spinner"></div>
        <p>Loading SLA status...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sla-container error">
        <div className="error-message">
          <strong>Error loading SLA status:</strong> {error}
        </div>
      </div>
    );
  }

  if (!slaStatus || !healthCheck) {
    return null;
  }

  const statusColor = slaStatus.status === 'compliant' ? '#10b981' :
                      slaStatus.status === 'at-risk' ? '#f59e0b' : '#ef4444';

  const healthColor = slaStatus.healthStatus === 'healthy' ? '#10b981' :
                      slaStatus.healthStatus === 'degraded' ? '#f59e0b' : '#ef4444';

  const uptimeDifference = slaStatus.targetUptime - slaStatus.currentUptime;
  const projectedCredit = slaStatus.projectedMonthlyCredit || 0;

  return (
    <div className="sla-container">
      <div className="sla-header">
        <h1>Service Level Agreement (SLA) Status</h1>
        <p className="subtitle">Real-time uptime monitoring and compliance tracking</p>
      </div>

      {/* Key Metrics Cards */}
      <div className="sla-metrics-grid">
        {/* Current Uptime */}
        <div className="metric-card">
          <div className="metric-header">
            <h3>Current Uptime</h3>
            <span className={`status-badge ${slaStatus.status}`}>
              {slaStatus.status.toUpperCase()}
            </span>
          </div>
          <div className="metric-content">
            <div className="large-number" style={{ color: statusColor }}>
              {slaStatus.currentUptime.toFixed(2)}%
            </div>
            <p className="metric-label">Target: {slaStatus.targetUptime}%</p>
            {uptimeDifference > 0 && (
              <p className="metric-warning">
                {uptimeDifference.toFixed(3)}% below target
              </p>
            )}
            {slaStatus.projectedMonthlyCredit && (
              <p className="metric-credit">
                Projected Credit: {slaStatus.projectedMonthlyCredit.toFixed(1)}%
              </p>
            )}
          </div>
        </div>

        {/* Health Status */}
        <div className="metric-card">
          <div className="metric-header">
            <h3>System Health</h3>
            <span className={`health-badge ${slaStatus.healthStatus}`}>
              {slaStatus.healthStatus.toUpperCase()}
            </span>
          </div>
          <div className="metric-content">
            <div className="status-icon" style={{ color: healthColor }}>
              {slaStatus.healthStatus === 'healthy' && '✓'}
              {slaStatus.healthStatus === 'degraded' && '⚠'}
              {slaStatus.healthStatus === 'critical' && '✕'}
            </div>
            <p className="metric-label">
              {healthCheck.allServicesUp ? 'All Services Online' : 'Service Issues Detected'}
            </p>
            <div className="uptime-grid">
              <div>24h: {healthCheck.uptime24h}%</div>
              <div>7d: {healthCheck.uptime7d}%</div>
              <div>30d: {healthCheck.uptime30d}%</div>
            </div>
          </div>
        </div>

        {/* Month Progress */}
        <div className="metric-card">
          <div className="metric-header">
            <h3>Month Progress</h3>
          </div>
          <div className="metric-content">
            <div className="progress-data">
              <p>Day {slaStatus.daysIntoMonth} of the month</p>
              <p className="metric-label">
                Required uptime remaining: {slaStatus.requiredUptimeRemaining.toFixed(2)}%
              </p>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${(slaStatus.daysIntoMonth / 31) * 100}%`,
                  backgroundColor: statusColor,
                }}
              ></div>
            </div>
          </div>
        </div>

        {/* Incidents Summary */}
        <div className="metric-card">
          <div className="metric-header">
            <h3>Current Incidents</h3>
          </div>
          <div className="metric-content">
            <div className="large-number">
              {slaStatus.currentMonthIncidents.length}
            </div>
            {slaStatus.currentMonthIncidents.length > 0 && (
              <div className="incidents-summary">
                {slaStatus.currentMonthIncidents.map(incident => (
                  <div key={incident.id} className={`incident-badge ${incident.severity}`}>
                    {incident.severity.toUpperCase()}
                  </div>
                ))}
              </div>
            )}
            {slaStatus.lastIncident && (
              <p className="metric-label">
                Last: {new Date(slaStatus.lastIncident.startTime).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Service Status Grid */}
      <div className="services-section">
        <h2>Service Status</h2>
        <div className="services-grid">
          {Object.entries(healthCheck.serviceStatuses).map(([service, status]) => (
            <div key={service} className={`service-card ${status.status}`}>
              <div className="service-header">
                <span className={`status-dot ${status.status}`}></span>
                <h4>{service}</h4>
              </div>
              <div className="service-details">
                <p>Response: {status.responseTime}ms</p>
                <p>Last Check: {new Date(status.lastCheck).toLocaleTimeString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="sla-tabs">
        <div className="tab-buttons">
          <button
            className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`tab-button ${activeTab === 'incidents' ? 'active' : ''}`}
            onClick={() => setActiveTab('incidents')}
          >
            Incidents ({slaStatus.currentMonthIncidents.length})
          </button>
          {!publicMode && (
            <>
              <button
                className={`tab-button ${activeTab === 'credits' ? 'active' : ''}`}
                onClick={() => setActiveTab('credits')}
              >
                Credits
              </button>
              <button
                className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                History
              </button>
            </>
          )}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="tab-content">
            <div className="overview-section">
              <h3>SLA Compliance Details</h3>
              <div className="detail-grid">
                <div className="detail-row">
                  <span className="detail-label">Current Uptime:</span>
                  <span className="detail-value">{slaStatus.currentUptime.toFixed(3)}%</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Target Uptime:</span>
                  <span className="detail-value">{slaStatus.targetUptime}%</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Status:</span>
                  <span className={`detail-value status-${slaStatus.status}`}>
                    {slaStatus.status.replace('-', ' ').toUpperCase()}
                  </span>
                </div>
                {projectedCredit > 0 && (
                  <div className="detail-row highlight">
                    <span className="detail-label">Projected Credit:</span>
                    <span className="detail-value">{projectedCredit.toFixed(1)}%</span>
                  </div>
                )}
              </div>

              <div className="info-box">
                <h4>How SLA Credits Work</h4>
                <p>
                  If our uptime falls below 99.9% in any given month, we automatically
                  issue you a credit calculated as follows:
                </p>
                <ul>
                  <li>99.0% - 99.89%: 10% credit</li>
                  <li>98.0% - 98.99%: 25% credit</li>
                  <li>97.0% - 97.99%: 50% credit</li>
                  <li>Below 97.0%: 100% credit</li>
                </ul>
                <p>
                  Credits are valid for 12 months and can be applied to your next invoice.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Incidents Tab */}
        {activeTab === 'incidents' && (
          <div className="tab-content">
            <div className="incidents-section">
              {slaStatus.currentMonthIncidents.length === 0 ? (
                <div className="empty-state">
                  <p>No incidents this month. Great service!</p>
                </div>
              ) : (
                <div className="incidents-list">
                  {slaStatus.currentMonthIncidents.map(incident => (
                    <div
                      key={incident.id}
                      className={`incident-card ${incident.severity}`}
                      onClick={() => {
                        setExpandedIncident(
                          expandedIncident === incident.id ? null : incident.id
                        );
                        onIncidentClick?.(incident);
                      }}
                    >
                      <div className="incident-header">
                        <div className="incident-title">
                          <span className={`severity-badge ${incident.severity}`}>
                            {incident.severity.toUpperCase()}
                          </span>
                          <h4>
                            {incident.affectedServices.join(', ')}
                          </h4>
                        </div>
                        <div className="incident-time">
                          <span className={`status-badge ${incident.status}`}>
                            {incident.status.toUpperCase()}
                          </span>
                          {incident.duration && (
                            <span className="duration">
                              {Math.floor(incident.duration / 60)}m {incident.duration % 60}s
                            </span>
                          )}
                        </div>
                      </div>

                      {expandedIncident === incident.id && (
                        <div className="incident-details">
                          <div className="detail-row">
                            <span>Start Time:</span>
                            <span>
                              {new Date(incident.startTime).toLocaleString()}
                            </span>
                          </div>
                          {incident.endTime && (
                            <div className="detail-row">
                              <span>End Time:</span>
                              <span>
                                {new Date(incident.endTime).toLocaleString()}
                              </span>
                            </div>
                          )}
                          <div className="detail-row">
                            <span>Affected Users:</span>
                            <span>{incident.impact.affectedUsers.toLocaleString()}</span>
                          </div>
                          <div className="detail-row">
                            <span>Estimated Impact:</span>
                            <span>${incident.impact.estimatedLoss.toFixed(2)}</span>
                          </div>

                          {incident.resolution && (
                            <div className="resolution-section">
                              <h5>Resolution</h5>
                              <p><strong>Action Taken:</strong> {incident.resolution.actionTaken}</p>
                              <p>
                                <strong>Preventive Measures:</strong>
                                {incident.resolution.preventiveMeasures}
                              </p>
                              <p className="resolved-time">
                                Resolved: {new Date(incident.resolution.resolvedAt).toLocaleString()}
                              </p>
                            </div>
                          )}

                          {incident.rootCause && (
                            <div className="root-cause">
                              <h5>Root Cause</h5>
                              <p>{incident.rootCause}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Credits Tab */}
        {!publicMode && activeTab === 'credits' && (
          <div className="tab-content">
            <div className="credits-section">
              {slaStatus.creditHistory.length === 0 ? (
                <div className="empty-state">
                  <p>No credits issued yet.</p>
                </div>
              ) : (
                <div className="credits-list">
                  {slaStatus.creditHistory.map(credit => (
                    <div key={credit.id} className={`credit-card ${credit.status}`}>
                      <div className="credit-header">
                        <div>
                          <h4>${credit.amount.toFixed(2)}</h4>
                          <p className="credit-month">
                            {new Date(credit.month).toLocaleDateString('en-US', {
                              month: 'long',
                              year: 'numeric',
                            })}
                          </p>
                        </div>
                        <div className="credit-status">
                          <span className={`status-badge ${credit.status}`}>
                            {credit.status.toUpperCase()}
                          </span>
                          <p className="credit-percentage">{credit.percentage.toFixed(1)}%</p>
                        </div>
                      </div>
                      <div className="credit-details">
                        <p className="credit-reason">{credit.reason}</p>
                        {credit.status === 'expired' && (
                          <p className="expired-date">
                            Expired: {new Date(credit.expiryDate).toLocaleDateString()}
                          </p>
                        )}
                        {credit.status === 'pending' && (
                          <p className="expiry-date">
                            Expires: {new Date(credit.expiryDate).toLocaleDateString()}
                          </p>
                        )}
                        {credit.appliedDate && (
                          <p className="applied-date">
                            Applied: {new Date(credit.appliedDate).toLocaleDateString()}
                          </p>
                        )}
                        {credit.emailSent && (
                          <p className="email-sent">Email notification sent</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* History Tab */}
        {!publicMode && activeTab === 'history' && (
          <div className="tab-content">
            <div className="history-section">
              {complianceHistory.length === 0 ? (
                <div className="empty-state">
                  <p>No compliance history available.</p>
                </div>
              ) : (
                <div className="history-table-container">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Uptime</th>
                        <th>Target</th>
                        <th>Status</th>
                        <th>Downtime</th>
                        <th>Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {complianceHistory.map((month, idx) => (
                        <tr
                          key={idx}
                          className={month.complianceStatus}
                        >
                          <td>
                            {new Date(month.month).toLocaleDateString('en-US', {
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td>{month.uptime.toFixed(2)}%</td>
                          <td>{month.targetUptime}%</td>
                          <td>
                            <span className={`status-badge ${month.complianceStatus}`}>
                              {month.complianceStatus.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            {Math.floor(month.totalDowntime / 60)}m
                            {' '}
                            {month.totalDowntime % 60}s
                          </td>
                          <td>
                            {month.creditPercentage > 0
                              ? `${month.creditPercentage.toFixed(1)}%`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Note */}
      <div className="sla-footer">
        <p>
          Last updated: {new Date().toLocaleString()}
          {publicMode && ' • '}
          {publicMode && (
            <a href="https://status.transcendlegal.com" target="_blank" rel="noopener noreferrer">
              View detailed status page
            </a>
          )}
        </p>
      </div>
    </div>
  );
};

export default SLAStatus;
