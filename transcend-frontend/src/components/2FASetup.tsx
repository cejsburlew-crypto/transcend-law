// Two-Factor Authentication Setup Component
// Supports SMS OTP, TOTP/Authenticator, and backup codes

import React, { useState, useEffect } from 'react';
import './2FASetup.css';

interface Step {
  id: 'method-selection' | 'totp-setup' | 'sms-setup' | 'verify' | 'backup-codes' | 'complete';
  label: string;
}

interface TOTPSetupData {
  secret: string;
  qrCode: string;
  manualEntryKey: string;
}

interface BackupCodesData {
  codes: string[];
}

interface TwoFactorSetupProps {
  userId: string;
  onSetupComplete?: () => void;
  onSkip?: () => void;
  isRequired?: boolean;
  gracePeriodEndsAt?: string;
}

export const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({
  userId,
  onSetupComplete,
  onSkip,
  isRequired = false,
  gracePeriodEndsAt,
}) => {
  const [currentStep, setCurrentStep] = useState<Step['id']>('method-selection');
  const [selectedMethod, setSelectedMethod] = useState<'totp' | 'sms' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [totpSetupData, setTotpSetupData] = useState<TOTPSetupData | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [codesCopied, setCodesCopied] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [downloadedBackupCodes, setDownloadedBackupCodes] = useState(false);
  const [primaryMethod, setPrimaryMethod] = useState<'totp' | 'sms'>('totp');
  const [verificationAttempts, setVerificationAttempts] = useState(0);

  const steps: Step[] = [
    { id: 'method-selection', label: 'Choose Method' },
    { id: 'totp-setup', label: 'Authenticator App' },
    { id: 'sms-setup', label: 'Phone Number' },
    { id: 'verify', label: 'Verify Code' },
    { id: 'backup-codes', label: 'Backup Codes' },
    { id: 'complete', label: 'Complete' },
  ];

  // ============================================
  // METHOD SELECTION
  // ============================================

  const handleSelectMethod = async (method: 'totp' | 'sms') => {
    setSelectedMethod(method);
    setError('');

    if (method === 'totp') {
      await initiateTOTPSetup();
    } else if (method === 'sms') {
      setCurrentStep('sms-setup');
    }
  };

  // ============================================
  // TOTP SETUP
  // ============================================

  const initiateTOTPSetup = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v2/2fa/totp/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to initialize TOTP setup');
        return;
      }

      setTotpSetupData({
        secret: data.secret,
        qrCode: data.qrCode,
        manualEntryKey: data.manualEntryKey,
      });

      setCurrentStep('totp-setup');
    } catch (err) {
      setError('Network error during TOTP setup');
    } finally {
      setLoading(false);
    }
  };

  const verifiyTOTPSetup = async () => {
    if (verificationCode.length !== 6 || !/^\d+$/.test(verificationCode)) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/v2/2fa/totp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          userId,
          code: verificationCode,
          secret: totpSetupData?.secret,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setVerificationAttempts(verificationAttempts + 1);
        setError(data.error || 'Invalid verification code');
        return;
      }

      // Generate backup codes
      await generateBackupCodes();
    } catch (err) {
      setError('Network error during verification');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // SMS SETUP
  // ============================================

  const handleVerifySMSPhoneNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!phoneNumber.trim()) {
      setError('Phone number is required');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/v2/2fa/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          userId,
          phoneNumber,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to send verification code');
        return;
      }

      setSessionId(data.sessionId);
      setCurrentStep('verify');
      setVerificationAttempts(0);
    } catch (err) {
      setError('Network error sending SMS');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // VERIFICATION
  // ============================================

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (verificationCode.length === 0) {
      setError('Verification code is required');
      return;
    }

    setLoading(true);
    try {
      const endpoint =
        selectedMethod === 'totp'
          ? '/api/v2/2fa/totp/verify'
          : '/api/v2/2fa/sms/verify';

      const body: any = { userId, code: verificationCode };

      if (selectedMethod === 'sms') {
        body.sessionId = sessionId;
      } else if (selectedMethod === 'totp') {
        body.secret = totpSetupData?.secret;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setVerificationAttempts(verificationAttempts + 1);
        setError(data.error || 'Invalid verification code');
        return;
      }

      // Generate backup codes
      await generateBackupCodes();
    } catch (err) {
      setError('Network error during verification');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // BACKUP CODES
  // ============================================

  const generateBackupCodes = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v2/2fa/backup-codes/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          userId,
          primaryMethod,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to generate backup codes');
        return;
      }

      setBackupCodes(data.codes);
      setCurrentStep('backup-codes');
    } catch (err) {
      setError('Network error generating backup codes');
    } finally {
      setLoading(false);
    }
  };

  const copyBackupCodesToClipboard = async () => {
    const text = backupCodes.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCodesCopied(true);
      setTimeout(() => setCodesCopied(false), 2000);
    } catch (err) {
      setError('Failed to copy codes to clipboard');
    }
  };

  const downloadBackupCodes = () => {
    const text = backupCodes.join('\n');
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', 'transcend-legal-backup-codes.txt');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setDownloadedBackupCodes(true);
  };

  const completeSetup = async () => {
    if (!downloadedBackupCodes) {
      setError('Please save your backup codes before proceeding');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/v2/2fa/complete-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          userId,
          primaryMethod,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to complete setup');
        return;
      }

      setCurrentStep('complete');
      setTimeout(() => {
        onSetupComplete?.();
      }, 2000);
    } catch (err) {
      setError('Network error completing setup');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // RENDER METHODS
  // ============================================

  const renderMethodSelection = () => (
    <div className="two-fa-step">
      <div className="two-fa-header">
        <h2>Choose Your 2FA Method</h2>
        <p>Select how you'd like to secure your account</p>
      </div>

      <div className="method-grid">
        <div
          className={`method-card ${selectedMethod === 'totp' ? 'selected' : ''}`}
          onClick={() => handleSelectMethod('totp')}
        >
          <div className="method-icon">🔐</div>
          <h3>Authenticator App</h3>
          <p>Use an app like Google Authenticator or Authy</p>
          <div className="method-benefits">
            <li>Most secure option</li>
            <li>Works offline</li>
            <li>No SMS required</li>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={(e) => {
              e.stopPropagation();
              handleSelectMethod('totp');
            }}
          >
            Choose
          </button>
        </div>

        <div
          className={`method-card ${selectedMethod === 'sms' ? 'selected' : ''}`}
          onClick={() => handleSelectMethod('sms')}
        >
          <div className="method-icon">📱</div>
          <h3>SMS Text Message</h3>
          <p>Receive codes via text to your phone</p>
          <div className="method-benefits">
            <li>Easy to use</li>
            <li>No app required</li>
            <li>Universal access</li>
          </div>
          <button
            type="button"
            className="btn-primary"
            onClick={(e) => {
              e.stopPropagation();
              handleSelectMethod('sms');
            }}
          >
            Choose
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {!isRequired && (
        <button type="button" className="btn-secondary" onClick={onSkip}>
          Skip for Now
        </button>
      )}
    </div>
  );

  const renderTOTPSetup = () => (
    <div className="two-fa-step">
      <div className="two-fa-header">
        <h2>Set Up Authenticator App</h2>
        <p>Scan this QR code with your authenticator app</p>
      </div>

      {totpSetupData && (
        <>
          <div className="totp-qr-code">
            <img src={totpSetupData.qrCode} alt="QR Code for 2FA setup" />
          </div>

          <div className="manual-entry">
            <p>Can't scan the QR code?</p>
            <p className="manual-key">
              <code>{totpSetupData.manualEntryKey}</code>
            </p>
            <button
              type="button"
              className="btn-link"
              onClick={async () => {
                await navigator.clipboard.writeText(totpSetupData.manualEntryKey);
                setCodesCopied(true);
                setTimeout(() => setCodesCopied(false), 2000);
              }}
            >
              {codesCopied ? '✓ Copied' : 'Copy to clipboard'}
            </button>
          </div>

          <form onSubmit={verifiyTOTPSetup}>
            <div className="form-group">
              <label htmlFor="totp-code">Enter 6-digit code from your app</label>
              <input
                id="totp-code"
                type="text"
                className="form-input"
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setVerificationCode(val);
                }}
                maxLength={6}
                disabled={loading}
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading || verificationCode.length !== 6}
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>
        </>
      )}
    </div>
  );

  const renderSMSSetup = () => (
    <div className="two-fa-step">
      <div className="two-fa-header">
        <h2>Set Up SMS Authentication</h2>
        <p>Enter your phone number</p>
      </div>

      <form onSubmit={handleVerifySMSPhoneNumber}>
        <div className="form-group">
          <label htmlFor="phone-number">Phone Number</label>
          <input
            id="phone-number"
            type="tel"
            className="form-input"
            placeholder="+1 (555) 000-0000"
            value={phoneNumber}
            onChange={(e) => {
              setPhoneNumber(e.target.value);
              setError('');
            }}
            disabled={loading}
          />
          <small>Include country code (e.g., +1 for USA)</small>
        </div>

        {error && <div className="error-message">{error}</div>}

        <button type="submit" className="btn-primary" disabled={loading || !phoneNumber.trim()}>
          {loading ? 'Sending...' : 'Send Verification Code'}
        </button>
      </form>
    </div>
  );

  const renderVerification = () => (
    <div className="two-fa-step">
      <div className="two-fa-header">
        <h2>Verify Your Code</h2>
        <p>
          {selectedMethod === 'sms'
            ? 'Enter the code we sent to your phone'
            : 'Enter the code from your authenticator app'}
        </p>
      </div>

      <form onSubmit={handleVerifyCode}>
        <div className="form-group">
          <label htmlFor="verification-code">Verification Code</label>
          <input
            id="verification-code"
            type="text"
            className="form-input"
            placeholder="000000"
            value={verificationCode}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 6);
              setVerificationCode(val);
              setError('');
            }}
            maxLength={6}
            disabled={loading}
            autoFocus
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        {verificationAttempts > 0 && verificationAttempts < 3 && (
          <div className="warning-message">
            {3 - verificationAttempts} attempt{3 - verificationAttempts === 1 ? '' : 's'} remaining
          </div>
        )}

        <button
          type="submit"
          className="btn-primary"
          disabled={loading || verificationCode.length !== 6}
        >
          {loading ? 'Verifying...' : 'Verify Code'}
        </button>
      </form>
    </div>
  );

  const renderBackupCodes = () => (
    <div className="two-fa-step">
      <div className="two-fa-header">
        <h2>Save Your Backup Codes</h2>
        <p>Store these codes in a safe place. Use them if you lose access to your 2FA method.</p>
      </div>

      <div className="backup-codes-container">
        <div className={`backup-codes ${showBackupCodes ? 'revealed' : ''}`}>
          {!showBackupCodes && (
            <div className="codes-hidden">
              <p>🔒 Click to reveal backup codes</p>
            </div>
          )}
          {showBackupCodes && (
            <div className="codes-grid">
              {backupCodes.map((code, index) => (
                <div key={index} className="backup-code">
                  {code}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn-secondary"
          onClick={() => setShowBackupCodes(!showBackupCodes)}
        >
          {showBackupCodes ? '🙈 Hide' : '👁️ Reveal'} Codes
        </button>
      </div>

      <div className="backup-codes-actions">
        <button type="button" className="btn-secondary" onClick={copyBackupCodesToClipboard}>
          {codesCopied ? '✓ Copied to Clipboard' : '📋 Copy to Clipboard'}
        </button>
        <button type="button" className="btn-secondary" onClick={downloadBackupCodes}>
          {downloadedBackupCodes ? '✓ Downloaded' : '⬇️ Download'}
        </button>
      </div>

      <div className="backup-codes-warning">
        <strong>⚠️ Important:</strong>
        <ul>
          <li>Each code can only be used once</li>
          <li>Store these codes in a secure location</li>
          <li>You'll need these if your 2FA method becomes unavailable</li>
        </ul>
      </div>

      <button
        type="button"
        className="btn-primary"
        onClick={completeSetup}
        disabled={!downloadedBackupCodes}
      >
        {loading ? 'Completing Setup...' : 'Complete Setup'}
      </button>
    </div>
  );

  const renderComplete = () => (
    <div className="two-fa-step">
      <div className="two-fa-header success">
        <div className="success-icon">✅</div>
        <h2>2FA Setup Complete!</h2>
        <p>Your account is now protected with two-factor authentication</p>
      </div>

      <div className="setup-summary">
        <div className="summary-item">
          <span className="summary-label">Primary Method:</span>
          <span className="summary-value">
            {primaryMethod === 'totp' ? '🔐 Authenticator App' : '📱 SMS'}
          </span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Status:</span>
          <span className="summary-value">✓ Active</span>
        </div>
      </div>

      <button type="button" className="btn-primary" onClick={onSetupComplete}>
        Return to Account
      </button>
    </div>
  );

  const getCurrentStepComponent = () => {
    switch (currentStep) {
      case 'method-selection':
        return renderMethodSelection();
      case 'totp-setup':
        return renderTOTPSetup();
      case 'sms-setup':
        return renderSMSSetup();
      case 'verify':
        return renderVerification();
      case 'backup-codes':
        return renderBackupCodes();
      case 'complete':
        return renderComplete();
      default:
        return renderMethodSelection();
    }
  };

  return (
    <div className="two-fa-setup">
      <div className="two-fa-container">
        <div className="two-fa-progress">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`progress-step ${
                currentStep === step.id
                  ? 'active'
                  : steps.findIndex((s) => s.id === currentStep) > index
                  ? 'completed'
                  : ''
              }`}
            >
              <div className="step-number">{index + 1}</div>
              <div className="step-label">{step.label}</div>
            </div>
          ))}
        </div>

        <div className="two-fa-content">{getCurrentStepComponent()}</div>

        {gracePeriodEndsAt && (
          <div className="grace-period-notice">
            <p>Grace period ends: {new Date(gracePeriodEndsAt).toLocaleDateString()}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TwoFactorSetup;
