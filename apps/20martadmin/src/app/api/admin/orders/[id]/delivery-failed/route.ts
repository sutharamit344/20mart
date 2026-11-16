import { adminRoute } from '@20mart/server/next';
import { markDeliveryFailed } from '@20mart/server';
import { readJson } from '../../../../../../lib/route-helpers';

export const POST = adminRoute('orders.cancel', async ({ req, admin, params }) => markDeliveryFailed(admin, params.id, await readJson(req)));
