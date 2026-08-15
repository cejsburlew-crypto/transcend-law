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
import { corsMiddleware } from './middleware/authMiddleware';

// Import route handlers
import authRoutes from './routes/auth';
import intakeRoutes from './routes/intake';
import messagesRoutes from './routes/messages';
import subscriptionsRoutes from './routes/subscriptions';
import translationRoutes from './routes/translation';
import paymentsRoutes from './routes/payments';

// Import services
import { initializeClover } from './services/cloverService';

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

// Authentication routes (public)
app.use('/api/v2/auth', authRoutes);

// Protected routes
app.use('/api/v2/intake', intakeRoutes);
app.use('/api/v2/messages', messagesRoutes);
app.use('/api/v2/subscriptions', subscriptionsRoutes);
app.use('/api/v2/payments', paymentsRoutes);
app.use('/api/v2/translate', translationRoutes);

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
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await closePool();
  process.exit(0);
});

// Start the server
startServer();

export default app;
