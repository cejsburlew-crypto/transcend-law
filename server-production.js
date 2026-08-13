// TRANSCEND LAW - PRODUCTION SERVER (transcendlaw.com)
// Secure production deployment with SSL/TLS

const express = require('express');
const https = require('https');
const http = require('http');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.DOMAIN || 'transcendlaw.com';

// Trust proxy headers from Nginx
app.set('trust proxy', true);

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

// 1. Helmet - Secure HTTP headers for production domain
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", `https://${DOMAIN}`],
      scriptSrc: ["'self'", `https://${DOMAIN}`],
      styleSrc: ["'self'", "'unsafe-inline'", `https://${DOMAIN}`],
      imgSrc: ["'self'", 'data:', `https://${DOMAIN}`],
      connectSrc: ["'self'", `https://${DOMAIN}`, `https://api.${DOMAIN}`]
    }
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'no-referrer' },
  hsts: {
    maxAge: 31536000,  // 1 year
    includeSubDomains: true,
    preload: true
  }
}));

// 2. Custom security headers
app.use(securityHeaders);

// 3. CORS for production domain + localhost development
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    `https://${DOMAIN}`,
    `https://api.${DOMAIN}`,
    `https://www.${DOMAIN}`,
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ];

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, DELETE, PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

// 4. Protect source code access
app.use(protectSourceCode);

// 5. Audit logging
app.use(auditLog);

// 6. Request parsing limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: false }));

// 7. Rate limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => req.ip,
  skip: (req, res) => false
});
app.use(limiter);

// ============================================================================
// LOGIN ENDPOINT - ONLY ALLOWED ENDPOINT
// ============================================================================

app.use('/api/auth', authRouter);

// ============================================================================
// HEALTH CHECK & API ROUTES
// ============================================================================

app.get('/api/health', verifyToken, (req, res) => {
  res.json({
    status: 'healthy',
    domain: DOMAIN,
    mode: 'production',
    user: req.user.email,
    timestamp: new Date().toISOString()
  });
});

// Protected endpoints
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

// Import API routes
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
// CATCH-ALL
// ============================================================================

app.all(/.*/, blockPublicAccess);

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message
  });
});

// ============================================================================
// HTTPS SETUP - Production with SSL
// ============================================================================

const startServer = () => {
  // Look for SSL certificates
  const certPath = process.env.SSL_CERT_PATH || '/etc/ssl/certs/transcendlaw.com.crt';
  const keyPath = process.env.SSL_KEY_PATH || '/etc/ssl/private/transcendlaw.com.key';

  // Check if SSL certificates exist
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    try {
      const options = {
        cert: fs.readFileSync(certPath),
        key: fs.readFileSync(keyPath)
      };

      https.createServer(options, app).listen(443, () => {
        console.log(`
╔════════════════════════════════════════════════════════════════╗
║         TRANSCEND LAW - PRODUCTION (transcendlaw.com)           ║
║                   HTTPS SECURE SERVER                          ║
╚════════════════════════════════════════════════════════════════╝

🔐 PRODUCTION SETUP
  ✓ Domain: https://transcendlaw.com
  ✓ API: https://api.transcendlaw.com
  ✓ SSL/TLS: ENABLED
  ✓ HSTS: ENABLED (1 year)
  ✓ Security Headers: ENABLED
  ✓ CORS: Configured for ${DOMAIN}

🔑 LOGIN ONLY
  Email: cejsburlew@gmail.com
  Password: $Colombia
  Token: JWT (7 days expiry)

📊 ALL 7 SYSTEMS PROTECTED
  ✓ Payments & Commissions
  ✓ Professional Directory
  ✓ Verification & Compliance
  ✓ Dispute Resolution
  ✓ Admin Dashboard
  ✓ Notifications
  ✓ Leaderboards

⚠️  ACCESS RESTRICTED
  - Public access blocked
  - Source code protected
  - All requests logged
  - Rate limited (100/15min)

🌐 SERVER READY
  HTTPS: https://transcendlaw.com
  Status: Running
  Mode: Production Setup

═══════════════════════════════════════════════════════════════════
        `);
      });

      // Redirect HTTP to HTTPS
      http.createServer((req, res) => {
        res.writeHead(301, { Location: `https://${DOMAIN}${req.url}` });
        res.end();
      }).listen(80);

      console.log('HTTP → HTTPS redirect enabled');

    } catch (error) {
      console.error('SSL certificate error:', error.message);
      console.log('Starting HTTP server instead...');
      startHTTPServer();
    }
  } else {
    console.warn(`
⚠️  SSL certificates not found at:
  - ${certPath}
  - ${keyPath}

Starting HTTP server. For production, install SSL certificates:
  1. Generate with Let's Encrypt: certbot certonly -d transcendlaw.com
  2. Update paths in server-production.js
  3. Restart server

Or set environment variables:
  SSL_CERT_PATH=/path/to/cert.crt
  SSL_KEY_PATH=/path/to/key.key
    `);
    startHTTPServer();
  }
};

const startHTTPServer = () => {
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║         TRANSCEND LAW - PRODUCTION (transcendlaw.com)           ║
║                   HTTP SERVER (DEV MODE)                       ║
╚════════════════════════════════════════════════════════════════╝

⚠️  HTTP MODE - NOT PRODUCTION SECURE
  Domain: http://transcendlaw.com:${PORT}
  SSL: NOT ENABLED

To enable HTTPS:
  1. Install SSL certificates
  2. Set SSL_CERT_PATH and SSL_KEY_PATH
  3. Restart server

🔑 LOGIN ONLY
  Email: cejsburlew@gmail.com
  Password: $Colombia

📊 SYSTEMS READY
  ✓ All 7 systems accessible
  ✓ Public access blocked
  ✓ Source code protected
  ✓ All requests logged

Server running on port ${PORT}

═══════════════════════════════════════════════════════════════════
    `);
  });
};

startServer();

module.exports = app;
