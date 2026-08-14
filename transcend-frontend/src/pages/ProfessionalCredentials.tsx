import React, { useState } from 'react';
import './ProfessionalCredentials.css';

interface Credential {
  id: string;
  type: string;
  licenseNumber: string;
  expirationDate: string;
  organization: string;
  certificationLink: string;
  verified: boolean;
  verifiedDate?: string;
}

export const ProfessionalCredentials: React.FC = () => {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    type: 'CPA',
    licenseNumber: '',
    expirationDate: '',
    organization: '',
    certificationLink: '',
  });

  const credentialTypes = [
    { value: 'CPA', label: 'Certified Public Accountant (CPA)' },
    { value: 'EA', label: 'Enrolled Agent (EA)' },
    { value: 'AFSP', label: 'Accredited Financial Specialist (AFSP)' },
    { value: 'JD', label: 'Juris Doctor (JD)' },
    { value: 'MBA', label: 'Master of Business Administration (MBA)' },
    { value: 'REGISTERED_AGENT', label: 'Registered Agent / Corporate Agent' },
    { value: 'TAX_PREPARER', label: 'Licensed Tax Preparer' },
    { value: 'NOTARY', label: 'Notary Public' },
    { value: 'OTHER', label: 'Other Certification' },
  ];

  const handleAddCredential = () => {
    if (formData.licenseNumber && formData.expirationDate && formData.organization) {
      const newCredential: Credential = {
        id: Date.now().toString(),
        type: formData.type,
        licenseNumber: formData.licenseNumber,
        expirationDate: formData.expirationDate,
        organization: formData.organization,
        certificationLink: formData.certificationLink,
        verified: false,
      };
      setCredentials([...credentials, newCredential]);
      setFormData({
        type: 'CPA',
        licenseNumber: '',
        expirationDate: '',
        organization: '',
        certificationLink: '',
      });
      setShowForm(false);
    }
  };

  const handleDeleteCredential = (id: string) => {
    setCredentials(credentials.filter(c => c.id !== id));
  };

  const isExpired = (date: string) => new Date(date) < new Date();

  return (
    <div className="credentials-container">
      <div className="credentials-header">
        <h2>🏆 Professional Credentials & Certifications</h2>
        <p>Add and manage your professional licenses, certifications, and credentials</p>
      </div>

      {credentials.length > 0 && (
        <div className="credentials-list">
          {credentials.map(cred => (
            <div key={cred.id} className="credential-card">
              <div className="credential-header">
                <h3>{credentialTypes.find(t => t.value === cred.type)?.label || cred.type}</h3>
                <span className={`status-badge ${isExpired(cred.expirationDate) ? 'expired' : cred.verified ? 'verified' : 'pending'}`}>
                  {isExpired(cred.expirationDate) ? '⚠️ Expired' : cred.verified ? '✅ Verified' : '⏳ Pending'}
                </span>
              </div>
              <div className="credential-details">
                <div className="detail-row">
                  <label>License/Certification #:</label>
                  <span>{cred.licenseNumber}</span>
                </div>
                <div className="detail-row">
                  <label>Organization:</label>
                  <span>{cred.organization}</span>
                </div>
                <div className="detail-row">
                  <label>Expiration Date:</label>
                  <span className={isExpired(cred.expirationDate) ? 'expired-date' : ''}>
                    {new Date(cred.expirationDate).toLocaleDateString()}
                  </span>
                </div>
                {cred.certificationLink && (
                  <div className="detail-row">
                    <label>Verification Link:</label>
                    <a href={cred.certificationLink} target="_blank" rel="noopener noreferrer">
                      View Certificate →
                    </a>
                  </div>
                )}
              </div>
              <button
                className="delete-btn"
                onClick={() => handleDeleteCredential(cred.id)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {credentials.length === 0 && !showForm && (
        <div className="empty-state">
          <p>No credentials added yet</p>
          <p className="subtitle">Add your professional licenses and certifications to build trust with clients</p>
        </div>
      )}

      {showForm && (
        <div className="credential-form">
          <div className="form-group">
            <label>Credential Type *</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            >
              {credentialTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>License/Certification Number *</label>
            <input
              type="text"
              placeholder="e.g., 12-3456789"
              value={formData.licenseNumber}
              onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Issuing Organization *</label>
            <input
              type="text"
              placeholder="e.g., California CPA Board, IRS"
              value={formData.organization}
              onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Expiration Date *</label>
            <input
              type="date"
              value={formData.expirationDate}
              onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>Link to Verification (Optional)</label>
            <input
              type="url"
              placeholder="https://example.com/verify/certificate"
              value={formData.certificationLink}
              onChange={(e) => setFormData({ ...formData, certificationLink: e.target.value })}
            />
          </div>

          <div className="form-actions">
            <button className="save-btn" onClick={handleAddCredential}>
              Add Credential
            </button>
            <button className="cancel-btn" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <button className="add-credential-btn" onClick={() => setShowForm(true)}>
          + Add Credential
        </button>
      )}

      <div className="credential-info">
        <h3>📋 Why Add Your Credentials?</h3>
        <ul>
          <li>Build trust with clients and stand out from competitors</li>
          <li>Get verified status badge on your profile</li>
          <li>Access higher-tier service requests and cases</li>
          <li>Increase your earning potential on the platform</li>
          <li>Automatic expiration alerts before your license expires</li>
        </ul>
      </div>
    </div>
  );
};
