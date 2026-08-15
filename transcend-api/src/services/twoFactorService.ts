// Two-Factor Authentication Service
// TOTP generation, SMS OTP, and overall 2FA management

import crypto from 'crypto';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { query } from '../database/connection';
import { sendSMS } from './smsService';

// ============================================
// TOTP (TIME-BASED ONE-TIME PASSWORD)
// ============================================

export function generateTOTPSecret(email: string): {
  secret: string;
  qrCode: Promise<string>;
  manualEntryKey: string;
} {
  const secret = speakeasy.generateSecret({
    name: `Transcend Legal (${email})`,
    issuer: 'Transcend Legal',
    length: 32,
  });

  const qrCode = QRCode.toDataURL(secret.otpauth_url!);
  const manualEntryKey = secret.base32!;

  return {
    secret: secret.base32!,
    qrCode,
    manualEntryKey,
  };
}

export function verifyTOTP(secret: string, code: string, window: number = 1): boolean {
  try {
    const isValid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window,
    });

    return isValid;
  } catch (error) {
    console.error('Error verifying TOTP:', error);
    return false;
  }
}

// ============================================
// SMS OTP
// ============================================

export async function generateSMSOTP(): Promise<string> {
  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  return otp;
}

export async function sendSMSOTP(phoneNumber: string, otp: string): Promise<boolean> {
  try {
    const message = `Your Transcend Legal verification code is: ${otp}. Valid for 10 minutes.`;
    return await sendSMS(phoneNumber, message);
  } catch (error) {
    console.error('Error sending SMS OTP:', error);
    return false;
  }
}

export async function storeSMSOTP(
  userId: string,
  phoneNumber: string,
  otp: string
): Promise<{ sessionId: string; expiresAt: Date }> {
  const sessionId = crypto.randomBytes(16).toString('hex');
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  try {
    await query(
      `INSERT INTO sms_otp_sessions (user_id, session_id, phone_number, otp_hash, expires_at, attempts)
       VALUES ($1, $2, $3, $4, $5, 0)`,
      [userId, sessionId, phoneNumber, otpHash, expiresAt]
    );

    return { sessionId, expiresAt };
  } catch (error) {
    console.error('Error storing SMS OTP:', error);
    throw error;
  }
}

