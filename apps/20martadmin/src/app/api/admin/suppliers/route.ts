import { adminRoute, json } from '@20mart/server/next';
import { listSuppliers, saveSupplier, supplierListQuery } from '@20mart/server';
import { readJson } from '../../../../lib/route-helpers';

export const GET = adminRoute('suppliers.view', async ({ req }) => listSuppliers(supplierListQuery.parse(Object.fromEntries(req.nextUrl.searchParams))));
export const POST = adminRoute('suppliers.manage', async ({ req, admin }) => json(await saveSupplier(admin, null, await readJson(req)), 201));
