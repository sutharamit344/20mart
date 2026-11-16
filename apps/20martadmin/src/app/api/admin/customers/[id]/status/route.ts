import { adminRoute } from '@20mart/server/next';
import { setCustomerStatus } from '@20mart/server';
import { readJson } from '../../../../../../lib/route-helpers';

export const PATCH = adminRoute('customers.update', async ({ req, admin, params }) => setCustomerStatus(admin, params.id, await readJson(req)));
