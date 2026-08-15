// No-Show Warning & Management Component
// Displays no-show history, fees, account status, and appeal process

import React, { useState, useEffect } from 'react';
import './NoShowWarning.css';

interface NoShowRecord {
  id: string;
  clientId: string;
  providerId: string;
  appointmentId: string;
  appointmentDate: Date;
  noShowDate: Date;
  noShowReason?: string;
  detectionMethod: 'auto_timeout' | 'provider_reported' | 'system_check';
  fee: number;
  feeStatus: 'pending' | 'charged' | 'waived' | 'appealed';
  status: 'pending_review' | 'confirmed' | 'disputed' | 'waived';
  createdAt: Date;
}

interface ClientNoShowMetrics {
  clientId: string;
  totalNoShows: number;
  currentMonth: number;
  last30Days: number;
  last90Days: number;
  totalFeesCharged: number;
  totalFeesPending: number;
  accountStatus: 'active' | 'warned' | 'suspended' | 'terminated';
  lastNoShowDate?: Date;
}

interface AccountAction {
  id: string;
  clientId: string;
  actionType: 'warning' | 'suspension' | 'termination';
  triggerThreshold: number;
  reason: string;
  status: 'active' | 'lifted' | 'appealed';
  effectiveDate: Date;
  expiryDate?: Date;
  appealWindowExpiresAt: Date;
  createdAt: Date;
}

interface NoShowAppeal {
  id: string;
  noShowId: string;
  clientId: string;
  reason: string;
  supportingDocuments: string[];
  status: 'submitted' | 'under_review' | 'approved' | 'denied';
  submittedAt: Date;
  reviewedAt?: Date;
}

interface NoShowWarningProps {
  clientId: string;
  userType: 'client' | 'admin' | 'provider';
  onAppealSubmitted?: () => void;
}

