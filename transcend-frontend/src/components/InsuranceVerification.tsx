// Malpractice Insurance Verification Component
// Manages provider insurance certificate uploads, verification status, and compliance dashboard

import React, { useState, useEffect } from 'react';
import './InsuranceVerification.css';

interface InsuranceCertificate {
  id: string;
  providerId: string;
  insuranceCarrier: string;
  policyNumber: string;
  coverageAmount: number;
  deductible: number;
  effectiveDate: string;
  expirationDate: string;
  certificateUrl: string;
  status: 'pending' | 'verified' | 'expired' | 'invalid' | 'revoked';
  verificationDate?: string;
  verifiedBy?: string;
  claimsCount?: number;
}

interface ComplianceStatus {
  providerId: string;
  currentStatus: 'compliant' | 'non-compliant' | 'at-risk' | 'suspended';
  activeInsurance: boolean;
  certificateValid: boolean;
  lastVerification: string;
  nextVerificationDue: string;
  riskScore: number;
  flags: string[];
  recommendations: string[];
}

interface ClaimRecord {
  claimId: string;
  claimDate: string;
  amount: number;
  status: 'open' | 'settled' | 'dismissed';
  description: string;
}

const STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const InsuranceVerification: React.FC = () => {
  // State management
  const [activeTab, setActiveTab] = useState<'upload' | 'status' | 'claims' | 'dashboard'>('status');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Insurance certificate form state
  const [insuranceCarrier, setInsuranceCarrier] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [coverageAmount, setCoverageAmount] = useState('');
  const [deductible, setDeductible] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [stateCode, setStateCode] = useState('CA');
  const [certificateFile, setCertificateFile] = useState<File | null>(null);

  // Data state
  const [certificates, setCertificates] = useState<InsuranceCertificate[]>([]);
  const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus | null>(null);
  const [claimsHistory, setClaimsHistory] = useState<ClaimRecord[]>([]);
  const [activeCertificate, setActiveCertificate] = useState<InsuranceCertificate | null>(null);

  // Fetch data on component mount
  useEffect(() => {
    fetchInsuranceData();
    const interval = setInterval(fetchInsuranceData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const fetchInsuranceData = async () => {
    try {
      const token = localStorage.getItem('token');

      // Fetch certificates
      const certResponse = await fetch('/api/insurance/certificates', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (certResponse.ok) {
        const certData = await certResponse.json();
        setCertificates(certData.certificates || []);

        if (certData.active) {
          setActiveCertificate(certData.active);
        }
      }

      // Fetch compliance status
      const statusResponse = await fetch('/api/insurance/compliance-status', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        setComplianceStatus(statusData);
      }

      // Fetch claims history
      const claimsResponse = await fetch('/api/insurance/claims-history', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (claimsResponse.ok) {
        const claimsData = await claimsResponse.json();
        setClaimsHistory(claimsData.claims || []);
      }
    } catch (err) {
      console.error('Failed to fetch insurance data:', err);
    }
  };

  // Handle certificate upload
  const handleCertificateUpload = async () => {
    if (!insuranceCarrier || !policyNumber || !coverageAmount || !deductible || !effectiveDate || !expirationDate || !certificateFile) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Upload file
      const formData = new FormData();
      formData.append('file', certificateFile);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadData.message || 'Failed to upload certificate');
      }

      // Submit insurance certificate
      const certResponse = await fetch('/api/insurance/upload-certificate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          insuranceCarrier,
          policyNumber,
          coverageAmount: parseFloat(coverageAmount),
          deductible: parseFloat(deductible),
          effectiveDate,
          expirationDate,
          stateCode,
          certificateUrl: uploadData.fileUrl,
        }),
      });

      const certData = await certResponse.json();

      if (!certResponse.ok) {
        throw new Error(certData.message || 'Failed to upload certificate');
      }

      setSuccess('Certificate uploaded successfully and is pending verification.');

      // Reset form
      setInsuranceCarrier('');
      setPolicyNumber('');
      setCoverageAmount('');
      setDeductible('');
      setEffectiveDate('');
      setExpirationDate('');
      setCertificateFile(null);

      // Refresh data
      fetchInsuranceData();
      setActiveTab('status');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload certificate');
    } finally {
      setLoading(false);
    }
  };

  // Get status badge color
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'verified':
        return 'badge-success';
      case 'pending':
        return 'badge-warning';
      case 'expired':
      case 'revoked':
        return 'badge-danger';
      case 'invalid':
        return 'badge-error';
      case 'at_risk':
        return 'badge-warning';
      default:
        return 'badge-default';
    }
  };

  // Get compliance status badge color
  const getComplianceBadgeClass = (status: string) => {
    switch (status) {
      case 'compliant':
        return 'badge-success';
      case 'at-risk':
        return 'badge-warning';
      case 'non-compliant':
      case 'suspended':
        return 'badge-danger';
      default:
        return 'badge-default';
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Format date
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Calculate days until expiration
  const daysUntilExpiration = (expiryDate: string) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diff = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="insurance-verification-container">
      <div className="insurance-header">
        <h1>Malpractice Insurance Verification</h1>
        <p>Manage your professional liability insurance and compliance status</p>
      </div>

      {/* Error/Success Messages */}
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Tab Navigation */}
      <div className="insurance-tabs">
        <button
          className={`tab-btn ${activeTab === 'status' ? 'active' : ''}`}
          onClick={() => setActiveTab('status')}
        >
          Certificate Status
        </button>
        <button
          className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          Upload Certificate
        </button>
        <button
          className={`tab-btn ${activeTab === 'claims' ? 'active' : ''}`}
          onClick={() => setActiveTab('claims')}
        >
          Claims History
        </button>
        <button
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Compliance Dashboard
        </button>
      </div>

      {/* TAB 1: Certificate Status */}
      {activeTab === 'status' && (
        <div className="tab-content">
          <div className="section">
            <h2>Active Insurance Certificate</h2>

            {activeCertificate ? (
              <div className="certificate-card active">
                <div className="cert-header">
                  <div className="cert-info">
                    <h3>{activeCertificate.insuranceCarrier}</h3>
                    <p className="policy-number">Policy: {activeCertificate.policyNumber}</p>
                  </div>
                  <span className={`badge ${getStatusBadgeClass(activeCertificate.status)}`}>
                    {activeCertificate.status.toUpperCase()}
                  </span>
                </div>

                <div className="cert-details">
                  <div className="detail-row">
                    <label>Coverage Amount:</label>
                    <span>{formatCurrency(activeCertificate.coverageAmount)}</span>
                  </div>
                  <div className="detail-row">
                    <label>Deductible:</label>
                    <span>{formatCurrency(activeCertificate.deductible)}</span>
                  </div>
                  <div className="detail-row">
                    <label>Effective Date:</label>
                    <span>{formatDate(activeCertificate.effectiveDate)}</span>
                  </div>
                  <div className="detail-row">
                    <label>Expiration Date:</label>
                    <span>
                      {formatDate(activeCertificate.expirationDate)}
                      {daysUntilExpiration(activeCertificate.expirationDate) <= 30 && (
                        <span className="expiry-warning">
                          ({daysUntilExpiration(activeCertificate.expirationDate)} days remaining)
                        </span>
                      )}
                    </span>
                  </div>
                  {activeCertificate.verificationDate && (
                    <div className="detail-row">
                      <label>Verification Date:</label>
                      <span>{formatDate(activeCertificate.verificationDate)}</span>
                    </div>
                  )}
                  {activeCertificate.claimsCount !== undefined && (
                    <div className="detail-row">
                      <label>Associated Claims:</label>
                      <span>{activeCertificate.claimsCount}</span>
                    </div>
                  )}
                </div>

                <div className="cert-actions">
                  <a
                    href={activeCertificate.certificateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                  >
                    View Certificate
                  </a>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <p>No active insurance certificate found</p>
                <button
                  className="btn btn-primary"
                  onClick={() => setActiveTab('upload')}
                >
                  Upload Certificate
                </button>
              </div>
            )}
          </div>

          {/* All Certificates */}
          {certificates.length > 0 && (
            <div className="section mt-4">
              <h2>Certificate History</h2>
              <div className="certificates-list">
                {certificates.map((cert) => (
                  <div key={cert.id} className="certificate-card">
                    <div className="cert-header">
                      <div className="cert-info">
                        <h4>{cert.insuranceCarrier}</h4>
                        <p className="policy-number">Policy: {cert.policyNumber}</p>
                      </div>
                      <span className={`badge ${getStatusBadgeClass(cert.status)}`}>
                        {cert.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="cert-details-compact">
                      <span>{formatCurrency(cert.coverageAmount)} coverage</span>
                      <span>Expires: {formatDate(cert.expirationDate)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Upload Certificate */}
      {activeTab === 'upload' && (
        <div className="tab-content">
          <div className="section">
            <h2>Upload Insurance Certificate</h2>
            <form className="insurance-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="carrier">Insurance Carrier *</label>
                  <input
                    id="carrier"
                    type="text"
                    value={insuranceCarrier}
                    onChange={(e) => setInsuranceCarrier(e.target.value)}
                    placeholder="e.g., LPL Financial, AIG, CHUBB"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="policyNumber">Policy Number *</label>
                  <input
                    id="policyNumber"
                    type="text"
                    value={policyNumber}
                    onChange={(e) => setPolicyNumber(e.target.value)}
                    placeholder="e.g., POL-2024-123456"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="coverage">Coverage Amount (USD) *</label>
                  <input
                    id="coverage"
                    type="number"
                    value={coverageAmount}
                    onChange={(e) => setCoverageAmount(e.target.value)}
                    placeholder="e.g., 1000000"
                    min="0"
                    step="1000"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="deductible">Deductible (USD) *</label>
                  <input
                    id="deductible"
                    type="number"
                    value={deductible}
                    onChange={(e) => setDeductible(e.target.value)}
                    placeholder="e.g., 5000"
                    min="0"
                    step="100"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="state">State *</label>
                  <select
                    id="state"
                    value={stateCode}
                    onChange={(e) => setStateCode(e.target.value)}
                    required
                  >
                    {STATE_CODES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="effective">Effective Date *</label>
                  <input
                    id="effective"
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="expiration">Expiration Date *</label>
                  <input
                    id="expiration"
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group full-width">
                <label htmlFor="certificate">Certificate File (PDF) *</label>
                <input
                  id="certificate"
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={(e) => setCertificateFile(e.target.files?.[0] || null)}
                  required
                />
                {certificateFile && (
                  <p className="file-info">Selected: {certificateFile.name}</p>
                )}
              </div>

              <div className="info-box">
                <h4>Document Requirements:</h4>
                <ul>
                  <li>Certificate of Insurance (COI) or declaration page</li>
                  <li>Must show policy number, coverage amounts, and expiration date</li>
                  <li>PDF or image format (PNG, JPG)</li>
                  <li>File size max 10 MB</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={handleCertificateUpload}
                disabled={loading}
                className="btn btn-primary full-width"
              >
                {loading ? 'Uploading...' : 'Upload Certificate'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: Claims History */}
      {activeTab === 'claims' && (
        <div className="tab-content">
          <div className="section">
            <h2>Claims History (Past 5 Years)</h2>

            {claimsHistory.length > 0 ? (
              <div className="claims-list">
                <div className="claims-summary">
                  <div className="summary-stat">
                    <span className="label">Total Claims</span>
                    <span className="value">{claimsHistory.length}</span>
                  </div>
                  <div className="summary-stat">
                    <span className="label">Total Amount</span>
                    <span className="value">
                      {formatCurrency(
                        claimsHistory.reduce((sum, claim) => sum + claim.amount, 0)
                      )}
                    </span>
                  </div>
                  <div className="summary-stat">
                    <span className="label">Open Claims</span>
                    <span className="value">
                      {claimsHistory.filter((c) => c.status === 'open').length}
                    </span>
                  </div>
                </div>

                <table className="claims-table">
                  <thead>
                    <tr>
                      <th>Claim ID</th>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {claimsHistory.map((claim) => (
                      <tr key={claim.claimId}>
                        <td>{claim.claimId}</td>
                        <td>{formatDate(claim.claimDate)}</td>
                        <td>{claim.description}</td>
                        <td>{formatCurrency(claim.amount)}</td>
                        <td>
                          <span className={`status-badge status-${claim.status}`}>
                            {claim.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <p>No claims history found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Compliance Dashboard */}
      {activeTab === 'dashboard' && (
        <div className="tab-content">
          <div className="section">
            <h2>Compliance Status</h2>

            {complianceStatus ? (
              <>
                {/* Compliance Overview */}
                <div className="compliance-overview">
                  <div className="status-card">
                    <div className="status-badge-large">
                      <span className={`badge ${getComplianceBadgeClass(complianceStatus.currentStatus)}`}>
                        {complianceStatus.currentStatus.toUpperCase()}
                      </span>
                    </div>
                    <h3>Overall Status</h3>
                    <p>{complianceStatus.currentStatus}</p>
                  </div>

                  <div className="status-card">
                    <div className="risk-score">
                      <div className="score-circle">
                        <span className="score">{complianceStatus.riskScore}</span>
                        <span className="label">Risk Score</span>
                      </div>
                    </div>
                    <p className="score-description">
                      {complianceStatus.riskScore < 25 && 'Low Risk'}
                      {complianceStatus.riskScore >= 25 && complianceStatus.riskScore < 50 && 'Moderate Risk'}
                      {complianceStatus.riskScore >= 50 && complianceStatus.riskScore < 75 && 'High Risk'}
                      {complianceStatus.riskScore >= 75 && 'Critical Risk'}
                    </p>
                  </div>

                  <div className="status-card">
                    <h4>Verification Dates</h4>
                    <div className="date-row">
                      <label>Last Verified:</label>
                      <span>{formatDate(complianceStatus.lastVerification)}</span>
                    </div>
                    <div className="date-row">
                      <label>Next Due:</label>
                      <span>{formatDate(complianceStatus.nextVerificationDue)}</span>
                    </div>
                  </div>
                </div>

                {/* Flags and Recommendations */}
                {complianceStatus.flags.length > 0 && (
                  <div className="section mt-4">
                    <h3>Active Flags</h3>
                    <div className="flags-list">
                      {complianceStatus.flags.map((flag, index) => (
                        <div key={index} className="flag-item">
                          <span className="flag-icon">⚠️</span>
                          <span className="flag-text">{flag}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {complianceStatus.recommendations.length > 0 && (
                  <div className="section mt-4">
                    <h3>Recommendations</h3>
                    <div className="recommendations-list">
                      {complianceStatus.recommendations.map((rec, index) => (
                        <div key={index} className="recommendation-item">
                          <span className="rec-icon">💡</span>
                          <span className="rec-text">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Compliance Checklist */}
                <div className="section mt-4">
                  <h3>Compliance Checklist</h3>
                  <div className="checklist">
                    <div className="checklist-item">
                      <span className={`check ${complianceStatus.activeInsurance ? 'active' : 'inactive'}`}>
                        {complianceStatus.activeInsurance ? '✓' : '✗'}
                      </span>
                      <span className="label">Active Insurance</span>
                    </div>
                    <div className="checklist-item">
                      <span className={`check ${complianceStatus.certificateValid ? 'active' : 'inactive'}`}>
                        {complianceStatus.certificateValid ? '✓' : '✗'}
                      </span>
                      <span className="label">Certificate Verified</span>
                    </div>
                    <div className="checklist-item">
                      <span className={`check ${new Date(complianceStatus.nextVerificationDue) > new Date() ? 'active' : 'inactive'}`}>
                        {new Date(complianceStatus.nextVerificationDue) > new Date() ? '✓' : '✗'}
                      </span>
                      <span className="label">Verification Current</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p>Compliance status not available</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compliance Notice */}
      <div className="compliance-notice">
        <p>
          <strong>Compliance Notice:</strong> Malpractice insurance verification is conducted quarterly and is
          required for continued service provider access. Expired or invalid certificates will result in account
          suspension. For questions, contact our compliance team.
        </p>
      </div>
    </div>
  );
};

export default InsuranceVerification;
