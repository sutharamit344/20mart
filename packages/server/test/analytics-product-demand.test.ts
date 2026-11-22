/**
 * Analytics Phase C (C2): admin product demand APIs (list, detail, compare, CSV export).
 * Most tests seed the daily aggregate tables directly so every number is known; one test runs the
 * real C1 aggregation end to end. Days are IST and relative to the real clock (Y = yesterday IST).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { prisma } from '@20mart/database';
import { addItem } from '../src/cart';
import { createAddress } from '../src/addresses';
import { placeOrder } from '../src/orders';
import { resetRateLimits } from '../src/rateLimit';
import { addDays, aggregateProductDay, clearAnalyticsSettingsCache, csvCell, istDayOf, PRODUCT_DAILY_JOB } from '../src/tracking';
import { adminRequest, adminSession, createCustomer, ctxParams, makeSellable, resetDb, setupDelivery, testWarehouse, VALID_ADDRESS } from './helpers';

const ADMIN = '../../../apps/20martadmin/src/app/api/admin/analytics/products';
type Handler = (r: NextRequest, c: { params: Promise<Record<string, string>> }) => Promise<Response>;
const route = async (p: string) => ((await import(`${ADMIN}${p}/route`)) as { GET: Handler }).GET;

const TODAY = istDayOf(new Date());
const Y = addDays(TODAY, -1);
const ist = (day: string, hhmm: string) => new Date(Date.parse(`${day}T${hhmm}:00.000+05:30`));
const dbDay = (day: string) => new Date(`${day}T00:00:00.000Z`);
/** Tracking starts at 12:00 IST on Y-2: Y-4, Y-3 are NONE; Y-2 PARTIAL; Y-1, Y FULL. */
const STARTED = ist(addDays(Y, -2), '12:00');
const cov = (day: string) => (day < addDays(Y, -2) ? 'NONE' : day === addDays(Y, -2) ? 'PARTIAL' : 'FULL');
const hours = (h?: number, v = 0) => Array.from({ length: 24 }, (_, i) => (i === h ? v : 0));

let mkt: { token: string };
let ops: { token: string };

async function done(days: string[]) {
  await prisma.analyticsJobRun.createMany({ data: days.map((d) => ({ job: PRODUCT_DAILY_JOB, day: dbDay(d), status: 'done', finishedAt: new Date() })) });
}

/** One aggregate row; event fields are zeroed on NONE days exactly as C1 writes them. */
async function seedRow(productId: string, day: string, p: Record<string, unknown> = {}) {
  const c = cov(day);
  const ev = c === 'NONE' ? { views: 0, uniqueViewers: 0, cartAddUnits: 0, cartAddEvents: 0, outOfStockUnits: 0, outOfStockAttempts: 0, estLostRevenuePaise: 0, wishlistAdds: 0 } : {};
  const prod = await prisma.product.findUniqueOrThrow({ where: { id: productId }, select: { categoryId: true } });
  await prisma.productDailyAnalytics.create({
    data: {
      day: dbDay(day),
      productId,
      categoryId: prod.categoryId,
      eventCoverage: c,
      cartAddUnitsByHour: hours(),
      unitsSoldByHour: hours(),
      activeStockRows: 1,
      inStockAtClose: true,
      ...p,
      ...ev,
    },
  });
}

async function product(sku: string, name: string, category = 'kitchen') {
  const { product, inventoryId } = await makeSellable({ sku, name, category });
  await prisma.product.update({ where: { id: product.id }, data: { createdAt: ist(addDays(Y, -30), '09:00') } });
  return { id: product.id, inventoryId };
}

const get = async (path: string, token = mkt.token, params: Record<string, string> = {}) => {
  const [p, qs] = path.split('?');
  const handler = await route(p);
  return handler(adminRequest(`/api/admin/analytics/products${p}${qs ? `?${qs}` : ''}`.replace('/[id]', `/${params.id ?? ''}`), { token }), ctxParams(params));
};
const getJson = async (path: string, params: Record<string, string> = {}) => {
  const res = await get(path, mkt.token, params);
  expect(res.status, await res.clone().text()).toBe(200);
  return res.json();
};
const range = (from: string, to: string) => `from=${from}&to=${to}`;
const LAST5 = range(addDays(Y, -4), Y);

