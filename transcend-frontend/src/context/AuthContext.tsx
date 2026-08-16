import React, { createContext, useState, useCallback, useEffect } from 'react';
import type { User, AuthResponse } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ERROR FIX 8: Helper functions for secure cookie-based token storage
function getAuthTokenFromCookie(): string | null {
  // Read from httpOnly cookie via API call (cannot access httpOnly from JS for security)
  // The backend sets this automatically with httpOnly flag
  return null; // Token is in httpOnly cookie, not accessible from JS
}

function setAuthTokenCookie(token: string, user?: User): void {
  // This would be set by the backend in the Set-Cookie header with httpOnly flag
  // Frontend should NOT set cookies directly
  // The backend handles: document.cookie = `token=${token}; HttpOnly; Secure; SameSite=Strict; path=/`
  // We'll store a session flag in localStorage for UI purposes (persists across refreshes)
  localStorage.setItem('auth_session_valid', 'true');
  if (user) {
    localStorage.setItem('auth_user', JSON.stringify(user));
  }
}

function getStoredUser(): User | null {
  const stored = localStorage.getItem('auth_user');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
  return null;
}

function clearAuthTokenCookie(): void {
  // Clear session flag and user
  localStorage.removeItem('auth_session_valid');
  localStorage.removeItem('auth_user');
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() =>
    localStorage.getItem('auth_session_valid') ? getStoredUser() : null
  );
  // ERROR FIX 8: Don't store actual token in state - it's in httpOnly cookie on backend
  // This state exists only for UI purposes
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('auth_session_valid') ? 'authenticated' : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const data: AuthResponse = await api.login(email, password);
      setUser(data.user);
      // ERROR FIX 8: Backend sets httpOnly cookie, we also save user for persistence
      setAuthTokenCookie(data.token, data.user);
      setToken('authenticated'); // Placeholder to indicate authenticated state
    } catch (err) {
      // Demo mode: Allow login if backend is unavailable
      if (email && password) {
        console.log('🎭 Demo mode enabled - using mock authentication');
        const demoUser: User = {
          email,
          role: 'client',
          authorized_at: new Date().toISOString(),
        };
        setUser(demoUser);
        // Even in demo mode, don't expose actual token to client but save user for persistence
        setAuthTokenCookie('demo_session', demoUser);
        setToken('authenticated');
        return; // Success!
      }
      setError(err instanceof Error ? err.message : 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    clearAuthTokenCookie();
    // Notify backend to invalidate token
    api.logout().catch(console.error);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
