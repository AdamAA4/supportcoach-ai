// Fixed-window in-memory rate limiter for the unauthenticated public
// endpoints. Per-instance only (serverless), which blunts bursts rather
// than guaranteeing global caps; the import byte/time limits remain the
// hard protections.

export type RateLimitDecision = { allowed: boolean; retryAfterSeconds: number };

export const createRateLimiter = (
  windowMs: number,
  max: number,
  now: () => number = () => Date.now(),
) => {
  const hits = new Map<string, { windowStart: number; count: number }>();
  return (key: string): RateLimitDecision => {
    const timestamp = now();
    const entry = hits.get(key);
    if (!entry || timestamp - entry.windowStart >= windowMs) {
      hits.set(key, { windowStart: timestamp, count: 1 });
      return { allowed: true, retryAfterSeconds: 0 };
    }
    if (entry.count < max) {
      entry.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    }
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.windowStart + windowMs - timestamp) / 1000)),
    };
  };
};

export const clientKeyOf = (request: Request): string => {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
};

// Tests drive the routes directly and in bursts; the limiter is unit-tested
// on its own instead.
export const rateLimitingEnabled = () => !process.env.VITEST;
