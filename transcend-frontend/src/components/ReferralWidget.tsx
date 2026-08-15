import React, { useState, useEffect } from 'react';
import { Copy, Share2, TrendingUp, Gift, DollarSign, Users } from 'lucide-react';
import './ReferralWidget.css';

interface ReferralStats {
  totalReferrals: number;
  verifiedReferrals: number;
  totalRewardsEarned: number;
  totalRewardsPaid: number;
  pendingRewards: number;
  lastReferralDate?: string;
}

interface ReferralCode {
  code: string;
  createdAt: string;
  expiresAt: string;
  maxUses: number;
  currentUses: number;
  isActive: boolean;
}

interface ReferralWidgetProps {
  userId: string;
  onSuccess?: (message: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

export const ReferralWidget: React.FC<ReferralWidgetProps> = ({
  userId,
  onSuccess,
  onError,
  className = '',
}) => {
  const [referralCode, setReferralCode] = useState<ReferralCode | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'codes' | 'rewards'>('overview');
  const [userEmail, setUserEmail] = useState('');

  // Fetch referral data on mount
  useEffect(() => {
    fetchReferralData();
    fetchUserEmail();
  }, [userId]);

  const fetchUserEmail = async () => {
    try {
      const response = await fetch('/api/v2/auth/profile', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserEmail(data.email);
      }
    } catch (err) {
      console.error('Failed to fetch user email:', err);
    }
  };

  const fetchReferralData = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch stats
      const statsResponse = await fetch(`/api/v2/referrals/stats/${userId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      // Fetch active referral code
      const codesResponse = await fetch(`/api/v2/referrals/codes/${userId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
      });

      if (codesResponse.ok) {
        const codes = await codesResponse.json();
        if (codes.length > 0) {
          // Get the most recent active code
          const activeCode = codes.find((c: ReferralCode) => c.isActive);
          if (activeCode) {
            setReferralCode(activeCode);
          }
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load referral data';
      setError(errorMsg);
      if (onError) onError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    try {
      setGenerating(true);
      setError('');

      const response = await fetch('/api/v2/referrals/generate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          userId,
          expirationDays: 90,
          maxUses: 100,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate referral code');
      }

      const newCode = await response.json();
      setReferralCode(newCode);

      const msg = 'Referral code generated successfully!';
      if (onSuccess) onSuccess(msg);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate code';
      setError(errorMsg);
      if (onError) onError(errorMsg);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyCode = () => {
    if (referralCode?.code) {
      navigator.clipboard.writeText(referralCode.code);
      setCopiedCode(true);
      if (onSuccess) onSuccess('Referral code copied to clipboard!');

      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleShareOptions = () => {
    setShowShareOptions(!showShareOptions);
  };

  const generateShareUrl = (): string => {
    if (!referralCode?.code) return '';

    // Adjust the domain and path based on your deployment
    const baseUrl = window.location.origin;
    const signupPath = '/signup';
    return `${baseUrl}${signupPath}?ref=${referralCode.code}`;
  };

  const generateShareMessage = (): string => {
    if (!referralCode?.code) return '';
    const shareUrl = generateShareUrl();
    return `Join me on Transcend and get 20% off your first month! Use my referral code ${referralCode.code} or click: ${shareUrl}`;
  };

  const handleCopyShareUrl = () => {
    const shareUrl = generateShareUrl();
    navigator.clipboard.writeText(shareUrl);
    if (onSuccess) onSuccess('Share link copied to clipboard!');
  };

  const handleCopyShareMessage = () => {
    const message = generateShareMessage();
    navigator.clipboard.writeText(message);
    if (onSuccess) onSuccess('Share message copied to clipboard!');
  };

  const handleShare = (platform: string) => {
    const shareUrl = generateShareUrl();
    const shareMessage = generateShareMessage();

    switch (platform) {
      case 'email':
        window.open(
          `mailto:?subject=Join Transcend&body=${encodeURIComponent(shareMessage)}`
        );
        break;

      case 'twitter':
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}&url=${encodeURIComponent(shareUrl)}`,
          '_blank'
        );
        break;

      case 'facebook':
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
          '_blank'
        );
        break;

      case 'linkedin':
        window.open(
          `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
          '_blank'
        );
        break;

      case 'whatsapp':
        window.open(
          `https://wa.me/?text=${encodeURIComponent(shareMessage)}`,
          '_blank'
        );
        break;

      default:
        break;
    }

    setShowShareOptions(false);
  };

  if (loading) {
    return (
      <div className={`referral-widget loading ${className}`}>
        <div className="spinner"></div>
        <p>Loading referral data...</p>
      </div>
    );
  }

  return (
    <div className={`referral-widget ${className}`}>
      {error && <div className="error-message">{error}</div>}

      {/* Header Section */}
      <div className="referral-header">
        <div className="header-content">
          <h2>Share & Earn</h2>
          <p>Invite friends and earn $50 rewards</p>
        </div>
        <div className="header-icon">
          <Gift size={32} />
        </div>
      </div>

      {/* Quick Stats Row */}
      {stats && (
        <div className="quick-stats">
          <div className="stat-item">
            <div className="stat-value">{stats.verifiedReferrals}</div>
            <div className="stat-label">Verified Referrals</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">${stats.totalRewardsPaid}</div>
            <div className="stat-label">Earned</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">${stats.pendingRewards}</div>
            <div className="stat-label">Pending</div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <TrendingUp size={18} />
          Overview
        </button>
        <button
          className={`tab-button ${activeTab === 'codes' ? 'active' : ''}`}
          onClick={() => setActiveTab('codes')}
        >
          <Users size={18} />
          My Codes
        </button>
        <button
          className={`tab-button ${activeTab === 'rewards' ? 'active' : ''}`}
          onClick={() => setActiveTab('rewards')}
        >
          <DollarSign size={18} />
          Rewards
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="overview-tab">
            {referralCode ? (
              <div className="code-section">
                <div className="code-display">
                  <div className="code-label">Your Referral Code</div>
                  <div className="code-box">
                    <code className="referral-code">{referralCode.code}</code>
                    <button
                      className={`copy-button ${copiedCode ? 'copied' : ''}`}
                      onClick={handleCopyCode}
                      title="Copy code"
                    >
                      <Copy size={18} />
                      {copiedCode ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="code-expires">
                    Expires: {new Date(referralCode.expiresAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="share-section">
                  <h3>Share Your Code</h3>

                  <div className="share-options-mini">
                    <button
                      className="share-button copy-url"
                      onClick={handleCopyShareUrl}
                      title="Copy share link"
                    >
                      <Copy size={16} />
                      Copy Link
                    </button>
                    <button
                      className="share-button copy-message"
                      onClick={handleCopyShareMessage}
                      title="Copy share message"
                    >
                      <Copy size={16} />
                      Copy Message
                    </button>
                  </div>

                  <button
                    className="share-button more-options"
                    onClick={handleShareOptions}
                  >
                    <Share2 size={16} />
                    More Options
                  </button>

                  {showShareOptions && (
                    <div className="share-expanded">
                      <button
                        className="share-platform email"
                        onClick={() => handleShare('email')}
                      >
                        Email
                      </button>
                      <button
                        className="share-platform twitter"
                        onClick={() => handleShare('twitter')}
                      >
                        Twitter
                      </button>
                      <button
                        className="share-platform facebook"
                        onClick={() => handleShare('facebook')}
                      >
                        Facebook
                      </button>
                      <button
                        className="share-platform linkedin"
                        onClick={() => handleShare('linkedin')}
                      >
                        LinkedIn
                      </button>
                      <button
                        className="share-platform whatsapp"
                        onClick={() => handleShare('whatsapp')}
                      >
                        WhatsApp
                      </button>
                    </div>
                  )}
                </div>

                <div className="reward-info">
                  <div className="reward-item">
                    <div className="reward-icon referrer">
                      <DollarSign size={20} />
                    </div>
                    <div className="reward-detail">
                      <h4>You Earn</h4>
                      <p>$50 credit when they sign up</p>
                    </div>
                  </div>
                  <div className="reward-item">
                    <div className="reward-icon referred">
                      <Gift size={20} />
                    </div>
                    <div className="reward-detail">
                      <h4>They Get</h4>
                      <p>20% off their first month</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">
                  <Gift size={48} />
                </div>
                <h3>No Referral Code Yet</h3>
                <p>Generate your first referral code to start earning rewards</p>
                <button
                  className="btn btn-primary generate-btn"
                  onClick={handleGenerateCode}
                  disabled={generating}
                >
                  {generating ? 'Generating...' : 'Generate Code'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* My Codes Tab */}
        {activeTab === 'codes' && (
          <div className="codes-tab">
            <div className="codes-header">
              <h3>Your Referral Codes</h3>
              <button
                className="btn btn-secondary"
                onClick={handleGenerateCode}
                disabled={generating}
              >
                {generating ? 'Generating...' : 'Generate New Code'}
              </button>
            </div>

            {referralCode ? (
              <div className="code-item">
                <div className="code-item-header">
                  <span className="code-badge">{referralCode.code}</span>
                  <span className={`status-badge ${referralCode.isActive ? 'active' : 'inactive'}`}>
                    {referralCode.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="code-item-details">
                  <div className="detail">
                    <span className="label">Created:</span>
                    <span className="value">
                      {new Date(referralCode.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="detail">
                    <span className="label">Expires:</span>
                    <span className="value">
                      {new Date(referralCode.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="detail">
                    <span className="label">Uses:</span>
                    <span className="value">
                      {referralCode.currentUses} / {referralCode.maxUses}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p>No referral codes yet. Generate one to get started!</p>
              </div>
            )}
          </div>
        )}

        {/* Rewards Tab */}
        {activeTab === 'rewards' && (
          <div className="rewards-tab">
            <div className="rewards-summary">
              <div className="reward-card">
                <h4>Total Earned</h4>
                <p className="amount">${stats?.totalRewardsEarned || 0}</p>
                <span className="label">All time</span>
              </div>
              <div className="reward-card">
                <h4>Paid Out</h4>
                <p className="amount">${stats?.totalRewardsPaid || 0}</p>
                <span className="label">Completed</span>
              </div>
              <div className="reward-card">
                <h4>Pending</h4>
                <p className="amount">${stats?.pendingRewards || 0}</p>
                <span className="label">In progress</span>
              </div>
            </div>

            <div className="reward-info-box">
              <h4>How Rewards Work</h4>
              <ol className="steps">
                <li>Share your referral code with friends</li>
                <li>They sign up using your code</li>
                <li>They complete their first purchase</li>
                <li>You earn $50 instant credit</li>
                <li>Rewards are paid within 5 business days</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferralWidget;
