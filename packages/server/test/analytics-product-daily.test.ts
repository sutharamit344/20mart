/**
 * Analytics Phase C (C1): daily product demand aggregates, stock replay, coverage, catch-up and backfill.
 * Days are IST. The tests use "yesterday" relative to the real clock so movements created by the
 * flows under test (which carry the real time) are always after the aggregated day.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { prisma } from '@20mart/database';
import { addItem } from '../src/cart';
import { createAddress } from '../src/addresses';
import { placeOrder } from '../src/orders';
import { runMaintenance } from '../src/maintenance';
import {
  addDays,
  aggregateProductDay,
  backfillProductDaily,
  clearAnalyticsSettingsCache,
  coverageFor,
  firstDataDay,
  getAnalyticsDataCoverage,
  istDayOf,
  istDayWindow,
  PRODUCT_DAILY_JOB,
  replayStockDay,
  runProductDailyAggregation,
} from '../src/tracking';
import { createCustomer, makeSellable, resetDb, setupDelivery, testWarehouse, VALID_ADDRESS } from './helpers';

const NOW = new Date();
const TODAY = istDayOf(NOW);
const D = addDays(TODAY, -1); // the day under test (finished)
/** An instant at IST wall time on `day`, e.g. ist(D, '14:05'). */
const ist = (day: string, hhmm: string) => new Date(Date.parse(`${day}T${hhmm}:00.000+05:30`));
const dbDay = (day: string) => new Date(`${day}T00:00:00.000Z`);

async function backdate(productId: string, to = ist(addDays(D, -5), '09:00')) {
  await prisma.product.update({ where: { id: productId }, data: { createdAt: to } });
  await prisma.inventory.updateMany({ where: { productId }, data: { createdAt: to } });
}

type Ev = { name: string; productId?: string; quantity?: number; unitPricePaise?: number; visitorId?: string; at: Date; category?: 'BEHAVIORAL' | 'OPERATIONAL' };
async function events(list: Ev[]) {
  await prisma.analyticsEvent.createMany({
    data: list.map((e) => ({
      id: randomUUID(),
      name: e.name as never,
      category: e.category ?? (['PRODUCT_VIEWED', 'PRODUCT_UNAVAILABLE_VIEWED'].includes(e.name) ? 'BEHAVIORAL' : 'OPERATIONAL'),
      source: ['PRODUCT_VIEWED', 'PRODUCT_UNAVAILABLE_VIEWED'].includes(e.name) ? 'CLIENT' : 'SERVER',
      occurredAt: e.at,
      productId: e.productId,
      quantity: e.quantity,
      unitPricePaise: e.unitPricePaise,
      visitorId: e.visitorId,
    })),
  });
}

/** A real COD order through the checkout flow, then placed at `at` with optional status/payment overrides. */
async function order(productId: string, qty: number, at: Date, patch: Record<string, unknown> = {}) {
  const c = await createCustomer();
  const address = await createAddress(c.user.id, VALID_ADDRESS);
  await addItem({ userId: c.user.id }, { productId, quantity: qty });
  const r = await placeOrder(c.user.id, { addressId: address.id, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: randomUUID() });
  const o = await prisma.order.update({ where: { orderNumber: r.orderNumber }, data: { createdAt: at, ...patch } });
  return o;
}

const row = (productId: string, day = D) => prisma.productDailyAnalytics.findUnique({ where: { day_productId: { day: dbDay(day), productId } } });
const strip = <T extends { computedAt: Date }>(r: T) => ({ ...r, computedAt: undefined });

beforeEach(async () => {
  await resetDb();
  clearAnalyticsSettingsCache();
  await setupDelivery({ minOrderPaise: 100 });
});

/* ───────────────────────────── pure helpers ───────────────────────────── */

