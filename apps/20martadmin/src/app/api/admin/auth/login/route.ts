import { type NextRequest } from 'next/server';
import { adminLoginSchema, adminSessionCookie, env, loginAdmin, rateLimit, tooManyRequests } from '@20mart/server';
import { assertSameOrigin, clientMeta, errorResponse, json, parseJson } from '@20mart/server/next';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req, env().ADMIN_APP_URL);
    const meta = clientMeta(req);
    // Fast in-memory burst limit; durable per-identifier/IP throttling happens in loginAdmin().
    if (!rateLimit(`admin-login:${meta.ipAddress ?? 'unknown'}`, 10, 60_000).ok) throw tooManyRequests();

    const body = await parseJson(req, adminLoginSchema);
    const cookie = adminSessionCookie();
    const { token, expiresAt } = await loginAdmin(body, { ...meta, currentToken: req.cookies.get(cookie.name)?.value });

    const res = json({ ok: true });
    res.cookies.set(cookie.name, token, { ...cookie.options, expires: expiresAt });
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
