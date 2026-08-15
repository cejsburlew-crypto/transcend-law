// KYC (Know Your Customer) Progressive Verification Component
// 6-stage progressive verification with admin review and feature unlock

import React, { useState, useEffect } from 'react';
import './KYCVerification.css';

interface KYCStage {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected' | 'expired';
  timeLimit: number;
  maxAttempts: number;
  unlocksFeatures: string[];
  fincenRequired?: boolean;
}

interface KYCStatus {
  completedStages: string[];
  currentStage: string;
  progress: number;
  kyc_completed: boolean;
  kyc_completed_at?: string;
  unlockedFeatures: string[];
}

const KYC_STAGES: Record<string, KYCStage> = {
  email: {
    id: 'email',
    name: 'Email Verification',
    description: 'Verify your email address',
    status: 'pending',
    timeLimit: 24 * 60 * 60 * 1000,
    maxAttempts: 3,
    unlocksFeatures: ['account_access', 'basic_search'],
  },
  phone: {
    id: 'phone',
    name: 'Phone Verification',
    description: 'Verify your phone number via SMS',
    status: 'pending',
    timeLimit: 24 * 60 * 60 * 1000,
    maxAttempts: 3,
    unlocksFeatures: ['messaging', 'case_creation'],
  },
  government_id: {
    id: 'government_id',
    name: 'Government ID',
    description: 'Upload driver license or passport',
    status: 'pending',
    timeLimit: 24 * 60 * 60 * 1000,
    maxAttempts: 3,
    unlocksFeatures: ['service_provider_access', 'higher_transaction_limits'],
    fincenRequired: true,
  },
  address_verification: {
    id: 'address_verification',
    name: 'Address Verification',
    description: 'Verify address with utility bill or government document',
    status: 'pending',
    timeLimit: 24 * 60 * 60 * 1000,
    maxAttempts: 3,
    unlocksFeatures: ['payment_processing'],
    fincenRequired: true,
  },
  bank_account: {
    id: 'bank_account',
    name: 'Bank Account Verification',
    description: 'Link and verify your bank account',
    status: 'pending',
    timeLimit: 24 * 60 * 60 * 1000,
    maxAttempts: 3,
    unlocksFeatures: ['premium_features', 'instant_payments'],
    fincenRequired: true,
  },
  video_call: {
    id: 'video_call',
    name: 'Video Verification',
    description: 'Live video call with verification agent',
    status: 'pending',
    timeLimit: 24 * 60 * 60 * 1000,
    maxAttempts: 3,
    unlocksFeatures: ['unlimited_transactions', 'vip_support'],
  },
};

const STAGE_ORDER = [
  'email',
  'phone',
  'government_id',
  'address_verification',
  'bank_account',
  'video_call',
];

