import { customerRoute } from '@20mart/server/next';
import { applyCouponToCart, removeCouponFromCart } from '@20mart/server';

export const dynamic = 'force-dynamic';

/** Apply a coupon code to the signed-in customer's cart. The discount is computed on the server. */
export const POST = customerRoute({ auth: 'required', rateLimit: { key: 'coupon-apply', limit: 20, windowMs: 60_000 } }, async ({ req, customer }) =>
  applyCouponToCart(customer!.id, await req.json().catch(() => ({})))
);
export const DELETE = customerRoute({ auth: 'required' }, async ({ customer }) => removeCouponFromCart(customer!.id));
