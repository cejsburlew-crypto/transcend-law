// Review Analysis Component
// Displays review credibility scores, flags, and admin management interface

import React, { useState, useEffect } from 'react';
import './ReviewAnalysis.css';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// ============================================
// TYPES
// ============================================

interface ReviewCredibilityScore {
  reviewId: string;
  providerId: string;
  overallScore: number;
  scoreComponents: {
    verifiedUserScore: number;
    timingScore: number;
    textAnalysisScore: number;
    ratingClusteringScore: number;
    userHistoryScore: number;
    contentConsistencyScore: number;
  };
  flags: CredibilityFlag[];
  isLikelyFake: boolean;
  recommendedAction: 'approve' | 'flag' | 'reject' | 'manual_review';
  aiTextProbability: number;
  createdAt: Date;
  analyzedAt: Date;
}

interface CredibilityFlag {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  confidence: number;
  evidence?: string;
}

interface ProviderReputation {
  providerId: string;
  averageRating: number;
  totalReviews: number;
  verifiedReviews: number;
  credibilityScore: number;
  suspiciousReviews: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  trustScore: number;
  lastUpdated: Date;
  trend: 'improving' | 'stable' | 'declining' | 'volatile';
}

interface AdminReviewItem {
  id: string;
  reviewId: string;
  providerId: string;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'resolved';
  createdAt: Date;
  reviewedAt?: Date;
  resolution?: string;
}

interface ReviewTrend {
  date: string;
  averageCredibilityScore: number;
  flaggedCount: number;
  approvedCount: number;
  rejectedCount: number;
  averageRating: number;
}

// ============================================
// MAIN COMPONENT
// ============================================

interface ReviewAnalysisProps {
  providerId?: string;
  reviewId?: string;
  isAdmin?: boolean;
  onReviewAction?: (reviewId: string, action: string) => void;
}

