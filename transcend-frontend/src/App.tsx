import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import './App.css';

const AppContent: React.FC = () => {
  const { user, token, logout } = useAuth();
  const [showDashboard, setShowDashboard] = useState(!!token && !!user);

  const handleLoginSuccess = () => {
    setShowDashboard(true);
  };

  const handleLogout = () => {
    logout();
    setShowDashboard(false);
  };

  return (
    <div className="app">
      {showDashboard && token && user ? (
        <Dashboard onLogout={handleLogout} />
      ) : (
        <Login onSuccess={handleLoginSuccess} />
      )}
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