let A: { id: string; inventoryId: string };
let B: { id: string; inventoryId: string };
let C: { id: string; inventoryId: string };

/** A kettle that sells, a lamp with lost demand and stockouts, and a mug never stocked anywhere. */
async function seedCatalog() {
  A = await product('KET-1', 'Steel Kettle');
  B = await product('LMP-1', 'Desk Lamp', 'home');
  C = await product('MUG-1', 'Tea Mug 100%');
  await prisma.analyticsEvent.create({ data: { id: randomUUID(), name: 'PRODUCT_VIEWED', category: 'BEHAVIORAL', source: 'CLIENT', occurredAt: STARTED } });
  const days = [0, 1, 2, 3, 4].map((i) => addDays(Y, -i));
  await done(days);
  for (const d of days) {
    await seedRow(A.id, d, { orders: 2, unitsSold: 3, revenuePaise: 6000, views: 10, uniqueViewers: 7, cartAddUnits: 4, cartAddEvents: 3, unitsSoldByHour: hours(14, 3), cartAddUnitsByHour: hours(20, 4) });
    await seedRow(B.id, d, { orders: 1, unitsSold: 1, revenuePaise: 2500, cancelledUnits: 1, views: 5, outOfStockAttempts: 2, outOfStockUnits: 3, estLostRevenuePaise: 7500, stockoutMinutes: 360, inStockAtClose: d !== Y });
    await seedRow(C.id, d, { activeStockRows: 0, inStockAtClose: false, stockoutMinutes: 1440 });
  }
  // Outside the range (Y-5) — must never be counted when the range starts at Y-4.
  await done([addDays(Y, -5)]);
  await seedRow(A.id, addDays(Y, -5), { orders: 100, unitsSold: 100, revenuePaise: 999_900 });
}

beforeEach(async () => {
  await resetDb();
  resetRateLimits();
  clearAnalyticsSettingsCache();
  mkt = await adminSession('mkt', ['MARKETING_MANAGER']);
  ops = await adminSession('ops', ['ORDER_MANAGER']);
});

/* ───────────────────────────── authorization ───────────────────────────── */

describe('authorization', () => {
  it('every endpoint requires a signed-in admin with analytics.view (checked on the server)', async () => {
    const p = await product('AUTH-1', 'Auth item');
    const q = await product('AUTH-2', 'Auth item 2');
    const cases: [string, Record<string, string>][] = [
      ['', {}],
      ['/[id]', { id: p.id }],
      [`/compare?ids=${p.id},${q.id}`, {}],
      ['/export', {}],
    ];
    for (const [path, params] of cases) {
      const [pp, qs] = path.split('?');
      const handler = await route(pp);
      const url = `/api/admin/analytics/products${pp.replace('/[id]', `/${params.id ?? ''}`)}${qs ? `?${qs}` : ''}`;
      expect((await handler(adminRequest(url), ctxParams(params))).status, `${path} anonymous`).toBe(401);
      expect((await handler(adminRequest(url, { token: 'forged-token' }), ctxParams(params))).status, `${path} forged`).toBe(401);
      expect((await handler(adminRequest(url, { token: ops.token }), ctxParams(params))).status, `${path} no permission`).toBe(403);
      expect((await handler(adminRequest(url, { token: mkt.token }), ctxParams(params))).status, `${path} allowed`).toBe(200);
    }
  });

  it('a deactivated admin is refused even with a valid session', async () => {
    await prisma.adminUser.update({ where: { username: 'mkt' }, data: { status: 'INACTIVE' } });
    expect([401, 403]).toContain((await get('')).status);
  });
});

/* ───────────────────────────── date ranges ───────────────────────────── */

