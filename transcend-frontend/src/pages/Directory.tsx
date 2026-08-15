import React, { useState, useEffect } from 'react';
import './Directory.css';

type EntityType = 'lawyers' | 'firms' | 'notaries';

interface LawFirm {
  firm_id: string;
  firm_name: string;
  city: string;
  county: string;
  state: string;
  practice_areas: string;
  phone: string;
  website: string;
  estimated_attorney_count: number;
}

interface DirectoryEntity {
  id: string;
  name: string;
  type: EntityType;
  state: string;
  city: string;
  specialties: string;
  phone?: string;
  website?: string;
  count?: number;
}

export const Directory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<EntityType>('firms');
  const [selectedState, setSelectedState] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');
  const [entities, setEntities] = useState<DirectoryEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [states, setStates] = useState<string[]>([]);
  const [specialties, setSpecialties] = useState<string[]>([]);

  // Fetch data based on selected type
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const endpoint = selectedType === 'firms'
          ? '/api/v1/directory/firms'
          : '/api/v1/directory/notaries';

        const response = await fetch(endpoint);
        if (response.ok) {
          const data = await response.json();
          setEntities(data.data);
          setStates(data.filters?.states || []);
          setSpecialties(data.filters?.specialties || []);
        }
      } catch (error) {
        console.error('Error fetching directory data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedType]);

  // Filter entities
  const filtered = entities.filter(entity => {
    const matchesSearch = searchTerm === '' ||
      entity.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entity.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entity.specialties.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesState = selectedState === '' || entity.state === selectedState;

    const matchesSpecialty = selectedSpecialty === '' ||
      (entity.specialties && entity.specialties.includes(selectedSpecialty));

    return matchesSearch && matchesState && matchesSpecialty;
  });

  const typeLabels = {
    firms: '🏢 Law Firms',
    lawyers: '👨‍⚖️ Lawyers',
    notaries: '📋 Notaries',
  };

  return (
    <div className="directory-container">
      <div className="directory-header">
        <h1>📊 Complete Directory</h1>
        <p>Admin view: All professionals and firms across all states</p>
      </div>

      {/* Type Tabs */}
      <div className="type-tabs">
        {(['firms', 'lawyers', 'notaries'] as EntityType[]).map(type => (
          <button
            key={type}
            className={`type-tab ${selectedType === type ? 'active' : ''}`}
            onClick={() => {
              setSelectedType(type);
              setSelectedState('');
              setSelectedSpecialty('');
              setSearchTerm('');
            }}
          >
            {typeLabels[type]}
          </button>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="search-section">
        <div className="search-bar">
          <input
            type="text"
            placeholder={`Search by name, city, or specialty...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>

        <div className="filters">
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="filter-select"
          >
            <option value="">All States ({states.length})</option>
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {specialties.length > 0 && (
            <select
              value={selectedSpecialty}
              onChange={(e) => setSelectedSpecialty(e.target.value)}
              className="filter-select"
            >
              <option value="">All Specialties ({specialties.length})</option>
              {specialties.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Results Info */}
      <div className="results-info">
        <span className="count">
          Showing {filtered.length} of {entities.length} {typeLabels[selectedType].split(' ')[1].toLowerCase()}
        </span>
        {searchTerm && <span className="filter-badge">Search: "{searchTerm}"</span>}
        {selectedState && <span className="filter-badge">State: {selectedState}</span>}
        {selectedSpecialty && <span className="filter-badge">Specialty: {selectedSpecialty}</span>}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="loading-container">
          <p>Loading directory data...</p>
        </div>
      )}

      {/* Results Grid */}
      {!loading && (
        <div className="directory-grid">
          {filtered.length > 0 ? (
            filtered.map((entity, idx) => (
              <div key={`${entity.id}-${idx}`} className={`directory-card ${selectedType}`}>
                <div className="card-icon">
                  {selectedType === 'firms' ? '🏢' : selectedType === 'lawyers' ? '👨‍⚖️' : '📋'}
                </div>
                <h3>{entity.name}</h3>

                <div className="card-details">
                  <p className="location">
                    <span className="label">📍 Location:</span>
                    <span>{entity.city}, {entity.state}</span>
                  </p>

                  {entity.count && (
                    <p className="count-detail">
                      <span className="label">👥 Attorneys:</span>
                      <span>{entity.count}</span>
                    </p>
                  )}

                  {entity.specialties && (
                    <p className="specialties">
                      <span className="label">⚖️ Specialties:</span>
                      <span className="spec-list">
                        {entity.specialties.substring(0, 100)}
                        {entity.specialties.length > 100 ? '...' : ''}
                      </span>
                    </p>
                  )}

                  {entity.phone && (
                    <p className="contact">
                      <span className="label">📞 Phone:</span>
                      <a href={`tel:${entity.phone}`}>{entity.phone}</a>
                    </p>
                  )}

                  {entity.website && (
                    <p className="contact">
                      <span className="label">🌐 Website:</span>
                      <a href={`https://${entity.website}`} target="_blank" rel="noopener noreferrer">
                        {entity.website}
                      </a>
                    </p>
                  )}
                </div>

                <button className="action-btn">View Details</button>
              </div>
            ))
          ) : (
            <div className="no-results">
              <p>No {typeLabels[selectedType].toLowerCase()} found matching your search.</p>
              <p className="hint">Try adjusting your search terms or filters.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
