#!/usr/bin/env node
/**
 * PostgreSQL logical backup for 20Mart.
 *
 *   node --env-file=packages/database/.env scripts/db/backup.mjs [--out ./backups] [--keep-days 14] [--keep-min 7]
 *
 * - pg_dump custom format (compressed, restorable table-by-table with pg_restore).
 * - Writes <file>.json next to the dump: SHA-256, size, per-table row counts and
 *   applied Prisma migrations, used later by restore-verify.mjs.
 * - Verifies the archive is readable (pg_restore --list) before declaring success.
 * - Prunes dumps older than --keep-days, always keeping the newest --keep-min.
 * Read-only against the source database. The password is passed via PGPASSWORD only.
 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { appliedMigrations, arg, parseDbUrl, run, tableCounts } from './lib.mjs';

const conn = parseDbUrl(process.env.DATABASE_URL);
const outDir = path.resolve(arg('out', process.env.BACKUP_DIR || './backups'));
const keepDays = Number(arg('keep-days', process.env.BACKUP_KEEP_DAYS || 14));
const keepMin = Number(arg('keep-min', process.env.BACKUP_KEEP_MIN || 7));
const PREFIX = '20mart-';

const sha256File = (file) =>
  new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(file).on('data', (d) => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject);
  });

async function prune() {
  const files = (await readdir(outDir)).filter((f) => f.startsWith(PREFIX) && f.endsWith('.dump'));
  const withTime = await Promise.all(files.map(async (f) => ({ f, t: (await stat(path.join(outDir, f))).mtimeMs })));
  withTime.sort((a, b) => b.t - a.t);
  const cutoff = Date.now() - keepDays * 86_400_000;
  const removed = [];
  for (const [i, { f, t }] of withTime.entries()) {
    if (i < keepMin || t >= cutoff) continue;
    await unlink(path.join(outDir, f));
    await unlink(path.join(outDir, `${f}.json`)).catch(() => undefined);
    removed.push(f);
  }
  return removed;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(outDir, `${PREFIX}${conn.database}-${stamp}.dump`);
  const started = Date.now();

  // Counts first, then the dump: on a live DB the dump can only contain rows >= these counts
  // for append-only tables; restore-verify reports any difference instead of hiding it.
  const counts = tableCounts(conn);
  const migrations = appliedMigrations(conn);
  run('pg_dump', ['--format=custom', '--compress=6', '--no-owner', '--no-privileges', '--file', file, '--dbname', conn.url], conn);
  const list = run('pg_restore', ['--list', file], conn);
  const tocEntries = list.split(/\r?\n/).filter((l) => l && !l.startsWith(';')).length;
  if (tocEntries === 0) throw new Error('Backup archive is empty or unreadable');

  const { size } = await stat(file);
  const manifest = {
    createdAt: new Date().toISOString(),
    database: conn.database,
    host: conn.host,
    file: path.basename(file),
    sizeBytes: size,
    sha256: await sha256File(file),
    tocEntries,
    durationMs: Date.now() - started,
    pgDump: run('pg_dump', ['--version'], conn).trim(),
    migrations,
    tableCounts: counts,
  };
  await writeFile(`${file}.json`, JSON.stringify(manifest, null, 2));
  const removed = await prune();
  console.log(
    JSON.stringify({ ok: true, file, sizeBytes: size, sha256: manifest.sha256, tables: Object.keys(counts).length, migrations: migrations.length, durationMs: manifest.durationMs, pruned: removed }, null, 2)
  );
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message }));
  process.exit(1);
});
