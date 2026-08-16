import React, { useState } from 'react';
import './ContactCard.css';

export interface ContactProfile {
  id: string;
  name: string;
  title: string;
  specialization?: string;
  state: string;
  rating: number;
  reviews: number;
  yearsExperience?: number;
  hourlyRate?: number;
  image?: string;
  verified?: boolean;
  badges?: string[];
}

interface ContactCardProps {
  contact: ContactProfile;
  isPublic?: boolean;
  onProfileToggle?: (contactId: string) => void;
  onCommunicate?: (contactId: string) => void;
  onSelect?: (contact: ContactProfile) => void;
}

export const ContactCard: React.FC<ContactCardProps> = ({
  contact,
  isPublic = false,
  onProfileToggle,
  onCommunicate,
  onSelect,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  const maskEmail = (email: string) => {
    const [user, domain] = email.split('@');
    return `${user.substring(0, 2)}***@${domain}`;
  };

  const maskPhone = (phone: string) => {
    return phone.replace(/(\d{3})-(\d{3})-(\d{4})/, '$1-***-****');
  };

  return (
    <div className="contact-card">
      {/* Header with avatar and basic info */}
      <div className="contact-card-header">
        <div className="contact-avatar">
          {contact.image ? (
            <img src={contact.image} alt={contact.name} />
          ) : (
            <div className="avatar-placeholder">
              {contact.name
                .split(' ')
                .map((n) => n[0])
                .join('')}
            </div>
          )}
        </div>

        <div className="contact-info-basic">
          {/* Name - hidden if not public */}
          <div className="contact-name">
            {isPublic ? (
              <h3>{contact.name}</h3>
            ) : (
              <div className="anonymous-name">
                <h3>Anonymous {contact.title}</h3>
                <span className="privacy-badge">🔒 Profile Hidden</span>
              </div>
            )}
          </div>

          {/* Title */}
          <p className="contact-title">{contact.title}</p>

          {/* Specialization */}
          {contact.specialization && (
            <p className="contact-spec">{contact.specialization}</p>
          )}

          {/* Location - state only if not public */}
          <p className="contact-location">
            {isPublic ? `📍 ${contact.state}` : `📍 ${contact.state}`}
          </p>
        </div>

        {/* Verification badge */}
        {contact.verified && (
          <div className="verified-badge" title="Verified provider">
            ✓
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="contact-stats">
        <div className="stat">
          <span className="stat-label">Rating</span>
          <span className="stat-value">⭐ {contact.rating.toFixed(1)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Reviews</span>
          <span className="stat-value">{contact.reviews}</span>
        </div>
        {contact.yearsExperience && (
          <div className="stat">
            <span className="stat-label">Experience</span>
            <span className="stat-value">{contact.yearsExperience} yrs</span>
          </div>
        )}
      </div>

      {/* Badges */}
      {contact.badges && contact.badges.length > 0 && (
        <div className="contact-badges">
          {contact.badges.map((badge) => (
            <span key={badge} className="badge">
              {badge}
            </span>
          ))}
        </div>
      )}

      {/* Details section - appears on hover/click */}
      {showDetails && isPublic && (
        <div className="contact-details">
          {contact.hourlyRate && (
            <div className="detail-item">
              <span className="detail-label">Hourly Rate:</span>
              <span className="detail-value">${contact.hourlyRate}/hr</span>
            </div>
          )}
          <div className="detail-item">
            <span className="detail-label">State License:</span>
            <span className="detail-value">{contact.state}</span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="contact-actions">
        {/* Profile visibility toggle */}
        {onProfileToggle && (
          <button
            className={`btn btn-secondary ${isPublic ? 'active' : ''}`}
            onClick={() => onProfileToggle(contact.id)}
            title={isPublic ? 'Make profile private' : 'Make profile public'}
          >
            {isPublic ? '🔓 Public' : '🔒 Private'}
          </button>
        )}

        {/* Communicate button */}
        {onCommunicate && isPublic && (
          <button
            className="btn btn-primary"
            onClick={() => onCommunicate(contact.id)}
          >
            💬 Message
          </button>
        )}

        {/* Select/View details button */}
        {onSelect && (
          <button
            className="btn btn-secondary"
            onClick={() => onSelect(contact)}
          >
            View Profile →
          </button>
        )}

        {/* Toggle details */}
        <button
          className="btn btn-tertiary"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? '↑ Less' : '↓ More'}
        </button>
      </div>

      {/* Privacy notice if private */}
      {!isPublic && (
        <div className="privacy-notice">
          <p>
            ℹ️ <strong>Your privacy is protected.</strong> Your profile is hidden
            from this provider until you choose to reveal it or communicate directly.
          </p>
        </div>
      )}
    </div>
  );
};

export default ContactCard;
