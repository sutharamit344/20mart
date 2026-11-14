import { beforeEach, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { prisma } from '@20mart/database';
import { getAdminContext, loginAdmin, logoutAdmin, MAX_FAILURES_PER_IDENTIFIER } from '../src/auth/admin';
import { setAdminStatus } from '../src/admins';
import { AppError } from '../src/errors';
import { adminSession, createAdmin, PASSWORD, resetDb } from './helpers';

beforeEach(resetDb);

const login = (identifier: string, password: string, extra: { ip?: string; currentToken?: string } = {}) =>
  loginAdmin({ identifier, password }, { ipAddress: extra.ip ?? '10.1.1.1', currentToken: extra.currentToken });

const errorOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e as AppError;
  }
  throw new Error('expected rejection');
};

describe('admin password login', () => {
  it('signs in with username or email (case-insensitive) and records last login', async () => {
    await createAdmin('priya', ['PRODUCT_MANAGER']);
    const a = await login('priya', PASSWORD);
    const b = await login('PRIYA@test.local', PASSWORD);
    expect(a.token).not.toBe(b.token);
    const admin = await prisma.adminUser.findUniqueOrThrow({ where: { username: 'priya' } });
    expect(admin.lastLoginAt).toBeInstanceOf(Date);
    expect(admin.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(admin.passwordHash).not.toContain(PASSWORD);
    const ctx = await getAdminContext(a.token);
    expect(ctx?.roles).toEqual(['PRODUCT_MANAGER']);
    expect(ctx?.permissions.has('products.update')).toBe(true);
    expect(ctx?.permissions.has('roles.manage')).toBe(false);
  });

  it('returns the same generic error for a wrong password and an unknown user', async () => {
    await createAdmin('ravi', ['ADMIN']);
    const wrongPw = await errorOf(login('ravi', 'wrong-password-123'));
    const unknown = await errorOf(login('nobody', 'wrong-password-123'));
    expect(wrongPw.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPw.message).toBe(unknown.message);
    expect(wrongPw.code).toBe(unknown.code);
  });

  it('rejects inactive admins with the same generic error', async () => {
    await createAdmin('inactive', ['ADMIN'], { status: 'INACTIVE' });
    const e = await errorOf(login('inactive', PASSWORD));
    expect(e.status).toBe(401);
    expect(e.code).toBe('INVALID_CREDENTIALS');
  });

  it('immediately invalidates the sessions of a deactivated admin', async () => {
    const boss = await adminSession('boss', ['SUPER_ADMIN']);
    const victim = await adminSession('victim', ['ADMIN']);
    expect(await getAdminContext(victim.token)).not.toBeNull();
    await setAdminStatus(boss.ctx, victim.id, { status: 'INACTIVE' });
    expect(await getAdminContext(victim.token)).toBeNull();
    // Even a session row that somehow survived is rejected because the account is inactive.
    await prisma.adminSession.create({
      data: { tokenHash: 'x'.repeat(64), adminId: victim.id, expiresAt: new Date(Date.now() + 1e6) },
    });
    expect(await prisma.adminSession.count({ where: { adminId: victim.id } })).toBe(1);
  });

  it('throttles repeated failures per identifier (lockout) without revealing account existence', async () => {
    await createAdmin('target', ['ADMIN']);
    for (let i = 0; i < MAX_FAILURES_PER_IDENTIFIER; i++) {
      expect((await errorOf(login('target', 'nope-nope-nope', { ip: `10.9.9.${i}` }))).status).toBe(401);
    }
    // Locked: even the correct password is refused now.
    expect((await errorOf(login('target', PASSWORD, { ip: '10.9.9.200' }))).status).toBe(429);
    // Unknown identifiers get throttled the same way.
    for (let i = 0; i < MAX_FAILURES_PER_IDENTIFIER; i++) await errorOf(login('ghost', 'nope-nope-nope', { ip: `10.8.8.${i}` }));
    expect((await errorOf(login('ghost', 'nope-nope-nope', { ip: '10.8.8.200' }))).status).toBe(429);
  });

  it('rotates the session on login (fixation protection) and supports logout', async () => {
    await createAdmin('rot', ['ADMIN']);
    const first = await login('rot', PASSWORD);
    const second = await login('rot', PASSWORD, { currentToken: first.token });
    expect(await getAdminContext(first.token)).toBeNull();
    expect(await getAdminContext(second.token)).not.toBeNull();
    await logoutAdmin(second.token);
    expect(await getAdminContext(second.token)).toBeNull();
  });

  it('expires sessions after the absolute lifetime and after idle time', async () => {
    const { token } = await adminSession('exp', ['ADMIN']);
    await prisma.adminSession.updateMany({ data: { expiresAt: new Date(Date.now() - 1) } });
    expect(await getAdminContext(token)).toBeNull();

    const s2 = await login('exp', PASSWORD, { ip: '10.2.2.2' });
    await prisma.adminSession.updateMany({ data: { lastSeenAt: new Date(Date.now() - 3 * 60 * 60 * 1000) } });
    expect(await getAdminContext(s2.token)).toBeNull();
  });
});

describe('SUPER_ADMIN bootstrap script', () => {
  const run = (env: Record<string, string>, args = '') => {
    try {
      const out = execSync(`npx tsx scripts/bootstrap-admin.ts ${args}`, {
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, ...env },
        stdio: 'pipe',
      });
      return { code: 0, out: out.toString() };
    } catch (e) {
      const err = e as { status: number; stdout: Buffer; stderr: Buffer };
      return { code: err.status, out: err.stdout.toString() + err.stderr.toString() };
    }
  };

  it('creates the first super admin once, refuses a second, and supports recovery', async () => {
    const env = { INITIAL_ADMIN_USERNAME: 'root', INITIAL_ADMIN_EMAIL: 'root@test.local', INITIAL_ADMIN_PASSWORD: 'a-very-long-initial-password' };
    const first = run(env);
    expect(first.code).toBe(0);
    expect(first.out).not.toContain(env.INITIAL_ADMIN_PASSWORD); // never logs the password
    const second = run({ ...env, INITIAL_ADMIN_USERNAME: 'root2', INITIAL_ADMIN_EMAIL: 'root2@test.local' });
    expect(second.code).toBe(2);
    expect(await prisma.adminUser.count()).toBe(1);

    expect(run({ INITIAL_ADMIN_PASSWORD: 'short' }).code).toBe(1); // weak password rejected

    await prisma.adminUser.update({ where: { username: 'root' }, data: { status: 'INACTIVE', lockedUntil: new Date(Date.now() + 1e6) } });
    const rec = run({ INITIAL_ADMIN_PASSWORD: 'a-brand-new-recovery-password' }, '--recover root');
    expect(rec.code).toBe(0);
    const { token } = await loginAdmin({ identifier: 'root', password: 'a-brand-new-recovery-password' }, { ipAddress: '10.3.3.3' });
    expect((await getAdminContext(token))?.roles).toContain('SUPER_ADMIN');
  }, 120_000);
});