describe('IST days and coverage', () => {
  it('IST day windows start at 00:00 IST (18:30 UTC the day before)', () => {
    const { start, end } = istDayWindow('2026-11-24');
    expect(start.toISOString()).toBe('2026-11-23T18:30:00.000Z');
    expect(end.toISOString()).toBe('2026-11-24T18:30:00.000Z');
    expect(istDayOf(new Date('2026-11-23T18:29:59.999Z'))).toBe('2026-11-23');
    expect(istDayOf(new Date('2026-11-23T18:30:00.000Z'))).toBe('2026-11-24');
    expect(() => istDayWindow('2026-13-40')).toThrow();
  });

  it('coverage: NONE before tracking started, PARTIAL on the first day, FULL afterwards', () => {
    const started = new Date('2026-11-20T09:00:00.000Z'); // 14:30 IST on 20 Nov
    expect(coverageFor('2026-11-19', started)).toBe('NONE');
    expect(coverageFor('2026-11-20', started)).toBe('PARTIAL');
    expect(coverageFor('2026-11-21', started)).toBe('FULL');
    expect(coverageFor('2026-11-21', null)).toBe('NONE');
  });
});

describe('stock movement replay', () => {
  const day = istDayWindow('2026-11-24');
  const at = (hh: number) => new Date(day.start.getTime() + hh * 3_600_000);
  const base = { from: day.start.getTime(), to: day.end.getTime(), safetyStock: 0 };

  it('measures stockout time between movements', () => {
    const r = replayStockDay({
      ...base,
      openingAvailable: 5,
      openingReserved: 0,
      movements: [
        { movementType: 'STOCK_OUT', quantity: -5, previousQuantity: 5, newQuantity: 0, createdAt: at(6) },
        { movementType: 'STOCK_IN', quantity: 3, previousQuantity: 0, newQuantity: 3, createdAt: at(18) },
      ],
    });
    expect(r).toMatchObject({ closingAvailable: 3, closingSellable: 3, stockoutMinutes: 720, longestStockoutMinutes: 720, stockouts: 1, trackedMinutes: 1440, consistent: true, movements: 2 });
    expect(r.inStock).toHaveLength(2);
  });

  it('reservations reduce sellable stock; release and dispatch follow the real semantics', () => {
    const r = replayStockDay({
      ...base,
      openingAvailable: 2,
      openingReserved: 0,
      movements: [
        { movementType: 'RESERVATION', quantity: 2, previousQuantity: 0, newQuantity: 2, createdAt: at(10) },
        { movementType: 'RELEASE', quantity: -1, previousQuantity: 2, newQuantity: 1, createdAt: at(12) },
        { movementType: 'SALE', quantity: -1, previousQuantity: 2, newQuantity: 1, createdAt: at(15) },
      ],
    });
    // 10:00–12:00 nothing sellable (2 − 2); then 2 − 1 = 1; after dispatch 1 − 0 = 1.
    expect(r).toMatchObject({ closingAvailable: 1, closingReserved: 0, closingSellable: 1, stockoutMinutes: 120, stockouts: 1 });
  });

  it('safety stock counts as not sellable; impossible history is flagged', () => {
    expect(replayStockDay({ ...base, safetyStock: 3, openingAvailable: 3, openingReserved: 0, movements: [] })).toMatchObject({ stockoutMinutes: 1440, stockouts: 1 });
    expect(
      replayStockDay({ ...base, openingAvailable: 1, openingReserved: 0, movements: [{ movementType: 'STOCK_OUT', quantity: -2, previousQuantity: 1, newQuantity: -1, createdAt: at(1) }] })
    ).toMatchObject({ consistent: false });
  });
});

/* ───────────────────────────── one day ───────────────────────────── */

