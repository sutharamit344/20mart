import { prisma, Prisma } from '@20mart/database';
import { z } from 'zod';
import { badRequest, notFound } from '../errors';
import { audit } from '../audit';
import type { AdminContext } from '../auth/admin';
import { addDays, coverageFor, getTrackingStartedAt, istDayOf, PRODUCT_DAILY_JOB } from './product-daily';

/**
 * Analytics Phase C (C2): product demand read APIs over the daily aggregate tables.
 *
 * Reads only ProductDailyAnalytics / InventoryDailySnapshot / AnalyticsJobRun (plus Product,
 * Category and Warehouse for names) — never raw AnalyticsEvent rows.
 *
 * Data honesty rules:
 *  - Ranges are IST calendar days, inclusive, and only finished days (up to yesterday IST).
 *  - ACTUAL sales (orders, units, gross item-line revenue) and the ESTIMATED lost revenue are
 *    returned in separate objects and never added together.
 *  - Event-based metrics (views, cart, wishlist, out-of-stock, lost-revenue estimate) are `null`
 *    when the product has no tracked day in the range (coverage NONE = "no data"), and numbers
 *    (including 0 = real zero demand) when coverage is PARTIAL or FULL.
 *  - Days not yet aggregated are reported in `coverage.missingDays`, never treated as zero.
 */

const MAX_RANGE_DAYS = 366;
const DEFAULT_RANGE_DAYS = 30;
const DAY_MINUTES = 1440;
export const MAX_COMPARE_PRODUCTS = 4;
export const MAX_EXPORT_ROWS = 5000;

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);
const nn = (v: bigint | number | null | undefined) => (v === null || v === undefined ? null : Number(v));
const dbDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
const dayOf = (d: Date) => d.toISOString().slice(0, 10);

