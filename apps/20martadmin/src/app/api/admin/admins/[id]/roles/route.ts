import { adminRoute } from '@20mart/server/next';
import { setAdminRoles } from '@20mart/server';
import { readJson } from '../../../../../../lib/route-helpers';

export const PUT = adminRoute('roles.manage', async ({ req, admin, params }) => {
  await setAdminRoles(admin, params.id, await readJson(req));
  return { ok: true };
});
