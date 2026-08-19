// Path shim: '../middleware/validation' -> the real validation middleware.

import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

export * from '../src/middleware/validationMiddleware';

/**
 * Generic express-validator result check. `validateInput` was imported by
 * affiliateRoutes but never existed, so that router did not compile.
 */
export function validateInput(req: Request, res: Response, next: NextFunction) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: result.array() });
  }
  return next();
}
