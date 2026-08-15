import React, { useState, useEffect } from 'react';
import { getCredibilityScore, formatLocation, getMapUrl } from '@/utils/locationTracking';
import './LocationCredibility.css';

interface LocationCredibilityProps {
  userId: string;
  activities?: any[];
  onLocationPermissionChange?: (enabled: boolean) => void;
}

export default function LocationCredibility({
  userId,
  activities = [],
  onLocationPermissionChange,
}: LocationCredibilityProps) {
  const [gpsEnabled, setGpsEnabled] = useState<boolean>(() => {
    return localStorage.getItem(`gps-enabled-${userId}`) !== 'false';
  });

  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [credibilityScore, setCredibilityScore] = useState<number>(0);
  const [credibilityLevel, setCredibilityLevel] = useState<'high' | 'medium' | 'low'>('high');
  const [lastLocation, setLastLocation] = useState<any>(null);

  // Check GPS permission on mount
  useEffect(() => {
    checkGPSPermission();
    if (activities.length > 0) {
      updateCredibilityScore();
    }
  }, []);

  // Update credibility when activities change
  useEffect(() => {
    if (activities.length > 0) {
      updateCredibilityScore();
    }
  }, [activities]);

  const checkGPSPermission = async () => {
    if (!navigator.permissions || !navigator.permissions.query) {
      setHasPermission(true);
      return;
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      setHasPermission(result.state === 'granted');
    } catch (error) {
      console.warn('Cannot check GPS permission:', error);
    }
  };

  const handleGPSToggle = async (enabled: boolean) => {
    if (enabled) {
      // Request GPS permission
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setGpsEnabled(true);
            localStorage.setItem(`gps-enabled-${userId}`, 'true');
            setHasPermission(true);
            setLastLocation(position.coords);
            onLocationPermissionChange?.(true);
          },
          (error) => {
            console.warn('GPS permission denied:', error);
            setHasPermission(false);
            onLocationPermissionChange?.(false);
          }
        );
      }
    } else {
      setGpsEnabled(false);
      localStorage.setItem(`gps-enabled-${userId}`, 'false');
      onLocationPermissionChange?.(false);
    }
  };

  const updateCredibilityScore = () => {
    if (activities.length === 0 || !gpsEnabled) {
      setCredibilityScore(0);
      setCredibilityLevel('low');
      return;
    }

    const score = getCredibilityScore(activities);
    setCredibilityScore(score);

    if (score >= 80) {
      setCredibilityLevel('high');
    } else if (score >= 50) {
      setCredibilityLevel('medium');
    } else {
      setCredibilityLevel('low');
    }
  };

  const getCredibilityIcon = () => {
    if (!gpsEnabled) return '❌';
    if (credibilityLevel === 'high') return '✅';
    if (credibilityLevel === 'medium') return '⚠️';
    return '❌';
  };

  const getCredibilityColor = () => {
    if (!gpsEnabled) return '#95a5a6';
    if (credibilityLevel === 'high') return '#27ae60';
    if (credibilityLevel === 'medium') return '#f39c12';
    return '#e74c3c';
  };

  const getCredibilityText = () => {
    if (!gpsEnabled) return 'GPS Disabled - No Location Data';
    if (credibilityLevel === 'high') return 'High Credibility - Consistent Location';
    if (credibilityLevel === 'medium') return 'Medium Credibility - Some Location Variation';
    return 'Low Credibility - High Location Variation';
  };

  return (
    <div className="location-credibility">
      <div className="credibility-header">
        <h3>📍 Location Credibility</h3>
        <div className="credibility-badge">
          <span
            className="credibility-icon"
            style={{ color: getCredibilityColor() }}
          >
            {getCredibilityIcon()}
          </span>
          <span
            className="credibility-text"
            style={{ color: getCredibilityColor() }}
          >
            {getCredibilityText()}
          </span>
        </div>
      </div>

      {/* GPS Toggle */}
      <div className="gps-toggle-section">
        <div className="toggle-control">
          <label htmlFor="gps-toggle" className="toggle-label">
            Enable GPS Location Tracking
          </label>
          <button
            id="gps-toggle"
            className={`toggle-switch ${gpsEnabled ? 'active' : ''}`}
            onClick={() => handleGPSToggle(!gpsEnabled)}
            aria-pressed={gpsEnabled}
          >
            <span className="toggle-indicator" />
          </button>
        </div>

        {!hasPermission && gpsEnabled && (
          <div className="permission-warning">
            <p>
              ℹ️ GPS permission not granted. Click the toggle to request permission.
            </p>
          </div>
        )}

        {gpsEnabled && (
          <p className="gps-info">
            ✅ GPS tracking enabled - Your location will be recorded with all activities
          </p>
        )}

        {!gpsEnabled && (
          <p className="gps-info disabled">
            ℹ️ GPS tracking disabled - Activities will not include location data
          </p>
        )}
      </div>

      {/* Credibility Score */}
      {gpsEnabled && activities.length > 0 && (
        <div className="credibility-details">
          <div className="score-container">
            <div className="score-bar">
              <div
                className="score-fill"
                style={{
                  width: `${credibilityScore}%`,
                  backgroundColor: getCredibilityColor(),
                }}
              />
            </div>
            <div className="score-number">{credibilityScore}/100</div>
          </div>

          <div className="credibility-breakdown">
            <p>
              <strong>Activity Count:</strong> {activities.length}
            </p>
            <p>
              <strong>GPS Status:</strong> {gpsEnabled ? 'Enabled ✅' : 'Disabled ❌'}
            </p>

            {lastLocation && (
              <>
                <p>
                  <strong>Last Location:</strong>
                  <br />
                  <span className="location-coords">
                    {formatLocation(lastLocation)}
                  </span>
                  <br />
                  <a
                    href={getMapUrl(lastLocation)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="map-link"
                  >
                    View on Map →
                  </a>
                </p>
                <p>
                  <strong>Accuracy:</strong> ±{lastLocation.accuracy?.toFixed(0)}m
                </p>
              </>
            )}
          </div>

          {credibilityLevel === 'high' && (
            <div className="credibility-message success">
              ✅ High credibility: Activities are from a consistent location, building trust.
            </div>
          )}

          {credibilityLevel === 'medium' && (
            <div className="credibility-message warning">
              ⚠️ Medium credibility: Some location variation detected. Multiple locations
              may reduce perceived reliability.
            </div>
          )}

          {credibilityLevel === 'low' && (
            <div className="credibility-message error">
              ❌ Low credibility: High location variation detected. This may indicate
              multiple actors or suspicious activity.
            </div>
          )}
        </div>
      )}

      {!gpsEnabled && activities.length > 0 && (
        <div className="no-location-data">
          <p>📵 Location tracking is disabled</p>
          <p>Enable GPS above to build credibility through consistent location tracking</p>
          <button
            className="enable-gps-button"
            onClick={() => handleGPSToggle(true)}
          >
            Enable GPS Now
          </button>
        </div>
      )}

      {activities.length === 0 && (
        <div className="no-activities">
          <p>No activities recorded yet</p>
          <p>Credibility score will appear after your first deployment request</p>
        </div>
      )}
    </div>
  );
}
