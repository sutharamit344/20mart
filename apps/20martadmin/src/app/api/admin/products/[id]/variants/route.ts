import { adminRoute } from '@20mart/server/next';
import { addVariant } from '@20mart/server';
import { json } from '@20mart/server/next';
import { readJson } from '../../../../../../lib/route-helpers';

export const POST = adminRoute('products.update', async ({ req, admin, params }) => json(await addVariant(admin, params.id, await readJson(req)), 201));
