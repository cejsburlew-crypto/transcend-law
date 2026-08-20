// Device Fingerprinting Middleware
// Comprehensive session fingerprinting with device matching, geo-velocity checks, and admin alerts

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import * as db from '../database/connection';

/**
 * Device Fingerprint Interface
 */
export interface DeviceFingerprint {
  userId: string;
  fingerprint: {
    deviceInfo: {
      cpuCores: number;
      ramGb: number;
      screenResolution: string;
      timezone: string;
      language: string;
      platform: string;
      gpu?: string;
    };
    browserInfo: {
      userAgent: string;
      plugins: string[];
      canvas: string;
      webgl: string;
    };
    networkInfo: {
      ipAddress: string;
      country?: string;
      latitude?: number;
      longitude?: number;
      isp?: string;
    };
  };
  fingerprintHash: string;
  timestamp: number;
  isWhitelisted: boolean;
  sessionId: string;
}

/**
 * Extend Express Request to include device fingerprint info
 */
declare global {
  namespace Express {
    interface Request {
      deviceFingerprint?: {
        hash: string;
        isMatched: boolean;
        isWhitelisted: boolean;
        requiresReauth: boolean;
        suspiciousFlag: boolean;
        reason?: string;
      };
      ipAddress?: string;
    }
  }
}

/**
 * Generate secure hash of fingerprint data
 */
function generateFingerprintHash(data: string): string {
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
}

/**
 * Calculate distance between two geographic coordinates (Haversine formula)
 */
function calculateGeoDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

/**
 * Check for impossible travel (geo-velocity check)
 * Human travel max speed: ~900 km/h (flight)
 */
async function checkGeoVelocity(
  userId: string,
  currentLocation: { lat: number; lon: number },
  currentTimestamp: number
): Promise<{ isImpossible: boolean; distance?: number; timeDiffMinutes?: number }> {
  try {
    // Get user's last login location and time
    const result = await db.query(
      `SELECT latitude, longitude, created_at FROM device_fingerprints
       WHERE user_id = $1 AND created_at IS NOT NULL
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // First login, no geo-velocity check needed
      return { isImpossible: false };
    }

    const lastLogin = result.rows[0];
    const lastLat = parseFloat(lastLogin.latitude);
    const lastLon = parseFloat(lastLogin.longitude);
    const lastTime = new Date(lastLogin.created_at).getTime();

    const distance = calculateGeoDistance(
      lastLat,
      lastLon,
      currentLocation.lat,
      currentLocation.lon
    );
    const timeDiffMinutes = (currentTimestamp - lastTime) / (1000 * 60);
    const requiredMinutesForTravel = (distance / 900) * 60; // Minutes needed at max speed

    const isImpossible = timeDiffMinutes < requiredMinutesForTravel && distance > 100;

    return {
      isImpossible,
      distance,
      timeDiffMinutes
    };
  } catch (error) {
    console.error('Error checking geo-velocity:', error);
    return { isImpossible: false };
  }
}

/**
 * Check if device is whitelisted by user
 */
async function isDeviceWhitelisted(
  userId: string,
  fingerprintHash: string
): Promise<boolean> {
  try {
    const result = await db.query(
      `SELECT id FROM device_whitelist
       WHERE user_id = $1 AND fingerprint_hash = $2 AND revoked_at IS NULL`,
      [userId, fingerprintHash]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking device whitelist:', error);
    return false;
  }
}

/**
 * Check if fingerprints match
 */
async function matchFingerprints(
  userId: string,
  currentHash: string
): Promise<{ matches: boolean; previousHash?: string }> {
  try {
    const result = await db.query(
      `SELECT fingerprint_hash FROM device_fingerprints
       WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // First device registration
      return { matches: true };
    }

    const previousHash = result.rows[0].fingerprint_hash;
    return {
      matches: previousHash === currentHash,
      previousHash
    };
  } catch (error) {
    console.error('Error matching fingerprints:', error);
    return { matches: false };
  }
}

/**
 * Log fingerprint mismatch
 */
async function logFingerprintMismatch(
  userId: string,
  ipAddress: string,
  reason: string,
  suspiciousFlags: string[]
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO fingerprint_mismatches
       (user_id, ip_address, reason, suspicious_flags, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [userId, ipAddress, reason, JSON.stringify(suspiciousFlags)]
    );

    // Check for suspicious pattern (3+ mismatches in 1 hour)
    const recentMismatches = await db.query(
      `SELECT COUNT(*) as count FROM fingerprint_mismatches
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [userId]
    );

    if (recentMismatches.rows[0].count >= 3) {
      await alertAdmins(userId, 'SUSPICIOUS_LOGIN_PATTERN', {
        mismatches: recentMismatches.rows[0].count,
        timeWindow: '1 hour',
        lastIp: ipAddress
      });
    }
  } catch (error) {
    console.error('Error logging fingerprint mismatch:', error);
  }
}

/**
 * Alert admins of suspicious activity
 */
async function alertAdmins(
  userId: string,
  alertType: string,
  details: any
): Promise<void> {
  try {
    // Log to admin alerts table
    await db.query(
      `INSERT INTO admin_alerts
       (alert_type, user_id, details, severity, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        alertType,
        userId,
        JSON.stringify(details),
        'HIGH'
      ]
    );

    // In production, also send email/notification to admins
    // await sendAdminNotification(userId, alertType, details);
  } catch (error) {
    console.error('Error creating admin alert:', error);
  }
}

