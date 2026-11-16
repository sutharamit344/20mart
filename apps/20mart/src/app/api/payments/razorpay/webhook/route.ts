import { NextResponse, type NextRequest } from 'next/server';
import { processRazorpayWebhook } from '@20mart/server';
import { errorResponse } from '@20mart/server/next';

export const dynamic = 'force-dynamic';

/**
 * Razorpay → 20Mart webhook. Authenticated only by the HMAC signature over the raw body
 * (no cookies, no origin). Duplicate deliveries are acknowledged and ignored.
 */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (raw.length > 256 * 1024) return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    const result = await processRazorpayWebhook(raw, req.headers.get('x-razorpay-signature'), req.headers.get('x-razorpay-event-id'));
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err, req);
  }
}
