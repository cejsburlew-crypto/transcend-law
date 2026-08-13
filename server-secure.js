// TRANSCEND LAW - SECURE PRODUCTION SERVER
// Blocks all public access during setup phase. Only default admin can login.

const express = require('express');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Import security middleware
const {
  router: authRouter,
  verifyToken,
  blockPublicAccess,
  securityHeaders,
  protectSourceCode,
  auditLog
} = require('./auth-middleware-secure');

// ============================================================================
// SECURITY STACK
// ============================================================================

// 1. Helmet - Secure HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:']
    }
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'no-referrer' }
}));

// 2. Custom security headers
app.use(securityHeaders);

// 3. Protect source code access
app.use(protectSourceCode);

// 4. Audit logging
app.use(auditLog);

// 5. Request parsing limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: false }));

// 6. Rate limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,  // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// ============================================================================
// LOGIN ENDPOINT - ONLY ALLOWED ENDPOINT
// ============================================================================

app.use('/api/auth', authRouter);

// ============================================================================
// BLOCK ALL OTHER PUBLIC ENDPOINTS
// ============================================================================

// Health check - requires authentication
app.get('/api/health', verifyToken, (req, res) => {
  res.json({
    status: 'healthy',
    mode: 'setup',
    user: req.user.email,
    timestamp: new Date().toISOString()
  });
});

// All protected endpoints - require verification token
const protectedPaths = [
  /^\/api\/payments/,
  /^\/api\/directory/,
  /^\/api\/disputes/,
  /^\/api\/admin/,
  /^\/api\/notifications/,
  /^\/api\/leaderboard/,
  /^\/api\/professionals/
];

protectedPaths.forEach(path => {
  app.all(path, verifyToken);
});

// Import actual API routes (after verifyToken middleware)
try {
  const paymentsAPI = require('./api-payments-commissions');
  const directoryAPI = require('./api-directory-search');
  const disputesAPI = require('./api-dispute-resolution');
  const adminAPI = require('./api-admin-dashboard');
  const notificationsAPI = require('./api-notifications-and-leaderboards');
  const metricsAPI = require('./api-platform-metrics');

  app.use('/', paymentsAPI);
  app.use('/', directoryAPI);
  app.use('/', disputesAPI);
  app.use('/', adminAPI);
  app.use('/', notificationsAPI);
  app.use('/', metricsAPI);
} catch (error) {
  console.error('API loading error:', error.message);
}

// ============================================================================
// CATCH-ALL - BLOCK EVERYTHING ELSE
// ============================================================================

app.all(/.*/, blockPublicAccess);

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);

  // Don't expose error details in production
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message
  });
});

// ============================================================================
// STARTUP
// ============================================================================

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║          TRANSCEND LAW - SECURE PRODUCTION SERVER              ║
║                    SETUP MODE ACTIVE                           ║
╚════════════════════════════════════════════════════════════════╝

🔐 SECURITY STATUS
  ✓ Source code protected
  ✓ Public access blocked
  ✓ Only default admin can login
  ✓ All requests logged
  ✓ Security headers enabled
  ✓ Rate limiting active

📝 LOGIN CREDENTIALS
  Email: cejsburlew@gmail.com
  Password: $Colombia

🚀 SERVER READY
  Port: ${PORT}
  Environment: ${process.env.NODE_ENV}
  Maintenance Mode: ${process.env.MAINTENANCE_MODE}

⚠️  WARNING: This is setup mode. Only default admin has access.

═══════════════════════════════════════════════════════════════════
  `);
});

module.exports = app;