/** A real calendar day ('2026-02-30' is rejected, not rolled over). */
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00.000Z`)) && addDays(d, 0) === d, 'Not a real date');

const rangeShape = { from: day.optional(), to: day.optional() };

export const PRODUCT_DEMAND_SORTS = [
  'name',
  'unitsSold',
  'revenue',
  'orders',
  'estLostRevenue',
  'outOfStockUnits',
  'views',
  'cartAddUnits',
  'wishlistAdds',
  'stockoutMinutes',
  'availability',
] as const;

const listShape = {
  ...rangeShape,
  q: z.string().trim().max(100).optional(),
  categoryId: z.string().trim().min(1).max(64).optional(),
  /** had_stockout: at least one minute without sellable stock; out_at_close: not sellable at the end of the range; never_stocked: no active stock row on any day. */
  availability: z.enum(['all', 'had_stockout', 'out_at_close', 'never_stocked']).default('all'),
  /** with_sales / no_sales: actual units sold; with_lost_demand: out-of-stock units recorded. */
  activity: z.enum(['all', 'with_sales', 'no_sales', 'with_lost_demand']).default('all'),
  sort: z.enum(PRODUCT_DEMAND_SORTS).default('revenue'),
  dir: z.enum(['asc', 'desc']).default('desc'),
};

export const productDemandListQuery = z
  .object({
    ...listShape,
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();
export const productDemandExportQuery = z.object(listShape).strict();
export const productDemandRangeQuery = z.object(rangeShape).strict();
export const productCompareQuery = z
  .object({
    ...rangeShape,
    ids: z
      .string()
      .max(400)
      .transform((s) => [...new Set(s.split(',').map((x) => x.trim()).filter(Boolean))])
      .refine((a) => a.length >= 2 && a.length <= MAX_COMPARE_PRODUCTS, `Compare 2 to ${MAX_COMPARE_PRODUCTS} different products`)
      .refine((a) => a.every((x) => x.length <= 64), 'Invalid product id'),
  })
  .strict();

/* ───────────────────────────── Range and coverage ───────────────────────────── */

export interface DayRange {
  from: string;
  to: string;
  days: string[];
}

/** Inclusive IST day range; defaults to the last 30 finished days. */
export function resolveDayRange(q: { from?: string; to?: string }, now = new Date()): DayRange {
  const yesterday = addDays(istDayOf(now), -1);
  const to = q.to ?? yesterday;
  const from = q.from ?? addDays(to, -(DEFAULT_RANGE_DAYS - 1));
  if (to > yesterday) throw badRequest(`Daily analytics are available up to yesterday (${yesterday}, IST)`);
  if (from > to) throw badRequest('The start date must be on or before the end date');
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    days.push(d);
    if (days.length > MAX_RANGE_DAYS) throw badRequest(`The range can be at most ${MAX_RANGE_DAYS} days`);
  }
  return { from, to, days };
}

export type Coverage = 'NONE' | 'PARTIAL' | 'FULL';

export interface RangeCoverage {
  from: string;
  to: string;
  days: number;
  /** Days whose aggregation has completed. */
  aggregatedDays: number;
  /** Days not aggregated yet (no data — not zero). */
  missingDays: string[];
  /** Behavioural/operational event coverage over the aggregated days. */
  eventCoverage: Coverage;
  eventDays: Record<Coverage, number>;
  trackingStartedAt: Date | null;
  firstTrackedDay: string | null;
}

async function rangeCoverage(r: DayRange): Promise<{ coverage: RangeCoverage; aggregated: Set<string>; dayCoverage: Map<string, Coverage> }> {
  const [runs, trackingStartedAt] = await Promise.all([
    prisma.analyticsJobRun.findMany({
      where: { job: PRODUCT_DAILY_JOB, status: 'done', day: { gte: dbDate(r.from), lte: dbDate(r.to) } },
      select: { day: true },
    }),
    getTrackingStartedAt(),
  ]);
  const aggregated = new Set(runs.map((x) => dayOf(x.day)));
  const dayCoverage = new Map(r.days.map((d) => [d, coverageFor(d, trackingStartedAt)] as const));
  const eventDays: Record<Coverage, number> = { NONE: 0, PARTIAL: 0, FULL: 0 };
  for (const d of r.days) if (aggregated.has(d)) eventDays[dayCoverage.get(d)!]++;
  const aggregatedDays = aggregated.size;
  const eventCoverage: Coverage =
    aggregatedDays === 0 || eventDays.NONE === aggregatedDays ? 'NONE' : eventDays.FULL === aggregatedDays ? 'FULL' : 'PARTIAL';
  return {
    aggregated,
    dayCoverage,
    coverage: {
      from: r.from,
      to: r.to,
      days: r.days.length,
      aggregatedDays,
      missingDays: r.days.filter((d) => !aggregated.has(d)),
      eventCoverage,
      eventDays,
      trackingStartedAt,
      firstTrackedDay: trackingStartedAt ? istDayOf(trackingStartedAt) : null,
    },
  };
}

/* ───────────────────────────── Per-product summary (SQL) ───────────────────────────── */

type SummaryRow = {
  productId: string;
  name: string;
  sku: string;
  slug: string;
  status: string;
  category_id: string | null;
  category_name: string | null;
  days: number;
  coverage: Coverage;
  orders: bigint;
  units_sold: bigint;
  revenue: bigint;
  cancelled: bigint;
  failed: bigint;
  est_lost: bigint | null;
  oos_attempts: bigint | null;
  oos_units: bigint | null;
  views: bigint | null;
  viewer_days: bigint | null;
  unavailable_views: bigint | null;
  cart_add_units: bigint | null;
  cart_add_events: bigint | null;
  cart_remove_units: bigint | null;
  wishlist_adds: bigint | null;
  tracked_minutes: bigint;
  stockout_minutes: bigint;
  stockout_days: number;
  unstocked_days: number;
  in_stock_at_close: boolean | null;
  availability: number | null;
};

export interface ProductDemandSummary {
  productId: string;
  name: string;
  sku: string;
  slug: string;
  status: string;
  category: { id: string; name: string } | null;
  /** Aggregated days in the range on which the product was listed. */
  daysWithData: number;
  /** NONE ⇒ the event-based fields below are null ("no data", not zero). */
  eventCoverage: Coverage;
  /** ACTUAL sales from orders (cancelled, failed and unpaid online orders excluded). */
  actual: { orders: number; unitsSold: number; revenuePaise: number; cancelledUnits: number; failedDeliveryUnits: number };
  /** ESTIMATE — never part of actual revenue. */
  estimated: { lostRevenuePaise: number | null; outOfStockAttempts: number | null; outOfStockUnits: number | null };
  /** Shopper demand signals. Views are consented visitors only (a lower bound); viewerDays = Σ daily unique viewers. */
  demand: {
    views: number | null;
    viewerDays: number | null;
    unavailableViews: number | null;
    cartAddUnits: number | null;
    cartAddEvents: number | null;
    cartRemoveUnits: number | null;
    wishlistAdds: number | null;
  };
  /** Across active warehouses. */
  availability: {
    trackedMinutes: number;
    stockoutMinutes: number;
    /** 0–100, or null when nothing was tracked. */
    availabilityPct: number | null;
    stockoutDays: number;
    /** Days with no stock row at any active warehouse. */
    unstockedDays: number;
    inStockAtClose: boolean | null;
  };
}

const SORT_SQL: Record<(typeof PRODUCT_DEMAND_SORTS)[number], string> = {
  name: 'name',
  unitsSold: 'units_sold',
  revenue: 'revenue',
  orders: 'orders',
  estLostRevenue: 'est_lost',
  outOfStockUnits: 'oos_units',
  views: 'views',
  cartAddUnits: 'cart_add_units',
  wishlistAdds: 'wishlist_adds',
  stockoutMinutes: 'stockout_minutes',
  availability: 'availability',
};

type Filters = z.infer<typeof productDemandExportQuery> & { productIds?: string[] };

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Aggregates per product over the range, with the list filters applied. */
function summarySql(r: DayRange, f: Partial<Filters>) {
  // Event fields are summed only over tracked days, so a product with no tracked day gets NULL.
  const ev = (col: string) => Prisma.raw(`sum(a."${col}") FILTER (WHERE a."eventCoverage" <> 'NONE')::bigint`);
  const where: Prisma.Sql[] = [];
  if (f.productIds?.length) where.push(Prisma.sql`s."productId" IN (${Prisma.join(f.productIds)})`);
  if (f.q) {
    const like = `%${likeEscape(f.q)}%`;
    where.push(Prisma.sql`(s."name" ILIKE ${like} OR s."sku" ILIKE ${like})`);
  }
  if (f.categoryId) where.push(Prisma.sql`s."category_id" = ${f.categoryId}`);
  if (f.availability === 'had_stockout') where.push(Prisma.sql`s."stockout_minutes" > 0`);
  if (f.availability === 'out_at_close') where.push(Prisma.sql`s."in_stock_at_close" IS FALSE`);
  if (f.availability === 'never_stocked') where.push(Prisma.sql`s."unstocked_days" = s."days"`);
  if (f.activity === 'with_sales') where.push(Prisma.sql`s."units_sold" > 0`);
  if (f.activity === 'no_sales') where.push(Prisma.sql`s."units_sold" = 0`);
  if (f.activity === 'with_lost_demand') where.push(Prisma.sql`coalesce(s."oos_units", 0) > 0`);

  return Prisma.sql`
    WITH agg AS (
      SELECT a."productId",
             count(*)::int AS days,
             CASE WHEN bool_and(a."eventCoverage" = 'FULL') THEN 'FULL'
                  WHEN bool_or(a."eventCoverage" <> 'NONE') THEN 'PARTIAL' ELSE 'NONE' END AS coverage,
             sum(a."orders")::bigint AS orders,
             sum(a."unitsSold")::bigint AS units_sold,
             sum(a."revenuePaise")::bigint AS revenue,
             sum(a."cancelledUnits")::bigint AS cancelled,
             sum(a."failedDeliveryUnits")::bigint AS failed,
             ${ev('estLostRevenuePaise')} AS est_lost,
             ${ev('outOfStockAttempts')} AS oos_attempts,
             ${ev('outOfStockUnits')} AS oos_units,
             ${ev('views')} AS views,
             ${ev('uniqueViewers')} AS viewer_days,
             ${ev('unavailableViews')} AS unavailable_views,
             ${ev('cartAddUnits')} AS cart_add_units,
             ${ev('cartAddEvents')} AS cart_add_events,
             ${ev('cartRemoveUnits')} AS cart_remove_units,
             ${ev('wishlistAdds')} AS wishlist_adds,
             -- Minutes the product existed on each day (the creation day is partial), IST day = [D − 05:30, D + 18:30) UTC.
             sum(LEAST(${DAY_MINUTES}, GREATEST(0, round(extract(epoch FROM
               ((a."day" + 1)::timestamp - interval '330 minutes')
               - GREATEST(a."day"::timestamp - interval '330 minutes', p."createdAt")) / 60))))::bigint AS tracked_minutes,
             sum(a."stockoutMinutes")::bigint AS stockout_minutes,
             (count(*) FILTER (WHERE a."stockoutMinutes" > 0))::int AS stockout_days,
             (count(*) FILTER (WHERE a."activeStockRows" = 0))::int AS unstocked_days,
             (array_agg(a."inStockAtClose" ORDER BY a."day" DESC))[1] AS in_stock_at_close
        FROM "ProductDailyAnalytics" a
        JOIN "Product" p ON p."id" = a."productId"
       WHERE a."day" >= ${r.from}::date AND a."day" <= ${r.to}::date
         ${f.productIds?.length ? Prisma.sql`AND a."productId" IN (${Prisma.join(f.productIds)})` : Prisma.empty}
       GROUP BY a."productId"
    ), s AS (
      SELECT agg.*, p."name", p."sku", p."slug", p."status"::text AS status,
             p."categoryId" AS category_id, c."name" AS category_name,
             CASE WHEN agg.tracked_minutes > 0
                  THEN round(100 * (1 - LEAST(agg.stockout_minutes, agg.tracked_minutes)::numeric / agg.tracked_minutes), 1)::float8 END AS availability
        FROM agg
        JOIN "Product" p ON p."id" = agg."productId"
        LEFT JOIN "Category" c ON c."id" = p."categoryId"
    )
    SELECT * FROM s ${where.length ? Prisma.sql`WHERE ${Prisma.join(where, ' AND ')}` : Prisma.empty}`;
}

function toSummary(r: SummaryRow): ProductDemandSummary {
  return {
    productId: r.productId,
    name: r.name,
    sku: r.sku,
    slug: r.slug,
    status: r.status,
    category: r.category_id ? { id: r.category_id, name: r.category_name ?? '' } : null,
    daysWithData: r.days,
    eventCoverage: r.coverage,
    actual: { orders: n(r.orders), unitsSold: n(r.units_sold), revenuePaise: n(r.revenue), cancelledUnits: n(r.cancelled), failedDeliveryUnits: n(r.failed) },
    estimated: { lostRevenuePaise: nn(r.est_lost), outOfStockAttempts: nn(r.oos_attempts), outOfStockUnits: nn(r.oos_units) },
    demand: {
      views: nn(r.views),
      viewerDays: nn(r.viewer_days),
      unavailableViews: nn(r.unavailable_views),
      cartAddUnits: nn(r.cart_add_units),
      cartAddEvents: nn(r.cart_add_events),
      cartRemoveUnits: nn(r.cart_remove_units),
      wishlistAdds: nn(r.wishlist_adds),
    },
    availability: {
      trackedMinutes: n(r.tracked_minutes),
      stockoutMinutes: Math.min(n(r.stockout_minutes), n(r.tracked_minutes)),
      availabilityPct: r.availability,
      stockoutDays: r.stockout_days,
      unstockedDays: r.unstocked_days,
      inStockAtClose: r.in_stock_at_close,
    },
  };
}

function orderSql(sort: (typeof PRODUCT_DEMAND_SORTS)[number], dir: 'asc' | 'desc') {
  // Whitelisted column names only; NULL ("no data") always sorts after real values.
  return Prisma.raw(`ORDER BY "${SORT_SQL[sort]}" ${dir === 'asc' ? 'ASC' : 'DESC'} NULLS LAST, "name" ASC, "productId" ASC`);
}

/* ───────────────────────────── 1. List ───────────────────────────── */

export async function listProductDemand(raw: unknown = {}, now = new Date()) {
  const q = productDemandListQuery.parse(raw);
  const r = resolveDayRange(q, now);
  const base = summarySql(r, q);
  const [{ coverage }, rows, totals] = await Promise.all([
    rangeCoverage(r),
    prisma.$queryRaw<SummaryRow[]>`${base} ${orderSql(q.sort, q.dir)} LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
    prisma.$queryRaw<
      { products: bigint; orders: bigint | null; units_sold: bigint | null; revenue: bigint | null; est_lost: bigint | null; oos_attempts: bigint | null; oos_units: bigint | null; tracked: bigint | null; stockout: bigint | null }[]
    >`SELECT count(*) AS products, sum(orders) AS orders, sum(units_sold) AS units_sold, sum(revenue) AS revenue,
             sum(est_lost) AS est_lost, sum(oos_attempts) AS oos_attempts, sum(oos_units) AS oos_units, sum(tracked_minutes) AS tracked, sum(stockout_minutes) AS stockout
        FROM (${base}) t`,
  ]);
  const t = totals[0];
  const total = n(t?.products);
  const tracked = n(t?.tracked);
  return {
    coverage,
    filters: { q: q.q ?? null, categoryId: q.categoryId ?? null, availability: q.availability, activity: q.activity },
    sort: { by: q.sort, dir: q.dir },
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages: Math.ceil(total / q.pageSize),
    totals: {
      actual: { orders: n(t?.orders), unitsSold: n(t?.units_sold), revenuePaise: n(t?.revenue) },
      // Null when no product in the result has a tracked day.
      estimated: { lostRevenuePaise: nn(t?.est_lost), outOfStockAttempts: nn(t?.oos_attempts), outOfStockUnits: nn(t?.oos_units) },
      availability: { stockoutMinutes: n(t?.stockout), trackedMinutes: tracked, availabilityPct: tracked ? Math.round(1000 * (1 - Math.min(n(t?.stockout), tracked) / tracked)) / 10 : null },
    },
    items: rows.map(toSummary),
  };
}

