// Deprecation Warning Component
// Features: UI warnings, migration guides, auto-redirect, acknowledgment tracking, timeline display

import React, { useState, useEffect, useCallback } from 'react';
import './DeprecationWarning.css';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface DeprecationWarningProps {
  featureId: string;
  featureName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  replacementFeature?: string;
  replacementPath?: string;
  migrationGuideUrl?: string;
  daysUntilDisabled?: number;
  daysUntilRemoved?: number;
  breakingChanges?: string[];
  onAcknowledge?: (warningId: string) => void;
  onMigrate?: (fromFeature: string, toFeature: string) => void;
  showMigrationGuide?: boolean;
  autoHideDays?: number;
  persistent?: boolean;
}

export interface MigrationGuideProps {
  featureName: string;
  replacementFeature?: string;
  replacementPath?: string;
  migrationGuideUrl?: string;
  breakingChanges?: string[];
  onClose?: () => void;
}

export interface TimelineProps {
  announcedDate: Date;
  disabledDate?: Date;
  endOfLifeDate: Date;
  removalDate?: Date;
  currentStatus: 'announced' | 'active' | 'disabled' | 'removed';
}

export interface MigrationProgressProps {
  totalFeatures: number;
  completedMigrations: number;
  inProgressMigrations: number;
  failedMigrations: number;
  estimatedCompletionDate: Date;
}

// ============================================
// DEPRECATION WARNING BANNER
// ============================================

