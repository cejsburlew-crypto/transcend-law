// Authentication Routes
// Login, signup, token refresh, logout

import { Router, Request, Response } from 'express';
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
} from '../services/authService';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

/**
 * POST /api/v2/auth/signup
 * Register new user
 */
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, userType, firstName, lastName } = req.body;

    // Validate input
    if (!email || !password || !userType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['client', 'attorney', 'firm'].includes(userType)) {
      return res.status(400).json({ error: 'Invalid user type' });
    }

    // Register user
    const result = await registerUser(email, password, userType, firstName, lastName);

    return res.status(201).json({
      success: true,
      userId: result.userId,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (error: any) {
    console.error('Signup error:', error);

    if (error.message === 'User already exists') {
      return res.status(409).json({ error: 'Email already registered' });
    }

    return res.status(500).json({ error: 'Signup failed' });
  }
});

/**
 * POST /api/v2/auth/login
 * User login
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Login user
    const tokens = await loginUser(email, password);

    return res.json({
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    });
  } catch (error: any) {
    console.error('Login error:', error);

    if (error.message === 'Invalid email or password') {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    return res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/v2/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken, userId } = req.body;

    if (!refreshToken || !userId) {
      return res.status(400).json({ error: 'Refresh token and userId required' });
    }

    const tokens = await refreshAccessToken(userId, refreshToken);

    return res.json({
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    });
  } catch (error: any) {
    console.error('Token refresh error:', error);

    if (error.message.includes('Invalid or expired')) {
      return res.status(401).json({ error: error.message });
    }

    return res.status(500).json({ error: 'Token refresh failed' });
  }
});

/**
 * POST /api/v2/auth/logout
 * Logout user (revoke refresh token)
 */
router.post('/logout', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    await logoutUser(refreshToken);

    return res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * GET /api/v2/auth/me
 * Get current user info
 */
router.get('/me', authMiddleware, (req: Request, res: Response) => {
  return res.json({
    user: req.user,
  });
});

export default router;
