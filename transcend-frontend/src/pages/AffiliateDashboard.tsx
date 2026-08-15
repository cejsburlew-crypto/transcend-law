// Affiliate Dashboard - Comprehensive affiliate program management
// Features: Signup, tracking links, commission tracking, payouts, marketing materials, fraud detection

import React, { useState, useEffect } from 'react';
import {
  PrimaryButton,
  SecondaryButton,
  Toast,
  LoadingSpinner,
  StatCard
} from '@/components/UI';
import './AffiliateDashboard.css';

// ============================================
// TYPES & INTERFACES
// ============================================

interface AffiliateProfile {
  id: string;
  email: string;
  companyName: string;
  status: 'pending' | 'active' | 'suspended';
  tier: 'basic' | 'premium' | 'elite';
  commissionRate: number;
  uniqueCode: string;
  fraudScore: number;
  paymentMethod?: 'bank' | 'paypal' | 'stripe';
  createdAt: string;
}

interface TrackingLink {
  id: string;
  code: string;
  url: string;
  campaignName: string;
  clickCount: number;
  conversionCount: number;
  createdAt: string;
}

interface Commission {
  id: string;
  type: 'signup' | 'revenue-share' | 'performance-bonus';
  amount: number;
  status: 'earned' | 'pending' | 'paid';
  createdAt: string;
  fraudFlags?: string[];
}

interface AffiliateStats {
  totalClicks: number;
  totalConversions: number;
  conversionRate: number;
  totalEarned: number;
  totalPaid: number;
  pendingPayout: number;
  avgOrderValue: number;
  lastActivity: string;
}

