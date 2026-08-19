import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import './UserProfile.css';

interface UserProfileProps {
  onNavigateProvider?: () => void;
  onBack?: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ onNavigateProvider, onBack }) => {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  // Initialize profile from authenticated user data
  useEffect(() => {
    if (user) {
      // Parse user name into first and last name
      const nameParts = user.name?.split(' ') || ['User'];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      setProfile({
        firstName,
        lastName,
        email: user.email || '',
        phone: user.phone || localStorage.getItem('userPhone') || '',
      });
    }
  }, [user]);

  const getInitials = () => {
    if (!profile.firstName) return 'U';
    const firstInitial = profile.firstName[0] || '';
    const lastInitial = profile.lastName[0] || '';
    return (firstInitial + lastInitial).toUpperCase();
  };

  return (
    <div className="user-profile-container">
      <div className="user-profile-card">
        {/* Profile Header */}
        <div className="profile-header">
          <div className="profile-avatar">{getInitials()}</div>
          <div className="profile-name-info">
            <h1 className="profile-name">
              {profile.firstName} {profile.lastName}
            </h1>
            <p className="profile-email">{profile.email}</p>
            {profile.phone && <p className="profile-phone">📞 {profile.phone}</p>}
          </div>
        </div>

        {/* Account Info Section */}
        <div className="profile-section">
          <h2 className="section-title">Account Information</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Email</label>
              <p>{profile.email}</p>
            </div>
            <div className="info-item">
              <label>First Name</label>
              <p>{profile.firstName}</p>
            </div>
            <div className="info-item">
              <label>Last Name</label>
              <p>{profile.lastName}</p>
            </div>
            {profile.phone && (
              <div className="info-item">
                <label>Phone</label>
                <p>{profile.phone}</p>
              </div>
            )}
          </div>
        </div>

        {/* Provider Profile Section */}
        <div className="profile-section provider-section">
          <h2 className="section-title">Service Provider Profile</h2>
          <p className="section-subtitle">
            Become a verified service provider on Transcend Law and connect with clients seeking legal services.
          </p>
          <div className="provider-features">
            <div className="feature-item">
              <span className="feature-icon">✓</span>
              <span className="feature-text">Get discovered by clients</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">✓</span>
              <span className="feature-text">Build your professional profile</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">✓</span>
              <span className="feature-text">Confirm your skills and expertise</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">✓</span>
              <span className="feature-text">Verified through ID.me identity check</span>
            </div>
          </div>
          <button
            className="provider-cta-btn"
            onClick={onNavigateProvider}
          >
            Create Provider Profile →
          </button>
        </div>

        {/* Quick Actions */}
        <div className="profile-section actions-section">
          <h2 className="section-title">Quick Actions</h2>
          <div className="actions-grid">
            <button className="action-btn" onClick={onBack}>
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