export async function verifySMSOTP(
  userId: string,
  sessionId: string,
  otp: string,
  maxAttempts: number = 3
): Promise<boolean> {
  try {
    // Get the session
    const sessionResult = await query(
      `SELECT otp_hash, attempts FROM sms_otp_sessions
       WHERE user_id = $1 AND session_id = $2 AND expires_at > NOW()`,
      [userId, sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return false;
    }

    const session = sessionResult.rows[0];
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    // Check attempts
    if (session.attempts >= maxAttempts) {
      await query(
        `DELETE FROM sms_otp_sessions WHERE session_id = $1`,
        [sessionId]
      );
      return false;
    }

    // Verify OTP
    if (session.otp_hash !== otpHash) {
      // Increment attempts
      await query(
        `UPDATE sms_otp_sessions SET attempts = attempts + 1 WHERE session_id = $1`,
        [sessionId]
      );
      return false;
    }

    // Mark as verified
    await query(
      `UPDATE sms_otp_sessions SET verified_at = NOW() WHERE session_id = $1`,
      [sessionId]
    );

    return true;
  } catch (error) {
    console.error('Error verifying SMS OTP:', error);
    return false;
  }
}

// ============================================
// USER 2FA CONFIGURATION
// ============================================

export async function enableTOTP(
  userId: string,
  totpSecret: string
): Promise<void> {
  try {
    await query(
      `INSERT INTO user_2fa_settings (user_id, enabled, totp_enabled, totp_secret, configured_at)
       VALUES ($1, true, true, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET enabled = true, totp_enabled = true, totp_secret = $2, configured_at = NOW()`,
      [userId, totpSecret]
    );
  } catch (error) {
    console.error('Error enabling TOTP:', error);
    throw error;
  }
}

export async function enableSMS(
  userId: string,
  phoneNumber: string
): Promise<void> {
  try {
    await query(
      `INSERT INTO user_2fa_settings (user_id, enabled, sms_enabled, sms_phone, configured_at)
       VALUES ($1, true, true, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET enabled = true, sms_enabled = true, sms_phone = $2, configured_at = NOW()`,
      [userId, phoneNumber]
    );
  } catch (error) {
    console.error('Error enabling SMS:', error);
    throw error;
  }
}

export async function disableTOTP(userId: string): Promise<void> {
  try {
    await query(
      `UPDATE user_2fa_settings
       SET totp_enabled = false, totp_secret = NULL
       WHERE user_id = $1`,
      [userId]
    );
  } catch (error) {
    console.error('Error disabling TOTP:', error);
    throw error;
  }
}

export async function disableSMS(userId: string): Promise<void> {
  try {
    await query(
      `UPDATE user_2fa_settings
       SET sms_enabled = false, sms_phone = NULL
       WHERE user_id = $1`,
      [userId]
    );
  } catch (error) {
    console.error('Error disabling SMS:', error);
    throw error;
  }
}

export async function get2FASettings(userId: string): Promise<any> {
  try {
    const result = await query(
      `SELECT id, enabled, totp_enabled, sms_enabled, sms_phone, configured_at, updated_at
       FROM user_2fa_settings
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error getting 2FA settings:', error);
    return null;
  }
}

// ============================================
// PRIMARY 2FA METHOD MANAGEMENT
// ============================================

export async function setPrimary2FAMethod(
  userId: string,
  method: 'totp' | 'sms'
): Promise<void> {
  try {
    await query(
      `UPDATE user_2fa_settings
       SET primary_method = $1
       WHERE user_id = $2`,
      [method, userId]
    );
  } catch (error) {
    console.error('Error setting primary 2FA method:', error);
    throw error;
  }
}

export async function getPrimary2FAMethod(userId: string): Promise<'totp' | 'sms' | null> {
  try {
    const result = await query(
      `SELECT primary_method FROM user_2fa_settings WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].primary_method;
  } catch (error) {
    console.error('Error getting primary 2FA method:', error);
    return null;
  }
}

// ============================================
// FALLBACK MECHANISM
// ============================================

export async function canUseFallbackSMS(userId: string): Promise<boolean> {
  try {
    const settings = await get2FASettings(userId);

    if (!settings || !settings.sms_enabled || !settings.sms_phone) {
      return false;
    }

    // Check if SMS is not the primary method
    return settings.primary_method !== 'sms';
  } catch (error) {
    console.error('Error checking SMS fallback eligibility:', error);
    return false;
  }
}

export async function requestFallbackSMS(userId: string): Promise<{
  sessionId: string;
  phoneNumber: string;
  expiresAt: Date;
}> {
  try {
    const settings = await get2FASettings(userId);

    if (!settings || !settings.sms_enabled || !settings.sms_phone) {
      throw new Error('SMS not configured for this user');
    }

    const otp = await generateSMSOTP();
    const success = await sendSMSOTP(settings.sms_phone, otp);

    if (!success) {
      throw new Error('Failed to send SMS OTP');
    }

    const { sessionId, expiresAt } = await storeSMSOTP(userId, settings.sms_phone, otp);

    return { sessionId, phoneNumber: maskPhoneNumber(settings.sms_phone), expiresAt };
  } catch (error) {
    console.error('Error requesting fallback SMS:', error);
    throw error;
  }
}

function maskPhoneNumber(phone: string): string {
  const last4 = phone.slice(-4);
  return `***-***-${last4}`;
}

// ============================================
// VERIFICATION FLOW HELPERS
// ============================================

export interface VerificationOptions {
  method?: 'totp' | 'sms' | 'backup';
  useFallback?: boolean;
}

export async function initiate2FAVerification(
  userId: string,
  options: VerificationOptions = {}
): Promise<{
  sessionId: string;
  method: 'totp' | 'sms';
  phoneNumberMasked?: string;
  expiresAt: Date;
}> {
  try {
    const settings = await get2FASettings(userId);

    if (!settings || !settings.enabled) {
      throw new Error('2FA not enabled for this user');
    }

    let method = options.method || settings.primary_method || 'totp';

    // Fallback to SMS if TOTP unavailable
    if (method === 'totp' && !settings.totp_enabled && settings.sms_enabled && options.useFallback) {
      method = 'sms';
    }

    if (method === 'sms' && settings.sms_enabled) {
      const otp = await generateSMSOTP();
      const success = await sendSMSOTP(settings.sms_phone, otp);

      if (!success) {
        throw new Error('Failed to send SMS OTP');
      }

      const { sessionId, expiresAt } = await storeSMSOTP(userId, settings.sms_phone, otp);

      return {
        sessionId,
        method: 'sms',
        phoneNumberMasked: maskPhoneNumber(settings.sms_phone),
        expiresAt,
      };
    }

    // For TOTP, just create a session
    const sessionId = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await query(
      `INSERT INTO totp_sessions (user_id, session_id, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, sessionId, expiresAt]
    );

    return { sessionId, method: 'totp', expiresAt };
  } catch (error) {
    console.error('Error initiating 2FA verification:', error);
    throw error;
  }
}

export async function complete2FAVerification(
  userId: string,
  sessionId: string,
  code: string,
  method: 'totp' | 'sms' | 'backup'
): Promise<boolean> {
  try {
    if (method === 'sms') {
      return await verifySMSOTP(userId, sessionId, code);
    } else if (method === 'totp') {
      const settings = await get2FASettings(userId);
      if (!settings || !settings.totp_secret) {
        return false;
      }
      return verifyTOTP(settings.totp_secret, code);
    } else if (method === 'backup') {
      // Verify backup code
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');
      const result = await query(
        `SELECT id FROM backup_codes
         WHERE user_id = $1 AND code_hash = $2 AND used = false`,
        [userId, codeHash]
      );

      if (result.rows.length === 0) {
        return false;
      }

      // Mark as used
      await query(
        `UPDATE backup_codes SET used = true, used_at = NOW()
         WHERE user_id = $1 AND code_hash = $2`,
        [userId, codeHash]
      );

      return true;
    }

    return false;
  } catch (error) {
    console.error('Error completing 2FA verification:', error);
    return false;
  }
}
