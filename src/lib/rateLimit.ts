type Bucket = { count: number; resetAt: number };

// Best-effort in-process limiter. Serverless instances are not shared, so this
// slows down bursts rather than guaranteeing a global limit. Good enough here;
// swap for a Mongo/Redis counter if stronger guarantees are needed.
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
