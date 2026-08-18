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
import Breadcrumbs from './components/Navigation/Breadcrumbs';
import type { BreadcrumbItem } from './components/Navigation/Breadcrumbs';
import './App.css';

const AppContent: React.FC = () => {
  const { t } = useLanguage();
  const { user, token, logout } = useAuth();
  const [currentView, setCurrentView] = useState<'landing' | 'login' | 'dashboard' | 'lawyer-website' | 'admin-role-preview' | 'notary' | 'law-services' | 'provider-profile' | 'services-directory'>(
    token && user ? 'services-directory' : 'landing'
  );

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
      default:
        return [];
    }
  };

  return (
    <div className="app">
      {currentView !== 'landing' && currentView !== 'dashboard' && <Breadcrumbs items={getBreadcrumbs()} />}
      {currentView === 'admin-role-preview' && token && user ? (
        <AdminRolePreview />
      ) : currentView === 'provider-profile' && token && user ? (
        <MyProviderProfile onBack={() => setCurrentView('dashboard')} />
      ) : currentView === 'services-directory' && token && user ? (
        <ServicesDirectory />
      ) : currentView === 'law-services' && token && user ? (
        <LawServices onBack={() => setCurrentView('dashboard')} />
      ) : currentView === 'notary' && token && user ? (
        <NotaryServices onBack={() => setCurrentView('dashboard')} />
      ) : currentView === 'lawyer-website' && token && user ? (
        <LawyerWebsiteSetup onBack={() => setCurrentView('dashboard')} />
      ) : currentView === 'dashboard' && token && user ? (
        <Dashboard onLogout={handleLogout} onNavigateLawyerWebsite={() => setCurrentView('lawyer-website')} onNavigateNotary={() => setCurrentView('notary')} onNavigateLawServices={() => setCurrentView('law-services')} onNavigateProviderProfile={() => setCurrentView('provider-profile')} onNavigateServicesDirectory={() => setCurrentView('services-directory')} onViewAdminPreview={() => setCurrentView('admin-role-preview')} />
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