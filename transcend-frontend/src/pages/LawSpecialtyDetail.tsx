import React, { useState } from 'react';
import type { LawSpecialty } from './LawSpecialties';
import { ContactsGrid } from '../components/ContactsGrid';
import type { ContactProfile } from '../components/ContactCard';
import { ATTORNEYS_BY_STATE } from '../data/contacts';
import './LawSpecialtyDetail.css';

interface LawSpecialtyDetailProps {
  specialty: LawSpecialty;
  onBack: () => void;
}

export const LawSpecialtyDetail: React.FC<LawSpecialtyDetailProps> = ({ specialty, onBack }) => {
  const [publicProfiles, setPublicProfiles] = useState<Set<string>>(new Set());

  const allAttorneys = ATTORNEYS_BY_STATE['CA'] || [];

  return (
    <div className="specialty-detail-container">
      <button className="back-btn" onClick={onBack}>← Back to Specialties</button>

      <div className="specialty-detail-header">
        <div className="header-content">
          <h1>
            <span className="icon">{specialty.icon}</span>
            {specialty.name}
          </h1>
          <p className="main-description">{specialty.description}</p>
          <div className="specialty-info">
            <span className="info-item">
              <strong>Complexity:</strong>
              <span className={`badge ${specialty.complexity.toLowerCase()}`}>
                {specialty.complexity}
              </span>
            </span>
            <span className="info-item">
              <strong>Average Cost:</strong> {specialty.avgCost}
            </span>
          </div>
        </div>
      </div>

      <div className="examples-section">
        <h2>📋 Common Situations We Handle</h2>
        <div className="examples-grid">
          {specialty.examples.map((example, idx) => (
            <div key={idx} className="example-card">
              <span className="example-icon">✓</span>
              <p>{example}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="intake-section">
        <button className="intake-btn">
          📝 {specialty.name} Intake Form
        </button>
      </div>

      <div className="filtering-section">
        <h2>📋 Available Attorneys ({allAttorneys.length})</h2>
        <p style={{ color: '#666', marginBottom: '15px' }}>
          Browse all {allAttorneys.length} available attorneys for {specialty.name}.
        </p>
        <button
          onClick={() => console.log('Send to all attorneys')}
          style={{
            padding: '12px 24px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            width: '100%',
            marginBottom: '20px'
          }}
        >
          📧 Send to All {allAttorneys.length} Attorneys at Once
        </button>

        <ContactsGrid
          contacts={allAttorneys.map(attorney => ({
            id: attorney.id,
            name: attorney.name,
            title: 'Attorney',
            specialization: attorney.specialization,
            state: 'CA',
            rating: attorney.rating,
            reviews: attorney.reviews,
            yearsExperience: attorney.yearsExperience,
            hourlyRate: attorney.hourlyRate,
            verified: attorney.rating >= 4.7,
            badges: attorney.rating >= 4.8 ? ['Top Rated'] : [],
          } as ContactProfile))}
          publicProfiles={publicProfiles}
          onProfileToggle={(contactId) => {
            const newPublic = new Set(publicProfiles);
            if (newPublic.has(contactId)) {
              newPublic.delete(contactId);
            } else {
              newPublic.add(contactId);
            }
            setPublicProfiles(newPublic);
          }}
          onCommunicate={(contactId) => {
            console.log('Sending message to attorney:', contactId);
          }}
        />
      </div>
    </div>
  );
};
