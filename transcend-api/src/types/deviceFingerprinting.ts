// Device Fingerprinting Types

/**
 * Raw device fingerprint data
 */
export interface RawDeviceFingerprint {
  screenResolution: string;
  cpuCores?: number;
  ramGb?: number;
  timezone: string;
  language: string;
  gpuInfo?: string;
  plugins?: string[];
  canvasFingerprint?: string;
  webglFingerprint?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  isp?: string;
}

/**
 * Parsed device information
 */
export interface ParsedDeviceInfo {
  cpuCores: number;
  ramGb: number;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: 'Windows' | 'macOS' | 'Linux' | 'iOS' | 'Android' | 'Unknown';
  gpu?: string;
}

/**
 * Browser fingerprint info
 */
export interface BrowserFingerprint {
  userAgent: string;
  plugins: string[];
  canvas: string;
  webgl: string;
  acceptLanguage?: string;
  timezone?: string;
}

/**
 * Network/location info
 */
export interface NetworkFingerprint {
  ipAddress: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  isp?: string;
  vpnDetected?: boolean;
  proxyDetected?: boolean;
}

/**
 * Complete device fingerprint
 */
export interface CompleteDeviceFingerprint {
  deviceInfo: ParsedDeviceInfo;
  browserInfo: BrowserFingerprint;
  networkInfo: NetworkFingerprint;
}

/**
 * Fingerprint hash and metadata
 */
export interface FingerprintHash {
  hash: string;
  algorithm: 'sha256';
  components: string[];
  timestamp: number;
}

/**
 * Device fingerprinting result
 */
export interface DeviceFingerprintingResult {
  hash: string;
  isMatched: boolean;
  isWhitelisted: boolean;
  requiresReauth: boolean;
  suspiciousFlag: boolean;
  reason?: string;
  geoVelocityCheck?: {
    isImpossible: boolean;
    distance?: number;
    timeDiffMinutes?: number;
  };
}

/**
 * Geo-velocity check result
 */
export interface GeoVelocityCheckResult {
  isImpossible: boolean;
  distance?: number; // kilometers
  timeDiffMinutes?: number;
  requiredMinutesForTravel?: number;
  maxSpeedKmh?: number; // ~900 km/h for human travel
}

/**
 * Fingerprint mismatch record
 */
export interface FingerprintMismatchRecord {
  id: string;
  userId: string;
  ipAddress: string;
  reason: string;
  suspiciousFlags: string[];
  verifiedByUser: boolean;
  verifiedAt?: Date;
  createdAt: Date;
}

/**
 * Trusted device
 */
export interface TrustedDevice {
  id: string;
  userId: string;
  fingerprintHash: string;
  deviceName: string;
  trustedBy?: string;
  createdAt: Date;
  revokedAt?: Date;
  revokedBy?: string;
}

/**
 * Admin alert
 */
export interface AdminAlert {
  id: string;
  alertType: string;
  userId?: string;
  details: any;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  createdAt: Date;
}

/**
 * Device compromise flag
 */
export interface DeviceCompromiseFlag {
  id: string;
  userId: string;
  fingerprintHash?: string;
  flagType: 'IMPOSSIBLE_TRAVEL' | 'MULTIPLE_MISMATCHES' | 'VPN_DETECTED' |
           'PROXY_DETECTED' | 'MALWARE_SUSPECTED' | 'BRUTE_FORCE_ATTEMPT' |
           'CREDENTIAL_STUFFING';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  details: any;
  actionTaken?: string;
  resolved: boolean;
  resolvedAt?: Date;
  createdAt: Date;
}

/**
 * Login session
 */
export interface LoginSession {
  id: string;
  userId: string;
  deviceFingerprintId?: string;
  sessionToken: string;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
  lastActivity: Date;
  expiresAt: Date;
  createdAt: Date;
  endedAt?: Date;
}

/**
 * Location history record
 */
export interface LocationHistoryRecord {
  id: string;
  userId: string;
  ipAddress: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  city?: string;
  isp?: string;
  vpnDetected: boolean;
  proxyDetected: boolean;
  createdAt: Date;
}

/**
 * User device security status
 */
export interface UserDeviceSecurityStatus {
  userId: string;
  email: string;
  totalDevices: number;
  trustedDevices: number;
  mismatches24h: number;
  lastLogin?: Date;
  activeCompromiseFlags: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * Suspicious activity record (from view)
 */
export interface SuspiciousActivity {
  activityType: 'mismatch' | 'compromise_flag' | 'admin_alert';
  userId: string;
  createdAt: Date;
  ipAddress?: string;
  reason: string;
  details?: any;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * Client-side fingerprint data to send on login
 */
export interface ClientFingerprintPayload {
  screenResolution: string;
  cpuCores: number;
  ramGb: number;
  timezone: string;
  plugins: string[];
  canvasFingerprint: string;
  webglFingerprint: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  isp?: string;
}

/**
 * Middleware request extension
 */
export interface DeviceFingerprintMiddlewareData {
  hash: string;
  isMatched: boolean;
  isWhitelisted: boolean;
  requiresReauth: boolean;
  suspiciousFlag: boolean;
  reason?: string;
}
