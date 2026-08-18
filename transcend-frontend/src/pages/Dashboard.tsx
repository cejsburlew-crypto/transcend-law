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


      {/* Main Content */}
      <main className="dashboard-main">
        {currentPage === 'home' && (
          <>
            {/* Dashboard Header Banner */}
            <div className="dashboard-header-banner">
              <h1>Welcome back, {user?.firstName}! 👋</h1>
              <p>Manage your cases and track progress with verified legal professionals</p>
            </div>

            {/* Key Metrics - Clean Grid */}
            <div className="dashboard-stats-grid">
              <div className="stat-card">
                <div className="stat-number">{metrics.activeCases}</div>
                <div className="stat-label">Active Cases</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{metrics.completedCases}</div>
                <div className="stat-label">Completed</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">${(metrics.totalSpent / 1000).toFixed(1)}K</div>
                <div className="stat-label">Total Spent</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{metrics.averageRating.toFixed(1)}</div>
                <div className="stat-label">Avg Rating</div>
              </div>
            </div>

            {/* Active Cases Section */}
            {activeCases.length > 0 && (
              <div className="dashboard-section">
                <h2>Your Active Cases</h2>
                <div className="dashboard-cases-grid">
                  {activeCases.map(caseItem => (
                    <div key={caseItem.id} className="case-card-clean">
                      <div className="case-header-clean">
                        <h3>{caseItem.service}</h3>
                        <span className={`case-status-badge ${caseItem.status}`}>
                          {caseItem.status === 'active' ? 'In Progress' : caseItem.status === 'pending' ? 'Pending' : 'Completed'}
                        </span>
                      </div>
                      {caseItem.provider && (
                        <div className="case-provider">
                          <p className="provider-name">{caseItem.provider.name}</p>
                          <p className="provider-rating">⭐ {caseItem.provider.rating}</p>
                        </div>
                      )}
                      <p className="case-date">Started {new Date(caseItem.createdAt).toLocaleDateString()}</p>
                      <PrimaryButton
                        onClick={() => showToast('info', `Opening ${caseItem.service}...`)}
                        style={{ width: '100%', marginTop: '12px' }}
                      >
                        View Details →
                      </PrimaryButton>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
