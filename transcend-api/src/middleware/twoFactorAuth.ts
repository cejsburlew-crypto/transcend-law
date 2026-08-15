// Two-Factor Authentication Middleware
// Supports SMS OTP, Time-based OTP (TOTP), and backup codes
// Enforces 2FA per account type with grace period

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { query, transaction } from '../database/connection';
import { generateTOTPSecret, verifyTOTP } from '../services/twoFactorService';

declare global {
  namespace Express {
    interface Request {
      twoFactorRequired?: boolean;
      twoFactorSessionId?: string;
    }
  }
}

// ============================================
// 2FA REQUIREMENT CHECKS
// ============================================

export async function check2FARequirement(
  userId: string,
  userType: string
): Promise<{
  isRequired: boolean;
  hasGracePeriod: boolean;
  gracePeriodEndsAt?: Date;
  isConfigured: boolean;
}> {
  try {
    // Check if 2FA is required for this user type
    const requirementResult = await query(
      `SELECT require_2fa, grace_period_days FROM admin_settings
       WHERE user_type = $1 AND active = true`,
      [userType]
    );

    if (requirementResult.rows.length === 0) {
      return { isRequired: false, hasGracePeriod: false, isConfigured: false };
    }

    const { require_2fa, grace_period_days } = requirementResult.rows[0];

    if (!require_2fa) {
      return { isRequired: false, hasGracePeriod: false, isConfigured: false };
    }

    // Check if user has 2FA configured
    const userConfigResult = await query(
      `SELECT enabled, configured_at FROM user_2fa_settings
       WHERE user_id = $1`,
      [userId]
    );

    const isConfigured = userConfigResult.rows.length > 0 && userConfigResult.rows[0].enabled;

    if (isConfigured) {
      return { isRequired: true, hasGracePeriod: false, isConfigured: true };
    }

    // Check if user is still in grace period
    const userCreationResult = await query(
      `SELECT created_at FROM users WHERE id = $1`,
      [userId]
    );

    if (userCreationResult.rows.length === 0) {
      return { isRequired: false, hasGracePeriod: false, isConfigured: false };
    }

    const createdAt = userCreationResult.rows[0].created_at;
    const gracePeriodEndsAt = new Date(createdAt.getTime() + grace_period_days * 24 * 60 * 60 * 1000);
    const now = new Date();

    return {
      isRequired: true,
      hasGracePeriod: now < gracePeriodEndsAt,
      gracePeriodEndsAt,
      isConfigured: false,
    };
  } catch (error) {
    console.error('Error checking 2FA requirement:', error);
    return { isRequired: false, hasGracePeriod: false, isConfigured: false };
  }
}

// ============================================
// 2FA MIDDLEWARE
// ============================================

export async function twoFactorAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user || !req.userId) {
    return next();
  }

  try {
    const { isRequired, hasGracePeriod, isConfigured } = await check2FARequirement(
      req.userId,
      req.user.userType
    );

    req.twoFactorRequired = isRequired;

    // If 2FA is required and user hasn't configured it
    if (isRequired && !isConfigured && !hasGracePeriod) {
      // Check if request is trying to verify 2FA or configure it
      const allowedPaths = [
        '/api/v2/2fa/verify',
        '/api/v2/2fa/setup',
        '/api/v2/2fa/initialize',
        '/api/v2/2fa/status',
        '/api/v2/auth/logout',
      ];

      const isAllowedPath = allowedPaths.some(path => req.path.startsWith(path));

      if (!isAllowedPath) {
        return res.status(403).json({
          error: '2FA_REQUIRED',
          message: 'Two-factor authentication is required',
          requiresSetup: true,
        });
      }
    }

    // Check if 2FA session is valid if user has 2FA enabled
    if (isRequired && isConfigured) {
      const hasTwoFactorVerified = req.headers['x-2fa-verified'] === 'true';

      if (!hasTwoFactorVerified) {
        // Allow certain endpoints without 2FA verification
        const excludedPaths = [
          '/api/v2/2fa/verify',
          '/api/v2/2fa/initialize',
          '/api/v2/2fa/request-sms',
          '/api/v2/2fa/fallback-sms',
          '/api/v2/auth/logout',
        ];

        const isExcluded = excludedPaths.some(path => req.path.startsWith(path));

        if (!isExcluded) {
          return res.status(401).json({
            error: '2FA_NOT_VERIFIED',
            message: 'Two-factor authentication verification required',
            requiresVerification: true,
          });
        }
      }
    }

    next();
  } catch (error) {
    console.error('2FA middleware error:', error);
    next();
  }
}

