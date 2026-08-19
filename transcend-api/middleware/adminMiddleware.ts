// Path shim. The admin guard fails closed - see middleware/auth.ts.
export { adminMiddleware, adminMiddleware as default, authorizeAdmin } from './auth';
