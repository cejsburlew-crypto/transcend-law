// Fraud Alert Component
// Displays real-time fraud detection alerts, risk scores, and admin override interface

import React, { useState, useEffect } from 'react';
import './FraudAlert.css';

interface AnomalyDetection {
  type: 'velocity' | 'geographical' | 'behavioral' | 'pattern';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: Record<string, any>;
  score: number;
}

interface FraudAlertData {
  id: string;
  transactionId: string;
  userId: string;
  alertType: 'fraud_detected' | 'manual_review' | 'override_approved' | 'override_denied';
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'acknowledged' | 'investigating' | 'resolved' | 'false_positive';
  detectedAnomalies?: AnomalyDetection[];
  recommendedActions?: string[];
  timestamp: string;
  resolvedAt?: string;
  resolution?: 'fraud_confirmed' | 'legitimate' | 'unable_to_verify';
  confidence?: number;
}

interface FraudAlertProps {
  alert?: FraudAlertData;
  isAdmin?: boolean;
  onDismiss?: () => void;
  onUpdateStatus?: (status: string, resolution?: string) => void;
  onAdminOverride?: (action: 'allow' | 'block', reason: string) => void;
}

export const FraudAlert: React.FC<FraudAlertProps> = ({
  alert,
  isAdmin = false,
  onDismiss,
  onUpdateStatus,
  onAdminOverride,
}) => {
  const [expandedAnomaly, setExpandedAnomaly] = useState<string | null>(null);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [overrideAction, setOverrideAction] = useState<'allow' | 'block'>('allow');
  const [overrideReason, setOverrideReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!alert) return null;

  const getRiskScoreColor = (score: number): string => {
    if (score >= 80) return '#d32f2f'; // red
    if (score >= 60) return '#f57c00'; // orange
    if (score >= 40) return '#fbc02d'; // yellow
    return '#388e3c'; // green
  };

  const getRiskLevelIcon = (level: string): string => {
    switch (level) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      case 'low': return 'ℹ️';
      default: return '❓';
    }
  };

  const handleAcknowledge = async () => {
    if (onUpdateStatus) {
      try {
        setIsLoading(true);
        await onUpdateStatus('acknowledged');
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to acknowledge alert');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleMarkLegitimate = async () => {
    if (onUpdateStatus) {
      try {
        setIsLoading(true);
        await onUpdateStatus('resolved', 'legitimate');
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to mark as legitimate');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSubmitOverride = async () => {
    if (!overrideReason.trim()) {
      setError('Please provide a reason for the override');
      return;
    }

    if (onAdminOverride) {
      try {
        setIsLoading(true);
        await onAdminOverride(overrideAction, overrideReason);
        setShowOverrideDialog(false);
        setOverrideReason('');
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to apply override');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const isBlocked = alert.riskLevel === 'critical' || alert.riskLevel === 'high';

  return (
    <div className={`fraud-alert fraud-alert--${alert.riskLevel}`}>
      {/* Header */}
      <div className="fraud-alert__header">
        <div className="fraud-alert__title-group">
          <span className="fraud-alert__icon">
            {getRiskLevelIcon(alert.riskLevel)}
          </span>
          <div>
            <h3 className="fraud-alert__title">
              Fraud Detection Alert
              {isBlocked && <span className="fraud-alert__badge">BLOCKED</span>}
            </h3>
            <p className="fraud-alert__timestamp">
              {new Date(alert.timestamp).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Risk Score */}
        <div className="fraud-alert__score">
          <div
            className="fraud-alert__score-circle"
            style={{ borderColor: getRiskScoreColor(alert.riskScore) }}
          >
            <div className="fraud-alert__score-text">
              <span className="fraud-alert__score-value">{alert.riskScore}</span>
              <span className="fraud-alert__score-label">risk</span>
            </div>
          </div>
          {alert.confidence && (
            <p className="fraud-alert__confidence">
              {alert.confidence}% confidence
            </p>
          )}
        </div>

        {/* Close button */}
        {onDismiss && (
          <button
            className="fraud-alert__close"
            onClick={onDismiss}
            aria-label="Close alert"
          >
            ✕
          </button>
        )}
      </div>

      {/* Status Info */}
      <div className="fraud-alert__status">
        <span className={`fraud-alert__status-badge fraud-alert__status-badge--${alert.status}`}>
          {alert.status.replace(/_/g, ' ').toUpperCase()}
        </span>
        {alert.riskLevel && (
          <span className={`fraud-alert__level-badge fraud-alert__level-badge--${alert.riskLevel}`}>
            {alert.riskLevel.toUpperCase()} RISK
          </span>
        )}
      </div>

      {/* Detected Anomalies */}
      {alert.detectedAnomalies && alert.detectedAnomalies.length > 0 && (
        <div className="fraud-alert__anomalies">
          <h4 className="fraud-alert__section-title">
            Detected Anomalies ({alert.detectedAnomalies.length})
          </h4>
          <div className="fraud-alert__anomalies-list">
            {alert.detectedAnomalies.map((anomaly, index) => (
              <div
                key={index}
                className={`fraud-alert__anomaly fraud-alert__anomaly--${anomaly.severity}`}
              >
                <button
                  className="fraud-alert__anomaly-header"
                  onClick={() => setExpandedAnomaly(expandedAnomaly === `${index}` ? null : `${index}`)}
                >
                  <span className="fraud-alert__anomaly-type">
                    {anomaly.type.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <span className={`fraud-alert__anomaly-severity fraud-alert__anomaly-severity--${anomaly.severity}`}>
                    {anomaly.severity.toUpperCase()}
                  </span>
                  <span className="fraud-alert__anomaly-score">
                    Score: {anomaly.score}
                  </span>
                  <span className="fraud-alert__expand-icon">
                    {expandedAnomaly === `${index}` ? '▼' : '▶'}
                  </span>
                </button>

                {expandedAnomaly === `${index}` && (
                  <div className="fraud-alert__anomaly-details">
                    <p className="fraud-alert__anomaly-description">
                      {anomaly.description}
                    </p>
                    {Object.keys(anomaly.evidence).length > 0 && (
                      <div className="fraud-alert__evidence">
                        <h5>Evidence:</h5>
                        <ul className="fraud-alert__evidence-list">
                          {Object.entries(anomaly.evidence).map(([key, value]) => (
                            <li key={key}>
                              <span className="fraud-alert__evidence-key">
                                {key.replace(/_/g, ' ')}:
                              </span>
                              <span className="fraud-alert__evidence-value">
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Actions */}
      {alert.recommendedActions && alert.recommendedActions.length > 0 && (
        <div className="fraud-alert__actions-section">
          <h4 className="fraud-alert__section-title">Recommended Actions</h4>
          <ul className="fraud-alert__recommended-actions">
            {alert.recommendedActions.map((action, index) => (
              <li key={index} className="fraud-alert__action-item">
                ✓ {action}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="fraud-alert__error">
          <p>{error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="fraud-alert__buttons">
        {alert.status === 'open' && (
          <>
            <button
              className="fraud-alert__button fraud-alert__button--acknowledge"
              onClick={handleAcknowledge}
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : 'Acknowledge Alert'}
            </button>

            <button
              className="fraud-alert__button fraud-alert__button--legitimate"
              onClick={handleMarkLegitimate}
              disabled={isLoading}
            >
              Mark as Legitimate
            </button>

            {isAdmin && (
              <button
                className="fraud-alert__button fraud-alert__button--override"
                onClick={() => setShowOverrideDialog(true)}
                disabled={isLoading}
              >
                Admin Override
              </button>
            )}
          </>
        )}

        {onDismiss && alert.status !== 'open' && (
          <button
            className="fraud-alert__button fraud-alert__button--dismiss"
            onClick={onDismiss}
          >
            Dismiss
          </button>
        )}
      </div>

      {/* Admin Override Dialog */}
      {isAdmin && showOverrideDialog && (
        <div className="fraud-alert__modal-overlay">
          <div className="fraud-alert__modal">
            <h3>Admin Override</h3>
            <p className="fraud-alert__modal-warning">
              This action will override the fraud detection system. Use with caution.
            </p>

            <div className="fraud-alert__modal-form">
              <div className="fraud-alert__form-group">
                <label htmlFor="override-action" className="fraud-alert__label">
                  Action:
                </label>
                <div className="fraud-alert__radio-group">
                  <label className="fraud-alert__radio-label">
                    <input
                      type="radio"
                      name="override-action"
                      value="allow"
                      checked={overrideAction === 'allow'}
                      onChange={(e) => setOverrideAction(e.target.value as 'allow')}
                    />
                    Allow Transaction
                  </label>
                  <label className="fraud-alert__radio-label">
                    <input
                      type="radio"
                      name="override-action"
                      value="block"
                      checked={overrideAction === 'block'}
                      onChange={(e) => setOverrideAction(e.target.value as 'block')}
                    />
                    Block Transaction
                  </label>
                </div>
              </div>

              <div className="fraud-alert__form-group">
                <label htmlFor="override-reason" className="fraud-alert__label">
                  Reason (Required):
                </label>
                <textarea
                  id="override-reason"
                  className="fraud-alert__textarea"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Provide detailed reason for this override..."
                  rows={4}
                />
              </div>

              <div className="fraud-alert__modal-buttons">
                <button
                  className="fraud-alert__button fraud-alert__button--cancel"
                  onClick={() => setShowOverrideDialog(false)}
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  className="fraud-alert__button fraud-alert__button--submit"
                  onClick={handleSubmitOverride}
                  disabled={isLoading || !overrideReason.trim()}
                >
                  {isLoading ? 'Processing...' : 'Submit Override'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Fraud Alerts Dashboard - Display multiple alerts
 */
export const FraudAlertsDashboard: React.FC<{
  alerts: FraudAlertData[];
  isAdmin?: boolean;
  onUpdateAlert?: (alertId: string, status: string, resolution?: string) => void;
}> = ({ alerts, isAdmin = false, onUpdateAlert }) => {
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved' | 'critical'>('all');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const filteredAlerts = alerts.filter(alert => {
    if (dismissed.has(alert.id)) return false;
    if (filter === 'open') return alert.status === 'open';
    if (filter === 'resolved') return alert.status === 'resolved';
    if (filter === 'critical') return alert.riskLevel === 'critical' || alert.riskLevel === 'high';
    return true;
  });

  const criticalCount = alerts.filter(a => a.riskLevel === 'critical').length;
  const openCount = alerts.filter(a => a.status === 'open').length;

  return (
    <div className="fraud-alerts-dashboard">
      <div className="fraud-alerts-dashboard__header">
        <h2>Fraud Detection Alerts</h2>
        <div className="fraud-alerts-dashboard__stats">
          {criticalCount > 0 && (
            <div className="fraud-alerts-dashboard__stat fraud-alerts-dashboard__stat--critical">
              <span className="fraud-alerts-dashboard__stat-value">{criticalCount}</span>
              <span className="fraud-alerts-dashboard__stat-label">Critical</span>
            </div>
          )}
          {openCount > 0 && (
            <div className="fraud-alerts-dashboard__stat fraud-alerts-dashboard__stat--open">
              <span className="fraud-alerts-dashboard__stat-value">{openCount}</span>
              <span className="fraud-alerts-dashboard__stat-label">Open</span>
            </div>
          )}
        </div>
      </div>

      <div className="fraud-alerts-dashboard__filters">
        {(['all', 'open', 'resolved', 'critical'] as const).map(f => (
          <button
            key={f}
            className={`fraud-alerts-dashboard__filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="fraud-alerts-dashboard__list">
        {filteredAlerts.length === 0 ? (
          <div className="fraud-alerts-dashboard__empty">
            <p>No alerts to display</p>
          </div>
        ) : (
          filteredAlerts.map(alert => (
            <FraudAlert
              key={alert.id}
              alert={alert}
              isAdmin={isAdmin}
              onDismiss={() => setDismissed(new Set([...dismissed, alert.id]))}
              onUpdateStatus={(status, resolution) => {
                if (onUpdateAlert) {
                  onUpdateAlert(alert.id, status, resolution);
                }
              }}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default FraudAlert;
