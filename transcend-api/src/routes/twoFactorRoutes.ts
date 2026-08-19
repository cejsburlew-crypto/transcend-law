// Two-Factor Authentication Routes
// API endpoints for 2FA setup, verification, and management

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { routeParam } from '../utils/httpParams';
import {
  generateTOTPSecret,
  verifyTOTP,
  generateSMSOTP,
  sendSMSOTP,
  storeSMSOTP,
  verifySMSOTP,
  enableTOTP,
  enableSMS,
  get2FASettings,
  setPrimary2FAMethod,
  initiate2FAVerification,
  complete2FAVerification,
} from '../services/twoFactorService';
import {
  check2FARequirement,
  generateBackupCodes,
  verifyBackupCode,
  getAvailableBackupCodeCount,
  logTwoFactorEvent,
  getTwoFactorAuditLog,
  create2FASession,
  verify2FASession,
  invalidate2FASession,
  trustDevice,
  isDeviceTrusted,
  getTrustedDevices,
  revokeTrustedDevice,
  set2FARequirement,
  get2FARequirements,
} from '../middleware/twoFactorAuth';

const router = Router();

// ============================================
// TOTP SETUP ENDPOINTS
// ============================================

/**
 * POST /api/v2/2fa/totp/initialize
 * Initialize TOTP setup - generate secret and QR code
 */
router.post('/totp/initialize', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId || userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { secret, qrCode, manualEntryKey } = generateTOTPSecret(req.user?.email || userId);

    // Store temporary secret in session/cache
    // In production, use Redis or session storage

    res.json({
      secret,
      qrCode: await qrCode,
      manualEntryKey,
      message: 'Scan QR code with authenticator app',
    });
  } catch (error) {
    console.error('Error initializing TOTP:', error);
    res.status(500).json({ error: 'Failed to initialize TOTP' });
  }
});

/**
 * POST /api/v2/2fa/totp/verify
 * Verify TOTP code and enable TOTP
 */
router.post('/totp/verify', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId, code, secret } = req.body;

    if (!userId || userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!code || !secret) {
      return res.status(400).json({ error: 'Code and secret required' });
    }

    // Verify TOTP code
    const isValid = verifyTOTP(secret, code);

    if (!isValid) {
      await logTwoFactorEvent(userId, 'TOTP_VERIFICATION_FAILED', { attempts: 1 });
      return res.status(400).json({ error: 'Invalid code' });
    }

    // Enable TOTP
    await enableTOTP(userId, secret);
    await logTwoFactorEvent(userId, 'TOTP_ENABLED', {});

    res.json({
      message: 'TOTP enabled successfully',
      method: 'totp',
    });
  } catch (error) {
    console.error('Error verifying TOTP:', error);
    res.status(500).json({ error: 'Failed to verify TOTP' });
  }
});

// ============================================
// SMS SETUP ENDPOINTS
// ============================================

/**
 * POST /api/v2/2fa/sms/send
 * Send SMS OTP to phone number
 */
router.post('/sms/send', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId, phoneNumber } = req.body;

    if (!userId || userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number required' });
    }

    // Generate OTP
    const otp = await generateSMSOTP();

    // Send SMS
    const sent = await sendSMSOTP(phoneNumber, otp);

    if (!sent) {
      return res.status(500).json({ error: 'Failed to send SMS' });
    }

    // Store OTP session
    const { sessionId, expiresAt } = await storeSMSOTP(userId, phoneNumber, otp);

    await logTwoFactorEvent(userId, 'SMS_OTP_SENT', { phoneNumber: maskPhoneNumber(phoneNumber) });

    res.json({
      sessionId,
      expiresAt,
      message: 'SMS OTP sent successfully',
    });
  } catch (error) {
    console.error('Error sending SMS OTP:', error);
    res.status(500).json({ error: 'Failed to send SMS OTP' });
  }
});

/**
 * POST /api/v2/2fa/sms/verify
 * Verify SMS OTP and enable SMS
 */
router.post('/sms/verify', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId, sessionId, code, phoneNumber } = req.body;

    if (!userId || userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!code || !sessionId) {
      return res.status(400).json({ error: 'Code and session ID required' });
    }

    // Verify OTP
    const isValid = await verifySMSOTP(userId, sessionId, code);

    if (!isValid) {
      await logTwoFactorEvent(userId, 'SMS_VERIFICATION_FAILED', {});
      return res.status(400).json({ error: 'Invalid or expired code' });
    }

    // Enable SMS
    if (phoneNumber) {
      await enableSMS(userId, phoneNumber);
      await logTwoFactorEvent(userId, 'SMS_ENABLED', { phoneNumber: maskPhoneNumber(phoneNumber) });
    }

    res.json({
      message: 'SMS verified successfully',
      method: 'sms',
    });
  } catch (error) {
    console.error('Error verifying SMS:', error);
    res.status(500).json({ error: 'Failed to verify SMS' });
  }
});

