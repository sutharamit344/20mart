/**
 * Fixed-window rate limiter.
 *
 * - Shared store (recommended on serverless): Upstash Redis over its REST API, enabled when
 *   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or Vercel's KV_REST_API_URL + KV_REST_API_TOKEN)
 *   are set. Counts are shared by every instance, so limits hold on Vercel.
 * - Fallback: in-memory per process (dev, tests, or if Redis is unreachable). Durable limits for
 *   admin login are additionally enforced in the database.
 */
import { logger } from './observability';

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
}

/* ───────────── in-memory (per process) ───────────── */
const buckets = new Map<string, { count: number; resetAt: number }>();

function memoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return { ok: true, retryAfterSec: 0 };
  }
  b.count++;
  return { ok: b.count <= limit, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
}

/* ───────────── shared (Upstash Redis REST) ───────────── */
type Fetch = typeof fetch;
let fetchImpl: Fetch | null = null;
/** Test hook: inject a fake fetch for the Redis REST API. */
export function setRateLimitFetchForTests(f: Fetch | null) {
  fetchImpl = f;
}

function redisConfig(): { url: string; token: string } | null {
  const url = (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '').trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '').trim();
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

export const sharedRateLimitConfigured = () => redisConfig() !== null;

let lastWarn = 0;
async function redisLimit(cfg: { url: string; token: string }, key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const k = `rl:${key}`;
  const res = await (fetchImpl ?? fetch)(`${cfg.url}/pipeline`, {
    method: 'POST',
    headers: { authorization: `Bearer ${cfg.token}`, 'content-type': 'application/json' },
    // INCR, start the window on first hit only (NX), then read the remaining window.
    body: JSON.stringify([['INCR', k], ['PEXPIRE', k, String(windowMs), 'NX'], ['PTTL', k]]),
    cache: 'no-store',
    signal: AbortSignal.timeout(1_000),
  });
  if (!res.ok) throw new Error(`Rate-limit store HTTP ${res.status}`);
  const out = (await res.json()) as { result?: unknown; error?: string }[];
  const count = Number(out?.[0]?.result);
  if (!Number.isFinite(count) || out[0]?.error) throw new Error('Rate-limit store returned an invalid response');
  const ttl = Number(out?.[2]?.result);
  const retryAfterSec = Math.max(1, Math.ceil((ttl > 0 ? ttl : windowMs) / 1000));
  return { ok: count <= limit, retryAfterSec: count <= limit ? 0 : retryAfterSec };
}

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const cfg = redisConfig();
  if (cfg) {
    try {
      return await redisLimit(cfg, key, limit, windowMs);
    } catch (e) {
      // Fail over to the per-process limiter rather than blocking or opening everything.
      if (Date.now() - lastWarn > 60_000) {
        lastWarn = Date.now();
        logger.warn('ratelimit.store_unavailable', { category: 'app', reason: e instanceof Error ? e.message : String(e) });
      }
    }
  }
  return memoryLimit(key, limit, windowMs);
}

export function resetRateLimits() {
  buckets.clear();
}