/* ───────────────────────────── 2. Detail ───────────────────────────── */

type DailyRow = Awaited<ReturnType<typeof dailyRows>>[number];
const dailyRows = (productIds: string[], r: DayRange) =>
  prisma.productDailyAnalytics.findMany({
    where: { productId: { in: productIds }, day: { gte: dbDate(r.from), lte: dbDate(r.to) } },
    orderBy: { day: 'asc' },
  });

/** One entry per day of the range. `status` tells "no data" apart from real zeros. */
function dailySeries(r: DayRange, rows: DailyRow[], aggregated: Set<string>) {
  const byDay = new Map(rows.map((x) => [dayOf(x.day), x]));
  return r.days.map((d) => {
    const x = byDay.get(d);
    if (!x) {
      // not_aggregated: the day has not been processed yet; not_listed: processed, product not listed (not created yet or archived without activity).
      return { day: d, status: aggregated.has(d) ? ('not_listed' as const) : ('not_aggregated' as const), eventCoverage: null, actual: null, estimated: null, demand: null, availability: null };
    }
    const ev = x.eventCoverage !== 'NONE';
    return {
      day: d,
      status: 'ok' as const,
      eventCoverage: x.eventCoverage as Coverage,
      actual: { orders: x.orders, unitsSold: x.unitsSold, revenuePaise: x.revenuePaise, cancelledUnits: x.cancelledUnits, failedDeliveryUnits: x.failedDeliveryUnits },
      estimated: ev ? { lostRevenuePaise: x.estLostRevenuePaise, outOfStockAttempts: x.outOfStockAttempts, outOfStockUnits: x.outOfStockUnits } : null,
      demand: ev
        ? { views: x.views, viewerDays: x.uniqueViewers, unavailableViews: x.unavailableViews, cartAddUnits: x.cartAddUnits, cartAddEvents: x.cartAddEvents, cartRemoveUnits: x.cartRemoveUnits, wishlistAdds: x.wishlistAdds }
        : null,
      availability: { stockoutMinutes: x.stockoutMinutes, activeStockRows: x.activeStockRows, inStockAtClose: x.inStockAtClose },
    };
  });
}

