import { customerRoute } from '@20mart/server/next';
import { checkServiceability, trackDeliveryCheck } from '@20mart/server';
import { analyticsOwnerKey } from '../../../../lib/location-server';

export const dynamic = 'force-dynamic';

export const GET = customerRoute({ auth: 'optional', rateLimit: { key: 'pincode', limit: 30, windowMs: 60_000 } }, async ({ req, customer, guestToken }) => {
  const result = await checkServiceability(req.nextUrl.searchParams.get('pincode') ?? '');
  trackDeliveryCheck(result, { req, userId: customer?.id ?? null }, 'pincode_check', analyticsOwnerKey(req, customer, guestToken));
  return result;
});
