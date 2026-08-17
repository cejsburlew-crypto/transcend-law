import React, { useState } from 'react';
import { ContactsGrid } from '../components/ContactsGrid';
import type { ContactProfile } from '../components/ContactCard';
import { ATTORNEYS_BY_STATE } from '../data/contacts';
import './LawServices.css';

interface LawServicesProps {
  onBack?: () => void;
}

export const LawServices: React.FC<LawServicesProps> = ({ onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState<string>('CA');
  const [publicProfiles, setPublicProfiles] = useState<Set<string>>(new Set());

  const allAttorneys = ATTORNEYS_BY_STATE[selectedState as keyof typeof ATTORNEYS_BY_STATE] || [];

  const filtered = allAttorneys.filter(attorney =>
    attorney.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    attorney.specialization.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="law-services-container">
      <div className="services-header">
        <h1>⚖️ Legal Services - All Available Attorneys ({allAttorneys.length})</h1>
        <p>Browse all {allAttorneys.length} available attorneys in your state. Personal information is private until you connect.</p>
      </div>

      <div className="filters-section">
        <input
          type="text"
          placeholder="Search by name or specialization..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />

        <select
          value={selectedState}
          onChange={(e) => setSelectedState(e.target.value)}
          className="state-select"
        >
          <option value="CA">California</option>
          <option value="NY">New York</option>
          <option value="TX">Texas</option>
          <option value="FL">Florida</option>
        </select>

        <button
          onClick={() => console.log('Send to all attorneys')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          📧 Send to All {filtered.length} Attorneys at Once
        </button>
      </div>

      <div className="attorney-stats">
        <p>Showing {filtered.length} of {allAttorneys.length} attorneys</p>
      </div>

      <ContactsGrid
        contacts={filtered.map(attorney => ({
          id: attorney.id,
          name: attorney.name,
          title: 'Attorney',
          specialization: attorney.specialization,
          state: selectedState,
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
          console.log('Initiating service with attorney:', contactId);
        }}
      />

      {filtered.length === 0 && (
        <div className="no-results">
          <p>No attorneys found matching your search</p>
        </div>
      )}
    </div>
  );
};