describe('IST date ranges and validation', () => {
  it('defaults to the last 30 finished IST days ending yesterday', async () => {
    const body = await getJson('');
    expect(body.coverage).toMatchObject({ from: addDays(Y, -29), to: Y, days: 30 });
  });

  it('rejects unfinished, reversed, oversized, malformed and impossible ranges, and unknown parameters', async () => {
    const bad = [
      `?${range(Y, TODAY)}`,
      `?${range(Y, addDays(Y, -1))}`,
      `?${range(addDays(Y, -366), Y)}`,
      '?from=2026-02-30',
      '?from=21-11-2026',
      '?from=2026-11-01T00:00:00Z',
      '?evil=1',
      '?sort=password',
      '?pageSize=101',
      '?page=0',
    ];
    for (const qs of bad) expect((await get(qs)).status, qs).toBe(400);
    expect((await get(`?${range(addDays(Y, -365), Y)}`)).status).toBe(200); // exactly 366 days
  });

  it('ranges are inclusive IST days; a day just outside is never counted', async () => {
    await seedCatalog();
    const five = await getJson(`?${LAST5}&q=KET`);
    expect(five.items[0].actual).toEqual({ orders: 10, unitsSold: 15, revenuePaise: 30000, cancelledUnits: 0, failedDeliveryUnits: 0 });
    const one = await getJson(`?${range(Y, Y)}&q=KET`);
    expect(one.items[0].actual.unitsSold).toBe(3);
    const six = await getJson(`?${range(addDays(Y, -5), Y)}&q=KET`);
    expect(six.items[0].actual.unitsSold).toBe(115);
  });

  it('reports NONE / PARTIAL / FULL coverage and days not aggregated yet', async () => {
    await seedCatalog();
    const none = await getJson(`?${range(addDays(Y, -4), addDays(Y, -3))}`);
    expect(none.coverage).toMatchObject({ eventCoverage: 'NONE', aggregatedDays: 2, eventDays: { NONE: 2, PARTIAL: 0, FULL: 0 }, firstTrackedDay: addDays(Y, -2) });
    expect(new Date(none.coverage.trackingStartedAt).toISOString()).toBe(STARTED.toISOString());
    expect((await getJson(`?${range(addDays(Y, -1), Y)}`)).coverage.eventCoverage).toBe('FULL');
    expect((await getJson(`?${LAST5}`)).coverage).toMatchObject({ eventCoverage: 'PARTIAL', eventDays: { NONE: 2, PARTIAL: 1, FULL: 2 }, missingDays: [] });
    const wider = await getJson(`?${range(addDays(Y, -7), Y)}`);
    expect(wider.coverage).toMatchObject({ days: 8, aggregatedDays: 6, missingDays: [addDays(Y, -7), addDays(Y, -6)] });
  });
});

/* ───────────────────────────── list ───────────────────────────── */

