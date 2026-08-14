import React, { useState } from 'react'
import './ProviderProfile.css'

interface Provider {
  id: string
  name: string
  title: string
  rating: number
  reviews: number
  firmId: string
  firmName: string
  firmWebsite: string
  avatar: string
  verified: boolean
  yearsExperience: number
  specialties: string[]
  availability: 'available' | 'busy' | 'unavailable'
  hourlyRate?: number
  bio?: string
  languages?: string[]
  certifications?: string[]
  awards?: string[]
}

interface ProviderProfileProps {
  provider: Provider
  onBack: () => void
  onStartRequest: () => void
}

export const ProviderProfile: React.FC<ProviderProfileProps> = ({
  provider,
  onBack,
  onStartRequest,
}) => {
  const [activeTab, setActiveTab] = useState('overview')

  const mockReviews = [
    {
      id: 1,
      author: 'Jane Doe',
      rating: 5,
      date: '2 weeks ago',
      text: 'Excellent service! Very professional and thorough. Highly recommend.',
    },
    {
      id: 2,
      author: 'John Smith',
      rating: 4,
      date: '1 month ago',
      text: 'Great experience. Very knowledgeable and responsive.',
    },
    {
      id: 3,
      author: 'Sarah Johnson',
      rating: 5,
      date: '2 months ago',
      text: 'Outstanding work. Exceeded all expectations.',
    },
  ]

  return (
    <div className="provider-profile-page">
      {/* Header with back button */}
      <div className="profile-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
      </div>

      {/* Profile Hero */}
      <div className="profile-hero">
        <div className="profile-avatar-large">{provider.avatar}</div>
        <div className="profile-hero-info">
          <div className="profile-name-section">
            <h1>{provider.name}</h1>
            <p className="profile-title">{provider.title}</p>
            {provider.verified && <span className="verified-badge">✓ Verified Professional</span>}
          </div>
          <div className="profile-stats">
            <div className="stat">
              <div className="stat-value">⭐ {provider.rating}</div>
              <div className="stat-label">{provider.reviews} Reviews</div>
            </div>
            <div className="stat">
              <div className="stat-value">{provider.yearsExperience}</div>
              <div className="stat-label">Years Experience</div>
            </div>
            {provider.hourlyRate && (
              <div className="stat">
                <div className="stat-value">${provider.hourlyRate}/hr</div>
                <div className="stat-label">Hourly Rate</div>
              </div>
            )}
            <div className="stat">
              <div className={`stat-value ${provider.availability}`}>
                {provider.availability === 'available' && '🟢 Available'}
                {provider.availability === 'busy' && '🟡 Busy'}
                {provider.availability === 'unavailable' && '🔴 Unavailable'}
              </div>
              <div className="stat-label">Status</div>
            </div>
          </div>
        </div>

        <div className="profile-actions">
          <button className="btn-primary" onClick={onStartRequest}>
            Start Request
          </button>
          <button className="btn-secondary" onClick={() => {}}>
            Message
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="profile-tabs">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
          onClick={() => setActiveTab('reviews')}
        >
          Reviews ({provider.reviews})
        </button>
        <button
          className={`tab-btn ${activeTab === 'firm' ? 'active' : ''}`}
          onClick={() => setActiveTab('firm')}
        >
          Firm Info
        </button>
      </div>

      <div className="profile-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="tab-content">
            {/* Bio */}
            <div className="content-section">
              <h2>About</h2>
              <p>
                {provider.bio ||
                  `Highly experienced ${provider.title.toLowerCase()} with a proven track record of success. Specialized in ${provider.specialties.join(
                    ', '
                  )}. Dedicated to providing exceptional service to all clients.`}
              </p>
            </div>

            {/* Specialties */}
            <div className="content-section">
              <h2>Specialties</h2>
              <div className="specialty-tags">
                {provider.specialties.map((spec) => (
                  <span key={spec} className="specialty-tag">
                    {spec}
                  </span>
                ))}
              </div>
            </div>

            {/* Languages */}
            {provider.languages && provider.languages.length > 0 && (
              <div className="content-section">
                <h2>Languages</h2>
                <div className="language-list">
                  {provider.languages.map((lang) => (
                    <span key={lang} className="language-badge">
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Certifications */}
            {provider.certifications && provider.certifications.length > 0 && (
              <div className="content-section">
                <h2>Certifications & Credentials</h2>
                <ul className="credentials-list">
                  {provider.certifications.map((cert) => (
                    <li key={cert}>✓ {cert}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Awards */}
            {provider.awards && provider.awards.length > 0 && (
              <div className="content-section">
                <h2>Awards & Recognition</h2>
                <ul className="awards-list">
                  {provider.awards.map((award) => (
                    <li key={award}>🏆 {award}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div className="tab-content">
            <div className="reviews-summary">
              <div className="rating-display">
                <div className="rating-stars">⭐⭐⭐⭐⭐</div>
                <div className="rating-value">{provider.rating}</div>
                <div className="rating-count">Based on {provider.reviews} reviews</div>
              </div>
            </div>

            <div className="reviews-list">
              {mockReviews.map((review) => (
                <div key={review.id} className="review-item">
                  <div className="review-header">
                    <div className="review-author">{review.author}</div>
                    <div className="review-date">{review.date}</div>
                  </div>
                  <div className="review-rating">
                    {'⭐'.repeat(review.rating)}
                  </div>
                  <p className="review-text">{review.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Firm Info Tab */}
        {activeTab === 'firm' && (
          <div className="tab-content">
            <div className="firm-card">
              <h2>Firm Information</h2>
              <div className="firm-details">
                <div className="firm-item">
                  <span className="firm-label">Firm Name:</span>
                  <span className="firm-value">{provider.firmName}</span>
                </div>
                <div className="firm-item">
                  <span className="firm-label">Website:</span>
                  <a href={provider.firmWebsite} target="_blank" rel="noopener noreferrer" className="firm-link">
                    {provider.firmWebsite}
                  </a>
                </div>
                <div className="firm-item">
                  <span className="firm-label">Contact:</span>
                  <span className="firm-value">
                    Email through platform or visit website
                  </span>
                </div>
              </div>

              <div className="firm-action-section">
                <button className="btn-secondary-large">
                  Visit Firm Profile →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
