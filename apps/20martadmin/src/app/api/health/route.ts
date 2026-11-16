import { NextResponse, type NextRequest } from 'next/server';
import { captureException, env, healthReport } from '@20mart/server';
import { safeEqual } from '@20mart/server/crypto';

export const dynamic = 'force-dynamic';

/**
 * Health probe for load balancers / uptime monitors: 200 when the app can reach PostgreSQL, else 503.
 * With header `x-health-secret: <CRON_SECRET>` it also reports integrations and production config
 * warnings (booleans only — never secret values).
 */
export async function GET(req: NextRequest) {
  try {
    const secret = env().CRON_SECRET;
    const detailed = !!secret && safeEqual(req.headers.get('x-health-secret') ?? '', secret);
    const report = await healthReport(detailed);
    if (report.status !== 'ok') captureException(new Error('Health check failed: database unreachable'), 'db.health_check_failed', { category: 'db' });
    return NextResponse.json({ app: 'admin', ...report }, { status: report.status === 'ok' ? 200 : 503, headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    captureException(e, 'app.health_check_error', { category: 'app' });
    return NextResponse.json({ app: 'admin', status: 'down' }, { status: 503, headers: { 'cache-control': 'no-store' } });
  }
}
