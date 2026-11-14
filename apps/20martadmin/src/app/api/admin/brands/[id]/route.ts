import { adminRoute } from '@20mart/server/next';
import { deleteBrand, updateBrand } from '@20mart/server';
import { readJson } from '../../../../../lib/route-helpers';

export const PATCH = adminRoute('brands.update', async ({ req, admin, params }) => updateBrand(admin, params.id, await readJson(req)));
export const DELETE = adminRoute('brands.delete', async ({ admin, params }) => {
  await deleteBrand(admin, params.id);
  return { ok: true };
});
