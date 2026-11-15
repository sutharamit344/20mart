import { adminRoute } from '@20mart/server/next';
import { adminCancelOrder } from '@20mart/server';
import { readJson } from '../../../../../../lib/route-helpers';

export const POST = adminRoute('orders.cancel', async ({ req, admin, params }) => adminCancelOrder(admin, params.id, await readJson(req)));
