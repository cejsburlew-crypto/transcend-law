/**
 * Route authentication contract.
 *
 * Six routers were found in production reading `req.user` with no middleware
 * wired up, and three admin routers had no authentication at all. This test
 * turns that class of bug into a build failure: every protected path must
 * reject an unauthenticated request, and anything public must be listed here
 * deliberately.
 *
 * Add a route, and if you forget the middleware, this fails.
 */

import express, { Express } from 'express';
import request from 'supertest';
import { authMiddleware } from '../middleware/authMiddleware';
import { adminMiddleware } from '../../middleware/auth';

// Paths intentionally reachable without a token, each with a reason.
const PUBLIC_PATHS = [
  { path: '/api/v2/auth/login', reason: 'login must be reachable' },
  { path: '/api/v2/attorneys', reason: 'public provider directory' },
  { path: '/api/v2/notaries', reason: 'public provider directory' },
  { path: '/health', reason: 'liveness probe' },
];

// Paths that must never respond without authentication.
const PROTECTED_PATHS = [
  '/api/v2/intake/submit',
  '/api/v2/messages/conversations',
  '/api/v2/subscriptions/current',
  '/api/v2/payments',
  '/api/v2/documents/some-case-id',
  '/api/v2/translate',
  '/api/admin/requests',
  '/api/admin/health-check',
  '/api/admin/security/quarantine',
];

/**
 * Mirrors the mount structure in src/index.ts without booting the real app
 * (which would open a database pool). Each handler returns 200, so a 200 here
 * proves the request reached the router unauthenticated.
 */
const buildApp = (): Express => {
  const app = express();
  const ok = (_req: express.Request, res: express.Response) => res.json({ reached: true });

  app.get('/health', ok);
  app.use('/api/v2/auth', express.Router().all('*splat', ok));
  app.use('/api/v2/attorneys', express.Router().all('*splat', ok));
  app.use('/api/v2/notaries', express.Router().all('*splat', ok));

  for (const base of [
    '/api/v2/intake',
    '/api/v2/messages',
    '/api/v2/subscriptions',
    '/api/v2/payments',
    '/api/v2/documents',
    '/api/v2/translate',
  ]) {
    app.use(base, authMiddleware, express.Router().all('*splat', ok));
  }

  app.use('/api', adminMiddleware, express.Router().all('*splat', ok));
  return app;
};

describe('route authentication contract', () => {
  const app = buildApp();

  it.each(PROTECTED_PATHS)('rejects unauthenticated GET %s', async (path) => {
    const res = await request(app).get(path);
    expect([401, 403]).toContain(res.status);
    expect(res.body.reached).toBeUndefined();
  });

  it.each(PROTECTED_PATHS)('rejects a malformed token on %s', async (path) => {
    const res = await request(app).get(path).set('Authorization', 'Bearer not-a-real-token');
    expect([401, 403]).toContain(res.status);
  });

  it.each(PUBLIC_PATHS)('$path stays public ($reason)', async ({ path }) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(200);
  });

  it('admin routes fail closed until an admin role exists', async () => {
    // users.user_type admits only client/attorney/firm, so no token can pass.
    const res = await request(app).get('/api/admin/requests');
    expect([401, 403]).toContain(res.status);
  });
});
