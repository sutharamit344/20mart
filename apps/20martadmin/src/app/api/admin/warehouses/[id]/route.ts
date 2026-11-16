import { adminRoute } from '@20mart/server/next';
import { getWarehouse, saveWarehouse } from '@20mart/server';
import { readJson } from '../../../../../lib/route-helpers';

export const GET = adminRoute('warehouses.view', async ({ params }) => getWarehouse(params.id));
export const PATCH = adminRoute('warehouses.manage', async ({ req, admin, params }) => saveWarehouse(admin, params.id, await readJson(req)));