/**
 * Store device fingerprint
 */
async function storeDeviceFingerprint(fingerprint: DeviceFingerprint): Promise<void> {
  try {
    await db.query(
      `INSERT INTO device_fingerprints
       (user_id, device_name, fingerprint_hash, screen_resolution,
        browser_user_agent, ip_address, latitude, longitude,
        timezone, language, platform, cpu_cores, ram_gb,
        is_whitelisted, session_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())`,
      [
        fingerprint.userId,
        `${fingerprint.fingerprint.browserInfo.userAgent.split(' ')[0]}-${fingerprint.fingerprint.deviceInfo.screenResolution}`,
        fingerprint.fingerprintHash,
        fingerprint.fingerprint.deviceInfo.screenResolution,
        fingerprint.fingerprint.browserInfo.userAgent,
        fingerprint.fingerprint.networkInfo.ipAddress,
        fingerprint.fingerprint.networkInfo.latitude || null,
        fingerprint.fingerprint.networkInfo.longitude || null,
        fingerprint.fingerprint.deviceInfo.timezone,
        fingerprint.fingerprint.deviceInfo.language,
        fingerprint.fingerprint.deviceInfo.platform,
        fingerprint.fingerprint.deviceInfo.cpuCores || null,
        fingerprint.fingerprint.deviceInfo.ramGb || null,
        fingerprint.isWhitelisted,
        fingerprint.sessionId
      ]
    );
  } catch (error) {
    console.error('Error storing device fingerprint:', error);
  }
}

/**
 * Whitelist a device for a user
 */