describe('daily product aggregation', () => {
  it('aggregates demand events by IST day and keeps actual sales separate from estimates', async () => {
    const { product: a } = await makeSellable({ sku: 'PC-A', pricePaise: 2500, stock: 50 });
    const { product: quiet } = await makeSellable({ sku: 'PC-Q', stock: 5 });
    const { product: archived } = await makeSellable({ sku: 'PC-X', stock: 0 });
    await prisma.product.update({ where: { id: archived.id }, data: { status: 'ARCHIVED' } });
    for (const p of [a, quiet, archived]) await backdate(p.id);
    await events([
      { name: 'PRODUCT_VIEWED', productId: a.id, visitorId: 'v1', at: ist(D, '09:00') },
      { name: 'PRODUCT_VIEWED', productId: a.id, visitorId: 'v1', at: ist(D, '09:05') },
      { name: 'PRODUCT_VIEWED', productId: a.id, visitorId: 'v2', at: ist(D, '11:00') },
      { name: 'PRODUCT_UNAVAILABLE_VIEWED', productId: a.id, visitorId: 'v2', at: ist(D, '11:01') },
      { name: 'CART_ITEM_ADDED', productId: a.id, quantity: 2, unitPricePaise: 2500, at: ist(D, '10:15') },
      { name: 'CART_ITEM_ADDED', productId: a.id, quantity: 1, unitPricePaise: 2500, at: ist(D, '22:40') },
      { name: 'CART_ITEM_REMOVED', productId: a.id, quantity: 1, at: ist(D, '23:00') },
      { name: 'WISHLIST_ADDED', productId: a.id, at: ist(D, '12:00') },
      { name: 'OUT_OF_STOCK_ADD_ATTEMPT', productId: a.id, quantity: 2, unitPricePaise: 5000, at: ist(D, '13:00') },
      // Outside the IST day: the minute before midnight the day before, and midnight the day after.
      { name: 'CART_ITEM_ADDED', productId: a.id, quantity: 7, at: ist(addDays(D, -1), '23:59') },
      { name: 'CART_ITEM_ADDED', productId: a.id, quantity: 9, at: ist(TODAY, '00:00') },
    ]);
    const done = await order(a.id, 2, ist(D, '14:05'), { discountPaise: 1000, totalPaise: 5000 + 4000 - 1000 }); // coupon: revenue stays gross line value
    await order(a.id, 1, ist(D, '15:00'), { status: 'CANCELLED' });
    await order(a.id, 3, ist(D, '16:00'), { paymentMethod: 'ONLINE', paymentStatus: 'PENDING' }); // unpaid online: not a sale
    await order(a.id, 1, ist(D, '17:00'), { paymentMethod: 'ONLINE', paymentStatus: 'PAID', status: 'CONFIRMED' });
    await order(a.id, 1, ist(D, '18:00'), { status: 'FAILED' });
    await order(a.id, 4, ist(TODAY, '00:01')); // next day

    const r = await aggregateProductDay(D, { now: NOW });
    expect(r).toMatchObject({ day: D, status: 'done', coverage: 'FULL' }); // tracking started the day before D (23:59 IST)

    const ra = (await row(a.id))!;
    expect(ra).toMatchObject({
      views: 3,
      uniqueViewers: 2,
      unavailableViews: 1,
      cartAddUnits: 3,
      cartAddEvents: 2,
      cartRemoveUnits: 1,
      wishlistAdds: 1,
      outOfStockAttempts: 1,
      outOfStockUnits: 2,
      estLostRevenuePaise: 10_000,
      orders: 2,
      unitsSold: 3, // 2 (COD) + 1 (paid online)
      revenuePaise: 3 * 2500, // gross item lines, coupon not deducted
      cancelledUnits: 1,
      failedDeliveryUnits: 1,
    });
    expect(ra.cartAddUnitsByHour[10]).toBe(2);
    expect(ra.cartAddUnitsByHour[22]).toBe(1);
    expect(ra.unitsSoldByHour[14]).toBe(2);
    expect(ra.unitsSoldByHour[17]).toBe(1);
    expect(ra.unitsSoldByHour.reduce((x, y) => x + y, 0)).toBe(3);
    expect(done.discountPaise).toBe(1000);

    // Zero demand is an explicit row (with coverage), distinct from "no data".
    expect(await row(quiet.id)).toMatchObject({ views: 0, cartAddUnits: 0, unitsSold: 0 });
    expect(await row(archived.id)).toBeNull(); // archived and inactive: no row
    expect(await prisma.analyticsJobRun.findUnique({ where: { job_day: { job: PRODUCT_DAILY_JOB, day: dbDay(D) } } })).toMatchObject({ status: 'done' });
  });

  it('never invents behavioural history: days before tracking started have coverage NONE, sales still count', async () => {
    const { product } = await makeSellable({ sku: 'PC-N', pricePaise: 1000, stock: 20 });
    await backdate(product.id);
    const before = addDays(D, -1);
    await order(product.id, 2, ist(before, '12:00'));
    await events([{ name: 'PRODUCT_VIEWED', productId: product.id, visitorId: 'v1', at: ist(D, '15:00') }]); // tracking starts mid-D
    const eventsBefore = await prisma.analyticsEvent.count();

    await aggregateProductDay(before, { now: NOW });
    await aggregateProductDay(D, { now: NOW });
    expect(await row(product.id, before)).toMatchObject({ eventCoverage: 'NONE', views: 0, cartAddUnits: 0, unitsSold: 2 });
    expect(await row(product.id, D)).toMatchObject({ eventCoverage: 'PARTIAL', views: 1 });
    expect(await prisma.analyticsEvent.count()).toBe(eventsBefore);

    // The tracking start is stored once, so it survives raw-event retention.
    const cov = await getAnalyticsDataCoverage();
    expect(cov).toMatchObject({ firstTrackedDay: D, salesFromDay: before });
    await prisma.analyticsEvent.deleteMany({});
    clearAnalyticsSettingsCache();
    expect((await getAnalyticsDataCoverage()).firstTrackedDay).toBe(D);
  });

  it('replays stock per warehouse and summarises availability across ACTIVE warehouses only', async () => {
    const { product, inventoryId: wh1Row } = await makeSellable({ sku: 'PC-S', stock: 0 });
    const wh2 = await testWarehouse('TEST-WH2');
    const wh3 = await testWarehouse('TEST-WH3');
    await prisma.warehouse.update({ where: { id: wh3.id }, data: { status: 'PAUSED' } });
    const r2 = await prisma.inventory.create({ data: { productId: product.id, warehouseId: wh2.id, availableQuantity: 6 } });
    const r3 = await prisma.inventory.create({ data: { productId: product.id, warehouseId: wh3.id, availableQuantity: 50 } });
    await backdate(product.id);
    const mv = (inventoryId: string, movementType: 'STOCK_IN' | 'STOCK_OUT', prev: number, next: number, createdAt: Date) =>
      prisma.stockMovement.create({ data: { inventoryId, movementType, quantity: next - prev, previousQuantity: prev, newQuantity: next, reason: 'test', createdAt } });
    await mv(wh1Row, 'STOCK_OUT', 5, 0, ist(D, '08:00')); // WH1: 5 until 08:00, then 0
    await mv(r2.id, 'STOCK_IN', 0, 4, ist(D, '12:00')); // WH2: 0 until 12:00, then 4 …
    await mv(r2.id, 'STOCK_IN', 4, 6, ist(TODAY, '00:30')); // … and +2 after the day (current = 6)

    await aggregateProductDay(D, { now: NOW });
    const snap = async (inventoryId: string) => prisma.inventoryDailySnapshot.findUnique({ where: { day_inventoryId: { day: dbDay(D), inventoryId } } });
    expect(await snap(wh1Row)).toMatchObject({ warehouseActive: true, openingAvailable: 5, closingAvailable: 0, stockoutMinutes: 960, longestStockoutMinutes: 960, stockouts: 1, movements: 1, consistent: true });
    expect(await snap(r2.id)).toMatchObject({ openingAvailable: 0, closingAvailable: 4, closingSellable: 4, stockoutMinutes: 720 });
    expect(await snap(r3.id)).toMatchObject({ warehouseActive: false, openingAvailable: 50, stockoutMinutes: 0 }); // kept per warehouse
    // Product level: in stock 00:00–08:00 (WH1) and 12:00–24:00 (WH2) → 4 h without stock; the paused WH3 does not count.
    expect(await row(product.id)).toMatchObject({ stockoutMinutes: 240, activeStockRows: 2, inStockAtClose: true });
  });

  it('is idempotent, reflects late changes on rerun, and serialises concurrent runs', async () => {
    const { product } = await makeSellable({ sku: 'PC-I', pricePaise: 1500, stock: 20 });
    await backdate(product.id);
    await events([{ name: 'CART_ITEM_ADDED', productId: product.id, quantity: 1, at: ist(D, '10:00') }]);
    const o = await order(product.id, 2, ist(D, '11:00'));

    await aggregateProductDay(D, { now: NOW });
    const first = (await prisma.productDailyAnalytics.findMany({ orderBy: { productId: 'asc' } })).map(strip);
    const firstSnaps = (await prisma.inventoryDailySnapshot.findMany({ orderBy: { inventoryId: 'asc' } })).map(strip);
    await Promise.all([aggregateProductDay(D, { now: NOW }), aggregateProductDay(D, { now: NOW })]);
    expect((await prisma.productDailyAnalytics.findMany({ orderBy: { productId: 'asc' } })).map(strip)).toEqual(first);
    expect((await prisma.inventoryDailySnapshot.findMany({ orderBy: { inventoryId: 'asc' } })).map(strip)).toEqual(firstSnaps);
    expect(await prisma.analyticsJobRun.count({ where: { job: PRODUCT_DAILY_JOB } })).toBe(1);

    await prisma.order.update({ where: { id: o.id }, data: { status: 'CANCELLED' } }); // cancelled the next day
    await aggregateProductDay(D, { now: NOW });
    expect(await row(product.id)).toMatchObject({ unitsSold: 0, revenuePaise: 0, cancelledUnits: 2, cartAddUnits: 1 });
  });

  it('never touches business data, refuses unfinished days, and protects days past retention', async () => {
    const { product } = await makeSellable({ sku: 'PC-B', stock: 10 });
    await backdate(product.id);
    await order(product.id, 1, ist(D, '10:00'));
    const counts = async () => ({
      orders: await prisma.order.count(),
      items: await prisma.orderItem.count(),
      inventory: JSON.stringify(await prisma.inventory.findMany({ orderBy: { id: 'asc' } })),
      movements: await prisma.stockMovement.count(),
      carts: await prisma.cart.count(),
      events: await prisma.analyticsEvent.count(),
    });
    const before = await counts();
    await aggregateProductDay(D, { now: NOW });
    expect(await counts()).toEqual(before);

    await expect(aggregateProductDay(TODAY, { now: NOW })).rejects.toThrow(/not finished/);

    await prisma.analyticsSettings.update({ where: { id: 'default' }, data: { behavioralRetentionDays: 30 } });
    clearAnalyticsSettingsCache();
    const old = addDays(TODAY, -40);
    expect(await aggregateProductDay(old, { now: NOW })).toMatchObject({ status: 'done' }); // never done before: allowed
    expect(await aggregateProductDay(old, { now: NOW })).toMatchObject({ status: 'skipped', reason: 'past-retention' });
  });
});

