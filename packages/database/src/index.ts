import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

/**
 * All DateTime columns are `timestamp(3)` holding UTC wall time. Prisma itself always writes UTC,
 * but raw SQL (`now()`, Date parameters, column DEFAULTs) is interpreted in the *session* time zone,
 * which on many self-installed servers is local time (e.g. Asia/Kolkata → 5 h 30 m skew).
 * Force every app session to UTC. PgBouncer/transaction poolers reject startup `options`, so for
 * `pgbouncer=true` URLs set it on the role instead:  ALTER ROLE <app_role> SET timezone = 'UTC';
 * Opt out with DATABASE_FORCE_UTC=false.
 */
export function withUtcSession(url: string | undefined): string | undefined {
  if (!url || process.env.DATABASE_FORCE_UTC === 'false') return url;
  try {
    const u = new URL(url);
    // Poolers (PgBouncer, Neon's "-pooler" endpoints) reject startup options; Neon sessions default to UTC.
    if (u.searchParams.get('pgbouncer') === 'true' || u.hostname.includes('-pooler')) return url;
    const opts = u.searchParams.get('options') ?? '';
    if (/timezone/i.test(opts)) return url;
    u.searchParams.set('options', `${opts} -c TimeZone=UTC`.trim());
    return u.toString().replace(/\+/g, '%20');
  } catch {
    return url;
  }
}

export const prisma =
  globalThis.prismaGlobal ??
  new PrismaClient({
    datasourceUrl: withUtcSession(process.env.DATABASE_URL),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

export * from '@prisma/client';