describe('product demand list', () => {
  it('keeps actual sales and the lost-revenue estimate separate, with availability metrics', async () => {
    await seedCatalog();
    const body = await getJson(`?${LAST5}&q=LMP`);
    const b = body.items[0];
    expect(b.actual).toEqual({ orders: 5, unitsSold: 5, revenuePaise: 12500, cancelledUnits: 5, failedDeliveryUnits: 0 });
    // Only the 3 tracked days count for events (the NONE days carry no events).
    expect(b.estimated).toEqual({ lostRevenuePaise: 22500, outOfStockAttempts: 6, outOfStockUnits: 9 });
    expect(b.demand.views).toBe(15);
    expect(b.eventCoverage).toBe('PARTIAL');
    expect(b.availability).toEqual({ trackedMinutes: 5 * 1440, stockoutMinutes: 1800, availabilityPct: 75, stockoutDays: 5, unstockedDays: 0, inStockAtClose: false });
    expect(body.totals.actual.revenuePaise).toBe(12500);
    expect(body.totals.estimated.lostRevenuePaise).toBe(22500);
  });

  it('distinguishes zero demand (0) from no data (null)', async () => {
    await seedCatalog();
    const untracked = await getJson(`?${range(addDays(Y, -4), addDays(Y, -3))}&q=MUG`);
    expect(untracked.items[0].eventCoverage).toBe('NONE');
    expect(untracked.items[0].demand).toEqual({ views: null, viewerDays: null, unavailableViews: null, cartAddUnits: null, cartAddEvents: null, cartRemoveUnits: null, wishlistAdds: null });
    expect(untracked.items[0].estimated.lostRevenuePaise).toBeNull();
    expect(untracked.items[0].actual.unitsSold).toBe(0); // sales history exists independently of tracking
    expect(untracked.totals.estimated.lostRevenuePaise).toBeNull();
    const tracked = await getJson(`?${range(addDays(Y, -1), Y)}&q=MUG`);
    expect(tracked.items[0].eventCoverage).toBe('FULL');
    expect(tracked.items[0].demand.views).toBe(0);
    expect(tracked.items[0].estimated.lostRevenuePaise).toBe(0);
  });

  it('paginates, sorts (no data last) and keeps totals for the whole filtered set', async () => {
    await seedCatalog();
    const p1 = await getJson(`?${LAST5}&sort=unitsSold&dir=desc&pageSize=2&page=1`);
    expect(p1).toMatchObject({ total: 3, totalPages: 2, page: 1, pageSize: 2 });
    expect(p1.items.map((x: { sku: string }) => x.sku)).toEqual(['KET-1', 'LMP-1']);
    const p2 = await getJson(`?${LAST5}&sort=unitsSold&dir=desc&pageSize=2&page=2`);
    expect(p2.items.map((x: { sku: string }) => x.sku)).toEqual(['MUG-1']);
    const beyond = await getJson(`?${LAST5}&pageSize=2&page=9`);
    expect(beyond.items).toEqual([]);
    expect(beyond.total).toBe(3);
    expect(beyond.totals.actual.unitsSold).toBe(20);
    expect((await getJson(`?${LAST5}&sort=name&dir=asc`)).items.map((x: { name: string }) => x.name)).toEqual(['Desk Lamp', 'Steel Kettle', 'Tea Mug 100%']);
    expect((await getJson(`?${LAST5}&sort=availability&dir=asc`)).items[0].sku).toBe('MUG-1');
    // Untracked range: lost revenue is null for all; ordering stays stable by name.
    const nulls = await getJson(`?${range(addDays(Y, -4), addDays(Y, -3))}&sort=estLostRevenue&dir=desc`);
    expect(nulls.items.map((x: { sku: string }) => x.sku)).toEqual(['LMP-1', 'KET-1', 'MUG-1']);
  });

  it('searches name and SKU (wildcards are literal) and filters by category, availability and activity', async () => {
    await seedCatalog();
    const skus = async (qs: string) => (await getJson(`?${LAST5}&${qs}`)).items.map((x: { sku: string }) => x.sku).sort();
    expect(await skus('q=kettle')).toEqual(['KET-1']);
    expect(await skus('q=lmp-1')).toEqual(['LMP-1']);
    expect(await skus('q=100%25')).toEqual(['MUG-1']);
    expect(await skus('q=%25')).toEqual(['MUG-1']); // "%" matches only a literal percent sign
    expect(await skus('q=_')).toEqual([]);
    const home = await prisma.category.findUniqueOrThrow({ where: { slug: 'home' } });
    expect(await skus(`categoryId=${home.id}`)).toEqual(['LMP-1']);
    expect(await skus('availability=had_stockout')).toEqual(['LMP-1', 'MUG-1']);
    expect(await skus('availability=out_at_close')).toEqual(['LMP-1', 'MUG-1']);
    expect(await skus('availability=never_stocked')).toEqual(['MUG-1']);
    expect(await skus('activity=with_sales')).toEqual(['KET-1', 'LMP-1']);
    expect(await skus('activity=no_sales')).toEqual(['MUG-1']);
    expect(await skus('activity=with_lost_demand')).toEqual(['LMP-1']);
    expect((await getJson(`?${LAST5}&q=nothing-matches`)).items).toEqual([]);
  });

  it('empty results: nothing aggregated yet is reported as no data', async () => {
    const body = await getJson(`?${LAST5}`);
    expect(body).toMatchObject({ total: 0, totalPages: 0, items: [] });
    expect(body.coverage).toMatchObject({ aggregatedDays: 0, eventCoverage: 'NONE', trackingStartedAt: null });
    expect(body.coverage.missingDays).toHaveLength(5);
    expect(body.totals).toEqual({ actual: { orders: 0, unitsSold: 0, revenuePaise: 0 }, estimated: { lostRevenuePaise: null, outOfStockUnits: null }, availability: { stockoutMinutes: 0, trackedMinutes: 0, availabilityPct: null } });
  });

  it('counts only the part of the creation day the product existed', async () => {
    const p = await product('NEW-1', 'New item');
    await prisma.product.update({ where: { id: p.id }, data: { createdAt: ist(Y, '18:00') } });
    await done([Y]);
    await seedRow(p.id, Y, { stockoutMinutes: 60 });
    const item = (await getJson(`?${range(Y, Y)}`)).items[0];
    expect(item.availability).toMatchObject({ trackedMinutes: 360, stockoutMinutes: 60 });
    expect(item.availability.availabilityPct).toBeCloseTo(83.3, 1);
  });
});

