import { adminRoute } from '@20mart/server/next';
import { badRequest, setCouponActive } from '@20mart/server';
import { readJson } from '../../../../../../lib/route-helpers';

export const PATCH = adminRoute('coupons.update', async ({ req, admin, params }) => {
  const body = (await readJson(req)) as { isActive?: unknown };
  if (typeof body?.isActive !== 'boolean') throw badRequest('isActive must be true or false');
  return setCouponActive(admin, params.id, body.isActive);
});
