// Upgrade Prompt Component
// Displays freemium limits, feature comparison, and upgrade flow
// Handles trial period display and conversion tracking

import React, { useState, useEffect } from 'react';
import './UpgradePrompt.css';

interface UpgradePromptProps {
  userId: string;
  feature: string;
  currentUsage: number;
  limit: number;
  currentTier: 'free' | 'pro' | 'enterprise';
  onUpgradeClick?: () => void;
  onDismiss?: () => void;
  trialDaysRemaining?: number;
  showImmediately?: boolean;
}

interface PricingTier {
  name: string;
  displayName: string;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
  features: string[];
}

interface FeatureComparison {
  name: string;
  category: string;
  free: string | boolean;
  pro: string | boolean;
  enterprise: string | boolean;
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  userId,
  feature,
  currentUsage,
  limit,
  currentTier,
  onUpgradeClick,
  onDismiss,
  trialDaysRemaining,
  showImmediately = false,
}) => {
  const [isVisible, setIsVisible] = useState(showImmediately);
  const [activeTab, setActiveTab] = useState<'comparison' | 'pricing' | 'trial'>('comparison');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [processingUpgrade, setProcessingUpgrade] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [features, setFeatures] = useState<FeatureComparison[]>([]);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [showExtendTrial, setShowExtendTrial] = useState(false);

  useEffect(() => {
    fetchFeatureData();
  }, []);

  const fetchFeatureData = async () => {
    try {
      const response = await fetch('/api/v2/freemium/features', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setFeatures(data.features);
        setPricingTiers(data.pricingTiers);
      }
    } catch (err) {
      console.error('Failed to fetch feature data:', err);
    }
  };

  const trackEvent = async (event: string, metadata?: Record<string, any>) => {
    try {
      await fetch('/api/v2/freemium/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          event,
          userId,
          metadata: {
            feature,
            currentTier,
            ...metadata,
          },
        }),
      });
    } catch (err) {
      console.error('Failed to track event:', err);
    }
  };

  const handleUpgradeClick = async () => {
    setError(null);
    setShowConfirmation(true);
    await trackEvent('upgrade_clicked', {
      fromTier: currentTier,
      toTier: 'pro',
      billingCycle,
    });
  };

  const handleConfirmUpgrade = async () => {
    try {
      setProcessingUpgrade(true);
      await trackEvent('payment_started', { billingCycle });

      const response = await fetch('/api/v2/freemium/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          userId,
          newTier: 'pro',
          billingCycle,
        }),
      });

      if (!response.ok) {
        throw new Error('Upgrade failed');
      }

      await trackEvent('payment_completed', { billingCycle });
      onUpgradeClick?.();
      handleDismiss();
      window.location.href = '/dashboard?upgraded=true';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upgrade failed');
      await trackEvent('payment_failed', { error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setProcessingUpgrade(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  const handleExtendTrial = async () => {
    try {
      const response = await fetch('/api/v2/freemium/extend-trial', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        setShowExtendTrial(false);
        await trackEvent('trial_extended');
      }
    } catch (err) {
      setError('Failed to extend trial');
    }
  };

  const percentageUsed = limit > 0 ? Math.round((currentUsage / limit) * 100) : 0;
  const isAtLimit = currentUsage >= limit;

  const getProgressBarColor = (): string => {
    if (percentageUsed >= 90) return 'critical';
    if (percentageUsed >= 70) return 'warning';
    return 'normal';
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="upgrade-prompt-overlay" onClick={handleDismiss}>
      <div className="upgrade-prompt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="upgrade-header">
          <h2>
            {isAtLimit
              ? `${feature} Limit Reached`
              : `You\'re Almost at Your ${feature} Limit`}
          </h2>
          <button className="close-btn" onClick={handleDismiss}>
            ✕
          </button>
        </div>

        <div className="usage-indicator">
          <div className="usage-stats">
            <div className="stat-label">{feature} Usage</div>
            <div className="stat-value">
              {currentUsage} / {limit}
            </div>
          </div>
          <div className={`progress-bar ${getProgressBarColor()}`}>
            <div
              className="progress-fill"
              style={{ width: `${Math.min(percentageUsed, 100)}%` }}
            />
          </div>
          <div className="progress-label">{percentageUsed}% of limit used</div>
        </div>

        {isAtLimit && (
          <div className="at-limit-notice">
            <div className="notice-icon">⚠️</div>
            <div className="notice-text">
              <p className="notice-title">You've reached your free tier limit</p>
              <p className="notice-description">
                Upgrade to Pro to continue using {feature} and unlock premium features.
              </p>
            </div>
          </div>
        )}

        <div className="upgrade-tabs">
          <button
            className={`tab-btn ${activeTab === 'comparison' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('comparison');
              trackEvent('comparison_viewed');
            }}
          >
            Feature Comparison
          </button>
          <button
            className={`tab-btn ${activeTab === 'pricing' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('pricing');
              trackEvent('pricing_viewed');
            }}
          >
            Pricing
          </button>
          {trialDaysRemaining !== undefined && trialDaysRemaining > 0 && (
            <button
              className={`tab-btn ${activeTab === 'trial' ? 'active' : ''}`}
              onClick={() => setActiveTab('trial')}
            >
              Trial ({trialDaysRemaining} days)
            </button>
          )}
        </div>

        <div className="tab-content">
          {activeTab === 'comparison' && (
            <div className="comparison-table">
              <table>
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th className="tier-free">Free</th>
                    <th className="tier-pro">Pro</th>
                    <th className="tier-enterprise">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {features.map((feat, idx) => (
                    <tr key={idx} className={`category-${feat.category.toLowerCase().replace(' ', '-')}`}>
                      <td className="feature-name">
                        <div className="feature-info">
                          <div className="feature-title">{feat.name}</div>
                          <div className="feature-category">{feat.category}</div>
                        </div>
                      </td>
                      <td className="tier-value">
                        {typeof feat.free === 'boolean' ? (
                          feat.free ? (
                            <span className="check-mark">✓</span>
                          ) : (
                            <span className="cross-mark">✕</span>
                          )
                        ) : (
                          feat.free
                        )}
                      </td>
                      <td className="tier-value tier-pro-cell">
                        {typeof feat.pro === 'boolean' ? (
                          feat.pro ? (
                            <span className="check-mark">✓</span>
                          ) : (
                            <span className="cross-mark">✕</span>
                          )
                        ) : (
                          feat.pro
                        )}
                      </td>
                      <td className="tier-value">
                        {typeof feat.enterprise === 'boolean' ? (
                          feat.enterprise ? (
                            <span className="check-mark">✓</span>
                          ) : (
                            <span className="cross-mark">✕</span>
                          )
                        ) : (
                          feat.enterprise
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'pricing' && (
            <div className="pricing-section">
              <div className="billing-toggle">
                <label>
                  <input
                    type="radio"
                    value="monthly"
                    checked={billingCycle === 'monthly'}
                    onChange={(e) => setBillingCycle(e.target.value as 'monthly' | 'annual')}
                  />
                  Monthly
                </label>
                <label>
                  <input
                    type="radio"
                    value="annual"
                    checked={billingCycle === 'annual'}
                    onChange={(e) => setBillingCycle(e.target.value as 'monthly' | 'annual')}
                  />
                  Annual (Save 17%)
                </label>
              </div>

              <div className="pricing-cards">
                {pricingTiers.map((tier) => (
                  <div
                    key={tier.name}
                    className={`pricing-card ${tier.name === 'pro' ? 'recommended' : ''}`}
                  >
                    {tier.name === 'pro' && (
                      <div className="recommended-badge">Most Popular</div>
                    )}
                    <div className="pricing-header">
                      <h3>{tier.displayName}</h3>
                      <div className="pricing-amount">
                        {tier.monthlyPrice === 0 ? (
                          <span>Free</span>
                        ) : (
                          <>
                            <span className="price">
                              ${billingCycle === 'monthly' ? tier.monthlyPrice : tier.annualPrice}
                            </span>
                            <span className="period">
                              /{billingCycle === 'monthly' ? 'month' : 'year'}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="tier-description">{tier.description}</p>
                    </div>
                    <ul className="features-list">
                      {tier.features.map((feature, idx) => (
                        <li key={idx}>
                          <span className="feature-check">✓</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    {tier.name === 'pro' && currentTier === 'free' && (
                      <button
                        className="btn btn-primary upgrade-btn"
                        onClick={handleUpgradeClick}
                        disabled={processingUpgrade}
                      >
                        {processingUpgrade ? 'Processing...' : 'Upgrade to Pro'}
                      </button>
                    )}
                    {tier.name !== 'pro' && (
                      <button className="btn btn-secondary" disabled>
                        {currentTier === tier.name ? 'Current Plan' : 'Downgrade'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'trial' && (
            <div className="trial-section">
              <div className="trial-info">
                <div className="trial-icon">🎁</div>
                <div className="trial-content">
                  <h3>Free Trial</h3>
                  <p>
                    You have <strong>{trialDaysRemaining} days remaining</strong> in your free trial.
                  </p>
                  <p className="trial-benefits">
                    During this period, you have full access to all Pro features at no cost.
                  </p>
                </div>
              </div>

              <div className="trial-actions">
                {showExtendTrial ? (
                  <div className="extend-form">
                    <p>We can extend your trial for another 7 days!</p>
                    <div className="form-buttons">
                      <button
                        className="btn btn-secondary"
                        onClick={() => setShowExtendTrial(false)}
                      >
                        Skip
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={handleExtendTrial}
                        disabled={processingUpgrade}
                      >
                        {processingUpgrade ? 'Extending...' : 'Extend Trial'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setShowExtendTrial(true)}
                    >
                      Extend Trial
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={() => setActiveTab('pricing')}
                    >
                      Upgrade Now
                    </button>
                  </>
                )}
              </div>

              <div className="trial-faq">
                <h4>Trial FAQ</h4>
                <ul>
                  <li>
                    <strong>What happens after my trial ends?</strong>
                    <p>Your account will revert to Free tier with basic features.</p>
                  </li>
                  <li>
                    <strong>Can I upgrade anytime?</strong>
                    <p>Yes! Upgrade anytime during or after your trial period.</p>
                  </li>
                  <li>
                    <strong>Do I need a payment method now?</strong>
                    <p>No payment is required to start or extend your trial.</p>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {error && <div className="error-banner">{error}</div>}

        {showConfirmation && (
          <div className="confirmation-modal">
            <div className="confirmation-content">
              <h3>Confirm Your Upgrade</h3>
              <p>
                Upgrade to <strong>Pro Plan</strong> ({billingCycle === 'monthly' ? '$99/month' : '$990/year'})?
              </p>
              <div className="confirmation-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowConfirmation(false)}
                  disabled={processingUpgrade}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleConfirmUpgrade}
                  disabled={processingUpgrade}
                >
                  {processingUpgrade ? 'Processing...' : 'Confirm Upgrade'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="upgrade-footer">
          <p className="footer-note">
            Questions? <a href="/support">Contact our support team</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default UpgradePrompt;
