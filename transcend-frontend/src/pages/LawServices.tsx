import React, { useState, useMemo } from 'react';
import { ContactsGrid } from '../components/ContactsGrid';
import type { ContactProfile } from '../components/ContactCard';
import { ATTORNEYS_BY_STATE } from '../data/contacts';
import './LawServices.css';

interface LawServicesProps {
  onBack?: () => void;
}

export const LawServices: React.FC<LawServicesProps> = ({ onBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedCounty, setSelectedCounty] = useState<string | null>(null);
  const [publicProfiles, setPublicProfiles] = useState<Set<string>>(new Set());

  // Get all attorneys for Tier 1 (premium, no state filter needed)
  const allStates = Object.keys(ATTORNEYS_BY_STATE);
  const tier1Attorneys = useMemo(() => {
    return allStates.flatMap(state =>
      (ATTORNEYS_BY_STATE[state as keyof typeof ATTORNEYS_BY_STATE] || [])
        .filter(a => a.tier === 'tier1')
    );
  }, []);

  // Get attorneys for selected state (Tier 1 + Tier 2)
  const stateAttorneys = useMemo(() => {
    if (!selectedState) return [];
    return (ATTORNEYS_BY_STATE[selectedState as keyof typeof ATTORNEYS_BY_STATE] || [])
      .filter(a => a.tier === 'tier1' || a.tier === 'tier2');
  }, [selectedState]);

  // Get all attorneys for selected county (all tiers)
  const countyAttorneys = useMemo(() => {
    if (!selectedState) return [];
    return (ATTORNEYS_BY_STATE[selectedState as keyof typeof ATTORNEYS_BY_STATE] || [])
      .filter(a => !selectedCounty || a.county === selectedCounty);
  }, [selectedState, selectedCounty]);

  // Determine which attorneys to display
  const displayAttorneys = selectedCounty ? countyAttorneys : selectedState ? stateAttorneys : tier1Attorneys;

  // Get unique counties for selected state
  const availableCounties = useMemo(() => {
    if (!selectedState) return [];
    const counties = new Set(
      (ATTORNEYS_BY_STATE[selectedState as keyof typeof ATTORNEYS_BY_STATE] || [])
        .map(a => a.county)
    );
    return Array.from(counties).sort();
  }, [selectedState]);

  // Filter by search term
  const filtered = displayAttorneys.filter(attorney =>
    attorney.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    attorney.specialization.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayCount = filtered.length;
  const totalCount = displayAttorneys.length;

  return (
    <div className="law-services-container">
      <div className="services-header">
        <h1>⚖️ Legal Services - All Available Attorneys ({totalCount})</h1>
        <p>
          {!selectedState
            ? 'Browse premium attorneys available nationwide. Select a state to view more options.'
            : selectedCounty
            ? `Browse all attorneys in ${selectedCounty}, ${selectedState}.`
            : `Browse attorneys in ${selectedState}. Select a county to see all options.`}
        </p>
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
          value={selectedState || ''}
          onChange={(e) => {
            setSelectedState(e.target.value || null);
            setSelectedCounty(null);
          }}
          className="state-select"
        >
          <option value="">Select State...</option>
          <option value="CA">California</option>
          <option value="GA">Georgia</option>
          <option value="NC">North Carolina</option>
          <option value="OH">Ohio</option>
          <option value="LA">Louisiana</option>
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
          📧 Send to All {displayCount} Attorneys at Once
        </button>
      </div>

      <div className="attorney-stats">
        <p>Showing {displayCount} of {totalCount} attorneys</p>
      </div>

      {displayCount === 0 && !selectedState ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          <p>📍 Select a state to view all available attorneys</p>
        </div>
      ) : (
        <ContactsGrid
          contacts={filtered.map(attorney => ({
            id: attorney.id,
            name: attorney.name,
            title: 'Attorney',
            specialization: attorney.specialization,
            state: selectedState || attorney.state,
            county: attorney.county,
            rating: attorney.rating,
            reviews: attorney.reviews,
            yearsExperience: attorney.yearsExperience,
            hourlyRate: attorney.hourlyRate,
            verified: attorney.rating >= 4.7,
            badges: attorney.tier === 'tier1' ? ['Premium'] : attorney.tier === 'tier2' ? ['Standard'] : attorney.rating >= 4.8 ? ['Top Rated'] : [],
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
      )}

      {displayCount === 0 && selectedState && (
        <div className="no-results">
          <p>No attorneys found matching your search</p>
        </div>
      )}
    </div>
  );
};