// ============================================
// 2FA STATUS & SETTINGS
// ============================================

/**
 * GET /api/v2/2fa/status
 * Get user's 2FA status and configuration
 */
router.get('/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const settings = await get2FASettings(userId);
    const requirement = await check2FARequirement(userId, req.user?.userType || 'client');
    const backupCodeCount = await getAvailableBackupCodeCount(userId);

    res.json({
      enabled: settings?.enabled || false,
      totpEnabled: settings?.totp_enabled || false,
      smsEnabled: settings?.sms_enabled || false,
      primaryMethod: settings?.primary_method,
      phoneNumberMasked: settings?.sms_phone ? maskPhoneNumber(settings.sms_phone) : null,
      backupCodesAvailable: backupCodeCount,
      configured: settings?.configured_at,
      requirement: {
        required: requirement.isRequired,
        hasGracePeriod: requirement.hasGracePeriod,
        gracePeriodEndsAt: requirement.gracePeriodEndsAt,
      },
    });
  } catch (error) {
    console.error('Error getting 2FA status:', error);
    res.status(500).json({ error: 'Failed to get 2FA status' });
  }
});

/**
 * POST /api/v2/2fa/set-primary-method
 * Set primary 2FA method (totp or sms)
 */
router.post('/set-primary-method', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId, method } = req.body;

    if (!userId || userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!['totp', 'sms'].includes(method)) {
      return res.status(400).json({ error: 'Invalid method' });
    }

    await setPrimary2FAMethod(userId, method);
    await logTwoFactorEvent(userId, 'PRIMARY_METHOD_CHANGED', { method });

    res.json({ message: 'Primary method updated', method });
  } catch (error) {
    console.error('Error setting primary method:', error);
    res.status(500).json({ error: 'Failed to set primary method' });
  }
});

// ============================================
// BACKUP CODES
// ============================================

/**
 * POST /api/v2/2fa/backup-codes/generate
 * Generate backup codes
 */
router.post('/backup-codes/generate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId, primaryMethod } = req.body;

    if (!userId || userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const codes = await generateBackupCodes(userId);

    res.json({
      codes,
      count: codes.length,
      message: 'Backup codes generated successfully',
    });
  } catch (error) {
    console.error('Error generating backup codes:', error);
    res.status(500).json({ error: 'Failed to generate backup codes' });
  }
});

/**
 * GET /api/v2/2fa/backup-codes/count
 * Get count of available backup codes
 */
router.get('/backup-codes/count', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const count = await getAvailableBackupCodeCount(userId);

    res.json({ count });
  } catch (error) {
    console.error('Error getting backup codes count:', error);
    res.status(500).json({ error: 'Failed to get backup codes count' });
  }
});

// ============================================
// 2FA VERIFICATION
// ============================================

/**
 * POST /api/v2/2fa/verify
 * Verify 2FA code during login
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { userId, code, method } = req.body;

    if (!userId || !code || !method) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify based on method
    let isValid = false;

    if (method === 'backup') {
      isValid = await verifyBackupCode(userId, code);
    } else {
      isValid = await complete2FAVerification(userId, 'session-id', code, method as any);
    }

    if (!isValid) {
      await logTwoFactorEvent(userId, 'VERIFICATION_FAILED', { method });
      return res.status(400).json({ error: 'Invalid code' });
    }

    await logTwoFactorEvent(userId, 'VERIFICATION_SUCCESS', { method });

    res.json({
      message: 'Verification successful',
      verified: true,
    });
  } catch (error) {
    console.error('Error verifying 2FA:', error);
    res.status(500).json({ error: 'Failed to verify 2FA' });
  }
});

/**
 * POST /api/v2/2fa/initiate
 * Initiate 2FA verification (create session)
 */
router.post('/initiate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { useFallback } = req.body;

    const { sessionId, method, phoneNumberMasked, expiresAt } = await initiate2FAVerification(
      userId,
      { useFallback }
    );

    res.json({
      sessionId,
      method,
      phoneNumberMasked,
      expiresAt,
    });
  } catch (error) {
    console.error('Error initiating 2FA verification:', error);
    res.status(500).json({ error: 'Failed to initiate 2FA verification' });
  }
});

// ============================================
// FALLBACK SMS
// ============================================

/**
 * POST /api/v2/2fa/fallback-sms
 * Request fallback SMS if primary method unavailable
 */
