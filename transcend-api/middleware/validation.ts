// Path shim + schema validator for modules outside src/.
//
// `validateInput` was imported by affiliateRoutes but never existed, so that
// router failed to compile - meaning its request bodies were never validated at
// all. Implemented here as the schema-based factory the call sites expect.

import { Request, Response, NextFunction } from 'express';

export * from '../src/middleware/validationMiddleware';

/**
 * Field type vocabulary used by the call sites. A trailing `?` marks the field
 * optional; anything else is required.
 */
export type FieldType =
  | 'string' | 'string?'
  | 'number' | 'number?'
  | 'boolean' | 'boolean?'
  | 'email' | 'email?'
  | 'uuid' | 'uuid?'
  | 'object' | 'object?'
  | 'array' | 'array?';

export type ValidationSchema = Record<string, FieldType | string>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const checkField = (value: unknown, kind: string): string | null => {
  switch (kind) {
    case 'string':
      return typeof value === 'string' && value.trim() !== '' ? null : 'must be a non-empty string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? null : 'must be a number';
    case 'boolean':
      return typeof value === 'boolean' ? null : 'must be a boolean';
    case 'email':
      return typeof value === 'string' && EMAIL.test(value) ? null : 'must be a valid email address';
    case 'uuid':
      return typeof value === 'string' && UUID.test(value) ? null : 'must be a valid UUID';
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? null
        : 'must be an object';
    case 'array':
      return Array.isArray(value) ? null : 'must be an array';
    default:
      // Unknown type in a schema is a programming error, not a request error.
      console.warn(`[validation] unknown field type '${kind}' - field not validated`);
      return null;
  }
};

/**
 * Validate `req.body` against a field schema.
 *
 *   validateInput({ companyName: 'string', email: 'email', notes: 'string?' })
 *
 * Rejects with 400 and every failing field, rather than the first.
 */
export function validateInput(schema: ValidationSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: Record<string, string> = {};

    for (const [field, rawKind] of Object.entries(schema)) {
      const optional = rawKind.endsWith('?');
      const kind = optional ? rawKind.slice(0, -1) : rawKind;
      const value = (req.body ?? {})[field];

      if (value === undefined || value === null) {
        if (!optional) errors[field] = 'is required';
        continue;
      }

      const problem = checkField(value, kind);
      if (problem) errors[field] = problem;
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ error: 'Validation failed', fields: errors });
    }

    return next();
  };
}