/* ───────────────────────────── detail ───────────────────────────── */

describe('product demand detail', () => {
  it('returns summary, a daily series that labels missing days, hourly profile and per-warehouse stockout history', async () => {
    await seedCatalog();
    // Second warehouse, now paused, keeps its own history.
    const wh2 = await prisma.warehouse.create({ data: { code: 'WH-2', name: 'Warehouse 2', status: 'INACTIVE', addressLine1: '2 Road', city: 'Surat', state: 'Gujarat', pinCode: '395003' } });
    const inv2 = await prisma.inventory.create({ data: { productId: B.id, warehouseId: wh2.id, availableQuantity: 0 } });
    const wh1 = await testWarehouse();
    const snap = (inventoryId: string, warehouseId: string, day: string, p: Record<string, unknown>) =>
      prisma.inventoryDailySnapshot.create({
        data: { day: dbDay(day), inventoryId, productId: B.id, warehouseId, warehouseActive: true, openingAvailable: 5, openingReserved: 0, closingAvailable: 5, closingReserved: 0, safetyStock: 0, closingSellable: 5, trackedMinutes: 1440, ...p },
      });
    await snap(B.inventoryId, wh1.id, addDays(Y, -1), { stockoutMinutes: 120, longestStockoutMinutes: 120, stockouts: 1 });
    await snap(B.inventoryId, wh1.id, Y, { stockoutMinutes: 600, longestStockoutMinutes: 400, stockouts: 2, closingAvailable: 0, closingSellable: 0 });
    await snap(inv2.id, wh2.id, Y, { warehouseActive: false, stockoutMinutes: 1440, longestStockoutMinutes: 1440, stockouts: 1, openingAvailable: 0, closingAvailable: 0, closingSellable: 0, consistent: false });

    const from = addDays(Y, -6);
    const body = await getJson(`/[id]?${range(from, Y)}`, { id: B.id });
    expect(body.product).toMatchObject({ id: B.id, sku: 'LMP-1', category: { name: 'Home' } });
    expect(body.summary.actual.unitsSold).toBe(5); // Y-5 row is outside the 5 seeded days for B
    expect(body.daily).toHaveLength(7);
    expect(body.daily[0]).toMatchObject({ day: from, status: 'not_aggregated', actual: null });
    expect(body.daily[1]).toMatchObject({ day: addDays(Y, -5), status: 'not_listed', actual: null }); // aggregated, no row for B
    expect(body.daily[2]).toMatchObject({ day: addDays(Y, -4), status: 'ok', eventCoverage: 'NONE', demand: null, estimated: null, actual: { unitsSold: 1 } });
    expect(body.daily[6]).toMatchObject({ day: Y, status: 'ok', eventCoverage: 'FULL', estimated: { lostRevenuePaise: 7500 }, availability: { stockoutMinutes: 360, inStockAtClose: false } });

    expect(body.warehouses).toHaveLength(2);
    const [active, paused] = body.warehouses;
    expect(active).toMatchObject({ warehouse: { code: 'TEST-WH', active: true }, daysTracked: 2, stockoutMinutes: 720, stockouts: 3, longestStockoutMinutes: 400, inconsistentDays: 0, closing: { day: Y, sellable: 0 } });
    expect(active.availabilityPct).toBe(75);
    expect(active.daily.map((d: { stockoutMinutes: number }) => d.stockoutMinutes)).toEqual([120, 600]);
    expect(paused).toMatchObject({ warehouse: { code: 'WH-2', active: false }, stockoutMinutes: 1440, availabilityPct: 0, inconsistentDays: 1 });

    const a = await getJson(`/[id]?${LAST5}`, { id: A.id });
    expect(a.hourly.unitsSold[14]).toBe(15);
    expect(a.hourly.cartAddUnits[20]).toBe(12); // tracked days only
    const untracked = await getJson(`/[id]?${range(addDays(Y, -4), addDays(Y, -3))}`, { id: A.id });
    expect(untracked.hourly.cartAddUnits).toBeNull();
  });

  it('a product with no aggregates returns an empty summary; unknown products are 404', async () => {
    const p = await product('EMPTY-1', 'Empty');
    const body = await getJson(`/[id]?${LAST5}`, { id: p.id });
    expect(body.summary).toMatchObject({ daysWithData: 0, eventCoverage: 'NONE', actual: { unitsSold: 0 }, estimated: { lostRevenuePaise: null } });
    expect(body.daily.every((d: { status: string }) => d.status === 'not_aggregated')).toBe(true);
    expect(body.warehouses).toEqual([]);
    expect((await get(`/[id]?${LAST5}`, mkt.token, { id: randomUUID() })).status).toBe(404);
    expect((await get(`/[id]?${LAST5}`, mkt.token, { id: 'x'.repeat(65) })).status).toBe(404);
    expect((await get(`/[id]?${range(Y, TODAY)}`, mkt.token, { id: p.id })).status).toBe(400);
  });
});

