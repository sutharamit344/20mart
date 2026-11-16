import { adminRoute } from '@20mart/server/next';
import { saveMapping } from '@20mart/server';
import { readJson } from '../../../../../../lib/route-helpers';

/** Map (or update the mapping of) this warehouse to a delivery area. Needs both permissions. */
export const POST = adminRoute(['warehouses.manage', 'delivery.update'], async ({ req, admin, params }) => saveMapping(admin, params.id, await readJson(req)));