const KYCVerification: React.FC = () => {
  const [status, setStatus] = useState<KYCStatus | null>(null);
  const [currentStageView, setCurrentStageView] = useState<string>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Stage-specific state
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneOTP, setPhoneOTP] = useState('');
  const [idType, setIdType] = useState<'driver_license' | 'passport'>('driver_license');
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [address, setAddress] = useState('');
  const [addressDocument, setAddressDocument] = useState<File | null>(null);
  const [bankToken, setBankToken] = useState('');
  const [microdeposits, setMicrodeposits] = useState<[number, number] | null>(null);

  // Fetch KYC status on mount
  useEffect(() => {
    fetchKYCStatus();
    const interval = setInterval(fetchKYCStatus, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchKYCStatus = async () => {
    try {
      const response = await fetch('/api/kyc/status', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch KYC status:', err);
    }
  };

  // STAGE 1: EMAIL VERIFICATION
  const handleEmailVerification = async () => {
    if (!email) {
      setError('Please enter your email');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/kyc/email/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send verification email');
      }

      setSuccess('Verification email sent! Check your inbox.');
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate email verification');
    } finally {
      setLoading(false);
    }
  };

  // STAGE 2: PHONE VERIFICATION
  const handlePhoneVerification = async () => {
    if (!phone) {
      setError('Please enter your phone number');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/kyc/phone/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ phoneNumber: phone }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send verification code');
      }

      setSuccess('Verification code sent via SMS!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate phone verification');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneOTPVerify = async () => {
    if (!phoneOTP) {
      setError('Please enter the verification code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/kyc/phone/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ otp: phoneOTP }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Invalid verification code');
      }

      setSuccess('Phone verified successfully!');
      setPhoneOTP('');
      fetchKYCStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify phone');
    } finally {
      setLoading(false);
    }
  };

  // STAGE 3: GOVERNMENT ID
  const handleIDDocumentUpload = async () => {
    if (!idDocument) {
      setError('Please select a document');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Upload to S3/storage
      const formData = new FormData();
      formData.append('file', idDocument);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadData.message || 'Failed to upload document');
      }

      // Initiate ID verification
      const verificationResponse = await fetch('/api/kyc/government-id/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          idType,
          documentUrl: uploadData.fileUrl,
        }),
      });

      const verificationData = await verificationResponse.json();

      if (!verificationResponse.ok) {
        throw new Error(verificationData.message || 'Failed to submit ID');
      }

      setSuccess(
        `Government ID submitted for verification. Estimated review time: ${verificationData.estimatedReviewTime}`
      );
      setIdDocument(null);
      fetchKYCStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload ID document');
    } finally {
      setLoading(false);
    }
  };

  // STAGE 4: ADDRESS VERIFICATION
  const handleAddressVerification = async () => {
    if (!address || !addressDocument) {
      setError('Please enter address and select a document');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Upload document
      const formData = new FormData();
      formData.append('file', addressDocument);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadData.message || 'Failed to upload document');
      }

      // Initiate address verification
      const verificationResponse = await fetch('/api/kyc/address/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          address,
          documentUrl: uploadData.fileUrl,
        }),
      });

      const verificationData = await verificationResponse.json();

      if (!verificationResponse.ok) {
        throw new Error(verificationData.message || 'Failed to submit address');
      }

      setSuccess(
        `Address verification submitted. Estimated review time: ${verificationData.estimatedReviewTime}`
      );
      setAddress('');
      setAddressDocument(null);
      fetchKYCStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify address');
    } finally {
      setLoading(false);
    }
  };

  // STAGE 5: BANK ACCOUNT
  const handleBankAccountLink = async () => {
    if (!bankToken) {
      setError('Please link your bank account');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/kyc/bank/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ bankAccountToken: bankToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to link bank account');
      }

      setSuccess('Bank account linked! Check for microdeposits (2-5 business days)');
      setBankToken('');
      fetchKYCStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link bank account');
    } finally {
      setLoading(false);
    }
  };

  const handleMicrodepositVerify = async () => {
    if (!microdeposits || microdeposits.length !== 2) {
      setError('Please enter both microdeposit amounts');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/kyc/bank/verify-microdeposits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ amounts: microdeposits }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to verify amounts');
      }

      setSuccess('Bank account verified successfully!');
      setMicrodeposits(null);
      fetchKYCStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify microdeposits');
    } finally {
      setLoading(false);
    }
  };

  // STAGE 6: VIDEO VERIFICATION
  const handleVideoVerification = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/kyc/video/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to schedule video verification');
      }

      setSuccess(
        `Video verification scheduled! Wait time: ${data.estimatedWaitTime}. You will receive an invite email shortly.`
      );
      fetchKYCStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule video call');
    } finally {
      setLoading(false);
    }
  };

  const isStageCompleted = (stageId: string) => status?.completedStages.includes(stageId);
  const isStageUnlocked = (stageIndex: number) => {
    return STAGE_ORDER.slice(0, stageIndex).every((stage) => isStageCompleted(stage));
  };

  return (
    <div className="kyc-container">
      <div className="kyc-header">
        <h1>Know Your Customer (KYC) Verification</h1>
        <p>Complete progressive verification to unlock features and increase transaction limits</p>
      </div>

      {/* Progress Bar */}
      <div className="kyc-progress-section">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${status?.progress || 0}%` }}
          ></div>
        </div>
        <p className="progress-text">{status?.progress || 0}% Complete</p>

        {status?.kyc_completed && (
          <div className="kyc-completed-banner">
            <span className="checkmark">✓</span>
            KYC Verification Completed on{' '}
            {new Date(status.kyc_completed_at || '').toLocaleDateString()}
          </div>
        )}
      </div>

      {/* Error/Success Messages */}
      {error && <div className="kyc-error">{error}</div>}
      {success && <div className="kyc-success">{success}</div>}

      {/* Stages */}
      <div className="kyc-stages">
        {STAGE_ORDER.map((stageId, index) => {
          const stage = KYC_STAGES[stageId];
          const completed = isStageCompleted(stageId);
          const unlocked = isStageUnlocked(index);
          const isActive = currentStageView === stageId;

          return (
            <div
              key={stageId}
              className={`kyc-stage-card ${completed ? 'completed' : ''} ${
                unlocked ? 'unlocked' : 'locked'
              } ${isActive ? 'active' : ''}`}
            >
              <div className="stage-header" onClick={() => unlocked && setCurrentStageView(stageId)}>
                <div className="stage-number">{index + 1}</div>
                <div className="stage-info">
                  <h3>{stage.name}</h3>
                  <p>{stage.description}</p>
                  {stage.fincenRequired && (
                    <span className="fincen-badge">FinCEN Required</span>
                  )}
                </div>
                <div className="stage-status">
                  {completed && <span className="status-badge completed">Completed</span>}
                  {!unlocked && <span className="status-badge locked">Locked</span>}
                </div>
              </div>

              {/* Stage Content */}
              {isActive && unlocked && !completed && (
                <div className="stage-content">
                  {stageId === 'email' && (
                    <div className="form-group">
                      <label>Email Address</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your.email@example.com"
                      />
                      <button
                        onClick={handleEmailVerification}
                        disabled={loading}
                        className="kyc-btn primary"
                      >
                        {loading ? 'Sending...' : 'Send Verification Email'}
                      </button>
                    </div>
                  )}

                  {stageId === 'phone' && (
                    <div className="form-group">
                      <label>Phone Number</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                      />
                      <button
                        onClick={handlePhoneVerification}
                        disabled={loading}
                        className="kyc-btn primary"
                      >
                        {loading ? 'Sending...' : 'Send Verification Code'}
                      </button>

                      {phone && (
                        <div className="form-group mt-3">
                          <label>Verification Code</label>
                          <input
                            type="text"
                            value={phoneOTP}
                            onChange={(e) => setPhoneOTP(e.target.value)}
                            placeholder="000000"
                            maxLength="6"
                          />
                          <button
                            onClick={handlePhoneOTPVerify}
                            disabled={loading}
                            className="kyc-btn primary"
                          >
                            {loading ? 'Verifying...' : 'Verify Code'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {stageId === 'government_id' && (
                    <div className="form-group">
                      <label>ID Type</label>
                      <select value={idType} onChange={(e) => setIdType(e.target.value as any)}>
                        <option value="driver_license">Driver License</option>
                        <option value="passport">Passport</option>
                      </select>

                      <label className="mt-3">Upload Document</label>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => setIdDocument(e.target.files?.[0] || null)}
                      />
                      {idDocument && <p className="file-name">{idDocument.name}</p>}

                      <button
                        onClick={handleIDDocumentUpload}
                        disabled={loading || !idDocument}
                        className="kyc-btn primary"
                      >
                        {loading ? 'Uploading...' : 'Submit for Review'}
                      </button>
                    </div>
                  )}

                  {stageId === 'address_verification' && (
                    <div className="form-group">
                      <label>Current Address</label>
                      <textarea
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Enter your full address"
                      />

                      <label className="mt-3">Proof of Address</label>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => setAddressDocument(e.target.files?.[0] || null)}
                      />
                      {addressDocument && <p className="file-name">{addressDocument.name}</p>}

                      <button
                        onClick={handleAddressVerification}
                        disabled={loading || !address || !addressDocument}
                        className="kyc-btn primary"
                      >
                        {loading ? 'Uploading...' : 'Submit for Review'}
                      </button>
                    </div>
                  )}

                  {stageId === 'bank_account' && (
                    <div className="form-group">
                      <p className="info-text">
                        Link your bank account for instant payments and to unlock premium features.
                      </p>
                      <button
                        onClick={() => {
                          /* TODO: Integrate Plaid */
                        }}
                        className="kyc-btn primary"
                      >
                        Link Bank Account with Plaid
                      </button>

                      <div className="divider mt-3">Or</div>

                      <label className="mt-3">Enter Bank Token</label>
                      <input
                        type="text"
                        value={bankToken}
                        onChange={(e) => setBankToken(e.target.value)}
                        placeholder="Bank token from Plaid"
                      />
                      <button
                        onClick={handleBankAccountLink}
                        disabled={loading}
                        className="kyc-btn primary"
                      >
                        {loading ? 'Processing...' : 'Verify Bank Account'}
                      </button>

                      <div className="divider mt-3">Verify Microdeposits</div>

                      <p className="info-text mt-3">
                        Enter the two small amounts deposited to your account:
                      </p>
                      <div className="microdeposit-inputs">
                        <input
                          type="number"
                          placeholder="First amount (cents)"
                          onChange={(e) =>
                            setMicrodeposits([
                              parseInt(e.target.value) || 0,
                              microdeposits?.[1] || 0,
                            ])
                          }
                        />
                        <input
                          type="number"
                          placeholder="Second amount (cents)"
                          onChange={(e) =>
                            setMicrodeposits([
                              microdeposits?.[0] || 0,
                              parseInt(e.target.value) || 0,
                            ])
                          }
                        />
                      </div>
                      <button
                        onClick={handleMicrodepositVerify}
                        disabled={loading || !microdeposits}
                        className="kyc-btn primary"
                      >
                        {loading ? 'Verifying...' : 'Verify Amounts'}
                      </button>
                    </div>
                  )}

                  {stageId === 'video_call' && (
                    <div className="form-group">
                      <p className="info-text">
                        Complete your KYC verification with a live video call with one of our
                        agents. This typically takes 5-10 minutes.
                      </p>
                      <button
                        onClick={handleVideoVerification}
                        disabled={loading}
                        className="kyc-btn primary"
                      >
                        {loading ? 'Scheduling...' : 'Schedule Video Call'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {isActive && !unlocked && (
                <div className="stage-locked-message">
                  <p>Complete Stage {index} to unlock this stage</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Unlocked Features */}
      {status?.unlockedFeatures && status.unlockedFeatures.length > 0 && (
        <div className="unlocked-features">
          <h3>Your Unlocked Features</h3>
          <div className="features-grid">
            {Array.from(new Set(status.unlockedFeatures)).map((feature) => (
              <div key={feature} className="feature-badge">
                <span className="check">✓</span>
                {feature.replace(/_/g, ' ').toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compliance Note */}
      <div className="compliance-note">
        <p>
          <strong>Compliance Notice:</strong> This Know Your Customer (KYC) process complies with
          FinCEN regulations (31 CFR Chapter X) and AML/KYC best practices. Your information is
          encrypted and stored securely.
        </p>
      </div>
    </div>
  );
};

export default KYCVerification;
