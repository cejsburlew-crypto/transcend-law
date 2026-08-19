// Auth adapter.
//
// Route modules across this codebase import auth from '../middleware/auth'
// under a dozen different names - authenticate, authenticateToken,
// authenticateUser, authenticateJWT, authMiddleware - none of which existed.
// Every one of those imports failed to resolve, which means those routers did
// not compile and their endpoints ran with NO authentication wired up.
//
// Rather than leave twenty half-broken auth paths, this maps them all onto the
// single real implementation in src/middleware/authMiddleware.ts.

import { Request, Response, NextFunction } from 'express';
import {
  authMiddleware as realAuth,
  optionalAuthMiddleware,
  requireUserType,
} from '../src/middleware/authMiddleware';

export {
  realAuth as authenticate,
  realAuth as authenticateToken,
  realAuth as authenticateUser,
  realAuth as authenticateJWT,
  realAuth as authMiddleware,
  optionalAuthMiddleware as optionalAuthenticate,
};

/**
 * Role guard accepting either varargs or an array.
 *
 * `requireUserType` is variadic, but call sites use both
 * `authorize('attorney', 'admin')` and `authorize(['attorney', 'admin'])`.
 * Flattening accepts both rather than failing on the array form.
 */
export const authorize = (...roles: Array<string | string[]>) =>
  requireUserType(...roles.flat());

/** Same flattening as `authorize`; several routers use this name instead. */
export const requireRole = authorize;

export type { AuthenticatedUser } from '../src/middleware/authMiddleware';

/**
 * Admin guard.
 *
 * FAILS CLOSED BY DESIGN. The users table constrains user_type to
 * ('client', 'attorney', 'firm') - there is no admin role yet, so no account can
 * satisfy this check and every admin endpoint returns 403. That is the correct
 * default for an authorisation gate whose role model does not exist: the
 * alternative is a guard that silently admits everyone.
 *
 * To enable: add 'admin' to the user_type CHECK constraint and grant it
 * deliberately, then this starts working with no code change.
 */
export function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  realAuth(req, res, () => {
    if (req.user?.userType !== ('admin' as any)) {
      return res.status(403).json({
        error: 'Administrator access required',
      });
    }
    return next();
  });
}

export { adminMiddleware as adminAuthMiddleware, adminMiddleware as authorizeAdmin };
