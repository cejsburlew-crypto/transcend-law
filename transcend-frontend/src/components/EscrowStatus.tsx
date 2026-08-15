// Escrow Status Component
// Displays escrow payment information, release conditions, and actions

import React, { useState, useEffect } from 'react';
import './EscrowStatus.css';

interface EscrowHold {
  id: string;
  caseId: string;
  clientId: string;
  providerId: string;
  amount: number;
  currency: string;
  status: 'held' | 'released' | 'refunded' | 'disputed';
  releaseConditions: {
    requiresClientApproval: boolean;
    requiresProviderApproval: boolean;
    holdPeriodDays: number;
    holdUntilDate: string;
  };
  fees: {
    escrowFeeAmount: number;
    escrowFeePercentage: number;
    whoPaysFee: 'client' | 'provider' | 'platform';
  };
  paymentIntentId: string;
  transferId?: string;
  createdAt: string;
  releasedAt?: string;
  refundedAt?: string;
}

interface Dispute {
  id: string;
  escrowHoldId: string;
  initiatedBy: string;
  reason: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
}

interface EscrowStatusProps {
  caseId: string;
  userType: 'client' | 'provider' | 'admin';
  currentUserId: string;
  onStatusChange?: (status: string) => void;
}

export const EscrowStatus: React.FC<EscrowStatusProps> = ({
  caseId,
  userType,
  currentUserId,
  onStatusChange,
}) => {
  const [escrowHold, setEscrowHold] = useState<EscrowHold | null>(null);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'timeline' | 'disputes'>('details');
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showDisputeDialog, setShowDisputeDialog] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

  useEffect(() => {
    fetchEscrowData();
  }, [caseId]);

  const fetchEscrowData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v2/escrow/case/${caseId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch escrow data');
      }

      const data = await response.json();
      setEscrowHold(data.escrowHold);
      setDisputes(data.disputes || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load escrow information');
      console.error('Error fetching escrow data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRelease = async () => {
    if (!escrowHold) return;

    try {
      const response = await fetch(`/api/v2/escrow/${escrowHold.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({ userId: currentUserId }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve escrow release');
      }

      setShowApprovalDialog(false);
      fetchEscrowData();
      onStatusChange?.('approved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const handleOpenDispute = async () => {
    if (!escrowHold || !disputeReason.trim()) {
      setError('Please provide a reason for the dispute');
      return;
    }

    try {
      const response = await fetch(`/api/v2/escrow/${escrowHold.id}/dispute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          reason: disputeReason,
          initiatedBy: currentUserId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to open dispute');
      }

      setShowDisputeDialog(false);
      setDisputeReason('');
      fetchEscrowData();
      onStatusChange?.('disputed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open dispute');
    }
  };

  const getStatusBadgeClass = (status: string): string => {
    const baseClass = 'escrow-status-badge';
    switch (status) {
      case 'held':
        return `${baseClass} badge-held`;
      case 'released':
        return `${baseClass} badge-released`;
      case 'refunded':
        return `${baseClass} badge-refunded`;
      case 'disputed':
        return `${baseClass} badge-disputed`;
      default:
        return baseClass;
    }
  };

  const formatDate = (date: string): string => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDaysRemaining = (holdUntilDate: string): number => {
    const now = new Date();
    const until = new Date(holdUntilDate);
    const diff = until.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const canApproveRelease = (): boolean => {
    if (!escrowHold) return false;
    if (escrowHold.status !== 'held') return false;
    if (userType === 'client' && escrowHold.clientId === currentUserId) return true;
    if (userType === 'provider' && escrowHold.providerId === currentUserId) return true;
    if (userType === 'admin') return true;
    return false;
  };

  const canOpenDispute = (): boolean => {
    if (!escrowHold) return false;
    if (escrowHold.status !== 'held' && escrowHold.status !== 'released') return false;
    if (
      userType === 'client' && escrowHold.clientId === currentUserId
    )
      return true;
    if (userType === 'provider' && escrowHold.providerId === currentUserId)
      return true;
    return false;
  };

  if (loading) {
    return <div className="escrow-status-container loading">Loading escrow information...</div>;
  }

  if (!escrowHold) {
    return <div className="escrow-status-container empty">No escrow payment found for this case</div>;
  }

  return (
    <div className="escrow-status-container">
      {error && <div className="escrow-error-banner">{error}</div>}

      <div className="escrow-header">
        <div className="escrow-title-section">
          <h3>Escrow Payment</h3>
          <span className={getStatusBadgeClass(escrowHold.status)}>
            {escrowHold.status.charAt(0).toUpperCase() + escrowHold.status.slice(1)}
          </span>
        </div>
        <div className="escrow-amount">
          {escrowHold.currency.toUpperCase()} {escrowHold.amount.toFixed(2)}
        </div>
      </div>

      <div className="escrow-tabs">
        <button
          className={`tab-button ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          Details
        </button>
        <button
          className={`tab-button ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          Timeline
        </button>
        {disputes.length > 0 && (
          <button
            className={`tab-button ${activeTab === 'disputes' ? 'active' : ''}`}
            onClick={() => setActiveTab('disputes')}
          >
            Disputes ({disputes.length})
          </button>
        )}
      </div>

      {activeTab === 'details' && (
        <div className="escrow-details-section">
          <div className="details-grid">
            <div className="detail-item">
              <label>Amount</label>
              <div className="detail-value">
                {escrowHold.currency.toUpperCase()} {escrowHold.amount.toFixed(2)}
              </div>
            </div>

            <div className="detail-item">
              <label>Escrow Fee</label>
              <div className="detail-value">
                ${escrowHold.fees.escrowFeeAmount.toFixed(2)} (
                {escrowHold.fees.escrowFeePercentage}%)
              </div>
              <small className="fee-note">
                Paid by: {escrowHold.fees.whoPaysFee}
              </small>
            </div>

            <div className="detail-item">
              <label>Status</label>
              <div className="detail-value">
                <span className={getStatusBadgeClass(escrowHold.status)}>
                  {escrowHold.status}
                </span>
              </div>
            </div>

            <div className="detail-item">
              <label>Created</label>
              <div className="detail-value">
                {formatDate(escrowHold.createdAt)}
              </div>
            </div>

            {escrowHold.status === 'held' && (
              <div className="detail-item">
                <label>Hold Period</label>
                <div className="detail-value">
                  {getDaysRemaining(escrowHold.releaseConditions.holdUntilDate)} days
                  remaining
                </div>
                <small className="hold-note">
                  Release date: {formatDate(escrowHold.releaseConditions.holdUntilDate)}
                </small>
              </div>
            )}

            {escrowHold.releasedAt && (
              <div className="detail-item">
                <label>Released</label>
                <div className="detail-value">
                  {formatDate(escrowHold.releasedAt)}
                </div>
              </div>
            )}

            {escrowHold.refundedAt && (
              <div className="detail-item">
                <label>Refunded</label>
                <div className="detail-value">
                  {formatDate(escrowHold.refundedAt)}
                </div>
              </div>
            )}
          </div>

          {escrowHold.status === 'held' && (
            <div className="escrow-conditions-section">
              <h4>Release Conditions</h4>
              <ul className="conditions-list">
                {escrowHold.releaseConditions.requiresClientApproval && (
                  <li className="condition-item">
                    <span className="condition-icon">✓</span>
                    <span>Client approval required</span>
                  </li>
                )}
                {escrowHold.releaseConditions.requiresProviderApproval && (
                  <li className="condition-item">
                    <span className="condition-icon">✓</span>
                    <span>Provider approval required</span>
                  </li>
                )}
                <li className="condition-item">
                  <span className="condition-icon">✓</span>
                  <span>
                    {escrowHold.releaseConditions.holdPeriodDays}-day hold period
                  </span>
                </li>
              </ul>
            </div>
          )}

          {escrowHold.status === 'held' && (
            <div className="escrow-actions">
              {canApproveRelease() && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowApprovalDialog(true)}
                >
                  Approve Release
                </button>
              )}
              {canOpenDispute() && (
                <button
                  className="btn btn-danger"
                  onClick={() => setShowDisputeDialog(true)}
                >
                  Open Dispute
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="escrow-timeline-section">
          <div className="timeline">
            <div className="timeline-event">
              <div className="timeline-marker">✓</div>
              <div className="timeline-content">
                <div className="timeline-title">Escrow Created</div>
                <div className="timeline-date">{formatDate(escrowHold.createdAt)}</div>
              </div>
            </div>

            {escrowHold.status === 'released' && escrowHold.releasedAt && (
              <div className="timeline-event">
                <div className="timeline-marker success">✓</div>
                <div className="timeline-content">
                  <div className="timeline-title">Funds Released</div>
                  <div className="timeline-date">
                    {formatDate(escrowHold.releasedAt)}
                  </div>
                </div>
              </div>
            )}

            {escrowHold.status === 'refunded' && escrowHold.refundedAt && (
              <div className="timeline-event">
                <div className="timeline-marker warning">↶</div>
                <div className="timeline-content">
                  <div className="timeline-title">Refund Processed</div>
                  <div className="timeline-date">
                    {formatDate(escrowHold.refundedAt)}
                  </div>
                </div>
              </div>
            )}

            {escrowHold.status === 'disputed' && (
              <div className="timeline-event">
                <div className="timeline-marker danger">⚠</div>
                <div className="timeline-content">
                  <div className="timeline-title">Dispute Opened</div>
                  <div className="timeline-date">
                    {disputes.length > 0 && formatDate(disputes[0].createdAt)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'disputes' && disputes.length > 0 && (
        <div className="escrow-disputes-section">
          {disputes.map((dispute) => (
            <div key={dispute.id} className="dispute-card">
              <div className="dispute-header">
                <h4>Dispute</h4>
                <span className={`dispute-status status-${dispute.status}`}>
                  {dispute.status}
                </span>
              </div>
              <div className="dispute-details">
                <div className="dispute-reason">
                  <label>Reason</label>
                  <p>{dispute.reason}</p>
                </div>
                <div className="dispute-dates">
                  <div>
                    <label>Opened</label>
                    <div>{formatDate(dispute.createdAt)}</div>
                  </div>
                  {dispute.resolvedAt && (
                    <div>
                      <label>Resolved</label>
                      <div>{formatDate(dispute.resolvedAt)}</div>
                    </div>
                  )}
                </div>
                {dispute.resolution && (
                  <div className="dispute-resolution">
                    <label>Resolution</label>
                    <p>{dispute.resolution}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showApprovalDialog && (
        <div className="modal-overlay" onClick={() => setShowApprovalDialog(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Approve Escrow Release</h3>
            <p>
              Are you sure you want to approve the release of{' '}
              <strong>
                {escrowHold.currency.toUpperCase()} {escrowHold.amount.toFixed(2)}
              </strong>
              ?
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowApprovalDialog(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleApproveRelease}>
                Approve Release
              </button>
            </div>
          </div>
        </div>
      )}

      {showDisputeDialog && (
        <div className="modal-overlay" onClick={() => setShowDisputeDialog(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Open Dispute</h3>
            <p>Please describe the reason for this dispute:</p>
            <textarea
              className="dispute-textarea"
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Enter dispute reason..."
              rows={4}
            />
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowDisputeDialog(false)}
              >
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleOpenDispute}>
                Open Dispute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EscrowStatus;
