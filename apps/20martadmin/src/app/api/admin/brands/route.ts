import { adminRoute } from '@20mart/server/next';
import { brandListQuery, createBrand, listBrands } from '@20mart/server';
import { json } from '@20mart/server/next';
import { readJson } from '../../../../lib/route-helpers';

export const GET = adminRoute('brands.view', async ({ req }) => listBrands(brandListQuery.parse(Object.fromEntries(req.nextUrl.searchParams))));
export const POST = adminRoute('brands.create', async ({ req, admin }) => json(await createBrand(admin, await readJson(req)), 201));