const emptySummary = (p: { id: string; name: string; sku: string; slug: string; status: string; category: { id: string; name: string } | null }): ProductDemandSummary => ({
  productId: p.id,
  name: p.name,
  sku: p.sku,
  slug: p.slug,
  status: p.status,
  category: p.category,
  daysWithData: 0,
  eventCoverage: 'NONE',
  actual: { orders: 0, unitsSold: 0, revenuePaise: 0, cancelledUnits: 0, failedDeliveryUnits: 0 },
  estimated: { lostRevenuePaise: null, outOfStockAttempts: null, outOfStockUnits: null },
  demand: { views: null, viewerDays: null, unavailableViews: null, cartAddUnits: null, cartAddEvents: null, cartRemoveUnits: null, wishlistAdds: null },
  availability: { trackedMinutes: 0, stockoutMinutes: 0, availabilityPct: null, stockoutDays: 0, unstockedDays: 0, inStockAtClose: null },
});

const productSelect = { id: true, name: true, sku: true, slug: true, status: true, createdAt: true, category: { select: { id: true, name: true } } } as const;

async function summariesFor(ids: string[], r: DayRange) {
  const rows = await prisma.$queryRaw<SummaryRow[]>`${summarySql(r, { productIds: ids })}`;
  return new Map(rows.map((x) => [x.productId, toSummary(x)]));
}

