import React, { useState, useEffect } from 'react';
import type { HealthCheck } from '../types';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Payments } from './Payments';
import { Directory } from './Directory';
import { ClientServiceIntake } from './ClientServiceIntake';
import { ClientDocuments } from './ClientDocuments';
import { IdentificationVerification } from './IdentificationVerification';
import { ServiceSelection } from './ServiceSelection';
import './Dashboard.css';

export const Dashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const { user, token } = useAuth();
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [activeTab, setActiveTab] = useState('services');
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('darkMode') === 'true');
  const [viewRole, setViewRole] = useState<'admin' | 'client' | 'firm' | 'attorney'>(() =>
    (localStorage.getItem('viewRole') as 'admin' | 'client' | 'firm' | 'attorney') || 'admin'
  );

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    localStorage.setItem('darkMode', (!darkMode).toString());
    document.documentElement.setAttribute('data-theme', !darkMode ? 'dark' : 'light');
  };

  const cycleRole = () => {
    const roles: Array<'admin' | 'client' | 'firm' | 'attorney'> = ['admin', 'firm', 'attorney', 'client'];
    const currentIndex = roles.indexOf(viewRole);
    const newRole = roles[(currentIndex + 1) % roles.length];
    setViewRole(newRole);
    localStorage.setItem('viewRole', newRole);
  };

  useEffect(() => {
    if (token) {
      api.getHealth(token)
        .then(setHealth)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [token]);

  const adminTabs = [
    { id: 'services', label: '📚 Services', icon: '📚' },
    { id: 'overview', label: '📊 Overview', icon: '📊' },
    { id: 'directory', label: '👥 Directory', icon: '👥' },
    { id: 'referrals', label: '📋 Referrals', icon: '📋' },
    { id: 'payments', label: '💰 Payments', icon: '💰' },
    { id: 'disputes', label: '⚖️ Disputes', icon: '⚖️' },
    { id: 'notifications', label: '🔔 Notifications', icon: '🔔' },
    { id: 'admin', label: '🛡️ Admin Panel', icon: '🛡️' },
    { id: 'settings', label: '⚙️ Settings', icon: '⚙️' },
  ];

  const firmTabs = [
    { id: 'services', label: '📚 Services', icon: '📚' },
    { id: 'overview', label: '📊 Dashboard', icon: '📊' },
    { id: 'directory', label: '👨‍⚖️ Attorneys', icon: '👨‍⚖️' },
    { id: 'referrals', label: '📋 Cases', icon: '📋' },
    { id: 'payments', label: '💰 Payments', icon: '💰' },
    { id: 'notifications', label: '🔔 Notifications', icon: '🔔' },
    { id: 'settings', label: '⚙️ Settings', icon: '⚙️' },
  ];

  const attorneyTabs = [
    { id: 'services', label: '📚 Services', icon: '📚' },
    { id: 'overview', label: '📊 Dashboard', icon: '📊' },
    { id: 'referrals', label: '📋 My Cases', icon: '📋' },
    { id: 'payments', label: '💰 Earnings', icon: '💰' },
    { id: 'notifications', label: '🔔 Messages', icon: '🔔' },
    { id: 'settings', label: '⚙️ Settings', icon: '⚙️' },
  ];

  const clientTabs = [
    { id: 'services', label: '📚 Services', icon: '📚' },
    { id: 'overview', label: '📝 Submit Case', icon: '📝' },
    { id: 'referrals', label: '📋 My Cases', icon: '📋' },
    { id: 'documents', label: '📁 Documents', icon: '📁' },
    { id: 'payments', label: '💰 Invoices', icon: '💰' },
    { id: 'notifications', label: '🔔 Messages', icon: '🔔' },
    { id: 'settings', label: '⚙️ Settings', icon: '⚙️' },
  ];

  const tabs = viewRole === 'admin' ? adminTabs : viewRole === 'firm' ? firmTabs : viewRole === 'attorney' ? attorneyTabs : clientTabs;

  return (
    <div className="dashboard-container">
      <nav className="navbar">
        <div className="nav-left">
          <h1 className="logo">TRANSCEND LAW</h1>
          <p className="tagline">Global Legal Services Marketplace</p>
        </div>
        <div className="nav-right">
          <button className="theme-toggle" onClick={toggleDarkMode} title="Toggle dark mode">
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button className="role-toggle" onClick={cycleRole} title="Switch view (Admin → Firm → Attorney → Client)">
            {viewRole === 'admin' ? '👨‍💼 Admin' : viewRole === 'firm' ? '🏢 Firm' : viewRole === 'attorney' ? '👨‍⚖️ Attorney' : '👤 Client'}
          </button>
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
          {activeTab === 'services' && (
            <div className="tab-content">
              <ServiceSelection onSelectService={() => {
                setActiveTab('overview');
              }} />
            </div>
          )}

          {activeTab === 'overview' && viewRole === 'firm' && (
            <div className="tab-content">
              <h2>🏢 Law Firm Dashboard</h2>
              <div className="stats-grid">
                <div className="stat-card">
                  <h3>Total Attorneys</h3>
                  <p className="stat-number">12</p>
                </div>
                <div className="stat-card">
                  <h3>Active Cases</h3>
                  <p className="stat-number">47</p>
                </div>
                <div className="stat-card">
                  <h3>Monthly Revenue</h3>
                  <p className="stat-number">$124,500</p>
                </div>
                <div className="stat-card">
                  <h3>Case Conversion Rate</h3>
                  <p className="stat-number">68%</p>
                </div>
              </div>
              <h3 style={{marginTop: '40px'}}>Attorneys Under Your Firm</h3>
              <div className="attorneys-grid">
                <div className="attorney-card">
                  <h4>Sarah Johnson</h4>
                  <p className="specialty">Corporate Law</p>
                  <p className="stats">Cases: 24 | Rating: 4.9★</p>
                  <button className="action-btn">View Profile</button>
                </div>
                <div className="attorney-card">
                  <h4>Michael Chen</h4>
                  <p className="specialty">Litigation</p>
                  <p className="stats">Cases: 31 | Rating: 4.7★</p>
                  <button className="action-btn">View Profile</button>
                </div>
                <div className="attorney-card">
                  <h4>Emily Rodriguez</h4>
                  <p className="specialty">Real Estate</p>
                  <p className="stats">Cases: 19 | Rating: 4.8★</p>
                  <button className="action-btn">View Profile</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'overview' && viewRole === 'attorney' && (
            <div className="tab-content">
              <h2>👨‍⚖️ Attorney Dashboard</h2>
              <div className="stats-grid">
                <div className="stat-card">
                  <h3>Active Cases</h3>
                  <p className="stat-number">8</p>
                </div>
                <div className="stat-card">
                  <h3>Monthly Earnings</h3>
                  <p className="stat-number">$12,450</p>
                </div>
                <div className="stat-card">
                  <h3>Client Rating</h3>
                  <p className="stat-number">4.8★</p>
                </div>
                <div className="stat-card">
                  <h3>Cases Completed</h3>
                  <p className="stat-number">127</p>
                </div>
              </div>
              <h3 style={{marginTop: '40px'}}>Recent Cases</h3>
              <div className="cases-list">
                <div className="case-item">
                  <div className="case-header">
                    <h4>Smith vs. ABC Corp</h4>
                    <span className="status-badge active">Active</span>
                  </div>
                  <p className="case-type">Corporate Law • Filed 3 days ago</p>
                  <p className="case-desc">Contract dispute resolution</p>
                </div>
                <div className="case-item">
                  <div className="case-header">
                    <h4>Johnson Property Dispute</h4>
                    <span className="status-badge active">Active</span>
                  </div>
                  <p className="case-type">Real Estate • Filed 1 week ago</p>
                  <p className="case-desc">Boundary line dispute between neighbors</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'overview' && viewRole === 'client' && (
            <ClientServiceIntake />
          )}

          {activeTab === 'overview' && viewRole === 'admin' && (
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
            <Directory />
          )}

          {activeTab === 'referrals' && viewRole !== 'client' && (
            <div className="tab-content">
              <h2>📋 Case Referrals & Matching</h2>
              <p>Manage case referrals and intelligent professional matching.</p>
              <div className="coming-soon">Coming Soon</div>
            </div>
          )}

          {activeTab === 'referrals' && viewRole === 'client' && (
            <div className="tab-content">
              <h2>📋 My Cases</h2>
              <p>View all your submitted service requests and their status.</p>
              <div className="coming-soon">Coming Soon</div>
            </div>
          )}

          {activeTab === 'documents' && viewRole === 'client' && (
            <ClientDocuments />
          )}

          {activeTab === 'payments' && (
            <Payments />
          )}

          {activeTab === 'disputes' && (
            <div className="tab-content">
              <h2>⚖️ Dispute Resolution</h2>
              <p>Manage client-professional disputes and resolutions.</p>
              <div className="coming-soon">Coming Soon</div>
            </div>
          )}

          {activeTab === 'admin' && (
            <div className="tab-content">
              <h2>🛡️ Admin Panel</h2>
              <div className="admin-grid">
                <div className="admin-card">
                  <h3>👥 User Management</h3>
                  <p>Manage users, roles, and permissions</p>
                </div>
                <div className="admin-card">
                  <h3>📊 Analytics</h3>
                  <p>View system metrics and usage statistics</p>
                </div>
                <div className="admin-card">
                  <h3>🔧 System Config</h3>
                  <p>Configure system settings and features</p>
                </div>
                <div className="admin-card">
                  <h3>📋 Audit Logs</h3>
                  <p>View all system activity and changes</p>
                </div>
              </div>
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

              <div className="settings-divider">
                <h2 style={{marginTop: '40px'}}>🆔 Identification Verification</h2>
              </div>
              <IdentificationVerification />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
