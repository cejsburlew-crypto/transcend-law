import React, { useState } from 'react';
import './ServiceProviders.css';

interface Provider {
  id: string;
  name: string;
  title: string;
  rating: number;
  reviews: number;
  firmId: string;
  firmName: string;
  firmWebsite: string;
  avatar: string;
  verified: boolean;
  yearsExperience: number;
  specialties: string[];
  availability: 'available' | 'busy' | 'unavailable';
  hourlyRate?: number;
}

interface ServiceProviderPageProps {
  serviceName: string;
  serviceIcon: string;
  onBack: () => void;
  onSelectProvider?: (provider: Provider) => void;
}

const MOCK_PROVIDERS: Provider[] = [
  {
    id: 'prov-1',
    name: 'Sarah Mitchell',
    title: 'Notary Public',
    rating: 4.9,
    reviews: 156,
    firmId: 'firm-1',
    firmName: 'Mitchell & Associates Notary',
    firmWebsite: 'https://mitchellnotary.com',
    avatar: '👩‍💼',
    verified: true,
    yearsExperience: 8,
    specialties: ['Acknowledgment', 'Jurat', 'Apostille'],
    availability: 'available',
    hourlyRate: 35,
  },
  {
    id: 'prov-2',
    name: 'James Chen',
    title: 'Notary Public',
    rating: 4.8,
    reviews: 203,
    firmId: 'firm-2',
    firmName: 'ProNotary Services',
    firmWebsite: 'https://pronotary.com',
    avatar: '👨‍💼',
    verified: true,
    yearsExperience: 12,
    specialties: ['Acknowledgment', 'Jurat', 'Loan Signing'],
    availability: 'available',
    hourlyRate: 40,
  },
  {
    id: 'prov-3',
    name: 'Maria Rodriguez',
    title: 'Notary Public',
    rating: 4.7,
    reviews: 89,
    firmId: 'firm-3',
    firmName: 'Elite Notary Group',
    firmWebsite: 'https://elitenotary.com',
    avatar: '👩‍💼',
    verified: true,
    yearsExperience: 5,
    specialties: ['Acknowledgment', 'Jurat'],
    availability: 'busy',
    hourlyRate: 30,
  },
  {
    id: 'prov-4',
    name: 'David Thompson',
    title: 'Notary Public',
    rating: 4.6,
    reviews: 124,
    firmId: 'firm-4',
    firmName: 'Thompson Notary',
    firmWebsite: 'https://thompsonnotary.com',
    avatar: '👨‍💼',
    verified: true,
    yearsExperience: 10,
    specialties: ['Acknowledgment', 'Jurat', 'Apostille', 'Loan Signing'],
    availability: 'available',
    hourlyRate: 35,
  },
];

