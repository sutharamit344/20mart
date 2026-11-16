import { adminRoute } from '@20mart/server/next';
import { issueCouponToCustomers } from '@20mart/server';
import { readJson } from '../../../../../../lib/route-helpers';

export const POST = adminRoute('coupons.update', async ({ req, admin, params }) => issueCouponToCustomers(admin, params.id, await readJson(req)));
