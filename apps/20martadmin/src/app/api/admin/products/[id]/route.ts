import { adminRoute } from '@20mart/server/next';
import { deleteProduct, getProductForAdmin, updateProduct } from '@20mart/server';
import { readJson } from '../../../../../lib/route-helpers';

export const GET = adminRoute('products.view', async ({ params }) => getProductForAdmin(params.id));
export const PATCH = adminRoute('products.update', async ({ req, admin, params }) => updateProduct(admin, params.id, await readJson(req)));
export const DELETE = adminRoute('products.delete', async ({ admin, params }) => deleteProduct(admin, params.id));
