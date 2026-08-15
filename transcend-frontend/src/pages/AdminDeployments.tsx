// AdminDeployments - Master Deployment System Admin Panel
// Manages all deployments, monitoring, and emergency controls

import React, { useState, useEffect, useCallback } from 'react';
import './AdminDeployments.css';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface DeploymentTarget {
  id: string;
  name: string;
  environment: 'production' | 'staging' | 'development';
  status: 'healthy' | 'degraded' | 'down';
  lastHealthCheck: string;
}

interface DeploymentForm {
  version: string;
  target: string;
  services: string[];
  rolloutPercentage: number;
  scheduledTime: string;
  changeNotes: string;
  requiresApproval: boolean;
}

interface ActiveDeployment {
  id: string;
  version: string;
  target: string;
  status: 'pending' | 'deploying' | 'completed' | 'failed' | 'rolled_back';
  progress: number;
  startedAt: string;
  completedAt?: string;
  services: { name: string; status: 'pending' | 'deployed' | 'failed' }[];
  deployedBy: string;
  changeNotes: string;
}

interface DeploymentHistory {
  id: string;
  version: string;
  target: string;
  status: 'success' | 'failed' | 'rolled_back';
  duration: number;
  deployedAt: string;
  deployedBy: string;
  affectedServices: string[];
}

interface LocationCredibilityData {
  region: string;
  credibilityScore: number;
  deploymentCount: number;
  failureRate: number;
  avgDeploymentTime: number;
  lastDeployment: string;
}

interface UserRole {
  userId: string;
  role: 'admin' | 'operator' | 'viewer';
}

// ============================================================================
// ADMIN DEPLOYMENT PANEL COMPONENT
// ============================================================================

interface AdminDeploymentPanelProps {
  onSubmit: (form: DeploymentForm) => void;
  isLoading?: boolean;
  deploymentTargets: DeploymentTarget[];
}

const AdminDeploymentPanel: React.FC<AdminDeploymentPanelProps> = ({
  onSubmit,
  isLoading = false,
  deploymentTargets,
}) => {
  const [form, setForm] = useState<DeploymentForm>({
    version: '',
    target: '',
    services: [],
    rolloutPercentage: 100,
    scheduledTime: '',
    changeNotes: '',
    requiresApproval: false,
  });

  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());

  const availableServices = [
    'Auth Service',
    'API Gateway',
    'Database Layer',
    'File Storage',
    'Notifications',
    'Analytics',
    'Cache Layer',
    'Search Index',
  ];

  const handleServiceToggle = (service: string) => {
    const updated = new Set(selectedServices);
    if (updated.has(service)) {
      updated.delete(service);
    } else {
      updated.add(service);
    }
    setSelectedServices(updated);
    setForm({ ...form, services: Array.from(updated) });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.version || !form.target || form.services.length === 0) {
      alert('Please fill in all required fields');
      return;
    }
    onSubmit(form);
  };

  return (
    <div className="deployment-panel">
      <div className="panel-header">
        <h2>Deployment Form</h2>
        <span className="panel-badge">Submit New Deployment</span>
      </div>

      <form onSubmit={handleSubmit} className="deployment-form">
        {/* Version Input */}
        <div className="form-group">
          <label htmlFor="version">
            Version Number <span className="required">*</span>
          </label>
          <input
            id="version"
            type="text"
            placeholder="e.g., 2.4.1"
            value={form.version}
            onChange={(e) => setForm({ ...form, version: e.target.value })}
            className="form-input"
            required
            disabled={isLoading}
          />
          <small className="help-text">Semantic versioning (major.minor.patch)</small>
        </div>

        {/* Target Environment */}
        <div className="form-group">
          <label htmlFor="target">
            Target Environment <span className="required">*</span>
          </label>
          <select
            id="target"
            value={form.target}
            onChange={(e) => setForm({ ...form, target: e.target.value })}
            className="form-input"
            required
            disabled={isLoading}
          >
            <option value="">Select environment...</option>
            {deploymentTargets.map((dt) => (
              <option key={dt.id} value={dt.id}>
                {dt.name} ({dt.environment}) - {dt.status}
              </option>
            ))}
          </select>
        </div>

        {/* Services Selection */}
        <div className="form-group">
          <label>
            Services to Deploy <span className="required">*</span>
          </label>
          <div className="services-grid">
            {availableServices.map((service) => (
              <label key={service} className="checkbox-label">
                <input
                  type="checkbox"
                  checked={selectedServices.has(service)}
                  onChange={() => handleServiceToggle(service)}
                  disabled={isLoading}
                />
                <span>{service}</span>
              </label>
            ))}
          </div>
          <small className="help-text">{selectedServices.size} service(s) selected</small>
        </div>

        {/* Rollout Percentage */}
        <div className="form-group">
          <label htmlFor="rollout">
            Rollout Percentage: <strong>{form.rolloutPercentage}%</strong>
          </label>
          <input
            id="rollout"
            type="range"
            min="10"
            max="100"
            step="10"
            value={form.rolloutPercentage}
            onChange={(e) => setForm({ ...form, rolloutPercentage: parseInt(e.target.value) })}
            className="form-slider"
            disabled={isLoading}
          />
          <small className="help-text">Start with canary deployment if under 100%</small>
        </div>

        {/* Scheduled Time */}
        <div className="form-group">
          <label htmlFor="scheduled">Scheduled Deployment Time (Optional)</label>
          <input
            id="scheduled"
            type="datetime-local"
            value={form.scheduledTime}
            onChange={(e) => setForm({ ...form, scheduledTime: e.target.value })}
            className="form-input"
            disabled={isLoading}
          />
          <small className="help-text">Leave empty for immediate deployment</small>
        </div>

        {/* Change Notes */}
        <div className="form-group">
          <label htmlFor="notes">Change Notes & Description</label>
          <textarea
            id="notes"
            placeholder="What's included in this deployment? Any breaking changes?"
            value={form.changeNotes}
            onChange={(e) => setForm({ ...form, changeNotes: e.target.value })}
            className="form-textarea"
            rows={4}
            disabled={isLoading}
          />
        </div>

        {/* Approval Checkbox */}
        <div className="form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={form.requiresApproval}
              onChange={(e) => setForm({ ...form, requiresApproval: e.target.checked })}
              disabled={isLoading}
            />
            <span>Require team approval before deployment</span>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="btn btn-primary btn-large"
          disabled={isLoading}
        >
          {isLoading ? 'Submitting...' : 'Submit Deployment'}
        </button>
      </form>
    </div>
  );
};

