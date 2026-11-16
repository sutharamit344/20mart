import { adminRoute, json } from '@20mart/server/next';
import { listWarehouses, saveWarehouse } from '@20mart/server';
import { readJson } from '../../../../lib/route-helpers';

export const GET = adminRoute('warehouses.view', async () => ({ items: await listWarehouses() }));
export const POST = adminRoute('warehouses.manage', async ({ req, admin }) => json(await saveWarehouse(admin, null, await readJson(req)), 201));
