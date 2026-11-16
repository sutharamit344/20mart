import { NextResponse, type NextRequest } from 'next/server';
import { captureException, env, runMaintenance } from '@20mart/server';
import { safeEqual } from '@20mart/server/crypto';

export const dynamic = 'force-dynamic';

/** Scheduled job (daily): purge expired sessions, old login-throttle rows and abandoned guest carts. */
export async function POST(req: NextRequest) {
  const secret = env().CRON_SECRET;
  if (!secret || !safeEqual(req.headers.get('x-cron-secret') ?? (req.headers.get('authorization') ?? '').replace(/^Bearer /, ''), secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json(await runMaintenance());
  } catch (e) {
    const reference = captureException(e, 'cron.maintenance_failed', { category: 'cron' });
    return NextResponse.json({ error: 'Maintenance failed', reference }, { status: 500 });
  }
}

/** Vercel Cron sends GET with Authorization: Bearer $CRON_SECRET. */
export const GET = POST;
