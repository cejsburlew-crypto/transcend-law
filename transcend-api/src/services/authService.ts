// Authentication Service
// JWT token generation, validation, and refresh logic

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { query, transaction } from '../database/connection';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';
const JWT_EXPIRY = '15m'; // Access token expires in 15 minutes
const REFRESH_EXPIRY = '7d'; // Refresh token expires in 7 days

export interface JWTPayload {
  userId: string;
  email: string;
  userType: 'client' | 'attorney' | 'firm';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ============================================
// PASSWORD OPERATIONS
// ============================================

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================
// TOKEN OPERATIONS
// ============================================

export function generateAccessToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function generateRefreshToken(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  return token;
}

export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export async function createRefreshToken(userId: string): Promise<string> {
  const token = generateRefreshToken(userId);
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  try {
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt]
    );
    return token;
  } catch (error) {
    console.error('Failed to create refresh token:', error);
    throw error;
  }
}

export async function verifyRefreshToken(userId: string, token: string): Promise<boolean> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  try {
    const result = await query(
      `SELECT id FROM refresh_tokens
       WHERE user_id = $1
       AND token_hash = $2
       AND expires_at > NOW()
       AND revoked_at IS NULL
       LIMIT 1`,
      [userId, tokenHash]
    );

    return result.rows.length > 0;
  } catch (error) {
    console.error('Failed to verify refresh token:', error);
    return false;
  }
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  try {
    await query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW()
       WHERE token_hash = $1`,
      [tokenHash]
    );
  } catch (error) {
    console.error('Failed to revoke refresh token:', error);
  }
}

// ============================================
// AUTHENTICATION FLOW
// ============================================

export async function registerUser(
  email: string,
  password: string,
  userType: 'client' | 'attorney' | 'firm',
  firstName?: string,
  lastName?: string
): Promise<{ userId: string; accessToken: string; refreshToken: string }> {
  return transaction(async (client) => {
    try {
      // Check if user exists
      const existingUser = await query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('User already exists');
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user
      const userResult = await query(
        `INSERT INTO users (email, password_hash, user_type, first_name, last_name)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [email, passwordHash, userType, firstName, lastName]
      );

      const userId = userResult.rows[0].id;

      // Generate tokens
      const accessToken = generateAccessToken({
        userId,
        email,
        userType,
      });

      const refreshToken = await createRefreshToken(userId);

      return { userId, accessToken, refreshToken };
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  });
}

export async function loginUser(
  email: string,
  password: string
): Promise<TokenPair> {
  try {
    // Find user
    const result = await query(
      'SELECT id, email, password_hash, user_type FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = result.rows[0];

    // Verify password
    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      userType: user.user_type,
    });

    const refreshToken = await createRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
    };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

export async function refreshAccessToken(
  userId: string,
  refreshToken: string
): Promise<TokenPair> {
  try {
    // Verify refresh token
    const isValid = await verifyRefreshToken(userId, refreshToken);
    if (!isValid) {
      throw new Error('Invalid or expired refresh token');
    }

    // Get user data
    const result = await query(
      'SELECT id, email, user_type FROM users WHERE id = $1 AND deleted_at IS NULL',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const user = result.rows[0];

    // Generate new access token
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      userType: user.user_type,
    });

    // Generate new refresh token
    const newRefreshToken = await createRefreshToken(user.id);

    // Revoke old refresh token
    await revokeRefreshToken(refreshToken);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: 15 * 60,
    };
  } catch (error) {
    console.error('Token refresh failed:', error);
    throw error;
  }
}

export async function logoutUser(refreshToken: string): Promise<void> {
  try {
    await revokeRefreshToken(refreshToken);
  } catch (error) {
    console.error('Logout failed:', error);
  }
}
