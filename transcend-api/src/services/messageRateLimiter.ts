// Rate limiter for message sending.
//
// The p2p service originally required the `redis` package, which is not a
// dependency of this project - so the module did not compile and the code never
// ran. Rather than add an infrastructure dependency to fix a type error, this
// provides an in-process fixed-window limiter with the same interface.
//
// Trade-off: counters are per-process, so with N API instances the effective
// limit is N x MESSAGE_LIMIT. That is acceptable for an abuse-prevention
// control (it is not a security boundary), and the shape here matches Redis
// closely enough to swap in a shared store later without touching callers.

export interface RateLimitStatus {
  remaining: number;
  resetTime: number;
  isLimited: boolean;
}

interface Window {
  count: number;
  expiresAt: number;
}

export class MessageRateLimiter {
  private windows = new Map<string, Window>();
  private lastSweep = 0;

  constructor(
    private readonly limit: number,
    private readonly windowSeconds: number
  ) {}

  /** Drop expired windows so the map cannot grow without bound. */
  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, window] of this.windows) {
      if (window.expiresAt <= now) this.windows.delete(key);
    }
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
