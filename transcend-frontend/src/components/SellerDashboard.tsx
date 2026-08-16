import React, { useState, useEffect } from 'react';
import './SellerDashboard.css';

// ============================================
// TYPES
// ============================================

interface ProviderMetrics {
  providerId: string;
  providerName: string;
  serviceType: string;
  ratingScore: number;
  ratingCount: number;
  defectRate: number;
  onTimeDeliveryRate: number;
  cancellationRate: number;
  responseRatePercent: number;
  averageResponseTime: number;
  totalTransactions: number;
  totalReviewsSubmitted: number;
  accountAgeDays: number;
  subscriptionStatus: string;
  lastUpdated: string;
}

interface BenchmarkComparison {
  metric: string;
  yourValue: number;
  categoryAverage: number;
  percentile: number;
  trend: 'improving' | 'stable' | 'declining';
  trendDirection: number;
}

interface PerformanceAlert {
  id: string;
  alertType: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  metric: string;
  currentValue: number;
  threshold: number;
  recommendedAction: string;
  createdAt: string;
}

interface HistoricalTrend {
  date: string;
  ratingScore: number;
  defectRate: number;
  onTimeDeliveryRate: number;
  cancellationRate: number;
  responseRatePercent: number;
  transactionCount: number;
}

interface ImprovementSuggestion {
  id: string;
  category: string;
  suggestion: string;
  priority: 'low' | 'medium' | 'high';
  estimatedImpact: number;
  implementationDifficulty: string;
  resourcesNeeded: string[];
  successMetrics: string[];
  completed: boolean;
}

interface SellerDashboardData {
  metrics: ProviderMetrics;
  benchmarks: BenchmarkComparison[];
  activeAlerts: PerformanceAlert[];
  historicalTrends: HistoricalTrend[];
  improvementSuggestions: ImprovementSuggestion[];
  performanceScore: number;
  monthlyTargets: {
    targetRating: number;
    targetDefectRate: number;
    targetOnTimeRate: number;
    targetResponseRate: number;
  };
  comparisonStats: {
    topPerformers: ProviderMetrics[];
    similarProviders: ProviderMetrics[];
    categoryRanking: {
      rank: number;
      totalProviders: number;
      percentile: number;
    };
  };
}

interface SellerDashboardProps {
  providerId?: string;
  compact?: boolean;
  showAlerts?: boolean;
  showBenchmarks?: boolean;
  showTrends?: boolean;
  showSuggestions?: boolean;
}

// ============================================
// SELLER DASHBOARD COMPONENT
// ============================================

