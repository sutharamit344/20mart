import { changeOwnPassword } from '@20mart/server';
import { adminRoute } from '@20mart/server/next';

/** Any signed-in admin may change their own password (other sessions are revoked). */
export const POST = adminRoute(null, async ({ req, admin }) => {
  await changeOwnPassword(admin, await req.json());
  return { ok: true };
});
