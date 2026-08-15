// Quota Types and Interfaces

/**
 * Subscription plan types
 */
export enum PlanType {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

/**
 * Plan configuration with rate limits
 */
export interface PlanConfig {
  requestsPerMinute: number;
  requestsPerDay: number;
  resetPeriod: 'minute' | 'daily' | 'monthly';
  gracefulDegradation: boolean;
}

/**
 * Quota status for a user
 */
export interface QuotaStatus {
  userId: string;
  plan: PlanType;
  requestsInWindow: number;
  limitPerWindow: number;
  dailyRequests: number;
  limitPerDay: number;
  usage: number; // percentage 0-100
  windowReset: number; // timestamp in ms
  isExceeded: boolean;
  isWarning: boolean;
  isAdmin: boolean;
  adminOverride: boolean;
}

/**
 * Rate limit headers added to response
 */
export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'X-RateLimit-Usage': string;
  'X-RateLimit-Warning'?: string;
  'Retry-After'?: string;
}

/**
 * Quota alert event
 */
export interface QuotaAlert {
  type: 'quota_warning' | 'quota_exceeded';
  userId: string;
  plan: PlanType;
  usage: number;
  timestamp: number;
}

/**
 * User subscription info
 */
export interface UserSubscription {
  userId: string;
  planId: PlanType;
  planName: string;
  status: 'active' | 'inactive' | 'canceled';
  startDate: Date;
  renewalDate: Date;
  isAdmin: boolean;
  quotaOverride: boolean;
}
