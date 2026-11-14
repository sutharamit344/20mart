/**
 * Initial SUPER_ADMIN provisioning and recovery.
 *
 *   Provision (only when no SUPER_ADMIN exists):
 *     INITIAL_ADMIN_USERNAME=… INITIAL_ADMIN_EMAIL=… INITIAL_ADMIN_PASSWORD=… pnpm admin:bootstrap
 *
 *   Recover a locked-out SUPER_ADMIN (resets password, reactivates, revokes sessions):
 *     INITIAL_ADMIN_PASSWORD=… pnpm admin:bootstrap --recover <username>
 *
 * Values are read from the environment (packages/database/.env is loaded if present).
 * The password is never printed. Remove INITIAL_ADMIN_PASSWORD from the env afterwards.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { hash } from '@node-rs/argon2';

const envFile = path.resolve(__dirname, '../../database/.env');
// Only fall back to the database package's .env when no DATABASE_URL was provided explicitly.
if (!process.env.DATABASE_URL && existsSync(envFile)) process.loadEnvFile(envFile);

const MIN = 12;

async function main() {
  const { PrismaClient } = await import('@20mart/database');
  const { SUPER_ADMIN_ROLE } = await import('@20mart/shared');
  const prisma = new PrismaClient();
  const args = process.argv.slice(2);
  const recoverIdx = args.indexOf('--recover');
  const password = process.env.INITIAL_ADMIN_PASSWORD ?? '';
  if (password.length < MIN) throw new Error(`INITIAL_ADMIN_PASSWORD must be at least ${MIN} characters`);
  const passwordHash = await hash(password, { algorithm: 2 /* Argon2id */, memoryCost: 19456, timeCost: 2, parallelism: 1 });

  try {
    const role = await prisma.role.findUnique({ where: { key: SUPER_ADMIN_ROLE }, select: { id: true } });
    if (!role) throw new Error('SUPER_ADMIN role missing — run `pnpm db:seed` first.');

    if (recoverIdx !== -1) {
      const username = (args[recoverIdx + 1] ?? '').toLowerCase();
      if (!username) throw new Error('Usage: --recover <username>');
      const admin = await prisma.adminUser.findFirst({
        where: { username: { equals: username, mode: 'insensitive' }, roles: { some: { roleId: role.id } } },
        select: { id: true, username: true, name: true },
      });
      if (!admin) throw new Error(`No SUPER_ADMIN named "${username}"`);
      await prisma.$transaction([
        prisma.adminUser.update({
          where: { id: admin.id },
          data: { passwordHash, status: 'ACTIVE', failedLoginCount: 0, lockedUntil: null, passwordChangedAt: new Date() },
        }),
        prisma.adminSession.deleteMany({ where: { adminId: admin.id } }),
        prisma.adminAuditLog.create({
          data: { adminId: admin.id, adminName: 'system', action: 'Recovered super admin', category: 'USER_MANAGEMENT', details: `${admin.username} via CLI` },
        }),
      ]);
      console.log(`Recovered SUPER_ADMIN "${admin.username}": password reset, account active, all sessions revoked.`);
      return;
    }

    const username = (process.env.INITIAL_ADMIN_USERNAME ?? '').trim().toLowerCase();
    const email = (process.env.INITIAL_ADMIN_EMAIL ?? '').trim().toLowerCase();
    const name = (process.env.INITIAL_ADMIN_NAME ?? username).trim();
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new Error('INITIAL_ADMIN_USERNAME must be 3–32 chars [a-z0-9._-]');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('INITIAL_ADMIN_EMAIL is not a valid email');

    // Serialise concurrent bootstrap attempts and refuse when a SUPER_ADMIN already exists.
    const created = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(20202020)`;
      const existing = await tx.adminUserRole.count({ where: { roleId: role.id } });
      if (existing > 0) return null;
      const admin = await tx.adminUser.create({
        data: { username, email, name, passwordHash, roles: { create: { roleId: role.id } } },
        select: { id: true, username: true },
      });
      await tx.adminAuditLog.create({
        data: { adminId: admin.id, adminName: 'system', action: 'Bootstrapped super admin', category: 'USER_MANAGEMENT', details: admin.username },
      });
      return admin;
    });
    if (!created) {
      console.error('Refusing: a SUPER_ADMIN already exists. Use the admin UI, or --recover <username> to regain access.');
      process.exitCode = 2;
      return;
    }
    console.log(`Created SUPER_ADMIN "${created.username}". Remove INITIAL_ADMIN_PASSWORD from your environment now.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(`Bootstrap failed: ${(e as Error).message}`);
  process.exitCode = 1;
});
