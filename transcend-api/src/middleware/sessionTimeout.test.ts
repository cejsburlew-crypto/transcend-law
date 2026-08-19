// Session Timeout Middleware Tests

import { Request, Response, NextFunction } from 'express';
import {
  SessionManager,
  sessionTimeoutMiddleware,
  extendSessionHandler,
  logoutHandler,
  sessionStatusHandler,
  getUserSessionsHandler,
  revokeAllSessionsHandler,
  DEFAULT_TIMEOUT_CONFIG,
  ROLE_TIMEOUT_CONFIGS,
} from './sessionTimeout';

// Mock request/response objects
const createMockRequest = (overrides?: Partial<Request>): Request => ({
  user: {
    userId: 'test-user-123',
    email: 'test@example.com',
    userType: 'client',
  },
  sessionId: undefined,
  headers: {
    authorization: 'Bearer test-token',
  },
  ip: '192.168.1.1',
  path: '/api/test',
  ...overrides,
} as any);

const createMockResponse = (): Response => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  setHeader: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
} as any);

const createMockNext = (): NextFunction => jest.fn();

// ============================================
// TESTS
// ============================================

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
  });

  afterEach(() => {
    sessionManager.destroy();
  });

  describe('Session Creation', () => {
    it('should create a new session', () => {
      const session = sessionManager.createSession(
        'user-123',
        'client',
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(session).toHaveProperty('sessionId');
      expect(session.userId).toBe('user-123');
      expect(session.userType).toBe('client');
      expect(session.ipAddress).toBe('192.168.1.1');
      expect(session.userAgent).toBe('Mozilla/5.0');
      expect(session.warningNotified).toBe(false);
    });

    it('should generate unique session IDs', () => {
      const session1 = sessionManager.createSession('user-123', 'client', '192.168.1.1', 'UA');
      const session2 = sessionManager.createSession('user-123', 'client', '192.168.1.1', 'UA');

      expect(session1.sessionId).not.toBe(session2.sessionId);
    });
  });

  describe('Session Retrieval', () => {
    it('should retrieve an existing session', () => {
      const created = sessionManager.createSession('user-123', 'client', '192.168.1.1', 'UA');
      const retrieved = sessionManager.getSession(created.sessionId);

      expect(retrieved).toEqual(created);
    });

    it('should return undefined for non-existent session', () => {
      const retrieved = sessionManager.getSession('non-existent-id');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('Activity Tracking', () => {
    it('should update last activity time', () => {
      const session = sessionManager.createSession('user-123', 'client', '192.168.1.1', 'UA');
      const originalTime = session.lastActivityAt;

      // Wait a bit and update activity
      jest.useFakeTimers();
      jest.advanceTimersByTime(1000);
      sessionManager.updateActivity(session.sessionId);

      const updated = sessionManager.getSession(session.sessionId)!;
      expect(updated.lastActivityAt).toBeGreaterThan(originalTime);

      jest.useRealTimers();
    });

    it('should reset warning notification on activity update', () => {
      const session = sessionManager.createSession('user-123', 'client', '192.168.1.1', 'UA');
      session.warningNotified = true;

      sessionManager.updateActivity(session.sessionId);

      const updated = sessionManager.getSession(session.sessionId)!;
      expect(updated.warningNotified).toBe(false);
    });
  });

  describe('Session Expiration', () => {
    it('should detect expired session', () => {
      jest.useFakeTimers();

      const session = sessionManager.createSession('user-123', 'client', '192.168.1.1', 'UA');
      expect(sessionManager.isSessionExpired(session.sessionId)).toBe(false);

      // Advance time past inactivity timeout
      const config = sessionManager.getTimeoutConfig('client');
      jest.advanceTimersByTime(config.inactivityTimeout + 1000);

      expect(sessionManager.isSessionExpired(session.sessionId)).toBe(true);

      jest.useRealTimers();
    });

    it('should not expire session with recent activity', () => {
      jest.useFakeTimers();

      const session = sessionManager.createSession('user-123', 'client', '192.168.1.1', 'UA');

      // Advance time and update activity
      jest.advanceTimersByTime(5 * 60 * 1000); // 5 minutes
      sessionManager.updateActivity(session.sessionId);

      // Should not be expired yet (config is 15 minutes)
      expect(sessionManager.isSessionExpired(session.sessionId)).toBe(false);

      jest.useRealTimers();
    });

    it('should return 0 for non-existent session', () => {
      const isExpired = sessionManager.isSessionExpired('non-existent-id');
      expect(isExpired).toBe(true); // Non-existent sessions are considered expired
    });
  });

  describe('Warning System', () => {
    it('should detect when warning should be shown', () => {
      jest.useFakeTimers();

      const session = sessionManager.createSession('user-123', 'client', '192.168.1.1', 'UA');
      const config = sessionManager.getTimeoutConfig('client');

      // Advance to warning threshold
      jest.advanceTimersByTime(config.inactivityTimeout - config.warningTime + 1000);

      expect(sessionManager.shouldShowWarning(session.sessionId)).toBe(true);

      jest.useRealTimers();
    });

    it('should not show warning multiple times', () => {
      jest.useFakeTimers();

      const session = sessionManager.createSession('user-123', 'client', '192.168.1.1', 'UA');
      const config = sessionManager.getTimeoutConfig('client');

      jest.advanceTimersByTime(config.inactivityTimeout - config.warningTime + 1000);

      expect(sessionManager.shouldShowWarning(session.sessionId)).toBe(true);

      sessionManager.markWarningShown(session.sessionId);

      expect(sessionManager.shouldShowWarning(session.sessionId)).toBe(false);

      jest.useRealTimers();
    });

    it('should not show warning if activity is too recent', () => {
      const session = sessionManager.createSession('user-123', 'client', '192.168.1.1', 'UA');
      expect(sessionManager.shouldShowWarning(session.sessionId)).toBe(false);
    });
  });

  describe('Session Extension', () => {
    it('should extend session', () => {
      jest.useFakeTimers();

      const session = sessionManager.createSession('user-123', 'client', '192.168.1.1', 'UA');
      const originalLastActivity = session.lastActivityAt;

      jest.advanceTimersByTime(1000);
      const success = sessionManager.extendSession(session.sessionId);

      expect(success).toBe(true);

      const updated = sessionManager.getSession(session.sessionId)!;
      expect(updated.lastActivityAt).toBeGreaterThan(originalLastActivity);

      jest.useRealTimers();
    });

    it('should return false for non-existent session', () => {
      const success = sessionManager.extendSession('non-existent-id');
      expect(success).toBe(false);
    });

    it('should reset warning on extend', () => {
      const session = sessionManager.createSession('user-123', 'client', '192.168.1.1', 'UA');
      session.warningNotified = true;

      sessionManager.extendSession(session.sessionId);

      const updated = sessionManager.getSession(session.sessionId)!;
      expect(updated.warningNotified).toBe(false);
    });
  });

  describe('Session Destruction', () => {
    it('should destroy session', () => {
      const session = sessionManager.createSession('user-123', 'client', '192.168.1.1', 'UA');
      expect(sessionManager.getSession(session.sessionId)).toBeDefined();

      sessionManager.destroySession(session.sessionId);

      expect(sessionManager.getSession(session.sessionId)).toBeUndefined();
    });
  });

  describe('Remaining Time', () => {
    it('should calculate remaining time correctly', () => {
      jest.useFakeTimers();

      const session = sessionManager.createSession('user-123', 'client', '192.168.1.1', 'UA');
      const config = sessionManager.getTimeoutConfig('client');

      jest.advanceTimersByTime(5 * 60 * 1000); // 5 minutes

      const remaining = sessionManager.getRemainingTime(session.sessionId);
      expect(remaining).toBeLessThanOrEqual(config.inactivityTimeout);
      expect(remaining).toBeGreaterThan(9 * 60 * 1000); // At least 9 minutes

      jest.useRealTimers();
    });

    it('should return 0 for expired session', () => {
      jest.useFakeTimers();

      const session = sessionManager.createSession('user-123', 'client', '192.168.1.1', 'UA');
      const config = sessionManager.getTimeoutConfig('client');

      jest.advanceTimersByTime(config.inactivityTimeout + 1000);

      const remaining = sessionManager.getRemainingTime(session.sessionId);
      expect(remaining).toBe(0);

      jest.useRealTimers();
    });
  });

  describe('User Sessions', () => {
    it('should get all sessions for a user', () => {
      const session1 = sessionManager.createSession('user-123', 'client', '192.168.1.1', 'UA');
      const session2 = sessionManager.createSession('user-123', 'client', '192.168.1.2', 'UA');
      const session3 = sessionManager.createSession('user-456', 'attorney', '192.168.1.3', 'UA');

      const userSessions = sessionManager.getUserSessions('user-123');

      expect(userSessions).toHaveLength(2);
      expect(userSessions.map(s => s.sessionId)).toContain(session1.sessionId);
      expect(userSessions.map(s => s.sessionId)).toContain(session2.sessionId);
    });

    it('should revoke all user sessions', () => {
      const session1 = sessionManager.createSession('user-123', 'client', '192.168.1.1', 'UA');
      const session2 = sessionManager.createSession('user-123', 'client', '192.168.1.2', 'UA');

      sessionManager.revokeUserSessions('user-123');

      expect(sessionManager.getSession(session1.sessionId)).toBeUndefined();
      expect(sessionManager.getSession(session2.sessionId)).toBeUndefined();
    });
  });

  describe('Timeout Configuration', () => {
    it('should return correct config for client', () => {
      const config = sessionManager.getTimeoutConfig('client');
      expect(config.inactivityTimeout).toBe(15 * 60 * 1000);
      expect(config.warningTime).toBe(5 * 60 * 1000);
    });

    it('should return correct config for attorney', () => {
      const config = sessionManager.getTimeoutConfig('attorney');
      expect(config.inactivityTimeout).toBe(30 * 60 * 1000);
    });

    it('should return default config for unknown role', () => {
      const config = sessionManager.getTimeoutConfig('unknown-role');
      expect(config.inactivityTimeout).toBe(DEFAULT_TIMEOUT_CONFIG.inactivityTimeout);
    });
  });
});

describe('Session Timeout Middleware', () => {
  let req: Request;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    req = createMockRequest();
    res = createMockResponse();
    next = createMockNext();
  });

  it('should skip public endpoints', () => {
    Object.defineProperty(req, 'path', { value: '/health', configurable: true });
    sessionTimeoutMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should create session if not exists', () => {
    sessionTimeoutMiddleware(req, res, next);

    expect(req.sessionId).toBeDefined();
    expect(next).toHaveBeenCalled();
  });

  it('should add timeout info to request', () => {
    sessionTimeoutMiddleware(req, res, next);

    expect(req.sessionTimeout).toBeDefined();
    expect(req.sessionTimeout?.expiresAt).toBeGreaterThan(Date.now());
    expect(req.sessionTimeout?.remainingTime).toBeGreaterThan(0);
  });

  it('should set session headers', () => {
    sessionTimeoutMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Session-ID',
      expect.any(String)
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-Session-Expires',
      expect.any(Number)
    );
  });
});

describe('Session Handlers', () => {
  let req: Request;
  let res: Response;

  beforeEach(() => {
    req = createMockRequest();
    res = createMockResponse();
  });

  describe('Session Status Handler', () => {
    it('should return 401 if no session', () => {
      req.sessionId = undefined;
      (req.user as any).userId = undefined;

      sessionStatusHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return session info', () => {
      const sessionId = 'test-session-123';
      req.sessionId = sessionId;

      // Create a session first
      const manager = require('./sessionTimeout').globalSessionManager;
      manager.createSession('user-123', 'client', '192.168.1.1', 'UA');
      req.sessionId = manager.getUserSessions('user-123')[0].sessionId;

      sessionStatusHandler(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: expect.any(String),
          userId: 'user-123',
          userType: 'client',
        })
      );
    });
  });

  describe('User Sessions Handler', () => {
    it('should return 401 if not authenticated', () => {
      req.user = undefined;

      getUserSessionsHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
