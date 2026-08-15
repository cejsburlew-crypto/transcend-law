// KYC Admin Dashboard
// Review queue, approval/rejection, compliance monitoring

import React, { useState, useEffect } from 'react';
import './KYCAdminDashboard.css';

interface VerificationItem {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  stage: string;
  status: string;
  created_at: string;
  document_url?: string;
  rejection_reason?: string;
}

interface VideoCall {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  scheduled_at?: string;
  estimated_wait_time?: string;
}

interface DashboardStats {
  pending_reviews: number;
  in_progress_reviews: number;
  pending_video_calls: number;
  sanctions_alerts: number;
  total_users: number;
  fully_verified_users: number;
}

const KYCAdminDashboard: React.FC = () => {
  const [tab, setTab] = useState<'reviews' | 'video' | 'stats'>('reviews');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Review queue
  const [reviewQueue, setReviewQueue] = useState<VerificationItem[]>([]);
  const [selectedReview, setSelectedReview] = useState<VerificationItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Video calls
  const [videoCalls, setVideoCalls] = useState<VideoCall[]>([]);
  const [selectedCall, setSelectedCall] = useState<VideoCall | null>(null);
  const [agentNotes, setAgentNotes] = useState('');

  // Stats
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // Fetch data on mount and tab change
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [tab]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (tab === 'reviews') {
        await fetchReviewQueue();
      } else if (tab === 'video') {
        await fetchVideoCalls();
      } else {
        await fetchStats();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchReviewQueue = async () => {
    const response = await fetch('/api/kyc/admin/review-queue', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) throw new Error('Failed to fetch review queue');

    const data = await response.json();
    setReviewQueue(data);
  };

  const fetchVideoCalls = async () => {
    const response = await fetch('/api/kyc/admin/video-calls', {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) throw new Error('Failed to fetch video calls');

    const data = await response.json();
    setVideoCalls(data);
  };

  const fetchStats = async () => {
    // Note: This endpoint would need to be created to return dashboard stats
    // For now, we'll calculate from review queue and video calls
    try {
      const reviewResponse = await fetch('/api/kyc/admin/review-queue', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const videoResponse = await fetch('/api/kyc/admin/video-calls', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const reviews = reviewResponse.ok ? await reviewResponse.json() : [];
      const videos = videoResponse.ok ? await videoResponse.json() : [];

      setStats({
        pending_reviews: reviews.filter((r: any) => r.status === 'pending').length,
        in_progress_reviews: reviews.filter((r: any) => r.status === 'in_progress').length,
        pending_video_calls: videos.filter((v: any) => v.status === 'pending').length,
        sanctions_alerts: 0, // TODO: Fetch from API
        total_users: 0, // TODO: Fetch from API
        fully_verified_users: 0, // TODO: Fetch from API
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const handleApprove = async () => {
    if (!selectedReview) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/kyc/admin/approve/${selectedReview.id}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to approve verification');

      setSuccess(`Approved ${selectedReview.stage} verification for ${selectedReview.email}`);
      setSelectedReview(null);
      fetchReviewQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReview || !rejectionReason.trim()) {
      setError('Please enter a rejection reason');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `/api/kyc/admin/reject/${selectedReview.id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ reason: rejectionReason }),
        }
      );

      if (!response.ok) throw new Error('Failed to reject verification');

      setSuccess(`Rejected ${selectedReview.stage} verification for ${selectedReview.email}`);
      setSelectedReview(null);
      setRejectionReason('');
      fetchReviewQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteVideoCall = async () => {
    if (!selectedCall || !agentNotes.trim()) {
      setError('Please enter agent notes');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `/api/kyc/video/complete/${selectedCall.id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({
            userId: selectedCall.user_id,
            agentNotes,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to complete video call');

      setSuccess(`Video verification completed for ${selectedCall.email}`);
      setSelectedCall(null);
      setAgentNotes('');
      fetchVideoCalls();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete video call');
    } finally {
      setLoading(false);
    }
  };

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      email: 'Email Verification',
      phone: 'Phone Verification',
      government_id: 'Government ID',
      address_verification: 'Address Verification',
      bank_account: 'Bank Account',
      video_call: 'Video Call',
    };
    return labels[stage] || stage;
  };

  return (
    <div className="kyc-admin-container">
      <div className="admin-header">
        <h1>KYC Admin Dashboard</h1>
        <p>Manage verification reviews, approve/reject documents, and schedule video calls</p>
      </div>

      {/* Messages */}
      {error && <div className="admin-error">{error}</div>}
      {success && <div className="admin-success">{success}</div>}

      {/* Tabs */}
      <div className="admin-tabs">
        <button
          className={`tab-button ${tab === 'reviews' ? 'active' : ''}`}
          onClick={() => setTab('reviews')}
        >
          Review Queue ({reviewQueue.length})
        </button>
        <button
          className={`tab-button ${tab === 'video' ? 'active' : ''}`}
          onClick={() => setTab('video')}
        >
          Video Calls ({videoCalls.length})
        </button>
        <button
          className={`tab-button ${tab === 'stats' ? 'active' : ''}`}
          onClick={() => setTab('stats')}
        >
          Statistics
        </button>
      </div>

      {loading && <div className="loading">Loading...</div>}

      {/* Review Queue Tab */}
      {tab === 'reviews' && (
        <div className="tab-content">
          <div className="admin-grid">
            {/* Review List */}
            <div className="review-list">
              <h2>Pending Verifications</h2>
              {reviewQueue.length === 0 ? (
                <p className="empty-state">No pending verifications</p>
              ) : (
                <div className="list">
                  {reviewQueue.map((review) => (
                    <div
                      key={review.id}
                      className={`review-item ${selectedReview?.id === review.id ? 'selected' : ''}`}
                      onClick={() => setSelectedReview(review)}
                    >
                      <div className="review-header">
                        <strong>
                          {review.first_name} {review.last_name}
                        </strong>
                        <span className="stage-badge">{getStageLabel(review.stage)}</span>
                      </div>
                      <div className="review-meta">
                        <p className="email">{review.email}</p>
                        <p className="time">
                          {new Date(review.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Review Details */}
            {selectedReview ? (
              <div className="review-details">
                <h3>
                  {selectedReview.first_name} {selectedReview.last_name}
                </h3>
                <p className="email">{selectedReview.email}</p>

                <div className="detail-section">
                  <label>Stage:</label>
                  <p>{getStageLabel(selectedReview.stage)}</p>
                </div>

                <div className="detail-section">
                  <label>Submitted:</label>
                  <p>{new Date(selectedReview.created_at).toLocaleString()}</p>
                </div>

                {selectedReview.document_url && (
                  <div className="detail-section">
                    <label>Document:</label>
                    <a
                      href={selectedReview.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="document-link"
                    >
                      View Document
                    </a>
                  </div>
                )}

                {selectedReview.rejection_reason && (
                  <div className="detail-section rejection">
                    <label>Previous Rejection Reason:</label>
                    <p>{selectedReview.rejection_reason}</p>
                  </div>
                )}

                {/* Rejection Reason Input */}
                <div className="detail-section">
                  <label htmlFor="rejection-reason">Rejection Reason (if applicable):</label>
                  <textarea
                    id="rejection-reason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explain why this verification is being rejected..."
                    rows={4}
                  />
                </div>

                {/* Action Buttons */}
                <div className="action-buttons">
                  <button
                    onClick={handleApprove}
                    disabled={loading}
                    className="btn-approve"
                  >
                    {loading ? 'Processing...' : 'Approve'}
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={loading || !rejectionReason.trim()}
                    className="btn-reject"
                  >
                    {loading ? 'Processing...' : 'Reject'}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedReview(null);
                      setRejectionReason('');
                    }}
                    className="btn-cancel"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="empty-details">
                <p>Select a verification to review</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Video Calls Tab */}
      {tab === 'video' && (
        <div className="tab-content">
          <div className="admin-grid">
            {/* Video Call List */}
            <div className="review-list">
              <h2>Pending Video Calls</h2>
              {videoCalls.length === 0 ? (
                <p className="empty-state">No pending video calls</p>
              ) : (
                <div className="list">
                  {videoCalls.map((call) => (
                    <div
                      key={call.id}
                      className={`review-item ${selectedCall?.id === call.id ? 'selected' : ''}`}
                      onClick={() => setSelectedCall(call)}
                    >
                      <div className="review-header">
                        <strong>
                          {call.first_name} {call.last_name}
                        </strong>
                        <span className={`status-badge ${call.status}`}>{call.status}</span>
                      </div>
                      <div className="review-meta">
                        <p className="email">{call.email}</p>
                        {call.scheduled_at && (
                          <p className="time">
                            {new Date(call.scheduled_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Video Call Details */}
            {selectedCall ? (
              <div className="review-details">
                <h3>
                  {selectedCall.first_name} {selectedCall.last_name}
                </h3>
                <p className="email">{selectedCall.email}</p>

                <div className="detail-section">
                  <label>Status:</label>
                  <p className={`status-badge ${selectedCall.status}`}>{selectedCall.status}</p>
                </div>

                {selectedCall.scheduled_at && (
                  <div className="detail-section">
                    <label>Scheduled For:</label>
                    <p>{new Date(selectedCall.scheduled_at).toLocaleString()}</p>
                  </div>
                )}

                {/* Agent Notes */}
                <div className="detail-section">
                  <label htmlFor="agent-notes">Agent Notes:</label>
                  <textarea
                    id="agent-notes"
                    value={agentNotes}
                    onChange={(e) => setAgentNotes(e.target.value)}
                    placeholder="Document verification results, identity confirmation, etc..."
                    rows={4}
                  />
                </div>

                {/* Action Buttons */}
                <div className="action-buttons">
                  <button
                    onClick={handleCompleteVideoCall}
                    disabled={loading || !agentNotes.trim()}
                    className="btn-approve"
                  >
                    {loading ? 'Processing...' : 'Mark as Complete'}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCall(null);
                      setAgentNotes('');
                    }}
                    className="btn-cancel"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="empty-details">
                <p>Select a video call to review</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats Tab */}
      {tab === 'stats' && (
        <div className="tab-content">
          {stats ? (
            <div className="stats-grid">
              <div className="stat-card pending">
                <h3>{stats.pending_reviews}</h3>
                <p>Pending Reviews</p>
              </div>
              <div className="stat-card in-progress">
                <h3>{stats.in_progress_reviews}</h3>
                <p>In Progress</p>
              </div>
              <div className="stat-card video">
                <h3>{stats.pending_video_calls}</h3>
                <p>Pending Video Calls</p>
              </div>
              <div className="stat-card alert">
                <h3>{stats.sanctions_alerts}</h3>
                <p>Sanctions Alerts</p>
              </div>
              <div className="stat-card total">
                <h3>{stats.total_users}</h3>
                <p>Total Users</p>
              </div>
              <div className="stat-card verified">
                <h3>{stats.fully_verified_users}</h3>
                <p>Fully Verified</p>
              </div>
            </div>
          ) : (
            <p className="empty-state">Loading statistics...</p>
          )}
        </div>
      )}
    </div>
  );
};

export default KYCAdminDashboard;
