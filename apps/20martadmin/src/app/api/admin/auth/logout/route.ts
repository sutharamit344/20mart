import { type NextRequest } from 'next/server';
import { adminSessionCookie, env, logoutAdmin } from '@20mart/server';
import { assertSameOrigin, errorResponse, json } from '@20mart/server/next';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req, env().ADMIN_APP_URL);
    const cookie = adminSessionCookie();
    await logoutAdmin(req.cookies.get(cookie.name)?.value);
    const res = json({ ok: true });
    res.cookies.set(cookie.name, '', { ...cookie.options, maxAge: 0 });
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
