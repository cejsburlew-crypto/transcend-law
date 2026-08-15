// Transcend Law API Server
// Main entry point for backend services

import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';

// Import route handlers
import intakeRoutes from './routes/intake';
import messagesRoutes from './routes/messages';
import subscriptionsRoutes from './routes/subscriptions';
import translationRoutes from './routes/translation';

const app: Express = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v2/intake', intakeRoutes);
app.use('/api/v2/messages', messagesRoutes);
app.use('/api/v2/subscriptions', subscriptionsRoutes);
app.use('/api/v2/translate', translationRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Transcend Law API running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 Translation: http://localhost:${PORT}/api/v2/translate`);
});

export default app;
