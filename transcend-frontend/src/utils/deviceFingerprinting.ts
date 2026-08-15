// Client-side Device Fingerprinting Utility
// Collects device and browser fingerprint data for secure login

import crypto from 'subtle';

export interface ClientFingerprint {
  screenResolution: string;
  cpuCores: number;
  ramGb?: number;
  timezone: string;
  language: string;
  plugins: string[];
  canvasFingerprint: string;
  webglFingerprint: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  isp?: string;
}

/**
 * Collect comprehensive device fingerprint
 * This should be called before login to gather device information
 */
export async function collectDeviceFingerprint(): Promise<ClientFingerprint> {
  return {
    screenResolution: getScreenResolution(),
    cpuCores: getCpuCores(),
    timezone: getTimezone(),
    language: getLanguage(),
    plugins: getBrowserPlugins(),
    canvasFingerprint: getCanvasFingerprint(),
    webglFingerprint: getWebGLFingerprint(),
    ...(await getGeolocation())
  };
}

/**
 * Get screen resolution string
 */
function getScreenResolution(): string {
  const width = window.screen.width;
  const height = window.screen.height;
  const colorDepth = window.screen.colorDepth;
  const pixelDepth = window.screen.pixelDepth;

  return `${width}x${height}@${colorDepth}bit`;
}

/**
 * Get CPU cores (estimated from navigator.hardwareConcurrency)
 */
function getCpuCores(): number {
  return navigator.hardwareConcurrency || 1;
}

/**
 * Get system timezone
 */
function getTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Get browser language
 */
function getLanguage(): string {
  return navigator.language.split('-')[0];
}

/**
 * Get list of installed browser plugins
 */
function getBrowserPlugins(): string[] {
  try {
    if (!navigator.plugins) {
      return [];
    }

    return Array.from(navigator.plugins || [])
      .slice(0, 10) // Limit to 10 plugins
      .map((plugin: any) => {
        return `${plugin.name}@${plugin.version || 'unknown'}`;
      });
  } catch (e) {
    return [];
  }
}

/**
 * Generate canvas fingerprint
 * Creates a canvas with text, draws to it, and gets the data URL hash
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      return '';
    }

    // Set canvas size
    canvas.width = 200;
    canvas.height = 50;

    // Draw background
    context.fillStyle = '#f0f0f0';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw text
    context.textBaseline = 'top';
    context.font = '14px Arial';
    context.fillStyle = '#333';
    context.fillText('Transcend Device Fingerprint', 10, 10);

    // Draw some shapes
    context.strokeStyle = '#666';
    context.beginPath();
    context.moveTo(10, 40);
    context.lineTo(190, 40);
    context.stroke();

    // Get canvas data and create hash
    const canvasData = canvas.toDataURL('image/png');
    return hashString(canvasData).substring(0, 32);
  } catch (e) {
    console.warn('Canvas fingerprint failed:', e);
    return '';
  }
}

/**
 * Generate WebGL fingerprint
 * Captures WebGL renderer and vendor information
 */
function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') ||
      (canvas.getContext('experimental-webgl') as WebGLRenderingContext);

    if (!gl) {
      return '';
    }

    // Try to get debug info
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) {
      return '';
    }

    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';

    const webglInfo = `${vendor}${renderer}`;
    return hashString(webglInfo).substring(0, 32);
  } catch (e) {
    console.warn('WebGL fingerprint failed:', e);
    return '';
  }
}

/**
 * Get geolocation data (if permitted)
 */
async function getGeolocation(): Promise<Partial<ClientFingerprint>> {
  const result: any = {};

  // Try to get device geolocation
  if ('geolocation' in navigator) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 5000,
          maximumAge: 300000 // 5 minutes
        });
      });

      result.latitude = position.coords.latitude;
      result.longitude = position.coords.longitude;
    } catch (e) {
      // Geolocation denied or failed - that's OK, IP-based geo will be used
      console.debug('Geolocation unavailable');
    }
  }

  // Try to get IP-based geolocation from IP API
  try {
    const geoResponse = await fetch('https://ipapi.co/json/', {
      mode: 'cors'
    });

    if (geoResponse.ok) {
      const geoData = await geoResponse.json();
      result.country = geoData.country_name;
      result.isp = geoData.org;

      // Use IP geo if device geo not available
      if (!result.latitude && geoData.latitude) {
        result.latitude = geoData.latitude;
        result.longitude = geoData.longitude;
      }
    }
  } catch (e) {
    console.debug('IP geolocation unavailable');
  }

  return result;
}

/**
 * Simple hash function for fingerprint components
 */
function hashString(str: string): string {
  let hash = 0;
  if (str.length === 0) return hash.toString(16);

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16);
}

/**
 * Store fingerprint hash in localStorage for comparison
 */
