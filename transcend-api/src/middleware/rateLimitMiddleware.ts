// Rate Limiting Middleware
// Protects against brute force and DoS attacks

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

// Create Redis client (optional - falls back to memory store)
let redisClient;
try {
  redisClient = createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  });
  redisClient.connect();
} catch (error) {
  console.warn('Redis not available, using memory store for rate limiting');
}

// General API rate limiter
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  store: redisClient ? new RedisStore({
    client: redisClient,
    prefix: 'rl:general:',
  }) : undefined,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  },
});

// Strict rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit to 5 requests per 15 minutes
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true, // Don't count successful requests
  store: redisClient ? new RedisStore({
    client: redisClient,
    prefix: 'rl:auth:',
  }) : undefined,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many failed login attempts',
      retryAfter: req.rateLimit.resetTime,
    });
  },
});

// Payment rate limiter
export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit to 10 payment attempts per hour
  message: 'Too many payment attempts, please try again later.',
  skip: (req) => !req.user, // Only limit authenticated users
  keyGenerator: (req) => req.user.id, // Rate limit by user ID, not IP
  store: redisClient ? new RedisStore({
    client: redisClient,
    prefix: 'rl:payment:',
  }) : undefined,
});

// Document upload rate limiter
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit to 20 uploads per hour
  message: 'Too many upload attempts, please try again later.',
  skip: (req) => !req.user,
  keyGenerator: (req) => req.user.id,
  store: redisClient ? new RedisStore({
    client: redisClient,
    prefix: 'rl:upload:',
  }) : undefined,
});

// API endpoint specific limiters
export const caseLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 cases per hour
  skip: (req) => !req.user,
  keyGenerator: (req) => req.user.id,
  store: redisClient ? new RedisStore({
    client: redisClient,
    prefix: 'rl:cases:',
  }) : undefined,
});

export const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute
  skip: (req) => !req.user,
  keyGenerator: (req) => req.user.id,
  store: redisClient ? new RedisStore({
    client: redisClient,
    prefix: 'rl:messages:',
  }) : undefined,
});

// Password reset rate limiter
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: 'Too many password reset attempts, please try again later.',
  store: redisClient ? new RedisStore({
    client: redisClient,
    prefix: 'rl:password-reset:',
  }) : undefined,
});

export default {
  generalLimiter,
  authLimiter,
  paymentLimiter,
  uploadLimiter,
  caseLimiter,
  messageLimiter,
  passwordResetLimiter,
};
