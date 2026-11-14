import { adminRoute } from '@20mart/server/next';
import { setLowStockThreshold } from '@20mart/server';
import { readJson } from '../../../../../../lib/route-helpers';

export const PATCH = adminRoute('inventory.update', async ({ req, admin, params }) => setLowStockThreshold(admin, params.id, await readJson(req)));
