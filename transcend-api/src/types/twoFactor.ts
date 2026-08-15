// Two-Factor Authentication Types

// ============================================
// 2FA METHODS
// ============================================

export type TwoFactorMethod = 'totp' | 'sms' | 'backup';
export type SessionType = 'totp' | 'sms' | 'backup';

// ============================================
// 2FA SETTINGS
// ============================================

export interface User2FASettings {
  id: string;
  userId: string;
  enabled: boolean;
  totpEnabled: boolean;
  totpSecret?: string;
  smsEnabled: boolean;
  smsPhone?: string;
  primaryMethod?: 'totp' | 'sms';
  configuredAt?: Date;
  updatedAt: Date;
  createdAt: Date;
}

// ============================================
// BACKUP CODES
// ============================================

export interface BackupCode {
  id: string;
  userId: string;
  codeHash: string;
  used: boolean;
  usedAt?: Date;
  createdAt: Date;
}

// ============================================
// SESSIONS
// ============================================

export interface SMSOTPSession {
  id: string;
  userId: string;
  sessionId: string;
  phoneNumber: string;
  otpHash: string;
  attempts: number;
  verifiedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}

export interface TOTPSession {
  id: string;
  userId: string;
  sessionId: string;
  verifiedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}

export interface TwoFactorSession {
  id: string;
  userId: string;
  sessionId: string;
  sessionType: SessionType;
  codeHash?: string;
  verifiedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}

// ============================================
// TRUSTED DEVICES
// ============================================

export interface TrustedDevice {
  id: string;
  userId: string;
  deviceFingerprint: string;
  deviceName: string;
  trustToken: string;
  expiresAt: Date;
  createdAt: Date;
}

// ============================================
// ADMIN SETTINGS
// ============================================

export interface AdminSettings {
  id: string;
  userType: string;
  require2FA: boolean;
  gracePeriodDays: number;
  active: boolean;
  updatedAt: Date;
  createdAt: Date;
}

// ============================================
// AUDIT LOGS
// ============================================

export type TwoFactorEventType =
  | 'TOTP_ENABLED'
  | 'SMS_ENABLED'
  | 'TOTP_DISABLED'
  | 'SMS_DISABLED'
  | 'BACKUP_CODES_GENERATED'
  | 'BACKUP_CODE_USED'
  | 'VERIFICATION_SUCCESS'
  | 'VERIFICATION_FAILED'
  | 'TOTP_VERIFICATION_FAILED'
  | 'SMS_VERIFICATION_FAILED'
  | 'SMS_OTP_SENT'
  | 'FALLBACK_SMS_SENT'
  | 'DEVICE_TRUSTED'
  | 'DEVICE_TRUST_REVOKED'
  | 'PRIMARY_METHOD_CHANGED'
  | 'SETUP_COMPLETED'
  | 'SETUP_CANCELLED';

export interface TwoFactorAuditLogEntry {
  id: string;
  userId: string;
  eventType: TwoFactorEventType;
  details?: Record<string, any>;
  createdAt: Date;
}

export type AdminEventType =
  | '2FA_REQUIREMENT_UPDATED'
  | 'ADMIN_AUDIT_LOG_CLEARED'
  | 'USER_2FA_DISABLED';

