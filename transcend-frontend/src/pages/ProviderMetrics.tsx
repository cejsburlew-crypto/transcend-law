// Provider Performance Dashboard - Feature #3
// Real-time metrics tracking, benchmarking, and performance analytics for attorneys/providers

import React, { useState, useEffect, useCallback } from 'react';
import './ProviderMetrics.css';

// ============================================================================
// Type Definitions
// ============================================================================

interface PerformanceMetric {
  id: string;
  value: number;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
  lastUpdate: string;
  unit?: string;
  target?: number;
}

interface ProviderMetrics {
  providerId: string;
  providerName: string;
  providerType: 'attorney' | 'notary' | 'accountant';
  responseTime: PerformanceMetric; // hours
  completionRate: PerformanceMetric; // percentage
  customerSatisfaction: PerformanceMetric; // rating 0-5
  availability: PerformanceMetric; // percentage
  cancellationRate: PerformanceMetric; // percentage
  onTimeDelivery: PerformanceMetric; // percentage
  totalCases: number;
  activeCases: number;
  averageValue: number;
}

interface BenchmarkData {
  metric: string;
  yourValue: number;
  averageValue: number;
  topValue: number;
  percentile: number;
}

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  metric: string;
  timestamp: string;
  dismissed: boolean;
}

interface TrendData {
  date: string;
  responseTime: number;
  completionRate: number;
  satisfaction: number;
  availability: number;
  onTimeDelivery: number;
}

interface ProviderComparison {
  providerId: string;
  name: string;
  tier: 'premium' | 'standard' | 'emerging';
  responseTime: number;
  satisfaction: number;
  completionRate: number;
  availability: number;
}

// ============================================================================
// Mock Data Generator
// ============================================================================

const generateMockMetrics = (): ProviderMetrics => {
  return {
    providerId: 'ATT-001',
    providerName: 'Sarah J. Morrison, Esq.',
    providerType: 'attorney',
    responseTime: {
      id: 'rt-001',
      value: 2.5,
      trend: 'down',
      trendPercent: -8.3,
      lastUpdate: new Date().toISOString(),
      unit: 'hours',
      target: 4,
    },
    completionRate: {
      id: 'cr-001',
      value: 94.2,
      trend: 'up',
      trendPercent: 2.1,
      lastUpdate: new Date().toISOString(),
      unit: '%',
      target: 90,
    },
    customerSatisfaction: {
      id: 'cs-001',
      value: 4.82,
      trend: 'stable',
      trendPercent: 0.5,
      lastUpdate: new Date().toISOString(),
      unit: '/ 5.0',
      target: 4.5,
    },
    availability: {
      id: 'av-001',
      value: 96.8,
      trend: 'stable',
      trendPercent: 0.2,
      lastUpdate: new Date().toISOString(),
      unit: '%',
      target: 95,
    },
    cancellationRate: {
      id: 'cancl-001',
      value: 1.3,
      trend: 'up',
      trendPercent: 0.8,
      lastUpdate: new Date().toISOString(),
      unit: '%',
      target: 2,
    },
    onTimeDelivery: {
      id: 'otd-001',
      value: 98.7,
      trend: 'up',
      trendPercent: 1.2,
      lastUpdate: new Date().toISOString(),
      unit: '%',
      target: 95,
    },
    totalCases: 247,
    activeCases: 12,
    averageValue: 3250,
  };
};

const generateMockTrendData = (): TrendData[] => {
  const dates = [];
  for (let i = 30; i > 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toLocaleDateString());
  }

  return dates.map((date) => ({
    date,
    responseTime: 2.1 + Math.random() * 1.5,
    completionRate: 91 + Math.random() * 5,
    satisfaction: 4.6 + Math.random() * 0.4,
    availability: 95 + Math.random() * 4,
    onTimeDelivery: 97 + Math.random() * 3,
  }));
};

