import { adminRoute, json } from '@20mart/server/next';
import { receiveGoods } from '@20mart/server';
import { readJson } from '../../../../../../lib/route-helpers';

/** Confirm physically received goods: the ONLY way a purchase order adds stock. */
export const POST = adminRoute('purchasing.receive', async ({ req, admin, params }) => json(await receiveGoods(admin, params.id, await readJson(req)), 201));