/* ───────────────────────────── catch-up, backfill, isolation ───────────────────────────── */

describe('catch-up, backfill and failure isolation', () => {
  async function dataFrom(day: string) {
    const { product } = await makeSellable({ sku: `PC-${day}`, stock: 10 });
    await backdate(product.id, ist(day, '09:00'));
    return product;
  }
  const doneDays = async () =>
    (await prisma.analyticsJobRun.findMany({ where: { job: PRODUCT_DAILY_JOB, status: 'done' }, orderBy: { day: 'asc' } })).map((r) => r.day.toISOString().slice(0, 10));

  it('processes missing days oldest first within a bound, then refreshes recent days', async () => {
    await dataFrom(addDays(D, -3)); // days D-3 … D are missing
    const r1 = await runProductDailyAggregation({ now: NOW, maxDays: 2, refreshDays: 1 });
    expect(r1.processed.map((p) => p.day)).toEqual([addDays(D, -3), addDays(D, -2)]);
    expect(r1.remaining).toBe(2);
    const r2 = await runProductDailyAggregation({ now: NOW, maxDays: 2, refreshDays: 1 });
    expect(r2.processed.map((p) => p.day)).toEqual([addDays(D, -1), D]);
    expect(r2.remaining).toBe(0);
    expect(await doneDays()).toEqual([addDays(D, -3), addDays(D, -2), addDays(D, -1), D]);
    // Nothing missing: only the refresh window (yesterday) is recomputed.
    const r3 = await runProductDailyAggregation({ now: NOW, maxDays: 2, refreshDays: 1 });
    expect(r3.processed.map((p) => p.day)).toEqual([D]);
  });

  it('does nothing without data, and never looks back further than the bound', async () => {
    expect(await runProductDailyAggregation({ now: NOW })).toEqual({ processed: [], failed: [], remaining: 0 });
    await dataFrom(addDays(D, -100));
    const r = await runProductDailyAggregation({ now: NOW, maxDays: 50, lookbackDays: 10, refreshDays: 0 });
    expect(r.processed[0].day).toBe(addDays(D, -9));
    expect(r.processed).toHaveLength(10);
  });

  it('backfill covers full history, skips done days unless forced', async () => {
    await dataFrom(addDays(D, -2));
    const seen: string[] = [];
    const b1 = await backfillProductDaily({ now: NOW, onDay: (d) => seen.push(`${d.day}:${d.status}`) });
    expect(b1).toMatchObject({ from: addDays(D, -2), to: D, failed: [] });
    expect(seen).toEqual([`${addDays(D, -2)}:done`, `${addDays(D, -1)}:done`, `${D}:done`]);
    const b2 = await backfillProductDaily({ now: NOW });
    expect(b2.processed.every((p) => p.status === 'skipped' && p.reason === 'already-done')).toBe(true);
    const b3 = await backfillProductDaily({ now: NOW, force: true, from: D });
    expect(b3.processed).toEqual([expect.objectContaining({ day: D, status: 'done' })]);
  });

  it('a failing aggregation is recorded and never blocks the rest of the maintenance job', async () => {
    await dataFrom(D);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ProductDailyAnalytics" RENAME TO "ProductDailyAnalytics_offline"`);
    try {
      const res = await runMaintenance(NOW);
      expect(res.productAnalytics?.failed.length).toBeGreaterThan(0);
      expect(res.customerSessions).toBe(0); // the other maintenance steps still ran
      expect(res.analytics).not.toBeNull();
      expect(await prisma.analyticsJobRun.findFirst({ where: { job: PRODUCT_DAILY_JOB, day: dbDay(D) } })).toMatchObject({ status: 'failed' });
    } finally {
      await prisma.$executeRawUnsafe(`ALTER TABLE "ProductDailyAnalytics_offline" RENAME TO "ProductDailyAnalytics"`);
    }
    // Recovered on the next run.
    const r = await runProductDailyAggregation({ now: NOW });
    expect(r.failed).toEqual([]);
    expect(await prisma.analyticsJobRun.findFirst({ where: { job: PRODUCT_DAILY_JOB, day: dbDay(D) } })).toMatchObject({ status: 'done' });
  });
});