export async function whitelistDevice(
  userId: string,
  fingerprintHash: string,
  deviceName: string
): Promise<boolean> {
  try {
    await db.query(
      `INSERT INTO device_whitelist
       (user_id, fingerprint_hash, device_name, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [userId, fingerprintHash, deviceName]
    );
    return true;
  } catch (error) {
    console.error('Error whitelisting device:', error);
    return false;
  }
}

/**
 * Revoke device from whitelist
 */
export async function revokeDevice(
  userId: string,
  fingerprintHash: string
): Promise<boolean> {
  try {
    await db.query(
      `UPDATE device_whitelist
       SET revoked_at = NOW()
       WHERE user_id = $1 AND fingerprint_hash = $2`,
      [userId, fingerprintHash]
    );
    return true;
  } catch (error) {
    console.error('Error revoking device:', error);
    return false;
  }
}

/**
 * Extract client IP address from request
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Parse device information from request headers and body
 */
function parseDeviceInfo(req: Request): DeviceFingerprint {
  const ipAddress = getClientIp(req);
  const userAgent = req.headers['user-agent'] || '';
  const acceptLanguage = req.headers['accept-language'] || 'en';
  const timezone = (req.body?.timezone) || 'UTC';

  // Extract language from accept-language header
  const language = acceptLanguage.split(',')[0].split('-')[0];

  // Parse user agent for platform
  let platform = 'Unknown';
  if (userAgent.includes('Windows')) platform = 'Windows';
  else if (userAgent.includes('Mac')) platform = 'macOS';
  else if (userAgent.includes('Linux')) platform = 'Linux';
  else if (userAgent.includes('iPhone')) platform = 'iOS';
  else if (userAgent.includes('Android')) platform = 'Android';

  // Generate fingerprint hash from concatenated data
  const fingerprintData = JSON.stringify({
    screenResolution: req.body?.screenResolution || 'unknown',
    userAgent: userAgent,
    timezone: timezone,
    language: language,
    platform: platform,
    cpuCores: req.body?.cpuCores || 0,
    ramGb: req.body?.ramGb || 0,
    canvasFingerprint: req.body?.canvasFingerprint || '',
    webglFingerprint: req.body?.webglFingerprint || ''
  });

  const fingerprintHash = generateFingerprintHash(fingerprintData);

  return {
    userId: req.user?.userId || '',
    fingerprint: {
      deviceInfo: {
        cpuCores: req.body?.cpuCores || 0,
        ramGb: req.body?.ramGb || 0,
        screenResolution: req.body?.screenResolution || 'unknown',
        timezone: timezone,
        language: language,
        platform: platform,
        gpu: req.body?.gpu || undefined
      },
      browserInfo: {
        userAgent: userAgent,
        plugins: req.body?.plugins || [],
        canvas: req.body?.canvasFingerprint || '',
        webgl: req.body?.webglFingerprint || ''
      },
      networkInfo: {
        ipAddress: ipAddress,
        country: req.body?.country || undefined,
        latitude: req.body?.latitude || undefined,
        longitude: req.body?.longitude || undefined,
        isp: req.body?.isp || undefined
      }
    },
    fingerprintHash: fingerprintHash,
    timestamp: Date.now(),
    isWhitelisted: false,
    sessionId: crypto.randomUUID()
  };
}

/**
 * Main Device Fingerprinting Middleware
 */
export async function deviceFingerprintingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  // Only check on login endpoint
  if (!req.path.includes('/login') && !req.path.includes('/auth')) {
    return next();
  }

  try {
    const fingerprint = parseDeviceInfo(req);
    req.ipAddress = fingerprint.fingerprint.networkInfo.ipAddress;

    // If user not identified yet (login in progress), skip fingerprinting check
    if (!req.user?.userId) {
      // Store for later verification
      req.body._fingerprint = fingerprint;
      return next();
    }

    const userId = req.user.userId;
    fingerprint.userId = userId;

    // Check if device is whitelisted
    const isWhitelisted = await isDeviceWhitelisted(userId, fingerprint.fingerprintHash);
    fingerprint.isWhitelisted = isWhitelisted;

    // If whitelisted, trust the device
    if (isWhitelisted) {
      req.deviceFingerprint = {
        hash: fingerprint.fingerprintHash,
        isMatched: true,
        isWhitelisted: true,
        requiresReauth: false,
        suspiciousFlag: false
      };
      await storeDeviceFingerprint(fingerprint);
      return next();
    }

    // Match fingerprints
    const matchResult = await matchFingerprints(userId, fingerprint.fingerprintHash);

    // Check geo-velocity if location data available
    let geoVelocityResult: any = { isImpossible: false };
    if (
      fingerprint.fingerprint.networkInfo.latitude &&
      fingerprint.fingerprint.networkInfo.longitude
    ) {
      geoVelocityResult = await checkGeoVelocity(
        userId,
        {
          lat: fingerprint.fingerprint.networkInfo.latitude,
          lon: fingerprint.fingerprint.networkInfo.longitude
        },
        fingerprint.timestamp
      );
    }

    // Determine if re-authentication is needed
    const requiresReauth = !matchResult.matches || geoVelocityResult.isImpossible;
    const suspiciousFlags: string[] = [];

    if (!matchResult.matches) {
      suspiciousFlags.push('FINGERPRINT_MISMATCH');
    }

    if (geoVelocityResult.isImpossible) {
      suspiciousFlags.push('IMPOSSIBLE_TRAVEL');
      suspiciousFlags.push(
        `Distance: ${geoVelocityResult.distance?.toFixed(2)}km, Time: ${geoVelocityResult.timeDiffMinutes?.toFixed(2)}min`
      );
    }

    req.deviceFingerprint = {
      hash: fingerprint.fingerprintHash,
      isMatched: matchResult.matches,
      isWhitelisted: false,
      requiresReauth: requiresReauth,
      suspiciousFlag: suspiciousFlags.length > 0,
      reason: suspiciousFlags.join('; ')
    };

    // Log mismatch if suspicious
    if (requiresReauth) {
      await logFingerprintMismatch(
        userId,
        fingerprint.fingerprint.networkInfo.ipAddress,
        `Fingerprint mismatch detected`,
        suspiciousFlags
      );
    }

    // Store fingerprint regardless
    await storeDeviceFingerprint(fingerprint);

    // If suspicious, return 403 and require re-authentication
    if (requiresReauth) {
      return res.status(403).json({
        error: 'Device verification failed',
        requiresReauth: true,
        message: 'Please verify your identity to continue',
        suspiciousActivity: suspiciousFlags
      });
    }

    next();
  } catch (error) {
    console.error('Device fingerprinting error:', error);
    // Don't block on fingerprinting errors
    next();
  }
}

/**
 * Middleware to validate fingerprint on protected routes
 */
export function validateDeviceFingerprintMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void | Response {
  if (!req.user?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (req.deviceFingerprint?.suspiciousFlag) {
    return res.status(403).json({
      error: 'Suspicious activity detected',
      requiresReauth: true,
      details: req.deviceFingerprint.reason
    });
  }

  next();
}

/**
 * Get user's trusted devices
 */
export async function getUserTrustedDevices(userId: string): Promise<any[]> {
  try {
    const result = await db.query(
      `SELECT id, device_name, fingerprint_hash, created_at, revoked_at
       FROM device_whitelist
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching user trusted devices:', error);
    return [];
  }
}

/**
 * Get fingerprint mismatch history
 */
export async function getFingerprintMismatchHistory(
  userId: string,
  limit: number = 50
): Promise<any[]> {
  try {
    const result = await db.query(
      `SELECT id, ip_address, reason, suspicious_flags, created_at
       FROM fingerprint_mismatches
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching mismatch history:', error);
    return [];
  }
}

/**
 * Get admin alerts
 */
export async function getAdminAlerts(
  limit: number = 100,
  severity: string = 'HIGH'
): Promise<any[]> {
  try {
    const result = await db.query(
      `SELECT id, alert_type, user_id, details, severity, created_at
       FROM admin_alerts
       WHERE severity = $1 OR severity IS NULL
       ORDER BY created_at DESC
       LIMIT $2`,
      [severity, limit]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching admin alerts:', error);
    return [];
  }
}

export default deviceFingerprintingMiddleware;
