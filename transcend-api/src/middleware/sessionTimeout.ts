// Session Timeout & Auto-Logout Middleware
// Configurable inactivity timeout with role-based settings, warning system, and audit logging

import { Request, Response, NextFunction } from 'express';
import { query } from '../database/connection';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface SessionConfig {
  userId: string;
  sessionId: string;
  userType: 'client' | 'attorney' | 'firm';
  createdAt: number;
  lastActivityAt: number;
  ipAddress: string;
  userAgent: string;
  warningNotified: boolean;
  warningNotifiedAt?: number;
}

export interface TimeoutConfig {
  inactivityTimeout: number; // milliseconds
  warningTime: number; // milliseconds before logout
  extendSessionDuration: number; // milliseconds
  requireReauth: boolean; // require re-authentication after timeout
}

export interface RoleTimeoutConfig {
  [role: string]: TimeoutConfig;
}

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  inactivityTimeout: 15 * 60 * 1000, // 15 minutes
  warningTime: 5 * 60 * 1000, // 5 minutes before logout
  extendSessionDuration: 5 * 60 * 1000, // Extend by 5 minutes
  requireReauth: true,
};

const ROLE_TIMEOUT_CONFIGS: RoleTimeoutConfig = {
  admin: {
    inactivityTimeout: 20 * 60 * 1000, // 20 minutes
    warningTime: 5 * 60 * 1000,
    extendSessionDuration: 10 * 60 * 1000, // Extend by 10 minutes
    requireReauth: true,
  },
  attorney: {
    inactivityTimeout: 30 * 60 * 1000, // 30 minutes
    warningTime: 5 * 60 * 1000,
    extendSessionDuration: 10 * 60 * 1000,
    requireReauth: true,
  },
  firm: {
    inactivityTimeout: 25 * 60 * 1000, // 25 minutes
    warningTime: 5 * 60 * 1000,
    extendSessionDuration: 10 * 60 * 1000,
    requireReauth: true,
  },
  client: {
    inactivityTimeout: 15 * 60 * 1000, // 15 minutes
    warningTime: 5 * 60 * 1000,
    extendSessionDuration: 5 * 60 * 1000,
    requireReauth: true,
  },
};

// ============================================
// SESSION MANAGER
// ============================================

class SessionManager {
  private sessions: Map<string, SessionConfig> = new Map();
  private roleConfigs: RoleTimeoutConfig;
  private defaultConfig: TimeoutConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    roleConfigs: RoleTimeoutConfig = ROLE_TIMEOUT_CONFIGS,
    defaultConfig: TimeoutConfig = DEFAULT_TIMEOUT_CONFIG
  ) {
    this.roleConfigs = roleConfigs;
    this.defaultConfig = defaultConfig;
    this.startCleanupInterval();
  }

  // Start periodic cleanup of expired sessions
  private startCleanupInterval() {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);

    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [sessionId, session] of this.sessions.entries()) {
        const config = this.getTimeoutConfig(session.userType);
        const sessionAge = now - session.lastActivityAt;

        if (sessionAge > config.inactivityTimeout) {
          this.sessions.delete(sessionId);
        }
      }
    }, 60 * 1000); // Cleanup every minute
  }

  // Get timeout configuration for a specific role
  getTimeoutConfig(userType: string): TimeoutConfig {
    return this.roleConfigs[userType] || this.defaultConfig;
  }

  // Create a new session
  createSession(
    userId: string,
    userType: string,
    ipAddress: string,
    userAgent: string
  ): SessionConfig {
    const sessionId = this.generateSessionId();
    const now = Date.now();

    const session: SessionConfig = {
      userId,
      sessionId,
      userType: userType as 'client' | 'attorney' | 'firm',
      createdAt: now,
      lastActivityAt: now,
      ipAddress,
      userAgent,
      warningNotified: false,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  // Get session
  getSession(sessionId: string): SessionConfig | undefined {
    return this.sessions.get(sessionId);
  }

  // Update last activity
  updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivityAt = Date.now();
      session.warningNotified = false;
    }
  }

  // Check if session is expired
  isSessionExpired(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return true;

    const config = this.getTimeoutConfig(session.userType);
    const inactivityDuration = Date.now() - session.lastActivityAt;

    return inactivityDuration > config.inactivityTimeout;
  }

  // Check if warning should be shown
  shouldShowWarning(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.warningNotified) return false;

    const config = this.getTimeoutConfig(session.userType);
    const timeUntilExpiry = config.inactivityTimeout - (Date.now() - session.lastActivityAt);

    return (
      timeUntilExpiry <= config.warningTime &&
      timeUntilExpiry > 0 &&
      !session.warningNotified
    );
  }

  // Mark warning as shown
  markWarningShown(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.warningNotified = true;
      session.warningNotifiedAt = Date.now();
    }
  }

  // Extend session
  extendSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.lastActivityAt = Date.now();
    session.warningNotified = false;
    return true;
  }

  // Destroy session
  destroySession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  // Get remaining time
  getRemainingTime(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    if (!session) return 0;

    const config = this.getTimeoutConfig(session.userType);
    const inactivityDuration = Date.now() - session.lastActivityAt;
    const remaining = config.inactivityTimeout - inactivityDuration;

    return Math.max(0, remaining);
  }

  // Get all active sessions for user
  getUserSessions(userId: string): SessionConfig[] {
    const userSessions: SessionConfig[] = [];
    for (const session of this.sessions.values()) {
      if (session.userId === userId) {
        userSessions.push(session);
      }
    }
    return userSessions;
  }

  // Revoke all user sessions
  revokeUserSessions(userId: string): void {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(sessionId);
      }
    }
  }

  // Generate unique session ID
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cleanup
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessions.clear();
  }
}

