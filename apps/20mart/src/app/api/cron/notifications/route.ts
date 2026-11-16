import { NextResponse, type NextRequest } from 'next/server';
import { captureException, env, processEmailQueue } from '@20mart/server';
import { safeEqual } from '@20mart/server/crypto';

export const dynamic = 'force-dynamic';

/** Scheduled job: send queued emails and retry retryable failures. */
export async function POST(req: NextRequest) {
  const secret = env().CRON_SECRET;
  if (!secret || !safeEqual(req.headers.get('x-cron-secret') ?? '', secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json(await processEmailQueue(50));
  } catch (e) {
    const reference = captureException(e, 'cron.email_queue_failed', { category: 'cron' });
    return NextResponse.json({ error: 'Job failed', reference }, { status: 500 });
  }
}
