import { customerRoute } from '@20mart/server/next';
import { importWishlist } from '@20mart/server';
import { z } from 'zod';

export const POST = customerRoute({ auth: 'required', rateLimit: { key: 'wishlist-import', limit: 5, windowMs: 60_000 } }, async ({ req, customer }) => {
  const { ids } = z.object({ ids: z.array(z.string()).max(100) }).parse(await req.json().catch(() => ({})));
  return importWishlist(customer!.id, ids, { req, userId: customer!.id });
});
