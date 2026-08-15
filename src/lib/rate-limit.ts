import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { logServerEvent } from '@/lib/observability';

type RateLimitOptions = { scope: string; limit: number; windowMs: number };
type RateLimitResult = { allowed: boolean; retryAfter: number };
type LocalEntry = { count: number; resetAt: number };
const localFallback = new Map<string, LocalEntry>();

function digest(value: string) { return createHash('sha256').update(value).digest('hex'); }
function clientAddress(request: Request) {
  return (request.headers.get('cf-connecting-ip')?.trim() || request.headers.get('x-nf-client-connection-ip')?.trim() || request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip')?.trim() || 'unknown').slice(0, 128);
}
function localCheck(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now(); const current = localFallback.get(key);
  if (!current || current.resetAt <= now) { localFallback.set(key, { count: 1, resetAt: now + options.windowMs }); return { allowed: true, retryAfter: 0 }; }
  current.count += 1;
  for (const [entryKey, value] of localFallback) if (value.resetAt <= now) localFallback.delete(entryKey);
  return { allowed: current.count <= options.limit, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
}
async function distributedCheck(identifier: string, options: RateLimitOptions) {
  const now = Date.now(); const key = `${options.scope}:${identifier}`;
  const reference = adminDb.collection('RateLimits').doc(digest(key));
  try {
    return await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference); const data = snapshot.data();
      const resetAt = data?.resetAt instanceof Timestamp ? data.resetAt.toMillis() : 0;
      const count = resetAt > now ? Math.max(0, Number(data?.count) || 0) + 1 : 1;
      const nextReset = resetAt > now ? resetAt : now + options.windowMs;
      transaction.set(reference, { count, scope: options.scope, resetAt: Timestamp.fromMillis(nextReset), expiresAt: Timestamp.fromMillis(nextReset + 24 * 60 * 60_000), updatedAt: Timestamp.now() });
      return { allowed: count <= options.limit, retryAfter: count <= options.limit ? 0 : Math.max(1, Math.ceil((nextReset - now) / 1000)) };
    });
  } catch (error) {
    logServerEvent('warn', 'rate_limit_fallback', { scope: options.scope, error });
    return localCheck(key, options);
  }
}
export function checkRateLimit(request: Request, options: RateLimitOptions) { return distributedCheck(`ip:${digest(clientAddress(request))}`, options); }
export function checkRateLimitForIdentifier(identifier: string, options: RateLimitOptions) { return distributedCheck(`actor:${digest(identifier.slice(0, 256))}`, options); }
