// Dashboard - Home page after authentication
// Main hub for accessing legal services

import React, { useState, useEffect } from 'react';
import {
  CaseStatusCard,
  PrimaryButton,
  Toast,
  SupportButton
} from '@/components/UI';
import { ServiceIcon } from '../components/ServiceIcon';
import AdminRequestPanel from '../components/AdminRequestPanel';
import AdminHealthCheck from '../components/AdminHealthCheck';
import './Dashboard.css';
import { useLanguage } from '../context/LanguageContext';

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
  cost: number;
  provider?: { name: string; rating: number };
}

interface DashboardMetrics {
  activeCases: number;
  completedCases: number;
  totalSpent: number;
  averageRating: number;
}

interface SavedIntakeForm {
  id: string;
  name: string;
  email: string;
  phone: string;
  documentNumber: string;
  createdAt: string;
  service: string;
  state: string;
}

export const Dashboard: React.FC<{ onLogout?: () => void; onNavigateLawyerWebsite?: () => void; onNavigateNotary?: () => void; onNavigateLawServices?: () => void; onNavigateProviderProfile?: () => void; onNavigateServicesDirectory?: () => void; onViewAdminPreview?: () => void; onViewCaseDetails?: (caseId: string) => void }> = ({ onLogout, onNavigateLawyerWebsite, onNavigateNotary, onNavigateLawServices, onNavigateProviderProfile, onNavigateServicesDirectory, onViewAdminPreview, onViewCaseDetails }) => {
  const { t } = useLanguage();
  const [currentPage, setCurrentPage] = useState<'home' | 'cases' | 'profile'>('home');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [toast, setToast] = useState<any>(null);
  const [intakeForms, setIntakeForms] = useState<SavedIntakeForm[]>(() => {
    const saved = localStorage.getItem('transcendIntakeForms');
    return saved ? JSON.parse(saved) : [];
  });
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    activeCases: false,
    completedCases: false,
    intakeForms: false,
  });
  const [viewingForm, setViewingForm] = useState<SavedIntakeForm | null>(null);

  const toggleSection = (sectionName: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  };
  const [activeCases] = useState<ActiveCase[]>([
    {
      id: '1',
      service: 'Employment Law - Wrongful Termination',
      status: 'active',
      createdAt: '2026-08-01',
      cost: 2150,
      provider: { name: 'Sarah Johnson, Esq.', rating: 4.9 },
    },
    {
      id: '2',
      service: 'Personal Injury - Auto Accident',
      status: 'active',
      createdAt: '2026-08-05',
      cost: 1875,
      provider: { name: 'James Miller, Esq.', rating: 4.7 },
    },
    {
      id: '3',
      service: 'Divorce & Separation',
      status: 'pending',
      createdAt: '2026-08-10',
      cost: 0,
    },
  ]);

  const [completedCases] = useState<ActiveCase[]>([
    {
      id: 'C1',
      service: 'Contract Review & Negotiation',
      status: 'completed',
      createdAt: '2026-06-15',
      cost: 850,
      provider: { name: 'Michael Chen, Esq.', rating: 4.8 },
    },
    {
      id: 'C2',
      service: 'Trademark Registration',
      status: 'completed',
      createdAt: '2026-06-20',
      cost: 625,
      provider: { name: 'Rebecca Martinez, Esq.', rating: 4.9 },
    },
    {
      id: 'C3',
      service: 'Property Dispute Resolution',
      status: 'completed',
      createdAt: '2026-07-01',
      cost: 1200,
      provider: { name: 'David Kim, Esq.', rating: 4.6 },
    },
    {
      id: 'C4',
      service: 'Business Formation LLC',
      status: 'completed',
      createdAt: '2026-07-10',
      cost: 500,
      provider: { name: 'Jennifer Lee, Esq.', rating: 4.7 },
    },
  ]);

  // Calculate metrics from cases
  const metrics: DashboardMetrics = {
    activeCases: activeCases.filter(c => c.status === 'active' || c.status === 'pending').length,
    completedCases: completedCases.length,
    totalSpent: [...activeCases, ...completedCases].reduce((sum, c) => sum + c.cost, 0),
    averageRating: 4.8, // Average of all provider ratings used
  };

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
              <p>{t('dashboardPage.manageSubtitle')}</p>
            </div>

            {/* Key Metrics - Clean Grid */}
            <div className="dashboard-stats-grid">
              <div className="stat-card">
                <div className="stat-number">{metrics.activeCases}</div>
                <div className="stat-label">{t('dashboardPage.activeCases')}</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{metrics.completedCases}</div>
                <div className="stat-label">{t('dashboardPage.statusCompleted')}</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">${(metrics.totalSpent / 1000).toFixed(1)}K</div>
                <div className="stat-label">{t('dashboardPage.totalSpent')}</div>
              </div>
              <div className="stat-card">
                <div className="stat-number">{metrics.averageRating.toFixed(1)}</div>
                <div className="stat-label">{t('dashboardPage.avgRating')}</div>
              </div>
            </div>

            {/* Active Cases Section */}
            {activeCases.length > 0 && (
              <div className="dashboard-section">
                <div className="section-header-banner" onClick={() => toggleSection('activeCases')} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2><ServiceIcon name="gavel" className="section-icon" /> Your Active Cases</h2>
                    <p>{t('dashboardPage.trackSubtitle')}</p>
                  </div>
                  <span style={{ fontSize: '24px', marginRight: '12px' }}>{collapsedSections.activeCases ? '▶' : '▼'}</span>
                </div>
                {!collapsedSections.activeCases && (
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
                      <div className="case-cost">
                        <span className="cost-label">{t('dashboardPage.costToDate')}</span>
                        <span className="cost-value">${caseItem.cost.toLocaleString()}</span>
                      </div>
                      <PrimaryButton
                        onClick={() => onViewCaseDetails?.(caseItem.id)}
                        style={{ width: '100%', marginTop: '12px' }}
                      >
                        View Details →
                      </PrimaryButton>
                    </div>
                  ))}
                </div>
                )}
              </div>
            )}

            {/* Completed Cases Section */}
            {completedCases.length > 0 && (
              <div className="dashboard-section">
                <div className="section-header-banner" onClick={() => toggleSection('completedCases')} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2><ServiceIcon name="checkmark" className="section-icon" /> Completed Cases</h2>
                    <p>{t('dashboardPage.completedSubtitle')}</p>
                  </div>
                  <span style={{ fontSize: '24px', marginRight: '12px' }}>{collapsedSections.completedCases ? '▶' : '▼'}</span>
                </div>
                {!collapsedSections.completedCases && (
                <div className="dashboard-cases-grid">
                  {completedCases.map(caseItem => (
                    <div key={caseItem.id} className="case-card-clean case-card-completed">
                      <div className="case-header-clean">
                        <h3>{caseItem.service}</h3>
                        <span className="case-status-badge completed">✓ Completed</span>
                      </div>
                      {caseItem.provider && (
                        <div className="case-provider">
                          <p className="provider-name">{caseItem.provider.name}</p>
                          <p className="provider-rating">⭐ {caseItem.provider.rating}</p>
                        </div>
                      )}
                      <p className="case-date">Completed {new Date(caseItem.createdAt).toLocaleDateString()}</p>
                      <div className="case-cost">
                        <span className="cost-label">{t('dashboardPage.finalCost')}</span>
                        <span className="cost-value">${caseItem.cost.toLocaleString()}</span>
                      </div>
                      <PrimaryButton
                        onClick={() => onViewCaseDetails?.(caseItem.id)}
                        style={{ width: '100%', marginTop: '12px' }}
                      >
                        View Summary →
                      </PrimaryButton>
                    </div>
                  ))}
                </div>
                )}
              </div>
            )}

            {/* Intake Forms Section */}
            {intakeForms.length > 0 && (
              <div className="dashboard-section">
                <div className="section-header-banner" onClick={() => toggleSection('intakeForms')} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2><ServiceIcon name="documentPen" className="section-icon" /> Intake Forms</h2>
                    <p>View and export your submitted intake forms</p>
                  </div>
                  <span style={{ fontSize: '24px', marginRight: '12px' }}>{collapsedSections.intakeForms ? '▶' : '▼'}</span>
                </div>
                {!collapsedSections.intakeForms && (
                <div className="dashboard-cases-grid">
                  {intakeForms.map(form => (
                    <div key={form.id} className="case-card-clean intake-form-card">
                      <div className="case-header-clean">
                        <h3>{form.service}</h3>
                        <span className="form-doc-id">ID: {form.documentNumber}</span>
                      </div>
                      <div className="form-details">
                        <p className="form-field"><strong>State:</strong> {form.state}</p>
                        <p className="form-field"><strong>Submitted:</strong> {new Date(form.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="form-actions">
                        <button className="view-form-btn" onClick={() => setViewingForm(form)} style={{ flex: 1, padding: '8px 12px', background: '#667eea', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', marginRight: '8px' }}>
                          📄 View
                        </button>
                        <button className="download-btn" onClick={() => window.alert(`Export PDF: ${form.documentNumber}`)} style={{ flex: 1, padding: '8px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                          ⬇️ PDF
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </div>
            )}

          </>
        )}

        {currentPage === 'cases' && (
          <section className="cases-section">
            <div className="section-header">
              <h2>{t('dashboardPage.yourCases')}</h2>
              <div className="filter-controls">
                <button className="filter-btn active">All</button>
                <button className="filter-btn">Active</button>
                <button className="filter-btn">{t('dashboardPage.statusCompleted')}</button>
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
                  <button className="view-case-btn">{t('dashboardPage.viewDetails')}</button>
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
                <h3>{t('dashboardPage.accountInformation')}</h3>
                <div className="profile-field">
                  <label>{t('login.email')}</label>
                  <p>{user?.email}</p>
                </div>
                <div className="profile-field">
                  <label>{t('dashboardPage.userType')}</label>
                  <p>{user?.userType}</p>
                </div>
                <button className="edit-btn">{t('dashboardPage.editProfile')}</button>
              </div>

              <div className="profile-card">
                <h3>{t('dashboardPage.preferences')}</h3>
                <div className="toggle-item">
                  <label>{t('dashboardPage.emailNotifications')}</label>
                  <input type="checkbox" defaultChecked />
                </div>
                <div className="toggle-item">
                  <label>{t('dashboardPage.darkMode')}</label>
                  <input type="checkbox" />
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* View Intake Form Modal */}
      {viewingForm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '8px', maxWidth: '700px', width: '95%', maxHeight: '90vh', overflow: 'auto', padding: '32px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, color: '#111827', fontSize: '28px', fontWeight: '700' }}>{viewingForm.service} Intake Form</h2>
              <button onClick={() => setViewingForm(null)} style={{ background: 'none', border: 'none', fontSize: '28px', cursor: 'pointer', color: '#6b7280', padding: 0 }}>✕</button>
            </div>

            <div style={{ backgroundColor: '#f3f4f6', padding: '16px', borderRadius: '8px', marginBottom: '24px', borderLeft: '4px solid #667eea' }}>
              <p style={{ margin: '8px 0', fontSize: '14px', color: '#374151' }}><strong>Document ID:</strong> <code style={{ backgroundColor: '#e0e7ff', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', color: '#4f46e5' }}>{viewingForm.documentNumber}</code></p>
              <p style={{ margin: '8px 0', fontSize: '14px', color: '#374151' }}><strong>Service:</strong> {viewingForm.service}</p>
              <p style={{ margin: '8px 0', fontSize: '14px', color: '#374151' }}><strong>State:</strong> {viewingForm.state}</p>
              <p style={{ margin: '8px 0', fontSize: '14px', color: '#374151' }}><strong>Submitted:</strong> {new Date(viewingForm.createdAt).toLocaleDateString()}</p>
            </div>

            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '16px', marginTop: '24px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Your Information</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div style={{ paddingBottom: '12px', borderBottom: '1px solid #e5e7eb' }}>
                <p style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Name</p>
                <p style={{ margin: 0, fontSize: '14px', color: '#111827' }}>{viewingForm.name}</p>
              </div>
              <div style={{ paddingBottom: '12px', borderBottom: '1px solid #e5e7eb' }}>
                <p style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Email</p>
                <p style={{ margin: 0, fontSize: '14px', color: '#111827' }}>{viewingForm.email}</p>
              </div>
              <div style={{ paddingBottom: '12px', borderBottom: '1px solid #e5e7eb', gridColumn: '1 / -1' }}>
                <p style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>Phone</p>
                <p style={{ margin: 0, fontSize: '14px', color: '#111827' }}>{viewingForm.phone}</p>
              </div>
            </div>

            <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '16px', marginTop: '24px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Form Details</h3>
            <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
              {Object.entries(viewingForm).map(([key, value]) => {
                if (['name', 'email', 'phone', 'documentNumber', 'createdAt', 'service', 'state', 'id'].includes(key) || !value) {
                  return null;
                }
                return (
                  <div key={key} style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #e5e7eb' }}>
                    <p style={{ margin: '0 0 4px 0', fontSize: '12px', fontWeight: '600', color: '#374151', textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                    <p style={{ margin: 0, fontSize: '14px', color: '#111827', lineHeight: '1.5', wordBreak: 'break-word' }}>{String(value)}</p>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button onClick={() => window.alert(`Export PDF: ${viewingForm.documentNumber}`)} style={{ padding: '12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
                📄 Export PDF
              </button>
              <button onClick={() => setViewingForm(null)} style={{ padding: '12px', background: '#667eea', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
