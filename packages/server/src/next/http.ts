import { NextResponse, type NextRequest } from 'next/server';
import type { ZodSchema } from 'zod';
import { env } from '../env';
import { AppError, badRequest, toAppError } from '../errors';
import { adminSessionCookie, customerSessionCookie, guestCartCookie } from '../cookies';
import { getCustomerBySessionToken, type CurrentCustomer } from '../auth/customer';
import { rateLimit } from '../rateLimit';
import { assertPermission, getAdminContext, type AdminContext } from '../auth/admin';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Next.js uses thrown errors for control flow (dynamic usage, redirect, notFound); never swallow them. */
function isNextInternalError(err: unknown) {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return typeof digest === 'string' && (digest === 'DYNAMIC_SERVER_USAGE' || digest.startsWith('NEXT_'));
}

export function errorResponse(err: unknown) {
  if (isNextInternalError(err)) throw err;
  const e = toAppError(err);
  if (e.status >= 500) console.error('[api] unhandled error:', err);
  return NextResponse.json(
    { error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) } },
    { status: e.status, headers: { 'cache-control': 'no-store' } }
  );
}

export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });

export function clientMeta(req: NextRequest) {
  const fwd = req.headers.get('x-forwarded-for');
  const ip = (fwd ? fwd.split(',')[0] : req.headers.get('x-real-ip'))?.trim() || req.ip || null;
  return { ipAddress: ip, userAgent: req.headers.get('user-agent') };
}

/**
 * CSRF defence in depth: state-changing requests must come from our own origin.
 * (Cookies are also SameSite, and middleware performs the same check.)
 */
export function assertSameOrigin(req: NextRequest, allowedOrigin: string) {
  if (SAFE_METHODS.has(req.method)) return;
  const origin = req.headers.get('origin');
  const expected = new URL(allowedOrigin).origin;
  if (origin) {
    if (origin !== expected && origin !== req.nextUrl.origin) throw new AppError(403, 'BAD_ORIGIN', 'Cross-origin request blocked');
    return;
  }
  const fetchSite = req.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    throw new AppError(403, 'BAD_ORIGIN', 'Cross-origin request blocked');
  }
}

export async function parseJson<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) throw badRequest('Expected application/json');
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest('Malformed JSON body');
  }
  return schema.parse(body);
}

export function parseQuery<T>(req: NextRequest, schema: ZodSchema<T>): T {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
}

type RouteCtx = { params: Record<string, string> };

export interface CustomerRouteArgs {
  req: NextRequest;
  params: Record<string, string>;
  /** Signed-in customer, or null for guests (only when auth is 'optional'). */
  customer: CurrentCustomer | null;
  /** Raw guest cart token from the cookie, if any. */
  guestToken: string | null;
  /** Ask the wrapper to set (string) or clear (null) the guest cart cookie on the response. */
  setGuestToken: (token: string | null) => void;
}

/**
 * Wrap a storefront Route Handler.
 *  - Same-origin check for mutating methods (CSRF defence in depth).
 *  - Resolves the customer from the HTTP-only session cookie (never from the request body).
 *  - auth 'required' → 401 for guests.
 *  - Optional per-IP/customer rate limit.
 */
export function customerRoute(
  opts: { auth: 'required' | 'optional'; rateLimit?: { key: string; limit: number; windowMs: number } },
  handler: (args: CustomerRouteArgs) => Promise<unknown>
) {
  return async (req: NextRequest, ctx: RouteCtx = { params: {} }) => {
    let guestCookieChange: { token: string | null } | null = null;
    try {
      assertSameOrigin(req, env().APP_URL);
      const customer = await getCustomerBySessionToken(req.cookies.get(customerSessionCookie().name)?.value);
      if (opts.auth === 'required' && !customer) throw new AppError(401, 'UNAUTHORIZED', 'Please sign in to continue');
      if (opts.rateLimit) {
        const who = customer?.id ?? clientMeta(req).ipAddress ?? 'anon';
        const r = rateLimit(`${opts.rateLimit.key}:${who}`, opts.rateLimit.limit, opts.rateLimit.windowMs);
        if (!r.ok) throw new AppError(429, 'RATE_LIMITED', 'Too many requests. Please slow down.');
      }
      const guestToken = req.cookies.get(guestCartCookie().name)?.value ?? null;
      const result = await handler({
        req,
        params: ctx.params ?? {},
        customer,
        guestToken: guestToken && guestToken.length <= 128 ? guestToken : null,
        setGuestToken: (token) => {
          guestCookieChange = { token };
        },
      });
      const res = result instanceof Response ? (result as NextResponse) : json(result ?? { ok: true });
      const change = guestCookieChange as { token: string | null } | null;
      if (change) {
        const c = guestCartCookie();
        if (change.token) res.cookies.set(c.name, change.token, c.options);
        else res.cookies.set(c.name, '', { ...c.options, maxAge: 0 });
      }
      return res;
    } catch (err) {
      return errorResponse(err);
    }
  };
}
type AdminHandler = (args: { req: NextRequest; admin: AdminContext; params: Record<string, string> }) => Promise<unknown>;

/**
 * Wrap an admin Route Handler. Every call verifies, on the server:
 *   1. same-origin for mutating methods, 2. a valid admin session,
 *   3. an ACTIVE admin account, 4. the required permission(s).
 * Plain objects returned by the handler are sent as JSON; Responses pass through.
 */
export function adminRoute(permission: string | string[] | null, handler: AdminHandler) {
  const required = permission === null ? [] : Array.isArray(permission) ? permission : [permission];
  return async (req: NextRequest, ctx: RouteCtx = { params: {} }) => {
    try {
      assertSameOrigin(req, env().ADMIN_APP_URL);
      const admin = await getAdminContext(req.cookies.get(adminSessionCookie().name)?.value);
      assertPermission(admin, ...required);
      const result = await handler({ req, admin, params: ctx.params ?? {} });
      if (result instanceof Response) return result;
      return json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}