export async function getProductDemandDetail(productId: string, raw: unknown = {}, now = new Date()) {
  const q = productDemandRangeQuery.parse(raw);
  const r = resolveDayRange(q, now);
  if (!productId || productId.length > 64) throw notFound('Product');
  const product = await prisma.product.findUnique({ where: { id: productId }, select: productSelect });
  if (!product) throw notFound('Product');

  const [{ coverage, aggregated }, summaries, rows, snaps] = await Promise.all([
    rangeCoverage(r),
    summariesFor([productId], r),
    dailyRows([productId], r),
    prisma.inventoryDailySnapshot.findMany({
      where: { productId, day: { gte: dbDate(r.from), lte: dbDate(r.to) } },
      orderBy: [{ day: 'asc' }],
    }),
  ]);

  // Hour-of-day profile (IST). Cart adds only from tracked days; null when none.
  const tracked = rows.filter((x) => x.eventCoverage !== 'NONE');
  const sumHours = (list: number[][]) => list.reduce((acc, h) => acc.map((v, i) => v + (h[i] ?? 0)), Array.from({ length: 24 }, () => 0));

  // Per stock row (product/variant × warehouse), including inactive warehouses.
  const warehouseIds = [...new Set(snaps.map((s) => s.warehouseId))];
  const variantIds = [...new Set(snaps.map((s) => s.variantId).filter((v): v is string => !!v))];
  const [warehouses, variants] = await Promise.all([
    warehouseIds.length ? prisma.warehouse.findMany({ where: { id: { in: warehouseIds } }, select: { id: true, code: true, name: true } }) : [],
    variantIds.length ? prisma.productVariant.findMany({ where: { id: { in: variantIds } }, select: { id: true, name: true, sku: true } }) : [],
  ]);
  const whById = new Map(warehouses.map((w) => [w.id, w]));
  const varById = new Map(variants.map((v) => [v.id, v]));
  const byRow = new Map<string, typeof snaps>();
  for (const s of snaps) (byRow.get(s.inventoryId) ?? byRow.set(s.inventoryId, []).get(s.inventoryId)!).push(s);
  const stockRows = [...byRow.entries()].map(([inventoryId, list]) => {
    const last = list[list.length - 1];
    const trackedMinutes = list.reduce((a, s) => a + s.trackedMinutes, 0);
    const stockoutMinutes = list.reduce((a, s) => a + s.stockoutMinutes, 0);
    const wh = whById.get(last.warehouseId);
    const v = last.variantId ? varById.get(last.variantId) : null;
    return {
      inventoryId,
      warehouse: { id: last.warehouseId, code: wh?.code ?? null, name: wh?.name ?? '(deleted warehouse)', active: last.warehouseActive },
      variant: last.variantId ? { id: last.variantId, name: v?.name ?? null, sku: v?.sku ?? null } : null,
      daysTracked: list.length,
      trackedMinutes,
      stockoutMinutes,
      availabilityPct: trackedMinutes ? Math.round(1000 * (1 - Math.min(stockoutMinutes, trackedMinutes) / trackedMinutes)) / 10 : null,
      stockouts: list.reduce((a, s) => a + s.stockouts, 0),
      longestStockoutMinutes: list.reduce((a, s) => Math.max(a, s.longestStockoutMinutes), 0),
      inconsistentDays: list.filter((s) => !s.consistent).length,
      closing: { day: dayOf(last.day), available: last.closingAvailable, reserved: last.closingReserved, sellable: last.closingSellable, safetyStock: last.safetyStock },
      /** Stockout history: one entry per tracked day. */
      daily: list.map((s) => ({
        day: dayOf(s.day),
        warehouseActive: s.warehouseActive,
        openingAvailable: s.openingAvailable,
        closingAvailable: s.closingAvailable,
        closingSellable: s.closingSellable,
        movements: s.movements,
        stockoutMinutes: s.stockoutMinutes,
        longestStockoutMinutes: s.longestStockoutMinutes,
        stockouts: s.stockouts,
        consistent: s.consistent,
      })),
    };
  });
  stockRows.sort((a, b) => Number(b.warehouse.active) - Number(a.warehouse.active) || (a.warehouse.code ?? '').localeCompare(b.warehouse.code ?? ''));

  const { createdAt, ...info } = product;
  return {
    product: { ...info, listedFromDay: istDayOf(createdAt) },
    coverage,
    summary: summaries.get(productId) ?? emptySummary(product),
    daily: dailySeries(r, rows, aggregated),
    hourly: {
      unitsSold: rows.length ? sumHours(rows.map((x) => x.unitsSoldByHour)) : null,
      cartAddUnits: tracked.length ? sumHours(tracked.map((x) => x.cartAddUnitsByHour)) : null,
    },
    warehouses: stockRows,
  };
}

