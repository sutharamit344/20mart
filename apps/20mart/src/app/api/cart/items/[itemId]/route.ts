import { customerRoute } from '@20mart/server/next';
import { removeItem, setQuantity } from '@20mart/server';
import { locationFrom } from '../../../../../lib/location-server';
const owner = (c: { id: string } | null, g: string | null) => (c ? { userId: c.id } : g ? { guestToken: g } : null);

export const PATCH = customerRoute(
  { auth: 'optional', rateLimit: { key: 'cart-update', limit: 120, windowMs: 60_000 } },
  async ({ req, params, customer, guestToken }) => setQuantity(owner(customer, guestToken), params.itemId, await req.json().catch(() => ({})), locationFrom(req), { req, userId: customer?.id ?? null })
);
export const DELETE = customerRoute({ auth: 'optional' }, async ({ req, params, customer, guestToken }) => removeItem(owner(customer, guestToken), params.itemId, locationFrom(req), { req, userId: customer?.id ?? null }));