// ============================================
// AUDIT LOGGING
// ============================================

async function logLogout(
  userId: string,
  sessionId: string,
  reason: 'timeout' | 'manual' | 'extended_inactivity' | 'forced',
  ipAddress: string,
  userAgent: string
): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log (user_id, action, resource_type, resource_id, changes, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [
        userId,
        'logout',
        'session',
        sessionId,
        JSON.stringify({ reason, timestamp: new Date().toISOString() }),
        ipAddress,
        userAgent,
      ]
    );

    // Also log to activity_logs for session tracking
    await query(
      `INSERT INTO activity_logs (user_id, action, resource, resource_id, ip_address, user_agent, session_id, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [userId, 'session_ended', 'session', sessionId, ipAddress, userAgent, sessionId]
    );
  } catch (error) {
    console.error('Failed to log logout:', error);
  }
}

// ============================================
// MIDDLEWARE FACTORY
// ============================================

const globalSessionManager = new SessionManager();

declare global {
  namespace Express {
    interface Request {
      sessionId?: string;
      sessionTimeout?: {
        expiresAt: number;
        warningThreshold: number;
        shouldWarn: boolean;
        remainingTime: number;
      };
    }
  }
}

/**
 * Session timeout middleware
 * Tracks user sessions and enforces inactivity timeouts
 */
export async function sessionTimeoutMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Skip session tracking for public endpoints and health checks
  const publicPaths = ['/health', '/status', '/api/public', '/api/auth/login', '/api/auth/register'];
  if (publicPaths.some(p => req.path.startsWith(p))) {
    return next();
  }

  // Check if user is authenticated
  if (!req.user?.userId) {
    return next();
  }

  try {
    const sessionId = req.sessionId || (req.headers['x-session-id'] as string);
    const ipAddress = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    if (!sessionId) {
      // Create new session if not exists
      const newSession = globalSessionManager.createSession(
        req.user.userId,
        req.user.userType || 'client',
        ipAddress,
        userAgent
      );
      req.sessionId = newSession.sessionId;
      res.setHeader('X-Session-ID', newSession.sessionId);
    } else {
      // Check existing session
      const session = globalSessionManager.getSession(sessionId);

      if (!session) {
        return res.status(401).json({
          error: 'Session expired',
          code: 'SESSION_EXPIRED',
          requireReauth: true,
        });
      }

      // Check if session is expired
      if (globalSessionManager.isSessionExpired(sessionId)) {
        globalSessionManager.destroySession(sessionId);
        await logLogout(
          session.userId,
          sessionId,
          'timeout',
          ipAddress,
          userAgent
        );

        return res.status(401).json({
          error: 'Session expired due to inactivity',
          code: 'SESSION_TIMEOUT',
          requireReauth: true,
          warningNotified: true,
        });
      }

      // Check if warning should be shown
      if (globalSessionManager.shouldShowWarning(sessionId)) {
        globalSessionManager.markWarningShown(sessionId);
        res.setHeader('X-Session-Warning', 'true');
      }

      // Update last activity
      globalSessionManager.updateActivity(sessionId);
      req.sessionId = sessionId;
    }

    // Calculate timeout info
    const config = globalSessionManager.getTimeoutConfig(req.user.userType || 'client');
    const remainingTime = globalSessionManager.getRemainingTime(req.sessionId);
    const warningThreshold = config.warningTime;

    req.sessionTimeout = {
      expiresAt: Date.now() + remainingTime,
      warningThreshold,
      shouldWarn: remainingTime <= warningThreshold && remainingTime > 0,
      remainingTime,
    };

    // Add timeout headers
    res.setHeader('X-Session-ID', req.sessionId);
    res.setHeader('X-Session-Expires', req.sessionTimeout.expiresAt);
    res.setHeader('X-Session-Remaining', Math.round(remainingTime / 1000)); // seconds

    next();
  } catch (error) {
    console.error('Session timeout middleware error:', error);
    next();
  }
}

/**
 * Extend session endpoint
 * Allows users to extend their session before timeout
 */
export async function extendSessionHandler(req: Request, res: Response): Promise<void> {
  if (!req.user?.userId || !req.sessionId) {
    res.status(401).json({ error: 'No active session' });
    return;
  }

  try {
    const success = globalSessionManager.extendSession(req.sessionId);

    if (!success) {
      res.status(401).json({
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND',
        requireReauth: true,
      });
      return;
    }

    const session = globalSessionManager.getSession(req.sessionId);
    const config = globalSessionManager.getTimeoutConfig(req.user.userType || 'client');
    const remainingTime = globalSessionManager.getRemainingTime(req.sessionId);

    res.json({
      success: true,
      message: 'Session extended',
      sessionId: req.sessionId,
      expiresAt: Date.now() + remainingTime,
      remainingTime,
      extendedDuration: config.extendSessionDuration,
    });
  } catch (error) {
    console.error('Error extending session:', error);
    res.status(500).json({ error: 'Failed to extend session' });
  }
}

/**
 * Logout endpoint
 * Manually logs out user and logs the event
 */
export async function logoutHandler(req: Request, res: Response): Promise<void> {
  if (!req.user?.userId || !req.sessionId) {
    res.status(401).json({ error: 'No active session' });
    return;
  }

  try {
    const session = globalSessionManager.getSession(req.sessionId);
    const ipAddress = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    if (session) {
      await logLogout(
        session.userId,
        req.sessionId,
        'manual',
        ipAddress,
        userAgent
      );
    }

    globalSessionManager.destroySession(req.sessionId);

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
}

/**
 * Session status endpoint
 * Returns current session information and timeout details
 */
export function sessionStatusHandler(req: Request, res: Response): void {
  if (!req.user?.userId || !req.sessionId) {
    res.status(401).json({ error: 'No active session' });
    return;
  }

  try {
    const session = globalSessionManager.getSession(req.sessionId);
    const config = globalSessionManager.getTimeoutConfig(req.user.userType || 'client');
    const remainingTime = globalSessionManager.getRemainingTime(req.sessionId);

    res.json({
      sessionId: req.sessionId,
      userId: req.user.userId,
      userType: req.user.userType,
      createdAt: session?.createdAt,
      lastActivityAt: session?.lastActivityAt,
      expiresAt: Date.now() + remainingTime,
      remainingTime,
      warningThreshold: config.warningTime,
      shouldWarn: remainingTime <= config.warningTime && remainingTime > 0,
      config: {
        inactivityTimeout: config.inactivityTimeout,
        warningTime: config.warningTime,
        extendSessionDuration: config.extendSessionDuration,
      },
    });
  } catch (error) {
    console.error('Error getting session status:', error);
    res.status(500).json({ error: 'Failed to get session status' });
  }
}

/**
 * Get all active sessions for current user
 */
export function getUserSessionsHandler(req: Request, res: Response): void {
  if (!req.user?.userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const sessions = globalSessionManager.getUserSessions(req.user.userId);
    const sessionInfo = sessions.map(session => ({
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      lastActivityAt: session.lastActivityAt,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      remainingTime: globalSessionManager.getRemainingTime(session.sessionId),
      isExpired: globalSessionManager.isSessionExpired(session.sessionId),
    }));

    res.json({
      userId: req.user.userId,
      activeSessions: sessionInfo.length,
      sessions: sessionInfo,
    });
  } catch (error) {
    console.error('Error getting user sessions:', error);
    res.status(500).json({ error: 'Failed to get user sessions' });
  }
}

/**
 * Revoke all sessions for current user (except current)
 */
export async function revokeAllSessionsHandler(req: Request, res: Response): Promise<void> {
  if (!req.user?.userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const sessions = globalSessionManager.getUserSessions(req.user.userId);
    const ipAddress = req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';

    for (const session of sessions) {
      if (session.sessionId !== req.sessionId) {
        await logLogout(
          session.userId,
          session.sessionId,
          'forced',
          ipAddress,
          userAgent
        );
        globalSessionManager.destroySession(session.sessionId);
      }
    }

    res.json({
      success: true,
      message: 'All other sessions revoked',
      revokedCount: sessions.length - 1,
    });
  } catch (error) {
    console.error('Error revoking sessions:', error);
    res.status(500).json({ error: 'Failed to revoke sessions' });
  }
}

// ============================================
// EXPORTS
// ============================================

export {
  SessionManager,
  globalSessionManager,
  DEFAULT_TIMEOUT_CONFIG,
  ROLE_TIMEOUT_CONFIGS,
};

export default {
  sessionTimeoutMiddleware,
  extendSessionHandler,
  logoutHandler,
  sessionStatusHandler,
  getUserSessionsHandler,
  revokeAllSessionsHandler,
  SessionManager,
  globalSessionManager,
};