export const DeprecationBanner: React.FC<DeprecationWarningProps> = ({
  featureId,
  featureName,
  severity,
  message,
  replacementFeature,
  replacementPath,
  migrationGuideUrl,
  daysUntilDisabled,
  daysUntilRemoved,
  breakingChanges,
  onAcknowledge,
  onMigrate,
  showMigrationGuide = false,
  autoHideDays = 7,
  persistent = false,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [showGuide, setShowGuide] = useState(showMigrationGuide);
  const [acknowledged, setAcknowledged] = useState(false);
  const [hideUntil, setHideUntil] = useState<Date | null>(null);

  // Auto-hide functionality
  useEffect(() => {
    if (hideUntil && new Date() < hideUntil) {
      setIsVisible(false);
      return;
    }

    const timer = setTimeout(() => {
      if (!persistent) {
        setIsVisible(false);
      }
    }, autoHideDays * 24 * 60 * 60 * 1000);

    return () => clearTimeout(timer);
  }, [autoHideDays, persistent, hideUntil]);

  const handleAcknowledge = useCallback(() => {
    setAcknowledged(true);
    if (onAcknowledge) {
      onAcknowledge(featureId);
    }
  }, [featureId, onAcknowledge]);

  const handleHideForDays = useCallback((days: number) => {
    const hideDate = new Date();
    hideDate.setDate(hideDate.getDate() + days);
    setHideUntil(hideDate);
    setIsVisible(false);
  }, []);

  const handleMigrate = useCallback(() => {
    if (onMigrate && replacementFeature) {
      onMigrate(featureName, replacementFeature);
    }
  }, [featureName, replacementFeature, onMigrate]);

  const getSeverityClass = (sev: string) => {
    const classes: Record<string, string> = {
      low: 'deprecation-banner--low',
      medium: 'deprecation-banner--medium',
      high: 'deprecation-banner--high',
      critical: 'deprecation-banner--critical',
    };
    return classes[sev] || 'deprecation-banner--medium';
  };

  const getSeverityIcon = (sev: string) => {
    const icons: Record<string, string> = {
      low: '📋',
      medium: '⚠️',
      high: '🔴',
      critical: '🛑',
    };
    return icons[sev] || '⚠️';
  };

  if (!isVisible) {
    return null;
  }

  return (
    <>
      <div className={`deprecation-banner ${getSeverityClass(severity)} ${acknowledged ? 'acknowledged' : ''}`} role="alert">
        <div className="deprecation-banner__header">
          <span className="deprecation-banner__icon">{getSeverityIcon(severity)}</span>
          <span className="deprecation-banner__title">Feature Deprecation Notice</span>
          <button
            className="deprecation-banner__close"
            onClick={() => setIsVisible(false)}
            aria-label="Close warning"
          >
            ✕
          </button>
        </div>

        <div className="deprecation-banner__content">
          <p className="deprecation-banner__message">{message}</p>

          {daysUntilDisabled && (
            <div className="deprecation-banner__timeline">
              <span className="deprecation-banner__badge">
                ⏰ Disabled in {daysUntilDisabled} days
              </span>
              {daysUntilRemoved && (
                <span className="deprecation-banner__badge badge-secondary">
                  🗑️ Removed in {daysUntilRemoved} days
                </span>
              )}
            </div>
          )}

          {breakingChanges && breakingChanges.length > 0 && (
            <details className="deprecation-banner__breaking-changes">
              <summary>Breaking Changes ({breakingChanges.length})</summary>
              <ul>
                {breakingChanges.map((change, idx) => (
                  <li key={idx}>{change}</li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <div className="deprecation-banner__actions">
          <button
            className="deprecation-banner__btn deprecation-banner__btn--primary"
            onClick={() => setShowGuide(true)}
          >
            Migration Guide
          </button>

          {replacementPath && (
            <button
              className="deprecation-banner__btn deprecation-banner__btn--secondary"
              onClick={() => window.location.href = replacementPath}
            >
              Go to New Feature
            </button>
          )}

          {migrationGuideUrl && (
            <a
              href={migrationGuideUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="deprecation-banner__btn deprecation-banner__btn--link"
            >
              Learn More ↗
            </a>
          )}

          <div className="deprecation-banner__actions-secondary">
            <button
              className="deprecation-banner__btn-dismiss"
              onClick={handleAcknowledge}
            >
              Acknowledge
            </button>
            <button
              className="deprecation-banner__btn-dismiss"
              onClick={() => handleHideForDays(7)}
            >
              Hide for 7 days
            </button>
          </div>
        </div>
      </div>

      {showGuide && replacementFeature && (
        <MigrationGuideModal
          featureName={featureName}
          replacementFeature={replacementFeature}
          replacementPath={replacementPath}
          migrationGuideUrl={migrationGuideUrl}
          breakingChanges={breakingChanges}
          onClose={() => setShowGuide(false)}
        />
      )}
    </>
  );
};

// ============================================
// MIGRATION GUIDE MODAL
// ============================================

export const MigrationGuideModal: React.FC<MigrationGuideProps> = ({
  featureName,
  replacementFeature,
  replacementPath,
  migrationGuideUrl,
  breakingChanges,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'breaking' | 'guide'>('overview');

  return (
    <div className="migration-guide-modal">
      <div className="migration-guide-modal__overlay" onClick={onClose} />
      <div className="migration-guide-modal__content">
        <div className="migration-guide-modal__header">
          <h2>Migration Guide</h2>
          <button
            className="migration-guide-modal__close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="migration-guide-modal__tabs">
          <button
            className={`migration-guide-modal__tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          {breakingChanges && breakingChanges.length > 0 && (
            <button
              className={`migration-guide-modal__tab ${activeTab === 'breaking' ? 'active' : ''}`}
              onClick={() => setActiveTab('breaking')}
            >
              Breaking Changes
            </button>
          )}
          {migrationGuideUrl && (
            <button
              className={`migration-guide-modal__tab ${activeTab === 'guide' ? 'active' : ''}`}
              onClick={() => setActiveTab('guide')}
            >
              Detailed Guide
            </button>
          )}
        </div>

        <div className="migration-guide-modal__body">
          {activeTab === 'overview' && (
            <div className="migration-guide-section">
              <h3>Migration Overview</h3>
              <p className="migration-guide-section__text">
                The <strong>{featureName}</strong> feature is being replaced with{' '}
                <strong>{replacementFeature || 'a new feature'}</strong>.
              </p>

              <div className="migration-guide-section__steps">
                <div className="migration-guide-section__step">
                  <div className="migration-guide-section__step-number">1</div>
                  <div className="migration-guide-section__step-content">
                    <h4>Review Migration Guide</h4>
                    <p>Read the migration guide to understand the changes.</p>
                  </div>
                </div>

                <div className="migration-guide-section__step">
                  <div className="migration-guide-section__step-number">2</div>
                  <div className="migration-guide-section__step-content">
                    <h4>Update Your Code</h4>
                    <p>Update your implementation to use the new feature.</p>
                  </div>
                </div>

                <div className="migration-guide-section__step">
                  <div className="migration-guide-section__step-number">3</div>
                  <div className="migration-guide-section__step-content">
                    <h4>Test Thoroughly</h4>
                    <p>Verify that all functionality works as expected.</p>
                  </div>
                </div>

                <div className="migration-guide-section__step">
                  <div className="migration-guide-section__step-number">4</div>
                  <div className="migration-guide-section__step-content">
                    <h4>Deploy to Production</h4>
                    <p>Deploy your changes when ready.</p>
                  </div>
                </div>
              </div>

              {replacementPath && (
                <a
                  href={replacementPath}
                  className="migration-guide-section__cta"
                >
                  Go to {replacementFeature} →
                </a>
              )}
            </div>
          )}

          {activeTab === 'breaking' && breakingChanges && (
            <div className="migration-guide-section">
              <h3>Breaking Changes</h3>
              <div className="migration-guide-section__breaking-list">
                {breakingChanges.map((change, idx) => (
                  <div key={idx} className="migration-guide-section__breaking-item">
                    <span className="migration-guide-section__breaking-icon">⚠️</span>
                    <span>{change}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'guide' && migrationGuideUrl && (
            <div className="migration-guide-section">
              <h3>Detailed Migration Guide</h3>
              <p>
                For the complete migration guide, please visit the documentation:
              </p>
              <a
                href={migrationGuideUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="migration-guide-section__cta"
              >
                Open Detailed Guide ↗
              </a>
            </div>
          )}
        </div>

        <div className="migration-guide-modal__footer">
          <button
            className="migration-guide-modal__btn"
            onClick={onClose}
          >
            Close
          </button>
          {replacementPath && (
            <button
              className="migration-guide-modal__btn migration-guide-modal__btn--primary"
              onClick={() => {
                window.location.href = replacementPath;
              }}
            >
              Go to New Feature
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// DEPRECATION TIMELINE COMPONENT
// ============================================

export const DeprecationTimeline: React.FC<TimelineProps> = ({
  announcedDate,
  disabledDate,
  endOfLifeDate,
  removalDate,
  currentStatus,
}) => {
  const getStatusPercentage = () => {
    const statuses = ['announced', 'active', 'disabled', 'removed'];
    const currentIndex = statuses.indexOf(currentStatus);
    return (currentIndex / (statuses.length - 1)) * 100;
  };

  const getDaysUntil = (date: Date | undefined) => {
    if (!date) return null;
    const today = new Date();
    const days = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="deprecation-timeline">
      <div className="deprecation-timeline__header">
        <h4>Deprecation Timeline</h4>
      </div>

      <div className="deprecation-timeline__progress">
        <div className="deprecation-timeline__progress-bar">
          <div
            className="deprecation-timeline__progress-fill"
            style={{ width: `${getStatusPercentage()}%` }}
          />
        </div>
      </div>

      <div className="deprecation-timeline__events">
        <div className={`deprecation-timeline__event ${currentStatus === 'announced' || ['active', 'disabled', 'removed'].includes(currentStatus) ? 'completed' : ''}`}>
          <div className="deprecation-timeline__event-dot" />
          <div className="deprecation-timeline__event-content">
            <div className="deprecation-timeline__event-label">Announced</div>
            <div className="deprecation-timeline__event-date">
              {formatDate(announcedDate)}
            </div>
          </div>
        </div>

        <div className={`deprecation-timeline__event ${currentStatus === 'announced' ? 'current' : currentStatus === 'announced' || ['disabled', 'removed'].includes(currentStatus) ? 'completed' : ''}`}>
          <div className="deprecation-timeline__event-dot" />
          <div className="deprecation-timeline__event-content">
            <div className="deprecation-timeline__event-label">Active (Deprecated)</div>
            <div className="deprecation-timeline__event-date">
              {currentStatus === 'announced' && disabledDate && (
                <>
                  {getDaysUntil(disabledDate)} days left
                </>
              )}
              {disabledDate && formatDate(disabledDate)}
            </div>
          </div>
        </div>

        {disabledDate && (
          <div className={`deprecation-timeline__event ${currentStatus === 'disabled' ? 'current' : currentStatus === 'removed' ? 'completed' : ''}`}>
            <div className="deprecation-timeline__event-dot" />
            <div className="deprecation-timeline__event-content">
              <div className="deprecation-timeline__event-label">Disabled</div>
              <div className="deprecation-timeline__event-date">
                {currentStatus === 'active' && (
                  <>
                    {getDaysUntil(disabledDate)} days left
                  </>
                )}
                {formatDate(disabledDate)}
              </div>
            </div>
          </div>
        )}

        <div className={`deprecation-timeline__event ${currentStatus === 'removed' ? 'completed' : ''}`}>
          <div className="deprecation-timeline__event-dot" />
          <div className="deprecation-timeline__event-content">
            <div className="deprecation-timeline__event-label">End of Life / Removal</div>
            <div className="deprecation-timeline__event-date">
              {currentStatus !== 'removed' && (
                <>
                  {getDaysUntil(endOfLifeDate)} days left
                </>
              )}
              {removalDate ? formatDate(removalDate) : formatDate(endOfLifeDate)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MIGRATION PROGRESS COMPONENT
// ============================================

export const MigrationProgressBar: React.FC<MigrationProgressProps> = ({
  totalFeatures,
  completedMigrations,
  inProgressMigrations,
  failedMigrations,
  estimatedCompletionDate,
}) => {
  const percentageComplete = totalFeatures > 0 ? (completedMigrations / totalFeatures) * 100 : 0;

  return (
    <div className="migration-progress">
      <div className="migration-progress__header">
        <h4>Migration Progress</h4>
        <span className="migration-progress__percentage">
          {percentageComplete.toFixed(0)}% Complete
        </span>
      </div>

      <div className="migration-progress__bar">
        <div
          className="migration-progress__fill"
          style={{ width: `${percentageComplete}%` }}
        />
      </div>

      <div className="migration-progress__stats">
        <div className="migration-progress__stat">
          <span className="migration-progress__stat-label">Completed</span>
          <span className="migration-progress__stat-value">
            {completedMigrations} / {totalFeatures}
          </span>
        </div>

        <div className="migration-progress__stat">
          <span className="migration-progress__stat-label">In Progress</span>
          <span className="migration-progress__stat-value">
            {inProgressMigrations}
          </span>
        </div>

        {failedMigrations > 0 && (
          <div className="migration-progress__stat">
            <span className="migration-progress__stat-label">Failed</span>
            <span className="migration-progress__stat-value migration-progress__stat-value--error">
              {failedMigrations}
            </span>
          </div>
        )}

        <div className="migration-progress__stat">
          <span className="migration-progress__stat-label">Est. Completion</span>
          <span className="migration-progress__stat-value">
            {estimatedCompletionDate.toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
};

// ============================================
// DEPRECATION ALERT BADGE
// ============================================

export const DeprecationBadge: React.FC<{
  featureName: string;
  daysUntilDisabled?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}> = ({ featureName, daysUntilDisabled, severity }) => {
  const getSeverityColor = (sev: string) => {
    const colors: Record<string, string> = {
      low: '#87CEEB',
      medium: '#FFD700',
      high: '#FF6347',
      critical: '#8B0000',
    };
    return colors[sev] || '#FFD700';
  };

  return (
    <span
      className="deprecation-badge"
      style={{ backgroundColor: getSeverityColor(severity) }}
      title={`${featureName} is deprecated${daysUntilDisabled ? ` (${daysUntilDisabled} days until disabled)` : ''}`}
    >
      Deprecated
      {daysUntilDisabled && daysUntilDisabled <= 30 && (
        <span className="deprecation-badge__alert">!</span>
      )}
    </span>
  );
};

export default {
  DeprecationBanner,
  MigrationGuideModal,
  DeprecationTimeline,
  MigrationProgressBar,
  DeprecationBadge,
};
