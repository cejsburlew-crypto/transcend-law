import React, { useState } from 'react';
import './MyProviderProfile.css';

interface ProviderData {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  state: string;
  rating: number;
  reviews: number;
  yearsExperience: number;
  hourlyRate: number;
  verified: boolean;
  profileVisible: boolean;
  showContactInfo: boolean;
}

interface MyProviderProfileProps {
  onBack?: () => void;
}

export const MyProviderProfile: React.FC<MyProviderProfileProps> = ({ onBack }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showIDmeFlow, setShowIDmeFlow] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'unverified' | 'pending' | 'verified'>('unverified');

  const [provider, setProvider] = useState<ProviderData>({
    id: 'provider-001',
    name: 'John Smith, Esq.',
    email: 'john.smith@lawfirm.com',
    phone: '(555) 123-4567',
    specialization: 'Corporate Law',
    state: 'CA',
    rating: 4.8,
    reviews: 125,
    yearsExperience: 12,
    hourlyRate: 250,
    verified: false,
    profileVisible: false,
    showContactInfo: false,
  });

  const [editForm, setEditForm] = useState(provider);

  const handleEditChange = (field: keyof ProviderData, value: any) => {
    setEditForm({ ...editForm, [field]: value });
  };

  const handleSave = () => {
    setProvider(editForm);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditForm(provider);
    setIsEditing(false);
  };

  const handleVerifyWithIDme = () => {
    setShowIDmeFlow(true);
    setVerificationStatus('pending');
    setTimeout(() => {
      setVerificationStatus('verified');
      setProvider({ ...provider, verified: true });
      setShowIDmeFlow(false);
    }, 3000);
  };

  const toggleContactInfoVisibility = () => {
    const updated = { ...provider, showContactInfo: !provider.showContactInfo };
    setProvider(updated);
  };

  const toggleProfileVisibility = () => {
    const updated = { ...provider, profileVisible: !provider.profileVisible };
    setProvider(updated);
  };

  return (
    <div className="my-profile-container">
      <div className="profile-header">
        <h1>📋 My Provider Profile</h1>
        <p>Manage your public profile and contact information</p>
      </div>

      <div className={`verification-banner ${verificationStatus}`}>
        {verificationStatus === 'verified' ? (
          <>
            <span className="icon">✅</span>
            <span>Identity verified through ID.Me</span>
          </>
        ) : verificationStatus === 'pending' ? (
          <>
            <span className="icon">⏳</span>
            <span>Verifying identity...</span>
          </>
        ) : (
          <>
            <span className="icon">⚠️</span>
            <span>Identity not yet verified</span>
          </>
        )}
      </div>

      {!provider.verified && (
        <div className="id-me-section">
          <h2>Identity Verification Required</h2>
          <p>Verify your identity to claim this profile and display your contact information to clients.</p>
          <button
            onClick={handleVerifyWithIDme}
            disabled={showIDmeFlow}
            className="verify-button"
          >
            {showIDmeFlow ? 'Verifying with ID.Me...' : 'Verify with ID.Me'}
          </button>
        </div>
      )}

      <div className="privacy-controls">
        <h2>Privacy Settings</h2>

        <div className="control-item">
          <label>
            <input
              type="checkbox"
              checked={provider.profileVisible}
              onChange={toggleProfileVisibility}
              disabled={!provider.verified}
            />
            <span>Make my profile visible to clients</span>
          </label>
          {!provider.verified && <p className="hint">Requires ID.Me verification</p>}
        </div>

        <div className="control-item">
          <label>
            <input
              type="checkbox"
              checked={provider.showContactInfo}
              onChange={toggleContactInfoVisibility}
              disabled={!provider.verified}
            />
            <span>Show my contact information (email & phone)</span>
          </label>
          {!provider.verified && <p className="hint">Requires ID.Me verification</p>}
          {provider.verified && (
            <p className="hint">
              {provider.showContactInfo
                ? 'Your contact info is visible to clients'
                : 'Your contact info is hidden from clients'}
            </p>
          )}
        </div>
      </div>

      <div className="profile-section">
        <div className="section-header">
          <h2>Profile Information</h2>
          {!isEditing && (
            <button onClick={() => setIsEditing(true)} className="edit-button">
              ✏️ Edit
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="edit-form">
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => handleEditChange('name', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Specialization</label>
              <input
                type="text"
                value={editForm.specialization}
                onChange={(e) => handleEditChange('specialization', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Years of Experience</label>
              <input
                type="number"
                value={editForm.yearsExperience}
                onChange={(e) => handleEditChange('yearsExperience', parseInt(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label>Hourly Rate ($)</label>
              <input
                type="number"
                value={editForm.hourlyRate}
                onChange={(e) => handleEditChange('hourlyRate', parseInt(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => handleEditChange('email', e.target.value)}
                disabled={!editForm.showContactInfo}
              />
              {!editForm.showContactInfo && <p className="hint">Enable "Show contact info" to edit</p>}
            </div>

            <div className="form-group">
              <label>Phone</label>
              <input
                type="tel"
                value={editForm.phone}
                onChange={(e) => handleEditChange('phone', e.target.value)}
                disabled={!editForm.showContactInfo}
              />
              {!editForm.showContactInfo && <p className="hint">Enable "Show contact info" to edit</p>}
            </div>

            <div className="form-actions">
              <button onClick={handleSave} className="save-button">
                💾 Save Changes
              </button>
              <button onClick={handleCancel} className="cancel-button">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="profile-info">
            <div className="info-item">
              <label>Name</label>
              <p>{provider.name}</p>
            </div>

            <div className="info-item">
              <label>Specialization</label>
              <p>{provider.specialization}</p>
            </div>

            <div className="info-item">
              <label>Years of Experience</label>
              <p>{provider.yearsExperience} years</p>
            </div>

            <div className="info-item">
              <label>Hourly Rate</label>
              <p>${provider.hourlyRate}/hr</p>
            </div>

            {provider.showContactInfo && provider.verified && (
              <>
                <div className="info-item">
                  <label>Email</label>
                  <p>{provider.email}</p>
                </div>

                <div className="info-item">
                  <label>Phone</label>
                  <p>{provider.phone}</p>
                </div>
              </>
            )}

            <div className="info-item">
              <label>State</label>
              <p>{provider.state}</p>
            </div>

            <div className="info-item">
              <label>Rating</label>
              <p>⭐ {provider.rating} ({provider.reviews} reviews)</p>
            </div>

            <div className="info-item">
              <label>Verification Status</label>
              <p className={provider.verified ? 'verified' : 'unverified'}>
                {provider.verified ? '✅ Verified' : '⚠️ Not Verified'}
              </p>
            </div>

            <div className="info-item">
              <label>Profile Visibility</label>
              <p>{provider.profileVisible ? '👁️ Visible to clients' : '🔒 Hidden from clients'}</p>
            </div>
          </div>
        )}
      </div>

      <div className="how-it-works">
        <h2>How It Works</h2>
        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <h3>Verify Identity</h3>
            <p>Use ID.Me to verify your identity and claim your profile</p>
          </div>
          <div className="step">
            <div className="step-number">2</div>
            <h3>Edit Profile</h3>
            <p>Update your name, specialization, experience, and rates</p>
          </div>
          <div className="step">
            <div className="step-number">3</div>
            <h3>Control Privacy</h3>
            <p>Decide whether clients can see your contact information</p>
          </div>
          <div className="step">
            <div className="step-number">4</div>
            <h3>Go Live</h3>
            <p>Make your profile visible and start receiving client inquiries</p>
          </div>
        </div>
      </div>
    </div>
  );
};