/* ───────────────────────────── compare ───────────────────────────── */

describe('product comparison', () => {
  it('compares 2–4 products on aligned days, with null where there is no data', async () => {
    await seedCatalog();
    const body = await getJson(`/compare?${range(addDays(Y, -5), Y)}&ids=${A.id},${B.id},${C.id}`);
    expect(body.days).toHaveLength(6);
    expect(body.products.map((p: { product: { sku: string } }) => p.product.sku)).toEqual(['KET-1', 'LMP-1', 'MUG-1']);
    const [a, b] = body.products;
    expect(a.series.unitsSold).toEqual([100, 3, 3, 3, 3, 3]);
    expect(b.series.unitsSold).toEqual([null, 1, 1, 1, 1, 1]); // no B row on Y-5
    expect(b.series.estLostRevenuePaise).toEqual([null, null, null, 7500, 7500, 7500]); // untracked days are null, not 0
    expect(b.summary.actual.revenuePaise).toBe(12500);
    expect(b.summary.estimated.lostRevenuePaise).toBe(22500);
    expect(body.coverage.eventCoverage).toBe('PARTIAL');
  });

  it('validates the product list', async () => {
    const ids: string[] = [];
    for (const i of [1, 2, 3, 4, 5]) ids.push((await product(`CMP-${i}`, `Compare ${i}`)).id);
    const status = async (list: string) => (await get(`/compare?${LAST5}&ids=${list}`)).status;
    expect(await status(ids[0])).toBe(400);
    expect(await status(`${ids[0]},${ids[0]}`)).toBe(400); // duplicates collapse to one
    expect(await status(ids.join(','))).toBe(400); // 5 > maximum of 4
    expect(await status(ids.slice(0, 4).join(','))).toBe(200);
    expect(await status(`${ids[0]},${randomUUID()}`)).toBe(404);
    expect((await get(`/compare?${LAST5}`)).status).toBe(400);
  });
});

/* ───────────────────────────── export ───────────────────────────── */

