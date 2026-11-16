/**
 * Runs before the storefront's Vercel PRODUCTION build:
 *   1. prisma migrate deploy  (applies pending migrations only; never resets data)
 *   2. db:seed                (idempotent: permissions, roles, starter drafts/coupons)
 * Uses the direct (non-pooled) Neon URL because migrations need session-level locks.
 * Does nothing locally or on preview builds.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.VERCEL_ENV !== 'production') {
  console.log('[vercel-migrate] not a Vercel production build — skipping');
  process.exit(0);
}
const direct = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!direct) {
  console.error('[vercel-migrate] DATABASE_URL is not set');
  process.exit(1);
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, DATABASE_URL: direct };
const run = (cmd) => {
  console.log(`[vercel-migrate] ${cmd}`);
  execSync(cmd, { cwd: root, env, stdio: 'inherit' });
};
run('pnpm --filter @20mart/database db:deploy');
run('pnpm --filter @20mart/database db:seed');
// Optional one-time admin provisioning/recovery: only when INITIAL_ADMIN_* are set in Vercel (remove them afterwards).
//   INITIAL_ADMIN_USERNAME + INITIAL_ADMIN_EMAIL + INITIAL_ADMIN_PASSWORD  → create the first SUPER_ADMIN (skipped if one exists)
//   INITIAL_ADMIN_RECOVER=1 + INITIAL_ADMIN_USERNAME + INITIAL_ADMIN_PASSWORD → reset that SUPER_ADMIN's password, unlock it, revoke its sessions
if (process.env.INITIAL_ADMIN_PASSWORD) {
  const recover = process.env.INITIAL_ADMIN_RECOVER === '1';
  const user = (process.env.INITIAL_ADMIN_USERNAME || '').trim().toLowerCase();
  try {
    if (recover) {
      if (!/^[a-z0-9._-]{3,32}$/.test(user)) throw new Error('INITIAL_ADMIN_USERNAME is required for recovery');
      run(`pnpm --filter @20mart/server admin:bootstrap --recover ${user}`);
    } else {
      run('pnpm --filter @20mart/server admin:bootstrap');
    }
  } catch (e) {
    console.warn(`[vercel-migrate] admin ${recover ? 'recovery' : 'bootstrap'} did not run: ${e instanceof Error ? e.message.split(/\r?\n/)[0] : e}`);
  }
  console.warn('[vercel-migrate] REMOVE INITIAL_ADMIN_PASSWORD (and INITIAL_ADMIN_RECOVER) from Vercel now.');
}