export const ServiceProviders: React.FC<ServiceProviderPageProps> = ({
  serviceName,
  serviceIcon,
  onBack,
  onSelectProvider,
}) => {
  const [activeMenuItem, setActiveMenuItem] = useState('providers');
  const [_selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [priceRange, setPriceRange] = useState<[number, number]>([30, 40]);
  const [minRating, setMinRating] = useState(0);
  const [minExperience, setMinExperience] = useState(0);
  const [selectedAvailability, setSelectedAvailability] = useState<string>('all');

  // Get min/max from providers for the slider range
  const minPrice = Math.min(...MOCK_PROVIDERS.map(p => p.hourlyRate || 30));
  const maxPrice = Math.max(...MOCK_PROVIDERS.map(p => p.hourlyRate || 400));

  // Filter providers by all criteria
  const filteredProviders = MOCK_PROVIDERS.filter((p) => {
    const priceMatch = (p.hourlyRate || minPrice) >= priceRange[0] && (p.hourlyRate || maxPrice) <= priceRange[1];
    const ratingMatch = p.rating >= minRating;
    const experienceMatch = p.yearsExperience >= minExperience;
    const availabilityMatch = selectedAvailability === 'all' || p.availability === selectedAvailability;
    return priceMatch && ratingMatch && experienceMatch && availabilityMatch;
  });

  const handleViewProfile = (provider: Provider) => {
    setSelectedProvider(provider);
  };

  const handleStartIntake = (provider: Provider) => {
    if (onSelectProvider) {
      onSelectProvider(provider);
    }
  };

  return (
    <div className="service-providers-page">
      {/* Header */}
      <div className="service-providers-header">
        <button className="back-btn" onClick={onBack}>
          ← Back to Services
        </button>
        <h1>{serviceIcon} {serviceName} Service Providers</h1>
      </div>

      <div className="service-providers-container">
        {/* Left Sidebar Menu */}
        <aside className="service-menu">
          <div className="menu-section">
            <h3>Actions</h3>
            <button
              className={`menu-item ${activeMenuItem === 'form' ? 'active' : ''}`}
              onClick={() => setActiveMenuItem('form')}
            >
              📝 Start Intake Form
            </button>
            <button
              className={`menu-item ${activeMenuItem === 'providers' ? 'active' : ''}`}
              onClick={() => setActiveMenuItem('providers')}
            >
              👥 View All Providers
            </button>
          </div>

          <div className="menu-section">
            <h3>My Activity</h3>
            <button className="menu-item">
              📋 My Requests
            </button>
            <button className="menu-item">
              ✅ Completed
            </button>
            <button className="menu-item">
              ⏱️ In Progress
            </button>
          </div>

          <div className="menu-section">
            <h3>Information</h3>
            <button className="menu-item">
              ℹ️ How It Works
            </button>
            <button className="menu-item">
              💰 Pricing
            </button>
            <button className="menu-item">
              ⭐ Reviews
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="service-content">
          {activeMenuItem === 'providers' && (
            <div className="providers-section">
              <h2>Available {serviceName} Providers</h2>
              <p className="section-description">
                Choose from our verified network of {serviceName} professionals. Click on any provider to view their profile and services.
              </p>

              {/* Price Filter */}
              <div className="price-filter">
                <div className="filter-header">
                  <h3>💰 Filter by Rate</h3>
                  <span className="price-range-display">
                    ${priceRange[0]}/hr - ${priceRange[1]}/hr
                  </span>
                </div>
                <div className="filter-controls">
                  <input
                    type="range"
                    min={minPrice}
                    max={maxPrice}
                    value={priceRange[0]}
                    onChange={(e) => {
                      const newMin = Number(e.target.value);
                      if (newMin <= priceRange[1]) {
                        setPriceRange([newMin, priceRange[1]]);
                      }
                    }}
                    className="slider slider-min"
                  />
                  <input
                    type="range"
                    min={minPrice}
                    max={maxPrice}
                    value={priceRange[1]}
                    onChange={(e) => {
                      const newMax = Number(e.target.value);
                      if (newMax >= priceRange[0]) {
                        setPriceRange([priceRange[0], newMax]);
                      }
                    }}
                    className="slider slider-max"
                  />
                </div>
                <div className="price-labels">
                  <span>Lowest: ${minPrice}/hr</span>
                  <span>Highest: ${maxPrice}/hr</span>
                </div>
              </div>

              {/* Additional Filters */}
              <div className="additional-filters">
                {/* Rating Filter */}
                <div className="filter-group">
                  <label htmlFor="rating-filter">Minimum Rating: ⭐ {minRating.toFixed(1)}</label>
                  <input
                    id="rating-filter"
                    type="range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={minRating}
                    onChange={(e) => setMinRating(Number(e.target.value))}
                    className="slider-input"
                  />
                </div>

                {/* Experience Filter */}
                <div className="filter-group">
                  <label htmlFor="experience-filter">Minimum Experience: {minExperience} years</label>
                  <input
                    id="experience-filter"
                    type="range"
                    min="0"
                    max="30"
                    step="1"
                    value={minExperience}
                    onChange={(e) => setMinExperience(Number(e.target.value))}
                    className="slider-input"
                  />
                </div>

                {/* Availability Filter */}
                <div className="filter-group">
                  <label htmlFor="availability-filter">Availability</label>
                  <select
                    id="availability-filter"
                    value={selectedAvailability}
                    onChange={(e) => setSelectedAvailability(e.target.value)}
                    className="select-filter"
                  >
                    <option value="all">All Providers</option>
                    <option value="available">🟢 Available</option>
                    <option value="busy">🟡 Busy</option>
                    <option value="unavailable">🔴 Unavailable</option>
                  </select>
                </div>

                {/* Reset Filters Button */}
                <button
                  className="btn-reset-filters"
                  onClick={() => {
                    setPriceRange([minPrice, maxPrice]);
                    setMinRating(0);
                    setMinExperience(0);
                    setSelectedAvailability('all');
                  }}
                >
                  Reset All Filters
                </button>
              </div>

              <div className="providers-grid">
                {filteredProviders.length > 0 ? (
                  filteredProviders.map((provider) => (
                  <div key={provider.id} className="provider-card">
                    <div className="provider-header">
                      <div className="provider-avatar">{provider.avatar}</div>
                      <div className="provider-name-section">
                        <h3>{provider.name}</h3>
                        <p className="provider-title">{provider.title}</p>
                        {provider.verified && (
                          <span className="verified-badge">✓ Verified</span>
                        )}
                      </div>
                      <div className={`availability-badge ${provider.availability}`}>
                        {provider.availability === 'available' && '🟢 Available'}
                        {provider.availability === 'busy' && '🟡 Busy'}
                        {provider.availability === 'unavailable' && '🔴 Unavailable'}
                      </div>
                    </div>

                    <div className="provider-rating">
                      <span className="stars">⭐ {provider.rating}</span>
                      <span className="reviews">({provider.reviews} reviews)</span>
                    </div>

                    <div className="provider-details">
                      <p>
                        <strong>Experience:</strong> {provider.yearsExperience} years
                      </p>
                      {provider.hourlyRate && (
                        <p>
                          <strong>Rate:</strong> ${provider.hourlyRate}/hr
                        </p>
                      )}
                      <p>
                        <strong>Specialties:</strong> {provider.specialties.join(', ')}
                      </p>
                    </div>

                    <div className="provider-firm">
                      <p className="firm-label">Works at:</p>
                      <div className="firm-info">
                        <a href="#" className="firm-link">
                          {provider.firmName}
                        </a>
                        <a
                          href={provider.firmWebsite}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="website-link"
                          title="Visit firm website"
                        >
                          🌐
                        </a>
                      </div>
                    </div>

                    <div className="provider-actions">
                      <button
                        className="btn-primary"
                        onClick={() => handleViewProfile(provider)}
                      >
                        View Profile
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => handleStartIntake(provider)}
                      >
                        Start Request
                      </button>
                    </div>
                  </div>
                  ))
                ) : (
                  <div className="no-results">
                    <p>No providers found in the ${priceRange[0]} - ${priceRange[1]}/hr range.</p>
                    <p>Try adjusting the price filter to see more options.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeMenuItem === 'form' && (
            <div className="form-section">
              <h2>📝 Start Intake Form</h2>
              <p className="section-description">
                Tell us about your {serviceName.toLowerCase()} needs. We'll match you with the best provider.
              </p>
              <div className="form-placeholder">
                <p>Service-specific intake form will appear here</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