router.post('/fallback-sms', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    const settings = await get2FASettings(userId);

    if (!settings?.sms_enabled || !settings.sms_phone) {
      return res.status(400).json({ error: 'SMS not configured' });
    }

    const otp = await generateSMSOTP();
    const sent = await sendSMSOTP(settings.sms_phone, otp);

    if (!sent) {
      return res.status(500).json({ error: 'Failed to send SMS' });
    }

    const { sessionId, expiresAt } = await storeSMSOTP(userId, settings.sms_phone, otp);

    await logTwoFactorEvent(userId, 'FALLBACK_SMS_SENT', {});

    res.json({
      sessionId,
      phoneNumberMasked: maskPhoneNumber(settings.sms_phone),
      expiresAt,
    });
  } catch (error) {
    console.error('Error sending fallback SMS:', error);
    res.status(500).json({ error: 'Failed to send fallback SMS' });
  }
});

// ============================================
// AUDIT LOG
// ============================================

/**
 * GET /api/v2/2fa/audit-log
 * Get 2FA audit log for user
 */
router.get('/audit-log', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 50;

    const auditLog = await getTwoFactorAuditLog(userId, limit);

    res.json({
      log: auditLog,
      count: auditLog.length,
    });
  } catch (error) {
    console.error('Error getting audit log:', error);
    res.status(500).json({ error: 'Failed to get audit log' });
  }
});

// ============================================
// TRUSTED DEVICES
// ============================================

/**
 * POST /api/v2/2fa/trust-device
 * Mark device as trusted
 */
router.post('/trust-device', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { deviceFingerprint, deviceName } = req.body;

    if (!deviceFingerprint) {
      return res.status(400).json({ error: 'Device fingerprint required' });
    }

    const trustToken = await trustDevice(userId, deviceFingerprint, deviceName || 'Trusted Device');

    res.json({
      trustToken,
      message: 'Device trusted',
    });
  } catch (error) {
    console.error('Error trusting device:', error);
    res.status(500).json({ error: 'Failed to trust device' });
  }
});

/**
 * GET /api/v2/2fa/trusted-devices
 * Get list of trusted devices
 */
router.get('/trusted-devices', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const devices = await getTrustedDevices(userId);

    res.json({ devices });
  } catch (error) {
    console.error('Error getting trusted devices:', error);
    res.status(500).json({ error: 'Failed to get trusted devices' });
  }
});

/**
 * DELETE /api/v2/2fa/trusted-devices/:deviceId
 * Revoke trusted device
 */
router.delete('/trusted-devices/:deviceId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const deviceId = routeParam(req.params.deviceId);

    await revokeTrustedDevice(userId, deviceId);

    res.json({ message: 'Device revoked' });
  } catch (error) {
    console.error('Error revoking device:', error);
    res.status(500).json({ error: 'Failed to revoke device' });
  }
});

// ============================================
// COMPLETE SETUP
// ============================================

/**
 * POST /api/v2/2fa/complete-setup
 * Mark 2FA setup as complete
 */
router.post('/complete-setup', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId, primaryMethod } = req.body;

    if (!userId || userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (primaryMethod) {
      await setPrimary2FAMethod(userId, primaryMethod);
    }

    await logTwoFactorEvent(userId, 'SETUP_COMPLETED', { primaryMethod });

    res.json({
      message: '2FA setup completed',
      setupComplete: true,
    });
  } catch (error) {
    console.error('Error completing setup:', error);
    res.status(500).json({ error: 'Failed to complete setup' });
  }
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

/**
 * POST /api/v2/2fa/admin/require-2fa
 * Require 2FA for user type (admin only)
 */
router.post('/admin/require-2fa', authMiddleware, async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (req.user?.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { userType, required, gracePeriodDays } = req.body;

    if (!userType) {
      return res.status(400).json({ error: 'User type required' });
    }

    await set2FARequirement(userType, required, gracePeriodDays || 30);

    res.json({
      message: '2FA requirement updated',
      userType,
      required,
      gracePeriodDays: gracePeriodDays || 30,
    });
  } catch (error) {
    console.error('Error setting 2FA requirement:', error);
    res.status(500).json({ error: 'Failed to set 2FA requirement' });
  }
});

/**
 * GET /api/v2/2fa/admin/requirements
 * Get 2FA requirements (admin only)
 */
router.get('/admin/requirements', authMiddleware, async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (req.user?.userType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const requirements = await get2FARequirements();

    res.json({ requirements });
  } catch (error) {
    console.error('Error getting 2FA requirements:', error);
    res.status(500).json({ error: 'Failed to get 2FA requirements' });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function maskPhoneNumber(phone: string): string {
  const last4 = phone.slice(-4);
  return `***-***-${last4}`;
}

export default router;
