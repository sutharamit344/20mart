import { adminRoute } from '@20mart/server/next';
import { createCoupon, listCoupons } from '@20mart/server';
import { readJson } from '../../../../lib/route-helpers';
import { json } from '@20mart/server/next';

export const GET = adminRoute('coupons.view', async ({ req }) => listCoupons(Object.fromEntries(req.nextUrl.searchParams)));
export const POST = adminRoute('coupons.create', async ({ req, admin }) => json(await createCoupon(admin, await readJson(req)), 201));
