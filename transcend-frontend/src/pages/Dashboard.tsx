// Dashboard - Home page after authentication
// Main hub for accessing legal services

import React, { useState, useEffect } from 'react';
import {
  CaseStatusCard,
  PrimaryButton,
  Toast,
  SupportButton
} from '@/components/UI';
import AdminRequestPanel from '../components/AdminRequestPanel';
import AdminHealthCheck from '../components/AdminHealthCheck';
import './Dashboard.css';

interface UserProfile {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  userType: string;
}

interface ActiveCase {
  id: string;
  service: string;
  status: 'pending' | 'active' | 'completed';
  createdAt: string;
  provider?: { name: string; rating: number };
}

interface DashboardMetrics {
  activeCases: number;
  completedCases: number;
  totalSpent: number;
  averageRating: number;
}

export const Dashboard: React.FC<{ onLogout?: () => void; onNavigateLawyerWebsite?: () => void; onNavigateNotary?: () => void; onNavigateLawServices?: () => void; onNavigateProviderProfile?: () => void; onNavigateServicesDirectory?: () => void; onViewAdminPreview?: () => void }> = ({ onLogout, onNavigateLawyerWebsite, onNavigateNotary, onNavigateLawServices, onNavigateProviderProfile, onNavigateServicesDirectory, onViewAdminPreview }) => {
  const [currentPage, setCurrentPage] = useState<'home' | 'cases' | 'profile'>('home');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [metrics] = useState<DashboardMetrics>({
    activeCases: 3,
    completedCases: 12,
    totalSpent: 4850,
    averageRating: 4.8,
  });
  const [toast, setToast] = useState<any>(null);
  const [activeCases] = useState<ActiveCase[]>([
    {
      id: '1',
      service: 'Employment Law - Wrongful Termination',
      status: 'active',
      createdAt: '2026-08-01',
      provider: { name: 'Sarah Johnson, Esq.', rating: 4.9 },
    },
    {
      id: '2',
      service: 'Personal Injury - Auto Accident',
      status: 'active',
      createdAt: '2026-08-05',
      provider: { name: 'James Miller, Esq.', rating: 4.7 },
    },
    {
      id: '3',
      service: 'Divorce & Separation',
      status: 'pending',
      createdAt: '2026-08-10',
    },
  ]);

  const showToast = (type: 'success' | 'error' | 'warning' | 'info', message: string) => {
    setToast({ type, message, duration: 3000, onClose: () => setToast(null) });
  };

  useEffect(() => {
    const email = localStorage.getItem('userEmail');
    if (email) {
      setUser({
        userId: localStorage.getItem('userId') || '',
        email,
        firstName: 'Alex',
        lastName: 'Thompson',
        userType: 'client',
      });
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userEmail');
    if (onLogout) onLogout();
  };

  const getInitials = () => {
    if (user) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return 'U';
  };

  // Check if user is admin
  const isAdmin = user?.userType === 'admin' || localStorage.getItem('userRole') === 'admin';

  return (
    <div className="dashboard-container">
      {/* Admin Systems - Request Panel & Health Check */}
      {isAdmin && (
        <div className="admin-systems">
          <AdminRequestPanel isOpen={true} />
          <AdminHealthCheck autoRun={true} checkInterval={300000} />
        </div>
      )}

      {/* Privacy Disclaimer */}
      <div className="privacy-banner">
        <div className="privacy-banner-content">
          <p>
            <strong>🔒 Your Privacy is Protected:</strong> Your personal information is kept confidential. Attorneys will NOT see your identifying information until you accept their quote and choose to communicate directly.
          </p>
        </div>
      </div>
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <div className="logo">⚖️ Transcend Legal</div>
          <nav className="main-nav">
            <button
              className={`nav-item ${currentPage === 'home' ? 'active' : ''}`}
              onClick={() => setCurrentPage('home')}
            >
              🏠 Home
            </button>
            <button
              className={`nav-item ${currentPage === 'cases' ? 'active' : ''}`}
              onClick={() => setCurrentPage('cases')}
            >
              📋 Cases ({metrics.activeCases})
            </button>
            <button className="nav-item">💬 Messages</button>
          </nav>
        </div>

        <div className="header-right">
          <button className="help-btn" title="Help">
            ❓
          </button>
          <div className="user-menu">
            <div className="user-avatar">{getInitials()}</div>
            <div className="dropdown-menu">
              <button
                className={`dropdown-item ${currentPage === 'profile' ? 'active' : ''}`}
                onClick={() => setCurrentPage('profile')}
              >
                👤 Profile
              </button>
              <button className="dropdown-item" onClick={onNavigateProviderProfile}>
                📋 My Provider Profile
              </button>
              <button className="dropdown-item">🔔 Notifications</button>
              <button className="dropdown-item">⚙️ Settings</button>
              <button className="dropdown-item" onClick={onViewAdminPreview}>
                👨‍💼 View Admin Roles
              </button>
              <hr />
              <button className="dropdown-item logout" onClick={handleLogout}>
                🚪 Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {currentPage === 'home' && (
          <>
            {/* Dashboard Header Banner */}
            <div className="dashboard-header-banner">
              <h1>📊 Your Dashboard</h1>
              <p>Manage your cases, track progress, and connect with verified legal professionals</p>
            </div>

            {/* Welcome Section */}
            <section className="welcome-section">
              <div className="welcome-content">
                <h1>Welcome back, {user?.firstName}! 👋</h1>
                <p>Your legal services hub - Find attorneys, manage cases, and track progress</p>
              </div>
              <PrimaryButton onClick={() => showToast('success', 'Starting new case...')}>
                + New Case
              </PrimaryButton>
            </section>

            {/* Metrics Cards */}
            <section className="metrics-section">
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-icon">📂</div>
                  <div className="metric-content">
                    <div className="metric-value">{metrics.activeCases}</div>
                    <div className="metric-label">Active Cases</div>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-icon">✅</div>
                  <div className="metric-content">
                    <div className="metric-value">{metrics.completedCases}</div>
                    <div className="metric-label">Completed</div>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-icon">💰</div>
                  <div className="metric-content">
                    <div className="metric-value">${metrics.totalSpent.toLocaleString()}</div>
                    <div className="metric-label">Total Spent</div>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-icon">⭐</div>
                  <div className="metric-content">
                    <div className="metric-value">{metrics.averageRating.toFixed(1)}</div>
                    <div className="metric-label">Avg Rating</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Quick Actions */}
            <section className="quick-actions-section">
              <h2>Quick Actions</h2>
              <div className="actions-grid">
                <button className="action-card" onClick={onNavigateLawServices}>
                  <span className="action-icon">👨‍⚖️</span>
                  <span className="action-text">Attorney Services</span>
                </button>
                <button className="action-card" onClick={onNavigateNotary}>
                  <span className="action-icon">🔏</span>
                  <span className="action-text">Notary Services</span>
                </button>
                <button className="action-card">
                  <span className="action-icon">📝</span>
                  <span className="action-text">File Form</span>
                </button>
                <button className="action-card">
                  <span className="action-icon">💬</span>
                  <span className="action-text">Chat</span>
                </button>
                <button className="action-card">
                  <span className="action-icon">📚</span>
                  <span className="action-text">Resources</span>
                </button>
                <button className="action-card">
                  <span className="action-icon">💳</span>
                  <span className="action-text">Billing</span>
                </button>
              </div>
            </section>

            {/* Active Cases - Psychology Optimized */}
            <section className="active-cases-section">
              <div className="section-header">
                <h2>Your Active Cases</h2>
                <button className="view-all-btn">View All →</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '16px' }}>
                {activeCases.map(caseItem => {
                  const progressMap: { [key: string]: number } = {
                    '1': 65,
                    '2': 40,
                    '3': 10,
                  };
                  const statusMap: { [key: string]: 'pending' | 'in-progress' | 'review' | 'complete' } = {
                    'pending': 'pending',
                    'active': 'in-progress',
                    'completed': 'complete',
                  };
                  return (
                    <div key={caseItem.id}>
                      <CaseStatusCard
                        title={caseItem.service}
                        status={statusMap[caseItem.status] || 'pending'}
                        progress={progressMap[caseItem.id] || 0}
                        lastUpdate={new Date(caseItem.createdAt).toLocaleDateString()}
                        nextStep={caseItem.provider ? `Waiting for attorney response` : 'Waiting for attorney assignment'}
                      />
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <PrimaryButton
                          onClick={() => showToast('info', `Opening ${caseItem.service}...`)}
                          style={{ flex: 1 }}
                        >
                          View Details
                        </PrimaryButton>
                        <button
                          className="btn-secondary"
                          onClick={() => showToast('info', 'Opening messages...')}
                          style={{ flex: 1, padding: '10px' }}
                        >
                          Message
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Subscription Info */}
            <section className="subscription-section">
              <div className="subscription-card">
                <div className="subscription-content">
                  <h3>Your Current Plan</h3>
                  <p className="plan-name">Professional - $149/month</p>
                  <p className="plan-features">Unlimited consultations • Priority support • Document review</p>
                </div>
                <button className="upgrade-btn">Upgrade →</button>
              </div>
            </section>
          </>
        )}

        {currentPage === 'cases' && (
          <section className="cases-section">
            <div className="section-header">
              <h2>Your Cases</h2>
              <div className="filter-controls">
                <button className="filter-btn active">All</button>
                <button className="filter-btn">Active</button>
                <button className="filter-btn">Completed</button>
              </div>
            </div>
            <div className="cases-grid">
              {activeCases.map(caseItem => (
                <div key={caseItem.id} className="case-card">
                  <div className="case-header">
                    <h4>{caseItem.service}</h4>
                    <div className={`status-badge ${caseItem.status}`}>{caseItem.status}</div>
                  </div>
                  <p className="case-date">Started {new Date(caseItem.createdAt).toLocaleDateString()}</p>
                  {caseItem.provider && (
                    <div className="provider-section">
                      <p className="provider-name">{caseItem.provider.name}</p>
                      <p className="provider-rating">⭐ {caseItem.provider.rating}</p>
                    </div>
                  )}
                  <button className="view-case-btn">View Details →</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {currentPage === 'profile' && (
          <section className="profile-section">
            <div className="profile-header">
              <div className="profile-avatar-large">{getInitials()}</div>
              <div className="profile-info">
                <h2>
                  {user?.firstName} {user?.lastName}
                </h2>
                <p>{user?.email}</p>
                <p className="user-type">📊 {user?.userType === 'client' ? 'Client' : user?.userType}</p>
              </div>
            </div>

            <div className="profile-cards">
              <div className="profile-card">
                <h3>Account Information</h3>
                <div className="profile-field">
                  <label>Email</label>
                  <p>{user?.email}</p>
                </div>
                <div className="profile-field">
                  <label>User Type</label>
                  <p>{user?.userType}</p>
                </div>
                <button className="edit-btn">Edit Profile</button>
              </div>

              <div className="profile-card">
                <h3>Preferences</h3>
                <div className="toggle-item">
                  <label>Email Notifications</label>
                  <input type="checkbox" defaultChecked />
                </div>
                <div className="toggle-item">
                  <label>Dark Mode</label>
                  <input type="checkbox" />
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Toast Notification */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000 }}>
          <Toast {...toast} />
        </div>
      )}

      {/* Support Button - Always Visible */}
      <SupportButton onClick={() => showToast('info', 'Support panel opening...')} />
    </div>
  );
};

export default Dashboard;