const generateMockBenchmarks = (): BenchmarkData[] => {
  return [
    {
      metric: 'Response Time',
      yourValue: 2.5,
      averageValue: 4.2,
      topValue: 1.1,
      percentile: 89,
    },
    {
      metric: 'Completion Rate',
      yourValue: 94.2,
      averageValue: 87.5,
      topValue: 99.2,
      percentile: 76,
    },
    {
      metric: 'Customer Satisfaction',
      yourValue: 4.82,
      averageValue: 4.35,
      topValue: 4.95,
      percentile: 92,
    },
    {
      metric: 'Availability',
      yourValue: 96.8,
      averageValue: 92.1,
      topValue: 99.5,
      percentile: 84,
    },
    {
      metric: 'On-Time Delivery',
      yourValue: 98.7,
      averageValue: 95.2,
      topValue: 99.9,
      percentile: 88,
    },
  ];
};

const generateMockAlerts = (): Alert[] => {
  return [
    {
      id: 'alert-001',
      type: 'info',
      title: 'Performance Milestone',
      message: 'Congratulations! You have reached 4.8+ customer satisfaction rating.',
      metric: 'customerSatisfaction',
      timestamp: new Date().toISOString(),
      dismissed: false,
    },
    {
      id: 'alert-002',
      type: 'info',
      title: 'On-Track for Target',
      message: 'Your on-time delivery rate is 3.7% above target this month.',
      metric: 'onTimeDelivery',
      timestamp: new Date().toISOString(),
      dismissed: false,
    },
  ];
};

const generateProviderComparisons = (): ProviderComparison[] => {
  return [
    {
      providerId: 'ATT-001',
      name: 'You (Sarah Morrison)',
      tier: 'premium',
      responseTime: 2.5,
      satisfaction: 4.82,
      completionRate: 94.2,
      availability: 96.8,
    },
    {
      providerId: 'ATT-002',
      name: 'James Chen, Esq.',
      tier: 'premium',
      responseTime: 3.1,
      satisfaction: 4.75,
      completionRate: 92.8,
      availability: 95.2,
    },
    {
      providerId: 'ATT-003',
      name: 'Patricia Rodriguez',
      tier: 'standard',
      responseTime: 4.5,
      satisfaction: 4.42,
      completionRate: 89.1,
      availability: 92.5,
    },
    {
      providerId: 'ATT-004',
      name: 'Michael Thompson',
      tier: 'standard',
      responseTime: 5.2,
      satisfaction: 4.28,
      completionRate: 86.5,
      availability: 88.3,
    },
    {
      providerId: 'ATT-005',
      name: 'Jennifer Williams',
      tier: 'emerging',
      responseTime: 6.8,
      satisfaction: 4.05,
      completionRate: 81.2,
      availability: 84.6,
    },
  ];
};

// ============================================================================
// Component: MetricCard
// ============================================================================

