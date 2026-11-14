import { adminRoute } from '@20mart/server/next';
import { createPricePoint, listPricePoints } from '@20mart/server';
import { json } from '@20mart/server/next';
import { readJson } from '../../../../lib/route-helpers';

export const GET = adminRoute('products.view', async () => ({ items: await listPricePoints() }));
export const POST = adminRoute('pricepoints.manage', async ({ req, admin }) => json(await createPricePoint(admin, await readJson(req)), 201));
