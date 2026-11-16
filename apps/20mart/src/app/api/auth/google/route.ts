import { NextResponse, type NextRequest } from 'next/server';
import { beginGoogleLogin, oauthStateCookie, rateLimit, toAppError } from '@20mart/server';
import { clientMeta } from '@20mart/server/next';

export const dynamic = 'force-dynamic';

/** Start Google sign-in: set a signed, short-lived state cookie and redirect to Google. */
export async function GET(req: NextRequest) {
  const { ipAddress } = clientMeta(req);
  if (!(await rateLimit(`oauth-start:${ipAddress ?? 'unknown'}`, 20, 60_000)).ok) {
    return NextResponse.redirect(new URL('/auth?error=rate_limited', req.url));
  }
  try {
    const { url, stateCookieValue } = beginGoogleLogin(req.nextUrl.searchParams.get('returnTo'));
    const res = NextResponse.redirect(url);
    const c = oauthStateCookie();
    res.cookies.set(c.name, stateCookieValue, c.options);
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (err) {
    const code = toAppError(err).code === 'GOOGLE_NOT_CONFIGURED' ? 'google_not_configured' : 'server_error';
    return NextResponse.redirect(new URL(`/auth?error=${code}`, req.url));
  }
}
