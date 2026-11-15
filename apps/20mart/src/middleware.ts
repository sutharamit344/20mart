import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge middleware — cheap, non-authoritative checks only:
 *  1. CSRF: reject cross-origin state-changing API requests.
 *  2. Redirect obviously signed-out users away from /account.
 * Real session validation happens server-side in layouts and route handlers.
 */
const SESSION_COOKIES = ['__Host-20m_session', '20m_session'];
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Server-to-server endpoints authenticate with signatures/secrets instead of browser origin.
  const machineEndpoint = pathname === '/api/revalidate' || pathname === '/api/payments/razorpay/webhook' || pathname.startsWith('/api/cron/');
  if (pathname.startsWith('/api/') && !SAFE.has(req.method) && !machineEndpoint) {
    const origin = req.headers.get('origin');
    const site = req.headers.get('sec-fetch-site');
    const allowed = new Set([req.nextUrl.origin, process.env.APP_URL && new URL(process.env.APP_URL).origin].filter(Boolean));
    if ((origin && !allowed.has(origin)) || (!origin && site && site !== 'same-origin' && site !== 'none')) {
      return NextResponse.json({ error: { code: 'BAD_ORIGIN', message: 'Cross-origin request blocked' } }, { status: 403 });
    }
  }

  if (pathname.startsWith('/account') || pathname.startsWith('/checkout')) {
    const hasSession = SESSION_COOKIES.some((n) => req.cookies.has(n));
    if (!hasSession) {
      const url = new URL('/auth', req.url);
      url.searchParams.set('returnTo', pathname + req.nextUrl.search);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/account/:path*', '/checkout/:path*', '/checkout'],
};
