// Rate limiter for message sending.
//
// Uses a shared Redis counter when REDIS_URL is configured, so the limit holds
// across every API instance. Without Redis it falls back to an in-process
// fixed-window counter, where N instances means an effective limit of
// N x MESSAGE_LIMIT - acceptable for abuse prevention, but not a hard boundary.
//
// Fails OPEN on Redis errors: a limiter outage must not block legitimate
// client-attorney communication. Denial-of-service on the limiter would
// otherwise become denial-of-service on the product.

export interface RateLimitStatus {
  remaining: number;
  resetTime: number;
  isLimited: boolean;
}

interface Window {
  count: number;
  expiresAt: number;
}

/**
 * Lazily-constructed shared client. Redis is optional, so the import is
 * deferred - requiring it at module load would crash deployments that do not
 * use it.
 */
let redis: any = null;
let redisTried = false;

const getRedis = (): any => {
  if (redisTried) return redis;
  redisTried = true;

  if (!process.env.REDIS_URL) return null;

  try {
    // Deferred require: ioredis is optional, so a static import would break
    // deployments that never configure Redis.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Redis = require('ioredis');
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      lazyConnect: false,
    });
    redis.on('error', (err: Error) => {
      console.warn('[ratelimit] redis error, falling back to in-process counters:', err.message);
    });
    return redis;
  } catch (error) {
    console.warn('[ratelimit] ioredis unavailable, using in-process counters:', (error as Error).message);
    redis = null;
    return null;
  }
};

export class MessageRateLimiter {
  private windows = new Map<string, Window>();
  private lastSweep = 0;

  constructor(
    private readonly limit: number,
    private readonly windowSeconds: number
  ) {}

  private key(userId: string) {
    return `ratelimit:messages:${userId}`;
  }

  /** Shared-store check. Returns null when Redis is unavailable. */
  private async checkShared(userId: string): Promise<RateLimitStatus | null> {
    const client = getRedis();
    if (!client) return null;

    try {
      const key = this.key(userId);
      const [countRaw, ttl] = await Promise.all([client.get(key), client.ttl(key)]);
      const count = parseInt(countRaw || '0', 10) || 0;

      return {
        remaining: Math.max(0, this.limit - count),
        resetTime: ttl && ttl > 0 ? ttl : this.windowSeconds,
        isLimited: count >= this.limit,
      };
    } catch (error) {
      console.warn('[ratelimit] redis check failed, failing open:', (error as Error).message);
      return null;
    }
  }

  /** Shared-store increment. Returns false when Redis is unavailable. */
  private async incrementShared(userId: string): Promise<boolean> {
    const client = getRedis();
    if (!client) return false;

    try {
      const key = this.key(userId);
      // INCR then set the expiry on first write, so the window starts with it.
      const count = await client.incr(key);
      if (count === 1) await client.expire(key, this.windowSeconds);
      return true;
    } catch (error) {
      console.warn('[ratelimit] redis incr failed:', (error as Error).message);
      return false;
    }
  }

  /** Drop expired windows so the map cannot grow without bound. */
  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, window] of this.windows) {
      if (window.expiresAt <= now) this.windows.delete(key);
    }
  }

  /** Shared counter when Redis is configured, otherwise in-process. */
  async checkAsync(userId: string): Promise<RateLimitStatus> {
    return (await this.checkShared(userId)) ?? this.check(userId);
  }

  async incrementAsync(userId: string): Promise<void> {
    if (!(await this.incrementShared(userId))) this.increment(userId);
  }

  check(userId: string): RateLimitStatus {
    const now = Date.now();
    this.sweep(now);

    const window = this.windows.get(userId);

    if (!window || window.expiresAt <= now) {
      return { remaining: this.limit, resetTime: this.windowSeconds, isLimited: false };
    }

    return {
      remaining: Math.max(0, this.limit - window.count),
      resetTime: Math.ceil((window.expiresAt - now) / 1000),
      isLimited: window.count >= this.limit,
    };
  }

  increment(userId: string): void {
    const now = Date.now();
    const window = this.windows.get(userId);

    if (!window || window.expiresAt <= now) {
      this.windows.set(userId, { count: 1, expiresAt: now + this.windowSeconds * 1000 });
      return;
    }

    window.count += 1;
  }
}
