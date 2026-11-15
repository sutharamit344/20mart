import { adminRoute } from '@20mart/server/next';
import { listPincodes, upsertPincode } from '@20mart/server';
import { readJson } from '../../../../../lib/route-helpers';

export const GET = adminRoute('delivery.manage', async ({ req }) => {
  const sp = req.nextUrl.searchParams;
  return listPincodes({ q: sp.get('q') ?? undefined, page: Math.max(1, Number(sp.get('page')) || 1), pageSize: 50 });
});
export const POST = adminRoute('delivery.manage', async ({ req, admin }) => upsertPincode(admin, await readJson(req)));
