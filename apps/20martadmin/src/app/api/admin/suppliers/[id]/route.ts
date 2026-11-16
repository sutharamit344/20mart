import { adminRoute } from '@20mart/server/next';
import { saveSupplier } from '@20mart/server';
import { readJson } from '../../../../../lib/route-helpers';

export const PATCH = adminRoute('suppliers.manage', async ({ req, admin, params }) => saveSupplier(admin, params.id, await readJson(req)));
