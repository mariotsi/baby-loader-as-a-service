type Bucket = { count: number; resetAt: number };

// Best-effort in-process limiter. Worker instances do not share memory, so
// this slows down bursts without guaranteeing a global limit.
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) {
        if (now > v.resetAt) {
          buckets.delete(k);
        }
      }
    }
    return true;
  }

  if (bucket.count >= limit) {
    return false;
  }
  bucket.count += 1;
  return true;
}
