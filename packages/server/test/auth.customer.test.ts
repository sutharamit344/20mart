import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTVerifyGetKey } from 'jose';
import { prisma } from '@20mart/database';
import { beginGoogleLogin, completeGoogleLogin, sanitizeReturnTo, type GoogleDeps } from '../src/auth/google';
import { createCustomerSession, deleteCustomerSession, getCustomerBySessionToken, upsertGoogleCustomer } from '../src/auth/customer';
import { verifyPayload } from '../src/crypto';
import { AppError } from '../src/errors';
import { resetDb } from './helpers';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
let privateKey: CryptoKey;
let jwks: JWTVerifyGetKey;
let otherKey: CryptoKey;

beforeAll(async () => {
  const kp = await generateKeyPair('RS256');
  privateKey = kp.privateKey as CryptoKey;
  const jwk = { ...(await exportJWK(kp.publicKey)), kid: 'test-key', alg: 'RS256' };
  jwks = createLocalJWKSet({ keys: [jwk] });
  otherKey = (await generateKeyPair('RS256')).privateKey as CryptoKey;
});
beforeEach(resetDb);

async function idToken(claims: Record<string, unknown>, opts: { key?: CryptoKey; aud?: string; iss?: string; exp?: string } = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(opts.iss ?? 'https://accounts.google.com')
    .setAudience(opts.aud ?? CLIENT_ID)
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? '5m')
    .sign(opts.key ?? privateKey);
}

/** Simulate Google: start login, then complete it with a token for the given claims. */
async function runFlow(claims: Record<string, unknown>, tokenOpts: Parameters<typeof idToken>[1] = {}, overrideState?: string) {
  const { url, stateCookieValue } = beginGoogleLogin('/account/orders');
  const authUrl = new URL(url);
  const saved = verifyPayload<{ s: string; n: string }>(stateCookieValue)!;
  expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256');
  expect(authUrl.searchParams.get('nonce')).toBe(saved.n);
  const token = await idToken({ nonce: saved.n, ...claims }, tokenOpts);
  let sentBody: URLSearchParams | null = null;
  const deps: GoogleDeps = {
    jwks,
    fetchToken: async (body) => {
      sentBody = body;
      return new Response(JSON.stringify({ id_token: token }), { status: 200 });
    },
  };
  const result = await completeGoogleLogin({ code: 'auth-code', state: overrideState ?? saved.s, stateCookie: stateCookieValue }, deps);
  expect(sentBody!.get('code_verifier')).toBeTruthy(); // PKCE verifier sent server-side
  return result;
}

const expectCode = async (p: Promise<unknown>, code: string) => {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === code);
};

