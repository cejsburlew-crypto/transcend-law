// VerificationDashboard Component
// Admin panel for credential verification and provider vetting

import React, { useState, useEffect } from 'react';
import './VerificationDashboard.css';

interface Credential {
  id: number;
  company_id: number;
  company_name: string;
  credential_type: string;
  credential_number: string;
  issuing_state: string;
  expires_date: string;
  verification_status: string;
  verified_by?: string;
}

interface VerificationStats {
  total_companies: number;
  verified_companies: number;
  pending_verifications: number;
  expired_credentials: number;
}

interface VerificationDashboardProps {
  onVerifyCredential?: (credentialId: number) => void;
  onRejectCredential?: (credentialId: number, reason: string) => void;
  className?: string;
}

export const VerificationDashboard: React.FC<VerificationDashboardProps> = ({
  onVerifyCredential,
  onRejectCredential,
  className = '',
}) => {
  const [stats, setStats] = useState<VerificationStats | null>(null);
  const [pendingCredentials, setPendingCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'verified' | 'expired'>('pending');
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionForm, setShowRejectionForm] = useState(false);

  useEffect(() => {
    fetchVerificationData();
    const interval = setInterval(fetchVerificationData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchVerificationData = async () => {
    try {
      setLoading(true);

      const [statsRes, credentialsRes] = await Promise.all([
        fetch('/api/v2/verification/admin/stats'),
        fetch('/api/v2/verification/admin/pending'),
      ]);

      const statsData = await statsRes.json();
      const credentialsData = await credentialsRes.json();

      if (statsData.success) {
        setStats(statsData.data);
      }
      if (credentialsData.success) {
        setPendingCredentials(credentialsData.data);
      }
    } catch (error) {
      console.error('Failed to fetch verification data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCredential = async (credentialId: number) => {
    try {
      const response = await fetch(
        `/api/v2/verification/credentials/${credentialId}/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verifiedBy: 'admin' }),
        }
      );

      if (response.ok) {
        onVerifyCredential?.(credentialId);
        fetchVerificationData();
        setSelectedCredential(null);
      }
    } catch (error) {
      console.error('Failed to verify credential:', error);
    }
  };

  const handleRejectCredential = async () => {
    if (!selectedCredential) return;

    try {
      const response = await fetch(
        `/api/v2/verification/credentials/${selectedCredential.id}/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: rejectionReason }),
        }
      );

      if (response.ok) {
        onRejectCredential?.(selectedCredential.id, rejectionReason);
        fetchVerificationData();
        setSelectedCredential(null);
        setRejectionReason('');
        setShowRejectionForm(false);
      }
    } catch (error) {
      console.error('Failed to reject credential:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'status-verified';
      case 'pending':
        return 'status-pending';
      case 'expired':
        return 'status-expired';
      case 'rejected':
        return 'status-rejected';
      default:
        return 'status-default';
    }
  };

  if (loading && !stats) {
    return (
      <div className={`verification-dashboard ${className}`}>
        <div className="dashboard-loading">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className={`verification-dashboard ${className}`}>
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-icon">✅</div>
        <div className="header-content">
          <h2 className="header-title">Verification Dashboard</h2>
          <p className="header-subtitle">Manage credential verification and vetting</p>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number">{stats.total_companies}</div>
            <div className="stat-label">Total Companies</div>
          </div>
          <div className="stat-card verified">
            <div className="stat-number">{stats.verified_companies}</div>
            <div className="stat-label">Verified</div>
            <div className="stat-percent">
              {Math.round((stats.verified_companies / stats.total_companies) * 100)}%
            </div>
          </div>
          <div className="stat-card pending">
            <div className="stat-number">{stats.pending_verifications}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card expired">
            <div className="stat-number">{stats.expired_credentials}</div>
            <div className="stat-label">Expired</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="dashboard-tabs">
        <button
          className={`tab ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          Pending Review
        </button>
        <button
          className={`tab ${filter === 'verified' ? 'active' : ''}`}
          onClick={() => setFilter('verified')}
        >
          Verified
        </button>
        <button
          className={`tab ${filter === 'expired' ? 'active' : ''}`}
          onClick={() => setFilter('expired')}
        >
          Expired
        </button>
      </div>

      {/* Credentials List */}
      <div className="credentials-section">
        {pendingCredentials.length === 0 ? (
          <div className="empty-state">
            <p className="empty-icon">📋</p>
            <p className="empty-text">
              {filter === 'pending'
                ? 'No pending verifications'
                : `No ${filter} credentials`}
            </p>
          </div>
        ) : (
          <div className="credentials-list">
            {pendingCredentials.map((cred) => (
              <div
                key={cred.id}
                className={`credential-item ${getStatusColor(cred.verification_status)}`}
                onClick={() => setSelectedCredential(cred)}
              >
                <div className="cred-header">
                  <h4 className="cred-company">{cred.company_name}</h4>
                  <span className={`cred-status ${getStatusColor(cred.verification_status)}`}>
                    {cred.verification_status}
                  </span>
                </div>

                <div className="cred-details">
                  <div className="detail-row">
                    <span className="detail-label">Type:</span>
                    <span className="detail-value">{cred.credential_type}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Number:</span>
                    <span className="detail-value">{cred.credential_number}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">State:</span>
                    <span className="detail-value">{cred.issuing_state}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Expires:</span>
                    <span className="detail-value">{formatDate(cred.expires_date)}</span>
                  </div>
                </div>

                {filter === 'pending' && (
                  <div className="cred-actions">
                    <button
                      className="btn btn-approve"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVerifyCredential(cred.id);
                      }}
                    >
                      ✓ Approve
                    </button>
                    <button
                      className="btn btn-reject"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCredential(cred);
                        setShowRejectionForm(true);
                      }}
                    >
                      ✗ Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rejection Form Modal */}
      {showRejectionForm && selectedCredential && (
        <div className="rejection-modal-overlay" onClick={() => setShowRejectionForm(false)}>
          <div className="rejection-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Reject Credential</h3>
            <p className="modal-subtitle">
              {selectedCredential.company_name} - {selectedCredential.credential_type}
            </p>

            <textarea
              className="rejection-reason"
              placeholder="Enter reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
            />

            <div className="modal-actions">
              <button
                className="btn btn-cancel"
                onClick={() => setShowRejectionForm(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-confirm-reject"
                onClick={handleRejectCredential}
                disabled={!rejectionReason.trim()}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerificationDashboard;