export const NoShowWarning: React.FC<NoShowWarningProps> = ({
  clientId,
  userType,
  onAppealSubmitted,
}) => {
  const [metrics, setMetrics] = useState<ClientNoShowMetrics | null>(null);
  const [noShows, setNoShows] = useState<NoShowRecord[]>([]);
  const [accountActions, setAccountActions] = useState<AccountAction[]>([]);
  const [appeals, setAppeals] = useState<NoShowAppeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'appeals' | 'actions'>(
    'overview'
  );
  const [showAppealModal, setShowAppealModal] = useState(false);
  const [selectedNoShow, setSelectedNoShow] = useState<NoShowRecord | null>(null);
  const [appealReason, setAppealReason] = useState('');
  const [appealDocuments, setAppealDocuments] = useState<string[]>([]);
  const [appealSubmitting, setAppealSubmitting] = useState(false);

  useEffect(() => {
    fetchNoShowData();
  }, [clientId]);

  const fetchNoShowData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');

      const [metricsRes, noShowsRes, actionsRes, appealsRes] = await Promise.all([
        fetch(`/api/v2/no-shows/metrics/${clientId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/v2/no-shows/client/${clientId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/v2/account-actions/${clientId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/v2/no-shows/appeals/${clientId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (!metricsRes.ok || !noShowsRes.ok || !actionsRes.ok || !appealsRes.ok) {
        throw new Error('Failed to fetch no-show data');
      }

      const metricsData = await metricsRes.json();
      const noShowsData = await noShowsRes.json();
      const actionsData = await actionsRes.json();
      const appealsData = await appealsRes.json();

      setMetrics(metricsData);
      setNoShows(noShowsData);
      setAccountActions(actionsData);
      setAppeals(appealsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load no-show information');
      console.error('Error fetching no-show data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAppealSubmit = async () => {
    if (!selectedNoShow || !appealReason.trim()) {
      alert('Please provide a reason for your appeal');
      return;
    }

    try {
      setAppealSubmitting(true);

      const response = await fetch(`/api/v2/no-shows/appeals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          noShowId: selectedNoShow.id,
          clientId,
          reason: appealReason,
          supportingDocuments: appealDocuments,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit appeal');
      }

      alert('Your appeal has been submitted successfully. Our team will review it within 5 business days.');
      setShowAppealModal(false);
      setAppealReason('');
      setAppealDocuments([]);
      setSelectedNoShow(null);
      await fetchNoShowData();

      if (onAppealSubmitted) {
        onAppealSubmitted();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit appeal');
      console.error('Error submitting appeal:', err);
    } finally {
      setAppealSubmitting(false);
    }
  };

  const getAccountStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'green';
      case 'warned':
        return 'orange';
      case 'suspended':
        return 'red';
      case 'terminated':
        return 'darkred';
      default:
        return 'gray';
    }
  };

  const getAccountStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'warned':
        return 'Warning';
      case 'suspended':
        return 'Suspended';
      case 'terminated':
        return 'Terminated';
      default:
        return 'Unknown';
    }
  };

  const getActionTypeDescription = (actionType: string, threshold: number) => {
    switch (actionType) {
      case 'warning':
        return `Account warning after ${threshold} no-shows`;
      case 'suspension':
        return `30-day account suspension after ${threshold} no-shows`;
      case 'termination':
        return `Account termination after ${threshold} no-shows`;
      default:
        return 'Unknown action';
    }
  };

  const canAppeal = (action: AccountAction) => {
    const expiryDate = new Date(action.appealWindowExpiresAt);
    return new Date() < expiryDate && action.status !== 'appealed';
  };

  if (loading) {
    return (
      <div className="no-show-warning-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading no-show information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="no-show-warning-container">
        <div className="error-message">
          <p>Error: {error}</p>
          <button onClick={fetchNoShowData} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="no-show-warning-container">
      {/* Alert Banner */}
      {metrics && metrics.accountStatus !== 'active' && (
        <div className={`alert-banner alert-${metrics.accountStatus}`}>
          <div className="alert-content">
            <h3>
              {metrics.accountStatus === 'warned'
                ? 'Account Warning'
                : metrics.accountStatus === 'suspended'
                  ? 'Account Suspended'
                  : 'Account Terminated'}
            </h3>
            <p>
              {metrics.accountStatus === 'warned'
                ? 'You have received a warning due to no-shows. Please ensure you attend scheduled appointments.'
                : metrics.accountStatus === 'suspended'
                  ? 'Your account has been temporarily suspended. You cannot schedule new appointments for 30 days.'
                  : 'Your account has been terminated due to continued no-show violations.'}
            </p>
          </div>
        </div>
      )}

      {/* Metrics Overview */}
      {metrics && (
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-label">Total No-Shows</div>
            <div className="metric-value">{metrics.totalNoShows}</div>
            <div className="metric-subtext">This year</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Current Month</div>
            <div className="metric-value">{metrics.currentMonth}</div>
            <div className="metric-subtext">In {new Date().toLocaleString('default', { month: 'long' })}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Fees Pending</div>
            <div className="metric-value">${metrics.totalFeesPending.toFixed(2)}</div>
            <div className="metric-subtext">To be charged</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Fees Charged</div>
            <div className="metric-value">${metrics.totalFeesCharged.toFixed(2)}</div>
            <div className="metric-subtext">Total</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Account Status</div>
            <div className={`metric-value status-${getAccountStatusColor(metrics.accountStatus)}`}>
              {getAccountStatusLabel(metrics.accountStatus)}
            </div>
            <div className="metric-subtext">Current status</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Last No-Show</div>
            <div className="metric-value">
              {metrics.lastNoShowDate ? new Date(metrics.lastNoShowDate).toLocaleDateString() : 'None'}
            </div>
            <div className="metric-subtext">Most recent</div>
          </div>
        </div>
      )}

      {/* Fee Escalation Warning */}
      {metrics && metrics.totalNoShows > 0 && (
        <div className="escalation-card">
          <h4>No-Show Fee Structure</h4>
          <div className="escalation-item">
            <span>1st No-Show:</span>
            <span className={metrics.totalNoShows >= 1 ? 'completed' : ''}>Free</span>
          </div>
          <div className="escalation-item">
            <span>2nd No-Show:</span>
            <span className={metrics.totalNoShows >= 2 ? 'completed' : ''}>$25</span>
          </div>
          <div className="escalation-item">
            <span>3rd+ No-Shows:</span>
            <span className={metrics.totalNoShows >= 3 ? 'completed' : ''}>$50 each</span>
          </div>
        </div>
      )}

      {/* Account Actions Warning */}
      {metrics && metrics.totalNoShows > 0 && (
        <div className="consequences-card">
          <h4>Account Consequences</h4>
          <div className="consequence-item">
            <span>3 No-Shows:</span>
            <span className={metrics.totalNoShows >= 3 ? 'active' : ''}>Account Warning</span>
          </div>
          <div className="consequence-item">
            <span>5 No-Shows:</span>
            <span className={metrics.totalNoShows >= 5 ? 'active' : ''}>Account Suspension (30 days)</span>
          </div>
          <div className="consequence-item">
            <span>10 No-Shows:</span>
            <span className={metrics.totalNoShows >= 10 ? 'active' : ''}>Account Termination</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History ({noShows.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'actions' ? 'active' : ''}`}
          onClick={() => setActiveTab('actions')}
        >
          Account Actions ({accountActions.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'appeals' ? 'active' : ''}`}
          onClick={() => setActiveTab('appeals')}
        >
          Appeals ({appeals.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="overview-section">
            <h3>No-Show Policy & Refund Information</h3>
            <div className="policy-section">
              <h4>Refund Policy</h4>
              <p>
                If you were unable to attend an appointment due to extenuating circumstances, you can submit an appeal
                with supporting documentation. Our team will review your case within 5 business days.
              </p>
            </div>
            <div className="policy-section">
              <h4>Appeal Process</h4>
              <ol>
                <li>Submit an appeal with a detailed explanation</li>
                <li>Provide supporting documentation if available</li>
                <li>Our team reviews your case</li>
                <li>We notify you of our decision via email</li>
                <li>If approved, fees are waived and removed from your account</li>
              </ol>
            </div>
            <div className="policy-section">
              <h4>Suspension & Termination</h4>
              <p>
                Account suspensions last 30 days. After this period, your account will be reactivated automatically.
                Terminations are permanent and require administrator review for reinstatement.
              </p>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="history-section">
            {noShows.length === 0 ? (
              <p className="empty-state">No no-shows recorded. Great job!</p>
            ) : (
              <div className="no-shows-list">
                {noShows.map((noShow) => (
                  <div key={noShow.id} className={`no-show-item status-${noShow.status}`}>
                    <div className="no-show-header">
                      <span className="date">
                        {new Date(noShow.appointmentDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      <span className={`status-badge status-${noShow.status}`}>{noShow.status}</span>
                      <span className={`fee-badge ${noShow.fee === 0 ? 'free' : 'charged'}`}>
                        {noShow.fee === 0 ? 'Free' : `$${noShow.fee.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="no-show-details">
                      <p>
                        <strong>Detection:</strong> {noShow.detectionMethod.replace(/_/g, ' ')}
                      </p>
                      {noShow.noShowReason && (
                        <p>
                          <strong>Reason:</strong> {noShow.noShowReason}
                        </p>
                      )}
                    </div>
                    {userType === 'client' && noShow.status === 'confirmed' && (
                      <button
                        className="appeal-button"
                        onClick={() => {
                          setSelectedNoShow(noShow);
                          setShowAppealModal(true);
                        }}
                      >
                        Submit Appeal
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Account Actions Tab */}
        {activeTab === 'actions' && (
          <div className="actions-section">
            {accountActions.length === 0 ? (
              <p className="empty-state">No account actions. Your account is in good standing.</p>
            ) : (
              <div className="actions-list">
                {accountActions.map((action) => (
                  <div key={action.id} className={`action-item action-${action.actionType}`}>
                    <div className="action-header">
                      <h4>{getActionTypeDescription(action.actionType, action.triggerThreshold)}</h4>
                      <span className={`action-status status-${action.status}`}>{action.status}</span>
                    </div>
                    <div className="action-details">
                      <p>
                        <strong>Effective Date:</strong>{' '}
                        {new Date(action.effectiveDate).toLocaleDateString()}
                      </p>
                      {action.expiryDate && (
                        <p>
                          <strong>Expiry Date:</strong> {new Date(action.expiryDate).toLocaleDateString()}
                        </p>
                      )}
                      <p>
                        <strong>Reason:</strong> {action.reason}
                      </p>
                      {userType === 'client' && action.status === 'active' && canAppeal(action) && (
                        <div className="appeal-window">
                          <p className="appeal-info">
                            You have until {new Date(action.appealWindowExpiresAt).toLocaleDateString()} to submit
                            an appeal.
                          </p>
                          <button className="appeal-button">Submit Appeal</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Appeals Tab */}
        {activeTab === 'appeals' && (
          <div className="appeals-section">
            {appeals.length === 0 ? (
              <p className="empty-state">No appeals submitted yet.</p>
            ) : (
              <div className="appeals-list">
                {appeals.map((appeal) => (
                  <div key={appeal.id} className={`appeal-item appeal-${appeal.status}`}>
                    <div className="appeal-header">
                      <span className="date">{new Date(appeal.submittedAt).toLocaleDateString()}</span>
                      <span className={`status-badge status-${appeal.status}`}>{appeal.status}</span>
                    </div>
                    <div className="appeal-details">
                      <p>
                        <strong>Reason:</strong> {appeal.reason}
                      </p>
                      {appeal.reviewedAt && (
                        <p>
                          <strong>Reviewed:</strong> {new Date(appeal.reviewedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Appeal Modal */}
      {showAppealModal && selectedNoShow && (
        <div className="modal-overlay" onClick={() => setShowAppealModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Submit Appeal</h3>
              <button
                className="close-button"
                onClick={() => setShowAppealModal(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <p className="appointment-info">
                <strong>Appointment Date:</strong>{' '}
                {new Date(selectedNoShow.appointmentDate).toLocaleDateString()}
              </p>

              <div className="form-group">
                <label>Appeal Reason *</label>
                <textarea
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                  placeholder="Please explain why you were unable to attend this appointment..."
                  rows={5}
                  className="appeal-textarea"
                />
                <div className="char-count">
                  {appealReason.length}/1000 characters
                </div>
              </div>

              <div className="form-group">
                <label>Supporting Documents</label>
                <div className="document-upload">
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        setAppealDocuments(
                          Array.from(e.target.files).map((f) => f.name)
                        );
                      }
                    }}
                    className="file-input"
                  />
                  <p className="upload-hint">
                    Upload medical records, emergency notices, or other supporting documentation
                  </p>
                </div>
              </div>

              {appealDocuments.length > 0 && (
                <div className="document-list">
                  <h4>Selected Documents:</h4>
                  <ul>
                    {appealDocuments.map((doc, idx) => (
                      <li key={idx}>{doc}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="cancel-button"
                onClick={() => setShowAppealModal(false)}
                disabled={appealSubmitting}
              >
                Cancel
              </button>
              <button
                className="submit-button"
                onClick={handleAppealSubmit}
                disabled={appealSubmitting || !appealReason.trim()}
              >
                {appealSubmitting ? 'Submitting...' : 'Submit Appeal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoShowWarning;
