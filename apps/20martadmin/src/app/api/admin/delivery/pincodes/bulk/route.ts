import { adminRoute } from '@20mart/server/next';
import { bulkUpsertPincodes } from '@20mart/server';
import { readJson } from '../../../../../../lib/route-helpers';

export const POST = adminRoute('delivery.manage', async ({ req, admin }) => bulkUpsertPincodes(admin, await readJson(req)));