interface MarketingMaterial {
  id: string;
  type: 'email' | 'banner' | 'social' | 'landing-page' | 'video';
  title: string;
  downloadUrl?: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export const AffiliateDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'links' | 'commissions' | 'payouts' | 'marketing' | 'settings'>('overview');
  const [profile, setProfile] = useState<AffiliateProfile | null>(null);
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<any>(null);
  const [showSignupModal, setShowSignupModal] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [profileRes, statsRes] = await Promise.all([
        fetch('/api/v1/affiliate/profile'),
        fetch('/api/v1/affiliate/stats')
      ]);

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData.data);
      } else if (profileRes.status === 404) {
        setShowSignupModal(true);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.data);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      setToast({ type: 'error', message: 'Failed to load affiliate data' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!profile) {
    return <SignupFlow onComplete={() => { loadDashboard(); setShowSignupModal(false); }} />;
  }

  return (
    <div className="affiliate-dashboard">
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="affiliate-header">
        <div>
          <h1>Affiliate Dashboard</h1>
          <p className="subtitle">{profile.companyName} • Tier: {profile.tier.toUpperCase()}</p>
        </div>
        <div className="header-status">
          <span className={`status-badge status-${profile.status}`}>
            {profile.status.toUpperCase()}
          </span>
          {profile.fraudScore > 0 && (
            <span className="fraud-score" title={`Risk Score: ${profile.fraudScore}/100`}>
              ⚠️ {profile.fraudScore}
            </span>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="affiliate-tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'links' ? 'active' : ''}`}
          onClick={() => setActiveTab('links')}
        >
          Tracking Links
        </button>
        <button
          className={`tab ${activeTab === 'commissions' ? 'active' : ''}`}
          onClick={() => setActiveTab('commissions')}
        >
          Commissions
        </button>
        <button
          className={`tab ${activeTab === 'payouts' ? 'active' : ''}`}
          onClick={() => setActiveTab('payouts')}
        >
          Payouts
        </button>
        <button
          className={`tab ${activeTab === 'marketing' ? 'active' : ''}`}
          onClick={() => setActiveTab('marketing')}
        >
          Marketing
        </button>
        <button
          className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </div>

      {/* Tab Content */}
      <div className="affiliate-content">
        {activeTab === 'overview' && <OverviewTab stats={stats} profile={profile} />}
        {activeTab === 'links' && <TrackingLinksTab />}
        {activeTab === 'commissions' && <CommissionsTab />}
        {activeTab === 'payouts' && <PayoutsTab profile={profile} />}
        {activeTab === 'marketing' && <MarketingTab />}
        {activeTab === 'settings' && <SettingsTab profile={profile} onUpdate={loadDashboard} />}
      </div>
    </div>
  );
};

// ============================================
// OVERVIEW TAB
// ============================================

interface OverviewTabProps {
  stats: AffiliateStats | null;
  profile: AffiliateProfile;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ stats, profile }) => {
  if (!stats) return <div>Loading stats...</div>;

  return (
    <div className="tab-content overview-tab">
      <div className="stats-grid">
        <StatCard
          label="Total Clicks"
          value={stats.totalClicks}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          label="Conversions"
          value={stats.totalConversions}
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          label="Conversion Rate"
          value={`${stats.conversionRate.toFixed(2)}%`}
          trend={{ value: 2.5, isPositive: true }}
        />
        <StatCard
          label="Total Earned"
          value={`$${stats.totalEarned.toFixed(2)}`}
          trend={{ value: 25, isPositive: true }}
        />
        <StatCard
          label="Total Paid"
          value={`$${stats.totalPaid.toFixed(2)}`}
        />
        <StatCard
          label="Pending Payout"
          value={`$${stats.pendingPayout.toFixed(2)}`}
          highlight={stats.pendingPayout > 100}
        />
      </div>

      <div className="quick-info">
        <div className="info-card">
          <h3>Program Details</h3>
          <div className="info-row">
            <span className="label">Commission Rate:</span>
            <span className="value">{profile.commissionRate}%</span>
          </div>
          <div className="info-row">
            <span className="label">Member Since:</span>
            <span className="value">{new Date(profile.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="info-row">
            <span className="label">Your Affiliate Code:</span>
            <span className="value code">{profile.uniqueCode}</span>
          </div>
          <div className="info-row">
            <span className="label">Average Order Value:</span>
            <span className="value">${stats.avgOrderValue.toFixed(2)}</span>
          </div>
        </div>

        <div className="info-card">
          <h3>Quick Actions</h3>
          <PrimaryButton label="Create Tracking Link" />
          <SecondaryButton label="Request Payout" />
          <SecondaryButton label="Download Marketing Kit" />
        </div>
      </div>

      <div className="activity-chart">
        <h3>30-Day Performance</h3>
        <PerformanceChart />
      </div>
    </div>
  );
};

// ============================================
// TRACKING LINKS TAB
// ============================================

const TrackingLinksTab: React.FC = () => {
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCampaign, setNewCampaign] = useState('');

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    try {
      const response = await fetch('/api/v1/affiliate/links');
      if (response.ok) {
        const data = await response.json();
        setLinks(data.data);
      }
    } catch (error) {
      console.error('Error loading links:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLink = async () => {
    if (!newCampaign.trim()) return;

    try {
      const response = await fetch('/api/v1/affiliate/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignName: newCampaign })
      });

      if (response.ok) {
        setNewCampaign('');
        setShowCreateModal(false);
        loadLinks();
      }
    } catch (error) {
      console.error('Error creating link:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="tab-content tracking-links-tab">
      <div className="tab-header">
        <h2>Tracking Links</h2>
        <PrimaryButton
          label="+ Create New Link"
          onClick={() => setShowCreateModal(true)}
        />
      </div>

      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Create Tracking Link</h3>
            <input
              type="text"
              placeholder="Campaign name (e.g., Summer2024, LinkedIn)"
              value={newCampaign}
              onChange={(e) => setNewCampaign(e.target.value)}
              className="modal-input"
            />
            <div className="modal-buttons">
              <PrimaryButton label="Create" onClick={handleCreateLink} />
              <SecondaryButton label="Cancel" onClick={() => setShowCreateModal(false)} />
            </div>
          </div>
        </div>
      )}

      <div className="links-container">
        {links.length === 0 ? (
          <div className="empty-state">
            <p>No tracking links yet. Create your first one!</p>
          </div>
        ) : (
          links.map(link => (
            <div key={link.id} className="link-card">
              <div className="link-header">
                <h4>{link.campaignName}</h4>
                <span className="link-code">{link.code}</span>
              </div>

              <div className="link-url">
                <input
                  type="text"
                  value={link.url}
                  readOnly
                  className="url-input"
                />
                <button
                  className="copy-btn"
                  onClick={() => copyToClipboard(link.url)}
                  title="Copy URL"
                >
                  📋
                </button>
              </div>

              <div className="link-stats">
                <div className="stat">
                  <span className="label">Clicks:</span>
                  <span className="value">{link.clickCount}</span>
                </div>
                <div className="stat">
                  <span className="label">Conversions:</span>
                  <span className="value">{link.conversionCount}</span>
                </div>
                <div className="stat">
                  <span className="label">Conv. Rate:</span>
                  <span className="value">
                    {link.clickCount > 0 ? ((link.conversionCount / link.clickCount) * 100).toFixed(2) : 0}%
                  </span>
                </div>
              </div>

              <div className="link-actions">
                <button className="action-btn">Edit</button>
                <button className="action-btn delete">Disable</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ============================================
// COMMISSIONS TAB
// ============================================

const CommissionsTab: React.FC = () => {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'earned' | 'paid'>('all');

  useEffect(() => {
    loadCommissions();
  }, [filterStatus]);

  const loadCommissions = async () => {
    try {
      const query = filterStatus === 'all' ? '' : `?status=${filterStatus}`;
      const response = await fetch(`/api/v1/affiliate/commissions${query}`);
      if (response.ok) {
        const data = await response.json();
        setCommissions(data.data);
      }
    } catch (error) {
      console.error('Error loading commissions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const totalEarned = commissions
    .filter(c => c.status === 'earned' || c.status === 'paid')
    .reduce((sum, c) => sum + c.amount, 0);

  const totalPaid = commissions
    .filter(c => c.status === 'paid')
    .reduce((sum, c) => sum + c.amount, 0);

  const totalPending = commissions
    .filter(c => c.status === 'earned')
    .reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="tab-content commissions-tab">
      <div className="commission-summary">
        <div className="summary-card">
          <h4>Total Earned</h4>
          <p className="amount">${totalEarned.toFixed(2)}</p>
        </div>
        <div className="summary-card">
          <h4>Total Paid</h4>
          <p className="amount paid">${totalPaid.toFixed(2)}</p>
        </div>
        <div className="summary-card">
          <h4>Pending Payout</h4>
          <p className="amount pending">${totalPending.toFixed(2)}</p>
        </div>
      </div>

      <div className="filter-controls">
        <button
          className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
          onClick={() => setFilterStatus('all')}
        >
          All
        </button>
        <button
          className={`filter-btn ${filterStatus === 'earned' ? 'active' : ''}`}
          onClick={() => setFilterStatus('earned')}
        >
          Earned
        </button>
        <button
          className={`filter-btn ${filterStatus === 'paid' ? 'active' : ''}`}
          onClick={() => setFilterStatus('paid')}
        >
          Paid
        </button>
      </div>

      <div className="commissions-list">
        {commissions.length === 0 ? (
          <div className="empty-state">
            <p>No commissions yet</p>
          </div>
        ) : (
          commissions.map(commission => (
            <div key={commission.id} className="commission-item">
              <div className="commission-main">
                <div>
                  <h4>{commission.type.replace('-', ' ').toUpperCase()}</h4>
                  <p className="date">{new Date(commission.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="amount">${commission.amount.toFixed(2)}</div>
              </div>
              <div className="commission-status">
                <span className={`status ${commission.status}`}>
                  {commission.status.toUpperCase()}
                </span>
                {commission.fraudFlags && commission.fraudFlags.length > 0 && (
                  <span className="fraud-warning" title={commission.fraudFlags.join(', ')}>
                    ⚠️
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ============================================
// PAYOUTS TAB
// ============================================

interface PayoutsTabProps {
  profile: AffiliateProfile;
}

const PayoutsTab: React.FC<PayoutsTabProps> = ({ profile }) => {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [showRequestModal, setShowRequestModal] = useState(false);

  useEffect(() => {
    loadPayouts();
  }, []);

  const loadPayouts = async () => {
    try {
      const response = await fetch('/api/v1/affiliate/payouts');
      if (response.ok) {
        const data = await response.json();
        setPayouts(data.data.payouts);
        setPendingAmount(data.data.pending);
      }
    } catch (error) {
      console.error('Error loading payouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayout = async () => {
    try {
      const response = await fetch('/api/v1/affiliate/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minimumThreshold: 100 })
      });

      if (response.ok) {
        setShowRequestModal(false);
        loadPayouts();
      }
    } catch (error) {
      console.error('Error requesting payout:', error);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="tab-content payouts-tab">
      <div className="payout-info">
        <div className="info-section">
          <h3>Pending Payout</h3>
          <p className="large-amount">${pendingAmount.toFixed(2)}</p>
          <p className="note">Minimum $100 required for payout</p>
          {pendingAmount >= 100 && (
            <PrimaryButton
              label="Request Payout"
              onClick={() => setShowRequestModal(true)}
            />
          )}
        </div>

        <div className="info-section">
          <h3>Payment Method</h3>
          <p>{profile.paymentMethod?.toUpperCase() || 'Not set'}</p>
          <SecondaryButton label="Update Payment Method" />
        </div>
      </div>

      {showRequestModal && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Request Payout</h3>
            <p>Amount: ${pendingAmount.toFixed(2)}</p>
            <p className="note">
              Payouts are processed within 3-5 business days to {profile.paymentMethod?.toUpperCase()}.
            </p>
            <div className="modal-buttons">
              <PrimaryButton label="Confirm" onClick={handleRequestPayout} />
              <SecondaryButton label="Cancel" onClick={() => setShowRequestModal(false)} />
            </div>
          </div>
        </div>
      )}

      <div className="payout-history">
        <h3>Payout History</h3>
        <div className="payouts-list">
          {payouts.length === 0 ? (
            <p className="empty">No payouts yet</p>
          ) : (
            payouts.map((payout) => (
              <div key={payout.id} className="payout-item">
                <div>
                  <h4>${payout.amount.toFixed(2)}</h4>
                  <p>{new Date(payout.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`status ${payout.status}`}>
                  {payout.status.toUpperCase()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// MARKETING TAB
// ============================================

const MarketingTab: React.FC = () => {
  const [materials, setMaterials] = useState<MarketingMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      const response = await fetch('/api/v1/affiliate/marketing-materials');
      if (response.ok) {
        const data = await response.json();
        setMaterials(data.data);
      }
    } catch (error) {
      console.error('Error loading materials:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const grouped = materials.reduce((acc, material) => {
    if (!acc[material.type]) acc[material.type] = [];
    acc[material.type].push(material);
    return acc;
  }, {} as Record<string, MarketingMaterial[]>);

  return (
    <div className="tab-content marketing-tab">
      <div className="marketing-intro">
        <h2>Marketing Materials</h2>
        <p>Use these pre-made materials to promote Transcend Law to your network</p>
      </div>

      {Object.entries(grouped).map(([type, items]) => (
        <div key={type} className="material-section">
          <h3>{type.replace('-', ' ').toUpperCase()}</h3>
          <div className="material-grid">
            {items.map(material => (
              <div key={material.id} className="material-card">
                <div className="material-icon">
                  {type === 'email' && '📧'}
                  {type === 'banner' && '🖼️'}
                  {type === 'social' && '📱'}
                  {type === 'landing-page' && '🌐'}
                  {type === 'video' && '🎥'}
                </div>
                <h4>{material.title}</h4>
                {material.downloadUrl && (
                  <a href={material.downloadUrl} download className="download-btn">
                    Download
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="custom-materials">
        <h3>Custom Marketing Kit</h3>
        <PrimaryButton label="Download Full Marketing Kit" />
        <p className="note">Contains email templates, social media graphics, and landing page copy</p>
      </div>
    </div>
  );
};

// ============================================
// SETTINGS TAB
// ============================================

interface SettingsTabProps {
  profile: AffiliateProfile;
  onUpdate: () => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ profile, onUpdate }) => {
  const [formData, setFormData] = useState({
    companyName: profile.companyName,
    paymentMethod: profile.paymentMethod || 'bank',
    bankDetails: ''
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/v1/affiliate/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tab-content settings-tab">
      <div className="settings-section">
        <h3>Profile Settings</h3>
        <div className="form-group">
          <label>Company Name</label>
          <input
            type="text"
            value={formData.companyName}
            onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label>Payment Method</label>
          <select
            value={formData.paymentMethod}
            onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
            className="form-input"
          >
            <option value="bank">Bank Transfer</option>
            <option value="paypal">PayPal</option>
            <option value="stripe">Stripe</option>
          </select>
        </div>

        <div className="form-group">
          <label>Bank Account (Last 4 Digits)</label>
          <input
            type="password"
            placeholder="••••1234"
            className="form-input"
          />
          <p className="note">Only last 4 digits are visible for security</p>
        </div>

        <PrimaryButton
          label={saving ? 'Saving...' : 'Save Changes'}
          onClick={handleSave}
          disabled={saving}
        />
      </div>

      <div className="settings-section">
        <h3>Account Status</h3>
        <div className="status-info">
          <p><strong>Status:</strong> {profile.status}</p>
          <p><strong>Tier:</strong> {profile.tier}</p>
          <p><strong>Commission Rate:</strong> {profile.commissionRate}%</p>
          <p><strong>Member Since:</strong> {new Date(profile.createdAt).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="settings-section danger-zone">
        <h3>Danger Zone</h3>
        <button className="danger-btn">Suspend Account</button>
        <p className="note">This action can be reversed by contacting support</p>
      </div>
    </div>
  );
};

// ============================================
// SIGNUP FLOW
// ============================================

interface SignupFlowProps {
  onComplete: () => void;
}

const SignupFlow: React.FC<SignupFlowProps> = ({ onComplete }) => {
  const [step, setStep] = useState<'info' | 'verification' | 'payment'>('info');
  const [formData, setFormData] = useState({
    companyName: '',
    email: '',
    taxId: '',
    paymentMethod: 'bank'
  });
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/affiliate/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        onComplete();
      }
    } catch (error) {
      console.error('Error signing up:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-flow">
      <div className="signup-container">
        <h1>Join Our Affiliate Program</h1>
        <p className="subtitle">Earn 10-25% commission on every client you refer</p>

        {step === 'info' && (
          <div className="signup-step">
            <h2>Step 1: Your Information</h2>
            <div className="form-group">
              <label>Company Name</label>
              <input
                type="text"
                placeholder="Your Company"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Tax ID (Optional)</label>
              <input
                type="text"
                placeholder="XX-XXXXXXX"
                value={formData.taxId}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                className="form-input"
              />
            </div>
            <PrimaryButton
              label="Continue"
              onClick={() => setStep('verification')}
              disabled={!formData.companyName || !formData.email}
            />
          </div>
        )}

        {step === 'verification' && (
          <div className="signup-step">
            <h2>Step 2: Verify Information</h2>
            <div className="verification-info">
              <p>Please confirm your details:</p>
              <ul>
                <li>Company: {formData.companyName}</li>
                <li>Email: {formData.email}</li>
              </ul>
              <p className="note">You'll receive a verification email shortly</p>
            </div>
            <div className="button-group">
              <PrimaryButton label="Confirm" onClick={() => setStep('payment')} />
              <SecondaryButton label="Back" onClick={() => setStep('info')} />
            </div>
          </div>
        )}

        {step === 'payment' && (
          <div className="signup-step">
            <h2>Step 3: Payment Setup</h2>
            <div className="form-group">
              <label>Preferred Payment Method</label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="form-input"
              >
                <option value="bank">Bank Transfer</option>
                <option value="paypal">PayPal</option>
                <option value="stripe">Stripe Connect</option>
              </select>
            </div>
            <p className="note">You can update payment details after signup</p>
            <div className="button-group">
              <PrimaryButton
                label={loading ? 'Creating Account...' : 'Complete Signup'}
                onClick={handleSignup}
                disabled={loading}
              />
              <SecondaryButton label="Back" onClick={() => setStep('verification')} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// HELPER COMPONENTS
// ============================================

const PerformanceChart: React.FC = () => {
  return (
    <div className="chart-placeholder">
      <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '150px' }}>
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              backgroundColor: '#6366f1',
              height: `${Math.random() * 100}%`,
              borderRadius: '2px'
            }}
          />
        ))}
      </div>
      <p className="chart-label">Last 30 days</p>
    </div>
  );
};

export default AffiliateDashboard;