// ============================================
// SESSION MANAGEMENT
// ============================================

export async function create2FASession(
  userId: string,
  sessionType: 'sms' | 'totp' | 'backup'
): Promise<string> {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  try {
    await query(
      `INSERT INTO two_factor_sessions (user_id, session_id, session_type, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, sessionId, sessionType, expiresAt]
    );

    return sessionId;
  } catch (error) {
    console.error('Error creating 2FA session:', error);
    throw error;
  }
}

export async function verify2FASession(
  userId: string,
  sessionId: string,
  code: string,
  sessionType: 'sms' | 'totp' | 'backup'
): Promise<boolean> {
  try {
    // Check if session exists and is not expired
    const sessionResult = await query(
      `SELECT id, code_hash FROM two_factor_sessions
       WHERE user_id = $1 AND session_id = $2 AND session_type = $3
       AND expires_at > NOW() AND verified_at IS NULL`,
      [userId, sessionId, sessionType]
    );

    if (sessionResult.rows.length === 0) {
      await logTwoFactorEvent(userId, 'VERIFICATION_FAILED', { sessionType, reason: 'invalid_session' });
      return false;
    }

    const session = sessionResult.rows[0];

    // Verify code based on session type
    let isValid = false;

    if (sessionType === 'backup') {
      // Verify backup code
      isValid = await verifyBackupCode(userId, code);
    } else if (sessionType === 'sms') {
      // Verify SMS OTP
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');
      isValid = session.code_hash === codeHash;
    } else if (sessionType === 'totp') {
      // Verify TOTP
      const userSettings = await query(
        `SELECT totp_secret FROM user_2fa_settings WHERE user_id = $1`,
        [userId]
      );

      if (userSettings.rows.length === 0) {
        return false;
      }

      isValid = verifyTOTP(userSettings.rows[0].totp_secret, code);
    }

    if (!isValid) {
      await logTwoFactorEvent(userId, 'VERIFICATION_FAILED', { sessionType, reason: 'invalid_code' });
      return false;
    }

    // Mark session as verified
    await query(
      `UPDATE two_factor_sessions
       SET verified_at = NOW()
       WHERE session_id = $1`,
      [sessionId]
    );

    await logTwoFactorEvent(userId, 'VERIFICATION_SUCCESS', { sessionType });

    return true;
  } catch (error) {
    console.error('Error verifying 2FA session:', error);
    return false;
  }
}

export async function invalidate2FASession(sessionId: string): Promise<void> {
  try {
    await query(
      `DELETE FROM two_factor_sessions WHERE session_id = $1`,
      [sessionId]
    );
  } catch (error) {
    console.error('Error invalidating 2FA session:', error);
  }
}

// ============================================
// BACKUP CODES
// ============================================

export async function generateBackupCodes(userId: string): Promise<string[]> {
  const codes: string[] = [];

  try {
    // Generate 10 backup codes
    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);

      const codeHash = crypto.createHash('sha256').update(code).digest('hex');

      await query(
        `INSERT INTO backup_codes (user_id, code_hash, used)
         VALUES ($1, $2, false)`,
        [userId, codeHash]
      );
    }

    await logTwoFactorEvent(userId, 'BACKUP_CODES_GENERATED', { count: codes.length });

    return codes;
  } catch (error) {
    console.error('Error generating backup codes:', error);
    throw error;
  }
}

export async function verifyBackupCode(userId: string, code: string): Promise<boolean> {
  try {
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    const result = await query(
      `SELECT id FROM backup_codes
       WHERE user_id = $1 AND code_hash = $2 AND used = false`,
      [userId, codeHash]
    );

    if (result.rows.length === 0) {
      return false;
    }

    // Mark code as used
    await query(
      `UPDATE backup_codes SET used = true, used_at = NOW()
       WHERE user_id = $1 AND code_hash = $2`,
      [userId, codeHash]
    );

    await logTwoFactorEvent(userId, 'BACKUP_CODE_USED', {});

    return true;
  } catch (error) {
    console.error('Error verifying backup code:', error);
    return false;
  }
}

export async function getAvailableBackupCodeCount(userId: string): Promise<number> {
  try {
    const result = await query(
      `SELECT COUNT(*) as count FROM backup_codes
       WHERE user_id = $1 AND used = false`,
      [userId]
    );

    return parseInt(result.rows[0].count, 10);
  } catch (error) {
    console.error('Error getting backup code count:', error);
    return 0;
  }
}

// ============================================
// AUDIT LOGGING
// ============================================

export async function logTwoFactorEvent(
  userId: string,
  eventType: string,
  details: Record<string, any>
): Promise<void> {
  try {
    await query(
      `INSERT INTO two_factor_audit_log (user_id, event_type, details, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [userId, eventType, JSON.stringify(details)]
    );
  } catch (error) {
    console.error('Error logging 2FA event:', error);
  }
}

export async function getTwoFactorAuditLog(
  userId: string,
  limit: number = 50
): Promise<any[]> {
  try {
    const result = await query(
      `SELECT id, event_type, details, created_at
       FROM two_factor_audit_log
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map(row => ({
      ...row,
      details: JSON.parse(row.details),
    }));
  } catch (error) {
    console.error('Error getting 2FA audit log:', error);
    return [];
  }
}

// ============================================
// ADMIN 2FA SETTINGS
// ============================================

export async function set2FARequirement(
  userType: string,
  required: boolean,
  gracePeriodDays: number = 30
): Promise<void> {
  try {
    await query(
      `INSERT INTO admin_settings (user_type, require_2fa, grace_period_days, active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (user_type) DO UPDATE
       SET require_2fa = $2, grace_period_days = $3, updated_at = NOW()`,
      [userType, required, gracePeriodDays]
    );

    await logAdminEvent('2FA_REQUIREMENT_UPDATED', {
      userType,
      required,
      gracePeriodDays,
    });
  } catch (error) {
    console.error('Error setting 2FA requirement:', error);
    throw error;
  }
}

export async function get2FARequirements(): Promise<any[]> {
  try {
    const result = await query(
      `SELECT user_type, require_2fa, grace_period_days, updated_at
       FROM admin_settings
       WHERE active = true
       ORDER BY user_type`
    );

    return result.rows;
  } catch (error) {
    console.error('Error getting 2FA requirements:', error);
    return [];
  }
}

export async function logAdminEvent(eventType: string, details: Record<string, any>): Promise<void> {
  try {
    await query(
      `INSERT INTO admin_audit_log (event_type, details, created_at)
       VALUES ($1, $2, NOW())`,
      [eventType, JSON.stringify(details)]
    );
  } catch (error) {
    console.error('Error logging admin event:', error);
  }
}

// ============================================
// DEVICE TRUST
// ============================================

export async function trustDevice(
  userId: string,
  deviceFingerprint: string,
  deviceName: string
): Promise<string> {
  const trustToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  try {
    await query(
      `INSERT INTO trusted_devices (user_id, device_fingerprint, device_name, trust_token, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, deviceFingerprint, deviceName, trustToken, expiresAt]
    );

    await logTwoFactorEvent(userId, 'DEVICE_TRUSTED', { deviceName });

    return trustToken;
  } catch (error) {
    console.error('Error trusting device:', error);
    throw error;
  }
}

export async function isDeviceTrusted(
  userId: string,
  deviceFingerprint: string
): Promise<boolean> {
  try {
    const result = await query(
      `SELECT id FROM trusted_devices
       WHERE user_id = $1 AND device_fingerprint = $2 AND expires_at > NOW()`,
      [userId, deviceFingerprint]
    );

    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking device trust:', error);
    return false;
  }
}

export async function revokeTrustedDevice(userId: string, deviceId: string): Promise<void> {
  try {
    await query(
      `DELETE FROM trusted_devices WHERE user_id = $1 AND id = $2`,
      [userId, deviceId]
    );

    await logTwoFactorEvent(userId, 'DEVICE_TRUST_REVOKED', {});
  } catch (error) {
    console.error('Error revoking trusted device:', error);
  }
}

export async function getTrustedDevices(userId: string): Promise<any[]> {
  try {
    const result = await query(
      `SELECT id, device_name, device_fingerprint, created_at, expires_at
       FROM trusted_devices
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows;
  } catch (error) {
    console.error('Error getting trusted devices:', error);
    return [];
  }
}
