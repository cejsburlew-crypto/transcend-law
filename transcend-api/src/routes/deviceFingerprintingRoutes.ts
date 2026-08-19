// Device Fingerprinting Routes
// User device management and admin security endpoints

import { Router, Request, Response } from 'express';
import { authMiddleware, requireUserType } from '../middleware/authMiddleware';
import { queryParam, routeParam } from '../utils/httpParams';
import {
  deviceFingerprintingMiddleware,
  validateDeviceFingerprintMiddleware,
  whitelistDevice,
  revokeDevice,
  getUserTrustedDevices,
  getFingerprintMismatchHistory,
  getAdminAlerts
} from '../middleware/deviceFingerprinting';

const router = Router();

/**
 * @route   GET /api/device/trusted-devices
 * @desc    Get user's trusted/whitelisted devices
 * @access  Private
 */
router.get('/trusted-devices', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const devices = await getUserTrustedDevices(userId);
    res.json({
      success: true,
      devices: devices.map((d: any) => ({
        id: d.id,
        deviceName: d.device_name,
        createdAt: d.created_at,
        revokedAt: d.revoked_at,
        isActive: !d.revoked_at
      }))
    });
  } catch (error) {
    console.error('Error fetching trusted devices:', error);
    res.status(500).json({ error: 'Failed to fetch trusted devices' });
  }
});

/**
 * @route   POST /api/device/trust-device
 * @desc    Add current device to whitelist
 * @access  Private
 */
router.post('/trust-device', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { deviceName, fingerprintHash } = req.body;

    if (!deviceName || !fingerprintHash) {
      return res.status(400).json({ error: 'Device name and fingerprint hash required' });
    }

    const success = await whitelistDevice(userId, fingerprintHash, deviceName);

    if (!success) {
      return res.status(500).json({ error: 'Failed to whitelist device' });
    }

    res.json({
      success: true,
      message: `Device '${deviceName}' has been added to trusted devices`,
      deviceName,
      trustedAt: new Date()
    });
  } catch (error) {
    console.error('Error whitelisting device:', error);
    res.status(500).json({ error: 'Failed to whitelist device' });
  }
});

/**
 * @route   DELETE /api/device/trust-device/:deviceId
 * @desc    Remove device from whitelist
 * @access  Private
 */
router.delete('/trust-device/:deviceId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const deviceId = routeParam(req.params.deviceId);
    const success = await revokeDevice(userId, deviceId);

    if (!success) {
      return res.status(500).json({ error: 'Failed to revoke device' });
    }

    res.json({
      success: true,
      message: 'Device removed from trusted devices',
      revokedAt: new Date()
    });
  } catch (error) {
    console.error('Error revoking device:', error);
    res.status(500).json({ error: 'Failed to revoke device' });
  }
});

/**
 * @route   GET /api/device/security-status
 * @desc    Get user's device security status
 * @access  Private
 */
