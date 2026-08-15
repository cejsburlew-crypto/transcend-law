// Input Validation Middleware
// Protects against injection attacks and malformed input

import { body, param, query, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

// Validation error handler
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
      })),
    });
  }
  next();
};

// Email validation
const emailValidator = body('email')
  .trim()
  .isEmail()
  .normalizeEmail()
  .withMessage('Invalid email format');

// Password validation
const passwordValidator = body('password')
  .isLength({ min: 12 })
  .withMessage('Password must be at least 12 characters')
  .matches(/[A-Z]/)
  .withMessage('Password must contain uppercase letter')
  .matches(/[a-z]/)
  .withMessage('Password must contain lowercase letter')
  .matches(/[0-9]/)
  .withMessage('Password must contain number')
  .matches(/[!@#$%^&*]/)
  .withMessage('Password must contain special character (!@#$%^&*)');

// Auth validation chains
export const validateSignup = [
  emailValidator,
  passwordValidator,
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),
  body('userType')
    .isIn(['client', 'attorney', 'firm'])
    .withMessage('Invalid user type'),
  handleValidationErrors,
];

export const validateLogin = [
  emailValidator,
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors,
];

// Case validation chain
export const validateCase = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage('Title must be between 5 and 100 characters')
    .escape(),
  body('description')
    .trim()
    .isLength({ min: 20, max: 5000 })
    .withMessage('Description must be between 20 and 5000 characters')
    .escape(),
  body('serviceType')
    .isIn(['trademark', 'patent', 'copyright', 'contract', 'litigation', 'corporate'])
    .withMessage('Invalid service type'),
  body('budget')
    .isInt({ min: 100, max: 1000000 })
    .withMessage('Budget must be between $100 and $1,000,000'),
  body('urgency')
    .isIn(['low', 'medium', 'high'])
    .withMessage('Invalid urgency level'),
  body('location')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Invalid location')
    .escape(),
  handleValidationErrors,
];

// Payment validation chain
export const validatePayment = [
  body('planId')
    .isIn(['basic', 'professional', 'enterprise'])
    .withMessage('Invalid plan'),
  body('cardNumber')
    .isCreditCard()
    .withMessage('Invalid credit card number'),
  body('expirationDate')
    .matches(/^(0[1-9]|1[0-2])\/\d{2}$/)
    .withMessage('Expiration date must be MM/YY'),
  body('cvc')
    .matches(/^\d{3,4}$/)
    .withMessage('CVC must be 3-4 digits'),
  body('billingName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Invalid billing name')
    .escape(),
  body('billingAddress')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Invalid address')
    .escape(),
  handleValidationErrors,
];

// Document upload validation
export const validateDocumentUpload = [
  param('caseId')
    .isUUID()
    .withMessage('Invalid case ID'),
  handleValidationErrors,
];

// Message validation
export const validateMessage = [
  body('conversationId')
    .isUUID()
    .withMessage('Invalid conversation ID'),
  body('content')
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage('Message must be between 1 and 5000 characters')
    .escape(),
  handleValidationErrors,
];

// Firm validation
export const validateFirmUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Firm name must be between 2 and 100 characters')
    .escape(),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Bio must be under 5000 characters')
    .escape(),
  body('website')
    .optional()
    .isURL()
    .withMessage('Invalid website URL'),
  body('phone')
    .optional()
    .isMobilePhone('en-US')
    .withMessage('Invalid phone number'),
  handleValidationErrors,
];

// Password reset validation
export const validatePasswordReset = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format'),
  handleValidationErrors,
];

export const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  passwordValidator,
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),
  handleValidationErrors,
];

// Query validation for list endpoints
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 100000 })
    .withMessage('Invalid page number'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sort')
    .optional()
    .isIn(['created_at', 'updated_at', 'name', 'rating'])
    .withMessage('Invalid sort field'),
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
  handleValidationErrors,
];

export default {
  validateSignup,
  validateLogin,
  validateCase,
  validatePayment,
  validateDocumentUpload,
  validateMessage,
  validateFirmUpdate,
  validatePasswordReset,
  validatePasswordChange,
  validatePagination,
  handleValidationErrors,
};
