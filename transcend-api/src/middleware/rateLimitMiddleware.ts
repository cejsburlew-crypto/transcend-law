// Rate Limiting & Quota Management Middleware
// Plan-based quota tracking with graceful degradation and admin overrides

import { Request, Response, NextFunction } from 'express';

// Plan definitions with rate limits (requests per minute)
enum PlanType {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

interface PlanConfig {
  requestsPerMinute: number;
  requestsPerDay: number;
  resetPeriod: 'minute' | 'daily' | 'monthly';
  gracefulDegradation: boolean;
}

const PLAN_LIMITS: Record<PlanType, PlanConfig> = {
  [PlanType.FREE]: {
    requestsPerMinute: 10,
    requestsPerDay: 500,
    resetPeriod: 'minute',
    gracefulDegradation: true,
  },
  [PlanType.PRO]: {
    requestsPerMinute: 100,
    requestsPerDay: 10000,
    resetPeriod: 'daily',
    gracefulDegradation: true,
  },
  [PlanType.ENTERPRISE]: {
    requestsPerMinute: Infinity,
    requestsPerDay: Infinity,
    resetPeriod: 'monthly',
    gracefulDegradation: false,
  },
};

// In-memory quota storage (use Redis in production)
interface QuotaEntry {
  userId: string;
  plan: PlanType;
  requestsInWindow: number;
  windowStart: number;
  dailyRequests: number;
  dailyWindowStart: number;
  lastRequestTime: number;
  alertTriggeredAt80: boolean;
  alertTriggeredAt100: boolean;
  isAdmin: boolean;
  adminOverride: boolean;
}

class QuotaManager {
  private quotas: Map<string, QuotaEntry> = new Map();
  private eventEmitter: any;

  constructor() {
    // Cleanup old quota entries every hour
    setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [userId, entry] of this.quotas.entries()) {
      // Remove entries not accessed in 24 hours
      if (now - entry.lastRequestTime > 24 * 60 * 60 * 1000) {
        this.quotas.delete(userId);
      }
    }
  }

