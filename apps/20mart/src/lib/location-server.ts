import type { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { locationCookie } from '@20mart/server';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

/** Customer's selected delivery PIN from the location cookie (validated again by every service). */
export const locationFrom = (req: NextRequest) => ({ pincode: req.cookies.get(locationCookie().name)?.value ?? null });

/**
 * A stable key for de-duplicating repeated analytics signals from the same shopper (e.g. checking
 * the same PIN twice), from the functional session/cart cookies only. It is only ever hashed into an
 * event id with a server secret — never stored. The analytics visitor cookie is NOT used here: it is
 * consent-gated, so that fallback is resolved server-side after the consent check.
 */
export function analyticsOwnerKey(_req: NextRequest, customer: { id: string } | null, guestToken: string | null) {
  if (customer) return `u:${customer.id}`;
  if (guestToken) return `g:${sha256(guestToken)}`;
  return null;
}
