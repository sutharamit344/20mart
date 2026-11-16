import { adminRoute, json } from '@20mart/server/next';
import { adjustStockAt } from '@20mart/server';
import { readJson } from '../../../../../lib/route-helpers';

/** Stock change at a warehouse (creates the stock row on first use). */
export const POST = adminRoute('inventory.adjust', async ({ req, admin }) => json(await adjustStockAt(admin, await readJson(req)), 201));
