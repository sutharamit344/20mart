import { NextResponse, type NextRequest } from 'next/server';
import { processResendWebhook } from '@20mart/server';
import { errorResponse } from '@20mart/server/next';

export const dynamic = 'force-dynamic';

/**
 * Resend delivery events (Svix-signed). Only verified events can mark an email
 * DELIVERED / BOUNCED / COMPLAINED — nothing else claims delivery.
 */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (raw.length > 256 * 1024) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    const result = await processResendWebhook(raw, {
      id: req.headers.get('svix-id'),
      timestamp: req.headers.get('svix-timestamp'),
      signature: req.headers.get('svix-signature'),
    });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err, req);
  }
}
