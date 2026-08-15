// IDMeVerification Component
// Client identity verification via ID.me or driver's license upload

import React, { useState } from 'react';
import './IDMeVerification.css';

type VerificationMethod = 'id_me' | 'drivers_license' | null;
type VerificationStatus = 'idle' | 'loading' | 'verified' | 'failed' | 'uploaded';

interface IDMeVerificationProps {
  userId: number;
  hireAgreementId: number;
  onVerified?: () => void;
  onSkip?: () => void;
  className?: string;
}

export const IDMeVerification: React.FC<IDMeVerificationProps> = ({
  userId,
  hireAgreementId,
  onVerified,
  onSkip,
  className = '',
}) => {
  const [selectedMethod, setSelectedMethod] = useState<VerificationMethod>(null);
  const [status, setStatus] = useState<VerificationStatus>('idle');
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [licensePreview, setLicensePreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verificationData, setVerificationData] = useState<any>(null);

  const handleIDMeClick = async () => {
    setSelectedMethod('id_me');
    setStatus('loading');
    setError(null);

    try {
      // In production, this would open ID.me modal
      // For now, simulate verification
      const response = await fetch('/api/v2/verification/id-me/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, hire_agreement_id: hireAgreementId }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus('verified');
        setVerificationData(data.data);
        onVerified?.();
      } else {
        setStatus('failed');
        setError(data.error || 'ID.me verification failed');
      }
    } catch (err) {
      setStatus('failed');
      setError('Failed to initiate ID.me verification');
      console.error('ID.me error:', err);
    }
  };

  const handleLicenseFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (file) {
      if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
        setError('Only JPEG, PNG, or PDF files are accepted');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
        setError('File size must be less than 5MB');
        return;
      }

      setLicenseFile(file);
      setError(null);

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setLicensePreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSubmitLicense = async () => {
    if (!licenseFile) {
      setError('Please select a file');
      return;
    }

    setSelectedMethod('drivers_license');
    setStatus('loading');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('user_id', userId.toString());
      formData.append('hire_agreement_id', hireAgreementId.toString());
      formData.append('document', licenseFile);
      formData.append('document_type', 'drivers_license');

      const response = await fetch('/api/v2/verification/upload-document', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setStatus('uploaded');
        setVerificationData(data.data);
        setError(null);
      } else {
        setStatus('failed');
        setError(data.error || 'Failed to upload document');
      }
    } catch (err) {
      setStatus('failed');
      setError('Failed to upload document');
      console.error('Upload error:', err);
    }
  };

  const handleReset = () => {
    setSelectedMethod(null);
    setStatus('idle');
    setLicenseFile(null);
    setLicensePreview(null);
    setError(null);
    setVerificationData(null);
  };

  return (
    <div className={`id-me-verification ${className}`}>
      {/* Header */}
      <div className="verification-header">
        <div className="verification-icon">🆔</div>
        <div className="verification-title-section">
          <h2 className="verification-title">Verify Your Identity</h2>
          <p className="verification-subtitle">
            Before proceeding, we need to verify that you are you
          </p>
        </div>
      </div>

      {/* Status: Not Started */}
      {status === 'idle' && !selectedMethod && (
        <div className="verification-content">
          <div className="verification-methods">
            {/* ID.me Method */}
            <button className="method-card" onClick={handleIDMeClick}>
              <div className="method-icon">📱</div>
              <div className="method-info">
                <h3 className="method-name">ID.me Verification</h3>
                <p className="method-description">
                  Instant verification using ID.me. Secure and trusted.
                </p>
                <span className="method-badge">Recommended</span>
              </div>
              <span className="method-arrow">→</span>
            </button>

            {/* Driver's License Method */}
            <button
              className="method-card"
              onClick={() => setSelectedMethod('drivers_license')}
            >
              <div className="method-icon">📸</div>
              <div className="method-info">
                <h3 className="method-name">Upload Driver's License</h3>
                <p className="method-description">
                  Upload a photo or scan of your driver's license or government ID
                </p>
                <span className="method-badge">Alternative</span>
              </div>
              <span className="method-arrow">→</span>
            </button>
          </div>

          {/* Security Notice */}
          <div className="security-notice">
            <p className="notice-icon">🔒</p>
            <p className="notice-text">
              Your identity information is encrypted and only used for verification purposes.
            </p>
          </div>
        </div>
      )}

      {/* Status: Loading */}
      {status === 'loading' && (
        <div className="verification-content">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p className="loading-text">
              {selectedMethod === 'id_me'
                ? 'Verifying your identity with ID.me...'
                : 'Processing your document...'}
            </p>
          </div>
        </div>
      )}

      {/* Status: Verified */}
      {status === 'verified' && (
        <div className="verification-content">
          <div className="success-container">
            <div className="success-icon">✅</div>
            <h3 className="success-title">Identity Verified!</h3>
            <p className="success-message">
              Your identity has been successfully verified via ID.me
            </p>
            {verificationData && (
              <div className="verification-details">
                <div className="detail-row">
                  <span className="detail-label">Name:</span>
                  <span className="detail-value">{verificationData.name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Verified At:</span>
                  <span className="detail-value">
                    {new Date(verificationData.verified_at).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
            <button className="btn btn-primary" onClick={onVerified}>
              Continue to Hire Agreement
            </button>
          </div>
        </div>
      )}

      {/* Status: Uploaded (Pending Review) */}
      {status === 'uploaded' && (
        <div className="verification-content">
          <div className="pending-container">
            <div className="pending-icon">⏳</div>
            <h3 className="pending-title">Document Received</h3>
            <p className="pending-message">
              Your driver's license has been uploaded and will be reviewed by our team
            </p>
            <p className="pending-timeline">
              Verification typically takes 1-2 business days
            </p>
            <div className="pending-actions">
              <button className="btn btn-secondary" onClick={handleReset}>
                Upload Different Document
              </button>
              <button className="btn btn-primary" onClick={onVerified}>
                Continue for Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status: Failed */}
      {status === 'failed' && (
        <div className="verification-content">
          <div className="error-container">
            <div className="error-icon">❌</div>
            <h3 className="error-title">Verification Failed</h3>
            <p className="error-message">{error || 'Something went wrong'}</p>
            <button className="btn btn-primary" onClick={handleReset}>
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Driver's License Upload Form */}
      {selectedMethod === 'drivers_license' && status === 'idle' && (
        <div className="verification-content">
          <div className="upload-form">
            <h3 className="form-title">Upload Your Government ID</h3>

            {/* File Input */}
            <div className="file-input-group">
              <label className="file-label">
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={handleLicenseFileChange}
                  className="file-input"
                />
                <span className="file-input-label">
                  {licenseFile ? '✓ ' + licenseFile.name : '📁 Click to select file'}
                </span>
              </label>
              <p className="file-hint">JPEG, PNG, or PDF • Max 5MB</p>
            </div>

            {/* Preview */}
            {licensePreview && (
              <div className="file-preview">
                <img src={licensePreview} alt="License preview" />
              </div>
            )}

            {/* Error */}
            {error && <div className="form-error">{error}</div>}

            {/* Actions */}
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setSelectedMethod(null)}>
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmitLicense}
                disabled={!licenseFile || status === 'loading'}
              >
                Submit for Verification
              </button>
            </div>

            {/* Requirements */}
            <div className="requirements">
              <p className="requirements-title">Requirements:</p>
              <ul className="requirements-list">
                <li>Clear photo of front and back (or both sides)</li>
                <li>All text must be readable</li>
                <li>No filters or heavy editing</li>
                <li>Must be current/valid ID</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Footer Actions */}
      {status === 'idle' && (
        <div className="verification-footer">
          {onSkip && (
            <button className="skip-btn" onClick={onSkip}>
              Skip for now
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default IDMeVerification;
