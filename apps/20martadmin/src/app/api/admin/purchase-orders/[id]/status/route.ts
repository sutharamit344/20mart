import { adminRoute } from '@20mart/server/next';
import { setPurchaseOrderStatus } from '@20mart/server';
import { readJson } from '../../../../../../lib/route-helpers';

export const POST = adminRoute('purchasing.manage', async ({ req, admin, params }) => setPurchaseOrderStatus(admin, params.id, await readJson(req)));
