import React, { useState, useEffect } from 'react';
import type { HealthCheck } from '../types';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Payments } from './Payments';
import './Dashboard.css';

export const Dashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const { user, token } = useAuth();
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.getHealth(token)
        .then(setHealth)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [token]);

  const tabs = [
    { id: 'overview', label: '📊 Overview', icon: '📊' },
    { id: 'directory', label: '👥 Directory', icon: '👥' },
    { id: 'referrals', label: '📋 Referrals', icon: '📋' },
    { id: 'payments', label: '💰 Payments', icon: '💰' },
    { id: 'disputes', label: '⚖️ Disputes', icon: '⚖️' },
    { id: 'notifications', label: '🔔 Notifications', icon: '🔔' },
    { id: 'settings', label: '⚙️ Settings', icon: '⚙️' },
  ];

  return (
    <div className="dashboard-container">
      <nav className="navbar">
        <div className="nav-left">
          <h1 className="logo">TRANSCEND LAW</h1>
          <p className="tagline">Global Legal Services Marketplace</p>
        </div>
        <div className="nav-right">
          <span className="user-info">👤 {user?.email}</span>
          <button className="logout-btn" onClick={onLogout}>Sign Out</button>
        </div>
      </nav>

      <div className="dashboard-content">
        <aside className="sidebar">
          <div className="tabs-list">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="main-content">
          {activeTab === 'overview' && (
            <div className="tab-content">
              <h2>Dashboard Overview</h2>
              {loading ? (
                <p className="loading">Loading...</p>
              ) : health ? (
                <div className="health-grid">
                  <div className="health-card">
                    <div className="status-indicator online"></div>
                    <h3>System Status</h3>
                    <p className="status-text">{health.status}</p>
                  </div>
                  <div className="health-card">
                    <h3>Domain</h3>
                    <p className="status-text">{health.domain}</p>
                  </div>
                  <div className="health-card">
                    <h3>Mode</h3>
                    <p className="status-text">{health.mode}</p>
                  </div>
                  <div className="health-card">
                    <h3>User</h3>
                    <p className="status-text">{health.user}</p>
                  </div>
                </div>
              ) : null}

              <div className="systems-grid">
                <h3>7 Operational Systems</h3>
                <div className="systems-list">
                  <div className="system-card">
                    <span>✅</span>
                    <h4>Professional Directory</h4>
                    <p>2.6M+ legal professionals</p>
                  </div>
                  <div className="system-card">
                    <span>✅</span>
                    <h4>Payment & Commissions</h4>
                    <p>Automated payment processing</p>
                  </div>
                  <div className="system-card">
                    <span>✅</span>
                    <h4>Verification & Compliance</h4>
                    <p>Professional verification</p>
                  </div>
                  <div className="system-card">
                    <span>✅</span>
                    <h4>Dispute Resolution</h4>
                    <p>Case management</p>
                  </div>
                  <div className="system-card">
                    <span>✅</span>
                    <h4>Admin Dashboard</h4>
                    <p>System administration</p>
                  </div>
                  <div className="system-card">
                    <span>✅</span>
                    <h4>Notifications & Leaderboards</h4>
                    <p>Real-time updates & rankings</p>
                  </div>
                  <div className="system-card">
                    <span>✅</span>
                    <h4>Referral Queue & Matching</h4>
                    <p>Intelligent case matching</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'directory' && (
            <div className="tab-content">
              <h2>👥 Professional Directory</h2>
              <p>Browse and search 2.6M+ legal professionals by state, practice area, and experience.</p>
              <div className="coming-soon">Coming Soon</div>
            </div>
          )}

          {activeTab === 'referrals' && (
            <div className="tab-content">
              <h2>📋 Case Referrals & Matching</h2>
              <p>Manage case referrals and intelligent professional matching.</p>
              <div className="coming-soon">Coming Soon</div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="tab-content">
              <h2>💰 Payment & Commissions</h2>
              <p>Track payments, commissions, and financial transactions.</p>
              <div className="coming-soon">Coming Soon</div>
            </div>
          )}

          {activeTab === 'disputes' && (
            <div className="tab-content">
              <h2>⚖️ Dispute Resolution</h2>
              <p>Manage client-professional disputes and resolutions.</p>
              <div className="coming-soon">Coming Soon</div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="tab-content">
              <h2>🔔 Notifications & Leaderboards</h2>
              <p>View notifications and professional leaderboard rankings.</p>
              <div className="coming-soon">Coming Soon</div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="tab-content">
              <h2>⚙️ Settings</h2>
              <div className="settings-section">
                <h3>Account Information</h3>
                <div className="setting-item">
                  <label>Email</label>
                  <p>{user?.email}</p>
                </div>
                <div className="setting-item">
                  <label>Role</label>
                  <p>{user?.role}</p>
                </div>
                <div className="setting-item">
                  <label>Authorized At</label>
                  <p>{user?.authorized_at}</p>
                </div>
              </div>
              <div className="settings-section">
                <h3>API Information</h3>
                <div className="setting-item">
                  <label>API Endpoint</label>
                  <p>https://transcend-law.com</p>
                </div>
                <div className="setting-item">
                  <label>Token Expiry</label>
                  <p>7 days</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
