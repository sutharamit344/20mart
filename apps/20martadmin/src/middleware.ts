import { NextResponse, type NextRequest } from 'next/server';

/**
 * Edge middleware (non-authoritative):
 *  - Blocks cross-origin state-changing API requests (CSRF defence in depth).
 *  - Sends visitors without an admin session cookie to /login.
 * Every page and API route re-validates the session and permissions on the server.
 */
const ADMIN_COOKIES = ['__Host-20m_admin', '20m_admin'];
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/api/')) {
    if (!SAFE.has(req.method)) {
      const origin = req.headers.get('origin');
      const site = req.headers.get('sec-fetch-site');
      const allowed = new Set([req.nextUrl.origin, process.env.ADMIN_APP_URL && new URL(process.env.ADMIN_APP_URL).origin].filter(Boolean));
      if ((origin && !allowed.has(origin)) || (!origin && site && site !== 'same-origin' && site !== 'none')) {
        return NextResponse.json({ error: { code: 'BAD_ORIGIN', message: 'Cross-origin request blocked' } }, { status: 403 });
      }
    }
    return NextResponse.next();
  }

  const hasSession = ADMIN_COOKIES.some((n) => req.cookies.has(n));
  if (!hasSession && pathname !== '/login' && pathname !== '/robots.txt') {
    const url = new URL('/login', req.url);
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Skip static assets and Next internals.
  matcher: ['/((?!_next/|icons/|favicon|site.webmanifest|.*\\.(?:png|jpg|svg|webp|ico)$).*)'],
};
