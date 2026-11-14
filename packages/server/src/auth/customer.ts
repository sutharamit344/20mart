import { prisma } from '@20mart/database';
import { randomToken, sha256 } from '../crypto';
import { CUSTOMER_SESSION_TTL_MS, SESSION_TOUCH_INTERVAL_MS } from '../cookies';
import { AppError } from '../errors';

export interface SessionMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface CurrentCustomer {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

/** Create a new customer session. Returns the raw token (cookie value) — only its hash is stored. */
export async function createCustomerSession(userId: string, meta: SessionMeta = {}) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + CUSTOMER_SESSION_TTL_MS);
  await prisma.userSession.create({
    data: {
      tokenHash: sha256(token),
      userId,
      expiresAt,
      ipAddress: meta.ipAddress?.slice(0, 64) ?? null,
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
    },
  });
  return { token, expiresAt };
}

/** Resolve a session token to an active customer, sliding the expiry. Returns null when invalid. */
export async function getCustomerBySessionToken(token: string | undefined | null): Promise<CurrentCustomer | null> {
  if (!token || token.length > 128) return null;
  const session = await prisma.userSession.findUnique({
    where: { tokenHash: sha256(token) },
    select: {
      id: true,
      expiresAt: true,
      lastSeenAt: true,
      user: { select: { id: true, name: true, email: true, image: true, status: true } },
    },
  });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() <= now || session.user.status !== 'ACTIVE') {
    await prisma.userSession.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (now - session.lastSeenAt.getTime() > SESSION_TOUCH_INTERVAL_MS) {
    await prisma.userSession
      .update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(now), expiresAt: new Date(now + CUSTOMER_SESSION_TTL_MS) },
      })
      .catch(() => undefined);
  }
  const { status: _status, ...user } = session.user;
  return user;
}

export async function deleteCustomerSession(token: string | undefined | null) {
  if (!token) return;
  await prisma.userSession.deleteMany({ where: { tokenHash: sha256(token) } });
}

export interface VerifiedGoogleIdentity {
  sub: string;
  email: string;
  emailVerified: true;
  name?: string;
  picture?: string;
}

/**
 * Find-or-create the customer for a verified Google identity.
 * Identity key is Google's stable `sub`. Accounts are NEVER merged by email:
 * if another account already owns this email without a Google link we refuse
 * and require an explicit, proof-of-control linking flow instead.
 */
export async function upsertGoogleCustomer(identity: VerifiedGoogleIdentity) {
  const existing = await prisma.user.findUnique({
    where: { googleSubjectId: identity.sub },
    select: { id: true, status: true },
  });
  if (existing) {
    if (existing.status !== 'ACTIVE') throw new AppError(403, 'ACCOUNT_SUSPENDED', 'This account is suspended');
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        lastLoginAt: new Date(),
        // Keep the verified email/profile fresh; these are display attributes, not identity.
        email: identity.email.toLowerCase(),
        emailVerified: new Date(),
        name: identity.name?.slice(0, 120) || undefined,
        image: identity.picture?.slice(0, 500) || undefined,
      },
    });
    return { userId: existing.id, created: false };
  }

  const emailOwner = await prisma.user.findFirst({
    where: { email: identity.email.toLowerCase(), googleSubjectId: null },
    select: { id: true },
  });
  if (emailOwner) {
    throw new AppError(
      409,
      'ACCOUNT_LINK_REQUIRED',
      'An account with this email already exists. Sign in to that account and link Google from your profile.'
    );
  }

  const user = await prisma.user.create({
    data: {
      googleSubjectId: identity.sub,
      email: identity.email.toLowerCase(),
      emailVerified: new Date(),
      name: identity.name?.slice(0, 120) ?? null,
      image: identity.picture?.slice(0, 500) ?? null,
      lastLoginAt: new Date(),
      profile: { create: {} },
    },
    select: { id: true },
  });
  return { userId: user.id, created: true };
}
