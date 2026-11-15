import { adminRoute } from '@20mart/server/next';
import { transitionOrder } from '@20mart/server';
import { readJson } from '../../../../../../lib/route-helpers';

export const POST = adminRoute('orders.update', async ({ req, admin, params }) => transitionOrder(admin, params.id, await readJson(req)));
