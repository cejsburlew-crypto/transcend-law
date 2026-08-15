// Email Verification Service
// Account verification, password reset tokens

import { randomBytes } from 'crypto';
import { query } from '../database/connection';
import { sendEmail } from './emailService';

const TOKEN_EXPIRY_MINUTES = 24 * 60; // 24 hours
const RESET_TOKEN_EXPIRY_MINUTES = 1 * 60; // 1 hour

// Generate verification token
function generateToken(): string {
  return randomBytes(32).toString('hex');
}

// Send verification email
export async function sendVerificationEmail(userId: string, email: string) {
  try {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

    // Store token
    await query(
      `INSERT INTO email_verification_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
       SET token = $2, expires_at = $3, created_at = NOW()`,
      [userId, token, expiresAt]
    );

    // Send email
    const verificationUrl = `${process.env.APP_URL}/verify-email/${token}`;
    
    await sendEmail(email, 'email-verification', {
      verificationUrl,
      expiresIn: `${TOKEN_EXPIRY_MINUTES / 60} hours`,
    });

    return { success: true, message: 'Verification email sent' };
  } catch (error) {
    console.error('Failed to send verification email:', error);
    throw error;
  }
}

// Verify email token
export async function verifyEmailToken(token: string) {
  try {
    const result = await query(
      `SELECT user_id, expires_at FROM email_verification_tokens
       WHERE token = $1 AND expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return { success: false, message: 'Invalid or expired verification token' };
    }

    const userId = result.rows[0].user_id;

    // Mark email as verified
    await query(
      `UPDATE users SET email_verified = true, email_verified_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    // Delete used token
    await query(
      `DELETE FROM email_verification_tokens WHERE token = $1`,
      [token]
    );

    return { success: true, userId, message: 'Email verified successfully' };
  } catch (error) {
    console.error('Failed to verify email token:', error);
    throw error;
  }
}

// Send password reset email
export async function sendPasswordResetEmail(email: string) {
  try {
    // Find user by email
    const userResult = await query(
      `SELECT id FROM users WHERE email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      // Don't reveal if email exists (security best practice)
      return { success: true, message: 'If email exists, reset link sent' };
    }

    const userId = userResult.rows[0].id;
    const token = generateToken();
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

    // Store reset token
    await query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
       SET token = $2, expires_at = $3, created_at = NOW()`,
      [userId, token, expiresAt]
    );

    // Send email
    const resetUrl = `${process.env.APP_URL}/reset-password/${token}`;
    
    await sendEmail(email, 'password-reset', {
      resetUrl,
      expiresIn: `${RESET_TOKEN_EXPIRY_MINUTES} minutes`,
    });

    return { success: true, message: 'If email exists, reset link sent' };
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw error;
  }
}

// Verify password reset token
export async function verifyPasswordResetToken(token: string) {
  try {
    const result = await query(
      `SELECT user_id, expires_at FROM password_reset_tokens
       WHERE token = $1 AND expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return { success: false, message: 'Invalid or expired reset token' };
    }

    return { success: true, userId: result.rows[0].user_id };
  } catch (error) {
    console.error('Failed to verify reset token:', error);
    throw error;
  }
}

// Reset password with token
export async function resetPasswordWithToken(token: string, newPassword: string) {
  try {
    // Verify token
    const verification = await verifyPasswordResetToken(token);
    if (!verification.success) {
      return verification;
    }

    const userId = verification.userId;

    // Hash password
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await query(
      `UPDATE users SET password_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [hashedPassword, userId]
    );

    // Delete used token
    await query(
      `DELETE FROM password_reset_tokens WHERE user_id = $1`,
      [userId]
    );

    // Clear failed login attempts
    await query(
      `DELETE FROM failed_logins WHERE user_id = $1`,
      [userId]
    );

    return { success: true, message: 'Password reset successfully' };
  } catch (error) {
    console.error('Failed to reset password:', error);
    throw error;
  }
}

// Cleanup expired tokens (call periodically)
export async function cleanupExpiredTokens() {
  try {
    const verificationResult = await query(
      `DELETE FROM email_verification_tokens WHERE expires_at < NOW()`
    );

    const resetResult = await query(
      `DELETE FROM password_reset_tokens WHERE expires_at < NOW()`
    );

    console.log(
      `Cleaned up ${verificationResult.rowCount} expired verification tokens and ` +
      `${resetResult.rowCount} expired reset tokens`
    );
  } catch (error) {
    console.error('Failed to cleanup expired tokens:', error);
  }
}

export default {
  sendVerificationEmail,
  verifyEmailToken,
  sendPasswordResetEmail,
  verifyPasswordResetToken,
  resetPasswordWithToken,
  cleanupExpiredTokens,
};