// ============================================================================
// DEPLOYMENT MONITOR COMPONENT
// ============================================================================

interface DeploymentMonitorProps {
  activeDeployments: ActiveDeployment[];
  onEmergencyStop: (deploymentId: string) => void;
  onRollback: (deploymentId: string) => void;
}

const DeploymentMonitor: React.FC<DeploymentMonitorProps> = ({
  activeDeployments,
  onEmergencyStop,
  onRollback,
}) => {
  const getProgressColor = (progress: number): string => {
    if (progress < 33) return '#f56565';
    if (progress < 66) return '#ed8936';
    return '#48bb78';
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'deploying':
        return 'badge-deploying';
      case 'completed':
        return 'badge-success';
      case 'failed':
        return 'badge-error';
      case 'rolled_back':
        return 'badge-warning';
      default:
        return 'badge-pending';
    }
  };

  return (
    <div className="deployment-monitor">
      <div className="panel-header">
        <h2>Real-time Status & Monitoring</h2>
        <span className="panel-badge">{activeDeployments.length} Active</span>
      </div>

      {activeDeployments.length === 0 ? (
        <div className="empty-state">
          <p>No active deployments</p>
          <small>Submit a new deployment to see real-time monitoring</small>
        </div>
      ) : (
        <div className="deployments-list">
          {activeDeployments.map((deployment) => (
            <div key={deployment.id} className="deployment-card">
              <div className="deployment-header">
                <div className="deployment-title">
                  <h3>Version {deployment.version}</h3>
                  <span className={`badge ${getStatusBadgeClass(deployment.status)}`}>
                    {deployment.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div className="deployment-time">
                  <small>{new Date(deployment.startedAt).toLocaleTimeString()}</small>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="progress-container">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${deployment.progress}%`,
                      backgroundColor: getProgressColor(deployment.progress),
                    }}
                  />
                </div>
                <span className="progress-text">{deployment.progress}% Complete</span>
              </div>

              {/* Services Status */}
              <div className="services-status">
                <h4>Services</h4>
                <div className="services-list">
                  {deployment.services.map((service) => (
                    <div key={service.name} className="service-item">
                      <span className="service-name">{service.name}</span>
                      <span
                        className={`service-status status-${service.status}`}
                      >
                        {service.status === 'deployed' && '✓'}
                        {service.status === 'pending' && '○'}
                        {service.status === 'failed' && '✗'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Deployment Info */}
              <div className="deployment-info">
                <div className="info-row">
                  <span className="info-label">Target:</span>
                  <span className="info-value">{deployment.target}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Deployed By:</span>
                  <span className="info-value">{deployment.deployedBy}</span>
                </div>
              </div>

              {/* Change Notes */}
              {deployment.changeNotes && (
                <div className="change-notes">
                  <p>{deployment.changeNotes}</p>
                </div>
              )}

              {/* Emergency Controls */}
              {deployment.status === 'deploying' && (
                <div className="emergency-controls">
                  <button
                    className="btn btn-warning"
                    onClick={() => onEmergencyStop(deployment.id)}
                  >
                    Emergency Stop
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => onRollback(deployment.id)}
                  >
                    Rollback Now
                  </button>
                </div>
              )}

              {deployment.status === 'completed' && (
                <div className="emergency-controls">
                  <button
                    className="btn btn-warning"
                    onClick={() => onRollback(deployment.id)}
                  >
                    Rollback to Previous
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// LOCATION CREDIBILITY COMPONENT
// ============================================================================

interface LocationCredibilityProps {
  credibilityData: LocationCredibilityData[];
}

const LocationCredibility: React.FC<LocationCredibilityProps> = ({ credibilityData }) => {
  const getCredibilityColor = (score: number): string => {
    if (score >= 95) return '#48bb78';
    if (score >= 80) return '#ed8936';
    return '#f56565';
  };

  const getCredibilityLabel = (score: number): string => {
    if (score >= 95) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Poor';
  };

  return (
    <div className="location-credibility">
      <div className="panel-header">
        <h3>Location Credibility</h3>
      </div>

      <div className="credibility-list">
        {credibilityData.map((location) => (
          <div key={location.region} className="credibility-item">
            <div className="credibility-header">
              <span className="region-name">{location.region}</span>
              <span
                className="credibility-score"
                style={{ color: getCredibilityColor(location.credibilityScore) }}
              >
                {location.credibilityScore}%
              </span>
            </div>

            <div className="credibility-bar">
              <div
                className="credibility-fill"
                style={{
                  width: `${location.credibilityScore}%`,
                  backgroundColor: getCredibilityColor(location.credibilityScore),
                }}
              />
            </div>

            <div className="credibility-label">
              {getCredibilityLabel(location.credibilityScore)}
            </div>

            <div className="credibility-metrics">
              <div className="metric">
                <span className="metric-label">Deployments:</span>
                <span className="metric-value">{location.deploymentCount}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Failure Rate:</span>
                <span className="metric-value">{location.failureRate.toFixed(1)}%</span>
              </div>
              <div className="metric">
                <span className="metric-label">Avg Time:</span>
                <span className="metric-value">{location.avgDeploymentTime}m</span>
              </div>
            </div>

            <div className="last-deployment">
              <small>Last: {new Date(location.lastDeployment).toLocaleDateString()}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// DEPLOYMENT HISTORY TABLE COMPONENT
// ============================================================================

interface DeploymentHistoryTableProps {
  history: DeploymentHistory[];
}

const DeploymentHistoryTable: React.FC<DeploymentHistoryTableProps> = ({ history }) => {
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'success':
        return 'color-success';
      case 'failed':
        return 'color-error';
      case 'rolled_back':
        return 'color-warning';
      default:
        return 'color-neutral';
    }
  };

  return (
    <div className="deployment-history">
      <div className="history-header">
        <h3>Deployment History</h3>
        <span className="history-count">{history.length} deployments</span>
      </div>

      <div className="table-container">
        <table className="history-table">
          <thead>
            <tr>
              <th>Version</th>
              <th>Target</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Deployed At</th>
              <th>Deployed By</th>
              <th>Services</th>
            </tr>
          </thead>
          <tbody>
            {history.map((entry) => (
              <tr key={entry.id}>
                <td className="version-cell">
                  <code>{entry.version}</code>
                </td>
                <td>{entry.target}</td>
                <td>
                  <span className={`status-badge ${getStatusColor(entry.status)}`}>
                    {entry.status.replace('_', ' ').toUpperCase()}
                  </span>
                </td>
                <td>{entry.duration}m</td>
                <td>
                  <small>{new Date(entry.deployedAt).toLocaleString()}</small>
                </td>
                <td>{entry.deployedBy}</td>
                <td>
                  <small>{entry.affectedServices.join(', ')}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN ADMIN DEPLOYMENTS COMPONENT
// ============================================================================

interface AdminDeploymentsProps {
  onLogout?: () => void;
}

export const AdminDeployments: React.FC<AdminDeploymentsProps> = ({ onLogout }) => {
  // Authentication State
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Deployment State
  const [deploymentTargets] = useState<DeploymentTarget[]>([
    {
      id: 'prod-us',
      name: 'US Production',
      environment: 'production',
      status: 'healthy',
      lastHealthCheck: new Date(Date.now() - 2 * 60000).toISOString(),
    },
    {
      id: 'prod-eu',
      name: 'EU Production',
      environment: 'production',
      status: 'healthy',
      lastHealthCheck: new Date(Date.now() - 3 * 60000).toISOString(),
    },
    {
      id: 'staging',
      name: 'Staging Environment',
      environment: 'staging',
      status: 'healthy',
      lastHealthCheck: new Date(Date.now() - 1 * 60000).toISOString(),
    },
    {
      id: 'dev',
      name: 'Development',
      environment: 'development',
      status: 'healthy',
      lastHealthCheck: new Date().toISOString(),
    },
  ]);

  const [activeDeployments, setActiveDeployments] = useState<ActiveDeployment[]>([
    {
      id: 'dep-001',
      version: '2.4.1',
      target: 'prod-us',
      status: 'deploying',
      progress: 65,
      startedAt: new Date(Date.now() - 8 * 60000).toISOString(),
      services: [
        { name: 'API Gateway', status: 'deployed' },
        { name: 'Auth Service', status: 'deployed' },
        { name: 'Database Layer', status: 'deploying' },
        { name: 'Cache Layer', status: 'pending' },
      ],
      deployedBy: 'Alice Johnson',
      changeNotes: 'Performance improvements and security patches',
    },
  ]);

  const [deploymentHistory] = useState<DeploymentHistory[]>([
    {
      id: 'hist-001',
      version: '2.4.0',
      target: 'prod-eu',
      status: 'success',
      duration: 12,
      deployedAt: '2026-08-14T15:30:00Z',
      deployedBy: 'Bob Smith',
      affectedServices: ['API Gateway', 'Auth Service'],
    },
    {
      id: 'hist-002',
      version: '2.3.9',
      target: 'staging',
      status: 'success',
      duration: 8,
      deployedAt: '2026-08-14T14:15:00Z',
      deployedBy: 'Alice Johnson',
      affectedServices: ['Database Layer', 'Cache Layer'],
    },
    {
      id: 'hist-003',
      version: '2.3.8',
      target: 'prod-us',
      status: 'rolled_back',
      duration: 15,
      deployedAt: '2026-08-14T12:00:00Z',
      deployedBy: 'Charlie Brown',
      affectedServices: ['All Services'],
    },
  ]);

  const [credibilityData] = useState<LocationCredibilityData[]>([
    {
      region: 'US-East',
      credibilityScore: 98,
      deploymentCount: 156,
      failureRate: 0.6,
      avgDeploymentTime: 10,
      lastDeployment: '2026-08-15T10:30:00Z',
    },
    {
      region: 'US-West',
      credibilityScore: 96,
      deploymentCount: 142,
      failureRate: 0.9,
      avgDeploymentTime: 11,
      lastDeployment: '2026-08-15T09:45:00Z',
    },
    {
      region: 'EU-Central',
      credibilityScore: 94,
      deploymentCount: 128,
      failureRate: 1.2,
      avgDeploymentTime: 12,
      lastDeployment: '2026-08-15T08:15:00Z',
    },
    {
      region: 'Asia-Pacific',
      credibilityScore: 91,
      deploymentCount: 98,
      failureRate: 1.8,
      avgDeploymentTime: 14,
      lastDeployment: '2026-08-15T07:00:00Z',
    },
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // =========================================================================
  // AUTHENTICATION & AUTHORIZATION
  // =========================================================================

  useEffect(() => {
    const authenticateUser = () => {
      const storedRole = localStorage.getItem('userRole');
      const userId = localStorage.getItem('userId');

      if (!userId) {
        setIsAuthorized(false);
        return;
      }

      // Simulate role verification
      const role = (storedRole as 'admin' | 'operator' | 'viewer' | null) || 'viewer';
      setUserRole({ userId, role });

      // Only admins can access deployment page
      if (role === 'admin') {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
      }
    };

    authenticateUser();
  }, []);

  // =========================================================================
  // EVENT HANDLERS
  // =========================================================================

  const handleDeploymentSubmit = useCallback(async (form: DeploymentForm) => {
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      const newDeployment: ActiveDeployment = {
        id: `dep-${Date.now()}`,
        version: form.version,
        target: form.target,
        status: form.requiresApproval ? 'pending' : 'deploying',
        progress: form.requiresApproval ? 0 : 15,
        startedAt: new Date().toISOString(),
        services: form.services.map((name) => ({
          name,
          status: 'pending' as const,
        })),
        deployedBy: userRole?.userId || 'System',
        changeNotes: form.changeNotes,
      };

      setActiveDeployments((prev) => [newDeployment, ...prev]);
      setIsLoading(false);
      showToast('success', `Deployment ${form.version} submitted successfully`);
    }, 1000);
  }, [userRole?.userId]);

  const handleEmergencyStop = useCallback((deploymentId: string) => {
    if (confirm('Are you sure you want to emergency stop this deployment?')) {
      setActiveDeployments((prev) =>
        prev.map((dep) =>
          dep.id === deploymentId
            ? { ...dep, status: 'failed' as const, progress: 100 }
            : dep
        )
      );
      showToast('warning', 'Deployment emergency stopped');
    }
  }, []);

  const handleRollback = useCallback((deploymentId: string) => {
    if (confirm('Are you sure you want to rollback this deployment?')) {
      setActiveDeployments((prev) =>
        prev.map((dep) =>
          dep.id === deploymentId
            ? { ...dep, status: 'rolled_back' as const }
            : dep
        )
      );
      showToast('warning', 'Deployment rolled back to previous version');
    }
  }, []);

  const showToast = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    if (onLogout) onLogout();
  };

  // =========================================================================
  // RENDER AUTHORIZATION GUARD
  // =========================================================================

  if (!isAuthorized || !userRole) {
    return (
      <div className="admin-deployments-container">
        <div className="access-denied">
          <div className="access-denied-content">
            <h2>Access Denied</h2>
            <p>You do not have permission to access this page.</p>
            <p>Only administrators can manage deployments.</p>
            <button className="btn btn-primary" onClick={handleLogout}>
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER MAIN COMPONENT
  // =========================================================================

  return (
    <div className="admin-deployments-container">
      {/* Header */}
      <header className="admin-header">
        <div className="header-content">
          <div>
            <h1>Master Deployment System</h1>
            <p>Admin Control Panel</p>
          </div>
          <div className="header-actions">
            <button className="btn btn-outline" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="admin-content">
        {/* Toast Notification */}
        {toast && (
          <div className={`toast toast-${toast.type}`}>
            <span>{toast.message}</span>
          </div>
        )}

        {/* Two-Column Layout */}
        <div className="deployment-layout">
          {/* Left Column: Deployment Form */}
          <div className="deployment-form-section">
            <AdminDeploymentPanel
              onSubmit={handleDeploymentSubmit}
              isLoading={isLoading}
              deploymentTargets={deploymentTargets}
            />
          </div>

          {/* Right Column: Status & Monitoring */}
          <div className="deployment-status-section">
            {/* Monitor */}
            <DeploymentMonitor
              activeDeployments={activeDeployments}
              onEmergencyStop={handleEmergencyStop}
              onRollback={handleRollback}
            />

            {/* Location Credibility Sidebar */}
            <aside className="credibility-sidebar">
              <LocationCredibility credibilityData={credibilityData} />
            </aside>
          </div>
        </div>

        {/* Deployment History */}
        <section className="deployment-history-section">
          <DeploymentHistoryTable history={deploymentHistory} />
        </section>
      </main>
    </div>
  );
};

export default AdminDeployments;