interface MetricCardProps {
  title: string;
  value: number;
  unit?: string;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
  target?: number;
  status: 'good' | 'warning' | 'critical';
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  trend,
  trendPercent,
  target,
  status,
}) => {
  const getTrendIcon = () => {
    if (trend === 'up') return '📈';
    if (trend === 'down') return '📉';
    return '➡️';
  };

  const getTrendColor = () => {
    if (title === 'Cancellation Rate') {
      return trend === 'up' ? 'warning' : 'success';
    }
    return trend === 'up' ? 'success' : trend === 'down' ? 'warning' : 'neutral';
  };

  return (
    <div className={`metric-card metric-${status}`}>
      <div className="metric-card-header">
        <h3>{title}</h3>
        <div className={`metric-status-indicator ${status}`} title={`Status: ${status}`}>
          {status === 'good' && '✓'}
          {status === 'warning' && '⚠'}
          {status === 'critical' && '✕'}
        </div>
      </div>

      <div className="metric-card-content">
        <div className="metric-value-display">
          <span className="metric-value">{value.toFixed(1)}</span>
          {unit && <span className="metric-unit">{unit}</span>}
        </div>

        <div className="metric-target">
          {target && <span>Target: {target}{unit}</span>}
        </div>
      </div>

      <div className="metric-card-footer">
        <div className={`metric-trend ${getTrendColor()}`}>
          <span className="trend-icon">{getTrendIcon()}</span>
          <span className="trend-value">
            {Math.abs(trendPercent).toFixed(1)}% {trend === 'up' ? 'up' : trend === 'down' ? 'down' : 'stable'}
          </span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Component: Alert List
// ============================================================================

interface AlertListProps {
  alerts: Alert[];
  onDismiss: (alertId: string) => void;
}

const AlertList: React.FC<AlertListProps> = ({ alerts, onDismiss }) => {
  const activeAlerts = alerts.filter((a) => !a.dismissed);

  if (activeAlerts.length === 0) {
    return null;
  }

  return (
    <div className="alerts-container">
      <div className="alerts-header">
        <h3>📢 Performance Alerts</h3>
        <span className="alert-count">{activeAlerts.length}</span>
      </div>
      <div className="alerts-list">
        {activeAlerts.map((alert) => (
          <div key={alert.id} className={`alert-item alert-${alert.type}`}>
            <div className="alert-content">
              <div className="alert-title">{alert.title}</div>
              <div className="alert-message">{alert.message}</div>
              <div className="alert-timestamp">
                {new Date(alert.timestamp).toLocaleTimeString()}
              </div>
            </div>
            <button className="alert-dismiss" onClick={() => onDismiss(alert.id)}>
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// Component: Simple Chart (ASCII-based fallback)
// ============================================================================

interface ChartProps {
  data: TrendData[];
  metric: keyof Omit<TrendData, 'date'>;
  title: string;
}

const TrendChart: React.FC<ChartProps> = ({ data, metric, title }) => {
  // Simple chart using HTML5 Canvas-like visualization
  const values = data.map((d) => d[metric] as number);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = maxValue - minValue || 1;

  return (
    <div className="trend-chart">
      <div className="chart-header">
        <h4>{title}</h4>
      </div>
      <div className="chart-content">
        <div className="chart-legend">
          <div className="legend-item">
            <span className="legend-label">Max:</span>
            <span className="legend-value">{maxValue.toFixed(1)}</span>
          </div>
          <div className="legend-item">
            <span className="legend-label">Avg:</span>
            <span className="legend-value">
              {(values.reduce((a, b) => a + b) / values.length).toFixed(1)}
            </span>
          </div>
          <div className="legend-item">
            <span className="legend-label">Min:</span>
            <span className="legend-value">{minValue.toFixed(1)}</span>
          </div>
        </div>

        <div className="chart-visualization">
          <div className="chart-bars">
            {data.map((point, idx) => {
              const normalized = (((point[metric] as number) - minValue) / range) * 100;
              return (
                <div key={idx} className="chart-bar-wrapper">
                  <div
                    className="chart-bar"
                    style={{
                      height: `${normalized}%`,
                      backgroundColor: normalized > 80 ? '#48bb78' : normalized > 50 ? '#ed8936' : '#f56565',
                    }}
                    title={`${(point[metric] as number).toFixed(1)}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="chart-x-axis">
            <span>{data[0]?.date}</span>
            <span>{data[Math.floor(data.length / 2)]?.date}</span>
            <span>{data[data.length - 1]?.date}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Component: Benchmark Comparison
// ============================================================================

interface BenchmarkProps {
  benchmarks: BenchmarkData[];
}

const BenchmarkComparison: React.FC<BenchmarkProps> = ({ benchmarks }) => {
  return (
    <div className="benchmark-section">
      <h3>📊 Performance vs Benchmarks</h3>
      <div className="benchmark-grid">
        {benchmarks.map((bench) => {
          const percentageOfTop = (bench.yourValue / bench.topValue) * 100;
          const percentageOfAvg = (bench.yourValue / bench.averageValue) * 100;

          return (
            <div key={bench.metric} className="benchmark-card">
              <div className="benchmark-header">
                <h4>{bench.metric}</h4>
                <span className="percentile-badge">{bench.percentile}th percentile</span>
              </div>

              <div className="benchmark-bars">
                <div className="benchmark-bar-item">
                  <label>Your Performance</label>
                  <div className="benchmark-bar">
                    <div
                      className="benchmark-fill your-value"
                      style={{ width: `${Math.min(percentageOfTop, 100)}%` }}
                    >
                      {bench.yourValue.toFixed(1)}
                    </div>
                  </div>
                </div>

                <div className="benchmark-bar-item">
                  <label>Average Provider</label>
                  <div className="benchmark-bar">
                    <div
                      className="benchmark-fill average-value"
                      style={{ width: `${Math.min((bench.averageValue / bench.topValue) * 100, 100)}%` }}
                    >
                      {bench.averageValue.toFixed(1)}
                    </div>
                  </div>
                </div>

                <div className="benchmark-bar-item">
                  <label>Top Performer</label>
                  <div className="benchmark-bar">
                    <div className="benchmark-fill top-value" style={{ width: '100%' }}>
                      {bench.topValue.toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="benchmark-difference">
                {percentageOfAvg >= 100 ? (
                  <span className="above-average">
                    ↑ {(percentageOfAvg - 100).toFixed(1)}% above average
                  </span>
                ) : (
                  <span className="below-average">
                    ↓ {(100 - percentageOfAvg).toFixed(1)}% below average
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================================
// Component: Provider Comparison Table
// ============================================================================

interface ProviderComparisonProps {
  providers: ProviderComparison[];
}

const ProviderComparisonTable: React.FC<ProviderComparisonProps> = ({ providers }) => {
  return (
    <div className="comparison-section">
      <h3>👥 Provider Rankings</h3>
      <div className="comparison-table-wrapper">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Provider Name</th>
              <th>Tier</th>
              <th>Response Time (hrs)</th>
              <th>Satisfaction</th>
              <th>Completion Rate</th>
              <th>Availability</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((provider, idx) => (
              <tr key={provider.providerId} className={provider.tier === 'premium' ? 'premium-row' : ''}>
                <td>
                  <span className="provider-badge">{idx === 0 ? '👑' : idx < 2 ? '⭐' : '📌'}</span>
                  {provider.name}
                </td>
                <td>
                  <span className={`tier-badge tier-${provider.tier}`}>{provider.tier}</span>
                </td>
                <td>{provider.responseTime.toFixed(1)}h</td>
                <td>
                  <span className="rating-badge">{provider.satisfaction.toFixed(2)}/5.0</span>
                </td>
                <td>
                  <span className="completion-badge">{provider.completionRate.toFixed(1)}%</span>
                </td>
                <td>
                  <span className="availability-badge">{provider.availability.toFixed(1)}%</span>
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
// Main Component: ProviderMetrics Dashboard
// ============================================================================

export const ProviderMetrics: React.FC = () => {
  const [metrics, setMetrics] = useState<ProviderMetrics>(generateMockMetrics());
  const [trendData, setTrendData] = useState<TrendData[]>(generateMockTrendData());
  const [benchmarks, setBenchmarks] = useState<BenchmarkData[]>(generateMockBenchmarks());
  const [alerts, setAlerts] = useState<Alert[]>(generateMockAlerts());
  const [providers, setProviders] = useState<ProviderComparison[]>(generateProviderComparisons());
  const [selectedMetric, setSelectedMetric] = useState<'responseTime' | 'completionRate' | 'satisfaction' | 'availability' | 'onTimeDelivery'>('responseTime');
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>(new Date().toLocaleTimeString());

  // ====== Real-time Updates ======
  const updateMetrics = useCallback(() => {
    setMetrics((prev) => ({
      ...prev,
      responseTime: {
        ...prev.responseTime,
        value: Math.max(1.5, Math.min(4, prev.responseTime.value + (Math.random() - 0.5) * 0.2)),
        trend: Math.random() > 0.5 ? 'up' : 'down',
        lastUpdate: new Date().toISOString(),
      },
    }));
    setLastUpdateTime(new Date().toLocaleTimeString());
  }, []);

  useEffect(() => {
    if (refreshInterval) {
      const interval = setInterval(updateMetrics, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, updateMetrics]);

  // ====== Metric Status Determination ======
  const getMetricStatus = (metric: PerformanceMetric): 'good' | 'warning' | 'critical' => {
    if (!metric.target) return 'good';

    const percentage = (metric.value / metric.target) * 100;

    if (percentage >= 100) return 'good';
    if (percentage >= 85) return 'warning';
    return 'critical';
  };

  // ====== Alert Dismissal ======
  const dismissAlert = (alertId: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, dismissed: true } : a)));
  };

  // ====== PDF Export Function ======
  const handleExportPDF = () => {
    const timestamp = new Date().toLocaleString();
    const providerName = metrics.providerName;

    const metricsText = `
PROVIDER PERFORMANCE METRICS REPORT
Generated: ${timestamp}
Provider: ${providerName}

CURRENT METRICS:
- Response Time: ${metrics.responseTime.value.toFixed(1)} ${metrics.responseTime.unit}
- Completion Rate: ${metrics.completionRate.value.toFixed(1)}${metrics.completionRate.unit}
- Customer Satisfaction: ${metrics.customerSatisfaction.value.toFixed(2)}${metrics.customerSatisfaction.unit}
- Availability: ${metrics.availability.value.toFixed(1)}${metrics.availability.unit}
- Cancellation Rate: ${metrics.cancellationRate.value.toFixed(1)}${metrics.cancellationRate.unit}
- On-Time Delivery: ${metrics.onTimeDelivery.value.toFixed(1)}${metrics.onTimeDelivery.unit}

CASELOAD:
- Total Cases: ${metrics.totalCases}
- Active Cases: ${metrics.activeCases}
- Average Case Value: $${metrics.averageValue.toLocaleString()}

PERFORMANCE TRENDS:
${trendData
  .slice(-5)
  .map(
    (d) => `
Date: ${d.date}
  Response Time: ${d.responseTime.toFixed(2)}h
  Completion Rate: ${d.completionRate.toFixed(1)}%
  Satisfaction: ${d.satisfaction.toFixed(2)}/5.0
  Availability: ${d.availability.toFixed(1)}%
  On-Time Delivery: ${d.onTimeDelivery.toFixed(1)}%
`
  )
  .join('')}

ALERTS:
${alerts
  .filter((a) => !a.dismissed)
  .map((a) => `- [${a.type.toUpperCase()}] ${a.title}: ${a.message}`)
  .join('\n')}
    `;

    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(metricsText));
    element.setAttribute(
      'download',
      `provider-metrics-${providerName.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().split('T')[0]}.txt`
    );
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="provider-metrics-container">
      {/* Header */}
      <header className="metrics-header">
        <div className="header-content">
          <h1>📈 Provider Performance Dashboard</h1>
          <p className="provider-name">{metrics.providerName}</p>
        </div>

        <div className="header-controls">
          <div className="update-controls">
            <label htmlFor="refresh-select">Auto-Refresh:</label>
            <select
              id="refresh-select"
              value={refreshInterval || '0'}
              onChange={(e) => setRefreshInterval(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="0">Off</option>
              <option value="5">Every 5s</option>
              <option value="10">Every 10s</option>
              <option value="30">Every 30s</option>
              <option value="60">Every 1m</option>
            </select>
          </div>

          <div className="update-time">
            <span className="time-label">Last Updated:</span>
            <span className="time-value">{lastUpdateTime}</span>
          </div>

          <button className="export-btn" onClick={handleExportPDF}>
            📥 Export Report
          </button>
        </div>
      </header>

      {/* Alerts Section */}
      <AlertList alerts={alerts} onDismiss={dismissAlert} />

      {/* Key Metrics Grid */}
      <section className="metrics-grid-section">
        <h2>Key Performance Indicators</h2>
        <div className="metrics-grid">
          <MetricCard
            title="Response Time"
            value={metrics.responseTime.value}
            unit={metrics.responseTime.unit}
            trend={metrics.responseTime.trend}
            trendPercent={metrics.responseTime.trendPercent}
            target={metrics.responseTime.target}
            status={getMetricStatus(metrics.responseTime)}
          />
          <MetricCard
            title="Completion Rate"
            value={metrics.completionRate.value}
            unit={metrics.completionRate.unit}
            trend={metrics.completionRate.trend}
            trendPercent={metrics.completionRate.trendPercent}
            target={metrics.completionRate.target}
            status={getMetricStatus(metrics.completionRate)}
          />
          <MetricCard
            title="Customer Satisfaction"
            value={metrics.customerSatisfaction.value}
            unit={metrics.customerSatisfaction.unit}
            trend={metrics.customerSatisfaction.trend}
            trendPercent={metrics.customerSatisfaction.trendPercent}
            target={metrics.customerSatisfaction.target}
            status={getMetricStatus(metrics.customerSatisfaction)}
          />
          <MetricCard
            title="Availability"
            value={metrics.availability.value}
            unit={metrics.availability.unit}
            trend={metrics.availability.trend}
            trendPercent={metrics.availability.trendPercent}
            target={metrics.availability.target}
            status={getMetricStatus(metrics.availability)}
          />
          <MetricCard
            title="Cancellation Rate"
            value={metrics.cancellationRate.value}
            unit={metrics.cancellationRate.unit}
            trend={metrics.cancellationRate.trend}
            trendPercent={metrics.cancellationRate.trendPercent}
            target={metrics.cancellationRate.target}
            status={getMetricStatus(metrics.cancellationRate)}
          />
          <MetricCard
            title="On-Time Delivery"
            value={metrics.onTimeDelivery.value}
            unit={metrics.onTimeDelivery.unit}
            trend={metrics.onTimeDelivery.trend}
            trendPercent={metrics.onTimeDelivery.trendPercent}
            target={metrics.onTimeDelivery.target}
            status={getMetricStatus(metrics.onTimeDelivery)}
          />
        </div>
      </section>

      {/* Caseload Summary */}
      <section className="caseload-section">
        <h2>📊 Caseload Summary</h2>
        <div className="caseload-cards">
          <div className="caseload-card">
            <div className="caseload-value">{metrics.totalCases}</div>
            <div className="caseload-label">Total Cases</div>
          </div>
          <div className="caseload-card">
            <div className="caseload-value">{metrics.activeCases}</div>
            <div className="caseload-label">Active Cases</div>
          </div>
          <div className="caseload-card">
            <div className="caseload-value">${(metrics.averageValue / 1000).toFixed(1)}k</div>
            <div className="caseload-label">Avg Case Value</div>
          </div>
          <div className="caseload-card">
            <div className="caseload-value">{((metrics.activeCases / metrics.totalCases) * 100).toFixed(1)}%</div>
            <div className="caseload-label">Active Workload</div>
          </div>
        </div>
      </section>

      {/* Trend Charts Section */}
      <section className="charts-section">
        <h2>📈 Historical Trends (Last 30 Days)</h2>
        <div className="chart-controls">
          <button
            className={`chart-btn ${selectedMetric === 'responseTime' ? 'active' : ''}`}
            onClick={() => setSelectedMetric('responseTime')}
          >
            Response Time
          </button>
          <button
            className={`chart-btn ${selectedMetric === 'completionRate' ? 'active' : ''}`}
            onClick={() => setSelectedMetric('completionRate')}
          >
            Completion Rate
          </button>
          <button
            className={`chart-btn ${selectedMetric === 'satisfaction' ? 'active' : ''}`}
            onClick={() => setSelectedMetric('satisfaction')}
          >
            Satisfaction
          </button>
          <button
            className={`chart-btn ${selectedMetric === 'availability' ? 'active' : ''}`}
            onClick={() => setSelectedMetric('availability')}
          >
            Availability
          </button>
          <button
            className={`chart-btn ${selectedMetric === 'onTimeDelivery' ? 'active' : ''}`}
            onClick={() => setSelectedMetric('onTimeDelivery')}
          >
            On-Time Delivery
          </button>
        </div>

        <div className="charts-grid">
          {selectedMetric === 'responseTime' && (
            <TrendChart data={trendData} metric="responseTime" title="Response Time Trend" />
          )}
          {selectedMetric === 'completionRate' && (
            <TrendChart data={trendData} metric="completionRate" title="Completion Rate Trend" />
          )}
          {selectedMetric === 'satisfaction' && (
            <TrendChart data={trendData} metric="satisfaction" title="Customer Satisfaction Trend" />
          )}
          {selectedMetric === 'availability' && (
            <TrendChart data={trendData} metric="availability" title="Availability Trend" />
          )}
          {selectedMetric === 'onTimeDelivery' && (
            <TrendChart data={trendData} metric="onTimeDelivery" title="On-Time Delivery Trend" />
          )}
        </div>
      </section>

      {/* Benchmarking Section */}
      <BenchmarkComparison benchmarks={benchmarks} />

      {/* Provider Comparison */}
      <ProviderComparisonTable providers={providers} />

      {/* Footer */}
      <footer className="metrics-footer">
        <div className="footer-content">
          <p>📌 Real-time metrics are updated automatically. Last sync: {lastUpdateTime}</p>
          <p>
            💡 Tip: Use the export function to generate PDF reports for stakeholder review and performance documentation.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default ProviderMetrics;
