/**
 * Historical backfill of daily product analytics (Phase C).
 *
 *   pnpm --filter @20mart/server analytics:backfill [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--force] [--dry-run]
 *
 * --dry-run reads only: it reports what would be aggregated and writes nothing (not even the
 * tracking start date in AnalyticsSettings).
 *
 * Aggregates every finished IST day from the first day with data (orders, stock or events) up to
 * yesterday. Days already done are skipped unless --force. Rebuilding is idempotent, and days whose
 * raw events may have been purged by retention are never rebuilt once done.
 *
 * Sales and stock history are rebuilt from orders and stock movements. Behavioural/operational event
 * counts exist only from the day tracking started; earlier days are marked eventCoverage = NONE
 * ("no data"), never filled with invented events.
 *
 * DATABASE_URL comes from the environment (packages/database/.env is loaded if none is set).
 * A non-local database requires --confirm-production.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';

const envFile = path.resolve(__dirname, '../../database/.env');
if (!process.env.DATABASE_URL && existsSync(envFile)) process.loadEnvFile(envFile);

const args = process.argv.slice(2);
const arg = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};

async function main() {
  const host = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? '').hostname;
    } catch {
      return '';
    }
  })();
  const local = ['localhost', '127.0.0.1', '::1'].includes(host);
  if (!host) throw new Error('DATABASE_URL is not set');
  if (!local && !args.includes('--confirm-production')) {
    throw new Error(`Refusing to run against ${host} without --confirm-production`);
  }

  const { prisma } = await import('@20mart/database');
  const t = await import('../src/tracking/product-daily');
  try {
    // A dry run is strictly read-only: it must not even initialise AnalyticsSettings.trackingStartedAt.
    const dryRun = args.includes('--dry-run');
    const coverage = await t.getAnalyticsDataCoverage({ readOnly: dryRun });
    console.log(`Database: ${local ? 'local' : host}`);
    console.log(`Event tracking started: ${coverage.trackingStartedAt?.toISOString() ?? 'never (no events yet)'} (first tracked IST day: ${coverage.firstTrackedDay ?? '—'})`);
    console.log(`Sales data from: ${coverage.salesFromDay ?? '—'} · stock history from: ${coverage.stockHistoryFromDay ?? '—'}`);

    const from = arg('--from') ?? (await t.firstDataDay({ readOnly: dryRun }));
    const yesterday = t.addDays(t.istDayOf(new Date()), -1);
    const to = arg('--to') ?? yesterday;
    if (!from) return console.log('Nothing to backfill: no orders, stock or events yet.');
    if (dryRun) {
      let days = 0;
      for (let d = from; d <= to && d <= yesterday; d = t.addDays(d, 1)) days++;
      return console.log(`DRY RUN: would aggregate ${days} day(s), ${from} → ${to <= yesterday ? to : yesterday}${args.includes('--force') ? ' (including already-done days)' : ''}.`);
    }

    const r = await t.backfillProductDaily({
      from,
      to,
      force: args.includes('--force'),
      onDay: (d) =>
        console.log(`  ${d.day} ${d.status}${d.reason ? ` (${d.reason})` : ''}${d.status === 'done' ? ` · coverage ${d.coverage} · ${d.productRows} product rows · ${d.inventoryRows} stock rows` : ''}`),
    });
    const done = r.processed.filter((d) => d.status === 'done').length;
    console.log(`Done: ${done} aggregated, ${r.processed.length - done} skipped, ${r.failed.length} failed.`);
    for (const f of r.failed) console.log(`  FAILED ${f.day}: ${f.error}`);
    if (r.failed.length) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
