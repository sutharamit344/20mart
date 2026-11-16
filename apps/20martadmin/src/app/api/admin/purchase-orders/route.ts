import { adminRoute, json } from '@20mart/server/next';
import { createPurchaseOrder, listPurchaseOrders, poListQuery } from '@20mart/server';
import { readJson } from '../../../../lib/route-helpers';

export const GET = adminRoute('purchasing.view', async ({ req }) => listPurchaseOrders(poListQuery.parse(Object.fromEntries(req.nextUrl.searchParams))));
export const POST = adminRoute('purchasing.manage', async ({ req, admin }) => json(await createPurchaseOrder(admin, await readJson(req)), 201));
