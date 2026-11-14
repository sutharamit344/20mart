import { adminRoute } from '@20mart/server/next';
import { createRole, listRolesWithPermissions } from '@20mart/server';
import { json } from '@20mart/server/next';
import { readJson } from '../../../../lib/route-helpers';

export const GET = adminRoute('users.view', async () => listRolesWithPermissions());
export const POST = adminRoute('roles.manage', async ({ req, admin }) => json(await createRole(admin, await readJson(req)), 201));
