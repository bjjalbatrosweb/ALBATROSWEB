type RateLimitOptions = {
  scope: string;
  limit: number;
  windowMs: number;
};

type RateEntry = { count: number; resetAt: number };
const globalRateLimit = globalThis as typeof globalThis & {
  __albatrosRateLimits?: Map<string, RateEntry>;
};
const entries =
  globalRateLimit.__albatrosRateLimits ??
  (globalRateLimit.__albatrosRateLimits = new Map());

function clientAddress(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "local"
  );
}

export function checkRateLimit(request: Request, options: RateLimitOptions) {
  const now = Date.now();
  const key = `${options.scope}:${clientAddress(request)}`;
  const current = entries.get(key);
  if (!current || current.resetAt <= now) {
    entries.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  current.count += 1;
  if (entries.size > 5000) {
    for (const [entryKey, value] of entries) {
      if (value.resetAt <= now) entries.delete(entryKey);
    }
  }
  return {
    allowed: current.count <= options.limit,
    retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}