/* ───────────────────────────── 3. Compare ───────────────────────────── */

export async function compareProductDemand(raw: unknown = {}, now = new Date()) {
  const q = productCompareQuery.parse(raw);
  const r = resolveDayRange(q, now);
  const products = await prisma.product.findMany({ where: { id: { in: q.ids } }, select: productSelect });
  if (products.length !== q.ids.length) throw notFound('Product');
  const [{ coverage, aggregated }, summaries, rows] = await Promise.all([rangeCoverage(r), summariesFor(q.ids, r), dailyRows(q.ids, r)]);
  const byProduct = new Map<string, DailyRow[]>();
  for (const x of rows) (byProduct.get(x.productId) ?? byProduct.set(x.productId, []).get(x.productId)!).push(x);
  const byId = new Map(products.map((p) => [p.id, p]));
  return {
    coverage,
    days: r.days,
    products: q.ids.map((id) => {
      const p = byId.get(id)!;
      const series = dailySeries(r, byProduct.get(id) ?? [], aggregated);
      const { createdAt, ...info } = p;
      return {
        product: { ...info, listedFromDay: istDayOf(createdAt) },
        summary: summaries.get(id) ?? emptySummary(p),
        /** Aligned with `days`; null = no data for that day (not aggregated, not listed, or untracked for event metrics). */
        series: {
          unitsSold: series.map((d) => d.actual?.unitsSold ?? null),
          revenuePaise: series.map((d) => d.actual?.revenuePaise ?? null),
          estLostRevenuePaise: series.map((d) => d.estimated?.lostRevenuePaise ?? null),
          views: series.map((d) => d.demand?.views ?? null),
          cartAddUnits: series.map((d) => d.demand?.cartAddUnits ?? null),
          stockoutMinutes: series.map((d) => d.availability?.stockoutMinutes ?? null),
        },
      };
    }),
  };
}

