import { customerRoute } from '@20mart/server/next';
import { verifyCheckoutPayment } from '@20mart/server';

/** Browser callback after Razorpay checkout. Verified server-side (signature + provider fetch + amount). */
export const POST = customerRoute({ auth: 'required', rateLimit: { key: 'pay-verify', limit: 20, windowMs: 60_000 } }, async ({ req, customer }) =>
  verifyCheckoutPayment(customer!.id, await req.json().catch(() => ({})), { req, userId: customer!.id })
);
