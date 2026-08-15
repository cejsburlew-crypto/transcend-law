// Quota Display Component
// Shows user's API quota usage with visual feedback and alerts

import React, { useEffect, useState } from 'react';
import './QuotaDisplay.css';

interface QuotaStatus {
  userId: string;
  plan: string;
  requestsInWindow: number;
  limitPerWindow: number;
  dailyRequests: number;
  limitPerDay: number;
  usage: number;
  windowReset: number;
  isExceeded: boolean;
  isWarning: boolean;
  isAdmin: boolean;
  adminOverride: boolean;
}

interface QuotaDisplayProps {
  quotaStatus?: QuotaStatus;
  onQuotaExceeded?: () => void;
  showDetails?: boolean;
  compact?: boolean;
}

const QuotaDisplay: React.FC<QuotaDisplayProps> = ({
  quotaStatus,
  onQuotaExceeded,
  showDetails = false,
  compact = false,
}) => {
  const [resetCountdown, setResetCountdown] = useState<string>('');
  const [loadingQuota, setLoadingQuota] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch quota status on mount and periodically
  const fetchQuotaStatus = React.useCallback(async () => {
    try {
      setLoadingQuota(true);
      const response = await fetch('/api/v2/quota/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Update parent component's quota status
        if (data.status?.isExceeded && onQuotaExceeded) {
          onQuotaExceeded();
        }
      }
    } catch (err) {
      setError('Failed to fetch quota status');
      console.error('Quota fetch error:', err);
    } finally {
      setLoadingQuota(false);
    }
  }, [onQuotaExceeded]);

  // Update countdown timer
  useEffect(() => {
    if (!quotaStatus) return;

    const updateCountdown = () => {
      const now = Date.now();
      const resetTime = quotaStatus.windowReset;
      const diff = Math.max(0, resetTime - now);

      if (diff === 0) {
        setResetCountdown('Resetting now...');
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      setResetCountdown(`${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [quotaStatus]);

  // Refetch quota periodically
  useEffect(() => {
    fetchQuotaStatus();
    const interval = setInterval(fetchQuotaStatus, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [fetchQuotaStatus]);

  if (!quotaStatus) {
    return <div className="quota-display quota-loading">Loading quota information...</div>;
  }

  const progressPercentage = Math.min(100, quotaStatus.usage);
  const planDisplayName = quotaStatus.plan.charAt(0).toUpperCase() + quotaStatus.plan.slice(1);

  // Determine status class
  let statusClass = 'quota-status-ok';
  if (quotaStatus.isExceeded) {
    statusClass = 'quota-status-exceeded';
  } else if (quotaStatus.isWarning) {
    statusClass = 'quota-status-warning';
  }

  if (compact) {
    return (
      <div className={`quota-display quota-compact ${statusClass}`}>
        <div className="quota-compact-content">
          <span className="quota-label">{quotaStatus.requestsInWindow}/{quotaStatus.limitPerWindow}</span>
          <div className="quota-mini-bar">
            <div
              className="quota-mini-fill"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          {quotaStatus.isExceeded && (
            <span className="quota-alert-badge">Limit Reached</span>
          )}
          {quotaStatus.isWarning && (
            <span className="quota-warning-badge">Warning</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`quota-display ${statusClass}`}>
      <div className="quota-header">
        <h3 className="quota-title">API Quota</h3>
        <span className={`quota-plan-badge ${quotaStatus.plan}`}>{planDisplayName} Plan</span>
      </div>

      {quotaStatus.isAdmin && quotaStatus.adminOverride && (
        <div className="quota-admin-notice">
          Admin override active - quota limits bypassed
        </div>
      )}

      <div className="quota-main">
        <div className="quota-content">
          <div className="quota-section">
            <div className="quota-label">Per Minute</div>
            <div className="quota-value">
              {quotaStatus.requestsInWindow}/{quotaStatus.limitPerWindow}
            </div>
          </div>

          <div className="quota-section">
            <div className="quota-label">Per Day</div>
            <div className="quota-value">
              {quotaStatus.dailyRequests}/{quotaStatus.limitPerDay}
            </div>
          </div>

          <div className="quota-section">
            <div className="quota-label">Usage</div>
            <div className={`quota-percentage ${statusClass}`}>
              {quotaStatus.usage}%
            </div>
          </div>
        </div>

        <div className="quota-progress">
          <div className="quota-bar-container">
            <div
              className={`quota-bar-fill ${statusClass}`}
              style={{ width: `${progressPercentage}%` }}
            />
            {quotaStatus.usage >= 50 && (
              <span className="quota-percentage-label">{quotaStatus.usage}%</span>
            )}
          </div>
        </div>

        {quotaStatus.isWarning && (
          <div className="quota-alert warning">
            <svg className="alert-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            <div className="alert-content">
              <div className="alert-title">Approaching Quota Limit</div>
              <div className="alert-message">
                You're using {quotaStatus.usage}% of your available quota. Resets in {resetCountdown}
              </div>
            </div>
          </div>
        )}

        {quotaStatus.isExceeded && (
          <div className="quota-alert error">
            <svg className="alert-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
            </svg>
            <div className="alert-content">
              <div className="alert-title">Quota Limit Exceeded</div>
              <div className="alert-message">
                You've reached your quota limit. Upgrade your plan or wait for reset in {resetCountdown}
              </div>
              <a href="/upgrade" className="alert-action">Upgrade Plan</a>
            </div>
          </div>
        )}
      </div>

      {showDetails && (
        <div className="quota-details">
          <div className="details-item">
            <span className="details-label">Plan Type:</span>
            <span className="details-value">{planDisplayName}</span>
          </div>
          <div className="details-item">
            <span className="details-label">Minutes Per Window:</span>
            <span className="details-value">{quotaStatus.limitPerWindow}</span>
          </div>
          <div className="details-item">
            <span className="details-label">Daily Limit:</span>
            <span className="details-value">{quotaStatus.limitPerDay}</span>
          </div>
          <div className="details-item">
            <span className="details-label">Reset Time:</span>
            <span className="details-value">{new Date(quotaStatus.windowReset).toLocaleTimeString()}</span>
          </div>
          <div className="details-item">
            <span className="details-label">Remaining Time:</span>
            <span className="details-value">{resetCountdown}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="quota-error">
          <span>{error}</span>
          <button onClick={fetchQuotaStatus} className="retry-button">
            Retry
          </button>
        </div>
      )}

      {loadingQuota && (
        <div className="quota-loading-spinner">
          <div className="spinner"></div>
        </div>
      )}
    </div>
  );
};

export default QuotaDisplay;
