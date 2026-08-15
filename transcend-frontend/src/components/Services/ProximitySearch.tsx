import React, { useState, useEffect } from 'react';
import './ProximitySearch.css';

interface ServiceProvider {
  id: string;
  name: string;
  service: string;
  distance: number;
  rating: number;
  availability: string;
  phone?: string;
  address: string;
  image?: string;
}

interface LocationData {
  address: string;
  lat: number;
  lng: number;
}

export default function ProximitySearch() {
  const [searchMethod, setSearchMethod] = useState<'address' | 'gps'>('address');
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState<LocationData | null>(null);
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [radius, setRadius] = useState(10); // km
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'availability'>('distance');
  const [gpsLoading, setGpsLoading] = useState(false);

  const handleAddressSearch = async () => {
    if (!address.trim()) {
      setError('Please enter an address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Geocode address to coordinates
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          address
        )}`
      );

      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          const loc = {
            address: data[0].display_name,
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
          };
          setLocation(loc);
          await searchNearbyProviders(loc);
        } else {
          setError('Address not found. Please try again.');
        }
      }
    } catch (err) {
      setError('Failed to search address. Please try again.');
      console.error('Address search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGPSSearch = async () => {
    setGpsLoading(true);
    setError('');

    try {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const loc: LocationData = {
              address: `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(
                4
              )}`,
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            };
            setLocation(loc);
            await searchNearbyProviders(loc);
            setGpsLoading(false);
          },
          (err) => {
            setError('Unable to access GPS. Please enable location services.');
            setGpsLoading(false);
            console.error('GPS error:', err);
          }
        );
      } else {
        setError('Geolocation not supported by this browser');
        setGpsLoading(false);
      }
    } catch (err) {
      setError('Failed to get GPS location');
      setGpsLoading(false);
      console.error('GPS error:', err);
    }
  };

  const searchNearbyProviders = async (loc: LocationData) => {
    try {
      const response = await fetch(
        `/api/services/proximity-search?lat=${loc.lat}&lng=${loc.lng}&radius=${radius}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          },
        }
      );

      if (response.ok) {
        let data = await response.json();

        // Sort results
        switch (sortBy) {
          case 'distance':
            data.sort((a: ServiceProvider, b: ServiceProvider) => a.distance - b.distance);
            break;
          case 'rating':
            data.sort((a: ServiceProvider, b: ServiceProvider) => b.rating - a.rating);
            break;
          case 'availability':
            data.sort(
              (a: ServiceProvider, b: ServiceProvider) =>
                (b.availability === 'Available' ? 1 : 0) -
                (a.availability === 'Available' ? 1 : 0)
            );
            break;
        }

        setProviders(data);
      }
    } catch (err) {
      setError('Failed to search nearby providers');
      console.error('Proximity search error:', err);
    }
  };

  const handleRadiusChange = async (newRadius: number) => {
    setRadius(newRadius);
    if (location) {
      setLoading(true);
      await searchNearbyProviders(location);
      setLoading(false);
    }
  };

  const handleSort = async (newSort: 'distance' | 'rating' | 'availability') => {
    setSortBy(newSort);
    if (location) {
      await searchNearbyProviders(location);
    }
  };

  return (
    <div className="proximity-search-container">
      <div className="search-header">
        <h1>🗺️ Find Services Near You</h1>
        <p>Search for legal services by location</p>
      </div>

      <div className="search-methods">
        <div className="method-selector">
          <button
            className={`method-btn ${searchMethod === 'address' ? 'active' : ''}`}
            onClick={() => setSearchMethod('address')}
          >
            🏠 By Address
          </button>
          <button
            className={`method-btn ${searchMethod === 'gps' ? 'active' : ''}`}
            onClick={() => setSearchMethod('gps')}
          >
            📍 My Location (GPS)
          </button>
        </div>

        <div className="search-input-area">
          {searchMethod === 'address' ? (
            <div className="address-search">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddressSearch()}
                placeholder="Enter address, city, or zip code..."
                className="address-input"
              />
              <button
                onClick={handleAddressSearch}
                disabled={loading || !address.trim()}
                className="search-btn"
              >
                {loading ? '⏳ Searching...' : '🔍 Search'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleGPSSearch}
              disabled={gpsLoading}
              className="gps-btn"
            >
              {gpsLoading ? '⏳ Getting Location...' : '📍 Use My GPS Location'}
            </button>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        {location && (
          <div className="location-info">
            <span className="location-icon">📍</span>
            <span className="location-text">Searching near: {location.address}</span>
          </div>
        )}
      </div>

      {location && (
        <div className="filters-bar">
          <div className="radius-control">
            <label>Radius: {radius} km</label>
            <input
              type="range"
              min="1"
              max="50"
              value={radius}
              onChange={(e) => handleRadiusChange(parseInt(e.target.value))}
              className="radius-slider"
            />
          </div>

          <div className="sort-control">
            <label>Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => handleSort(e.target.value as any)}
              className="sort-select"
            >
              <option value="distance">Closest First</option>
              <option value="rating">Highest Rated</option>
              <option value="availability">Available Now</option>
            </select>
          </div>
        </div>
      )}

      <div className="results-section">
        {providers.length > 0 ? (
          <div className="providers-grid">
            {providers.map((provider) => (
              <div key={provider.id} className="provider-card">
                {provider.image && (
                  <img src={provider.image} alt={provider.name} className="provider-image" />
                )}

                <div className="provider-info">
                  <h3>{provider.name}</h3>
                  <p className="service-type">{provider.service}</p>

                  <div className="provider-details">
                    <span className="distance">
                      📍 {provider.distance.toFixed(1)} km away
                    </span>
                    <span className="rating">
                      ⭐ {provider.rating.toFixed(1)} ({provider.rating > 4 ? 'Excellent' : provider.rating > 3 ? 'Good' : 'Fair'})
                    </span>
                  </div>

                  <p className="address">{provider.address}</p>

                  <div className="availability-badge">
                    {provider.availability === 'Available' ? (
                      <span className="available">🟢 Available Now</span>
                    ) : (
                      <span className="unavailable">🔴 {provider.availability}</span>
                    )}
                  </div>

                  <div className="action-buttons">
                    <button className="contact-btn">📞 Contact</button>
                    <button className="details-btn">ℹ️ Details</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : location && !loading ? (
          <div className="no-results">
            <p>🔍 No providers found within {radius} km</p>
            <p className="hint">Try increasing the search radius or changing your location</p>
          </div>
        ) : null}

        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            <p>Finding nearby providers...</p>
          </div>
        )}
      </div>
    </div>
  );
}
