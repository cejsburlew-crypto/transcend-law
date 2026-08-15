// ServiceMarketplace Component
// Browse and filter legal services by persona, location, and ratings

import React, { useState, useEffect } from 'react';
import './ServiceMarketplace.css';

interface Service {
  id: number;
  service_key: string;
  service_name: string;
  icon: string;
  tool_count: number;
  priority_rank?: number;
}

interface MarketplaceService extends Service {
  provider_count?: number;
  avg_rating?: number;
  review_count?: number;
  description?: string;
}

interface ServiceMarketplaceProps {
  personaId: number;
  personaName: string;
  onSelectService?: (service: MarketplaceService) => void;
  showProviderCounts?: boolean;
  className?: string;
}

type SortBy = 'popularity' | 'rating' | 'name' | 'providers';
type ViewMode = 'grid' | 'list';

export const ServiceMarketplace: React.FC<ServiceMarketplaceProps> = ({
  personaId,
  personaName,
  onSelectService,
  showProviderCounts = true,
  className = '',
}) => {
  const [services, setServices] = useState<MarketplaceService[]>([]);
  const [filteredServices, setFilteredServices] = useState<MarketplaceService[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('popularity');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [minRating, setMinRating] = useState(0);
  const [selectedState, setSelectedState] = useState('');

  useEffect(() => {
    fetchServices();
  }, [personaId]);

  useEffect(() => {
    applyFilters();
  }, [services, searchQuery, sortBy, minRating, selectedState]);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v2/personas/${personaId}/marketplace`);
      const data = await response.json();

      if (data.success) {
        setServices(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch services:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...services];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((s) =>
        s.service_name.toLowerCase().includes(query) ||
        s.service_key.toLowerCase().includes(query)
      );
    }

    // Rating filter
    if (minRating > 0) {
      result = result.filter((s) => (s.avg_rating || 0) >= minRating);
    }

    // Sort
    switch (sortBy) {
      case 'popularity':
        result.sort((a, b) => (a.priority_rank || 999) - (b.priority_rank || 999));
        break;
      case 'rating':
        result.sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0));
        break;
      case 'name':
        result.sort((a, b) => a.service_name.localeCompare(b.service_name));
        break;
      case 'providers':
        result.sort((a, b) => (b.provider_count || 0) - (a.provider_count || 0));
        break;
    }

    setFilteredServices(result);
  };

  const handleServiceClick = (service: MarketplaceService) => {
    onSelectService?.(service);
  };

  if (loading) {
    return (
      <div className={`service-marketplace ${className}`}>
        <div className="marketplace-loading">Loading services...</div>
      </div>
    );
  }

  return (
    <div className={`service-marketplace ${className}`}>
      {/* Header */}
      <div className="marketplace-header">
        <div className="marketplace-title-section">
          <h2 className="marketplace-title">Legal Services for {personaName}</h2>
          <p className="marketplace-subtitle">
            Browse and select {filteredServices.length} available services
          </p>
        </div>
      </div>

      {/* Filters & Controls */}
      <div className="marketplace-controls">
        {/* Search */}
        <div className="control-group search-group">
          <input
            type="text"
            className="search-input"
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="search-icon">🔍</span>
        </div>

        {/* Sort */}
        <div className="control-group">
          <label className="control-label">Sort by:</label>
          <select
            className="control-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
          >
            <option value="popularity">Popularity</option>
            <option value="rating">Highest Rated</option>
            <option value="providers">Most Providers</option>
            <option value="name">A-Z</option>
          </select>
        </div>

        {/* Minimum Rating */}
        <div className="control-group">
          <label className="control-label">Minimum Rating:</label>
          <select
            className="control-select"
            value={minRating}
            onChange={(e) => setMinRating(parseFloat(e.target.value))}
          >
            <option value="0">Any</option>
            <option value="3">3+ ⭐</option>
            <option value="4">4+ ⭐</option>
            <option value="4.5">4.5+ ⭐</option>
          </select>
        </div>

        {/* View Mode */}
        <div className="control-group view-mode-group">
          <button
            className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grid view"
          >
            ⊞
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="List view"
          >
            ≡
          </button>
        </div>
      </div>

      {/* Results */}
      {filteredServices.length === 0 ? (
        <div className="marketplace-empty">
          <p>No services match your filters.</p>
          <button className="reset-btn" onClick={() => setSearchQuery('')}>
            Clear Search
          </button>
        </div>
      ) : (
        <div className={`services-container view-${viewMode}`}>
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className="service-card"
              onClick={() => handleServiceClick(service)}
            >
              {/* Card Icon */}
              <div className="card-icon">{service.icon}</div>

              {/* Card Content */}
              <div className="card-content">
                <h3 className="card-title">{service.service_name}</h3>

                {/* Rating */}
                {service.avg_rating && (
                  <div className="card-rating">
                    <span className="stars">
                      {'★'.repeat(Math.floor(service.avg_rating))}
                      {service.avg_rating % 1 !== 0 && '½'}
                    </span>
                    <span className="rating-value">
                      {service.avg_rating.toFixed(1)} ({service.review_count || 0} reviews)
                    </span>
                  </div>
                )}

                {/* Provider Count */}
                {showProviderCounts && service.provider_count !== undefined && (
                  <div className="card-providers">
                    <span className="provider-count">
                      {service.provider_count} provider{service.provider_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}

                {/* Tools Count */}
                <div className="card-tools">
                  <span className="tools-badge">{service.tool_count} tools</span>
                </div>
              </div>

              {/* Card Action */}
              <button className="card-action" title="Select this service">
                →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="marketplace-footer">
        <p className="footer-text">
          Showing {filteredServices.length} of {services.length} services
        </p>
      </div>
    </div>
  );
};

export default ServiceMarketplace;
