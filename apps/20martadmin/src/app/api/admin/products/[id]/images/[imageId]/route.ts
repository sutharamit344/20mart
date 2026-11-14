import { adminRoute } from '@20mart/server/next';
import { deleteProductImage, updateProductImage } from '@20mart/server';
import { readJson } from '../../../../../../../lib/route-helpers';

export const PATCH = adminRoute('products.update', async ({ req, admin, params }) => {
  await updateProductImage(admin, params.id, params.imageId, await readJson(req));
  return { ok: true };
});
export const DELETE = adminRoute('products.update', async ({ admin, params }) => {
  await deleteProductImage(admin, params.id, params.imageId);
  return { ok: true };
});
