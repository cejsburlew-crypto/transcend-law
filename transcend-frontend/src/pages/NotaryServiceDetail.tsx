import React, { useState } from 'react';
import type { NotaryService } from './NotaryServices';
import { ContactsGrid } from '../components/ContactsGrid';
import type { ContactProfile } from '../components/ContactCard';
import { NOTARIES_BY_STATE } from '../data/contacts';
import './NotaryServiceDetail.css';

interface NotaryServiceDetailProps {
  service: NotaryService;
  onBack: () => void;
}

export const NotaryServiceDetail: React.FC<NotaryServiceDetailProps> = ({ service, onBack }) => {
  const [publicProfiles, setPublicProfiles] = useState<Set<string>>(new Set());

  const allNotaries = NOTARIES_BY_STATE['CA'] || [];

  return (
    <div className="notary-detail-container">
      <button className="back-btn" onClick={onBack}>← Back to Services</button>

      <div className="notary-detail-header">
        <h1>
          <span className="icon">{service.icon}</span>
          {service.name}
        </h1>
        <p className="main-description">{service.description}</p>
        <div className="service-info">
          <span className="info-item">
            <strong>⏱️ Average Time:</strong> {service.avgTime}
          </span>
          <span className="info-item">
            <strong>💰 Average Cost:</strong> {service.avgCost}
          </span>
          <span className="info-item">
            <strong>⚡ Availability:</strong>
            <span className={`badge ${service.availability.toLowerCase().replace('/', '-')}`}>
              {service.availability}
            </span>
          </span>
        </div>
      </div>

      <div className="examples-section">
        <h2>📋 What We Can Notarize</h2>
        <div className="examples-grid">
          {service.examples.map((example, idx) => (
            <div key={idx} className="example-card">
              <span className="example-icon">✓</span>
              <p>{example}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="booking-section">
        <button className="quick-book-btn">
          ⚡ Quick Book Now
        </button>
      </div>

      <div className="notaries-section">
        <h2>📋 Available Notaries ({allNotaries.length})</h2>
        <p style={{ color: '#666', marginBottom: '15px' }}>
          Browse all {allNotaries.length} available notaries. Contact them individually or send your request to all at once.
        </p>
        <button
          onClick={() => console.log('Send to all notaries')}
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
          📧 Send to All {allNotaries.length} Notaries at Once
        </button>
        <ContactsGrid
          contacts={allNotaries.map(notary => ({
            id: notary.id,
            name: notary.name,
            title: notary.certificationLevel,
            state: 'CA',
            rating: notary.rating,
            reviews: notary.reviews,
            verified: notary.rating >= 4.7,
            badges: notary.specialties ? notary.specialties.slice(0, 1) : ['Notarization'],
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
            console.log('Contacting notary:', contactId);
          }}
        />
      </div>

      <div className="benefits-section">
        <h3>✨ Why Choose Our Notaries?</h3>
        <ul>
          <li>✓ Available same-day, 24/7, or on your schedule</li>
          <li>✓ Mobile, online (eNotary), or in-person services</li>
          <li>✓ Licensed, bonded, and insured professionals</li>
          <li>✓ Average response time under 1 hour</li>
          <li>✓ No travel fees for local area services</li>
          <li>✓ Transparent pricing with no hidden charges</li>
        </ul>
      </div>
    </div>
  );
};
