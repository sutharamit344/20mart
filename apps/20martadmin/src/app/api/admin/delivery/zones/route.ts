import { adminRoute } from '@20mart/server/next';
import { listZones, saveZone } from '@20mart/server';
import { readJson } from '../../../../../lib/route-helpers';
import { json } from '@20mart/server/next';

export const GET = adminRoute('delivery.view', async () => ({ items: await listZones() }));
export const POST = adminRoute('delivery.update', async ({ req, admin }) => json(await saveZone(admin, null, await readJson(req)), 201));
