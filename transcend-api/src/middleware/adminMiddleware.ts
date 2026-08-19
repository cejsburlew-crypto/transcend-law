// Path shim for modules under src/. The admin guard fails closed.
export { adminMiddleware, adminMiddleware as default, authorizeAdmin } from '../../middleware/auth';
