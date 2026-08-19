// Enhanced CORS Middleware
// Strict origin validation and security headers

import cors, { CorsOptions } from 'cors';
import { Request } from 'express';

// Allowed origins per environment
const allowedOrigins = {
  development: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
  ],
  staging: [
    'https://staging.transcend-law.com',
    'https://staging-app.transcend-law.com',
    'https://staging-api.transcend-law.com',
  ],
  production: [
    'https://app.transcend-law.com',
    'https://transcend-law.com',
    'https://attorney.transcend-law.com',
    'https://admin.transcend-law.com',
  ],
};

const env = process.env.NODE_ENV || 'development';
const origins = allowedOrigins[env] || allowedOrigins.development;

// Parse additional origins from environment
const envOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
const finalOrigins = [...origins, ...envOrigins.map(o => o.trim())];

// CORS options
const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (finalOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: origin ${origin} is not allowed`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-CSRF-Token',
    'X-Requested-With',
    'Accept',
    'Accept-Language',
  ],
  credentials: true, // Allow credentials (cookies, auth headers)
  maxAge: 3600, // Cache preflight for 1 hour
  optionsSuccessStatus: 200,
};

// Enhanced CORS middleware with logging
export const corsMiddleware = (req: Request, res, next: any) => {
  const origin = req.get('origin');

  if (origin && !finalOrigins.includes(origin)) {
    console.warn(`[CORS] Rejected request from unauthorized origin: ${origin}`);
  }

  cors(corsOptions)(req, res, next);
};

// Simple CORS middleware (minimal security)
export const simpleCors = cors({
  origin: process.env.ALLOWED_ORIGINS || '*',
  credentials: true,
});

export default corsMiddleware;
