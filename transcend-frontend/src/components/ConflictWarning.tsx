import React, { useState, useEffect } from 'react';
import './ConflictWarning.css';

// ============================================
// TYPES
// ============================================

interface ConflictDetail {
  type: string;
  severity: string;
  description: string;
  source?: string;
  resolutionPath?: string;
}

interface ConflictMatch {
  id: string;
  attorneyId: string;
  clientId: string;
  conflictCheckId: string;
  matchType: 'blocked' | 'flagged-for-review' | 'pending-appeal';
  conflictDetails: ConflictDetail[];
  blockReason: string;
  blockedAt: Date;
  blocksUntil?: Date;
}

interface ConflictWarningProps {
  attorneyId?: string;
  clientId?: string;
  onConflictDetected?: (conflict: ConflictMatch) => void;
  onConflictResolved?: () => void;
  compact?: boolean;
  isAdmin?: boolean;
}

interface ConflictAppeal {
  reason: string;
  documents: File[];
  additionalInfo: string;
}

// ============================================
// CONFLICT WARNING COMPONENT
// ============================================

export const ConflictWarning: React.FC<ConflictWarningProps> = ({
  attorneyId,
  clientId,
  onConflictDetected,
  onConflictResolved,
  compact = false,
  isAdmin = false,
}) => {
  const [conflict, setConflict] = useState<ConflictMatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(!compact);
  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealData, setAppealData] = useState<ConflictAppeal>({
    reason: '',
    documents: [],
    additionalInfo: '',
  });
  const [submittingAppeal, setSubmittingAppeal] = useState(false);
  const [appealSubmitted, setAppealSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (attorneyId && clientId) {
      checkConflict();
    }
  }, [attorneyId, clientId]);

  const checkConflict = async () => {
    if (!attorneyId || !clientId) return;

    try {
      setLoading(true);
      const response = await fetch(
        `/api/conflicts/check/${attorneyId}/${clientId}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data) {
          setConflict(data);
          onConflictDetected?.(data);
        } else {
          setConflict(null);
          onConflictResolved?.();
        }
      } else if (response.status === 404) {
        setConflict(null);
        onConflictResolved?.();
      } else {
        setError('Failed to check conflicts');
      }
    } catch (err) {
      console.error('Error checking conflicts:', err);
      setError('Error checking conflicts');
    } finally {
      setLoading(false);
    }
  };

  const handleAppealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!conflict || !appealData.reason.trim()) {
      setError('Please provide a reason for the appeal');
      return;
    }

    try {
      setSubmittingAppeal(true);
      setError(null);

      // Upload documents if any
      let documentUrls: string[] = [];
      if (appealData.documents.length > 0) {
        const formData = new FormData();
        appealData.documents.forEach((doc) => {
          formData.append('documents', doc);
        });

        const uploadResponse = await fetch('/api/conflicts/upload-documents', {
          method: 'POST',
          body: formData,
        });

        if (uploadResponse.ok) {
          const { urls } = await uploadResponse.json();
          documentUrls = urls;
        }
      }

      // Submit appeal
      const response = await fetch(`/api/conflicts/${conflict.id}/appeal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: appealData.reason,
          documents: documentUrls,
          additionalInfo: appealData.additionalInfo,
        }),
      });

      if (response.ok) {
        setAppealSubmitted(true);
        setShowAppealForm(false);
        setAppealData({ reason: '', documents: [], additionalInfo: '' });

        // Refresh conflict status
        setTimeout(() => {
          checkConflict();
        }, 1000);
      } else {
        setError('Failed to submit appeal');
      }
    } catch (err) {
      console.error('Error submitting appeal:', err);
      setError('Error submitting appeal');
    } finally {
      setSubmittingAppeal(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAppealData({
        ...appealData,
        documents: Array.from(e.target.files),
      });
    }
  };

  const getSeverityClass = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return 'severity-critical';
      case 'high':
        return 'severity-high';
      case 'medium':
        return 'severity-medium';
      case 'low':
        return 'severity-low';
      default:
        return 'severity-none';
    }
  };

  const getConflictTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      opposing_counsel: 'Opposing Counsel Conflict',
      prior_representation: 'Prior Representation',
      family_connection: 'Family Connection',
      disqualifying_relationship: 'Disqualifying Relationship',
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="conflict-warning conflict-loading">
        <div className="loading-spinner"></div>
        <p>Checking for conflicts...</p>
      </div>
    );
  }

  if (!conflict) {
    return (
      <div className="conflict-warning conflict-clear">
        <div className="conflict-header">
          <svg
            className="conflict-icon icon-clear"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <h3>No Conflicts Detected</h3>
        </div>
        <p className="conflict-clear-message">
          This attorney-client match has been cleared for engagement.
        </p>
      </div>
    );
  }

  const isCritical =
    conflict.matchType === 'blocked' ||
    conflict.conflictDetails.some((c) => c.severity === 'critical');
  const isBlocked = conflict.matchType === 'blocked';
  const isPendingAppeal = conflict.matchType === 'pending-appeal';

  return (
    <div className={`conflict-warning ${getSeverityClass(conflict.matchType)}`}>
      <div className="conflict-alert">
        <div className="conflict-header">
          <svg
            className={`conflict-icon ${isCritical ? 'icon-alert' : 'icon-warning'}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            {isCritical ? (
              <>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </>
            ) : (
              <>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05l-8.47-14.14a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </>
            )}
          </svg>
          <div className="conflict-title-section">
            <h3 className="conflict-title">
              {isBlocked
                ? 'Match Blocked'
                : isPendingAppeal
                  ? 'Appeal Pending'
                  : 'Conflict Flagged for Review'}
            </h3>
            <p className="conflict-subtitle">
              {conflict.blockReason}
            </p>
          </div>
          <button
            className="conflict-expand-btn"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polyline
                points={expanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}
              />
            </svg>
          </button>
        </div>

        {expanded && (
          <div className="conflict-details">
            <div className="conflict-list">
              {conflict.conflictDetails.map((detail, idx) => (
                <div
                  key={idx}
                  className={`conflict-item ${getSeverityClass(detail.severity)}`}
                >
                  <div className="conflict-item-header">
                    <span className="conflict-type-label">
                      {getConflictTypeLabel(detail.type)}
                    </span>
                    <span className={`conflict-severity-badge ${detail.severity}`}>
                      {detail.severity.toUpperCase()}
                    </span>
                  </div>
                  <p className="conflict-description">{detail.description}</p>
                  {detail.resolutionPath && (
                    <p className="conflict-resolution">
                      Resolution path: {detail.resolutionPath}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="conflict-timeline">
              <div className="timeline-item">
                <span className="timeline-label">Blocked at:</span>
                <span className="timeline-value">
                  {new Date(conflict.blockedAt).toLocaleDateString()}
                </span>
              </div>
              {conflict.blocksUntil && (
                <div className="timeline-item">
                  <span className="timeline-label">Expires:</span>
                  <span className="timeline-value">
                    {new Date(conflict.blocksUntil).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {!isPendingAppeal && (
              <div className="conflict-actions">
                {isAdmin && (
                  <button
                    className="btn btn-primary btn-override"
                    onClick={() => {
                      /* Admin override logic */
                    }}
                  >
                    Admin Override
                  </button>
                )}

                <button
                  className="btn btn-secondary btn-appeal"
                  onClick={() => setShowAppealForm(!showAppealForm)}
                >
                  {showAppealForm ? 'Cancel Appeal' : 'Submit Appeal'}
                </button>
              </div>
            )}

            {isPendingAppeal && (
              <div className="conflict-appeal-pending">
                <p>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    className="icon-info"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  Your appeal is currently under review. You'll be notified once a
                  decision is made.
                </p>
              </div>
            )}

            {showAppealForm && !isPendingAppeal && (
              <form onSubmit={handleAppealSubmit} className="conflict-appeal-form">
                <div className="form-group">
                  <label htmlFor="appeal-reason">Appeal Reason *</label>
                  <textarea
                    id="appeal-reason"
                    value={appealData.reason}
                    onChange={(e) =>
                      setAppealData({ ...appealData, reason: e.target.value })
                    }
                    placeholder="Explain why this conflict should be waived or resolved..."
                    rows={4}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="appeal-documents">Supporting Documents</label>
                  <input
                    id="appeal-documents"
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="form-input"
                  />
                  {appealData.documents.length > 0 && (
                    <div className="document-list">
                      {appealData.documents.map((doc, idx) => (
                        <div key={idx} className="document-item">
                          <span>{doc.name}</span>
                          <span className="doc-size">
                            ({(doc.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="appeal-info">Additional Information</label>
                  <textarea
                    id="appeal-info"
                    value={appealData.additionalInfo}
                    onChange={(e) =>
                      setAppealData({ ...appealData, additionalInfo: e.target.value })
                    }
                    placeholder="Any additional context or information..."
                    rows={3}
                  />
                </div>

                {error && <div className="form-error">{error}</div>}

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowAppealForm(false)}
                    disabled={submittingAppeal}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submittingAppeal}
                  >
                    {submittingAppeal ? 'Submitting...' : 'Submit Appeal'}
                  </button>
                </div>
              </form>
            )}

            {appealSubmitted && (
              <div className="appeal-success-message">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  className="icon-success"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <p>Your appeal has been submitted successfully.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConflictWarning;
