import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import Breadcrumbs from './components/Navigation/Breadcrumbs';
import type { BreadcrumbItem } from './components/Navigation/Breadcrumbs';
import './App.css';

const AppContent: React.FC = () => {
  const { t } = useLanguage();
  const { user, token, logout } = useAuth();
  const [currentView, setCurrentView] = useState<'landing' | 'login' | 'dashboard'>(
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
      default:
        return [];
    }
  };

  return (
    <div className="app">
      {currentView !== 'landing' && <Breadcrumbs items={getBreadcrumbs()} />}
      {currentView === 'dashboard' && token && user ? (
        <Dashboard onLogout={handleLogout} />
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
