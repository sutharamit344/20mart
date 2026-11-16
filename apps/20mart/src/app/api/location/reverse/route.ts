import { customerRoute } from '@20mart/server/next';
import { reverseGeocode } from '@20mart/server';

export const dynamic = 'force-dynamic';

/** Browser coordinates (sent only after the customer allowed location access) → PIN code. Not stored. */
export const POST = customerRoute({ auth: 'optional', rateLimit: { key: 'geocode', limit: 10, windowMs: 60_000 } }, async ({ req }) =>
  reverseGeocode(await req.json().catch(() => ({})))
);
