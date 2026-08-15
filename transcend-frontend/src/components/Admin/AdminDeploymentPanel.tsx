import React, { useState, useEffect } from 'react';
import './AdminDeploymentPanel.css';

interface DeploymentRequest {
  id: string;
  type: 'feature' | 'bugfix' | 'optimization' | 'docs';
  name: string;
  description: string;
  affected_pages: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'submitted' | 'in_progress' | 'testing' | 'staging' | 'production' | 'complete' | 'failed';
  created_at: string;
  completed_at?: string;
  git_branch: string;
  git_commit: string;
  test_results?: {
    passed: number;
    failed: number;
    coverage: number;
  };
  error_message?: string;
}

export default function AdminDeploymentPanel() {
  const [activeTab, setActiveTab] = useState<'submit' | 'status' | 'history'>('submit');
  const [deployments, setDeployments] = useState<DeploymentRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [formData, setFormData] = useState({
    type: 'feature' as const,
    name: '',
    description: '',
    affected_pages: '',
    priority: 'medium' as const,
  });

  useEffect(() => {
    loadDeployments();
    const interval = setInterval(loadDeployments, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadDeployments = async () => {
    try {
      const response = await fetch('/api/admin/deployments');
      if (response.ok) {
        const data = await response.json();
        setDeployments(data);
      }
    } catch (error) {
      console.error('Failed to load deployments:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/deployment-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formData.type,
          name: formData.name,
          description: formData.description,
          affected_pages: formData.affected_pages.split(',').map(p => p.trim()),
          priority: formData.priority,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessage(`✅ Deployment submitted! ID: ${data.id}`);
        setFormData({
          type: 'feature',
          name: '',
          description: '',
          affected_pages: '',
          priority: 'medium',
        });
        loadDeployments();
        setActiveTab('status');
      } else {
        setMessage('❌ Failed to submit deployment');
      }
    } catch (error) {
      setMessage(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: DeploymentRequest['status']) => {
    const colors: Record<DeploymentRequest['status'], string> = {
      submitted: '#3498db',
      in_progress: '#f39c12',
      testing: '#9b59b6',
      staging: '#1abc9c',
      production: '#2ecc71',
      complete: '#27ae60',
      failed: '#e74c3c',
    };
    return colors[status];
  };

  const getProgressSteps = (status: DeploymentRequest['status']): number => {
    const steps: Record<DeploymentRequest['status'], number> = {
      submitted: 10,
      in_progress: 20,
      testing: 40,
      staging: 60,
      production: 80,
      complete: 100,
      failed: 0,
    };
    return steps[status];
  };

  return (
    <div className="admin-deployment-panel">
      <div className="panel-header">
        <h1>🚀 Master Deployment System</h1>
        <p>Automated deployment pipeline: Code → Tests → Staging → Production</p>
      </div>

      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'submit' ? 'active' : ''}`}
          onClick={() => setActiveTab('submit')}
        >
          📝 Submit Request
        </button>
        <button
          className={`tab-button ${activeTab === 'status' ? 'active' : ''}`}
          onClick={() => setActiveTab('status')}
        >
          📊 Current Status
        </button>
        <button
          className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📜 History
        </button>
      </div>

      {message && (
        <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      {activeTab === 'submit' && (
        <div className="submit-section">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              >
                <option value="feature">✨ Feature</option>
                <option value="bugfix">🐛 Bug Fix</option>
                <option value="optimization">⚡ Optimization</option>
                <option value="docs">📚 Documentation</option>
              </select>
            </div>

            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                placeholder="e.g., Dark Mode Toggle"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                placeholder="What should it do? Be specific."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                required
              />
            </div>

            <div className="form-group">
              <label>Affected Pages (comma-separated)</label>
              <input
                type="text"
                placeholder="e.g., Dashboard, Settings, Directory"
                value={formData.affected_pages}
                onChange={(e) => setFormData({ ...formData, affected_pages: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
              >
                <option value="low">🟢 Low</option>
                <option value="medium">🟡 Medium</option>
                <option value="high">🔴 High</option>
                <option value="critical">🚨 Critical</option>
              </select>
            </div>

            <button type="submit" disabled={loading} className="submit-button">
              {loading ? '⏳ Submitting...' : '🚀 SUBMIT TO DEPLOYMENT'}
            </button>
          </form>

          <div className="info-box">
            <h3>How It Works:</h3>
            <ol>
              <li>Submit your request above</li>
              <li>System generates code automatically</li>
              <li>Tests run (unit + integration)</li>
              <li>Deploys to staging</li>
              <li>Validates everything</li>
              <li>Goes to production</li>
              <li>Watch real-time status below</li>
            </ol>
          </div>
        </div>
      )}

      {activeTab === 'status' && (
        <div className="status-section">
          <h2>Current Deployments</h2>
          {deployments.filter(d => d.status !== 'complete').length === 0 ? (
            <div className="empty-state">
              <p>No active deployments</p>
            </div>
          ) : (
            <div className="deployments-grid">
              {deployments
                .filter(d => d.status !== 'complete')
                .map((deployment) => (
                  <div key={deployment.id} className="deployment-card">
                    <div className="deployment-header">
                      <h3>{deployment.name}</h3>
                      <span className="type-badge">{deployment.type}</span>
                    </div>

                    <p className="description">{deployment.description}</p>

                    <div className="progress-container">
                      <div
                        className="progress-bar"
                        style={{
                          width: `${getProgressSteps(deployment.status)}%`,
                          backgroundColor: getStatusColor(deployment.status),
                        }}
                      />
                    </div>

                    <div className="steps">
                      <span className={`step ${['submitted', 'in_progress', 'testing', 'staging', 'production', 'complete'].includes(deployment.status) ? 'active' : ''}`}>
                        Created
                      </span>
                      <span className={`step ${['in_progress', 'testing', 'staging', 'production', 'complete'].includes(deployment.status) ? 'active' : ''}`}>
                        Code Gen
                      </span>
                      <span className={`step ${['testing', 'staging', 'production', 'complete'].includes(deployment.status) ? 'active' : ''}`}>
                        Testing
                      </span>
                      <span className={`step ${['staging', 'production', 'complete'].includes(deployment.status) ? 'active' : ''}`}>
                        Staging
                      </span>
                      <span className={`step ${['production', 'complete'].includes(deployment.status) ? 'active' : ''}`}>
                        Production
                      </span>
                    </div>

                    <div className="status-info">
                      <p className="status" style={{ color: getStatusColor(deployment.status) }}>
                        Status: {deployment.status.toUpperCase()}
                      </p>
                      <p className="branch">Branch: {deployment.git_branch}</p>
                      {deployment.test_results && (
                        <p className="tests">
                          Tests: {deployment.test_results.passed}/{deployment.test_results.passed + deployment.test_results.failed} passed
                          {' '}({deployment.test_results.coverage}% coverage)
                        </p>
                      )}
                      {deployment.error_message && (
                        <p className="error">Error: {deployment.error_message}</p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="history-section">
          <h2>Deployment History</h2>
          {deployments.length === 0 ? (
            <div className="empty-state">
              <p>No deployments yet</p>
            </div>
          ) : (
            <div className="history-table">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Completed</th>
                    <th>Branch</th>
                  </tr>
                </thead>
                <tbody>
                  {deployments.map((deployment) => (
                    <tr key={deployment.id}>
                      <td className="name">{deployment.name}</td>
                      <td className="type">{deployment.type}</td>
                      <td>
                        <span
                          className="status-badge"
                          style={{ backgroundColor: getStatusColor(deployment.status) }}
                        >
                          {deployment.status}
                        </span>
                      </td>
                      <td className="time">
                        {new Date(deployment.created_at).toLocaleString()}
                      </td>
                      <td className="time">
                        {deployment.completed_at
                          ? new Date(deployment.completed_at).toLocaleString()
                          : '-'}
                      </td>
                      <td className="branch">{deployment.git_branch}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
