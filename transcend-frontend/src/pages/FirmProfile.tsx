import React, { useState } from 'react'
import './FirmProfile.css'

interface Firm {
  id: string
  name: string
  website: string
  logo?: string
  phone?: string
  email?: string
  address?: string
  founded?: number
  specialties: string[]
  employeeCount?: string
  description?: string
  providers: Array<{
    id: string
    name: string
    title: string
    avatar: string
    rating: number
  }>
}

interface FirmProfileProps {
  firm: Firm
  onBack: () => void
}

export const FirmProfile: React.FC<FirmProfileProps> = ({ firm, onBack }) => {
  const [activeTab, setActiveTab] = useState('overview')

  const mockCaseStudies = [
    {
      id: 1,
      title: 'Successful Corporate M&A',
      description: 'Facilitated $50M merger between tech companies',
      outcome: 'Closed successfully with no litigation',
    },
    {
      id: 2,
      title: 'Complex Litigation Victory',
      description: 'Won high-stakes patent dispute',
      outcome: 'Favorable settlement for our client',
    },
    {
      id: 3,
      title: 'Estate Planning Service',
      description: 'Comprehensive estate plan for high-net-worth individual',
      outcome: 'Tax-optimized plan protecting $10M+ assets',
    },
  ]

  return (
    <div className="firm-profile-page">
      {/* Header */}
      <div className="firm-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
      </div>

      {/* Hero Section */}
      <div className="firm-hero">
        <div className="firm-logo">🏢</div>
        <div className="firm-hero-content">
          <h1>{firm.name}</h1>
          <div className="firm-meta">
            {firm.founded && <span>Founded: {firm.founded}</span>}
            {firm.employeeCount && <span>•</span>}
            {firm.employeeCount && <span>Team: {firm.employeeCount}</span>}
          </div>
          <p className="firm-bio">
            {firm.description ||
              `Leading provider of legal and professional services with a team of experienced attorneys and specialists. Dedicated to delivering exceptional results for our clients.`}
          </p>
          <div className="firm-contact">
            {firm.phone && (
              <div className="contact-item">
                <span className="contact-label">Phone:</span>
                <span className="contact-value">{firm.phone}</span>
              </div>
            )}
            {firm.email && (
              <div className="contact-item">
                <span className="contact-label">Email:</span>
                <span className="contact-value">{firm.email}</span>
              </div>
            )}
            {firm.address && (
              <div className="contact-item">
                <span className="contact-label">Address:</span>
                <span className="contact-value">{firm.address}</span>
              </div>
            )}
          </div>
        </div>
        <div className="firm-actions">
          <a href={firm.website} target="_blank" rel="noopener noreferrer" className="btn-visit-website">
            Visit Website →
          </a>
          <button className="btn-contact">Contact Firm</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="firm-tabs">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'team' ? 'active' : ''}`}
          onClick={() => setActiveTab('team')}
        >
          Our Team ({firm.providers.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'cases' ? 'active' : ''}`}
          onClick={() => setActiveTab('cases')}
        >
          Case Studies
        </button>
      </div>

      <div className="firm-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="tab-content">
            <div className="content-section">
              <h2>About Us</h2>
              <p>
                {firm.description ||
                  `${firm.name} is a full-service firm providing comprehensive legal and professional services to clients across multiple industries. With a team of experienced professionals, we pride ourselves on delivering innovative solutions and exceptional results.`}
              </p>
            </div>

            <div className="content-section">
              <h2>Practice Areas</h2>
              <div className="practice-areas">
                {firm.specialties.map((specialty) => (
                  <div key={specialty} className="practice-area">
                    <div className="practice-icon">⚖️</div>
                    <div className="practice-name">{specialty}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="content-section">
              <h2>Why Choose Us?</h2>
              <ul className="benefits-list">
                <li>✓ Experienced team of specialists</li>
                <li>✓ Proven track record of success</li>
                <li>✓ Client-focused approach</li>
                <li>✓ Competitive rates and flexible engagement</li>
                <li>✓ Available for urgent matters</li>
                <li>✓ Clear communication and transparency</li>
              </ul>
            </div>
          </div>
        )}

        {/* Team Tab */}
        {activeTab === 'team' && (
          <div className="tab-content">
            <div className="team-grid">
              {firm.providers.map((provider) => (
                <div key={provider.id} className="team-card">
                  <div className="team-avatar">{provider.avatar}</div>
                  <h3>{provider.name}</h3>
                  <p className="team-title">{provider.title}</p>
                  <div className="team-rating">⭐ {provider.rating}</div>
                  <button className="btn-view-profile">View Profile</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Case Studies Tab */}
        {activeTab === 'cases' && (
          <div className="tab-content">
            <div className="case-studies-list">
              {mockCaseStudies.map((caseStudy) => (
                <div key={caseStudy.id} className="case-study-card">
                  <h3>{caseStudy.title}</h3>
                  <p className="case-description">{caseStudy.description}</p>
                  <div className="case-outcome">
                    <span className="outcome-label">Outcome:</span>
                    <span className="outcome-value">{caseStudy.outcome}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
