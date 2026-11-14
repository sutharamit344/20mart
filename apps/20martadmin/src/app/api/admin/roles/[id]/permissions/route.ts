import { adminRoute } from '@20mart/server/next';
import { updateRolePermissions } from '@20mart/server';
import { readJson } from '../../../../../../lib/route-helpers';

export const PUT = adminRoute('roles.manage', async ({ req, admin, params }) => {
  await updateRolePermissions(admin, params.id, await readJson(req));
  return { ok: true };
});
