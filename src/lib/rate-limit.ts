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
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-nf-client-connection-ip")?.trim() ||
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function checkIdentifier(identifier: string, options: RateLimitOptions) {
  const now = Date.now();
  const key = `${options.scope}:${identifier}`;
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

export function checkRateLimit(request: Request, options: RateLimitOptions) {
  return checkIdentifier(`ip:${clientAddress(request)}`, options);
}

export function checkRateLimitForIdentifier(
  identifier: string,
  options: RateLimitOptions,
) {
  return checkIdentifier(`actor:${identifier.slice(0, 256)}`, options);
}
