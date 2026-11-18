import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { analyticsSessionCookie, analyticsVisitorCookie, ingestClientEvents, logger, trackingContext } from '@20mart/server';
import { assertBodySize, customerRoute } from '@20mart/server/next';

export const dynamic = 'force-dynamic';

const MAX_BODY = 32 * 1024;

/**
 * Browser analytics events (batched, same-origin only, rate-limited).
 * Stores nothing without analytics consent. Analytics storage failures never surface as errors to
 * the shopper: a malformed batch is a 400, anything else is logged and answered with 202.
 */
export const POST = customerRoute({ auth: 'optional', rateLimit: { key: 'analytics-events', limit: 120, windowMs: 60_000 } }, async ({ req, customer }) => {
  assertBodySize(req, MAX_BODY);
  const body = await req.json().catch(() => {
    throw new ZodError([{ code: 'custom', path: [], message: 'Malformed JSON body' }]);
  });
  try {
    const ctx = await trackingContext(req, customer?.id ?? null);
    const r = await ingestClientEvents(body, ctx);
    const res = NextResponse.json({ accepted: r.accepted, duplicates: r.duplicates, dropped: r.dropped, ...(r.reason ? { reason: r.reason } : {}) }, { status: 202, headers: { 'cache-control': 'no-store' } });
    if (r.setVisitorToken) {
      const c = analyticsVisitorCookie();
      res.cookies.set(c.name, r.setVisitorToken, c.options);
    }
    if (r.setSessionToken) {
      const c = analyticsSessionCookie(r.sessionIdleMinutes);
      res.cookies.set(c.name, r.setSessionToken, c.options);
    }
    return res;
  } catch (e) {
    if (e instanceof ZodError) throw e;
    logger.warn('analytics.ingest_failed', { category: 'app', error: (e as Error)?.message?.slice(0, 200) });
    return NextResponse.json({ accepted: 0 }, { status: 202, headers: { 'cache-control': 'no-store' } });
  }
});
