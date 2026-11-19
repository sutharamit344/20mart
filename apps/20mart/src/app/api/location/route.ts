import { NextResponse } from 'next/server';
import { z } from 'zod';
import { customerRoute } from '@20mart/server/next';
import { checkServiceability, geocodingConfigured, locationCookie, PINCODE_REGEX, trackDeliveryCheck } from '@20mart/server';
import { analyticsOwnerKey, locationFrom } from '../../../lib/location-server';

export const dynamic = 'force-dynamic';

const body = z.object({ pincode: z.string().trim().regex(PINCODE_REGEX, 'Enter a valid 6-digit PIN code') });

/** Current delivery location (from the cookie) with live serviceability. */
export const GET = customerRoute({ auth: 'optional' }, async ({ req }) => {
  const { pincode } = locationFrom(req);
  const valid = pincode && PINCODE_REGEX.test(pincode) ? pincode : null;
  return { pincode: valid, serviceability: valid ? await checkServiceability(valid) : null, gpsAvailable: geocodingConfigured() };
});

/** Choose a delivery PIN code. Stored even when not serviceable, so the site can say so clearly. */
export const POST = customerRoute({ auth: 'optional', rateLimit: { key: 'location-set', limit: 30, windowMs: 60_000 } }, async ({ req, customer, guestToken }) => {
  const { pincode } = body.parse(await req.json().catch(() => ({})));
  const serviceability = await checkServiceability(pincode);
  trackDeliveryCheck(serviceability, { req, userId: customer?.id ?? null }, 'location_set', analyticsOwnerKey(req, customer, guestToken));
  const res = NextResponse.json({ pincode, serviceability, gpsAvailable: geocodingConfigured() });
  const c = locationCookie();
  res.cookies.set(c.name, pincode, c.options);
  return res;
});

export const DELETE = customerRoute({ auth: 'optional' }, async () => {
  const res = NextResponse.json({ pincode: null, serviceability: null });
  const c = locationCookie();
  res.cookies.set(c.name, '', { ...c.options, maxAge: 0 });
  return res;
});
