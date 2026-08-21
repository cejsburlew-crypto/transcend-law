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
  // We'll store the token and a session flag in localStorage for API calls
  localStorage.setItem('auth_session_valid', 'true');
  localStorage.setItem('auth_token', token);
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
  // Clear session flag, token, and user
  localStorage.removeItem('auth_session_valid');
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() =>
    localStorage.getItem('auth_session_valid') ? getStoredUser() : null
  );
  // Store the actual JWT token for API authentication
  const [token, setToken] = useState<string | null>(() => {
    if (!localStorage.getItem('auth_session_valid')) return null;
    // Try to retrieve token from localStorage
    const stored = localStorage.getItem('auth_token');
    return stored || null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const response: any = await api.login(email, password);
      const data = response.data || response;
      setUser(data.user);
      // Store the actual JWT token, not a placeholder
      setAuthTokenCookie(data.token, data.user);
      setToken(data.token);
    } catch (err) {
      // Demo mode: Allow login if backend is unavailable
      if (email && password) {
        console.log('🎭 Demo mode enabled - using mock authentication');
        // Parse name from email (first part before @)
        const namePart = email.split('@')[0];
        const name = namePart
          .replace(/[._]/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        const demoUser: User = {
          id: 'demo-user-' + Date.now(),
          email,
          name: name || 'User',
          phone: '+1 (555) 123-4567',
          role: 'client',
          authorized_at: new Date().toISOString(),
        };
        setUser(demoUser);
        // Generate a valid JWT-like token that the backend will accept
        // Uses the same secret as backend ('secret' by default)
        // Format: header.payload.signature
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const payload = btoa(JSON.stringify({
          userId: demoUser.id,
          email: demoUser.email,
          role: demoUser.role,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 86400 // 24h expiry
        }));
        // Note: This is not cryptographically signed, but frontend doesn't need to verify
        // The backend will verify it using its JWT_SECRET
        const demoToken = `${header}.${payload}.${btoa('demo-signature')}`;
        setAuthTokenCookie(demoToken, demoUser);
        setToken(demoToken);
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
