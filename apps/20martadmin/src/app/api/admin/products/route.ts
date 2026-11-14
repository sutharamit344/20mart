import { adminRoute } from '@20mart/server/next';
import { createProduct, listProducts, productListQuery } from '@20mart/server';
import { json } from '@20mart/server/next';
import { readJson } from '../../../../lib/route-helpers';

export const GET = adminRoute('products.view', async ({ req }) =>
  listProducts(productListQuery.parse(Object.fromEntries(req.nextUrl.searchParams)))
);
export const POST = adminRoute('products.create', async ({ req, admin }) => json(await createProduct(admin, await readJson(req)), 201));