  private getWindowStart(plan: PlanType): number {
    const now = Date.now();
    const period = PLAN_LIMITS[plan].resetPeriod;

    if (period === 'minute') {
      return Math.floor(now / (60 * 1000)) * (60 * 1000);
    } else if (period === 'daily') {
      return Math.floor(now / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
    } else {
      // monthly
      const date = new Date(now);
      date.setDate(1);
      date.setHours(0, 0, 0, 0);
      return date.getTime();
    }
  }

  getQuotaStatus(userId: string, plan: PlanType, isAdmin: boolean = false) {
    const entry = this.quotas.get(userId) || {
      userId,
      plan,
      requestsInWindow: 0,
      windowStart: this.getWindowStart(plan),
      dailyRequests: 0,
      dailyWindowStart: Math.floor(Date.now() / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000),
      lastRequestTime: Date.now(),
      alertTriggeredAt80: false,
      alertTriggeredAt100: false,
      isAdmin,
      adminOverride: false,
    };

    const limits = PLAN_LIMITS[plan];
    const now = Date.now();
    const currentWindowStart = this.getWindowStart(plan);

    // Reset window if it has passed
    if (entry.windowStart < currentWindowStart) {
      entry.requestsInWindow = 0;
      entry.windowStart = currentWindowStart;
      entry.alertTriggeredAt80 = false;
      entry.alertTriggeredAt100 = false;
    }

    // Reset daily counter if day has passed
    const dailyWindowStart = Math.floor(now / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
    if (entry.dailyWindowStart < dailyWindowStart) {
      entry.dailyRequests = 0;
      entry.dailyWindowStart = dailyWindowStart;
    }

    entry.lastRequestTime = now;
    this.quotas.set(userId, entry);

    const minutePercentage = (entry.requestsInWindow / limits.requestsPerMinute) * 100;
    const dailyPercentage = (entry.dailyRequests / limits.requestsPerDay) * 100;
    const usage = Math.max(minutePercentage, dailyPercentage);

    return {
      userId,
      plan,
      requestsInWindow: entry.requestsInWindow,
      limitPerWindow: limits.requestsPerMinute,
      dailyRequests: entry.dailyRequests,
      limitPerDay: limits.requestsPerDay,
      usage: Math.round(usage),
      windowReset: entry.windowStart + (limits.resetPeriod === 'minute' ? 60 * 1000 : 24 * 60 * 60 * 1000),
      isExceeded: usage >= 100,
      isWarning: usage >= 80 && usage < 100,
      isAdmin,
      adminOverride: entry.adminOverride,
    };
  }

  incrementRequest(userId: string, plan: PlanType, isAdmin: boolean = false): boolean {
    const entry = this.quotas.get(userId) || {
      userId,
      plan,
      requestsInWindow: 0,
      windowStart: this.getWindowStart(plan),
      dailyRequests: 0,
      dailyWindowStart: Math.floor(Date.now() / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000),
      lastRequestTime: Date.now(),
      alertTriggeredAt80: false,
      alertTriggeredAt100: false,
      isAdmin,
      adminOverride: false,
    };

    const limits = PLAN_LIMITS[plan];
    const now = Date.now();
    const currentWindowStart = this.getWindowStart(plan);

    // Reset window if it has passed
    if (entry.windowStart < currentWindowStart) {
      entry.requestsInWindow = 0;
      entry.windowStart = currentWindowStart;
      entry.alertTriggeredAt80 = false;
      entry.alertTriggeredAt100 = false;
    }

    // Reset daily counter if day has passed
    const dailyWindowStart = Math.floor(now / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
    if (entry.dailyWindowStart < dailyWindowStart) {
      entry.dailyRequests = 0;
      entry.dailyWindowStart = dailyWindowStart;
    }

    // Admin override
    if (isAdmin && entry.adminOverride) {
      entry.lastRequestTime = now;
      this.quotas.set(userId, entry);
      return true;
    }

    // Check limits
    if (
      entry.requestsInWindow >= limits.requestsPerMinute ||
      entry.dailyRequests >= limits.requestsPerDay
    ) {
      const usage = Math.max(
        (entry.requestsInWindow / limits.requestsPerMinute) * 100,
        (entry.dailyRequests / limits.requestsPerDay) * 100
      );

      // Emit alert if at 100%
      if (!entry.alertTriggeredAt100) {
        this.emitAlert('quota_exceeded', { userId, plan, usage: 100 });
        entry.alertTriggeredAt100 = true;
      }

      if (limits.gracefulDegradation) {
        // Add delay for graceful degradation
        return false;
      } else {
        return false;
      }
    }

    entry.requestsInWindow++;
    entry.dailyRequests++;
    entry.lastRequestTime = now;

    // Check for 80% warning
    const usage = Math.max(
      (entry.requestsInWindow / limits.requestsPerMinute) * 100,
      (entry.dailyRequests / limits.requestsPerDay) * 100
    );

    if (usage >= 80 && !entry.alertTriggeredAt80) {
      this.emitAlert('quota_warning', { userId, plan, usage: Math.round(usage) });
      entry.alertTriggeredAt80 = true;
    }

    this.quotas.set(userId, entry);
    return true;
  }

  setAdminOverride(userId: string, override: boolean) {
    const entry = this.quotas.get(userId);
    if (entry) {
      entry.adminOverride = override;
    }
  }

  private emitAlert(type: string, data: any) {
    console.log(`[QUOTA ALERT] ${type}:`, data);
    // In production, integrate with monitoring/alerting system
  }
}

const quotaManager = new QuotaManager();

// Middleware factory
export function createQuotaMiddleware(
  getPlanForUser: (userId: string) => PlanType | Promise<PlanType> = () => PlanType.FREE,
  isAdminUser: (userId: string) => boolean | Promise<boolean> = () => false
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip rate limiting for health checks and public endpoints
    if (['/health', '/status', '/api/public'].some(p => req.path.startsWith(p))) {
      return next();
    }

    const userId = req.user?.id || req.ip;

    if (!userId) {
      return next();
    }

    try {
      const plan = await Promise.resolve(getPlanForUser(userId));
      const isAdmin = await Promise.resolve(isAdminUser(userId));

      // Get current quota status
      const quotaStatus = quotaManager.getQuotaStatus(userId, plan, isAdmin);

      // Add quota info to request
      (req as any).quotaStatus = quotaStatus;

      // Check if over limit
      if (quotaStatus.isExceeded && !isAdmin) {
        // Return 429 Too Many Requests
        res.status(429);
        res.setHeader('X-RateLimit-Limit', quotaStatus.limitPerWindow);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', Math.ceil(quotaStatus.windowReset / 1000));
        res.setHeader('X-RateLimit-Usage', quotaStatus.usage);
        res.setHeader('Retry-After', 60);

        return res.json({
          error: 'Rate limit exceeded',
          message: `Your plan allows ${quotaStatus.limitPerWindow} requests per minute`,
          usage: quotaStatus.usage,
          resetTime: new Date(quotaStatus.windowReset).toISOString(),
        });
      }

      // Graceful degradation - add delay if approaching limit
      if (quotaStatus.isWarning && PLAN_LIMITS[plan].gracefulDegradation) {
        const delay = Math.min(quotaStatus.usage - 80, 20) * 50; // 0-1000ms delay
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Increment request count
      const allowed = quotaManager.incrementRequest(userId, plan, isAdmin);

      if (!allowed && !isAdmin) {
        res.status(429);
        res.setHeader('X-RateLimit-Limit', quotaStatus.limitPerWindow);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', Math.ceil(quotaStatus.windowReset / 1000));
        res.setHeader('X-RateLimit-Usage', 100);

        return res.json({
          error: 'Rate limit exceeded',
          message: `Your plan allows ${quotaStatus.limitPerWindow} requests per minute`,
          usage: 100,
          resetTime: new Date(quotaStatus.windowReset).toISOString(),
        });
      }

      // Update status after increment
      const updatedStatus = quotaManager.getQuotaStatus(userId, plan, isAdmin);

      // Add rate limit headers to response
      res.setHeader('X-RateLimit-Limit', updatedStatus.limitPerWindow);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, updatedStatus.limitPerWindow - updatedStatus.requestsInWindow));
      res.setHeader('X-RateLimit-Reset', Math.ceil(updatedStatus.windowReset / 1000));
      res.setHeader('X-RateLimit-Usage', updatedStatus.usage);

      if (updatedStatus.isWarning) {
        res.setHeader('X-RateLimit-Warning', 'approaching limit');
      }

      next();
    } catch (error) {
      console.error('Quota middleware error:', error);
      next();
    }
  };
}

// Export for manual quota checking
export function getQuotaStatus(userId: string, plan: PlanType, isAdmin: boolean = false) {
  return quotaManager.getQuotaStatus(userId, plan, isAdmin);
}

// Admin function to override quota for a user
export function setAdminQuotaOverride(userId: string, override: boolean) {
  quotaManager.setAdminOverride(userId, override);
}

// Default middleware using Free plan for all users
export const defaultQuotaMiddleware = createQuotaMiddleware(
  () => PlanType.FREE,
  () => false
);

export { PlanType, QuotaManager };
export default {
  createQuotaMiddleware,
  defaultQuotaMiddleware,
  getQuotaStatus,
  setAdminQuotaOverride,
  PlanType,
};
