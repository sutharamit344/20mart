import { adminRoute } from '@20mart/server/next';
import { createAdmin, listAdmins } from '@20mart/server';
import { json } from '@20mart/server/next';
import { readJson } from '../../../../lib/route-helpers';

export const GET = adminRoute('users.view', async () => ({ items: await listAdmins() }));
export const POST = adminRoute('users.manage', async ({ req, admin }) => json(await createAdmin(admin, await readJson(req)), 201));