/* ───────────────────────────── 4. CSV export ───────────────────────────── */

/** Quote a CSV cell and neutralise spreadsheet formulas (CSV injection). */
export function csvCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

const rupees = (p: number | null) => (p === null ? null : (p / 100).toFixed(2));

const CSV_COLUMNS: [string, (s: ProductDemandSummary) => string | number | boolean | null][] = [
  ['product_id', (s) => s.productId],
  ['name', (s) => s.name],
  ['sku', (s) => s.sku],
  ['category', (s) => s.category?.name ?? null],
  ['status', (s) => s.status],
  ['days_with_data', (s) => s.daysWithData],
  ['event_coverage', (s) => s.eventCoverage],
  ['actual_orders', (s) => s.actual.orders],
  ['actual_units_sold', (s) => s.actual.unitsSold],
  ['actual_revenue_inr', (s) => rupees(s.actual.revenuePaise)],
  ['cancelled_units', (s) => s.actual.cancelledUnits],
  ['failed_delivery_units', (s) => s.actual.failedDeliveryUnits],
  ['estimated_lost_revenue_inr', (s) => rupees(s.estimated.lostRevenuePaise)],
  ['out_of_stock_attempts', (s) => s.estimated.outOfStockAttempts],
  ['out_of_stock_units', (s) => s.estimated.outOfStockUnits],
  ['views', (s) => s.demand.views],
  ['viewer_days', (s) => s.demand.viewerDays],
  ['unavailable_views', (s) => s.demand.unavailableViews],
  ['cart_add_units', (s) => s.demand.cartAddUnits],
  ['cart_remove_units', (s) => s.demand.cartRemoveUnits],
  ['wishlist_adds', (s) => s.demand.wishlistAdds],
  ['stockout_minutes', (s) => s.availability.stockoutMinutes],
  ['availability_pct', (s) => s.availability.availabilityPct],
  ['stockout_days', (s) => s.availability.stockoutDays],
  ['unstocked_days', (s) => s.availability.unstockedDays],
  ['in_stock_at_close', (s) => s.availability.inStockAtClose],
];

