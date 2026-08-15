import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './AnalyticsDashboard.css';

interface LatencyPercentiles {
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  avg: number;
}

interface DashboardMetrics {
  currentCallsPerMinute: number;
  current24hCalls: number;
  currentErrorRate: number;
  currentUptime: number;
  latency: LatencyPercentiles;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  activeConnections: number;
  slaStatus: 'compliant' | 'at_risk' | 'violated';
  slaComplianceScore: number;
}

interface AlertData {
  id: string;
  type: 'error_rate' | 'latency' | 'cpu' | 'memory' | 'uptime' | 'sla_violation';
  severity: 'warning' | 'critical';
  threshold: number;
  currentValue: number;
  message: string;
  triggeredAt: Date;
}

interface ChartData {
  timestamp: string;
  value: number;
}

interface HistoricalData {
  apiMetrics: ChartData[];
  resourceMetrics: ChartData[];
  trends: {
    cpuTrend: string;
    memoryTrend: string;
    errorRateTrend: string;
    uptimeTrend: string;
  };
}

interface AccessDenialProps {
  reason: string;
}

const AccessDenial: React.FC<AccessDenialProps> = ({ reason }) => (
  <div className="access-denial">
    <div className="access-denial-icon">🔐</div>
    <h2>Admin Access Required</h2>
    <p>{reason}</p>
    <p>Please contact your administrator if you believe this is an error.</p>
  </div>
);

