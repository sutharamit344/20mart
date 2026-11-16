import { adminRoute } from '@20mart/server/next';
import { deleteCoupon, getCoupon, updateCoupon } from '@20mart/server';
import { readJson } from '../../../../../lib/route-helpers';

export const GET = adminRoute('coupons.view', async ({ params }) => getCoupon(params.id));
export const PUT = adminRoute('coupons.update', async ({ req, admin, params }) => updateCoupon(admin, params.id, await readJson(req)));
export const DELETE = adminRoute('coupons.delete', async ({ admin, params }) => deleteCoupon(admin, params.id));
