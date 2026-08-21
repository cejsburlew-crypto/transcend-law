// Transcend Law API Server
// Main entry point for backend services with Database + JWT Authentication

import express, { Express } from 'express';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import database
import { initializeDatabase, closePool } from './database/connection';

// Import middleware
import { corsMiddleware, authMiddleware } from './middleware/authMiddleware';
import { adminMiddleware } from '../middleware/auth';

// Import route handlers
import authRoutes from './routes/auth';
import intakeRoutes from './routes/intake';
import messagesRoutes from './routes/messages';
import subscriptionsRoutes from './routes/subscriptions';
import translationRoutes from './routes/translation';
import paymentsRoutes from './routes/payments';
import documentsRoutes from './routes/documents';
import attorneysRoutes from './routes/attorneys';
import notariesRoutes from './routes/notaries';
import adminRequestsRoutes from './routes/adminRequests';
import adminHealthCheckRoutes from './routes/adminHealthCheck';
import adminSecurityScanRoutes from './routes/adminSecurityScan';

// Import services
import { initializeClover } from './services/cloverService';
import { initializeS3Bucket } from './services/s3Service';

const app: Express = express();
const PORT = process.env.PORT || 3001;

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet());
app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: 'connected',
  });
});

// ============================================
// API ROUTES
// ============================================

// ---------------------------------------------------------------------------
// Authentication is applied AT MOUNT, not inside each router.
//
// Six routers were found reading req.user with no middleware wired up, and the
// three admin routers below had no authentication at all. Enforcing here means
// a new router cannot be exposed unauthenticated by omission - the failure mode
// becomes "route is locked" rather than "route is open".
//
// Anything genuinely public is listed explicitly with a reason.
// ---------------------------------------------------------------------------

// Public: login, signup, token refresh.
app.use('/api/v2/auth', authRoutes);

// Public: provider directory browsing (no user context, no private data).
app.use('/api/v2/attorneys', attorneysRoutes);
app.use('/api/v2/notaries', notariesRoutes);

// Protected: everything touching a user, a case, a payment, or a message.
app.use('/api/v2/intake', authMiddleware, intakeRoutes);
app.use('/api/v2/messages', authMiddleware, messagesRoutes);
app.use('/api/v2/subscriptions', authMiddleware, subscriptionsRoutes);
app.use('/api/v2/payments', authMiddleware, paymentsRoutes);
app.use('/api/v2/documents', authMiddleware, documentsRoutes);
// Translation reaches the in-house engine with message content; leaving it open
// would make it an unauthenticated translation proxy.
app.use('/api/v2/translate', authMiddleware, translationRoutes);

// Admin: these were mounted with NO authentication, exposing
// /api/admin/requests (read/write/delete), /api/admin/health-check and
// /api/admin/security/{scan,report-threat,quarantine} to anyone.
//
// adminMiddleware fails closed: users.user_type admits only
// ('client','attorney','firm'), so no account can pass it yet and these now
// return 403. That is deliberate - an unreachable admin panel is correct until
// the role is granted; an open one is not. Add 'admin' to the CHECK constraint
// to restore access.
app.use('/api', adminMiddleware, adminRequestsRoutes);
app.use('/api', adminMiddleware, adminHealthCheckRoutes);
app.use('/api', adminMiddleware, adminSecurityScanRoutes);

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// ============================================
// SERVER STARTUP
// ============================================

async function startServer() {
  try {
    console.log('🚀 Starting Transcend Law API...');

    // Initialize database
    await initializeDatabase();

    // Initialize Clover
    try {
      initializeClover();
      console.log('✅ Clover payment system initialized');
    } catch (error) {
      console.warn('⚠️  Clover not configured - payments disabled');
    }

    // Initialize S3
    try {
      await initializeS3Bucket();
      console.log('✅ AWS S3 document storage initialized');
    } catch (error) {
      console.warn('⚠️  AWS S3 not configured - file storage disabled');
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`📊 Health check: GET http://localhost:${PORT}/health`);
      console.log(`🔐 Authentication: POST http://localhost:${PORT}/api/v2/auth/signup`);
      console.log(`\n📋 Available endpoints:`);
      console.log(`   Authentication:`);
      console.log(`   - POST   /api/v2/auth/signup`);
      console.log(`   - POST   /api/v2/auth/login`);
      console.log(`   - POST   /api/v2/auth/refresh`);
      console.log(`   - POST   /api/v2/auth/logout`);
      console.log(`   - GET    /api/v2/auth/me`);
      console.log(`\n   Cases & Intake:`);
      console.log(`   - POST   /api/v2/intake/submit`);
      console.log(`   - GET    /api/v2/cases/:caseId/offers`);
      console.log(`   - POST   /api/v2/offers/:offerId/accept`);
      console.log(`\n   Messaging & Communication:`);
      console.log(`   - POST   /api/v2/messages`);
      console.log(`   - GET    /api/v2/messages/conversations`);
      console.log(`\n   Subscriptions:`);
      console.log(`   - GET    /api/v2/subscriptions/plans`);
      console.log(`   - GET    /api/v2/subscriptions/current`);
      console.log(`   - POST   /api/v2/subscriptions/upgrade`);
      console.log(`\n   Translation:`);
      console.log(`   - POST   /api/v2/translate`);
      console.log(`   - POST   /api/v2/translate/batch`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  // `process.on` expects a void return, so the promise is handled here rather
  // than returned - an unhandled rejection during shutdown would be silent.
  void closePool()
    .catch((error) => console.error('Error closing database pool:', error))
    .finally(() => process.exit(0));
});

// Start the server. Explicitly handled: an unhandled rejection here would
// leave the process alive but not listening.
void startServer().catch((error) => {
  console.error('Fatal: server failed to start:', error);
  process.exit(1);
});

export default app;
