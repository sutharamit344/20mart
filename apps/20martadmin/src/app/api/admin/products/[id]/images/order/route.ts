import { adminRoute } from '@20mart/server/next';
import { reorderProductImages } from '@20mart/server';
import { readJson } from '../../../../../../../lib/route-helpers';

export const PUT = adminRoute('products.update', async ({ req, admin, params }) => {
  await reorderProductImages(admin, params.id, await readJson(req));
  return { ok: true };
});