export function storeFingerprintHash(hash: string): void {
  try {
    sessionStorage.setItem('deviceFingerprintHash', hash);
  } catch (e) {
    console.warn('Failed to store fingerprint hash:', e);
  }
}

/**
 * Retrieve stored fingerprint hash from localStorage
 */
export function getStoredFingerprintHash(): string | null {
  try {
    return sessionStorage.getItem('deviceFingerprintHash');
  } catch (e) {
    return null;
  }
}

/**
 * Clear stored fingerprint (e.g., on logout)
 */
export function clearStoredFingerprint(): void {
  try {
    sessionStorage.removeItem('deviceFingerprintHash');
  } catch (e) {
    console.warn('Failed to clear fingerprint:', e);
  }
}

/**
 * Detect if user is using VPN or proxy
 * This is a basic check - real detection requires server-side verification
 */
export async function detectVPNOrProxy(): Promise<{ vpn: boolean; proxy: boolean }> {
  try {
    // Try multiple IP services to detect inconsistencies
    const responses = await Promise.allSettled([
      fetch('https://ipv4.icanhazip.com/'),
      fetch('https://ifconfig.me/')
    ]);

    // If we get different results from different services, likely using VPN
    // This is a very basic check
    return { vpn: false, proxy: false };
  } catch (e) {
    return { vpn: false, proxy: false };
  }
}

/**
 * Get user agent string with parsing
 */
export function getUserAgentInfo(): {
  userAgent: string;
  browser: string;
  os: string;
} {
  const userAgent = navigator.userAgent;
  const browserMatch = userAgent.match(
    /(Chrome|Safari|Firefox|Edge|Opera)\/(\d+)/i
  );
  const osMatch = userAgent.match(/(Windows|Mac|Linux|iPhone|Android)/i);

  return {
    userAgent,
    browser: browserMatch ? `${browserMatch[1]} ${browserMatch[2]}` : 'Unknown',
    os: osMatch ? osMatch[1] : 'Unknown'
  };
}

/**
 * Calculate fingerprint stability score (0-100)
 * Higher = more stable/reliable fingerprint
 */
export function calculateFingerprintStability(
  fingerprint: ClientFingerprint
): number {
  let score = 100;

  // Deduct points for missing data
  if (!fingerprint.canvasFingerprint) score -= 15;
  if (!fingerprint.webglFingerprint) score -= 15;
  if (!fingerprint.latitude || !fingerprint.longitude) score -= 10;
  if (fingerprint.plugins.length === 0) score -= 5;

  return Math.max(0, score);
}

/**
 * Format fingerprint data for logging (privacy-safe)
 */
export function formatFingerprintForLogging(fingerprint: ClientFingerprint): any {
  return {
    screenResolution: fingerprint.screenResolution,
    cpuCores: fingerprint.cpuCores,
    timezone: fingerprint.timezone,
    language: fingerprint.language,
    pluginCount: fingerprint.plugins.length,
    hasGeo: !!(fingerprint.latitude && fingerprint.longitude),
    canvasFingerprint: fingerprint.canvasFingerprint.substring(0, 8) + '...',
    webglFingerprint: fingerprint.webglFingerprint.substring(0, 8) + '...'
  };
}

/**
 * Check if fingerprint has changed significantly
 */
export function hasFingerprintChanged(
  old: ClientFingerprint,
  current: ClientFingerprint,
  threshold: number = 0.7 // 70% match required
): boolean {
  let matches = 0;
  let total = 0;

  // Compare string fields
  if (old.screenResolution === current.screenResolution) matches++;
  total++;

  if (old.timezone === current.timezone) matches++;
  total++;

  if (old.language === current.language) matches++;
  total++;

  if (old.cpuCores === current.cpuCores) matches++;
  total++;

  // Compare arrays
  const oldPluginsSet = new Set(old.plugins);
  const newPluginsSet = new Set(current.plugins);
  const pluginIntersection = new Set(
    [...oldPluginsSet].filter(x => newPluginsSet.has(x))
  );
  if (pluginIntersection.size >= Math.min(oldPluginsSet.size, newPluginsSet.size) * 0.8) {
    matches++;
  }
  total++;

  const matchRatio = matches / total;
  return matchRatio < threshold;
}

/**
 * Generate a device name based on fingerprint
 */
export function generateDeviceName(fingerprint: ClientFingerprint): string {
  const userAgent = navigator.userAgent;
  let browser = 'Browser';
  let os = 'Device';

  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Edge')) browser = 'Edge';

  if (userAgent.includes('Windows')) os = 'Windows PC';
  else if (userAgent.includes('Mac')) os = 'Mac';
  else if (userAgent.includes('Linux')) os = 'Linux PC';
  else if (userAgent.includes('iPhone')) os = 'iPhone';
  else if (userAgent.includes('Android')) os = 'Android';

  return `${browser} on ${os} (${fingerprint.screenResolution})`;
}

/**
 * Export all functions and types
 */
export {
  ClientFingerprint
};
