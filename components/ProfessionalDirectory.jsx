// TRANSCEND LAW - PROFESSIONAL DIRECTORY & SEARCH UI
// Advanced search, filtering, and professional profile discovery

import React, { useState, useEffect, useCallback } from 'react';
import './ProfessionalDirectory.css';

const ProfessionalDirectory = () => {
  // State management
  const [professionals, setProfessionals] = useState([]);
  const [filteredProfessionals, setFilteredProfessionals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    profession_type: '',
    state: '',
    min_rating: 0,
    hourly_rate_min: 0,
    hourly_rate_max: 10000,
    specializations: []
  });

  const [sortBy, setSortBy] = useState('rating_desc');
  const [resultsCount, setResultsCount] = useState(0);

  // Profession types for filter dropdown
  const professionTypes = [
    'Attorneys',
    'Paralegals',
    'Expert Witnesses',
    'Process Servers',
    'Court Reporters',
    'Mediators',
    'Bail Bondsmen',
    'Title Agents',
    'Legal Consultants',
    'Document Preparers',
    'Forensic Accountants',
    'Background Check Services',
    'Skip Tracers',
    'Insurance Adjusters'
  ];

  const states = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
  ];

  // Fetch professionals based on filters
  const fetchProfessionals = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();

      if (filters.profession_type) queryParams.append('profession_type', filters.profession_type);
      if (filters.state) queryParams.append('state', filters.state);
      if (filters.min_rating > 0) queryParams.append('min_rating', filters.min_rating);
      queryParams.append('rate_min', filters.hourly_rate_min);
      queryParams.append('rate_max', filters.hourly_rate_max);
      if (searchQuery) queryParams.append('search', searchQuery);
      queryParams.append('sort', sortBy);

      const response = await fetch(`/api/directory/search?${queryParams.toString()}`);
      const data = await response.json();

      setProfessionals(data.professionals || []);
      setFilteredProfessionals(data.professionals || []);
      setResultsCount(data.professionals?.length || 0);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, searchQuery, sortBy]);

  // Trigger search on filter changes
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchProfessionals();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [filters, searchQuery, sortBy, fetchProfessionals]);

  // Update filter
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // View professional details
  const handleViewDetails = (professional) => {
    setSelectedProfessional(professional);
    setShowDetailModal(true);
  };

  return (
    <div className="professional-directory">
      {/* HEADER */}
      <div className="directory-header">
        <h1>🔍 Find Legal Professionals</h1>
        <p>Search from {resultsCount.toLocaleString()}+ professionals across all 50 states</p>
      </div>

      {/* SEARCH BAR */}
      <div className="search-container">
        <input
          type="text"
          placeholder="Search by name, specialty, or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        <button className="search-button">Search</button>
      </div>

      <div className="directory-content">
        {/* FILTERS SIDEBAR */}
        <aside className="filters-sidebar">
          <h3>Filters</h3>

          {/* Profession Type */}
          <div className="filter-group">
            <label>Profession Type</label>
            <select
              value={filters.profession_type}
              onChange={(e) => handleFilterChange('profession_type', e.target.value)}
              className="filter-select"
            >
              <option value="">All Professions</option>
              {professionTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* State */}
          <div className="filter-group">
            <label>State</label>
            <select
              value={filters.state}
              onChange={(e) => handleFilterChange('state', e.target.value)}
              className="filter-select"
            >
              <option value="">All States</option>
              {states.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>

          {/* Minimum Rating */}
          <div className="filter-group">
            <label>Minimum Rating</label>
            <div className="rating-filter">
              {[0, 3.5, 4.0, 4.5].map(rating => (
                <button
                  key={rating}
                  className={`rating-btn ${filters.min_rating === rating ? 'active' : ''}`}
                  onClick={() => handleFilterChange('min_rating', rating)}
                >
                  {rating === 0 ? 'All' : `${rating}+`}
                </button>
              ))}
            </div>
          </div>

          {/* Hourly Rate Range */}
          <div className="filter-group">
            <label>Hourly Rate</label>
            <div className="rate-range">
              <input
                type="number"
                min="0"
                max="10000"
                value={filters.hourly_rate_min}
                onChange={(e) => handleFilterChange('hourly_rate_min', parseInt(e.target.value))}
                placeholder="Min"
                className="rate-input"
              />
              <span>-</span>
              <input
                type="number"
                min="0"
                max="10000"
                value={filters.hourly_rate_max}
                onChange={(e) => handleFilterChange('hourly_rate_max', parseInt(e.target.value))}
                placeholder="Max"
                className="rate-input"
              />
            </div>
          </div>

          {/* Sort By */}
          <div className="filter-group">
            <label>Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="filter-select"
            >
              <option value="rating_desc">Highest Rated</option>
              <option value="rating_asc">Lowest Rated</option>
              <option value="rate_asc">Cheapest</option>
              <option value="rate_desc">Most Expensive</option>
              <option value="recent">Most Recent</option>
            </select>
          </div>

          {/* Clear Filters */}
          <button
            className="clear-filters-btn"
            onClick={() => {
              setSearchQuery('');
              setFilters({
                profession_type: '',
                state: '',
                min_rating: 0,
                hourly_rate_min: 0,
                hourly_rate_max: 10000,
                specializations: []
              });
            }}
          >
            Clear All Filters
          </button>
        </aside>

        {/* RESULTS */}
        <main className="directory-results">
          {/* Results Count */}
          <div className="results-header">
            <p>Showing {resultsCount} professionals</p>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="results-loading">
              <p>Searching...</p>
            </div>
          )}

          {/* Results Grid */}
          {!loading && filteredProfessionals.length > 0 ? (
            <div className="professionals-grid">
              {filteredProfessionals.map(prof => (
                <div key={prof.id} className="professional-card">
                  {/* Avatar */}
                  <div className="prof-avatar">
                    {prof.full_name?.[0]?.toUpperCase() || 'P'}
                  </div>

                  {/* Name & Title */}
                  <h3 className="prof-name">{prof.full_name}</h3>
                  <p className="prof-profession">{prof.profession_type}</p>
                  <p className="prof-location">{prof.state}</p>

                  {/* Rating */}
                  <div className="prof-rating">
                    <span className="stars">
                      {'⭐'.repeat(Math.floor(prof.avg_rating || 0))}
                    </span>
                    <span className="rating-value">
                      {prof.avg_rating?.toFixed(1) || 'N/A'}
                    </span>
                  </div>

                  {/* Specializations */}
                  {prof.specializations && (
                    <div className="prof-specializations">
                      {prof.specializations.slice(0, 2).map((spec, idx) => (
                        <span key={idx} className="spec-tag">{spec}</span>
                      ))}
                    </div>
                  )}

                  {/* Rate */}
                  <p className="prof-rate">
                    ${prof.hourly_rate?.toFixed(0) || 'TBD'}/hr
                  </p>

                  {/* CTA Buttons */}
                  <div className="prof-actions">
                    <button
                      className="btn-details"
                      onClick={() => handleViewDetails(prof)}
                    >
                      View Profile
                    </button>
                    <button className="btn-request">Request Services</button>
                  </div>
                </div>
              ))}
            </div>
          ) : !loading && (
            <div className="results-empty">
              <p>No professionals found matching your criteria.</p>
              <p>Try adjusting your filters or search terms.</p>
            </div>
          )}
        </main>
      </div>

      {/* DETAIL MODAL */}
      {showDetailModal && selectedProfessional && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close"
              onClick={() => setShowDetailModal(false)}
            >
              ✕
            </button>

            {/* Professional Details */}
            <div className="prof-detail-header">
              <div className="prof-detail-avatar">
                {selectedProfessional.full_name?.[0]?.toUpperCase()}
              </div>
              <div className="prof-detail-info">
                <h2>{selectedProfessional.full_name}</h2>
                <p className="profession">{selectedProfessional.profession_type}</p>
                <p className="location">📍 {selectedProfessional.state}</p>
              </div>
            </div>

            {/* Rating & Stats */}
            <div className="prof-detail-stats">
              <div className="stat">
                <span className="stat-label">Rating</span>
                <span className="stat-value">
                  {selectedProfessional.avg_rating?.toFixed(1) || 'N/A'} ⭐
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">Rate</span>
                <span className="stat-value">
                  ${selectedProfessional.hourly_rate?.toFixed(0) || 'TBD'}/hr
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">Available</span>
                <span className="stat-value">
                  {selectedProfessional.available_for_referrals ? '✓ Yes' : '✗ No'}
                </span>
              </div>
            </div>

            {/* Specializations */}
            {selectedProfessional.specializations && (
              <div className="prof-detail-section">
                <h3>Specializations</h3>
                <div className="specializations-list">
                  {selectedProfessional.specializations.map((spec, idx) => (
                    <span key={idx} className="spec-badge">{spec}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Contact */}
            <div className="prof-detail-section">
              <h3>Contact Information</h3>
              <p>📧 {selectedProfessional.email}</p>
              <p>📞 {selectedProfessional.phone}</p>
            </div>

            {/* Request CTA */}
            <button className="btn-request-large">
              Request Services from {selectedProfessional.full_name}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfessionalDirectory;
