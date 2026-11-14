import { adminRoute } from '@20mart/server/next';
import { resetAdminPassword } from '@20mart/server';
import { readJson } from '../../../../../../lib/route-helpers';

export const POST = adminRoute('users.manage', async ({ req, admin, params }) => {
  await resetAdminPassword(admin, params.id, await readJson(req));
  return { ok: true };
});
