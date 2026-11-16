import { adminRoute } from '@20mart/server/next';
import { deleteZone, saveZone } from '@20mart/server';
import { readJson } from '../../../../../../lib/route-helpers';

export const PATCH = adminRoute('delivery.update', async ({ req, admin, params }) => saveZone(admin, params.id, await readJson(req)));
export const DELETE = adminRoute('delivery.update', async ({ admin, params }) => deleteZone(admin, params.id));
