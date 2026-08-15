import React, { useState, useEffect } from 'react';
import './ChurnAlert.css';

// ============================================
// TYPES
// ============================================

interface ChurnPredictionData {
  userId: string;
  email: string;
  churnProbability: number;
  riskSegment: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: string[];
  recommendedActions: string[];
  retentionScore: number;
  predictedValueAtRisk: number;
  lastPredictionUpdate: string;
}

interface WinBackOffer {
  campaignId: string;
  discountPercentage: number;
  discountExpiryDays: number;
  prioritySupportEnabled: boolean;
  offerExpiry: string;
}

interface ChurnAlertProps {
  userId?: string;
  onDismiss?: () => void;
  compact?: boolean;
  isAdmin?: boolean;
}

// ============================================
// CHURN ALERT COMPONENT
// ============================================

export const ChurnAlert: React.FC<ChurnAlertProps> = ({
  userId,
  onDismiss,
  compact = false,
  isAdmin = false,
}) => {
  const [churnData, setChurnData] = useState<ChurnPredictionData | null>(null);
  const [winBackOffer, setWinBackOffer] = useState<WinBackOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(!compact);
  const [offerAccepted, setOfferAccepted] = useState(false);

  useEffect(() => {
    fetchChurnData();
  }, [userId]);

  const fetchChurnData = async () => {
    try {
      setLoading(true);
      const endpoint = userId
        ? `/api/churn/prediction/${userId}`
        : '/api/churn/prediction/current';

      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        setChurnData(data);

        if (data.riskSegment !== 'low') {
          fetchWinBackOffer(data.userId);
        }
      }
    } catch (error) {
      console.error('Error fetching churn data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWinBackOffer = async (userId: string) => {
    try {
      const response = await fetch(`/api/churn/winback-offer/${userId}`);
      if (response.ok) {
        const offer = await response.json();
        setWinBackOffer(offer);
      }
    } catch (error) {
      console.error('Error fetching win-back offer:', error);
    }
  };

  const handleAcceptOffer = async () => {
    if (!winBackOffer || !churnData) return;

    try {
      const response = await fetch('/api/churn/accept-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: winBackOffer.campaignId,
          userId: churnData.userId,
        }),
      });

      if (response.ok) {
        setOfferAccepted(true);
        // Track conversion
        trackEvent('offer_accepted', churnData.userId);
      }
    } catch (error) {
      console.error('Error accepting offer:', error);
    }
  };

  const handleDismiss = () => {
    setExpanded(false);
    onDismiss?.();
  };

  const trackEvent = async (eventType: string, userId: string) => {
    try {
      await fetch('/api/churn/track-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType, userId }),
      });
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  };

  if (loading) {
    return <div className="churn-alert-skeleton" />;
  }

  if (!churnData || churnData.riskSegment === 'low') {
    return null;
  }

  const getRiskColor = (segment: string): string => {
    switch (segment) {
      case 'critical':
        return '#dc2626';
      case 'high':
        return '#ea580c';
      case 'medium':
        return '#f59e0b';
      default:
        return '#10b981';
    }
  };

  const getRiskMessage = (segment: string): string => {
    switch (segment) {
      case 'critical':
        return 'Critical - Immediate action recommended';
      case 'high':
        return 'High risk - Your engagement is declining';
      case 'medium':
        return 'Medium risk - We want to help you succeed';
      default:
        return 'Low risk - Everything looks great!';
    }
  };

  const riskColor = getRiskColor(churnData.riskSegment);

  return (
    <div className={`churn-alert ${churnData.riskSegment} ${compact ? 'compact' : ''}`}>
      <div className="churn-alert-header" onClick={() => setExpanded(!expanded)}>
        <div className="churn-alert-title-section">
          <div
            className="churn-alert-indicator"
            style={{ backgroundColor: riskColor }}
          />
          <div className="churn-alert-title">
            <h3>Account Health Alert</h3>
            <p className="churn-alert-message">{getRiskMessage(churnData.riskSegment)}</p>
          </div>
        </div>
        <div className="churn-alert-metrics">
          <div className="metric-item">
            <span className="metric-label">Risk Level</span>
            <span className="metric-value" style={{ color: riskColor }}>
              {churnData.riskSegment.toUpperCase()}
            </span>
          </div>
          <div className="metric-item">
            <span className="metric-label">Retention Score</span>
            <span className="metric-value">{churnData.retentionScore}%</span>
          </div>
          <button className="expand-button" aria-label="Toggle details">
            {expanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="churn-alert-body">
          {/* Risk Analysis Section */}
          <section className="alert-section">
            <h4>Why We're Concerned</h4>
            <ul className="risk-factors-list">
              {churnData.riskFactors.map((factor, index) => (
                <li key={index} className="risk-factor-item">
                  <span className="factor-icon">⚠️</span>
                  {factor}
                </li>
              ))}
            </ul>
          </section>

          {/* Predictions Section */}
          <section className="alert-section">
            <h4>What This Means</h4>
            <div className="prediction-details">
              <div className="detail-row">
                <span className="detail-label">Churn Probability:</span>
                <span className="detail-value">
                  {Math.round(churnData.churnProbability * 100)}%
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Potential Value at Risk:</span>
                <span className="detail-value highlight">
                  ${churnData.predictedValueAtRisk.toLocaleString()}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Last Analysis:</span>
                <span className="detail-value">
                  {new Date(churnData.lastPredictionUpdate).toLocaleDateString()}
                </span>
              </div>
            </div>
          </section>

          {/* Win-Back Offer Section */}
          {winBackOffer && !offerAccepted && (
            <section className="alert-section offer-section">
              <h4>Special Offer to Help You Succeed</h4>
              <div className="offer-details">
                <div className="offer-badge">
                  <span className="offer-badge-value">
                    {winBackOffer.discountPercentage}% OFF
                  </span>
                </div>
                <div className="offer-description">
                  {winBackOffer.discountPercentage > 0 && (
                    <p>Get {winBackOffer.discountPercentage}% off your next legal service</p>
                  )}
                  {winBackOffer.prioritySupportEnabled && (
                    <p>
                      <strong>+ Priority Support</strong> for 30 days
                    </p>
                  )}
                  <p className="offer-expiry">
                    Expires in {winBackOffer.discountExpiryDays} days
                  </p>
                </div>
              </div>
              <button className="btn-accept-offer" onClick={handleAcceptOffer}>
                Accept This Offer
              </button>
            </section>
          )}

          {offerAccepted && (
            <section className="alert-section success-section">
              <h4>✓ Offer Accepted</h4>
              <p>Your discount and priority support have been activated. Look for a confirmation email.</p>
            </section>
          )}

          {/* Recommended Actions */}
          <section className="alert-section">
            <h4>Recommended Actions</h4>
            <ul className="recommendations-list">
              {churnData.recommendedActions.map((action, index) => (
                <li key={index} className="recommendation-item">
                  <span className="action-icon">→</span>
                  {action}
                </li>
              ))}
            </ul>
          </section>

          {/* CTA Section */}
          <section className="alert-section cta-section">
            <button
              className="btn-get-support"
              onClick={() => window.location.href = '/support'}
            >
              Get Priority Support
            </button>
            <button
              className="btn-dismiss"
              onClick={handleDismiss}
            >
              Dismiss
            </button>
          </section>
        </div>
      )}
    </div>
  );
};

