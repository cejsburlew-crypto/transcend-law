import React, { useState, useMemo } from 'react';
import { ContactsGrid } from '../components/ContactsGrid';
import type { ContactProfile } from '../components/ContactCard';
import { NOTARIES_BY_STATE } from '../data/contacts';
import './NotaryServices.css';

interface NotaryServicesProps {
  onBack?: () => void;
}

export const NotaryServices: React.FC<NotaryServicesProps> = ({ onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedCounty, setSelectedCounty] = useState<string | null>(null);
  const [publicProfiles, setPublicProfiles] = useState<Set<string>>(new Set());

  // Get all notaries for Tier 1 (premium, no state filter needed)
  const allStates = Object.keys(NOTARIES_BY_STATE);
  const tier1Notaries = useMemo(() => {
    return allStates.flatMap(state =>
      (NOTARIES_BY_STATE[state as keyof typeof NOTARIES_BY_STATE] || [])
        .filter(n => n.tier === 'tier1')
    );
  }, []);

  // Get notaries for selected state (Tier 1 + Tier 2)
  const stateNotaries = useMemo(() => {
    if (!selectedState) return [];
    return (NOTARIES_BY_STATE[selectedState as keyof typeof NOTARIES_BY_STATE] || [])
      .filter(n => n.tier === 'tier1' || n.tier === 'tier2');
  }, [selectedState]);

  // Get all notaries for selected county (all tiers)
  const countyNotaries = useMemo(() => {
    if (!selectedState) return [];
    return (NOTARIES_BY_STATE[selectedState as keyof typeof NOTARIES_BY_STATE] || [])
      .filter(n => !selectedCounty || n.county === selectedCounty);
  }, [selectedState, selectedCounty]);

  // Determine which notaries to display
  const displayNotaries = selectedCounty ? countyNotaries : selectedState ? stateNotaries : tier1Notaries;

  // Get unique counties for selected state
  const availableCounties = useMemo(() => {
    if (!selectedState) return [];
    const counties = new Set(
      (NOTARIES_BY_STATE[selectedState as keyof typeof NOTARIES_BY_STATE] || [])
        .map(n => n.county)
    );
    return Array.from(counties).sort();
  }, [selectedState]);

  // Filter by search term
  const filtered = displayNotaries.filter(notary =>
    notary.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    notary.certificationLevel.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayCount = filtered.length;
  const totalCount = displayNotaries.length;

  return (
    <div className="notary-services-container">
      <div className="services-header">
        <h1>🔏 Notary Services - All Available Notaries ({totalCount})</h1>
        <p>
          {!selectedState
            ? 'Browse premium notaries available nationwide. Select a state to view more options.'
            : selectedCounty
            ? `Browse all notaries in ${selectedCounty}, ${selectedState}.`
            : `Browse notaries in ${selectedState}. Select a county to see all options.`}
        </p>
      </div>

      <div className="filters-section">
        <input
          type="text"
          placeholder="Search by name or certification..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />

        <select
          value={selectedState || ''}
          onChange={(e) => {
            setSelectedState(e.target.value || null);
            setSelectedCounty(null);
          }}
          className="state-select"
        >
          <option value="">Select State...</option>
          <option value="CA">California</option>
          <option value="TX">Texas</option>
          <option value="FL">Florida</option>
          <option value="NY">New York</option>
          <option value="IL">Illinois</option>
        </select>

        {selectedState && (
          <select
            value={selectedCounty || ''}
            onChange={(e) => setSelectedCounty(e.target.value || null)}
            className="county-select"
          >
            <option value="">All Counties in {selectedState}</option>
            {availableCounties.map(county => (
              <option key={county} value={county}>{county}</option>
            ))}
          </select>
        )}

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
          📧 Send to All {displayCount} Notaries at Once
        </button>
      </div>

      <div className="notary-stats">
        <p>Showing {displayCount} of {totalCount} notaries</p>
      </div>

      {displayCount === 0 && !selectedState ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          <p>📍 Select a state to view all available notaries</p>
        </div>
      ) : (
        <ContactsGrid
          contacts={filtered.map(notary => ({
            id: notary.id,
            name: notary.name,
            title: 'Notary',
            specialization: notary.certificationLevel,
            state: selectedState || notary.state,
            county: notary.county,
            rating: notary.rating,
            reviews: notary.reviews,
            yearsExperience: 0,
            hourlyRate: 0,
            verified: notary.verified,
            badges: notary.tier === 'tier1' ? ['Premium'] : notary.tier === 'tier2' ? ['Standard'] : [],
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
      )}

      {displayCount === 0 && selectedState && (
        <div className="no-results">
          <p>No notaries found matching your search</p>
        </div>
      )}
    </div>
  );
};
