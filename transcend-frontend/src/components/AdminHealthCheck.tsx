/**
 * Admin Health Check & Self-Diagnosis
 * Automatically continuously scan for broken links, inefficiencies, bad items
 * Shows issues and reports them for fixing
 */

import React, { useState, useEffect } from 'react';
import './AdminHealthCheck.css';

export interface DiagnosticIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  affectedItems: string[];
  lastDetected: Date;
  resolution?: string;
  reportedAt?: Date;
}

interface HealthCheckReport {
  timestamp: Date;
  status: 'healthy' | 'warning' | 'critical';
  issues: DiagnosticIssue[];
  metrics: {
    brokenLinks: number;
    slowEndpoints: number;
    inefficiencies: number;
    errorRate: number;
    uptime: number;
  };
}

interface AdminHealthCheckProps {
  autoRun?: boolean;
  checkInterval?: number; // milliseconds
  onIssuesFound?: (issues: DiagnosticIssue[]) => void;
}

export const AdminHealthCheck: React.FC<AdminHealthCheckProps> = ({
  autoRun = true,
  checkInterval = 300000, // 5 minutes
  onIssuesFound,
}) => {
  const [report, setReport] = useState<HealthCheckReport | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<DiagnosticIssue | null>(null);
  const [reportedIssues, setReportedIssues] = useState<string[]>([]);

  // Auto-run diagnostics
  useEffect(() => {
    if (!autoRun) return;

    const runDiagnostics = async () => {
      await performHealthCheck();
    };

    // Run immediately
    runDiagnostics();

    // Set up interval
    const interval = setInterval(runDiagnostics, checkInterval);

    return () => clearInterval(interval);
  }, [autoRun, checkInterval]);

  const performHealthCheck = async () => {
    setIsRunning(true);
    try {
      const response = await fetch('/api/admin/health-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setReport(data.report);

        // Notify if issues found
        const newIssues = data.report.issues.filter((i: DiagnosticIssue) => !reportedIssues.includes(i.id));
        if (newIssues.length > 0 && onIssuesFound) {
          onIssuesFound(newIssues);
        }
      }
    } catch (error) {
      console.error('Health check failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const reportIssue = async (issue: DiagnosticIssue) => {
    try {
      const response = await fetch('/api/admin/health-check/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueId: issue.id,
          title: issue.title,
          description: issue.description,
          severity: issue.severity,
          category: issue.category,
          affectedItems: issue.affectedItems,
        }),
      });

      if (response.ok) {
        setReportedIssues([...reportedIssues, issue.id]);
        alert('Issue reported for fixing!');
      }
    } catch (error) {
      console.error('Failed to report issue:', error);
      alert('Failed to report issue');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'critical':
        return '🔴';
      default:
        return '❓';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '#e74c3c';
      case 'warning':
        return '#f39c12';
      case 'info':
        return '#3498db';
      default:
        return '#95a5a6';
    }
  };

  const getSeverityLabel = (severity: string) => {
    return severity.charAt(0).toUpperCase() + severity.slice(1);
  };

  if (!report) {
    return (
      <div className="admin-health-check">
        <div className="health-check-loading">
          <div className="spinner"></div>
          <p>Running diagnostics...</p>
        </div>
      </div>
    );
  }

  const criticalCount = report.issues.filter((i) => i.severity === 'critical').length;
  const warningCount = report.issues.filter((i) => i.severity === 'warning').length;
  const infoCount = report.issues.filter((i) => i.severity === 'info').length;

  return (
    <div className="admin-health-check">
      <div className={`health-check-widget status-${report.status}`}>
        <div className="widget-header">
          <span className="status-icon">{getStatusIcon(report.status)}</span>
          <div className="widget-title">
            <h4>System Health</h4>
            <p className="widget-status">{report.status.toUpperCase()}</p>
          </div>
          <button
            className="widget-toggle"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? '▼' : '▶'}
          </button>
        </div>

        {showDetails && (
          <div className="health-check-details">
            {/* Metrics Summary */}
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-value">{report.metrics.errorRate}%</div>
                <div className="metric-label">Error Rate</div>
              </div>
              <div className="metric-card">
                <div className="metric-value">{report.metrics.uptime}%</div>
                <div className="metric-label">Uptime</div>
              </div>
              <div className="metric-card">
                <div className="metric-value">{report.metrics.brokenLinks}</div>
                <div className="metric-label">Broken Links</div>
              </div>
              <div className="metric-card">
                <div className="metric-value">{report.metrics.slowEndpoints}</div>
                <div className="metric-label">Slow Endpoints</div>
              </div>
              <div className="metric-card">
                <div className="metric-value">{report.metrics.inefficiencies}</div>
                <div className="metric-label">Inefficiencies</div>
              </div>
              <div className="metric-card">
                <div className="metric-value">{report.issues.length}</div>
                <div className="metric-label">Issues Found</div>
              </div>
            </div>

            {/* Issues Summary */}
            {report.issues.length > 0 && (
              <div className="issues-summary">
                <h5>Found Issues</h5>
                <div className="severity-breakdown">
                  {criticalCount > 0 && (
                    <div className="severity-item critical">
                      <strong>{criticalCount}</strong> Critical
                    </div>
                  )}
                  {warningCount > 0 && (
                    <div className="severity-item warning">
                      <strong>{warningCount}</strong> Warnings
                    </div>
                  )}
                  {infoCount > 0 && (
                    <div className="severity-item info">
                      <strong>{infoCount}</strong> Info
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Issues List */}
            {report.issues.length > 0 && (
              <div className="issues-list">
                {report.issues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`issue-item severity-${issue.severity} ${
                      reportedIssues.includes(issue.id) ? 'reported' : ''
                    }`}
                    onClick={() => setSelectedIssue(issue)}
                  >
                    <div className="issue-header">
                      <span
                        className="issue-severity-dot"
                        style={{ backgroundColor: getSeverityColor(issue.severity) }}
                      />
                      <span className="issue-title">{issue.title}</span>
                      {reportedIssues.includes(issue.id) && (
                        <span className="issue-reported-badge">📤 Reported</span>
                      )}
                    </div>
                    <div className="issue-category">{issue.category}</div>
                    <div className="issue-description">{issue.description}</div>
                  </div>
                ))}
              </div>
            )}

            {report.issues.length === 0 && (
              <div className="no-issues">
                <p>✅ All systems healthy - no issues detected</p>
              </div>
            )}

            {/* Refresh Button */}
            <div className="check-actions">
              <button
                className="btn-refresh"
                onClick={() => performHealthCheck()}
                disabled={isRunning}
              >
                {isRunning ? '🔄 Scanning...' : '🔄 Run Now'}
              </button>
              <span className="last-check">
                Last check: {report.timestamp ? new Date(report.timestamp).toLocaleTimeString() : 'Never'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Issue Detail Modal */}
      {selectedIssue && (
        <div className="issue-detail-modal" onClick={() => setSelectedIssue(null)}>
          <div className="issue-detail-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedIssue(null)}>
              ✕
            </button>

            <div className="detail-header">
              <div className="header-title">
                <span
                  className="severity-dot"
                  style={{ backgroundColor: getSeverityColor(selectedIssue.severity) }}
                />
                <h3>{selectedIssue.title}</h3>
              </div>
              <span className="severity-badge" style={{ backgroundColor: getSeverityColor(selectedIssue.severity) }}>
                {getSeverityLabel(selectedIssue.severity)}
              </span>
            </div>

            <div className="detail-meta">
              <div className="meta-row">
                <strong>Category:</strong>
                <span>{selectedIssue.category}</span>
              </div>
              <div className="meta-row">
                <strong>Description:</strong>
                <span>{selectedIssue.description}</span>
              </div>
              {selectedIssue.affectedItems.length > 0 && (
                <div className="meta-row">
                  <strong>Affected Items:</strong>
                  <div className="affected-items">
                    {selectedIssue.affectedItems.map((item, idx) => (
                      <code key={idx} className="affected-item">
                        {item}
                      </code>
                    ))}
                  </div>
                </div>
              )}
              <div className="meta-row">
                <strong>Detected:</strong>
                <span>{new Date(selectedIssue.lastDetected).toLocaleString()}</span>
              </div>
              {selectedIssue.resolution && (
                <div className="meta-row resolution">
                  <strong>Suggested Fix:</strong>
                  <p>{selectedIssue.resolution}</p>
                </div>
              )}
            </div>

            <div className="detail-actions">
              {!reportedIssues.includes(selectedIssue.id) ? (
                <button
                  className="btn-report"
                  onClick={() => {
                    reportIssue(selectedIssue);
                    setSelectedIssue(null);
                  }}
                >
                  📤 Report for Fixing
                </button>
              ) : (
                <button className="btn-reported" disabled>
                  ✅ Already Reported
                </button>
              )}
              <button className="btn-close" onClick={() => setSelectedIssue(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminHealthCheck;
