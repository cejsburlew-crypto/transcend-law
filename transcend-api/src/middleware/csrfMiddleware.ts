// CSRF Protection Middleware
// Cross-Site Request Forgery prevention

import { randomBytes } from 'crypto';
import { Request, Response, NextFunction } from 'express';

interface SessionWithCSRF {
  csrfToken?: string;
  [key: string]: any;
}

// Generate CSRF token
export const generateCSRFToken = (): string => {
  return randomBytes(32).toString('hex');
};

// CSRF token middleware
export const csrfTokenMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const session = req.session as SessionWithCSRF;

  // Generate new token if not exists
  if (!session.csrfToken) {
    session.csrfToken = generateCSRFToken();
  }

  // Add token to response locals for templates
  res.locals.csrfToken = session.csrfToken;

  // Expose token via endpoint for JS apps
  if (req.path === '/api/v2/csrf-token') {
    return res.json({ csrfToken: session.csrfToken });
  }

  next();
};

// CSRF verification middleware
export const verifyCsrfToken = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF check for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const session = req.session as SessionWithCSRF;
  const token = req.body._csrf || req.headers['x-csrf-token'];

  if (!session.csrfToken) {
    return res.status(403).json({
      error: 'CSRF validation failed',
      message: 'No session token found',
    });
  }

  if (!token) {
    return res.status(403).json({
      error: 'CSRF validation failed',
      message: 'Missing CSRF token',
    });
  }

  // Constant time comparison to prevent timing attacks
  const isValid = timingSafeEqual(
    Buffer.from(token, 'hex'),
    Buffer.from(session.csrfToken, 'hex')
  );

  if (!isValid) {
    console.warn('[CSRF] Invalid token for user:', req.user?.id);
    return res.status(403).json({
      error: 'CSRF validation failed',
      message: 'Invalid CSRF token',
    });
  }

  next();
};

// Constant-time string comparison
function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }

  return result === 0;
}

export default {
  generateCSRFToken,
  csrfTokenMiddleware,
  verifyCsrfToken,
};
