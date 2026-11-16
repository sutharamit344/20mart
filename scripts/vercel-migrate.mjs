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
// Optional one-time admin provisioning: only when INITIAL_ADMIN_* are set in Vercel (remove them afterwards).
if (process.env.INITIAL_ADMIN_PASSWORD) {
  try {
    run('pnpm --filter @20mart/server admin:bootstrap');
  } catch {
    console.warn('[vercel-migrate] admin bootstrap skipped (an admin probably exists already)');
  }
}
