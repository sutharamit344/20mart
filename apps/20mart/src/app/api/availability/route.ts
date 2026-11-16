import { customerRoute } from '@20mart/server/next';
import { availabilityForPincode, PINCODE_REGEX } from '@20mart/server';
import { locationFrom } from '../../../lib/location-server';

export const dynamic = 'force-dynamic';

/** Stock state of up to 60 products for the customer's selected delivery location. */
export const GET = customerRoute({ auth: 'optional', rateLimit: { key: 'availability', limit: 120, windowMs: 60_000 } }, async ({ req }) => {
  const { pincode } = locationFrom(req);
  if (!pincode || !PINCODE_REGEX.test(pincode)) return { pincode: null, covered: false, products: {} };
  const ids = (req.nextUrl.searchParams.get('ids') ?? '').split(',').filter(Boolean);
  return availabilityForPincode(pincode, ids);
});
