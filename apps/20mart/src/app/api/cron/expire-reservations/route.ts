import { NextResponse, type NextRequest } from 'next/server';
import { env, expireStaleReservations } from '@20mart/server';
import { safeEqual } from '@20mart/server/crypto';

export const dynamic = 'force-dynamic';

/** Scheduled job: fail abandoned online-payment orders and release their reserved stock. */
export async function POST(req: NextRequest) {
  const secret = env().CRON_SECRET;
  if (!secret || !safeEqual(req.headers.get('x-cron-secret') ?? '', secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(await expireStaleReservations());
}
