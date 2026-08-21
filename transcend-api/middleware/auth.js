"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAdmin = exports.requireRole = exports.authorize = exports.optionalAuthenticate = exports.authMiddleware = exports.authenticateJWT = exports.authenticateUser = exports.authenticateToken = exports.authenticate = void 0;
exports.adminMiddleware = adminMiddleware;
exports.adminAuthMiddleware = adminMiddleware;
exports.authorizeAdmin = adminMiddleware;
const authMiddleware_1 = require("../src/middleware/authMiddleware");
Object.defineProperty(exports, "authenticate", { enumerable: true, get: function () { return authMiddleware_1.authMiddleware; } });
Object.defineProperty(exports, "authenticateToken", { enumerable: true, get: function () { return authMiddleware_1.authMiddleware; } });
Object.defineProperty(exports, "authenticateUser", { enumerable: true, get: function () { return authMiddleware_1.authMiddleware; } });
Object.defineProperty(exports, "authenticateJWT", { enumerable: true, get: function () { return authMiddleware_1.authMiddleware; } });
Object.defineProperty(exports, "authMiddleware", { enumerable: true, get: function () { return authMiddleware_1.authMiddleware; } });
Object.defineProperty(exports, "optionalAuthenticate", { enumerable: true, get: function () { return authMiddleware_1.optionalAuthMiddleware; } });
/**
 * Role guard accepting either varargs or an array.
 *
 * `requireUserType` is variadic, but call sites use both
 * `authorize('attorney', 'admin')` and `authorize(['attorney', 'admin'])`.
 * Flattening accepts both rather than failing on the array form.
 */
const authorize = (...roles) => (0, authMiddleware_1.requireUserType)(...roles.flat());
exports.authorize = authorize;
/** Same flattening as `authorize`; several routers use this name instead. */
exports.requireRole = exports.authorize;
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
function adminMiddleware(req, res, next) {
    (0, authMiddleware_1.authMiddleware)(req, res, () => {
        if (req.user?.userType !== 'admin') {
            return res.status(403).json({
                error: 'Administrator access required',
            });
        }
        return next();
    });
}
/** Alias for the fail-closed admin guard, used as `isAdmin` by some routers. */
exports.isAdmin = adminMiddleware;
