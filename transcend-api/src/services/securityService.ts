// Security Service
// Account lockout, audit logging, security events

import { query } from '../database/connection';
import { sendEmail } from './emailService';

interface FailedLogin {
  userId: string;
  ip: string;
  userAgent: string;
  timestamp: Date;
}

interface AuditLog {
  userId: string;
  action: string;
  resourceId?: string;
  ip: string;
  userAgent: string;
  statusCode?: number;
  details?: Record<string, any>;
}

const FAILED_LOGIN_LIMIT = 5;
const LOCKOUT_DURATION_MINUTES = 15;
const SUSPICIOUS_ACTIVITY_THRESHOLD = 10;

// Track failed login attempts
export async function recordFailedLogin(userId: string, ip: string, userAgent: string) {
  try {
    await query(
      `INSERT INTO failed_logins (user_id, ip, user_agent, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [userId, ip, userAgent]
    );

    // Check if account should be locked
    const failedAttempts = await query(
      `SELECT COUNT(*) as count FROM failed_logins
       WHERE user_id = $1 
       AND created_at > NOW() - INTERVAL '15 minutes'`,
      [userId]
    );

    const count = parseInt(failedAttempts.rows[0].count);

    if (count >= FAILED_LOGIN_LIMIT) {
      // Lock account
      await query(
        `UPDATE users SET locked_until = NOW() + INTERVAL '15 minutes'
         WHERE id = $1`,
        [userId]
      );

      // Send alert email
      const user = await query(
        'SELECT email FROM users WHERE id = $1',
        [userId]
      );

      await sendEmail(user.rows[0].email, 'security-alert', {
        reason: 'Account locked due to multiple failed login attempts',
        lockoutTime: '15 minutes',
      });

      return { locked: true, message: 'Account locked for 15 minutes' };
    }

    return { locked: false, attemptsRemaining: FAILED_LOGIN_LIMIT - count };
  } catch (error) {
    console.error('Failed to record login attempt:', error);
  }
}

// Clear failed login attempts on successful login
export async function clearFailedLogins(userId: string) {
  try {
    await query(
      `DELETE FROM failed_logins WHERE user_id = $1`,
      [userId]
    );
  } catch (error) {
    console.error('Failed to clear login attempts:', error);
  }
}

// Check if account is locked
export async function isAccountLocked(userId: string): Promise<boolean> {
  try {
    const result = await query(
      `SELECT locked_until FROM users WHERE id = $1`,
      [userId]
    );

    if (!result.rows[0]) return false;

    const lockedUntil = result.rows[0].locked_until;
    if (!lockedUntil) return false;

    const now = new Date();
    const locked = new Date(lockedUntil) > now;

    // Clear lock if expired
    if (!locked) {
      await query(
        `UPDATE users SET locked_until = NULL WHERE id = $1`,
        [userId]
      );
    }

    return locked;
  } catch (error) {
    console.error('Failed to check account lock:', error);
    return false;
  }
}

// Record audit log event
export async function logAuditEvent(event: AuditLog) {
  try {
    await query(
      `INSERT INTO audit_logs 
       (user_id, action, resource_id, ip, user_agent, status_code, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        event.userId,
        event.action,
        event.resourceId || null,
        event.ip,
        event.userAgent,
        event.statusCode || null,
        JSON.stringify(event.details || {}),
      ]
    );

    // Check for suspicious activity
    await checkSuspiciousActivity(event.userId, event.ip);
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

// Detect suspicious activity patterns
async function checkSuspiciousActivity(userId: string, ip: string) {
  try {
    // Check for unusual number of failed attempts
    const failedLogins = await query(
      `SELECT COUNT(*) as count FROM failed_logins
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
      [userId]
    );

    const count = parseInt(failedLogins.rows[0].count);

    if (count > SUSPICIOUS_ACTIVITY_THRESHOLD) {
      // Alert security team
      const user = await query(
        'SELECT email FROM users WHERE id = $1',
        [userId]
      );

      await sendEmail(
        process.env.SECURITY_ALERT_EMAIL || 'security@transcend-law.com',
        'suspicious-activity-alert',
        {
          userId,
          failedAttempts: count,
          ip,
          email: user.rows[0].email,
        }
      );
    }
  } catch (error) {
    console.error('Failed to check suspicious activity:', error);
  }
}

// Get audit logs for user
export async function getUserAuditLogs(userId: string, limit = 50) {
  try {
    const result = await query(
      `SELECT * FROM audit_logs 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  } catch (error) {
    console.error('Failed to retrieve audit logs:', error);
    return [];
  }
}

// Log successful auth action
export async function logAuthSuccess(userId: string, ip: string, userAgent: string) {
  await logAuditEvent({
    userId,
    action: 'login_success',
    ip,
    userAgent,
  });
}

// Log auth failure
export async function logAuthFailure(userId: string, ip: string, userAgent: string) {
  await logAuditEvent({
    userId,
    action: 'login_failure',
    ip,
    userAgent,
  });
}

// Log password change
export async function logPasswordChange(userId: string, ip: string, userAgent: string) {
  await logAuditEvent({
    userId,
    action: 'password_changed',
    ip,
    userAgent,
  });
}

// Log case access
export async function logCaseAccess(userId: string, caseId: string, ip: string, userAgent: string) {
  await logAuditEvent({
    userId,
    action: 'case_accessed',
    resourceId: caseId,
    ip,
    userAgent,
  });
}

// Log document access
export async function logDocumentAccess(userId: string, documentId: string, ip: string, userAgent: string) {
  await logAuditEvent({
    userId,
    action: 'document_accessed',
    resourceId: documentId,
    ip,
    userAgent,
  });
}

// Log payment transaction
export async function logPaymentTransaction(
  userId: string,
  transactionId: string,
  amount: number,
  status: string,
  ip: string,
  userAgent: string
) {
  await logAuditEvent({
    userId,
    action: 'payment_transaction',
    resourceId: transactionId,
    ip,
    userAgent,
    details: { amount, status },
  });
}

export default {
  recordFailedLogin,
  clearFailedLogins,
  isAccountLocked,
  logAuditEvent,
  getUserAuditLogs,
  logAuthSuccess,
  logAuthFailure,
  logPasswordChange,
  logCaseAccess,
  logDocumentAccess,
  logPaymentTransaction,
};
