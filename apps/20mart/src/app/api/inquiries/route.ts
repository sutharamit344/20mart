import { NextResponse, type NextRequest } from 'next/server';
import { createInquiry, customerSessionCookie, getCustomerBySessionToken, rateLimit, toAppError } from '@20mart/server';
import { clientMeta } from '@20mart/server/next';

// NOTE: there is intentionally no GET handler. Inquiries contain customer PII and are
// only readable in the authenticated admin app (permission inquiries.view).

/** Contact form submission → ContactInquiry row in PostgreSQL. */
export async function POST(req: NextRequest) {
  const ip = clientMeta(req).ipAddress ?? 'unknown';
  if (!(await rateLimit(`inquiry:${ip}`, 5, 10 * 60 * 1000)).ok) {
    return NextResponse.json({ error: 'Too many messages. Please try again later.' }, { status: 429 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const customer = await getCustomerBySessionToken(req.cookies.get(customerSessionCookie().name)?.value);
    const { ticketNumber } = await createInquiry(body, customer?.id ?? null);
    // Only the non-sensitive ticket reference is echoed back.
    return NextResponse.json({ success: true, inquiry: { ticketNumber } }, { status: 201 });
  } catch (err) {
    const e = toAppError(err);
    return NextResponse.json({ error: e.status === 400 ? 'Name, a valid email and a message (10+ characters) are required' : e.message }, { status: e.status });
  }
}
