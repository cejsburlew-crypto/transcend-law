// OfflineIndicator Component
// Shows offline status and sync information

import React, { useEffect, useState } from 'react';
import { useOfflineStorage } from '../hooks/useOfflineStorage';
import '../styles/OfflineIndicator.css';

interface OfflineIndicatorProps {
  position?: 'top' | 'bottom';
  autoHide?: boolean;
  autoHideDelay?: number;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  position = 'top',
  autoHide = true,
  autoHideDelay = 5000
}) => {
  const { isOnline, isSyncing, pendingOperations, cacheStats } = useOfflineStorage();
  const [showIndicator, setShowIndicator] = useState(!isOnline);
  const [showSync, setShowSync] = useState(false);

  // Show indicator when offline
  useEffect(() => {
    if (!isOnline) {
      setShowIndicator(true);
      setShowSync(false);
    } else if (autoHide) {
      const timer = setTimeout(() => {
        setShowIndicator(false);
      }, autoHideDelay);
      return () => clearTimeout(timer);
    }
  }, [isOnline, autoHide, autoHideDelay]);

  // Show sync status
  useEffect(() => {
    if (isSyncing) {
      setShowSync(true);
    }
  }, [isSyncing]);

  const hasPendingOperations = pendingOperations.length > 0;

  if (!showIndicator && !isSyncing) {
    return null;
  }

  return (
    <div className={`offline-indicator offline-indicator--${position}`}>
      {!isOnline && (
        <div className="offline-indicator__content offline-indicator__content--offline">
          <div className="offline-indicator__icon">
            <span className="icon-offline">📡</span>
          </div>
          <div className="offline-indicator__text">
            <span className="offline-indicator__title">You're offline</span>
            {hasPendingOperations && (
              <span className="offline-indicator__subtitle">
                {pendingOperations.length} operation{pendingOperations.length !== 1 ? 's' : ''} waiting to sync
              </span>
            )}
          </div>
          <button
            className="offline-indicator__close"
            onClick={() => setShowIndicator(false)}
            aria-label="Close offline indicator"
          >
            ✕
          </button>
        </div>
      )}

      {isSyncing && showSync && (
        <div className="offline-indicator__content offline-indicator__content--syncing">
          <div className="offline-indicator__icon">
            <span className="spinner">⟳</span>
          </div>
          <div className="offline-indicator__text">
            <span className="offline-indicator__title">Syncing</span>
            <span className="offline-indicator__subtitle">Uploading {pendingOperations.length} pending changes...</span>
          </div>
        </div>
      )}

      {isOnline && !isSyncing && showSync && (
        <div className="offline-indicator__content offline-indicator__content--synced">
          <div className="offline-indicator__icon">
            <span className="icon-success">✓</span>
          </div>
          <div className="offline-indicator__text">
            <span className="offline-indicator__title">All changes synced</span>
          </div>
        </div>
      )}

      <div className="offline-indicator__stats">
        {cacheStats.entries > 0 && (
          <span className="offline-indicator__stat">
            📦 {cacheStats.entries} cached item{cacheStats.entries !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
};

export default OfflineIndicator;