export const SellerDashboard: React.FC<SellerDashboardProps> = ({
  providerId = 'current',
  compact = false,
  showAlerts = true,
  showBenchmarks = true,
  showTrends = true,
  showSuggestions = true,
}) => {
  const [dashboardData, setDashboardData] = useState<SellerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'benchmarks' | 'trends' | 'suggestions'>('overview');
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, [providerId]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const endpoint = `/api/seller/dashboard/${providerId}`;
      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const data = await response.json();
      setDashboardData(data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/seller/alerts/${alertId}/acknowledge`, {
        method: 'POST',
      });

      if (response.ok) {
        setExpandedAlertId(null);
        fetchDashboardData();
      }
    } catch (err) {
      console.error('Error acknowledging alert:', err);
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 90) return '#10b981';
    if (score >= 80) return '#f59e0b';
    if (score >= 70) return '#f97316';
    return '#ef4444';
  };

  const getTrendIcon = (trend: string): string => {
    if (trend === 'improving') return '↑';
    if (trend === 'declining') return '↓';
    return '→';
  };

  if (loading) {
    return <div className="seller-dashboard loading">Loading dashboard...</div>;
  }

  if (error || !dashboardData) {
    return (
      <div className="seller-dashboard error">
        <p>Error: {error || 'No data available'}</p>
        <button onClick={fetchDashboardData}>Retry</button>
      </div>
    );
  }

  const { metrics, performanceScore, benchmarks, activeAlerts, historicalTrends, improvementSuggestions, comparisonStats, monthlyTargets } = dashboardData;

  return (
    <div className={`seller-dashboard ${compact ? 'compact' : ''}`}>
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1>{metrics.providerName}</h1>
          <p className="service-type">{metrics.serviceType}</p>
        </div>
        <div className="performance-score-container">
          <div
            className="performance-score-circle"
            style={{ borderColor: getScoreColor(performanceScore) }}
          >
            <span className="score-value">{performanceScore.toFixed(0)}</span>
            <span className="score-label">Score</span>
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon rating">★</div>
          <div className="metric-content">
            <p className="metric-label">Rating</p>
            <p className="metric-value">{metrics.ratingScore.toFixed(1)}</p>
            <p className="metric-detail">({metrics.ratingCount} reviews)</p>
          </div>
          <div className="metric-target">Target: {monthlyTargets.targetRating}</div>
        </div>

        <div className="metric-card">
          <div className="metric-icon quality">⚙️</div>
          <div className="metric-content">
            <p className="metric-label">Defect Rate</p>
            <p className="metric-value">{metrics.defectRate.toFixed(1)}%</p>
          </div>
          <div className="metric-target">Target: {monthlyTargets.targetDefectRate}%</div>
        </div>

        <div className="metric-card">
          <div className="metric-icon delivery">📦</div>
          <div className="metric-content">
            <p className="metric-label">On-Time Delivery</p>
            <p className="metric-value">{metrics.onTimeDeliveryRate.toFixed(1)}%</p>
          </div>
          <div className="metric-target">Target: {monthlyTargets.targetOnTimeRate}%</div>
        </div>

        <div className="metric-card">
          <div className="metric-icon cancellation">✕</div>
          <div className="metric-content">
            <p className="metric-label">Cancellation Rate</p>
            <p className="metric-value">{metrics.cancellationRate.toFixed(1)}%</p>
          </div>
          <div className="metric-target">Target: &lt;2%</div>
        </div>

        <div className="metric-card">
          <div className="metric-icon response">💬</div>
          <div className="metric-content">
            <p className="metric-label">Response Rate</p>
            <p className="metric-value">{metrics.responseRatePercent.toFixed(1)}%</p>
            <p className="metric-detail">({metrics.averageResponseTime.toFixed(0)} min avg)</p>
          </div>
          <div className="metric-target">Target: {monthlyTargets.targetResponseRate}%</div>
        </div>

        <div className="metric-card">
          <div className="metric-icon transactions">📊</div>
          <div className="metric-content">
            <p className="metric-label">Transactions</p>
            <p className="metric-value">{metrics.totalTransactions.toLocaleString()}</p>
          </div>
          <div className="metric-target">Account age: {metrics.accountAgeDays} days</div>
        </div>
      </div>

      {/* Alerts Section */}
      {showAlerts && activeAlerts && activeAlerts.length > 0 && (
        <div className="alerts-section">
          <h2>Performance Alerts ({activeAlerts.length})</h2>
          <div className="alerts-list">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`alert-item severity-${alert.severity}`}
                onClick={() => setExpandedAlertId(expandedAlertId === alert.id ? null : alert.id)}
              >
                <div className="alert-header">
                  <span className={`severity-badge ${alert.severity}`}>
                    {alert.severity.toUpperCase()}
                  </span>
                  <span className="alert-message">{alert.message}</span>
                </div>

                {expandedAlertId === alert.id && (
                  <div className="alert-details">
                    <p><strong>Metric:</strong> {alert.metric}</p>
                    <p><strong>Current Value:</strong> {alert.currentValue} (Threshold: {alert.threshold})</p>
                    <p><strong>Recommendation:</strong> {alert.recommendedAction}</p>
                    <button
                      className="acknowledge-btn"
                      onClick={() => handleAcknowledgeAlert(alert.id)}
                    >
                      Acknowledge
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tab-navigation">
        {showBenchmarks && (
          <button
            className={`tab-btn ${activeTab === 'benchmarks' ? 'active' : ''}`}
            onClick={() => setActiveTab('benchmarks')}
          >
            Benchmarks
          </button>
        )}
        {showTrends && (
          <button
            className={`tab-btn ${activeTab === 'trends' ? 'active' : ''}`}
            onClick={() => setActiveTab('trends')}
          >
            Trends
          </button>
        )}
        {showSuggestions && (
          <button
            className={`tab-btn ${activeTab === 'suggestions' ? 'active' : ''}`}
            onClick={() => setActiveTab('suggestions')}
          >
            Suggestions
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'benchmarks' && showBenchmarks && (
          <div className="benchmarks-section">
            <h2>Benchmarking Against Category</h2>
            <p className="category-ranking">
              Rank: <strong>#{comparisonStats.categoryRanking.rank}</strong> out of{' '}
              <strong>{comparisonStats.categoryRanking.totalProviders}</strong> providers (Top{' '}
              {comparisonStats.categoryRanking.percentile}%)
            </p>

            <div className="benchmarks-grid">
              {benchmarks.map((benchmark, idx) => (
                <div key={idx} className="benchmark-card">
                  <h3>{benchmark.metric}</h3>

                  <div className="benchmark-values">
                    <div className="your-value">
                      <span className="label">Your Value</span>
                      <span className="value">{benchmark.yourValue.toFixed(1)}</span>
                    </div>
                    <div className="category-average">
                      <span className="label">Category Avg</span>
                      <span className="value">{benchmark.categoryAverage.toFixed(1)}</span>
                    </div>
                  </div>

                  <div className="benchmark-bar">
                    <div
                      className="benchmark-fill"
                      style={{ width: `${Math.min(benchmark.percentile, 100)}%` }}
                    />
                  </div>

                  <div className="benchmark-footer">
                    <span className="percentile">Percentile: {benchmark.percentile.toFixed(0)}</span>
                    <span className={`trend ${benchmark.trend}`}>
                      {getTrendIcon(benchmark.trend)} {benchmark.trend}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Top Performers */}
            <div className="top-performers-section">
              <h3>Top Performers in Your Category</h3>
              <div className="performers-list">
                {comparisonStats.topPerformers.map((performer, idx) => (
                  <div key={idx} className="performer-item">
                    <div className="rank-badge">#{idx + 1}</div>
                    <div className="performer-info">
                      <p className="performer-name">{performer.providerName}</p>
                      <p className="performer-stats">
                        {performer.ratingScore.toFixed(1)}★ • {performer.onTimeDeliveryRate.toFixed(0)}% on-time •{' '}
                        {performer.totalTransactions} transactions
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trends' && showTrends && (
          <div className="trends-section">
            <h2>90-Day Performance Trends</h2>

            {historicalTrends.length > 0 ? (
              <div className="trends-chart">
                <div className="chart-placeholder">
                  <p>📊 Performance trend visualization</p>
                  <p className="chart-note">{historicalTrends.length} data points over 90 days</p>
                  <div className="mini-stats">
                    <div className="trend-stat">
                      <span className="label">Avg Rating</span>
                      <span className="value">
                        {(historicalTrends.reduce((sum, t) => sum + t.ratingScore, 0) /
                          historicalTrends.length).toFixed(1)}
                      </span>
                    </div>
                    <div className="trend-stat">
                      <span className="label">Avg Defect Rate</span>
                      <span className="value">
                        {(historicalTrends.reduce((sum, t) => sum + t.defectRate, 0) /
                          historicalTrends.length).toFixed(1)}%
                      </span>
                    </div>
                    <div className="trend-stat">
                      <span className="label">Avg On-Time</span>
                      <span className="value">
                        {(historicalTrends.reduce((sum, t) => sum + t.onTimeDeliveryRate, 0) /
                          historicalTrends.length).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="no-data">No trend data available yet</p>
            )}
          </div>
        )}

        {activeTab === 'suggestions' && showSuggestions && (
          <div className="suggestions-section">
            <h2>Improvement Suggestions</h2>

            {improvementSuggestions.length > 0 ? (
              <div className="suggestions-list">
                {improvementSuggestions.map((suggestion, idx) => (
                  <div key={idx} className={`suggestion-card priority-${suggestion.priority}`}>
                    <div className="suggestion-header">
                      <h3>{suggestion.suggestion}</h3>
                      <span className={`priority-badge ${suggestion.priority}`}>
                        {suggestion.priority.toUpperCase()}
                      </span>
                    </div>

                    <div className="suggestion-meta">
                      <div className="meta-item">
                        <span className="label">Category</span>
                        <span className="value">{suggestion.category.replace('_', ' ')}</span>
                      </div>
                      <div className="meta-item">
                        <span className="label">Est. Impact</span>
                        <span className="value">+{suggestion.estimatedImpact}%</span>
                      </div>
                      <div className="meta-item">
                        <span className="label">Difficulty</span>
                        <span className="value">{suggestion.implementationDifficulty}</span>
                      </div>
                    </div>

                    {suggestion.resourcesNeeded.length > 0 && (
                      <div className="resources">
                        <p className="resources-label">Resources Needed:</p>
                        <ul>
                          {suggestion.resourcesNeeded.map((resource, ridx) => (
                            <li key={ridx}>{resource}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {suggestion.successMetrics.length > 0 && (
                      <div className="success-metrics">
                        <p className="metrics-label">Success Metrics:</p>
                        <ul>
                          {suggestion.successMetrics.map((metric, midx) => (
                            <li key={midx}>{metric}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {!suggestion.completed && (
                      <button className="start-btn">Start Implementation</button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-data">No suggestions available - you're performing well!</p>
            )}
          </div>
        )}
      </div>

      {/* Last Updated */}
      <div className="dashboard-footer">
        <p>Last updated: {new Date(metrics.lastUpdated).toLocaleString()}</p>
      </div>
    </div>
  );
};
