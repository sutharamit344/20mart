import { adminRoute } from '@20mart/server/next';
import { getPurchaseOrder, updatePurchaseOrder } from '@20mart/server';
import { readJson } from '../../../../../lib/route-helpers';

export const GET = adminRoute('purchasing.view', async ({ params }) => getPurchaseOrder(params.id));
export const PATCH = adminRoute('purchasing.manage', async ({ req, admin, params }) => updatePurchaseOrder(admin, params.id, await readJson(req)));
