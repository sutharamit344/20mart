import { NextResponse, type NextRequest } from 'next/server';
import {
  completeGoogleLogin,
  createCustomerSession,
  customerSessionCookie,
  deleteCustomerSession,
  guestCartCookie,
  mergeGuestCart,
  oauthStateCookie,
  rateLimit,
  toAppError,
  upsertGoogleCustomer,
  onCustomerSignup,
  captureException,
  logger,
} from '@20mart/server';
import { clientMeta } from '@20mart/server/next';

export const dynamic = 'force-dynamic';

const ERROR_CODES: Record<string, string> = {
  OAUTH_DENIED: 'cancelled',
  OAUTH_STATE_INVALID: 'expired',
  EMAIL_NOT_VERIFIED: 'email_unverified',
  ACCOUNT_SUSPENDED: 'suspended',
  ACCOUNT_LINK_REQUIRED: 'link_required',
};

/** Google redirects here. Verify everything server-side, then issue our own session. */
export async function GET(req: NextRequest) {
  const meta = clientMeta(req);
  const stateCookie = oauthStateCookie();
  const sessionCookie = customerSessionCookie();
  const fail = (code: string) => {
    const res = NextResponse.redirect(new URL(`/auth?error=${code}`, req.url));
    res.cookies.delete(stateCookie.name);
    return res;
  };

  if (!rateLimit(`oauth-cb:${meta.ipAddress ?? 'unknown'}`, 30, 60_000).ok) return fail('rate_limited');

  try {
    const sp = req.nextUrl.searchParams;
    const { identity, returnTo } = await completeGoogleLogin({
      code: sp.get('code'),
      state: sp.get('state'),
      error: sp.get('error'),
      stateCookie: req.cookies.get(stateCookie.name)?.value,
    });
    const { userId, created } = await upsertGoogleCustomer(identity);
    if (created) await onCustomerSignup(userId, identity.name ?? null); // welcome notification + auto-issued coupons

    // Rotate: drop any session presented with this request, then issue a new one.
    await deleteCustomerSession(req.cookies.get(sessionCookie.name)?.value);
    const { token, expiresAt } = await createCustomerSession(userId, meta);

    // Bring the guest cart along (merged, capped by stock; the customer's cart is never overwritten).
    const cartCookie = guestCartCookie();
    await mergeGuestCart(req.cookies.get(cartCookie.name)?.value, userId).catch((e) => captureException(e, 'order.cart_merge_failed', { category: 'order' }));

    const res = NextResponse.redirect(new URL(returnTo, req.url));
    res.cookies.set(sessionCookie.name, token, { ...sessionCookie.options, expires: expiresAt });
    res.cookies.set(cartCookie.name, '', { ...cartCookie.options, maxAge: 0 });
    res.cookies.delete(stateCookie.name);
    res.headers.set('cache-control', 'no-store');
    return res;
  } catch (err) {
    const e = toAppError(err);
    if (e.status >= 500) captureException(err, 'auth.google_callback_failed', { category: 'auth' });
    else logger.warn('auth.google_signin_rejected', { category: 'auth', code: e.code, status: e.status });
    return fail(ERROR_CODES[e.code] ?? 'failed');
  }
}