export interface AdminAuditLogEntry {
  id: string;
  eventType: AdminEventType;
  details?: Record<string, any>;
  createdAt: Date;
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface InitializeTOTPRequest {
  userId: string;
}

export interface InitializeTOTPResponse {
  secret: string;
  qrCode: string;
  manualEntryKey: string;
  message: string;
}

export interface VerifyTOTPRequest {
  userId: string;
  code: string;
  secret: string;
}

export interface VerifyTOTPResponse {
  message: string;
  method: 'totp';
}

export interface SendSMSOTPRequest {
  userId: string;
  phoneNumber: string;
}

export interface SendSMSOTPResponse {
  sessionId: string;
  expiresAt: Date;
  message: string;
}

export interface VerifySMSOTPRequest {
  userId: string;
  sessionId: string;
  code: string;
  phoneNumber?: string;
}

export interface VerifySMSOTPResponse {
  message: string;
  method: 'sms';
}

export interface Get2FAStatusResponse {
  enabled: boolean;
  totpEnabled: boolean;
  smsEnabled: boolean;
  primaryMethod?: 'totp' | 'sms';
  phoneNumberMasked?: string;
  backupCodesAvailable: number;
  configured?: Date;
  requirement: {
    required: boolean;
    hasGracePeriod: boolean;
    gracePeriodEndsAt?: Date;
  };
}

export interface SetPrimaryMethodRequest {
  userId: string;
  method: 'totp' | 'sms';
}

export interface SetPrimaryMethodResponse {
  message: string;
  method: 'totp' | 'sms';
}

export interface GenerateBackupCodesRequest {
  userId: string;
  primaryMethod?: string;
}

export interface GenerateBackupCodesResponse {
  codes: string[];
  count: number;
  message: string;
}

export interface Get2FARequirementRequest {
  userId: string;
}

export interface Check2FARequirementResponse {
  isRequired: boolean;
  hasGracePeriod: boolean;
  gracePeriodEndsAt?: Date;
  isConfigured: boolean;
}

export interface Verify2FARequest {
  userId: string;
  code: string;
  method: TwoFactorMethod;
}

export interface Verify2FAResponse {
  message: string;
  verified: boolean;
}

export interface Initiate2FAVerificationRequest {
  userId: string;
  useFallback?: boolean;
}

export interface Initiate2FAVerificationResponse {
  sessionId: string;
  method: 'totp' | 'sms';
  phoneNumberMasked?: string;
  expiresAt: Date;
}

export interface RequestFallbackSMSRequest {
  userId: string;
}

export interface RequestFallbackSMSResponse {
  sessionId: string;
  phoneNumberMasked: string;
  expiresAt: Date;
}

export interface TrustDeviceRequest {
  userId: string;
  deviceFingerprint: string;
  deviceName?: string;
}

export interface TrustDeviceResponse {
  trustToken: string;
  message: string;
}

export interface GetTrustedDevicesResponse {
  devices: TrustedDevice[];
}

export interface RevokeTrustedDeviceRequest {
  userId: string;
  deviceId: string;
}

export interface RevokeTrustedDeviceResponse {
  message: string;
}

export interface CompleteSetupRequest {
  userId: string;
  primaryMethod?: 'totp' | 'sms';
}

export interface CompleteSetupResponse {
  message: string;
  setupComplete: boolean;
}

export interface Require2FARequest {
  userType: string;
  required: boolean;
  gracePeriodDays?: number;
}

export interface Require2FAResponse {
  message: string;
  userType: string;
  required: boolean;
  gracePeriodDays: number;
}

export interface Get2FARequirementsResponse {
  requirements: AdminSettings[];
}

export interface GetAuditLogRequest {
  userId: string;
  limit?: number;
}

export interface GetAuditLogResponse {
  log: TwoFactorAuditLogEntry[];
  count: number;
}

// ============================================
// SERVICE OPTIONS
// ============================================

export interface VerificationOptions {
  method?: 'totp' | 'sms' | 'backup';
  useFallback?: boolean;
}

export interface GenerateTOTPSecretResult {
  secret: string;
  qrCode: Promise<string>;
  manualEntryKey: string;
}

export interface StoreSMSOTPResult {
  sessionId: string;
  expiresAt: Date;
}

// ============================================
// ERROR TYPES
// ============================================

export class TwoFactorError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'TwoFactorError';
  }
}

export const TwoFactorErrorCodes = {
  INVALID_CODE: 'INVALID_CODE',
  EXPIRED_SESSION: 'EXPIRED_SESSION',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  MAX_ATTEMPTS_EXCEEDED: 'MAX_ATTEMPTS_EXCEEDED',
  METHOD_NOT_ENABLED: 'METHOD_NOT_ENABLED',
  SMS_SEND_FAILED: 'SMS_SEND_FAILED',
  INVALID_PHONE_NUMBER: 'INVALID_PHONE_NUMBER',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  TOTP_ALREADY_ENABLED: 'TOTP_ALREADY_ENABLED',
  SMS_ALREADY_ENABLED: 'SMS_ALREADY_ENABLED',
  NO_BACKUP_CODES: 'NO_BACKUP_CODES',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type TwoFactorErrorCode = (typeof TwoFactorErrorCodes)[keyof typeof TwoFactorErrorCodes];
