import { customerRoute } from '@20mart/server/next';
import { moveWishlistItemToCart } from '@20mart/server';
import { z } from 'zod';

export const POST = customerRoute({ auth: 'required' }, async ({ req, params, customer }) => {
  const { variantId } = z.object({ variantId: z.string().uuid().nullish() }).parse(await req.json().catch(() => ({})));
  return moveWishlistItemToCart(customer!.id, params.productId, variantId, { req, userId: customer!.id });
});