describe('CSV export', () => {
  it('exports the filtered list as a safe, audited CSV attachment', async () => {
    await seedCatalog();
    await prisma.product.update({ where: { id: B.id }, data: { name: '=HYPERLINK("http://evil","x")' } });
    const res = await get(`/export?${range(addDays(Y, -4), Y)}&sort=unitsSold`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('content-disposition')).toBe(`attachment; filename="product-demand_${addDays(Y, -4)}_${Y}.csv"`);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-analytics-event-coverage')).toBe('PARTIAL');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM for spreadsheet apps
    const lines = new TextDecoder().decode(bytes).trimEnd().split('\r\n');
    const header = lines[0].split(',');
    expect(header).toContain('actual_revenue_inr');
    expect(header).toContain('estimated_lost_revenue_inr');
    expect(lines).toHaveLength(4);
    const kettle = lines[1].split(',');
    expect(kettle[header.indexOf('sku')]).toBe('KET-1');
    expect(kettle[header.indexOf('actual_revenue_inr')]).toBe('300.00');
    expect(lines[2]).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`); // formula neutralised
    // Untracked range: event columns are empty (no data), sales are numbers.
    const untracked = await (await get(`/export?${range(addDays(Y, -4), addDays(Y, -3))}&q=KET`)).text();
    const row = untracked.trimEnd().split('\r\n')[1].split(',');
    expect(row[header.indexOf('views')]).toBe('');
    expect(row[header.indexOf('estimated_lost_revenue_inr')]).toBe('');
    expect(row[header.indexOf('actual_units_sold')]).toBe('6');

    const logs = await prisma.adminAuditLog.findMany({ where: { action: 'analytics.product_demand.export' } });
    expect(logs).toHaveLength(2);
    expect(logs[0]).toMatchObject({ category: 'ANALYTICS', adminName: 'mkt name' });
  });

  it('an empty result exports just the header; permission, validation and rate limits apply', async () => {
    const res = await get(`/export?${LAST5}`);
    expect(res.status).toBe(200);
    expect((await res.text()).trimEnd().split('\r\n')).toHaveLength(1);
    expect((await get(`/export?${LAST5}`, ops.token)).status).toBe(403);
    expect((await get(`/export?${LAST5}&page=2`)).status).toBe(400); // export takes no pagination
    expect((await get(`/export?${range(Y, TODAY)}`)).status).toBe(400);
    // Every attempt counts toward the limit (1 + 2 rejected so far), successful ones are audited.
    for (let i = 0; i < 7; i++) expect((await get(`/export?${LAST5}`)).status).toBe(200);
    expect((await get(`/export?${LAST5}`)).status).toBe(429);
    expect(await prisma.adminAuditLog.count({ where: { action: 'analytics.product_demand.export' } })).toBe(8);
  });

  it('csvCell quotes, escapes and neutralises formulas', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(0)).toBe('0');
    expect(csvCell(false)).toBe('false');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
    for (const s of ['=1+1', '+1', '-1', '@SUM(A1)', '\tx']) expect(csvCell(s).replace(/^"/, '').startsWith("'")).toBe(true);
  });
});

/* ───────────────────────────── end to end ───────────────────────────── */

describe('end to end with the real aggregation', () => {
  it('serves real aggregates and never reads raw events', async () => {
    await setupDelivery({ minOrderPaise: 100 });
    const { product: p } = await makeSellable({ sku: 'E2E-1', name: 'E2E item', pricePaise: 2500 });
    await prisma.product.update({ where: { id: p.id }, data: { createdAt: ist(addDays(Y, -3), '09:00') } });
    await prisma.inventory.updateMany({ where: { productId: p.id }, data: { createdAt: ist(addDays(Y, -3), '09:00') } });
    await prisma.analyticsEvent.createMany({
      data: [
        { id: randomUUID(), name: 'PRODUCT_VIEWED', category: 'BEHAVIORAL', source: 'CLIENT', occurredAt: ist(addDays(Y, -3), '23:00') }, // tracking starts before the range
        { id: randomUUID(), name: 'PRODUCT_VIEWED', category: 'BEHAVIORAL', source: 'CLIENT', occurredAt: ist(addDays(Y, -2), '10:00'), productId: p.id, visitorId: 'v1' },
      ],
    });
    const c = await createCustomer();
    const address = await createAddress(c.user.id, VALID_ADDRESS);
    await addItem({ userId: c.user.id }, { productId: p.id, quantity: 2 });
    const r = await placeOrder(c.user.id, { addressId: address.id, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: randomUUID() });
    await prisma.order.update({ where: { orderNumber: r.orderNumber }, data: { createdAt: ist(Y, '11:00') } });
    for (const d of [addDays(Y, -2), addDays(Y, -1), Y]) await aggregateProductDay(d);

    // The raw event table is offline: the APIs must still answer from the aggregates alone.
    await prisma.$executeRawUnsafe(`ALTER TABLE "AnalyticsEvent" RENAME TO "AnalyticsEvent_offline"`);
    try {
      const list = await getJson(`?${range(addDays(Y, -2), Y)}`);
      expect(list.coverage).toMatchObject({ aggregatedDays: 3, eventCoverage: 'FULL', missingDays: [] });
      expect(list.items[0]).toMatchObject({ sku: 'E2E-1', actual: { orders: 1, unitsSold: 2, revenuePaise: 5000 }, demand: { views: 1 } });
      const detail = await getJson(`/[id]?${range(addDays(Y, -2), Y)}`, { id: p.id });
      expect(detail.hourly.unitsSold[11]).toBe(2);
      expect(detail.warehouses).toHaveLength(1);
      expect((await get(`/export?${range(addDays(Y, -2), Y)}`)).status).toBe(200);
    } finally {
      await prisma.$executeRawUnsafe(`ALTER TABLE "AnalyticsEvent_offline" RENAME TO "AnalyticsEvent"`);
    }
  });
});
