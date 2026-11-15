import { customerRoute } from '@20mart/server/next';
import { addToWishlist, listWishlist } from '@20mart/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const GET = customerRoute({ auth: 'required' }, async ({ customer }) => listWishlist(customer!.id));
export const POST = customerRoute({ auth: 'required', rateLimit: { key: 'wishlist', limit: 60, windowMs: 60_000 } }, async ({ req, customer }) => {
  const { productId } = z.object({ productId: z.string() }).parse(await req.json().catch(() => ({})));
  await addToWishlist(customer!.id, productId);
  return listWishlist(customer!.id);
});
