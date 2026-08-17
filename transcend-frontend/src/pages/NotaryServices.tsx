import React, { useState } from 'react';
import { ContactsGrid } from '../components/ContactsGrid';
import type { ContactProfile } from '../components/ContactCard';
import { NOTARIES_BY_STATE } from '../data/contacts';
import './NotaryServices.css';

interface NotaryServicesProps {
  onBack?: () => void;
}

export const NotaryServices: React.FC<NotaryServicesProps> = ({ onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState<string>('CA');
  const [publicProfiles, setPublicProfiles] = useState<Set<string>>(new Set());

  const allNotaries = NOTARIES_BY_STATE[selectedState as keyof typeof NOTARIES_BY_STATE] || [];

  const filtered = allNotaries.filter(notary =>
    notary.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    notary.specialization.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="notary-services-container">
      <div className="services-header">
        <h1>🔏 Notary Services - All Available Notaries ({allNotaries.length})</h1>
        <p>Browse all {allNotaries.length} available notaries in your state. Personal information is private until you connect.</p>
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
          onClick={() => console.log('Send to all notaries')}
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
          📧 Send to All {filtered.length} Notaries at Once
        </button>
      </div>

      <div className="notary-stats">
        <p>Showing {filtered.length} of {allNotaries.length} notaries</p>
      </div>

      <ContactsGrid
        contacts={filtered.map(notary => ({
          id: notary.id,
          name: notary.name,
          title: 'Notary',
          specialization: notary.specialization,
          state: selectedState,
          rating: notary.rating,
          reviews: notary.reviews,
          yearsExperience: notary.yearsExperience,
          hourlyRate: notary.hourlyRate,
          verified: notary.rating >= 4.7,
          badges: notary.rating >= 4.8 ? ['Top Rated'] : [],
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
          console.log('Initiating service with notary:', contactId);
        }}
      />

      {filtered.length === 0 && (
        <div className="no-results">
          <p>No notaries found matching your search</p>
        </div>
      )}
    </div>
  );
};
