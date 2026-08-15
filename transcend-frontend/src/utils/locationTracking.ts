/**
 * GPS Location Tracking Utility
 * Tracks user location for all activities (credibility + security)
 */

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  timestamp: string;
  city?: string;
  country?: string;
  region?: string;
}

export interface ActivityLog {
  id: string;
  activity_type: 'feature_request' | 'deployment' | 'status_check' | 'login' | 'approval';
  activity_description: string;
  user_id?: string;
  location: GeoLocation;
  device_info: {
    user_agent: string;
    device_type: 'mobile' | 'tablet' | 'desktop';
    browser: string;
    os: string;
  };
  timestamp: string;
  ip_address?: string;
}

// Get GPS coordinates
export async function getGeoLocation(): Promise<GeoLocation | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not available');
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy, altitude } = position.coords;
        const timestamp = new Date().toISOString();

        // Get city/country from coordinates (reverse geocoding)
        const { city, country, region } = await reverseGeocode(latitude, longitude);

        resolve({
          latitude,
          longitude,
          accuracy,
          altitude,
          timestamp,
          city,
          country,
          region,
        });
      },
      (error) => {
        console.warn('Geolocation error:', error.message);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );
  });
}

// Reverse geocoding: convert coordinates to city/country
async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<{ city?: string; country?: string; region?: string }> {
  try {
    // Using OpenStreetMap Nominatim API (free, no auth required)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
      {
        headers: {
          'User-Agent': 'Transcend-Law-Platform',
        },
      }
    );

    if (!response.ok) {
      return {};
    }

    const data = await response.json();
    const address = data.address || {};

    return {
      city: address.city || address.town || address.village,
      country: address.country,
      region: address.state || address.province,
    };
  } catch (error) {
    console.warn('Reverse geocoding failed:', error);
    return {};
  }
}

// Get device info
export function getDeviceInfo(): ActivityLog['device_info'] {
  const userAgent = navigator.userAgent;

  // Detect device type
  let device_type: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  if (/mobile|android/i.test(userAgent)) {
    device_type = 'mobile';
  } else if (/tablet|ipad/i.test(userAgent)) {
    device_type = 'tablet';
  }

  // Detect browser
  let browser = 'Unknown';
  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Edge')) browser = 'Edge';

  // Detect OS
  let os = 'Unknown';
  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';

  return {
    user_agent: userAgent,
    device_type,
    browser,
    os,
  };
}

// Get IP address (via IP detection API)
export async function getIpAddress(): Promise<string | undefined> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    if (response.ok) {
      const data = await response.json();
      return data.ip;
    }
  } catch (error) {
    console.warn('IP detection failed:', error);
  }
  return undefined;
}

// Log activity with location
export async function logActivity(
  activityType: ActivityLog['activity_type'],
  activityDescription: string,
  userId?: string
): Promise<ActivityLog | null> {
  try {
    const [location, ipAddress] = await Promise.all([
      getGeoLocation(),
      getIpAddress(),
    ]);

    if (!location) {
      console.warn('Cannot log activity without location');
      return null;
    }

    const activityLog: ActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      activity_type: activityType,
      activity_description: activityDescription,
      user_id: userId,
      location,
      device_info: getDeviceInfo(),
      timestamp: new Date().toISOString(),
      ip_address: ipAddress,
    };

    // Send to backend for storage
    await fetch('/api/admin/activity-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activityLog),
    });

    return activityLog;
  } catch (error) {
    console.error('Activity logging failed:', error);
    return null;
  }
}

// Format location for display
export function formatLocation(location: GeoLocation): string {
  const parts = [];
  if (location.city) parts.push(location.city);
  if (location.region) parts.push(location.region);
  if (location.country) parts.push(location.country);

  if (parts.length === 0) {
    return `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
  }

  return parts.join(', ');
}

// Get coordinates map URL (for display in admin panel)
export function getMapUrl(location: GeoLocation): string {
  return `https://www.openstreetmap.org/?zoom=12&lat=${location.latitude}&lon=${location.longitude}`;
}

// Credibility score based on location consistency
export function getCredibilityScore(activities: ActivityLog[]): number {
  if (activities.length === 0) return 0;

  // Check if all activities from same general location
  const locations = activities.map(a => ({
    lat: a.location.latitude,
    lon: a.location.longitude,
  }));

  // Calculate average distance between locations
  let totalDistance = 0;
  for (let i = 0; i < locations.length - 1; i++) {
    const dist = calculateDistance(
      locations[i].lat,
      locations[i].lon,
      locations[i + 1].lat,
      locations[i + 1].lon
    );
    totalDistance += dist;
  }

  const avgDistance = totalDistance / (locations.length - 1);

  // Score based on consistency
  // < 1km = high credibility (100)
  // < 10km = medium-high (75)
  // < 50km = medium (50)
  // > 50km = low (25)
  if (avgDistance < 1) return 100;
  if (avgDistance < 10) return 75;
  if (avgDistance < 50) return 50;
  return 25;
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Request location permission
export async function requestLocationPermission(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      { enableHighAccuracy: true, timeout: 5000 }
    );
  });
}
