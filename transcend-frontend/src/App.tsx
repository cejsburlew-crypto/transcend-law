import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import LawyerWebsiteSetup from './pages/LawyerWebsiteSetup';
import AdminRolePreview from './pages/AdminRolePreview';
import { NotaryServices } from './pages/NotaryServices';
import { LawServices } from './pages/LawServices';
import { MyProviderProfile } from './pages/MyProviderProfile';
import { ServicesDirectory } from './pages/ServicesDirectory';
import { Messages } from './pages/Messages';
import { CaseDetails } from './pages/CaseDetails';
import ClientPortal from './pages/ClientPortal';
import Breadcrumbs from './components/Navigation/Breadcrumbs';
import type { BreadcrumbItem } from './components/Navigation/Breadcrumbs';
import { LanguageSelector } from './components/LanguageSelector';
import { ServiceIcon } from './components/ServiceIcon';
import UserProfile from './pages/UserProfile';
import ProviderProfile from './pages/ProviderProfile';
import './App.css';

const AppContent: React.FC = () => {
  const { t } = useLanguage();
  const { user, token, logout } = useAuth();
  const [currentView, setCurrentView] = useState<'landing' | 'login' | 'dashboard' | 'lawyer-website' | 'admin-role-preview' | 'notary' | 'law-services' | 'provider-profile' | 'services-directory' | 'messages' | 'case-details' | 'user-profile' | 'client-portal'>(
    token && user ? 'services-directory' : 'landing'
  );
  const [selectedCaseId, setSelectedCaseId] = useState<string>('1');

  React.useEffect(() => {
    // Ensure light mode is always active
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  React.useEffect(() => {
    if (token && user && currentView === 'landing') {
      setCurrentView('services-directory');
    }
  }, [token, user, currentView]);

  const handleGetStarted = () => {
    setCurrentView('login');
  };

  const handleLoginSuccess = () => {
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    logout();
    setCurrentView('landing');
  };

  const getBreadcrumbs = (): BreadcrumbItem[] => {
    switch (currentView) {
      case 'landing':
        return [{ label: t('home'), icon: '⚖️', onClick: () => {} }];
      case 'login':
        return [
          { label: t('home'), icon: '⚖️', onClick: () => setCurrentView('landing') },
          { label: t('signIn'), icon: '🔑' },
        ];
      case 'dashboard':
        return [
          { label: t('home'), icon: '⚖️', onClick: () => setCurrentView('landing') },
          { label: t('dashboard'), icon: '📊' },
        ];
      case 'lawyer-website':
        return [
          { label: t('home'), icon: '⚖️', onClick: () => setCurrentView('landing') },
          { label: 'Dashboard', icon: '📊', onClick: () => setCurrentView('dashboard') },
          { label: 'My Website', icon: '🌐' },
        ];
      case 'admin-role-preview':
        return [
          { label: t('home'), icon: '⚖️', onClick: () => setCurrentView('landing') },
          { label: 'Admin', icon: '👨‍💼', onClick: () => setCurrentView('dashboard') },
          { label: 'Role Preview', icon: '🔍' },
        ];
      case 'notary':
        return [
          { label: t('home'), icon: '⚖️', onClick: () => setCurrentView('landing') },
          { label: t('dashboard'), icon: '📊', onClick: () => setCurrentView('dashboard') },
          { label: 'Notary Services', icon: '📝' },
        ];
      case 'law-services':
        return [
          { label: t('home'), icon: '⚖️', onClick: () => setCurrentView('landing') },
          { label: t('dashboard'), icon: '📊', onClick: () => setCurrentView('dashboard') },
          { label: 'Legal Services', icon: '⚖️' },
        ];
      case 'provider-profile':
        return [
          { label: t('home'), icon: '⚖️', onClick: () => setCurrentView('landing') },
          { label: t('dashboard'), icon: '📊', onClick: () => setCurrentView('dashboard') },
          { label: 'My Profile', icon: '📋' },
        ];
      case 'services-directory':
        return [
          { label: t('home'), icon: '⚖️', onClick: () => setCurrentView('landing') },
          { label: t('dashboard'), icon: '📊', onClick: () => setCurrentView('dashboard') },
          { label: 'Services', icon: '📚' },
        ];
      case 'user-profile':
        return [
          { label: t('home'), icon: '⚖️', onClick: () => setCurrentView('landing') },
          { label: 'Profile', icon: '👤' },
        ];
      default:
        return [];
    }
  };

  return (
    <div className="app">
      {/* Global Header for all authenticated pages - PINNED */}
      {token && user && currentView !== 'landing' && currentView !== 'login' && (
        <>
          <header className="global-header">
            <div className="global-header__brand">
              <ServiceIcon name="scales" className="global-header__logo-icon" />
              <span>{t('nav.brand')}</span>
            </div>
            <nav className="global-nav">
              <button
                type="button"
                className={`global-nav__link ${currentView === 'dashboard' ? 'is-active' : ''}`}
                onClick={() => setCurrentView('dashboard')}
              >
                <ServiceIcon name="dashboard" className="global-nav__icon" />
                <span>{t('nav.dashboard')}</span>
              </button>
              <button
                type="button"
                className={`global-nav__link ${currentView === 'services-directory' ? 'is-active' : ''}`}
                onClick={() => setCurrentView('services-directory')}
              >
                <ServiceIcon name="courthouse" className="global-nav__icon" />
                <span>{t('nav.services')}</span>
              </button>
              <button
                type="button"
                className={`global-nav__link ${currentView === 'messages' ? 'is-active' : ''}`}
                onClick={() => setCurrentView('messages')}
              >
                <ServiceIcon name="chat" className="global-nav__icon" />
                <span>{t('nav.messages')}</span>
              </button>
            </nav>
            <div className="global-header__actions">
              <button
                type="button"
                className="global-header__profile-btn"
                onClick={() => setCurrentView('user-profile')}
                title="Profile"
                aria-label="User profile"
              >
                <ServiceIcon name="user" className="global-header__profile-icon" />
              </button>
              <div className="global-header__lang">
                <LanguageSelector />
              </div>
            </div>
          </header>
          {/* Offsets the fixed header; height is driven by --global-header-h */}
          <div className="global-header-spacer" />
        </>
      )}
      {/* Breadcrumbs hidden - use navigation menus instead */}
      {currentView === 'user-profile' && token && user ? (
        <UserProfile onNavigateProvider={() => setCurrentView('provider-profile')} onBack={() => setCurrentView('dashboard')} />
      ) : currentView === 'client-portal' && token && user ? (
        <ClientPortal />
      ) : currentView === 'case-details' && token && user ? (
        <CaseDetails caseId={selectedCaseId} onBack={() => setCurrentView('dashboard')} />
      ) : currentView === 'admin-role-preview' && token && user ? (
        <AdminRolePreview />
      ) : currentView === 'provider-profile' && token && user ? (
        <ProviderProfile onBack={() => setCurrentView('dashboard')} />
      ) : currentView === 'messages' && token && user ? (
        <Messages />
      ) : currentView === 'services-directory' && token && user ? (
        <ServicesDirectory />
      ) : currentView === 'law-services' && token && user ? (
        <LawServices onBack={() => setCurrentView('dashboard')} />
      ) : currentView === 'notary' && token && user ? (
        <NotaryServices onBack={() => setCurrentView('dashboard')} />
      ) : currentView === 'lawyer-website' && token && user ? (
        <LawyerWebsiteSetup onBack={() => setCurrentView('dashboard')} />
      ) : currentView === 'dashboard' && token && user ? (
        <Dashboard onLogout={handleLogout} onNavigateLawyerWebsite={() => setCurrentView('lawyer-website')} onNavigateNotary={() => setCurrentView('notary')} onNavigateLawServices={() => setCurrentView('law-services')} onNavigateProviderProfile={() => setCurrentView('provider-profile')} onNavigateServicesDirectory={() => setCurrentView('services-directory')} onViewAdminPreview={() => setCurrentView('admin-role-preview')} onViewCaseDetails={(caseId) => { setSelectedCaseId(caseId); setCurrentView('case-details'); }} />
      ) : currentView === 'login' ? (
        <Login onSuccess={handleLoginSuccess} />
      ) : (
        <Landing onGetStarted={handleGetStarted} />
      )}
    </div>
  );
};

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;