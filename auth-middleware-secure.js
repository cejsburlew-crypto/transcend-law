// TRANSCEND LAW - SECURE AUTHENTICATION MIDDLEWARE
// Blocks all public access. Only default admin can login during setup phase.

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const router = express.Router();

// ============================================================================
// SECURE LOGIN - ONLY DEFAULT ADMIN ALLOWED
// ============================================================================

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // ONLY allow hardcoded default admin
    const DEFAULT_EMAIL = 'cejsburlew@gmail.com';
    const DEFAULT_PASSWORD = '$Colombia';

    if (email !== DEFAULT_EMAIL) {
      // Log unauthorized login attempt
      console.error(`[SECURITY] Unauthorized login attempt: ${email}`);
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Access restricted during setup phase'
      });
    }

    if (password !== DEFAULT_PASSWORD) {
      console.error(`[SECURITY] Invalid password attempt for: ${email}`);
      return res.status(401).json({
        error: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        email: DEFAULT_EMAIL,
        role: 'SUPER_ADMIN',
        authorized_at: new Date().toISOString()
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRY }
    );

    console.log(`[AUTH] Successful login: ${DEFAULT_EMAIL} at ${new Date().toISOString()}`);

    res.json({
      success: true,
      token,
      user: {
        email: DEFAULT_EMAIL,
        role: 'SUPER_ADMIN'
      },
      message: 'Welcome to TRANSCEND LAW (Setup Mode)'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Authentication service error' });
  }
});

// ============================================================================
// VERIFY TOKEN MIDDLEWARE - BLOCK ALL NON-ADMIN
// ============================================================================

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'No token provided',
      message: 'Login required. Access restricted during setup phase.'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ONLY allow default admin
    if (decoded.email !== 'cejsburlew@gmail.com') {
      console.error(`[SECURITY] Invalid token used for: ${decoded.email}`);
      return res.status(403).json({ error: 'Access denied' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error('[SECURITY] Token verification failed:', error.message);
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// ============================================================================
// BLOCK ALL PUBLIC ENDPOINTS - REDIRECT TO LOGIN
// ============================================================================

const blockPublicAccess = (req, res) => {
  res.status(403).json({
    error: 'Access Restricted',
    message: 'TRANSCEND LAW is in setup mode. Only authorized admin can access.',
    action: 'Please login with credentials at /api/auth/login'
  });
};

// ============================================================================
// SECURITY HEADERS MIDDLEWARE
// ============================================================================

const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Prevent information disclosure
  res.setHeader('X-Powered-By', '');
  res.setHeader('Server', 'TRANSCEND');

  // Content Security Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'");

  // Strict Transport Security
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Referrer Policy
  res.setHeader('Referrer-Policy', 'no-referrer');

  next();
};

// ============================================================================
// SOURCE CODE PROTECTION - NO CODE EXPOSURE
// ============================================================================

const protectSourceCode = (req, res, next) => {
  const blockedPaths = [
    '.env',
    '.git',
    'node_modules',
    '.js',
    '.sql',
    'config',
    'secrets',
    '.key',
    '.pem',
    'password',
    'credentials'
  ];

  const path = req.path.toLowerCase();

  if (blockedPaths.some(blocked => path.includes(blocked))) {
    console.error(`[SECURITY] Blocked access attempt to: ${req.path}`);
    return res.status(403).json({ error: 'Access denied' });
  }

  next();
};

// ============================================================================
// AUDIT LOGGING - TRACK ALL REQUESTS
// ============================================================================

const auditLog = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ip: req.ip,
      user: req.user?.email || 'UNAUTHENTICATED',
      duration_ms: duration
    };

    if (res.statusCode >= 400) {
      console.warn('[AUDIT]', JSON.stringify(logEntry));
    }
  });

  next();
};

// ============================================================================
// EXPORT MIDDLEWARE
// ============================================================================

module.exports = {
  router,
  verifyToken,
  blockPublicAccess,
  securityHeaders,
  protectSourceCode,
  auditLog
};