router.get('/security-status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Query the user_device_security_status view
    const { query } = require('../database/connection');
    const result = await query(
      `SELECT * FROM user_device_security_status WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Security status not found' });
    }

    const status = result.rows[0];
    const riskLevel = calculateRiskLevel(
      status.mismatches_24h,
      status.active_compromise_flags
    );

    res.json({
      success: true,
      status: {
        userId: status.user_id,
        totalDevices: status.total_devices,
        trustedDevices: status.trusted_devices,
        mismatches24h: status.mismatches_24h,
        lastLogin: status.last_login,
        activeCompromiseFlags: status.active_compromise_flags,
        riskLevel: riskLevel,
        recommendations: getSecurityRecommendations(riskLevel, status)
      }
    });
  } catch (error) {
    console.error('Error fetching security status:', error);
    res.status(500).json({ error: 'Failed to fetch security status' });
  }
});

/**
 * @route   GET /api/device/mismatch-history
 * @desc    Get user's fingerprint mismatch history
 * @access  Private
 */
router.get('/mismatch-history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const limit = queryParam(req.query.limit);
    const history = await getFingerprintMismatchHistory(userId, parseInt(limit as string));

    res.json({
      success: true,
      count: history.length,
      mismatches: history.map((m: any) => ({
        id: m.id,
        ipAddress: m.ip_address,
        reason: m.reason,
        suspiciousFlags: m.suspicious_flags || [],
        createdAt: m.created_at
      }))
    });
  } catch (error) {
    console.error('Error fetching mismatch history:', error);
    res.status(500).json({ error: 'Failed to fetch mismatch history' });
  }
});

/**
 * @route   GET /api/device/verify-mismatch/:mismatchId
 * @desc    User confirms a suspicious login was legitimate
 * @access  Private
 */
router.post('/verify-mismatch/:mismatchId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const mismatchId = routeParam(req.params.mismatchId);
    const { trusted = false } = req.body;

    const { query } = require('../database/connection');

    // Verify the mismatch belongs to this user
    const mismatch = await query(
      `SELECT * FROM fingerprint_mismatches WHERE id = $1 AND user_id = $2`,
      [mismatchId, userId]
    );

    if (mismatch.rows.length === 0) {
      return res.status(404).json({ error: 'Mismatch not found' });
    }

    // Mark as verified
    await query(
      `UPDATE fingerprint_mismatches
       SET verified_by_user = TRUE, verified_at = NOW()
       WHERE id = $1`,
      [mismatchId]
    );

    // If user trusts this device, whitelist it
    if (trusted) {
      const result = await query(
        `SELECT fingerprint_hash FROM device_fingerprints
         WHERE ip_address = $1 ORDER BY created_at DESC LIMIT 1`,
        [mismatch.rows[0].ip_address]
      );

      if (result.rows.length > 0) {
        await whitelistDevice(userId, result.rows[0].fingerprint_hash, 'Verified Login');
      }
    }

    res.json({
      success: true,
      message: trusted ? 'Device added to trusted list' : 'Login marked as verified',
      verifiedAt: new Date()
    });
  } catch (error) {
    console.error('Error verifying mismatch:', error);
    res.status(500).json({ error: 'Failed to verify mismatch' });
  }
});

/**
 * @route   POST /api/device/report-compromise
 * @desc    User reports a device as compromised
 * @access  Private
 */
router.post('/report-compromise', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { deviceId, details } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID required' });
    }

    const { query } = require('../database/connection');

    // Log compromise report
    await query(
      `INSERT INTO device_compromise_flags
       (user_id, flag_type, severity, details, action_taken)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'MALWARE_SUSPECTED', 'CRITICAL', details, 'USER_REPORTED']
    );

    // Revoke the device
    await revokeDevice(userId, deviceId);

    // Create admin alert
    await query(
      `INSERT INTO admin_alerts
       (alert_type, user_id, details, severity)
       VALUES ($1, $2, $3, $4)`,
      ['DEVICE_COMPROMISE_REPORTED', userId, { deviceId, details }, 'CRITICAL']
    );

    res.json({
      success: true,
      message: 'Device compromise reported to administrators',
      reportedAt: new Date(),
      nextSteps: [
        'Change your password immediately',
        'Review recent login activity',
        'Consider enabling two-factor authentication'
      ]
    });
  } catch (error) {
    console.error('Error reporting compromise:', error);
    res.status(500).json({ error: 'Failed to report compromise' });
  }
});

/**
 * ADMIN ROUTES
 */

/**
 * @route   GET /api/admin/alerts
 * @desc    Get admin alerts (admin only)
 * @access  Private/Admin
 */
router.get('/admin/alerts',
  authMiddleware,
  requireUserType('admin'),
  async (req: Request, res: Response) => {
    try {
      const severity = queryParam(req.query.severity); const limit = queryParam(req.query.limit);
      const alerts = await getAdminAlerts(parseInt(limit as string), severity as string);

      res.json({
        success: true,
        count: alerts.length,
        alerts: alerts.map((a: any) => ({
          id: a.id,
          alertType: a.alert_type,
          userId: a.user_id,
          details: a.details,
          severity: a.severity,
          acknowledged: a.acknowledged,
          createdAt: a.created_at
        }))
      });
    } catch (error) {
      console.error('Error fetching admin alerts:', error);
      res.status(500).json({ error: 'Failed to fetch alerts' });
    }
  }
);

/**
 * @route   POST /api/admin/alerts/:alertId/acknowledge
 * @desc    Admin acknowledges an alert
 * @access  Private/Admin
 */
