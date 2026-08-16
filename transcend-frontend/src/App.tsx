import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { DarkModeProvider } from './context/DarkModeContext';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import LawyerWebsiteSetup from './pages/LawyerWebsiteSetup';
import AdminRolePreview from './pages/AdminRolePreview';
import Breadcrumbs from './components/Navigation/Breadcrumbs';
import type { BreadcrumbItem } from './components/Navigation/Breadcrumbs';
import './App.css';

const AppContent: React.FC = () => {
  const { t } = useLanguage();
  const { user, token, logout } = useAuth();
  const [currentView, setCurrentView] = useState<'landing' | 'login' | 'dashboard' | 'lawyer-website' | 'admin-role-preview'>(
    token && user ? 'dashboard' : 'landing'
  );
  const [isDark, setIsDark] = useState(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.getAttribute('data-theme') === 'dark';
  });

  const toggleDarkMode = () => {
    const html = document.documentElement;
    const newIsDark = !isDark;
    if (newIsDark) {
      html.setAttribute('data-theme', 'dark');
    } else {
      html.setAttribute('data-theme', 'light');
    }
    setIsDark(newIsDark);
  };

  React.useEffect(() => {
    // Initialize light mode on page load
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    if (!currentTheme) {
      html.setAttribute('data-theme', 'light');
      setIsDark(false);
    }
  }, []);

  React.useEffect(() => {
    if (token && user && currentView === 'landing') {
      setCurrentView('dashboard');
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
      default:
        return [];
    }
  };

  return (
    <div className="app">
      <button
        type="button"
        onClick={toggleDarkMode}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className="theme-toggle-app-btn"
      >
        {isDark ? '☀️' : '🌙'}
      </button>
      {currentView !== 'landing' && <Breadcrumbs items={getBreadcrumbs()} />}
      {currentView === 'admin-role-preview' && token && user ? (
        <AdminRolePreview />
      ) : currentView === 'lawyer-website' && token && user ? (
        <LawyerWebsiteSetup onBack={() => setCurrentView('dashboard')} />
      ) : currentView === 'dashboard' && token && user ? (
        <Dashboard onLogout={handleLogout} onNavigateLawyerWebsite={() => setCurrentView('lawyer-website')} onViewAdminPreview={() => setCurrentView('admin-role-preview')} />
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
    <DarkModeProvider>
      <LanguageProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </LanguageProvider>
    </DarkModeProvider>
  );
}

export default App;