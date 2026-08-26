// Rate limiting for AI-touching endpoints (§8 P0). Sliding-window counter
// behind a store interface: the in-memory store covers a single serverless
// instance and tests; swap in a Redis/Upstash store for multi-instance prod.

export interface RateLimitStore {
  /** Increment the counter for `key` and return its value; the counter expires after `windowMs`. */
  increment(key: string, windowMs: number, now: number): Promise<number>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, { count: number; resetAt: number }>();

  async increment(key: string, windowMs: number, now: number): Promise<number> {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return 1;
    }
    bucket.count += 1;
    return bucket.count;
  }
}

export interface RateLimitOptions {
  /** Max requests per window. */
  limit: number;
  windowMs: number;
  store?: RateLimitStore;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

const defaultStore = new MemoryRateLimitStore();

export function createRateLimiter(options: RateLimitOptions) {
  const store = options.store ?? defaultStore;
  return async function check(key: string, now = Date.now()): Promise<RateLimitResult> {
    const count = await store.increment(key, options.windowMs, now);
    return { allowed: count <= options.limit, remaining: Math.max(0, options.limit - count) };
  };
}

/** Per-user limits for endpoints that spend Claude tokens. */
export const aiEndpointLimiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

/** Per-user limit on triggering full inbox scans. */
export const scanLimiter = createRateLimiter({ limit: 3, windowMs: 60 * 60_000 });