/* ───────────────────────────── dry run is read-only ───────────────────────────── */

describe('backfill dry run never writes', () => {
  const settings = () => prisma.analyticsSettings.findMany();
  const FIRST_EVENT = () => ist(addDays(D, -2), '10:15');
  const seedEvents = () =>
    events([
      { name: 'PRODUCT_VIEWED', at: FIRST_EVENT() },
      { name: 'PRODUCT_VIEWED', at: ist(D, '11:00') },
    ]);

  /** The real CLI script, against the test database (a local URL, so no --confirm-production needed). */
  const runScript = (...args: string[]) => {
    const r = spawnSync(process.execPath, [path.resolve(__dirname, '../node_modules/tsx/dist/cli.mjs'), path.resolve(__dirname, '../scripts/analytics-backfill.ts'), ...args], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      encoding: 'utf8',
      timeout: 120_000,
    });
    return { status: r.status, out: `${r.stdout}
${r.stderr}` };
  };

  it('read-only coverage reports the tracking start without creating the settings row', async () => {
    await seedEvents();
    expect(await settings()).toHaveLength(0);
    const cov = await getAnalyticsDataCoverage({ readOnly: true });
    expect(cov.trackingStartedAt?.toISOString()).toBe(FIRST_EVENT().toISOString());
    expect(cov.firstTrackedDay).toBe(addDays(D, -2));
    expect(await firstDataDay({ readOnly: true })).toBe(addDays(D, -2));
    expect(await settings()).toHaveLength(0); // nothing created
  });

  it('read-only coverage never fills an empty trackingStartedAt on an existing settings row', async () => {
    await seedEvents();
    await prisma.analyticsSettings.create({ data: { id: 'default' } });
    const before = await prisma.analyticsSettings.findUniqueOrThrow({ where: { id: 'default' } });
    expect(before.trackingStartedAt).toBeNull();
    expect((await getAnalyticsDataCoverage({ readOnly: true })).trackingStartedAt?.toISOString()).toBe(FIRST_EVENT().toISOString());
    await firstDataDay({ readOnly: true });
    expect(await prisma.analyticsSettings.findUniqueOrThrow({ where: { id: 'default' } })).toEqual(before); // row unchanged
  });

  it('`analytics:backfill --dry-run` writes nothing; the real run initialises trackingStartedAt and aggregates', async () => {
    await seedEvents();
    const dry = runScript('--dry-run');
    expect(dry.status, dry.out).toBe(0);
    expect(dry.out).toMatch(/DRY RUN: would aggregate \d+ day\(s\)/);
    expect(dry.out).toContain(`first tracked IST day: ${addDays(D, -2)}`);
    // No settings row, no job records, no aggregates.
    expect(await settings()).toHaveLength(0);
    expect(await prisma.analyticsJobRun.count()).toBe(0);
    expect(await prisma.productDailyAnalytics.count()).toBe(0);
    expect(await prisma.inventoryDailySnapshot.count()).toBe(0);

    // An existing row with an empty tracking start is not filled by a dry run either.
    await prisma.analyticsSettings.create({ data: { id: 'default' } });
    expect(runScript('--dry-run').status).toBe(0);
    expect((await prisma.analyticsSettings.findUniqueOrThrow({ where: { id: 'default' } })).trackingStartedAt).toBeNull();

    // The real backfill initialises the tracking start (as designed) and aggregates every day.
    const real = runScript();
    expect(real.status, real.out).toBe(0);
    expect(real.out).toMatch(/Done: \d+ aggregated, 0 skipped, 0 failed\./);
    expect((await prisma.analyticsSettings.findUniqueOrThrow({ where: { id: 'default' } })).trackingStartedAt?.toISOString()).toBe(FIRST_EVENT().toISOString());
    expect(await prisma.analyticsJobRun.count({ where: { job: PRODUCT_DAILY_JOB, status: 'done' } })).toBeGreaterThan(0);
  });

  it('the real backfill (service) initialises trackingStartedAt from the first event and keeps it', async () => {
    await seedEvents();
    const r = await backfillProductDaily();
    expect(r.failed).toEqual([]);
    const s = await prisma.analyticsSettings.findUniqueOrThrow({ where: { id: 'default' } });
    expect(s.trackingStartedAt?.toISOString()).toBe(FIRST_EVENT().toISOString());
    // Later purging of old raw events never moves the stored start.
    await prisma.analyticsEvent.deleteMany({ where: { occurredAt: { lt: ist(D, '00:00') } } });
    expect((await getAnalyticsDataCoverage({ readOnly: true })).trackingStartedAt?.toISOString()).toBe(FIRST_EVENT().toISOString());
    expect((await getAnalyticsDataCoverage()).trackingStartedAt?.toISOString()).toBe(FIRST_EVENT().toISOString());
  });
});
