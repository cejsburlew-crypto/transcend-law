// Subscription Management
// Billing, plan management, and upgrade options

import React, { useState } from 'react';
import './SubscriptionManagement.css';

interface Plan {
  id: string;
  name: string;
  price: number;
  billingPeriod: 'monthly' | 'annual';
  features: string[];
  highlighted: boolean;
}

interface SubscriptionDetail {
  id: string;
  planName: string;
  price: number;
  status: 'active' | 'paused' | 'canceled';
  startDate: Date;
  renewalDate: Date;
  paymentMethod: string;
  invoices: Array<{ id: string; date: Date; amount: number; status: string }>;
}

interface SubscriptionProps {
  currentSubscription?: SubscriptionDetail;
  onUpgrade?: (planId: string) => void;
  onCancel?: () => void;
  onPause?: () => void;
}

const PLANS: Plan[] = [
  {
    id: 'basic',
    name: 'Basic',
    price: 29,
    billingPeriod: 'monthly',
    features: [
      'Up to 5 consultation hours/month',
      'Basic document review',
      'Email support',
      'Case history (3 months)',
      'Attorney directory access',
    ],
    highlighted: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 99,
    billingPeriod: 'monthly',
    features: [
      'Unlimited consultation hours',
      'Priority document review',
      '24/7 chat & phone support',
      'Full case history',
      'Attorney directory + specializations',
      'Video conferencing included',
      'Monthly legal newsletter',
    ],
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 299,
    billingPeriod: 'monthly',
    features: [
      'Everything in Professional',
      'Dedicated legal advisor',
      'Custom case tracking',
      'Priority attorney matching',
      'Negotiation assistance',
      'Quarterly strategy reviews',
      'Custom integrations',
    ],
    highlighted: false,
  },
];

