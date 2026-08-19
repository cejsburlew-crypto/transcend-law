// Path shim: '../middleware/rateLimiting' -> the real rate-limit middleware.

import rateLimit from 'express-rate-limit';

export * from '../src/middleware/rateLimitMiddleware';

/**
 * Affiliate endpoints limiter. `rateLimitAffiliate` was imported by
 * affiliateRoutes but never existed, so that router did not compile - meaning
 * these endpoints had no rate limiting at all.
 */
export const rateLimitAffiliate = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many affiliate requests, please try again later.' },
});
