import { type NextRequest } from 'next/server';
import { customerSessionCookie, deleteCustomerSession } from '@20mart/server';
import { assertSameOrigin, errorResponse, json } from '@20mart/server/next';
import { env } from '@20mart/server';

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req, env().APP_URL);
    const c = customerSessionCookie();
    await deleteCustomerSession(req.cookies.get(c.name)?.value);
    const res = json({ ok: true });
    res.cookies.set(c.name, '', { ...c.options, maxAge: 0 });
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
