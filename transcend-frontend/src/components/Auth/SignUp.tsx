// Sign Up Component
// Create new user account with email, password, and profile info

import React, { useState } from 'react';
import './Auth.css';

interface SignUpProps {
  onSignUpSuccess?: (userId: string, token: string) => void;
  onNavigateToLogin?: () => void;
  className?: string;
}

interface SignUpForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  userType: string;
  termsAccepted: boolean;
}

export const SignUp: React.FC<SignUpProps> = ({
  onSignUpSuccess,
  onNavigateToLogin,
  className = '',
}) => {
  const [formData, setFormData] = useState<SignUpForm>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    userType: 'client',
    termsAccepted: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validateStep1 = () => {
    if (!formData.firstName.trim()) {
      setError('First name is required');
      return false;
    }
    if (!formData.lastName.trim()) {
      setError('Last name is required');
      return false;
    }
    if (formData.firstName.length < 2) {
      setError('First name must be at least 2 characters');
      return false;
    }
    if (formData.lastName.length < 2) {
      setError('Last name must be at least 2 characters');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!formData.password) {
      setError('Password is required');
      return false;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    if (!/[A-Z]/.test(formData.password)) {
      setError('Password must contain at least one uppercase letter');
      return false;
    }
    if (!/[0-9]/.test(formData.password)) {
      setError('Password must contain at least one number');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!formData.userType) {
      setError('Please select your user type');
      return false;
    }
    if (!formData.termsAccepted) {
      setError('You must accept the terms and conditions');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setError('');

    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    } else if (step === 3 && validateStep3()) {
      handleSubmit();
    }
  };

  const handleBack = () => {
    setError('');
    setStep(step - 1);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target as HTMLInputElement;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    });
    setError('');
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/v2/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.toLowerCase().trim(),
          password: formData.password,
          userType: formData.userType,
          termsAccepted: formData.termsAccepted,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || 'Sign up failed. Please try again.');
        setLoading(false);
        return;
      }

      localStorage.setItem('authToken', data.token);
      localStorage.setItem('userId', data.userId);
      localStorage.setItem('userEmail', formData.email);
      localStorage.setItem('userType', formData.userType);

      onSignUpSuccess?.(data.userId, data.token);
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
      setLoading(false);
    }
  };

  return (
    <div className={`auth-container signup-container ${className}`}>
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">⚖️</div>
          <h1 className="auth-title">Transcend Legal</h1>
          <p className="auth-subtitle">Join the Legal Services Platform</p>
        </div>

        <div className="progress-indicator">
          <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">Profile</span>
          </div>
          <div className="progress-bar"></div>
          <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">Account</span>
          </div>
          <div className="progress-bar"></div>
          <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>
            <span className="step-number">3</span>
            <span className="step-label">Confirm</span>
          </div>
        </div>

        <form className="auth-form">
          {error && (
            <div className="auth-error" data-testid="error-message">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Step 1: Profile Information */}
          {step === 1 && (
            <>
              <div className="form-group">
                <label htmlFor="firstName" className="form-label">
                  First Name
                </label>
                <input
                  id="firstName"
                  type="text"
                  className="form-input"
                  placeholder="John"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  disabled={loading}
                  data-testid="input-firstName"
                />
              </div>

              <div className="form-group">
                <label htmlFor="lastName" className="form-label">
                  Last Name
                </label>
                <input
                  id="lastName"
                  type="text"
                  className="form-input"
                  placeholder="Doe"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  disabled={loading}
                  data-testid="input-lastName"
                />
              </div>
            </>
          )}

          {/* Step 2: Account Credentials */}
          {step === 2 && (
            <>
              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  placeholder="you@example.com"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={loading}
                  data-testid="input-email"
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
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={loading}
                    data-testid="input-password"
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
                <p className="helper-text">
                  🔒 Min 8 chars, 1 uppercase, 1 number
                </p>
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword" className="form-label">
                  Confirm Password
                </label>
                <div className="password-input-wrapper">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="••••••••"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={loading}
                    data-testid="input-confirmPassword"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Step 3: User Type & Terms */}
          {step === 3 && (
            <>
              <div className="form-group">
                <label htmlFor="userType" className="form-label">
                  I am a...
                </label>
                <select
                  id="userType"
                  className="form-input"
                  name="userType"
                  value={formData.userType}
                  onChange={handleChange}
                  disabled={loading}
                  data-testid="select-userType"
                >
                  <option value="">Select your role</option>
                  <option value="client">Client (Need Legal Services)</option>
                  <option value="lawyer">Lawyer</option>
                  <option value="paralegal">Paralegal</option>
                  <option value="notary">Notary Public</option>
                  <option value="investigator">Investigator</option>
                  <option value="mediator">Mediator</option>
                </select>
              </div>

              <div className="form-group">
                <label className="checkbox-label checkbox-large">
                  <input
                    type="checkbox"
                    name="termsAccepted"
                    checked={formData.termsAccepted}
                    onChange={handleChange}
                    className="checkbox-input"
                    disabled={loading}
                  />
                  <span className="checkbox-text">
                    I agree to the{' '}
                    <a href="/terms" className="link-primary">
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a href="/privacy" className="link-primary">
                      Privacy Policy
                    </a>
                  </span>
                </label>
              </div>

              <div className="info-box">
                <p className="info-text">
                  📋 By creating an account, you agree to our terms and conditions.
                  Your data is encrypted and secure.
                </p>
              </div>
            </>
          )}

          {/* Form Actions */}
          <div className="form-actions-multi">
            {step > 1 && (
              <button
                type="button"
                className="btn-secondary btn-large"
                onClick={handleBack}
                disabled={loading}
              >
                ← Back
              </button>
            )}
            <button
              type="button"
              className="btn-primary btn-large"
              onClick={handleNext}
              disabled={loading}
              data-testid="btn-continue"
            >
              {step === 3
                ? loading
                  ? '🔄 Creating Account...'
                  : '✓ Create Account'
                : 'Next →'}
            </button>
          </div>
        </form>

        <div className="auth-footer">
          <p className="auth-footer-text">
            Already have an account?{' '}
            <button
              type="button"
              className="link-primary"
              onClick={onNavigateToLogin}
              data-testid="btn-login-link"
            >
              Sign in
            </button>
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

export default SignUp;
