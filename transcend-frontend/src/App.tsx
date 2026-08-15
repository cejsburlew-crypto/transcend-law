import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { DarkModeProvider } from './context/DarkModeContext';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { LawyerWebsiteSetup } from './pages/LawyerWebsiteSetup';
import Breadcrumbs from './components/Navigation/Breadcrumbs';
import type { BreadcrumbItem } from './components/Navigation/Breadcrumbs';
import './App.css';

const AppContent: React.FC = () => {
  const { t } = useLanguage();
  const { user, token, logout } = useAuth();
  const [currentView, setCurrentView] = useState<'landing' | 'login' | 'dashboard' | 'lawyer-website'>(
    token && user ? 'dashboard' : 'landing'
  );

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
      default:
        return [];
    }
  };

  return (
    <div className="app">
      {currentView !== 'landing' && <Breadcrumbs items={getBreadcrumbs()} />}
      {currentView === 'lawyer-website' && token && user ? (
        <LawyerWebsiteSetup onBack={() => setCurrentView('dashboard')} />
      ) : currentView === 'dashboard' && token && user ? (
        <Dashboard onLogout={handleLogout} onNavigateLawyerWebsite={() => setCurrentView('lawyer-website')} />
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