// ============================================
// CHURN ANALYTICS DASHBOARD COMPONENT
// ============================================

interface ChurnAnalyticsDashboardProps {
  onRefresh?: () => void;
}

export const ChurnAnalyticsDashboard: React.FC<ChurnAnalyticsDashboardProps> = ({ onRefresh }) => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [atRiskUsers, setAtRiskUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaignRunning, setCampaignRunning] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/churn/analytics');
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }

      const usersResponse = await fetch('/api/churn/at-risk-users');
      if (usersResponse.ok) {
        const users = await usersResponse.json();
        setAtRiskUsers(users);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const runAutomatedCampaigns = async () => {
    try {
      setCampaignRunning(true);
      const response = await fetch('/api/churn/run-campaigns', {
        method: 'POST',
      });
      if (response.ok) {
        const result = await response.json();
        console.log('Campaigns created:', result);
        fetchAnalytics();
      }
    } catch (error) {
      console.error('Error running campaigns:', error);
    } finally {
      setCampaignRunning(false);
    }
  };

  if (loading) {
    return <div className="analytics-skeleton" />;
  }

  if (!analytics) {
    return <div className="analytics-error">Error loading analytics</div>;
  }

  return (
    <div className="churn-analytics-dashboard">
      <div className="dashboard-header">
        <h2>Churn Prevention Dashboard</h2>
        <div className="header-actions">
          <button
            className="btn-refresh"
            onClick={() => {
              fetchAnalytics();
              onRefresh?.();
            }}
          >
            Refresh Data
          </button>
          <button
            className={`btn-run-campaigns ${campaignRunning ? 'loading' : ''}`}
            onClick={runAutomatedCampaigns}
            disabled={campaignRunning}
          >
            {campaignRunning ? 'Running...' : 'Run Win-Back Campaigns'}
          </button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-card-header">
            <h4>Users Analyzed</h4>
          </div>
          <div className="metric-card-value">
            {analytics.totalUsersAnalyzed.toLocaleString()}
          </div>
        </div>

        <div className="metric-card warning">
          <div className="metric-card-header">
            <h4>Users at Risk</h4>
          </div>
          <div className="metric-card-value">
            {analytics.usersAtRisk.toLocaleString()}
          </div>
          <div className="metric-card-percentage">
            {analytics.totalUsersAnalyzed > 0
              ? ((analytics.usersAtRisk / analytics.totalUsersAnalyzed) * 100).toFixed(1)
              : 0}
            %
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-card-header">
            <h4>Avg Churn Probability</h4>
          </div>
          <div className="metric-card-value">
            {(analytics.averageChurnProbability * 100).toFixed(1)}%
          </div>
        </div>

        <div className="metric-card danger">
          <div className="metric-card-header">
            <h4>Potential Revenue Loss</h4>
          </div>
          <div className="metric-card-value">
            ${analytics.predictedMonthlyChurn.potentialRevenueLoss.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Risk Distribution Chart */}
      <section className="analytics-section">
        <h3>User Risk Distribution</h3>
        <div className="risk-distribution">
          <div className="risk-segment low">
            <span className="segment-label">Low Risk</span>
            <span className="segment-count">{analytics.riskDistribution.low}</span>
            <div className="segment-bar">
              <div
                className="segment-fill"
                style={{
                  width: `${
                    (analytics.riskDistribution.low / analytics.totalUsersAnalyzed) * 100
                  }%`,
                }}
              />
            </div>
          </div>
          <div className="risk-segment medium">
            <span className="segment-label">Medium Risk</span>
            <span className="segment-count">{analytics.riskDistribution.medium}</span>
            <div className="segment-bar">
              <div
                className="segment-fill"
                style={{
                  width: `${
                    (analytics.riskDistribution.medium / analytics.totalUsersAnalyzed) * 100
                  }%`,
                }}
              />
            </div>
          </div>
          <div className="risk-segment high">
            <span className="segment-label">High Risk</span>
            <span className="segment-count">{analytics.riskDistribution.high}</span>
            <div className="segment-bar">
              <div
                className="segment-fill"
                style={{
                  width: `${
                    (analytics.riskDistribution.high / analytics.totalUsersAnalyzed) * 100
                  }%`,
                }}
              />
            </div>
          </div>
          <div className="risk-segment critical">
            <span className="segment-label">Critical Risk</span>
            <span className="segment-count">{analytics.riskDistribution.critical}</span>
            <div className="segment-bar">
              <div
                className="segment-fill"
                style={{
                  width: `${
                    (analytics.riskDistribution.critical / analytics.totalUsersAnalyzed) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Campaign Performance */}
      <section className="analytics-section">
        <h3>Win-Back Campaign Performance</h3>
        <div className="campaign-metrics">
          <div className="campaign-metric">
            <span className="metric-label">Total Campaigns</span>
            <span className="metric-value">{analytics.campaignMetrics.totalCampaigns}</span>
          </div>
          <div className="campaign-metric">
            <span className="metric-label">Emails Sent</span>
            <span className="metric-value">{analytics.campaignMetrics.emailsSent}</span>
          </div>
          <div className="campaign-metric success">
            <span className="metric-label">Open Rate</span>
            <span className="metric-value">
              {analytics.campaignMetrics.emailOpenRate.toFixed(1)}%
            </span>
          </div>
          <div className="campaign-metric success">
            <span className="metric-label">Click-Through Rate</span>
            <span className="metric-value">
              {analytics.campaignMetrics.clickThroughRate.toFixed(1)}%
            </span>
          </div>
          <div className="campaign-metric success">
            <span className="metric-label">Conversion Rate</span>
            <span className="metric-value">
              {analytics.campaignMetrics.conversionRate.toFixed(1)}%
            </span>
          </div>
          <div className="campaign-metric highlight">
            <span className="metric-label">Retention Increase</span>
            <span className="metric-value">
              {analytics.campaignMetrics.averageRetentionIncrease.toFixed(1)}%
            </span>
          </div>
        </div>
      </section>

      {/* At Risk Users Table */}
      <section className="analytics-section">
        <h3>Top At-Risk Users</h3>
        {atRiskUsers.length > 0 ? (
          <div className="at-risk-table-container">
            <table className="at-risk-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Risk Level</th>
                  <th>Churn Probability</th>
                  <th>Value at Risk</th>
                  <th>Key Factors</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {atRiskUsers.slice(0, 20).map((user) => (
                  <tr key={user.userId} className={`risk-${user.riskSegment}`}>
                    <td className="user-email">
                      <span title={user.email}>{user.email.substring(0, 30)}</span>
                    </td>
                    <td>
                      <span className={`badge risk-${user.riskSegment}`}>
                        {user.riskSegment.toUpperCase()}
                      </span>
                    </td>
                    <td>{(user.churnProbability * 100).toFixed(0)}%</td>
                    <td className="value-highlight">
                      ${user.predictedValueAtRisk.toLocaleString()}
                    </td>
                    <td className="factors-cell">
                      <span className="factors-tooltip" title={user.riskFactors.join(', ')}>
                        {user.riskFactors.length} factors
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn-action"
                        onClick={() => {
                          console.log('Create campaign for:', user.userId);
                        }}
                      >
                        Create Campaign
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">No users at risk</p>
        )}
      </section>
    </div>
  );
};

export default ChurnAlert;
