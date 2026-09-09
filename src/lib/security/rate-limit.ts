type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function consumeRateLimit(key: string, maxRequests: number, windowMs: number, now = Date.now()) {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }
  if (current.count >= maxRequests) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += 1;
  return { allowed: true, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
}

export function requestRateLimitKey(request: Request, namespace: string) {
  const address = request.headers.get("x-real-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return `${namespace}:${address}`;
}
