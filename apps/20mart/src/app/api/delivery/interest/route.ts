import { customerRoute } from '@20mart/server/next';
import { submitDeliveryInterest } from '@20mart/server';

export const dynamic = 'force-dynamic';

/** "Notify me when you deliver here" — records demand only; no order, cart hold or reservation. */
export const POST = customerRoute({ auth: 'optional', rateLimit: { key: 'delivery-interest', limit: 5, windowMs: 60_000 } }, async ({ req, customer }) =>
  submitDeliveryInterest(await req.json().catch(() => ({})), customer?.id ?? null)
);