router.post('/admin/alerts/:alertId/acknowledge',
  authMiddleware,
  requireUserType('admin'),
  async (req: Request, res: Response) => {
    try {
      const alertId = routeParam(req.params.alertId);
      const adminId = req.user?.userId;

      const { query } = require('../database/connection');

      await query(
        `UPDATE admin_alerts
         SET acknowledged = TRUE, acknowledged_by = $1, acknowledged_at = NOW()
         WHERE id = $2`,
        [adminId, alertId]
      );

      res.json({
        success: true,
        message: 'Alert acknowledged',
        acknowledgedAt: new Date()
      });
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      res.status(500).json({ error: 'Failed to acknowledge alert' });
    }
  }
);

/**
 * @route   GET /api/admin/suspicious-activities
 * @desc    Get recent suspicious activities (admin only)
 * @access  Private/Admin
 */
router.get('/admin/suspicious-activities',
  authMiddleware,
  requireUserType('admin'),
  async (req: Request, res: Response) => {
    try {
      const { query } = require('../database/connection');
      const result = await query(
        `SELECT * FROM recent_suspicious_activities ORDER BY created_at DESC LIMIT 100`
      );

      res.json({
        success: true,
        count: result.rows.length,
        activities: result.rows
      });
    } catch (error) {
      console.error('Error fetching suspicious activities:', error);
      res.status(500).json({ error: 'Failed to fetch activities' });
    }
  }
);

/**
 * @route   GET /api/admin/user-security-status/:userId
 * @desc    Get detailed security status for a user (admin only)
 * @access  Private/Admin
 */
router.get('/admin/user-security-status/:userId',
  authMiddleware,
  requireUserType('admin'),
  async (req: Request, res: Response) => {
    try {
      const userId = routeParam(req.params.userId);
      const { query } = require('../database/connection');

      const status = await query(
        `SELECT * FROM user_device_security_status WHERE user_id = $1`,
        [userId]
      );

      if (status.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const mismatches = await query(
        `SELECT * FROM fingerprint_mismatches
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
        [userId]
      );

      const devices = await query(
        `SELECT * FROM device_fingerprints
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [userId]
      );

      const compromiseFlags = await query(
        `SELECT * FROM device_compromise_flags
         WHERE user_id = $1 AND resolved = FALSE ORDER BY created_at DESC`,
        [userId]
      );

      res.json({
        success: true,
        userStatus: status.rows[0],
        recentMismatches: mismatches.rows,
        devices: devices.rows,
        compromiseFlags: compromiseFlags.rows
      });
    } catch (error) {
      console.error('Error fetching user security status:', error);
      res.status(500).json({ error: 'Failed to fetch user security status' });
    }
  }
);

/**
 * Helper function to calculate risk level
 */
function calculateRiskLevel(
  mismatches24h: number,
  compromiseFlags: number
): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  let riskScore = 0;

  riskScore += mismatches24h * 2;
  riskScore += compromiseFlags * 3;

  if (riskScore >= 10) return 'CRITICAL';
  if (riskScore >= 6) return 'HIGH';
  if (riskScore >= 3) return 'MEDIUM';
  return 'LOW';
}

/**
 * Helper function to generate security recommendations
 */
function getSecurityRecommendations(
  riskLevel: string,
  status: any
): string[] {
  const recommendations: string[] = [];

  if (riskLevel === 'CRITICAL') {
    recommendations.push('URGENT: Change your password immediately');
    recommendations.push('Review all active sessions and revoke unknown devices');
    recommendations.push('Enable two-factor authentication if not already enabled');
    recommendations.push('Contact support if you do not recognize these activities');
  }

  if (riskLevel === 'HIGH') {
    recommendations.push('Review your device security status');
    recommendations.push('Consider enabling two-factor authentication');
    recommendations.push('Verify all active sessions are recognized');
  }

  if (status.mismatches_24h > 0) {
    recommendations.push(`Review ${status.mismatches_24h} login anomalies in your history`);
  }

  if (status.total_devices > 5) {
    recommendations.push('You have multiple devices connected. Review and remove unused ones');
  }

  if (recommendations.length === 0) {
    recommendations.push('Your account security status is good. Continue monitoring regularly');
  }

  return recommendations;
}

export default router;
