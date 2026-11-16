/**
 * Profile hot server functions with per-query timings (Prisma query events).
 *   DATABASE_URL=<scratch db> npx tsx scripts/profile-queries.ts
 * Read-only except for listAdminOrders' opportunistic reservation expiry (a no-op on scratch data).
 */
import { createRequire } from 'node:module';
import type { Prisma, PrismaClient as PrismaClientType } from '@20mart/database';

// Load @prisma/client WITHOUT evaluating @20mart/database first, so the services pick up this
// instrumented client through the shared global instead of creating their own.
const { PrismaClient } = createRequire(require.resolve('../../database/package.json'))('@prisma/client') as { PrismaClient: typeof PrismaClientType };
const client = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] }) as PrismaClientType<Prisma.PrismaClientOptions, 'query'>;
(globalThis as { prismaGlobal?: unknown }).prismaGlobal = client;

let queries: { ms: number; sql: string }[] = [];
client.$on('query', (e: Prisma.QueryEvent) => queries.push({ ms: Number(e.duration), sql: e.query.replace(/\s+/g, ' ').slice(0, 160) }));

async function profile(name: string, fn: () => Promise<unknown>) {
  await fn(); // warm
  queries = [];
  const t = performance.now();
  await fn();
  const total = performance.now() - t;
  const top = [...queries].sort((a, b) => b.ms - a.ms).slice(0, 4);
  console.log(`\n${name}: ${total.toFixed(0)} ms wall, ${queries.length} queries, Σdb ${queries.reduce((a, q) => a + q.ms, 0)} ms`);
  for (const q of top) console.log(`  ${String(q.ms).padStart(5)} ms  ${q.sql}`);
}

async function main() {
  const { listAdminOrders, getOrderStats, listCustomers } = await import('../src/admin-orders');
  const { getAnalytics } = await import('../src/analytics');
  const { listCustomerDirectory } = (await import('../src/customers').catch(() => ({}))) as { listCustomerDirectory?: (q: unknown) => Promise<unknown> };
  const { getDashboardStats } = await import('../src/dashboard');
  const { listPublicProducts, listPopularProducts } = await import('../src/catalog/public');

  await profile('listAdminOrders()', () => listAdminOrders({}));
  await profile('listAdminOrders(q=load)', () => listAdminOrders({ q: 'load' }));
  await profile('getOrderStats()', () => getOrderStats());
  await profile('listCustomers()', () => listCustomers({}));
  if (listCustomerDirectory) await profile('listCustomerDirectory()', () => listCustomerDirectory({}));
  await profile('getAnalytics(30d)', () => getAnalytics({ range: '30d' }));
  await profile('getDashboardStats()', () => getDashboardStats());
  await profile('listPublicProducts(q=steel bottle)', () => listPublicProducts({ q: 'steel bottle' }));
  await profile('listPublicProducts(inStock, price_asc)', () => listPublicProducts({ inStock: true, sort: 'price_asc' }));
  await profile('listPopularProducts(10)', () => listPopularProducts(10));
  await client.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
