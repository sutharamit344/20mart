import { prisma } from '@20mart/database';
import { ADMIN_SESSION_IDLE_MS } from './cookies';
import { LOGIN_WINDOW_MS } from './auth/admin';
import { logger } from './observability';

/** How long rows are kept after they stop being useful. */
export const RETENTION = {
  /** Throttling only looks back LOGIN_WINDOW_MS; keep 30 days for security investigations. */
  loginAttemptsDays: 30,
  /** Guest cart cookie lives 30 days; carts untouched for longer are unreachable. */
  guestCartDays: 30,
} as const;

const BATCH = 5000;
/** Bound Date parameter $n as UTC wall time (columns are timestamp(3) in UTC; Prisma binds timestamptz). */
const UTC = (n: number) => `($${n}::timestamptz AT TIME ZONE 'UTC')`;
const MAX_BATCHES = 20; // ≤ 100k rows per table per run; the next run continues

/** Delete in bounded batches so a large backlog never holds long locks. */
async function purge(table: string, where: string, ...params: unknown[]) {
  let total = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const n = await prisma.$executeRawUnsafe(
      `DELETE FROM "${table}" WHERE "id" IN (SELECT "id" FROM "${table}" WHERE ${where} LIMIT ${BATCH})`,
      ...params
    );
    total += n;
    if (n < BATCH) break;
  }
  return total;
}

/**
 * Housekeeping job (POST /api/cron/maintenance, daily). Removes only data that can no
 * longer be used: expired/idle sessions, old login-throttle rows and abandoned guest carts.
 * Orders, payments, converted carts and audit logs are never touched.
 */
export async function runMaintenance(now = new Date()) {
  const started = Date.now();
  // Table/column names are constants above; only the timestamps are parameters.
  const result = {
    customerSessions: await purge('UserSession', `"expiresAt" < ${UTC(1)}`, now),
    adminSessions: await purge('AdminSession', `"expiresAt" < ${UTC(1)} OR "lastSeenAt" < ${UTC(2)}`, now, new Date(now.getTime() - ADMIN_SESSION_IDLE_MS)),
    loginAttempts: await purge(
      'AdminLoginAttempt',
      `"createdAt" < ${UTC(1)}`,
      new Date(now.getTime() - Math.max(RETENTION.loginAttemptsDays * 86_400_000, LOGIN_WINDOW_MS))
    ),
    guestCarts: await purge('Cart', `"userId" IS NULL AND "status" = 'ACTIVE' AND "updatedAt" < ${UTC(1)}`, new Date(now.getTime() - RETENTION.guestCartDays * 86_400_000)),
  };
  logger.info('cron.maintenance', { category: 'cron', ...result, ms: Date.now() - started });
  return result;
}
