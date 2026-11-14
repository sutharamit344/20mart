import { NextResponse, type NextRequest } from 'next/server';
import type { ZodSchema } from 'zod';
import { env } from '../env';
import { AppError, badRequest, toAppError } from '../errors';
import { adminSessionCookie } from '../cookies';
import { assertPermission, getAdminContext, type AdminContext } from '../auth/admin';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function errorResponse(err: unknown) {
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
