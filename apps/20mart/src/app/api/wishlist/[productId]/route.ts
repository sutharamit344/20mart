import { customerRoute } from '@20mart/server/next';
import { listWishlist, removeFromWishlist } from '@20mart/server';

export const DELETE = customerRoute({ auth: 'required' }, async ({ params, customer }) => {
  await removeFromWishlist(customer!.id, params.productId);
  return listWishlist(customer!.id);
});
