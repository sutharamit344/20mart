import { adminRoute } from '@20mart/server/next';
import { adjustStock } from '@20mart/server';
import { json } from '@20mart/server/next';
import { readJson } from '../../../../../../lib/route-helpers';

export const POST = adminRoute('inventory.adjust', async ({ req, admin, params }) => json(await adjustStock(admin, params.id, await readJson(req)), 201));
