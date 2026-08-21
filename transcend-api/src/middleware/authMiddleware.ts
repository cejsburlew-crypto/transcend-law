// Authentication Middleware
// JWT verification and request authentication

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JWTPayload } from '../services/authService';

/**
 * The authenticated user as attached to the request.
 *
 * `id` is a runtime alias for `userId`: route code across the codebase reads
 * `req.user.id`, so it is set here rather than patched at 20+ call sites.
 */
export type AuthenticatedUser = JWTPayload & {
  /** Runtime alias for `userId` - route code reads `req.user.id`. */
  id: string;
  /** Runtime alias for `userType` - route code reads `req.user.role`. */
  role: string;
  /**
   * Derived from userType. Currently always false: the users table constrains
   * user_type to ('client','attorney','firm'), so no account can be an admin
   * until that role is added deliberately. Fails closed.
   */
  isAdmin: boolean;
  /**
   * Whether the account has completed identity verification. The access token
   * carries no such claim today, so this is false until one is added - callers
   * treating it as a gate therefore fail closed.
   */
  isVerified: boolean;
};

/** Build the request-scoped user, including the derived aliases above. */
const toAuthenticatedUser = (payload: JWTPayload): AuthenticatedUser => ({
  ...payload,
  id: payload.userId,
  role: payload.userType,
  isAdmin: payload.userType === 'admin',
  isVerified: false,
});

declare global {
  // Express type augmentation requires a namespace; no alternative exists.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      userId?: string;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);
  const payload = verifyAccessToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.user = toAuthenticatedUser(payload);
  req.userId = payload.userId;
  next();
}

export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);

    if (payload) {
      req.user = toAuthenticatedUser(payload);
      req.userId = payload.userId;
    }
  }

  next();
}

export function requireUserType(...userTypes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!userTypes.includes(req.user.userType)) {
      return res.status(403).json({
        error: `This action requires one of: ${userTypes.join(', ')}`
      });
    }

    next();
  };
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  res.header('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
}

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  // Placeholder for rate limiting
  // In production, use package like 'express-rate-limit'
  next();
}

/**
 * The authenticated caller's id, narrowed to `string`.
 *
 * Routes behind authMiddleware always have this set, but the Request type
 * cannot express that across the middleware boundary. Throwing here (rather
 * than asserting with `!`) means a route accidentally mounted without auth
 * fails loudly instead of passing `undefined` into a query.
 */
export function requireUserId(req: { userId?: string; user?: { id: string } }): string {
  const id = req.userId ?? req.user?.id;
  if (!id) {
    throw new Error('requireUserId called on an unauthenticated request');
  }
  return id;
}
