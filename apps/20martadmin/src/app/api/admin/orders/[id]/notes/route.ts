import { adminRoute } from '@20mart/server/next';
import { addOrderNote } from '@20mart/server';
import { json } from '@20mart/server/next';
import { readJson } from '../../../../../../lib/route-helpers';

export const POST = adminRoute('orders.update', async ({ req, admin, params }) => json(await addOrderNote(admin, params.id, await readJson(req)), 201));
