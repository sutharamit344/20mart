import { adminRoute } from '@20mart/server/next';
import { deleteVariant, updateVariant } from '@20mart/server';
import { readJson } from '../../../../../../../lib/route-helpers';

export const PATCH = adminRoute('products.update', async ({ req, admin, params }) =>
  updateVariant(admin, params.id, params.variantId, await readJson(req))
);
export const DELETE = adminRoute('products.update', async ({ admin, params }) => deleteVariant(admin, params.id, params.variantId));
