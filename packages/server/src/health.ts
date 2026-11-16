import { prisma } from '@20mart/database';
import { emailConfigured, env, googleConfigured, razorpayConfigured } from './env';
import { monitoringProviders } from './observability';

export interface ConfigIssue {
  level: 'error' | 'warning';
  key: string;
  message: string;
}

const isLocalHost = (h: string) => h === 'localhost' || h === '127.0.0.1' || h === '::1';

/**
 * Static review of the running configuration for a production deployment.
 * Reports only booleans/hostnames — never secret values.
 */
export function productionConfigIssues(e = env()): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const add = (level: ConfigIssue['level'], key: string, message: string) => issues.push({ level, key, message });
  const app = new URL(e.APP_URL);
  const admin = new URL(e.ADMIN_APP_URL);

  if (app.protocol !== 'https:' && !isLocalHost(app.hostname)) add('error', 'APP_URL', 'Storefront origin must use https://');
  if (admin.protocol !== 'https:' && !isLocalHost(admin.hostname)) add('error', 'ADMIN_APP_URL', 'Admin origin must use https://');
  if (app.origin === admin.origin) add('error', 'ADMIN_APP_URL', 'Admin and storefront must be served from different origins (separate session cookies)');
  if (app.hostname !== admin.hostname && app.hostname.endsWith(`.${admin.hostname}`)) {
    add('warning', 'ADMIN_APP_URL', 'Storefront is a subdomain of the admin host; prefer sibling subdomains (shop./admin.)');
  }

  try {
    const db = new URL(e.DATABASE_URL);
    if (!isLocalHost(db.hostname) && !/sslmode=(require|verify-ca|verify-full)/.test(db.search)) {
      add('warning', 'DATABASE_URL', 'Remote database without sslmode=require — traffic may be unencrypted');
    }
    if (!/connection_limit=/.test(db.search)) add('warning', 'DATABASE_URL', 'No connection_limit set; size the Prisma pool for your instance count (see DEPLOYMENT.md)');
    if (/^(postgres|root|admin|azure_superuser|rdsadmin)$/i.test(decodeURIComponent(db.username))) add('warning', 'DATABASE_URL', 'Connects as a superuser-like role; use the least-privilege app role');
  } catch {
    add('error', 'DATABASE_URL', 'DATABASE_URL is not a valid URL');
  }

  if (e.STORAGE_DRIVER === 'local') add('warning', 'STORAGE_DRIVER', 'Local image storage needs a persistent disk shared by all instances; use s3/R2 in production');
  if (e.STORAGE_DRIVER === 's3' && !(e.S3_ENDPOINT && e.S3_BUCKET && e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY)) add('error', 'S3_*', 'STORAGE_DRIVER=s3 but S3 settings are incomplete');
  if (!e.STORAGE_PUBLIC_BASE_URL) add('error', 'STORAGE_PUBLIC_BASE_URL', 'Public image base URL is not set');
  else if (!e.STORAGE_PUBLIC_BASE_URL.startsWith('https://') && !isLocalHost(new URL(e.STORAGE_PUBLIC_BASE_URL).hostname)) add('error', 'STORAGE_PUBLIC_BASE_URL', 'Images must be served over https:// (mixed content)');

  if (!googleConfigured()) add('warning', 'GOOGLE_CLIENT_ID', 'Google sign-in is not configured — customers cannot sign in or check out');
  if (!e.CRON_SECRET) add('error', 'CRON_SECRET', 'Scheduled jobs (payment expiry, email queue, maintenance) cannot be authenticated');
  else if (e.CRON_SECRET.length < 32) add('warning', 'CRON_SECRET', 'Use at least 32 random characters');
  if (!e.REVALIDATE_SECRET) add('warning', 'REVALIDATE_SECRET', 'Admin catalog edits will not refresh the storefront cache until it expires (60 s)');

  const rz = [e.RAZORPAY_KEY_ID, e.RAZORPAY_KEY_SECRET, e.RAZORPAY_WEBHOOK_SECRET].filter(Boolean).length;
  if (rz > 0 && rz < 3) add('error', 'RAZORPAY_*', 'Razorpay is partially configured (key id, key secret and webhook secret are all required)');
  if (e.RAZORPAY_KEY_ID.startsWith('rzp_test_')) add('warning', 'RAZORPAY_KEY_ID', 'Razorpay TEST keys are configured');

  if (!!e.RESEND_API_KEY !== !!e.EMAIL_FROM) add('error', 'EMAIL_FROM', 'Email is partially configured (RESEND_API_KEY and EMAIL_FROM are both required)');
  if (emailConfigured() && !e.RESEND_WEBHOOK_SECRET) add('warning', 'RESEND_WEBHOOK_SECRET', 'Delivery/bounce status will never be updated without the Resend webhook secret');
  if (!emailConfigured()) add('warning', 'RESEND_API_KEY', 'Email is not configured — notifications are in-app only');

  const mon = monitoringProviders();
  if (!mon.sentry && !mon.webhook) add('warning', 'SENTRY_DSN', 'No external error monitoring configured; errors go to structured logs only');
  return issues;
}

/** Liveness + database round-trip. `detailed` adds integration booleans and config issues (secret-gated). */
export async function healthReport(detailed = false) {
  const started = Date.now();
  let database: { ok: boolean; latencyMs: number; error?: string };
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = { ok: true, latencyMs: Date.now() - started };
  } catch (e) {
    database = { ok: false, latencyMs: Date.now() - started, error: (e as Error).name };
  }
  const base = {
    status: database.ok ? ('ok' as const) : ('down' as const),
    time: new Date().toISOString(),
    release: process.env.APP_RELEASE || null,
    checks: { database },
  };
  if (!detailed) return base;
  let migrations: { failed: number } | null = null;
  let sessionTimeZone: string | null = null;
  if (database.ok) {
    const rows = await prisma.$queryRaw<{ failed: bigint }[]>`
      SELECT count(*) AS failed FROM "_prisma_migrations" WHERE "finished_at" IS NULL AND "rolled_back_at" IS NULL`.catch(() => null);
    migrations = rows ? { failed: Number(rows[0].failed) } : null;
    const tz = await prisma.$queryRaw<{ tz: string }[]>`SELECT current_setting('TimeZone') AS tz`.catch(() => null);
    sessionTimeZone = tz?.[0]?.tz ?? null;
  }
  const e = env();
  const config = productionConfigIssues(e);
  if (sessionTimeZone && !/^(UTC|Etc\/UTC|GMT|Etc\/GMT|Z)$/i.test(sessionTimeZone)) {
    config.push({ level: 'error', key: 'DATABASE_URL', message: `Database session time zone is ${sessionTimeZone}; it must be UTC (see DEPLOYMENT.md: ALTER ROLE … SET timezone = 'UTC')` });
  }
  return {
    ...base,
    checks: { ...base.checks, migrations, sessionTimeZone },
    integrations: {
      googleOAuth: googleConfigured(),
      razorpay: razorpayConfigured(),
      email: emailConfigured(),
      storage: e.STORAGE_DRIVER,
      monitoring: monitoringProviders(),
    },
    config,
  };
}