/**
 * Whole filtered list as CSV (aggregates only, no customer data). Empty cells mean "no data";
 * 0 means a real zero. Refuses more than MAX_EXPORT_ROWS rows rather than silently truncating.
 */
export async function exportProductDemandCsv(raw: unknown = {}, now = new Date()) {
  const q = productDemandExportQuery.parse(raw);
  const r = resolveDayRange(q, now);
  const base = summarySql(r, q);
  const [{ coverage }, rows] = await Promise.all([
    rangeCoverage(r),
    prisma.$queryRaw<SummaryRow[]>`${base} ${orderSql(q.sort, q.dir)} LIMIT ${MAX_EXPORT_ROWS + 1}`,
  ]);
  if (rows.length > MAX_EXPORT_ROWS) throw badRequest(`The export is limited to ${MAX_EXPORT_ROWS} products; narrow the filters or date range`);
  const lines = [CSV_COLUMNS.map(([h]) => h).join(','), ...rows.map(toSummary).map((s) => CSV_COLUMNS.map(([, get]) => csvCell(get(s))).join(','))];
  return {
    filename: `product-demand_${r.from}_${r.to}.csv`,
    rows: rows.length,
    coverage,
    // BOM so spreadsheet apps read UTF-8 (₹, non-Latin names) correctly.
    csv: `﻿${lines.join('\r\n')}\r\n`,
  };
}

/** Audit-log a CSV export (who, what range, which filters). */
export async function auditProductDemandExport(actor: AdminContext, out: { rows: number; coverage: RangeCoverage }, query: string, ip: string | null) {
  await audit(prisma, actor, {
    action: 'analytics.product_demand.export',
    category: 'ANALYTICS',
    entityType: 'ProductDailyAnalytics',
    details: `Exported ${out.rows} product rows, ${out.coverage.from} to ${out.coverage.to} (IST)${query ? `, query ${query.slice(0, 300)}` : ''}; ip ${ip ?? 'unknown'}`,
  });
}