export const SubscriptionManagement: React.FC<SubscriptionProps> = ({
  currentSubscription,
  onUpgrade,
  onCancel,
  onPause,
}) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [activeTab, setActiveTab] = useState<'plans' | 'billing' | 'settings'>('plans');

  const mockSubscription: SubscriptionDetail = currentSubscription || {
    id: 'sub_123',
    planName: 'Professional',
    price: 99,
    status: 'active',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    renewalDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    paymentMethod: 'Visa ending in 4242',
    invoices: [
      { id: 'inv_1', date: new Date(Date.now() - 24 * 60 * 60 * 1000), amount: 99, status: 'Paid' },
      { id: 'inv_2', date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), amount: 99, status: 'Paid' },
      { id: 'inv_3', date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), amount: 99, status: 'Paid' },
    ],
  };

  const annualDiscount = 0.2; // 20% discount for annual

  return (
    <div className="subscription-management">
      {/* Header */}
      <div className="subscription-header">
        <h1>Subscription & Billing</h1>
        <p>Manage your plan, billing, and account settings</p>
      </div>

      {/* Navigation Tabs */}
      <div className="subscription-tabs">
        <button
          className={`tab-btn ${activeTab === 'plans' ? 'active' : ''}`}
          onClick={() => setActiveTab('plans')}
        >
          📋 Plans
        </button>
        <button
          className={`tab-btn ${activeTab === 'billing' ? 'active' : ''}`}
          onClick={() => setActiveTab('billing')}
        >
          💳 Billing
        </button>
        <button
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Settings
        </button>
      </div>

      {/* Current Plan Card */}
      <div className="current-plan-card">
        <div className="plan-status">
          <h3>{mockSubscription.planName} Plan</h3>
          <span className={`status-badge ${mockSubscription.status}`}>
            ✓ {mockSubscription.status.toUpperCase()}
          </span>
        </div>
        <div className="plan-details">
          <div className="detail-item">
            <label>Monthly Price</label>
            <span>${mockSubscription.price}</span>
          </div>
          <div className="detail-item">
            <label>Renewal Date</label>
            <span>{mockSubscription.renewalDate.toLocaleDateString()}</span>
          </div>
          <div className="detail-item">
            <label>Payment Method</label>
            <span>{mockSubscription.paymentMethod}</span>
          </div>
        </div>
        <div className="plan-actions">
          <button className="btn-secondary" onClick={onPause}>
            ⏸️ Pause Subscription
          </button>
          <button className="btn-danger" onClick={onCancel}>
            ✕ Cancel
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'plans' && (
        <div className="tab-content">
          {/* Billing Cycle Toggle */}
          <div className="billing-cycle-toggle">
            <button
              className={`cycle-btn ${billingCycle === 'monthly' ? 'active' : ''}`}
              onClick={() => setBillingCycle('monthly')}
            >
              Monthly
            </button>
            <button
              className={`cycle-btn ${billingCycle === 'annual' ? 'active' : ''}`}
              onClick={() => setBillingCycle('annual')}
            >
              Annual <span className="save-badge">Save 20%</span>
            </button>
          </div>

          {/* Plans Grid */}
          <div className="plans-grid">
            {PLANS.map(plan => {
              const displayPrice = billingCycle === 'annual' ? Math.round(plan.price * 12 * (1 - annualDiscount)) : plan.price;
              const isCurrentPlan = plan.name === mockSubscription.planName;

              return (
                <div key={plan.id} className={`plan-card ${plan.highlighted ? 'highlighted' : ''} ${isCurrentPlan ? 'current' : ''}`}>
                  {plan.highlighted && <div className="popular-badge">⭐ Most Popular</div>}
                  {isCurrentPlan && <div className="current-badge">✓ Your Plan</div>}

                  <h3>{plan.name}</h3>
                  <div className="plan-price">
                    <span className="amount">${displayPrice}</span>
                    <span className="period">
                      {billingCycle === 'annual' ? '/year' : '/month'}
                    </span>
                  </div>

                  <div className="plan-features">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="feature">
                        <span>✓</span>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  {!isCurrentPlan && (
                    <button className="btn-primary" onClick={() => onUpgrade?.(plan.id)}>
                      Upgrade to {plan.name}
                    </button>
                  )}
                  {isCurrentPlan && <button className="btn-secondary disabled">Current Plan</button>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="tab-content">
          {/* Payment Method */}
          <div className="billing-section">
            <h2>Payment Method</h2>
            <div className="payment-method">
              <div className="card-info">
                <span className="card-type">💳 Visa</span>
                <span className="card-number">•••• •••• •••• 4242</span>
                <span className="card-expiry">Expires 12/26</span>
              </div>
              <button className="btn-secondary">Update Payment Method</button>
            </div>
          </div>

          {/* Invoices */}
          <div className="billing-section">
            <h2>Invoices</h2>
            <div className="invoices-table">
              <div className="table-header">
                <span>Date</span>
                <span>Amount</span>
                <span>Status</span>
                <span>Action</span>
              </div>
              {mockSubscription.invoices.map(invoice => (
                <div key={invoice.id} className="table-row">
                  <span>{invoice.date.toLocaleDateString()}</span>
                  <span>${invoice.amount}</span>
                  <span className="status-paid">✓ {invoice.status}</span>
                  <button className="action-link">Download</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="tab-content">
          {/* Subscription Settings */}
          <div className="settings-section">
            <h2>Subscription Settings</h2>

            <div className="setting-item">
              <label>Auto-Renew</label>
              <input type="checkbox" defaultChecked />
              <span className="description">Automatically renew subscription at renewal date</span>
            </div>

            <div className="setting-item">
              <label>Renewal Reminders</label>
              <input type="checkbox" defaultChecked />
              <span className="description">Send email reminder 7 days before renewal</span>
            </div>

            <div className="setting-item">
              <label>Tax Receipts</label>
              <input type="checkbox" defaultChecked />
              <span className="description">Include tax on invoices</span>
            </div>

            <div className="setting-item">
              <label>Email Notifications</label>
              <input type="checkbox" defaultChecked />
              <span className="description">Receive account and billing updates</span>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="danger-zone">
            <h2>Danger Zone</h2>
            <button className="btn-danger">Delete Account</button>
            <p className="danger-text">This action cannot be undone. All your data will be permanently deleted.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionManagement;
