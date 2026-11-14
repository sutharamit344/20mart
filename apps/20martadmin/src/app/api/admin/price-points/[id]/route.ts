import { adminRoute } from '@20mart/server/next';
import { updatePricePoint } from '@20mart/server';
import { readJson } from '../../../../../lib/route-helpers';

export const PATCH = adminRoute('pricepoints.manage', async ({ req, admin, params }) => updatePricePoint(admin, params.id, await readJson(req)));