describe('Google sign-in', () => {
  it('creates a new customer with profile on first login', async () => {
    const { identity, returnTo } = await runFlow({ sub: 'g-111', email: 'Asha@Example.com', email_verified: true, name: 'Asha' });
    expect(returnTo).toBe('/account/orders');
    const { userId, created } = await upsertGoogleCustomer(identity);
    expect(created).toBe(true);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { profile: true } });
    expect(user.googleSubjectId).toBe('g-111');
    expect(user.email).toBe('asha@example.com');
    expect(user.emailVerified).toBeInstanceOf(Date);
    expect(user.profile).not.toBeNull();
  });

  it('logs an existing customer back into the same account (keyed by sub, not email)', async () => {
    const first = await upsertGoogleCustomer((await runFlow({ sub: 'g-222', email: 'a@x.com', email_verified: true })).identity);
    // Same Google account, changed email address → still the same user.
    const second = await upsertGoogleCustomer((await runFlow({ sub: 'g-222', email: 'new@x.com', email_verified: true })).identity);
    expect(second.userId).toBe(first.userId);
    expect(second.created).toBe(false);
    expect(await prisma.user.count()).toBe(1);
  });

  it('rejects a tampered or mismatched state (CSRF)', async () => {
    await expectCode(runFlow({ sub: 'g-1', email: 'a@x.com', email_verified: true }, {}, 'attacker-state'), 'OAUTH_STATE_INVALID');
    await expectCode(
      completeGoogleLogin({ code: 'c', state: 's', stateCookie: 'forged.cookie' }, { jwks, fetchToken: async () => new Response('{}') }),
      'OAUTH_STATE_INVALID'
    );
  });

  it('rejects tokens with the wrong nonce, audience, issuer, signature or expiry', async () => {
    await expectCode(runFlow({ sub: 'g-1', email: 'a@x.com', email_verified: true, nonce: 'replayed' }), 'OAUTH_TOKEN_INVALID');
    await expectCode(runFlow({ sub: 'g-1', email: 'a@x.com', email_verified: true }, { aud: 'someone-else' }), 'OAUTH_TOKEN_INVALID');
    await expectCode(runFlow({ sub: 'g-1', email: 'a@x.com', email_verified: true }, { iss: 'https://evil.example' }), 'OAUTH_TOKEN_INVALID');
    await expectCode(runFlow({ sub: 'g-1', email: 'a@x.com', email_verified: true }, { key: otherKey }), 'OAUTH_TOKEN_INVALID');
    await expectCode(runFlow({ sub: 'g-1', email: 'a@x.com', email_verified: true }, { exp: '-10m' }), 'OAUTH_TOKEN_INVALID');
  });

  it('requires a verified email and ignores role claims from Google', async () => {
    await expectCode(runFlow({ sub: 'g-1', email: 'a@x.com', email_verified: false }), 'EMAIL_NOT_VERIFIED');
    const { identity } = await runFlow({ sub: 'g-9', email: 'b@x.com', email_verified: true, role: 'SUPER_ADMIN', roles: ['admin'] });
    expect(Object.keys(identity).sort()).toEqual(['email', 'emailVerified', 'name', 'picture', 'sub'].filter((k) => k in identity).sort());
    await upsertGoogleCustomer(identity);
    expect(await prisma.adminUser.count()).toBe(0);
  });

  it('handles the user cancelling at Google and a failed code exchange', async () => {
    await expectCode(completeGoogleLogin({ code: null, state: null, error: 'access_denied', stateCookie: undefined }, { jwks, fetchToken: async () => new Response('') }), 'OAUTH_DENIED');
    const { stateCookieValue } = beginGoogleLogin(null);
    const s = verifyPayload<{ s: string }>(stateCookieValue)!.s;
    await expectCode(
      completeGoogleLogin({ code: 'c', state: s, stateCookie: stateCookieValue }, { jwks, fetchToken: async () => new Response('bad', { status: 400 }) }),
      'OAUTH_EXCHANGE_FAILED'
    );
  });

  it('never auto-merges with an existing account that has the same email', async () => {
    await prisma.user.create({ data: { email: 'shared@x.com', name: 'Legacy' } });
    const { identity } = await runFlow({ sub: 'g-new', email: 'shared@x.com', email_verified: true });
    await expectCode(upsertGoogleCustomer(identity), 'ACCOUNT_LINK_REQUIRED');
    expect(await prisma.user.count()).toBe(1);
  });

  it('blocks suspended customers', async () => {
    await prisma.user.create({ data: { googleSubjectId: 'g-sus', email: 's@x.com', status: 'SUSPENDED' } });
    const { identity } = await runFlow({ sub: 'g-sus', email: 's@x.com', email_verified: true });
    await expectCode(upsertGoogleCustomer(identity), 'ACCOUNT_SUSPENDED');
  });

  it('only allows same-origin relative return paths', () => {
    expect(sanitizeReturnTo('/account/orders')).toBe('/account/orders');
    expect(sanitizeReturnTo('https://evil.example')).toBe('/account');
    expect(sanitizeReturnTo('//evil.example')).toBe('/account');
    expect(sanitizeReturnTo('/\\evil.example')).toBe('/account');
    expect(sanitizeReturnTo('/api/admin/products')).toBe('/account');
  });
});

describe('customer sessions', () => {
  it('stores only a hash, resolves the user, and logs out', async () => {
    const user = await prisma.user.create({ data: { googleSubjectId: 'g-s', email: 's@x.com', name: 'S' } });
    const { token } = await createCustomerSession(user.id, { ipAddress: '1.2.3.4' });
    const row = await prisma.userSession.findFirstOrThrow();
    expect(row.tokenHash).not.toBe(token);
    expect(row.tokenHash).toHaveLength(64);
    expect((await getCustomerBySessionToken(token))?.id).toBe(user.id);
    await deleteCustomerSession(token);
    expect(await getCustomerBySessionToken(token)).toBeNull();
  });

  it('rejects expired sessions and sessions of suspended users', async () => {
    const user = await prisma.user.create({ data: { googleSubjectId: 'g-e', email: 'e@x.com' } });
    const { token } = await createCustomerSession(user.id);
    await prisma.userSession.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await getCustomerBySessionToken(token)).toBeNull();
    expect(await prisma.userSession.count()).toBe(0); // cleaned up

    const { token: t2 } = await createCustomerSession(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });
    expect(await getCustomerBySessionToken(t2)).toBeNull();
  });

  it('ignores garbage tokens', async () => {
    expect(await getCustomerBySessionToken(undefined)).toBeNull();
    expect(await getCustomerBySessionToken('x'.repeat(500))).toBeNull();
    expect(await getCustomerBySessionToken('not-a-real-token')).toBeNull();
  });
});
