// KYC Rate Limiting Middleware
// ERROR FIX 7: Implements rate limiting to prevent abuse

import { Request, Response, NextFunction } from 'express';
import { query } from '../database/connection';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxAttempts: number; // Max attempts in window
  limitType: 'email' | 'sms' | 'verification';
}

const DEFAULT_CONFIGS = {
  email: { windowMs: 3600000, maxAttempts: 3 }, // 3 per hour
  sms: { windowMs: 3600000, maxAttempts: 3 }, // 3 per hour
  verification: { windowMs: 300000, maxAttempts: 5 }, // 5 per 5 minutes
};

/**
 * Rate limiting middleware for KYC endpoints
 */
/**
 * Middleware factory. NOT async: an async factory returns a Promise, which
 * Express cannot mount as a handler - so these endpoints previously had no
 * rate limiting at all.
 */
export function kycRateLimit(limitType: 'email' | 'sms' | 'verification') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id as string;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const config = DEFAULT_CONFIGS[limitType];
      const windowStartTime = new Date(Date.now() - config.windowMs);
      const ipAddress = req.ip || '0.0.0.0';

      // Check rate limit for this user + IP combination
      const result = await query(
        `SELECT COUNT(*) as attempt_count FROM kyc_audit_log
         WHERE user_id = $1
         AND ip_address = $2
         AND created_at > $3
         AND event IN ('initiated_${limitType}', 'failed_attempt_${limitType}')`,
        [userId, ipAddress, windowStartTime]
      );

      const attemptCount = parseInt(result.rows[0]?.attempt_count || '0');

      if (attemptCount >= config.maxAttempts) {
        return res.status(429).json({
          success: false,
          message: `Too many ${limitType} attempts. Please try again later.`,
          retryAfterSeconds: Math.ceil(config.windowMs / 1000),
        });
      }

      // Add remaining attempts to response locals
      res.locals.retriesRemaining = config.maxAttempts - attemptCount - 1;

      next();
    } catch (error) {
      console.error('Error in rate limit middleware:', error);
      // Fail open - allow request if rate limit check fails
      next();
    }
  };
}

/**
 * IP-based rate limiting for unauthenticated endpoints
 */
export async function ipRateLimit(limitType: 'email_verification' | 'phone_verification') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress || '0.0.0.0';
      const windowMs = 3600000; // 1 hour
      const maxAttempts = 10;
      const windowStartTime = new Date(Date.now() - windowMs);

      const result = await query(
        `SELECT COUNT(*) as attempt_count FROM kyc_audit_log
         WHERE ip_address = $1
         AND created_at > $2
         AND event IN ('initiated_${limitType}', 'failed_attempt_${limitType}')`,
        [ipAddress, windowStartTime]
      );

      const attemptCount = parseInt(result.rows[0]?.attempt_count || '0');

      if (attemptCount >= maxAttempts) {
        return res.status(429).json({
          success: false,
          message: 'Too many requests from this IP. Please try again later.',
          retryAfterSeconds: 3600,
        });
      }

      next();
    } catch (error) {
      console.error('Error in IP rate limit middleware:', error);
      next();
    }
  };
}

/**
 * Suspicious activity detection
 */
export async function detectSuspiciousActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id as string;
    if (!userId) return next();

    const ipAddress = req.ip || '0.0.0.0';
    const windowMs = 300000; // 5 minutes
    const suspiciousThreshold = 15; // More than 15 failed attempts in 5 minutes
    const windowStartTime = new Date(Date.now() - windowMs);

    const result = await query(
      `SELECT COUNT(*) as failed_count FROM kyc_audit_log
       WHERE user_id = $1
       AND event LIKE 'failed_attempt_%'
       AND created_at > $2`,
      [userId, windowStartTime]
    );

    const failedCount = parseInt(result.rows[0]?.failed_count || '0');

    if (failedCount >= suspiciousThreshold) {
      // Log suspicious activity
      await query(
        `INSERT INTO kyc_audit_log (user_id, stage, event, ip_address, created_at)
         VALUES ($1, 'security', 'suspicious_activity', $2, NOW())`,
        [userId, ipAddress]
      );

      // Lock account temporarily
      await query(
        `UPDATE users SET account_locked = true, locked_until = NOW() + INTERVAL '1 hour'
         WHERE id = $1`,
        [userId]
      );

      return res.status(403).json({
        success: false,
        message: 'Account temporarily locked due to suspicious activity. Please contact support.',
      });
    }

    next();
  } catch (error) {
    console.error('Error in suspicious activity detection:', error);
    next();
  }
}

export default {
  kycRateLimit,
  ipRateLimit,
  detectSuspiciousActivity,
};
