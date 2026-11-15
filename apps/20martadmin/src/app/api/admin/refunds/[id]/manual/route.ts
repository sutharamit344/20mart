import { adminRoute } from '@20mart/server/next';
import { recordManualRefund } from '@20mart/server';
import { readJson } from '../../../../../../lib/route-helpers';

export const POST = adminRoute('orders.refund', async ({ req, admin, params }) => {
  await recordManualRefund(admin, params.id, await readJson(req));
  return { ok: true };
});
