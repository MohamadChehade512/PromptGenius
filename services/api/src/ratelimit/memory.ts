export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
}

export interface RateLimiter {
  hit(key: string, max: number, windowMs: number): RateLimitResult;
}

/** Fixed-window counter per key. Local only; AWS WAF rate rules replace it in Phase 3. */
export class MemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  hit(key: string, max: number, windowMs: number): RateLimitResult {
    const t = this.now();
    let w = this.windows.get(key);
    if (!w || t - w.start >= windowMs) {
      w = { start: t, count: 0 };
      this.windows.set(key, w);
    }
    w.count += 1;
    if (this.windows.size > 10_000) this.windows.clear();
    return w.count <= max
      ? { ok: true, retryAfterSec: 0 }
      : { ok: false, retryAfterSec: Math.ceil((w.start + windowMs - t) / 1000) };
  }
}
