// Login Component
// User authentication with email and password

import React, { useState } from 'react';
import './Auth.css';

interface LoginProps {
  onLoginSuccess?: (userId: string, token: string) => void;
  onNavigateToSignup?: () => void;
  className?: string;
}

export const Login: React.FC<LoginProps> = ({
  onLoginSuccess,
  onNavigateToSignup,
  className = '',
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const validateForm = () => {
    if (!email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!password) {
      setError('Password is required');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/v2/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          password,
          rememberMe,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Login failed. Please try again.');
        setLoading(false);
        return;
      }

      // Store token
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('userId', data.userId);
      localStorage.setItem('userEmail', email);

      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
      }

      onLoginSuccess?.(data.userId, data.token);
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
      setLoading(false);
    }
  };

  return (
    <div className={`auth-container login-container ${className}`}>
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">⚖️</div>
          <h1 className="auth-title">Transcend Legal</h1>
          <p className="auth-subtitle">Your Professional Legal Services Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="auth-error" data-testid="error-message">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              disabled={loading}
              data-testid="input-email"
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                disabled={loading}
                data-testid="input-password"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="form-actions-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="checkbox-input"
                disabled={loading}
              />
              <span className="checkbox-text">Remember me</span>
            </label>
            <a href="/forgot-password" className="link-secondary">
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            className="btn-primary btn-large"
            disabled={loading}
            data-testid="btn-login"
          >
            {loading ? '🔄 Signing in...' : '✓ Sign In'}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <div className="auth-social">
          <button type="button" className="btn-social" title="Sign in with Google">
            🔵 Google
          </button>
          <button type="button" className="btn-social" title="Sign in with Microsoft">
            🔷 Microsoft
          </button>
        </div>

        <div className="auth-footer">
          <p className="auth-footer-text">
            Don't have an account?{' '}
            <button
              type="button"
              className="link-primary"
              onClick={onNavigateToSignup}
              data-testid="btn-signup-link"
            >
              Create one
            </button>
          </p>
        </div>

        <div className="auth-info">
          <p className="info-text">
            💡 Demo credentials: demo@transcend.legal / password123
          </p>
        </div>
      </div>

      <div className="auth-background">
        <div className="bg-shape bg-shape-1"></div>
        <div className="bg-shape bg-shape-2"></div>
        <div className="bg-shape bg-shape-3"></div>
      </div>
    </div>
  );
};

export default Login;
