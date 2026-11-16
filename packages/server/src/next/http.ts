import { NextResponse, type NextRequest } from 'next/server';
import type { ZodSchema } from 'zod';
import { env } from '../env';
import { AppError, badRequest, toAppError } from '../errors';
import { adminSessionCookie, customerSessionCookie, guestCartCookie } from '../cookies';
import { getCustomerBySessionToken, type CurrentCustomer } from '../auth/customer';
import { rateLimit } from '../rateLimit';
import { assertPermission, getAdminContext, type AdminContext } from '../auth/admin';
import { captureException, logger, type LogCategory } from '../observability';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Next.js uses thrown errors for control flow (dynamic usage, redirect, notFound); never swallow them. */
function isNextInternalError(err: unknown) {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return typeof digest === 'string' && (digest === 'DYNAMIC_SERVER_USAGE' || digest.startsWith('NEXT_'));
}

/** Monitoring area of a route, derived from its path. */
export function routeCategory(path: string): LogCategory {
  if (path.includes('/webhook')) return 'webhook';
  if (path.startsWith('/api/payments') || path.includes('/refunds')) return 'payment';
  if (path.startsWith('/api/orders') || path.startsWith('/api/checkout') || path.startsWith('/api/admin/orders')) return 'order';
  if (path.includes('/auth')) return 'auth';
  if (path.startsWith('/api/cron')) return 'cron';
  return 'api';
}

function errorCategory(err: unknown, fallback: LogCategory): LogCategory {
  const name = (err as Error | null)?.name ?? '';
  if (name.startsWith('PrismaClient') || name === 'NotFoundError') return 'db';
  if (name === 'PaymentProviderError') return 'payment';
  if (name === 'EmailProviderError') return 'notification';
  return fallback;
}

/**
 * Convert any error into a safe JSON response (no stack traces or internals) and record it:
 *  - 5xx → captureException (structured log + Sentry/webhook if configured); the response carries
 *    a `reference` id so support can find the event.
 *  - security-relevant 4xx (401/403/429, bad signatures) and payment/order rejections → warn/info logs.
 */
export function errorResponse(err: unknown, req?: Pick<NextRequest, 'method' | 'nextUrl'>) {
  if (isNextInternalError(err)) throw err;
  const e = toAppError(err);
  const path = req?.nextUrl.pathname ?? '';
  const category = routeCategory(path);
  const where = { category, method: req?.method, path, status: e.status, code: e.code };
  let reference: string | undefined;
  if (e.status >= 500) {
    reference = captureException(err, `${errorCategory(err, category)}.error`, { ...where, category: errorCategory(err, category) });
  } else if (e.status === 401 || e.status === 403 || e.status === 429 || e.code === 'BAD_SIGNATURE') {
    // Guests hitting sign-in-only endpoints are expected; everything else is worth a warning.
    if (!(e.status === 401 && e.code === 'UNAUTHORIZED' && !path.startsWith('/api/admin'))) logger.warn(`${category}.denied`, where);
  } else if (category === 'payment' || category === 'order' || category === 'webhook') {
    logger.info(`${category}.rejected`, where);
  }
  return NextResponse.json(
    { error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}), ...(reference ? { reference } : {}) } },
    { status: e.status, headers: { 'cache-control': 'no-store' } }
  );
}

const SLOW_MS = () => Number(process.env.SLOW_REQUEST_MS) || 2000;
function reportSlow(req: NextRequest, started: number, status: number) {
  const ms = Math.round(performance.now() - started);
  if (ms >= SLOW_MS()) logger.warn('perf.slow_request', { category: 'perf', method: req.method, path: req.nextUrl.pathname, status, ms });
}

export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } });

const IP_RE = /^[0-9a-fA-F:.]{2,45}$/;

/**
 * Client IP for rate limiting and audit logs.
 * The LEFT-most X-Forwarded-For entries are supplied by the client and can be forged, so they are
 * never used. Resolution order:
 *  1. CLIENT_IP_HEADER (e.g. "cf-connecting-ip" behind Cloudflare, "x-real-ip" behind nginx) when set;
 *  2. the platform-provided address (req.ip, e.g. on Vercel);
 *  3. the X-Forwarded-For entry added by our nearest trusted proxy: TRUST_PROXY_HOPS from the right
 *     (default 1 = one reverse proxy in front of `next start`).
 */
export function clientIp(req: NextRequest): string | null {
  const pick = (v: string | null | undefined) => {
    const ip = v?.trim();
    return ip && IP_RE.test(ip) ? ip : null;
  };
  const custom = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
  if (custom) {
    const ip = pick(req.headers.get(custom)?.split(',')[0]);
    if (ip) return ip;
  }
  if (req.ip) return pick(req.ip);
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const parts = fwd.split(',').map((s) => s.trim()).filter(Boolean);
    const hops = Math.min(Math.max(1, Number(process.env.TRUST_PROXY_HOPS) || 1), parts.length);
    return pick(parts[parts.length - hops]);
  }
  return pick(req.headers.get('x-real-ip'));
}

export function clientMeta(req: NextRequest) {
  return { ipAddress: clientIp(req), userAgent: req.headers.get('user-agent')?.slice(0, 255) ?? null };
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
    const started = performance.now();
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
      reportSlow(req, started, res.status);
      return res;
    } catch (err) {
      const res = errorResponse(err, req);
      reportSlow(req, started, res.status);
      return res;
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
    const started = performance.now();
    try {
      assertSameOrigin(req, env().ADMIN_APP_URL);
      const admin = await getAdminContext(req.cookies.get(adminSessionCookie().name)?.value);
      assertPermission(admin, ...required);
      const result = await handler({ req, admin, params: ctx.params ?? {} });
      const res = result instanceof Response ? result : json(result ?? { ok: true });
      reportSlow(req, started, res.status);
      return res;
    } catch (err) {
      const res = errorResponse(err, req);
      reportSlow(req, started, res.status);
      return res;
    }
  };
}
