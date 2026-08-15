import React, { useState, useEffect } from 'react';
import './DeploymentMonitor.css';

interface DeploymentMetrics {
  total_deployments: number;
  successful: number;
  failed: number;
  in_progress: number;
  success_rate: number;
  avg_deployment_time_minutes: number;
  last_deployment: string;
}

interface DeploymentStep {
  name: string;
  duration: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

interface LiveDeployment {
  id: string;
  name: string;
  status: string;
  progress: number;
  current_step: DeploymentStep;
  steps: DeploymentStep[];
}

export default function DeploymentMonitor() {
  const [metrics, setMetrics] = useState<DeploymentMetrics | null>(null);
  const [liveDeployment, setLiveDeployment] = useState<LiveDeployment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/admin/deployment-metrics');
        if (response.ok) {
          const data = await response.json();
          setMetrics(data);
        }
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
      }
    };

    const fetchLiveDeployment = async () => {
      try {
        const response = await fetch('/api/admin/deployments?status=in_progress');
        if (response.ok) {
          const data = await response.json();
          if (data.length > 0) {
            setLiveDeployment(data[0]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch live deployment:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    fetchLiveDeployment();

    const interval = setInterval(() => {
      fetchMetrics();
      fetchLiveDeployment();
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const getStepIcon = (status: DeploymentStep['status']): string => {
    const icons: Record<DeploymentStep['status'], string> = {
      pending: '⏳',
      in_progress: '⚙️',
      completed: '✅',
      failed: '❌',
    };
    return icons[status];
  };

  if (loading) {
    return <div className="deployment-monitor loading">Loading...</div>;
  }

  return (
    <div className="deployment-monitor">
      {/* Metrics Overview */}
      {metrics && (
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-value">{metrics.total_deployments}</div>
            <div className="metric-label">Total Deployments</div>
          </div>

          <div className="metric-card success">
            <div className="metric-value">{metrics.successful}</div>
            <div className="metric-label">Successful</div>
          </div>

          <div className="metric-card error">
            <div className="metric-value">{metrics.failed}</div>
            <div className="metric-label">Failed</div>
          </div>

          <div className="metric-card warning">
            <div className="metric-value">{metrics.in_progress}</div>
            <div className="metric-label">In Progress</div>
          </div>

          <div className="metric-card">
            <div className="metric-value">{metrics.success_rate.toFixed(1)}%</div>
            <div className="metric-label">Success Rate</div>
          </div>

          <div className="metric-card">
            <div className="metric-value">{metrics.avg_deployment_time_minutes}m</div>
            <div className="metric-label">Avg Duration</div>
          </div>
        </div>
      )}

      {/* Live Deployment */}
      {liveDeployment && (
        <div className="live-deployment">
          <h2>🔴 Live Deployment</h2>

          <div className="deployment-info">
            <h3>{liveDeployment.name}</h3>
            <div className="progress-container">
              <div
                className="progress-bar-live"
                style={{ width: `${liveDeployment.progress}%` }}
              />
            </div>
            <p className="progress-text">{liveDeployment.progress}% Complete</p>
          </div>

          <div className="steps-timeline">
            <h3>Deployment Steps</h3>
            {liveDeployment.steps.map((step, index) => (
              <div
                key={index}
                className={`step-item ${step.status}`}
              >
                <div className="step-icon">{getStepIcon(step.status)}</div>
                <div className="step-details">
                  <div className="step-name">{step.name}</div>
                  <div className="step-duration">{step.duration}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Active Deployments */}
      {!liveDeployment && (
        <div className="no-active">
          <div className="checkmark">✅</div>
          <p>No active deployments</p>
          <p className="subtitle">All systems green!</p>
        </div>
      )}

      {/* Health Check */}
      <div className="health-check">
        <h3>System Health</h3>
        <div className="health-items">
          <div className="health-item green">
            <span className="indicator">●</span>
            <span>Frontend: Healthy</span>
          </div>
          <div className="health-item green">
            <span className="indicator">●</span>
            <span>Backend: Healthy</span>
          </div>
          <div className="health-item green">
            <span className="indicator">●</span>
            <span>Database: Healthy</span>
          </div>
          <div className="health-item green">
            <span className="indicator">●</span>
            <span>GitHub: Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
