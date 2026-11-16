// Shared helpers for the PostgreSQL backup / restore scripts (Node 22, no dependencies).
import { spawnSync } from 'node:child_process';
import path from 'node:path';

/** Locate a PostgreSQL client binary (pg_dump, pg_restore, psql). PG_BIN overrides PATH. */
export function pgBin(name) {
  const dir = process.env.PG_BIN;
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  return dir ? path.join(dir, exe) : exe;
}

/**
 * Split a Prisma DATABASE_URL into a libpq connection URL (without Prisma-only
 * query params such as ?schema= / ?connection_limit=) and the password, which is
 * passed through PGPASSWORD so it never appears in a process listing or log.
 */
export function parseDbUrl(raw) {
  if (!raw) throw new Error('DATABASE_URL is not set');
  const u = new URL(raw);
  if (!/^postgres(ql)?:$/.test(u.protocol)) throw new Error('DATABASE_URL must be a postgresql:// URL');
  const password = decodeURIComponent(u.password);
  u.password = '';
  const keep = new URLSearchParams();
  for (const [k, v] of u.searchParams) if (['sslmode', 'sslrootcert', 'sslcert', 'sslkey'].includes(k)) keep.set(k, v);
  u.search = keep.toString();
  const database = decodeURIComponent(u.pathname.replace(/^\//, ''));
  return { url: u.toString(), password, database, host: u.hostname, port: u.port || '5432', user: decodeURIComponent(u.username) };
}

/** Same server/credentials, different database name. */
export function withDatabase(conn, database) {
  const u = new URL(conn.url);
  u.pathname = `/${encodeURIComponent(database)}`;
  return { ...conn, url: u.toString(), database };
}

/** Run a PostgreSQL client tool; the password travels only via the environment. */
export function run(tool, args, conn, opts = {}) {
  const r = spawnSync(pgBin(tool), args, {
    env: { ...process.env, PGPASSWORD: conn.password },
    encoding: opts.encoding ?? 'utf8',
    maxBuffer: 1024 * 1024 * 256,
    stdio: opts.stdio ?? ['ignore', 'pipe', 'pipe'],
  });
  if (r.error) throw new Error(`${tool} could not start (${r.error.message}). Set PG_BIN to your PostgreSQL bin directory.`);
  if (r.status !== 0) throw new Error(`${tool} failed (exit ${r.status}): ${String(r.stderr).trim().slice(0, 2000)}`);
  return r.stdout;
}

export function psql(conn, sql) {
  return run('psql', ['--no-psqlrc', '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-d', conn.url, '-c', sql], conn).trim();
}

/** Exact row count for every table in the public schema, as { table: count }. */
export function tableCounts(conn) {
  const out = psql(
    conn,
    `SELECT table_name || '|' || (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I', table_name), false, true, '')))[1]::text
       FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`
  );
  return Object.fromEntries(
    out
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => {
        const [t, c] = l.split('|');
        return [t, Number(c)];
      })
  );
}

export function appliedMigrations(conn) {
  return psql(conn, `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`)
    .split(/\r?\n/)
    .filter(Boolean);
}

export function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}
export const flag = (name) => process.argv.includes(`--${name}`);
