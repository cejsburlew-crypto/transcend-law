// SubscriptionUI Component
// Tier selection, upgrades, billing, and account management

import React, { useState, useEffect } from 'react';
import './SubscriptionUI.css';

interface SubscriptionTier {
  id: number;
  tier_key: string;
  tier_name: string;
  tier_level: number;
  monthly_price: number;
  features: string[];
  description: string;
}

interface UserSubscription {
  id: number;
  subscription_tier_id: number;
  status: string;
  expires_at: string;
  auto_renew: boolean;
}

interface SubscriptionUIProps {
  userId: number;
  userEmail: string;
  onUpgrade?: (tierId: number, tierName: string) => void;
  onCancel?: () => void;
  className?: string;
}

export const SubscriptionUI: React.FC<SubscriptionUIProps> = ({
  userId,
  userEmail,
  onUpgrade,
  onCancel,
  className = '',
}) => {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBillingHistory, setShowBillingHistory] = useState(false);
  const [selectedTierId, setSelectedTierId] = useState<number | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    fetchSubscriptionData();
  }, [userId]);

  const fetchSubscriptionData = async () => {
    try {
      setLoading(true);

      const [tiersRes, subRes, historyRes] = await Promise.all([
        fetch('/api/v2/subscriptions/tiers'),
        fetch(`/api/v2/subscriptions/user/${userId}`),
        fetch(`/api/v2/subscriptions/user/${userId}/history`),
      ]);

      const tiersData = await tiersRes.json();
      const subData = await subRes.json();
      const historyData = await historyRes.json();

      if (tiersData.success) {
        setTiers(tiersData.data);
      }
      if (subData.success) {
        setCurrentSubscription(subData.data);
      }
      if (historyData.success) {
        setBillingHistory(historyData.data);
      }
    } catch (error) {
      console.error('Failed to fetch subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradeTier = async (tierId: number) => {
    if (upgrading) return;

    setUpgrading(true);
    setSelectedTierId(tierId);

    try {
      const response = await fetch(`/api/v2/subscriptions/user/${userId}/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tierId,
          reason: 'User upgrade from dashboard',
        }),
      });

      const data = await response.json();

      if (data.success) {
        const tier = tiers.find((t) => t.id === tierId);
        onUpgrade?.(tierId, tier?.tier_name || '');
        fetchSubscriptionData();
      }
    } catch (error) {
      console.error('Failed to upgrade subscription:', error);
    } finally {
      setUpgrading(false);
      setSelectedTierId(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (window.confirm('Are you sure you want to cancel your subscription?')) {
      try {
        const response = await fetch(`/api/v2/subscriptions/user/${userId}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: 'User cancellation from dashboard',
          }),
        });

        const data = await response.json();

        if (data.success) {
          onCancel?.();
          fetchSubscriptionData();
        }
      } catch (error) {
        console.error('Failed to cancel subscription:', error);
      }
    }
  };

  const getCurrentTier = () => {
    if (!currentSubscription) return tiers.find((t) => t.tier_level === 0); // Free tier
    return tiers.find((t) => t.id === currentSubscription.subscription_tier_id);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  if (loading) {
    return (
      <div className={`subscription-ui ${className}`}>
        <div className="subscription-loading">Loading subscription details...</div>
      </div>
    );
  }

  const currentTier = getCurrentTier();

  return (
    <div className={`subscription-ui ${className}`}>
      {/* Header */}
      <div className="subscription-header">
        <div className="header-icon">💳</div>
        <div className="header-content">
          <h2 className="header-title">Subscription</h2>
          <p className="header-subtitle">
            {currentTier ? `Currently on ${currentTier.tier_name}` : 'Free tier'}
          </p>
        </div>
      </div>

      {/* Current Subscription Info */}
      {currentSubscription && (
        <div className="current-subscription">
          <div className="sub-info">
            <p className="sub-tier">{currentTier?.tier_name}</p>
            <p className="sub-price">
              {currentTier?.monthly_price === 0
                ? 'Free'
                : `${formatCurrency(currentTier?.monthly_price || 0)}/month`}
            </p>
            {currentSubscription.expires_at && (
              <p className="sub-expiry">
                Renews on {formatDate(currentSubscription.expires_at)}
              </p>
            )}
            {currentSubscription.auto_renew === false && (
              <p className="sub-warning">⚠️ Auto-renewal disabled</p>
            )}
          </div>
          {currentSubscription.status === 'active' && (
            <div className="sub-badge active">✓ Active</div>
          )}
        </div>
      )}

      {/* Tier Selection */}
      <div className="tiers-section">
        <h3 className="section-title">Choose Your Plan</h3>

        <div className="tiers-grid">
          {tiers.map((tier) => {
            const isCurrent = currentTier?.id === tier.id;
            const isCurrentLevel = currentTier?.tier_level === tier.tier_level;

            return (
              <div
                key={tier.id}
                className={`tier-card ${isCurrent ? 'current' : ''} ${
                  tier.tier_level > (currentTier?.tier_level || 0) ? 'upgradeable' : ''
                }`}
              >
                {/* Popular Badge */}
                {tier.tier_level === 2 && <div className="popular-badge">Most Popular</div>}

                {/* Tier Info */}
                <div className="tier-info">
                  <h4 className="tier-name">{tier.tier_name}</h4>
                  <p className="tier-description">{tier.description}</p>
                  <p className="tier-price">
                    {tier.monthly_price === 0 ? (
                      <span className="price-free">Free</span>
                    ) : (
                      <>
                        <span className="price-amount">
                          {formatCurrency(tier.monthly_price)}
                        </span>
                        <span className="price-period">/month</span>
                      </>
                    )}
                  </p>
                </div>

                {/* Features */}
                <div className="tier-features">
                  {tier.features.map((feature, idx) => (
                    <div key={idx} className="feature-item">
                      <span className="feature-check">✓</span>
                      <span className="feature-text">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Action Button */}
                <div className="tier-action">
                  {isCurrent ? (
                    <button className="btn btn-current" disabled>
                      Current Plan
                    </button>
                  ) : tier.tier_level < (currentTier?.tier_level || 0) ? (
                    <button className="btn btn-downgrade" disabled>
                      Current: {currentTier?.tier_name}
                    </button>
                  ) : (
                    <button
                      className="btn btn-upgrade"
                      onClick={() => handleUpgradeTier(tier.id)}
                      disabled={upgrading}
                    >
                      {upgrading && selectedTierId === tier.id
                        ? 'Upgrading...'
                        : 'Upgrade Now'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Billing & Account */}
      <div className="account-section">
        <h3 className="section-title">Account & Billing</h3>

        <div className="account-info">
          <div className="info-row">
            <span className="info-label">Email:</span>
            <span className="info-value">{userEmail}</span>
          </div>

          {currentSubscription && (
            <>
              <div className="info-row">
                <span className="info-label">Status:</span>
                <span className="info-value">{currentSubscription.status}</span>
              </div>

              <div className="info-row">
                <span className="info-label">Auto-renewal:</span>
                <span className="info-value">
                  {currentSubscription.auto_renew ? '✓ Enabled' : '✗ Disabled'}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Billing History */}
        <div className="billing-history">
          <button
            className="history-toggle"
            onClick={() => setShowBillingHistory(!showBillingHistory)}
          >
            <span className="toggle-icon">{showBillingHistory ? '▼' : '▶'}</span>
            <span className="toggle-text">Billing History</span>
          </button>

          {showBillingHistory && (
            <div className="history-list">
              {billingHistory.length === 0 ? (
                <p className="no-history">No billing history yet</p>
              ) : (
                billingHistory.map((item, idx) => (
                  <div key={idx} className="history-item">
                    <div className="history-date">
                      {formatDate(item.started_at)}
                    </div>
                    <div className="history-detail">
                      <p className="history-tier">{item.tier_name}</p>
                      <p className="history-amount">
                        {formatCurrency(item.amount)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {currentSubscription && currentSubscription.status === 'active' && (
        <div className="account-actions">
          <button className="btn btn-danger" onClick={handleCancelSubscription}>
            Cancel Subscription
          </button>
        </div>
      )}

      {/* FAQ */}
      <div className="faq-section">
        <h4 className="faq-title">Questions?</h4>
        <ul className="faq-list">
          <li>
            <a href="/help/billing">Billing FAQ</a>
          </li>
          <li>
            <a href="/help/upgrade">How to upgrade</a>
          </li>
          <li>
            <a href="/contact">Contact support</a>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default SubscriptionUI;
