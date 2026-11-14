import "server-only";

/**
 * Best-effort in-process rate limiter.
 *
 * Serverless instances are not shared, so this guards a single instance rather than
 * the whole deployment. It is enough to stop a loop in the UI (or a script hitting the
 * routes) from burning provider quota. A distributed limiter can replace `consume`
 * without changing any call site.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const SWEEP_THRESHOLD = 5_000;

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

export interface RateLimitState {
  remaining: number;
  resetAt: number;
}

export function consume(key: string, limit: number, windowMs = 60_000): RateLimitState {
  const now = Date.now();

  if (buckets.size > SWEEP_THRESHOLD) sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { remaining: Math.max(0, limit - 1), resetAt };
  }

  if (bucket.count >= limit) {
    throw new RateLimitError("Too many requests. Please wait a moment and try again.");
  }

  bucket.count += 1;
  return { remaining: Math.max(0, limit - bucket.count), resetAt: bucket.resetAt };
}

/** Client identity for per-request limiting. Works behind the Vercel proxy. */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return `${scope}:${ip}`;
}

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