export const ReviewAnalysis: React.FC<ReviewAnalysisProps> = ({
  providerId,
  reviewId,
  isAdmin = false,
  onReviewAction,
}) => {
  const [credibilityScore, setCredibilityScore] = useState<ReviewCredibilityScore | null>(null);
  const [reputation, setReputation] = useState<ProviderReputation | null>(null);
  const [adminQueue, setAdminQueue] = useState<AdminReviewItem[]>([]);
  const [trends, setTrends] = useState<ReviewTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'flags' | 'trends' | 'admin'>('overview');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('pending');

  useEffect(() => {
    loadData();
  }, [providerId, reviewId]);

  const loadData = async () => {
    try {
      setLoading(true);

      if (reviewId) {
        // Load specific review credibility
        const scoreResponse = await fetch(`/api/reviews/${reviewId}/credibility`);
        const scoreData = await scoreResponse.json();
        setCredibilityScore(scoreData);
      }

      if (providerId) {
        // Load provider reputation
        const reputationResponse = await fetch(`/api/providers/${providerId}/reputation`);
        const reputationData = await reputationResponse.json();
        setReputation(reputationData);

        // Load review trends
        const trendsResponse = await fetch(`/api/providers/${providerId}/review-trends`);
        const trendsData = await trendsResponse.json();
        setTrends(trendsData);
      }

      if (isAdmin) {
        // Load admin review queue
        const queueResponse = await fetch(
          `/api/admin/review-queue?status=${filterStatus}&priority=${filterPriority}`
        );
        const queueData = await queueResponse.json();
        setAdminQueue(queueData);
      }
    } catch (error) {
      console.error('Failed to load review data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="review-analysis-loading">
        <div className="loading-spinner"></div>
        <p>Analyzing review credibility...</p>
      </div>
    );
  }

  return (
    <div className="review-analysis-container">
      {/* Header */}
      <div className="review-analysis-header">
        <h2>Review Credibility Analysis</h2>
        <div className="header-tabs">
          {!isAdmin && (
            <>
              <button
                className={`tab-button ${selectedTab === 'overview' ? 'active' : ''}`}
                onClick={() => setSelectedTab('overview')}
              >
                Overview
              </button>
              <button
                className={`tab-button ${selectedTab === 'flags' ? 'active' : ''}`}
                onClick={() => setSelectedTab('flags')}
              >
                Flags
              </button>
              <button
                className={`tab-button ${selectedTab === 'trends' ? 'active' : ''}`}
                onClick={() => setSelectedTab('trends')}
              >
                Trends
              </button>
            </>
          )}
          {isAdmin && (
            <>
              <button
                className={`tab-button ${selectedTab === 'admin' ? 'active' : ''}`}
                onClick={() => setSelectedTab('admin')}
              >
                Review Queue
              </button>
              <button
                className={`tab-button ${selectedTab === 'overview' ? 'active' : ''}`}
                onClick={() => setSelectedTab('overview')}
              >
                Analytics
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="review-analysis-content">
        {selectedTab === 'overview' && (
          <OverviewTab
            credibilityScore={credibilityScore}
            reputation={reputation}
            onReviewAction={onReviewAction}
          />
        )}

        {selectedTab === 'flags' && credibilityScore && (
          <FlagsTab flags={credibilityScore.flags} />
        )}

        {selectedTab === 'trends' && trends.length > 0 && (
          <TrendsTab trends={trends} reputation={reputation} />
        )}

        {selectedTab === 'admin' && isAdmin && (
          <AdminTab
            queue={adminQueue}
            filterPriority={filterPriority}
            filterStatus={filterStatus}
            onFilterPriorityChange={setFilterPriority}
            onFilterStatusChange={setFilterStatus}
            onReviewAction={onReviewAction}
            onRefresh={loadData}
          />
        )}
      </div>
    </div>
  );
};

// ============================================
// OVERVIEW TAB
// ============================================

interface OverviewTabProps {
  credibilityScore: ReviewCredibilityScore | null;
  reputation: ProviderReputation | null;
  onReviewAction?: (reviewId: string, action: string) => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  credibilityScore,
  reputation,
  onReviewAction,
}) => {
  return (
    <div className="tab-content overview-tab">
      {credibilityScore && (
        <div className="review-credibility-card">
          <h3>Individual Review Analysis</h3>

          {/* Main Score Display */}
          <div className="score-display">
            <div className="score-circle">
              <div className={`score-value ${getScoreClass(credibilityScore.overallScore)}`}>
                {credibilityScore.overallScore}
              </div>
              <div className="score-label">Credibility Score</div>
            </div>

            <div className="score-details">
              <div className="score-status">
                <p>
                  <strong>Status:</strong>{' '}
                  <span className={`status-badge ${credibilityScore.isLikelyFake ? 'fake' : 'legitimate'}`}>
                    {credibilityScore.isLikelyFake ? 'Likely Fake' : 'Likely Legitimate'}
                  </span>
                </p>
                <p>
                  <strong>Recommended Action:</strong>{' '}
                  <span className={`action-badge ${credibilityScore.recommendedAction}`}>
                    {credibilityScore.recommendedAction.toUpperCase()}
                  </span>
                </p>
                <p>
                  <strong>AI Detection:</strong> {credibilityScore.aiTextProbability}% likely AI-generated
                </p>
              </div>

              {credibilityScore.isLikelyFake && onReviewAction && (
                <button
                  className="action-button reject"
                  onClick={() => onReviewAction(credibilityScore.reviewId, 'reject')}
                >
                  Reject Review
                </button>
              )}
            </div>
          </div>

          {/* Score Components Breakdown */}
          <div className="score-components">
            <h4>Score Components</h4>
            <div className="components-grid">
              <ScoreComponent
                label="Verified User"
                score={credibilityScore.scoreComponents.verifiedUserScore}
              />
              <ScoreComponent
                label="Timing"
                score={credibilityScore.scoreComponents.timingScore}
              />
              <ScoreComponent
                label="Text Analysis"
                score={credibilityScore.scoreComponents.textAnalysisScore}
              />
              <ScoreComponent
                label="Rating Clustering"
                score={credibilityScore.scoreComponents.ratingClusteringScore}
              />
              <ScoreComponent
                label="User History"
                score={credibilityScore.scoreComponents.userHistoryScore}
              />
              <ScoreComponent
                label="Content Consistency"
                score={credibilityScore.scoreComponents.contentConsistencyScore}
              />
            </div>
          </div>

          {/* Score Component Chart */}
          <div className="component-chart">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[credibilityScore.scoreComponents]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="verifiedUserScore" fill="#8b5cf6" name="Verified User" />
                <Bar dataKey="timingScore" fill="#3b82f6" name="Timing" />
                <Bar dataKey="textAnalysisScore" fill="#10b981" name="Text Analysis" />
                <Bar dataKey="ratingClusteringScore" fill="#f59e0b" name="Rating Clustering" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {reputation && (
        <div className="provider-reputation-card">
          <h3>Provider Reputation Overview</h3>

          <div className="reputation-grid">
            <div className="reputation-item">
              <span className="reputation-label">Average Rating</span>
              <span className={`reputation-value rating-${Math.round(reputation.averageRating)}`}>
                {reputation.averageRating.toFixed(1)} ★
              </span>
            </div>

            <div className="reputation-item">
              <span className="reputation-label">Total Reviews</span>
              <span className="reputation-value">{reputation.totalReviews}</span>
            </div>

            <div className="reputation-item">
              <span className="reputation-label">Verified Reviews</span>
              <span className="reputation-value">{reputation.verifiedReviews}</span>
            </div>

            <div className="reputation-item">
              <span className="reputation-label">Credibility Score</span>
              <span className={`reputation-value ${getScoreClass(reputation.credibilityScore)}`}>
                {reputation.credibilityScore}
              </span>
            </div>

            <div className="reputation-item">
              <span className="reputation-label">Trust Score</span>
              <span className={`reputation-value ${getScoreClass(reputation.trustScore)}`}>
                {reputation.trustScore}
              </span>
            </div>

            <div className="reputation-item">
              <span className="reputation-label">Risk Level</span>
              <span className={`reputation-value risk-${reputation.riskLevel}`}>
                {reputation.riskLevel.toUpperCase()}
              </span>
            </div>

            <div className="reputation-item">
              <span className="reputation-label">Suspicious Reviews</span>
              <span className="reputation-value warning">{reputation.suspiciousReviews}</span>
            </div>

            <div className="reputation-item">
              <span className="reputation-label">Trend</span>
              <span className={`reputation-value trend-${reputation.trend}`}>
                {getTrendIcon(reputation.trend)} {reputation.trend.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// FLAGS TAB
// ============================================

interface FlagsTabProps {
  flags: CredibilityFlag[];
}

const FlagsTab: React.FC<FlagsTabProps> = ({ flags }) => {
  if (flags.length === 0) {
    return (
      <div className="tab-content">
        <div className="empty-state">
          <p>No credibility flags detected for this review.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content flags-tab">
      <h3>Credibility Flags ({flags.length})</h3>

      <div className="flags-grid">
        {flags.map((flag) => (
          <div key={flag.id} className={`flag-card severity-${flag.severity}`}>
            <div className="flag-header">
              <h4>{flag.type.replace(/_/g, ' ').toUpperCase()}</h4>
              <span className={`severity-badge ${flag.severity}`}>
                {flag.severity.toUpperCase()}
              </span>
            </div>

            <p className="flag-description">{flag.description}</p>

            <div className="flag-details">
              <div className="detail-item">
                <span className="detail-label">Confidence:</span>
                <div className="confidence-bar">
                  <div
                    className="confidence-fill"
                    style={{ width: `${flag.confidence}%` }}
                  ></div>
                </div>
                <span className="detail-value">{flag.confidence}%</span>
              </div>

              {flag.evidence && (
                <div className="detail-item">
                  <span className="detail-label">Evidence:</span>
                  <p className="evidence-text">{flag.evidence}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Flag Distribution */}
      <div className="flag-distribution">
        <h4>Flag Distribution by Severity</h4>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={getFlagDistribution(flags)}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label
            >
              {getSeverityColors().map((color, index) => (
                <Cell key={`cell-${index}`} fill={color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ============================================
// TRENDS TAB
// ============================================

interface TrendsTabProps {
  trends: ReviewTrend[];
  reputation: ProviderReputation | null;
}

const TrendsTab: React.FC<TrendsTabProps> = ({ trends, reputation }) => {
  return (
    <div className="tab-content trends-tab">
      <h3>Review Trends (Last 30 Days)</h3>

      {reputation && (
        <div className="trend-summary">
          <div className="trend-item">
            <span>Trend Direction:</span>
            <span className={`trend-badge ${reputation.trend}`}>
              {getTrendIcon(reputation.trend)} {reputation.trend.toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Credibility Trend */}
      <div className="chart-container">
        <h4>Credibility Score Trend</h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="averageCredibilityScore"
              stroke="#3b82f6"
              name="Avg Credibility Score"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Review Status Distribution */}
      <div className="chart-container">
        <h4>Review Approval Status</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={trends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="approvedCount" fill="#10b981" name="Approved" />
            <Bar dataKey="flaggedCount" fill="#f59e0b" name="Flagged" />
            <Bar dataKey="rejectedCount" fill="#ef4444" name="Rejected" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Rating Distribution */}
      <div className="chart-container">
        <h4>Average Rating Trend</h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" angle={-45} textAnchor="end" height={80} />
            <YAxis domain={[0, 5]} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="averageRating"
              stroke="#8b5cf6"
              name="Avg Rating"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ============================================
// ADMIN TAB
// ============================================

interface AdminTabProps {
  queue: AdminReviewItem[];
  filterPriority: string;
  filterStatus: string;
  onFilterPriorityChange: (priority: string) => void;
  onFilterStatusChange: (status: string) => void;
  onReviewAction?: (reviewId: string, action: string) => void;
  onRefresh: () => void;
}

const AdminTab: React.FC<AdminTabProps> = ({
  queue,
  filterPriority,
  filterStatus,
  onFilterPriorityChange,
  onFilterStatusChange,
  onReviewAction,
  onRefresh,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div className="tab-content admin-tab">
      <div className="admin-header">
        <h3>Admin Review Queue</h3>
        <button className="refresh-button" onClick={onRefresh}>
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="admin-filters">
        <div className="filter-group">
          <label htmlFor="priority-filter">Priority:</label>
          <select
            id="priority-filter"
            value={filterPriority}
            onChange={(e) => onFilterPriorityChange(e.target.value)}
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="status-filter">Status:</label>
          <select
            id="status-filter"
            value={filterStatus}
            onChange={(e) => onFilterStatusChange(e.target.value)}
          >
            <option value="pending">Pending</option>
            <option value="in_review">In Review</option>
            <option value="resolved">Resolved</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Queue List */}
      <div className="admin-queue">
        {queue.length === 0 ? (
          <div className="empty-state">
            <p>No reviews in queue matching current filters.</p>
          </div>
        ) : (
          queue.map((item) => (
            <div
              key={item.id}
              className={`queue-item priority-${item.priority} ${selectedId === item.id ? 'selected' : ''}`}
              onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}
            >
              <div className="queue-item-header">
                <span className="priority-badge">{item.priority.toUpperCase()}</span>
                <span className="status-badge">{item.status.toUpperCase()}</span>
                <span className="review-id">Review #{item.reviewId.substring(0, 8)}</span>
                <span className="created-date">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </div>

              <p className="queue-reason">{item.reason}</p>

              {selectedId === item.id && (
                <div className="queue-item-details">
                  {item.resolution && (
                    <p>
                      <strong>Resolution:</strong> {item.resolution}
                    </p>
                  )}

                  {item.status === 'pending' && onReviewAction && (
                    <div className="queue-actions">
                      <button
                        className="action-button approve"
                        onClick={() => onReviewAction(item.reviewId, 'approve')}
                      >
                        Approve
                      </button>
                      <button
                        className="action-button reject"
                        onClick={() => onReviewAction(item.reviewId, 'reject')}
                      >
                        Reject
                      </button>
                      <button
                        className="action-button flag"
                        onClick={() => onReviewAction(item.reviewId, 'flag')}
                      >
                        Flag for Further Review
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ============================================
// HELPER COMPONENTS & FUNCTIONS
// ============================================

interface ScoreComponentProps {
  label: string;
  score: number;
}

const ScoreComponent: React.FC<ScoreComponentProps> = ({ label, score }) => {
  return (
    <div className="score-component">
      <div className="component-score">{score}</div>
      <div className="component-label">{label}</div>
      <div className="component-bar">
        <div
          className={`component-fill ${getScoreClass(score)}`}
          style={{ width: `${score}%` }}
        ></div>
      </div>
    </div>
  );
};

function getScoreClass(score: number): string {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

function getTrendIcon(trend: string): string {
  switch (trend) {
    case 'improving':
      return '📈';
    case 'declining':
      return '📉';
    case 'volatile':
      return '⚡';
    default:
      return '➡️';
  }
}

function getFlagDistribution(flags: CredibilityFlag[]) {
  const distribution = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  flags.forEach((flag) => {
    distribution[flag.severity]++;
  });

  return [
    { name: 'Critical', value: distribution.critical },
    { name: 'High', value: distribution.high },
    { name: 'Medium', value: distribution.medium },
    { name: 'Low', value: distribution.low },
  ].filter((item) => item.value > 0);
}

function getSeverityColors(): string[] {
  return ['#dc2626', '#f59e0b', '#eab308', '#84cc16'];
}

export default ReviewAnalysis;
