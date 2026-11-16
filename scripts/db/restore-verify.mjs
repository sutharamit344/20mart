#!/usr/bin/env node
/**
 * Restore a backup into a SEPARATE, freshly created database and verify it.
 *
 *   node --env-file=packages/database/.env scripts/db/restore-verify.mjs --file backups/20mart-....dump --target twentymart_restore_check [--keep]
 *
 * Safety:
 *  - Refuses to restore into the database named in DATABASE_URL (the source/live DB).
 *  - Refuses if the target database already exists (never overwrites data). Use --replace-scratch
 *    only for a scratch target whose name contains "restore" or "scratch".
 *  - Never runs against production unless ALLOW_PRODUCTION_RESTORE=yes is set explicitly.
 *
 * Verification:
 *  - SHA-256 of the archive matches the manifest written by backup.mjs.
 *  - Every table's row count equals the count recorded at backup time.
 *  - Applied Prisma migrations match.
 *  - Core business invariants hold (non-negative stock, order totals, coupon usage).
 * The scratch database is dropped afterwards unless --keep is passed.
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { appliedMigrations, arg, flag, parseDbUrl, psql, run, tableCounts, withDatabase } from './lib.mjs';

const file = arg('file');
const target = arg('target', 'twentymart_restore_check');
const keep = flag('keep');
const replaceScratch = flag('replace-scratch');

const sha256File = (f) =>
  new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(f).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });

async function main() {
  if (!file) throw new Error('--file <backup.dump> is required');
  if (!/^[a-z0-9_]{3,63}$/.test(target)) throw new Error('--target must be a plain lowercase database name');
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PRODUCTION_RESTORE !== 'yes') {
    throw new Error('Refusing to run with NODE_ENV=production. Restore into a separate staging server, or set ALLOW_PRODUCTION_RESTORE=yes after approval.');
  }
  const source = parseDbUrl(process.env.DATABASE_URL);
  if (target === source.database) throw new Error(`Refusing to restore into the source database "${target}"`);

  const manifest = JSON.parse(await readFile(`${file}.json`, 'utf8'));
  const checks = [];
  const check = (name, ok, detail = '') => checks.push({ name, ok: !!ok, detail });

  const digest = await sha256File(file);
  check('archive sha256 matches manifest', digest === manifest.sha256, digest.slice(0, 16));
  if (digest !== manifest.sha256) throw new Error('Backup file is corrupt or was modified (checksum mismatch)');

  const admin = withDatabase(source, 'postgres');
  const exists = psql(admin, `SELECT 1 FROM pg_database WHERE datname = '${target}'`) === '1';
  if (exists) {
    if (!(replaceScratch && /(restore|scratch)/.test(target))) throw new Error(`Target database "${target}" already exists; choose a new name (nothing was changed)`);
    psql(admin, `DROP DATABASE "${target}" WITH (FORCE)`);
  }
  psql(admin, `CREATE DATABASE "${target}"`);
  const dest = withDatabase(source, target);

  const started = Date.now();
  try {
    // pg_trgm is needed by the trigram search indexes; it is a trusted extension (PG13+).
    run('pg_restore', ['--no-owner', '--no-privileges', '--exit-on-error', '--dbname', dest.url, file], dest);
    const restoreMs = Date.now() - started;

    const counts = tableCounts(dest);
    const mismatched = Object.entries(manifest.tableCounts).filter(([t, c]) => counts[t] !== c);
    check('all tables restored', Object.keys(manifest.tableCounts).every((t) => t in counts), `${Object.keys(counts).length} tables`);
    check('row counts match backup manifest', mismatched.length === 0, mismatched.map(([t, c]) => `${t}: expected ${c}, got ${counts[t]}`).join('; ') || `${Object.values(counts).reduce((a, b) => a + b, 0)} rows`);
    const migs = appliedMigrations(dest);
    check('prisma migrations match', JSON.stringify(migs) === JSON.stringify(manifest.migrations), `${migs.length} applied`);

    const q = (sql) => Number(psql(dest, sql));
    check('no negative or over-reserved stock', q(`SELECT count(*) FROM "Inventory" WHERE "availableQuantity" < 0 OR "reservedQuantity" < 0 OR "reservedQuantity" > "availableQuantity"`) === 0);
    check(
      'order totals = subtotal + delivery - discount + tax',
      q(`SELECT count(*) FROM "Order" WHERE "totalPaise" <> "subtotalPaise" + "deliveryChargePaise" - "discountPaise" + "taxPaise"`) === 0
    );
    check(
      'order subtotal = sum of item totals',
      q(`SELECT count(*) FROM "Order" o WHERE o."subtotalPaise" <> (SELECT COALESCE(sum(i."totalPricePaise"),0) FROM "OrderItem" i WHERE i."orderId" = o."id")`) === 0
    );
    check(
      'coupon usedCount = applied redemptions',
      q(`SELECT count(*) FROM "Coupon" c WHERE c."usedCount" <> (SELECT count(*) FROM "CouponRedemption" r WHERE r."couponId" = c."id" AND r."status" = 'APPLIED')`) === 0
    );
    check('foreign keys valid (orders → users)', q(`SELECT count(*) FROM "Order" o LEFT JOIN "User" u ON u."id" = o."userId" WHERE u."id" IS NULL`) === 0);

    const ok = checks.every((c) => c.ok);
    console.log(JSON.stringify({ ok, backup: manifest.file, backupCreatedAt: manifest.createdAt, target, restoreMs, checks, kept: keep }, null, 2));
    if (!ok) process.exitCode = 2;
  } finally {
    if (!keep) psql(admin, `DROP DATABASE IF EXISTS "${target}" WITH (FORCE)`);
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message }));
  process.exit(1);
});
