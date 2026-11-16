import { adminRoute } from '@20mart/server/next';
import { setWarehouseStatus } from '@20mart/server';
import { readJson } from '../../../../../../lib/route-helpers';

export const POST = adminRoute('warehouses.manage', async ({ req, admin, params }) => setWarehouseStatus(admin, params.id, await readJson(req)));
