import { prisma } from '@20mart/database';
import { z } from 'zod';
import { randomToken, sha256 } from '../crypto';
import { ADMIN_SESSION_ABSOLUTE_MS, ADMIN_SESSION_IDLE_MS, SESSION_TOUCH_INTERVAL_MS } from '../cookies';
import { AppError, tooManyRequests } from '../errors';
import { getDummyHash, verifyPassword } from './password';
import type { SessionMeta } from './customer';

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILURES_PER_IDENTIFIER = 5;
export const MAX_FAILURES_PER_IP = 20;
export const LOCKOUT_MS = 15 * 60 * 1000;

const GENERIC_LOGIN_ERROR = 'Invalid username/email or password';

export const adminLoginSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(256),
});

export interface AdminContext {
  sessionId: string;
  admin: { id: string; username: string; email: string; name: string };
  roles: string[];
  permissions: Set<string>;
}

const loginFailed = () => new AppError(401, 'INVALID_CREDENTIALS', GENERIC_LOGIN_ERROR);

async function assertNotThrottled(identifier: string, ip: string | null | undefined) {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const [byIdentifier, byIp] = await Promise.all([
    prisma.adminLoginAttempt.count({ where: { identifier, success: false, createdAt: { gte: since } } }),
    ip ? prisma.adminLoginAttempt.count({ where: { ipAddress: ip, success: false, createdAt: { gte: since } } }) : 0,
  ]);
  if (byIdentifier >= MAX_FAILURES_PER_IDENTIFIER || byIp >= MAX_FAILURES_PER_IP) {
    throw tooManyRequests('Too many sign-in attempts. Please wait 15 minutes and try again.');
  }
}

/**
 * Authenticate an admin by username or email + password and create a fresh session.
 * Any session presented with the request is destroyed first (session fixation / rotation).
 */
export async function loginAdmin(
  input: { identifier: string; password: string },
  meta: SessionMeta & { currentToken?: string | null } = {}
) {
  const { identifier: rawId, password } = adminLoginSchema.parse(input);
  const identifier = rawId.toLowerCase();
  const ip = meta.ipAddress?.slice(0, 64) ?? null;

  await assertNotThrottled(identifier, ip);

  const admin = await prisma.adminUser.findFirst({
    where: {
      OR: [
        { username: { equals: identifier, mode: 'insensitive' } },
        { email: { equals: identifier, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, passwordHash: true, status: true, lockedUntil: true, failedLoginCount: true },
  });

  const passwordOk = await verifyPassword(admin?.passwordHash ?? (await getDummyHash()), password);
  const locked = !!admin?.lockedUntil && admin.lockedUntil.getTime() > Date.now();

  if (!admin || !passwordOk || admin.status !== 'ACTIVE' || locked) {
    await prisma.adminLoginAttempt.create({ data: { identifier, ipAddress: ip, success: false } });
    if (admin && !passwordOk) {
      const failures = admin.failedLoginCount + 1;
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: {
          failedLoginCount: failures,
          lockedUntil: failures >= MAX_FAILURES_PER_IDENTIFIER ? new Date(Date.now() + LOCKOUT_MS) : undefined,
        },
      });
    }
    throw loginFailed();
  }

  const token = randomToken();
  const now = new Date();
  await prisma.$transaction([
    ...(meta.currentToken ? [prisma.adminSession.deleteMany({ where: { tokenHash: sha256(meta.currentToken) } })] : []),
    prisma.adminSession.create({
      data: {
        tokenHash: sha256(token),
        adminId: admin.id,
        expiresAt: new Date(now.getTime() + ADMIN_SESSION_ABSOLUTE_MS),
        lastSeenAt: now,
        ipAddress: ip,
        userAgent: meta.userAgent?.slice(0, 255) ?? null,
      },
    }),
    prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: now, failedLoginCount: 0, lockedUntil: null },
    }),
    prisma.adminLoginAttempt.create({ data: { identifier, ipAddress: ip, success: true } }),
    prisma.adminAuditLog.create({
      data: { adminId: admin.id, adminName: admin.name, action: 'Signed in', category: 'AUTH', details: 'Admin login', ipAddress: ip },
    }),
  ]);
  return { token, expiresAt: new Date(now.getTime() + ADMIN_SESSION_ABSOLUTE_MS) };
}

export async function logoutAdmin(token: string | undefined | null) {
  if (!token) return;
  await prisma.adminSession.deleteMany({ where: { tokenHash: sha256(token) } });
}

/**
 * Resolve an admin session token into a full authorization context.
 * Enforces: session exists, not past absolute expiry, not idle, admin ACTIVE.
 * Permissions are loaded from the database on every request.
 */
export async function getAdminContext(token: string | undefined | null): Promise<AdminContext | null> {
  if (!token || token.length > 128) return null;
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: sha256(token) },
    select: {
      id: true,
      expiresAt: true,
      lastSeenAt: true,
      admin: {
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          status: true,
          roles: {
            select: {
              role: { select: { key: true, permissions: { select: { permission: { select: { key: true } } } } } },
            },
          },
        },
      },
    },
  });
  if (!session) return null;
  const now = Date.now();
  const expired = session.expiresAt.getTime() <= now;
  const idle = now - session.lastSeenAt.getTime() > ADMIN_SESSION_IDLE_MS;
  if (expired || idle || session.admin.status !== 'ACTIVE') {
    await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (now - session.lastSeenAt.getTime() > SESSION_TOUCH_INTERVAL_MS) {
    await prisma.adminSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date(now) } }).catch(() => undefined);
  }
  const permissions = new Set<string>();
  const roles: string[] = [];
  for (const r of session.admin.roles) {
    roles.push(r.role.key);
    r.role.permissions.forEach((p) => permissions.add(p.permission.key));
  }
  const { status: _s, roles: _r, ...admin } = session.admin;
  return { sessionId: session.id, admin, roles, permissions };
}

export function hasPermission(ctx: AdminContext | null, permission: string) {
  return !!ctx && ctx.permissions.has(permission);
}

/** Throw 401/403 unless the context holds every listed permission. */
export function assertPermission(ctx: AdminContext | null, ...required: string[]): asserts ctx is AdminContext {
  if (!ctx) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  const missing = required.filter((p) => !ctx.permissions.has(p));
  if (missing.length) throw new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action', { missing });
}