export const AnalyticsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'trending' | 'sla' | 'resources' | 'reports'>('overview');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 seconds
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'pdf'>('json');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [reportType, setReportType] = useState<'summary' | 'detailed' | 'sla_compliance' | 'resource_utilization'>('summary');
  const [generatingReport, setGeneratingReport] = useState(false);

  // Load dashboard data
  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get('/api/analytics/dashboard', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` },
      });

      setMetrics(response.data.metrics);
      setAlerts(response.data.alerts);
      setHistoricalData(response.data.trendData?.[0]);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setAccessDenied(true);
        setError('Insufficient permissions: Admin access required');
      } else {
        setError(err.message || 'Failed to load analytics dashboard');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and refresh interval
  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, refreshInterval);
    return () => clearInterval(interval);
  }, [loadDashboard, refreshInterval]);

  const handleGenerateReport = async () => {
    try {
      setGeneratingReport(true);
      const response = await axios.post('/api/analytics/reports', {
        reportType,
        startDate: new Date(dateRange.startDate),
        endDate: new Date(dateRange.endDate),
        format: exportFormat,
      }, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` },
      });

      // Download report
      const blob = new Blob([JSON.stringify(response.data)], {
        type: exportFormat === 'json' ? 'application/json' : 'text/plain',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-report-${reportType}-${Date.now()}.${exportFormat}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Failed to generate report');
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleExportCurrent = async () => {
    try {
      const response = await axios.get('/api/analytics/export', {
        params: { format: exportFormat },
        headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` },
      });

      const blob = new Blob([response.data], {
        type: exportFormat === 'json' ? 'application/json' : 'text/plain',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dashboard-snapshot-${Date.now()}.${exportFormat}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Failed to export data');
    }
  };

  const getSlaStatusClass = (status: string): string => {
    return `sla-status sla-${status}`;
  };

  const getAlertSeverityClass = (severity: string): string => {
    return `alert alert-${severity}`;
  };

  if (accessDenied) {
    return <AccessDenial reason="This dashboard is restricted to administrators only." />;
  }

  if (loading && !metrics) {
    return (
      <div className="analytics-dashboard loading">
        <div className="spinner">
          <div className="spin"></div>
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      {/* Header */}
      <div className="analytics-header">
        <h1>Usage Analytics Dashboard</h1>
        <div className="header-controls">
          <button
            className={`refresh-btn ${loading ? 'loading' : ''}`}
            onClick={loadDashboard}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="refresh-interval-select"
          >
            <option value={5000}>Auto-refresh: 5s</option>
            <option value={10000}>Auto-refresh: 10s</option>
            <option value={30000}>Auto-refresh: 30s</option>
            <option value={60000}>Auto-refresh: 1m</option>
            <option value={0}>No auto-refresh</option>
          </select>
          <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as any)} className="export-format">
            <option value="json">Export as JSON</option>
            <option value="csv">Export as CSV</option>
            <option value="pdf">Export as PDF</option>
          </select>
          <button onClick={handleExportCurrent} className="export-btn">
            Export Snapshot
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="close-btn">×</button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="analytics-tabs">
        {(['overview', 'trending', 'sla', 'resources', 'reports'] as const).map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="analytics-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && metrics && (
          <div className="tab-content overview-tab">
            {/* Key Metrics Grid */}
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">API Calls/Min</div>
                <div className="metric-value">{metrics.currentCallsPerMinute.toLocaleString()}</div>
                <div className="metric-detail">24h Total: {metrics.current24hCalls.toLocaleString()}</div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Error Rate</div>
                <div className={`metric-value ${metrics.currentErrorRate > 1 ? 'alert' : ''}`}>
                  {metrics.currentErrorRate.toFixed(2)}%
                </div>
                <div className="metric-detail">Target: &lt; 0.1%</div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Uptime</div>
                <div className={`metric-value ${metrics.currentUptime < 99.9 ? 'alert' : ''}`}>
                  {metrics.currentUptime.toFixed(2)}%
                </div>
                <div className="metric-detail">Target: 99.9%</div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Latency P95</div>
                <div className={`metric-value ${metrics.latency.p95 > 200 ? 'alert' : ''}`}>
                  {metrics.latency.p95.toFixed(0)}ms
                </div>
                <div className="metric-detail">P99: {metrics.latency.p99.toFixed(0)}ms</div>
              </div>

              <div className="metric-card">
                <div className="metric-label">CPU Usage</div>
                <div className={`metric-value ${metrics.cpuUsage > 80 ? 'alert' : ''}`}>
                  {metrics.cpuUsage.toFixed(1)}%
                </div>
                <div className="metric-bar">
                  <div className="metric-fill" style={{ width: `${metrics.cpuUsage}%` }}></div>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Memory Usage</div>
                <div className={`metric-value ${metrics.memoryUsage > 85 ? 'alert' : ''}`}>
                  {metrics.memoryUsage.toFixed(1)}%
                </div>
                <div className="metric-bar">
                  <div className="metric-fill" style={{ width: `${metrics.memoryUsage}%` }}></div>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Disk Usage</div>
                <div className="metric-value">{metrics.diskUsage.toFixed(1)}%</div>
                <div className="metric-bar">
                  <div className="metric-fill" style={{ width: `${metrics.diskUsage}%` }}></div>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Active Connections</div>
                <div className="metric-value">{metrics.activeConnections.toLocaleString()}</div>
                <div className="metric-detail">Real-time connections</div>
              </div>
            </div>

            {/* Alerts */}
            {alerts.length > 0 && (
              <div className="alerts-section">
                <h3>Active Alerts ({alerts.length})</h3>
                <div className="alerts-list">
                  {alerts.map((alert) => (
                    <div key={alert.id} className={getAlertSeverityClass(alert.severity)}>
                      <div className="alert-header">
                        <span className="alert-type">{alert.type.toUpperCase()}</span>
                        <span className="alert-severity">{alert.severity.toUpperCase()}</span>
                      </div>
                      <div className="alert-message">{alert.message}</div>
                      <div className="alert-detail">
                        Threshold: {alert.threshold} | Current: {alert.currentValue.toFixed(2)}
                      </div>
                      <div className="alert-time">
                        {new Date(alert.triggeredAt).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Trending Tab */}
        {activeTab === 'trending' && historicalData && (
          <div className="tab-content trending-tab">
            <h3>24-Hour Trends</h3>

            <div className="trends-grid">
              <div className="trend-card">
                <h4>Error Rate Trend</h4>
                <div className={`trend-indicator ${historicalData.trends.errorRateTrend}`}>
                  {historicalData.trends.errorRateTrend === 'increasing' && '📈 Increasing'}
                  {historicalData.trends.errorRateTrend === 'decreasing' && '📉 Decreasing'}
                  {historicalData.trends.errorRateTrend === 'stable' && '➡️ Stable'}
                </div>
              </div>

              <div className="trend-card">
                <h4>Uptime Trend</h4>
                <div className={`trend-indicator ${historicalData.trends.uptimeTrend}`}>
                  {historicalData.trends.uptimeTrend === 'improving' && '📈 Improving'}
                  {historicalData.trends.uptimeTrend === 'degrading' && '📉 Degrading'}
                  {historicalData.trends.uptimeTrend === 'stable' && '➡️ Stable'}
                </div>
              </div>

              <div className="trend-card">
                <h4>CPU Usage Trend</h4>
                <div className={`trend-indicator ${historicalData.trends.cpuTrend}`}>
                  {historicalData.trends.cpuTrend === 'increasing' && '📈 Increasing'}
                  {historicalData.trends.cpuTrend === 'decreasing' && '📉 Decreasing'}
                  {historicalData.trends.cpuTrend === 'stable' && '➡️ Stable'}
                </div>
              </div>

              <div className="trend-card">
                <h4>Memory Usage Trend</h4>
                <div className={`trend-indicator ${historicalData.trends.memoryTrend}`}>
                  {historicalData.trends.memoryTrend === 'increasing' && '📈 Increasing'}
                  {historicalData.trends.memoryTrend === 'decreasing' && '📉 Decreasing'}
                  {historicalData.trends.memoryTrend === 'stable' && '➡️ Stable'}
                </div>
              </div>
            </div>

            <div className="chart-placeholder">
              <p>📊 Historical charts would render here with a charting library like Recharts or Chart.js</p>
              <small>Displaying 24-hour API calls, latency percentiles, and resource utilization trends</small>
            </div>
          </div>
        )}

        {/* SLA Comparison Tab */}
        {activeTab === 'sla' && metrics && (
          <div className="tab-content sla-tab">
            <h3>SLA Compliance</h3>

            <div className={getSlaStatusClass(metrics.slaStatus)}>
              <div className="sla-score">
                <div className="score-circle">{metrics.slaComplianceScore}%</div>
                <div className="score-label">Compliance Score</div>
                <div className={`status-badge ${metrics.slaStatus}`}>
                  {metrics.slaStatus.toUpperCase()}
                </div>
              </div>
            </div>

            <div className="sla-metrics">
              <div className="sla-metric">
                <div className="sla-metric-header">
                  <span>Uptime SLA</span>
                  <span className={`sla-badge ${metrics.currentUptime >= 99.9 ? 'met' : 'unmet'}`}>
                    {metrics.currentUptime >= 99.9 ? '✓ MET' : '✗ UNMET'}
                  </span>
                </div>
                <div className="sla-metric-details">
                  <div>Target: 99.9%</div>
                  <div>Actual: {metrics.currentUptime.toFixed(2)}%</div>
                </div>
                <div className="sla-bar">
                  <div className="sla-fill" style={{ width: `${Math.min(100, (metrics.currentUptime / 99.9) * 100)}%` }}></div>
                </div>
              </div>

              <div className="sla-metric">
                <div className="sla-metric-header">
                  <span>Response Time SLA</span>
                  <span className={`sla-badge ${metrics.latency.p95 <= 200 ? 'met' : 'unmet'}`}>
                    {metrics.latency.p95 <= 200 ? '✓ MET' : '✗ UNMET'}
                  </span>
                </div>
                <div className="sla-metric-details">
                  <div>Target: ≤ 200ms (P95)</div>
                  <div>Actual: {metrics.latency.p95.toFixed(0)}ms</div>
                </div>
                <div className="sla-bar">
                  <div className="sla-fill" style={{ width: `${Math.min(100, (200 / metrics.latency.p95) * 100)}%` }}></div>
                </div>
              </div>

              <div className="sla-metric">
                <div className="sla-metric-header">
                  <span>Error Rate SLA</span>
                  <span className={`sla-badge ${metrics.currentErrorRate <= 0.1 ? 'met' : 'unmet'}`}>
                    {metrics.currentErrorRate <= 0.1 ? '✓ MET' : '✗ UNMET'}
                  </span>
                </div>
                <div className="sla-metric-details">
                  <div>Target: ≤ 0.1%</div>
                  <div>Actual: {metrics.currentErrorRate.toFixed(3)}%</div>
                </div>
                <div className="sla-bar">
                  <div className="sla-fill" style={{ width: `${Math.min(100, (0.1 / metrics.currentErrorRate) * 100)}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Resource Utilization Tab */}
        {activeTab === 'resources' && metrics && (
          <div className="tab-content resources-tab">
            <h3>Resource Utilization</h3>

            <div className="resource-details">
              <div className="resource-section">
                <h4>Compute Resources</h4>
                <div className="resource-item">
                  <label>CPU Usage</label>
                  <div className="resource-bar">
                    <div className="resource-fill cpu" style={{ width: `${metrics.cpuUsage}%` }}></div>
                  </div>
                  <div className="resource-value">{metrics.cpuUsage.toFixed(1)}%</div>
                </div>

                <div className="resource-item">
                  <label>Memory Usage</label>
                  <div className="resource-bar">
                    <div className="resource-fill memory" style={{ width: `${metrics.memoryUsage}%` }}></div>
                  </div>
                  <div className="resource-value">{metrics.memoryUsage.toFixed(1)}%</div>
                </div>

                <div className="resource-item">
                  <label>Disk Usage</label>
                  <div className="resource-bar">
                    <div className="resource-fill disk" style={{ width: `${metrics.diskUsage}%` }}></div>
                  </div>
                  <div className="resource-value">{metrics.diskUsage.toFixed(1)}%</div>
                </div>
              </div>

              <div className="resource-section">
                <h4>Network & Connections</h4>
                <div className="resource-item">
                  <label>Active Connections</label>
                  <div className="resource-stat">{metrics.activeConnections.toLocaleString()}</div>
                </div>

                <div className="resource-item">
                  <label>Latency Statistics</label>
                  <div className="latency-stats">
                    <div className="latency-stat">
                      <span>P50:</span>
                      <strong>{metrics.latency.p50.toFixed(1)}ms</strong>
                    </div>
                    <div className="latency-stat">
                      <span>P95:</span>
                      <strong>{metrics.latency.p95.toFixed(1)}ms</strong>
                    </div>
                    <div className="latency-stat">
                      <span>P99:</span>
                      <strong>{metrics.latency.p99.toFixed(1)}ms</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="tab-content reports-tab">
            <h3>Generate & Export Reports</h3>

            <div className="report-generator">
              <div className="report-section">
                <label>Report Type</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value as any)}
                  className="report-select"
                >
                  <option value="summary">Summary Report</option>
                  <option value="detailed">Detailed Report</option>
                  <option value="sla_compliance">SLA Compliance Report</option>
                  <option value="resource_utilization">Resource Utilization Report</option>
                </select>
              </div>

              <div className="report-section">
                <label>Date Range</label>
                <div className="date-range">
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                    className="date-input"
                  />
                  <span>to</span>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                    className="date-input"
                  />
                </div>
              </div>

              <div className="report-section">
                <label>Export Format</label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as any)}
                  className="report-select"
                >
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                  <option value="pdf">PDF</option>
                </select>
              </div>

              <button
                onClick={handleGenerateReport}
                disabled={generatingReport}
                className="generate-report-btn"
              >
                {generatingReport ? 'Generating...' : 'Generate & Download Report'}
              </button>
            </div>

            <div className="report-info">
              <h4>Report Information</h4>
              <ul>
                <li><strong>Summary Report:</strong> High-level overview of key metrics and trends</li>
                <li><strong>Detailed Report:</strong> Complete metrics breakdown with recommendations</li>
                <li><strong>SLA Compliance:</strong> Focus on SLA targets vs actual performance</li>
                <li><strong>Resource Utilization:</strong> Infrastructure and system resource analysis</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="analytics-footer">
        <span className="last-updated">
          Last updated: {new Date().toLocaleTimeString()}
        </span>
        <span className="data-retention">
          ℹ️ Analytics data retained for 12 months per data protection policy
        </span>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
