import { adminRoute } from '@20mart/server/next';
import { deleteCategory, updateCategory } from '@20mart/server';
import { readJson } from '../../../../../lib/route-helpers';

export const PATCH = adminRoute('categories.update', async ({ req, admin, params }) => updateCategory(admin, params.id, await readJson(req)));
export const DELETE = adminRoute('categories.delete', async ({ admin, params }) => {
  await deleteCategory(admin, params.id);
  return { ok: true };
});
