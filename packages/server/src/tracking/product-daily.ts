import { prisma, Prisma } from '@20mart/database';
import { captureException, logger } from '../observability';
import { getAnalyticsSettings } from './settings';

/**
 * Analytics Phase C (C1): daily product demand aggregates.
 *
 * For each finished IST calendar day this rebuilds, in one transaction:
 *  - ProductDailyAnalytics: per product — behavioural demand (consented views), operational demand
 *    (cart adds/removes, wishlist, out-of-stock attempts), ACTUAL sales from orders, and
 *    availability across ACTIVE warehouses. Estimates (lost revenue) live in separate `est*` columns.
 *  - InventoryDailySnapshot: per stock row (product/variant × warehouse) — opening/closing quantities
 *    and stockout minutes, replayed from StockMovement history.
 *
 * Rules:
 *  - Days are IST (UTC+05:30) calendar days. Only finished days are aggregated.
 *  - Idempotent: a day's rows are replaced atomically; AnalyticsJobRun records one row per job and day.
 *  - Nothing is invented: days before event tracking started have eventCoverage NONE ("no data",
 *    not "zero demand"); sales and stock history come from orders and stock movements, which exist
 *    independently of tracking.
 *  - Read-only on business tables, runs from the daily cron only, never in a customer request.
 */

export const PRODUCT_DAILY_JOB = 'product-daily';
const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 330 * 60_000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Serialises aggregation runs (cron and backfill can never interleave). */
const LOCK_KEY = 'analytics:product-daily';

/* ───────────────────────────── IST day helpers ───────────────────────────── */

/** IST calendar day ('YYYY-MM-DD') of an instant. */
export const istDayOf = (d: Date) => new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

export function addDays(day: string, n: number) {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** [start, end) of an IST calendar day as UTC instants. */
export function istDayWindow(day: string) {
  if (!DAY_RE.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00.000Z`))) throw new Error(`Invalid day: ${day}`);
  const start = new Date(Date.parse(`${day}T00:00:00.000Z`) - IST_OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** Value for a @db.Date column. */
const dbDate = (day: string) => new Date(`${day}T00:00:00.000Z`);
/** Bind a Date as UTC wall time (columns are timestamp(3) in UTC; Prisma binds timestamptz). */
const utc = (d: Date) => Prisma.sql`(${d}::timestamptz AT TIME ZONE 'UTC')`;
const n = (v: bigint | number | null | undefined) => Number(v ?? 0);
const hours = () => Array.from({ length: 24 }, () => 0);

/* ───────────────────────────── Coverage ───────────────────────────── */

/**
 * When event tracking started. Discovered from the first recorded event and then stored, so it
 * survives raw-event retention. Never moved earlier than real data.
 */
export async function getTrackingStartedAt(): Promise<Date | null> {
  const s = await getAnalyticsSettings({ fresh: true });
  if (s.trackingStartedAt) return s.trackingStartedAt;
  const first = await prisma.analyticsEvent.findFirst({ orderBy: { occurredAt: 'asc' }, select: { occurredAt: true } });
  if (!first) return null;
  await prisma.analyticsSettings.updateMany({ where: { id: s.id, trackingStartedAt: null }, data: { trackingStartedAt: first.occurredAt } });
  return first.occurredAt;
}

/**
 * Read-only variant for previews such as `analytics:backfill --dry-run`: the stored tracking start,
 * else the first recorded event. Never creates or updates AnalyticsSettings.
 */
export async function peekTrackingStartedAt(): Promise<Date | null> {
  const s = await prisma.analyticsSettings.findUnique({ where: { id: 'default' }, select: { trackingStartedAt: true } });
  if (s?.trackingStartedAt) return s.trackingStartedAt;
  const first = await prisma.analyticsEvent.findFirst({ orderBy: { occurredAt: 'asc' }, select: { occurredAt: true } });
  return first?.occurredAt ?? null;
}

export function coverageFor(day: string, trackingStartedAt: Date | null): 'NONE' | 'PARTIAL' | 'FULL' {
  if (!trackingStartedAt) return 'NONE';
  const { start, end } = istDayWindow(day);
  if (trackingStartedAt >= end) return 'NONE';
  return trackingStartedAt > start ? 'PARTIAL' : 'FULL';
}

/**
 * Where each kind of data begins (for reports to tell "no data" from "zero").
 * `readOnly` (dry runs, previews) never writes; otherwise the tracking start is persisted on first use.
 */
export async function getAnalyticsDataCoverage(opts: { readOnly?: boolean } = {}) {
  const [trackingStartedAt, order, stock, inv] = await Promise.all([
    opts.readOnly ? peekTrackingStartedAt() : getTrackingStartedAt(),
    prisma.order.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    prisma.stockMovement.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    prisma.inventory.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
  ]);
  const stockFrom = [stock?.createdAt, inv?.createdAt].filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  return {
    /** Behavioural and operational events exist from this instant (IST day: firstTrackedDay). */
    trackingStartedAt,
    firstTrackedDay: trackingStartedAt ? istDayOf(trackingStartedAt) : null,
    salesFromDay: order ? istDayOf(order.createdAt) : null,
    stockHistoryFromDay: stockFrom ? istDayOf(stockFrom) : null,
  };
}

/* ───────────────────────────── Stock replay ───────────────────────────── */

type Movement = { inventoryId: string; movementType: string; quantity: number; previousQuantity: number; newQuantity: number; createdAt: Date };

/** Change a movement makes to (available, reserved). See orders.ts / inventory.ts for the semantics. */
export function movementDelta(m: Pick<Movement, 'movementType' | 'quantity' | 'previousQuantity' | 'newQuantity'>) {
  if (m.movementType === 'RESERVATION' || m.movementType === 'RELEASE') return { available: 0, reserved: m.newQuantity - m.previousQuantity };
  if (m.movementType === 'SALE') return { available: m.quantity, reserved: m.quantity }; // dispatch: both drop by q
  return { available: m.newQuantity - m.previousQuantity, reserved: 0 };
}

export interface ReplayResult {
  openingAvailable: number;
  openingReserved: number;
  closingAvailable: number;
  closingReserved: number;
  closingSellable: number;
  movements: number;
  trackedMinutes: number;
  stockoutMinutes: number;
  longestStockoutMinutes: number;
  stockouts: number;
  consistent: boolean;
  /** In-stock intervals [startMs, endMs) within the tracked part of the day. */
  inStock: [number, number][];
}

/**
 * Replay one stock row through [from, to): start from the opening quantities, apply the day's
 * movements in order and measure the time with no sellable stock (available − reserved − safety ≤ 0).
 */
export function replayStockDay(opts: {
  from: number;
  to: number;
  openingAvailable: number;
  openingReserved: number;
  safetyStock: number;
  movements: Pick<Movement, 'movementType' | 'quantity' | 'previousQuantity' | 'newQuantity' | 'createdAt'>[];
}): ReplayResult {
  let available = opts.openingAvailable;
  let reserved = opts.openingReserved;
  let consistent = available >= 0 && reserved >= 0;
  const sellable = () => Math.max(available - reserved - opts.safetyStock, 0);
  const inStock: [number, number][] = [];
  let outMs = 0;
  let longest = 0;
  let current = 0;
  let stockouts = 0;
  let wasOut: boolean | null = null;
  let t = opts.from;
  const segment = (until: number) => {
    if (until <= t) return;
    const out = sellable() <= 0;
    if (out) {
      outMs += until - t;
      current += until - t;
      longest = Math.max(longest, current);
      if (wasOut !== true) stockouts++;
    } else {
      current = 0;
      const last = inStock[inStock.length - 1];
      if (last && last[1] === t) last[1] = until;
      else inStock.push([t, until]);
    }
    wasOut = out;
    t = until;
  };
  for (const m of opts.movements) {
    const at = Math.min(Math.max(m.createdAt.getTime(), opts.from), opts.to);
    segment(at);
    const d = movementDelta(m);
    available += d.available;
    reserved += d.reserved;
    if (available < 0 || reserved < 0) consistent = false;
  }
  segment(opts.to);
  const toMin = (ms: number) => Math.round(ms / 60_000);
  return {
    openingAvailable: opts.openingAvailable,
    openingReserved: opts.openingReserved,
    closingAvailable: available,
    closingReserved: reserved,
    closingSellable: sellable(),
    movements: opts.movements.length,
    trackedMinutes: toMin(opts.to - opts.from),
    stockoutMinutes: toMin(outMs),
    longestStockoutMinutes: toMin(longest),
    stockouts,
    consistent,
    inStock,
  };
}

/** Total length of the union of intervals. */
function unionMs(intervals: [number, number][]) {
  const s = [...intervals].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const [a, b] of s) {
    if (!cur || a > cur[1]) {
      if (cur) total += cur[1] - cur[0];
      cur = [a, b];
    } else cur[1] = Math.max(cur[1], b);
  }
  if (cur) total += cur[1] - cur[0];
  return total;
}

/* ───────────────────────────── One day ───────────────────────────── */

/** Order counts as an ACTUAL sale: not cancelled/failed/refunded, and online orders only once paid. */
const COMPLETED = Prisma.sql`o."status" NOT IN ('CANCELLED', 'FAILED', 'REFUNDED')
  AND (o."paymentMethod" = 'CASH_ON_DELIVERY' OR o."paymentStatus" NOT IN ('PENDING', 'FAILED'))`;
const IST_HOUR = (col: Prisma.Sql) => Prisma.sql`extract(hour from ${col} + interval '330 minutes')::int`;

async function computeDay(db: Prisma.TransactionClient, day: string, trackingStartedAt: Date | null) {
  const { start, end } = istDayWindow(day);
  const coverage = coverageFor(day, trackingStartedAt);
  const inWindow = (col: Prisma.Sql) => Prisma.sql`${col} >= ${utc(start)} AND ${col} < ${utc(end)}`;

  const [events, addHours, sales, saleHours, products, stockRows, deltas, dayMoves] = await Promise.all([
    db.$queryRaw<
      { productId: string; views: bigint; viewers: bigint; unavailable: bigint; add_units: bigint; add_events: bigint; remove_units: bigint; wishlist: bigint; oos: bigint; oos_units: bigint; est_lost: bigint }[]
    >`
      SELECT e."productId",
             count(*) FILTER (WHERE e."name" = 'PRODUCT_VIEWED') AS views,
             count(DISTINCT e."visitorId") FILTER (WHERE e."name" = 'PRODUCT_VIEWED') AS viewers,
             count(*) FILTER (WHERE e."name" = 'PRODUCT_UNAVAILABLE_VIEWED') AS unavailable,
             coalesce(sum(coalesce(e."quantity", 1)) FILTER (WHERE e."name" = 'CART_ITEM_ADDED'), 0) AS add_units,
             count(*) FILTER (WHERE e."name" = 'CART_ITEM_ADDED') AS add_events,
             coalesce(sum(coalesce(e."quantity", 1)) FILTER (WHERE e."name" = 'CART_ITEM_REMOVED'), 0) AS remove_units,
             count(*) FILTER (WHERE e."name" = 'WISHLIST_ADDED') AS wishlist,
             count(*) FILTER (WHERE e."name" = 'OUT_OF_STOCK_ADD_ATTEMPT') AS oos,
             coalesce(sum(coalesce(e."quantity", 1)) FILTER (WHERE e."name" = 'OUT_OF_STOCK_ADD_ATTEMPT'), 0) AS oos_units,
             coalesce(sum(coalesce(e."quantity", 1)::bigint * coalesce(e."unitPricePaise", 0)) FILTER (WHERE e."name" = 'OUT_OF_STOCK_ADD_ATTEMPT'), 0) AS est_lost
        FROM "AnalyticsEvent" e
       WHERE e."productId" IS NOT NULL AND ${inWindow(Prisma.sql`e."occurredAt"`)}
       GROUP BY e."productId"`,
    db.$queryRaw<{ productId: string; h: number; units: bigint }[]>`
      SELECT e."productId", ${IST_HOUR(Prisma.sql`e."occurredAt"`)} AS h, sum(coalesce(e."quantity", 1)) AS units
        FROM "AnalyticsEvent" e
       WHERE e."name" = 'CART_ITEM_ADDED' AND e."productId" IS NOT NULL AND ${inWindow(Prisma.sql`e."occurredAt"`)}
       GROUP BY 1, 2`,
    db.$queryRaw<{ productId: string; orders: bigint; units: bigint; revenue: bigint; cancelled: bigint; failed: bigint }[]>`
      SELECT oi."productId",
             count(DISTINCT o."id") FILTER (WHERE ${COMPLETED}) AS orders,
             coalesce(sum(oi."quantity") FILTER (WHERE ${COMPLETED}), 0) AS units,
             coalesce(sum(oi."totalPricePaise") FILTER (WHERE ${COMPLETED}), 0) AS revenue,
             coalesce(sum(oi."quantity") FILTER (WHERE o."status" IN ('CANCELLED', 'REFUNDED')), 0) AS cancelled,
             coalesce(sum(oi."quantity") FILTER (WHERE o."status" = 'FAILED'), 0) AS failed
        FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
       WHERE ${inWindow(Prisma.sql`o."createdAt"`)}
       GROUP BY oi."productId"`,
    db.$queryRaw<{ productId: string; h: number; units: bigint }[]>`
      SELECT oi."productId", ${IST_HOUR(Prisma.sql`o."createdAt"`)} AS h, sum(oi."quantity") AS units
        FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
       WHERE ${COMPLETED} AND ${inWindow(Prisma.sql`o."createdAt"`)}
       GROUP BY 1, 2`,
    db.product.findMany({ where: { createdAt: { lt: end } }, select: { id: true, categoryId: true, status: true, createdAt: true } }),
    db.$queryRaw<
      { id: string; productId: string; variantId: string | null; warehouseId: string; availableQuantity: number; reservedQuantity: number; safetyStock: number; createdAt: Date; active: boolean }[]
    >`
      SELECT i."id", i."productId", i."variantId", i."warehouseId", i."availableQuantity", i."reservedQuantity", i."safetyStock",
             i."createdAt", (w."status" = 'ACTIVE') AS active
        FROM "Inventory" i JOIN "Warehouse" w ON w."id" = i."warehouseId"
       WHERE i."createdAt" < ${utc(end)}`,
    // Everything that happened to each stock row since the start of the day: current − this = opening.
    db.$queryRaw<{ inventoryId: string; avail: bigint; res: bigint }[]>`
      SELECT m."inventoryId",
             sum(CASE WHEN m."movementType" IN ('RESERVATION', 'RELEASE') THEN 0
                      WHEN m."movementType" = 'SALE' THEN m."quantity"
                      ELSE m."newQuantity" - m."previousQuantity" END) AS avail,
             sum(CASE WHEN m."movementType" IN ('RESERVATION', 'RELEASE') THEN m."newQuantity" - m."previousQuantity"
                      WHEN m."movementType" = 'SALE' THEN m."quantity"
                      ELSE 0 END) AS res
        FROM "StockMovement" m
       WHERE m."createdAt" >= ${utc(start)}
       GROUP BY m."inventoryId"`,
    db.$queryRaw<Movement[]>`
      SELECT m."inventoryId", m."movementType"::text AS "movementType", m."quantity", m."previousQuantity", m."newQuantity", m."createdAt"
        FROM "StockMovement" m
       WHERE ${inWindow(Prisma.sql`m."createdAt"`)}
       ORDER BY m."createdAt", m."id"`,
  ]);

  /* Inventory replay (per stock row, every warehouse). */
  const deltaById = new Map(deltas.map((d) => [d.inventoryId, d]));
  const movesById = new Map<string, Movement[]>();
  for (const m of dayMoves) (movesById.get(m.inventoryId) ?? movesById.set(m.inventoryId, []).get(m.inventoryId)!).push(m);
  const snapshots = stockRows.map((r) => {
    const d = deltaById.get(r.id);
    const from = Math.max(start.getTime(), r.createdAt.getTime());
    const replay = replayStockDay({
      from,
      to: end.getTime(),
      openingAvailable: r.availableQuantity - n(d?.avail),
      openingReserved: r.reservedQuantity - n(d?.res),
      safetyStock: r.safetyStock,
      movements: movesById.get(r.id) ?? [],
    });
    return { row: r, replay };
  });

  /* Product-level availability across ACTIVE warehouses (variant rows when the product has them). */
  const byProduct = new Map<string, typeof snapshots>();
  for (const s of snapshots) (byProduct.get(s.row.productId) ?? byProduct.set(s.row.productId, []).get(s.row.productId)!).push(s);
  const availability = (productId: string, existsFrom: number) => {
    const all = (byProduct.get(productId) ?? []).filter((s) => s.row.active);
    const relevant = all.some((s) => s.row.variantId) ? all.filter((s) => s.row.variantId) : all;
    const window = end.getTime() - existsFrom;
    const inStock = unionMs(relevant.flatMap((s) => s.replay.inStock.map(([a, b]) => [Math.max(a, existsFrom), b] as [number, number]).filter(([a, b]) => b > a)));
    return {
      stockoutMinutes: Math.round(Math.max(window - inStock, 0) / 60_000),
      activeStockRows: relevant.length,
      inStockAtClose: relevant.some((s) => s.replay.closingSellable > 0),
    };
  };

  /* Product rows: every non-archived product that existed, plus any product with activity that day. */
  const eventsBy = new Map(events.map((e) => [e.productId, e]));
  const salesBy = new Map(sales.map((s) => [s.productId, s]));
  const addH = new Map<string, number[]>();
  for (const r of addHours) (addH.get(r.productId) ?? addH.set(r.productId, hours()).get(r.productId)!)[r.h] += n(r.units);
  const saleH = new Map<string, number[]>();
  for (const r of saleHours) (saleH.get(r.productId) ?? saleH.set(r.productId, hours()).get(r.productId)!)[r.h] += n(r.units);
  const productById = new Map(products.map((p) => [p.id, p]));
  const ids = new Set<string>([...products.filter((p) => p.status !== 'ARCHIVED').map((p) => p.id), ...eventsBy.keys(), ...salesBy.keys()]);

  const productRows: Prisma.ProductDailyAnalyticsCreateManyInput[] = [];
  for (const id of ids) {
    const p = productById.get(id);
    if (!p) continue; // events/orders for a product that no longer exists (deleted): nothing to attach to
    const e = coverage === 'NONE' ? undefined : eventsBy.get(id);
    const s = salesBy.get(id);
    const av = availability(id, Math.max(start.getTime(), p.createdAt.getTime()));
    productRows.push({
      day: dbDate(day),
      productId: id,
      categoryId: p.categoryId,
      eventCoverage: coverage,
      views: n(e?.views),
      uniqueViewers: n(e?.viewers),
      unavailableViews: n(e?.unavailable),
      cartAddUnits: n(e?.add_units),
      cartAddEvents: n(e?.add_events),
      cartRemoveUnits: n(e?.remove_units),
      wishlistAdds: n(e?.wishlist),
      outOfStockAttempts: n(e?.oos),
      outOfStockUnits: n(e?.oos_units),
      estLostRevenuePaise: n(e?.est_lost),
      orders: n(s?.orders),
      unitsSold: n(s?.units),
      revenuePaise: n(s?.revenue),
      cancelledUnits: n(s?.cancelled),
      failedDeliveryUnits: n(s?.failed),
      cartAddUnitsByHour: coverage === 'NONE' ? hours() : (addH.get(id) ?? hours()),
      unitsSoldByHour: saleH.get(id) ?? hours(),
      ...av,
    });
  }

  const inventoryRows: Prisma.InventoryDailySnapshotCreateManyInput[] = snapshots.map(({ row, replay }) => ({
    day: dbDate(day),
    inventoryId: row.id,
    productId: row.productId,
    variantId: row.variantId,
    warehouseId: row.warehouseId,
    warehouseActive: row.active,
    openingAvailable: replay.openingAvailable,
    openingReserved: replay.openingReserved,
    closingAvailable: replay.closingAvailable,
    closingReserved: replay.closingReserved,
    safetyStock: row.safetyStock,
    closingSellable: replay.closingSellable,
    movements: replay.movements,
    trackedMinutes: replay.trackedMinutes,
    stockoutMinutes: replay.stockoutMinutes,
    longestStockoutMinutes: replay.longestStockoutMinutes,
    stockouts: replay.stockouts,
    consistent: replay.consistent,
  }));

  return { productRows, inventoryRows, coverage };
}

export interface DayResult {
  day: string;
  status: 'done' | 'skipped';
  reason?: string;
  coverage?: 'NONE' | 'PARTIAL' | 'FULL';
  productRows?: number;
  inventoryRows?: number;
}

/**
 * Rebuild one finished IST day. Safe to rerun: the day's rows are replaced in one transaction.
 * A day whose raw events may already have been purged by retention is never rebuilt once done
 * (that would replace real history with zeros).
 */
export async function aggregateProductDay(day: string, opts: { now?: Date } = {}): Promise<DayResult> {
  const now = opts.now ?? new Date();
  istDayWindow(day); // validates
  if (day >= istDayOf(now)) throw new Error(`Day ${day} has not finished yet (IST)`);
  const settings = await getAnalyticsSettings({ fresh: true });
  const retentionDays = Math.min(settings.behavioralRetentionDays, settings.operationalRetentionDays);
  const existing = await prisma.analyticsJobRun.findUnique({ where: { job_day: { job: PRODUCT_DAILY_JOB, day: dbDate(day) } } });
  if (existing?.status === 'done' && day < addDays(istDayOf(now), -(retentionDays - 1))) {
    return { day, status: 'skipped', reason: 'past-retention' };
  }
  const trackingStartedAt = await getTrackingStartedAt();
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${LOCK_KEY}))`;
        const { productRows, inventoryRows, coverage } = await computeDay(tx, day, trackingStartedAt);
        await tx.productDailyAnalytics.deleteMany({ where: { day: dbDate(day) } });
        await tx.inventoryDailySnapshot.deleteMany({ where: { day: dbDate(day) } });
        if (productRows.length) await tx.productDailyAnalytics.createMany({ data: productRows });
        if (inventoryRows.length) await tx.inventoryDailySnapshot.createMany({ data: inventoryRows });
        const rows = productRows.length + inventoryRows.length;
        await tx.analyticsJobRun.upsert({
          where: { job_day: { job: PRODUCT_DAILY_JOB, day: dbDate(day) } },
          create: { job: PRODUCT_DAILY_JOB, day: dbDate(day), status: 'done', rows, finishedAt: new Date() },
          update: { status: 'done', rows, error: null, startedAt: new Date(), finishedAt: new Date() },
        });
        return { coverage, productRows: productRows.length, inventoryRows: inventoryRows.length };
      },
      { timeout: 120_000, maxWait: 30_000 }
    );
    return { day, status: 'done', ...result };
  } catch (err) {
    const message = (err as Error)?.message?.slice(0, 500) ?? 'unknown error';
    await prisma.analyticsJobRun
      .upsert({
        where: { job_day: { job: PRODUCT_DAILY_JOB, day: dbDate(day) } },
        create: { job: PRODUCT_DAILY_JOB, day: dbDate(day), status: 'failed', error: message, finishedAt: new Date() },
        // A previously completed day keeps its rows (the transaction rolled back); only the status records the failure.
        update: { status: existing?.status === 'done' ? 'done' : 'failed', error: message, finishedAt: new Date() },
      })
      .catch(() => undefined);
    throw err;
  }
}

/* ───────────────────────────── Catch-up / backfill ───────────────────────────── */

/** First IST day with any data to aggregate (orders, stock or events), or null. */
export async function firstDataDay(opts: { readOnly?: boolean } = {}): Promise<string | null> {
  const c = await getAnalyticsDataCoverage(opts);
  const days = [c.firstTrackedDay, c.salesFromDay, c.stockHistoryFromDay].filter((d): d is string => !!d).sort();
  return days[0] ?? null;
}

export interface RunSummary {
  processed: DayResult[];
  failed: { day: string; error: string }[];
  /** Missing days still left after this run (picked up by the next run). */
  remaining: number;
}

async function runDays(days: string[], now: Date): Promise<Omit<RunSummary, 'remaining'>> {
  const processed: DayResult[] = [];
  const failed: { day: string; error: string }[] = [];
  for (const day of days) {
    try {
      processed.push(await aggregateProductDay(day, { now }));
    } catch (e) {
      failed.push({ day, error: (e as Error)?.message?.slice(0, 200) ?? 'error' });
    }
  }
  return { processed, failed };
}

/**
 * Daily job: aggregate missing finished days (oldest first, bounded per run) and refresh the most
 * recent ones so late changes (e.g. an order cancelled the next day) are reflected.
 */
export async function runProductDailyAggregation(
  opts: { now?: Date; maxDays?: number; refreshDays?: number; lookbackDays?: number } = {}
): Promise<RunSummary> {
  const now = opts.now ?? new Date();
  const maxDays = opts.maxDays ?? 7;
  const refreshDays = opts.refreshDays ?? 3;
  const lookbackDays = opts.lookbackDays ?? 35;
  const yesterday = addDays(istDayOf(now), -1);
  const first = await firstDataDay();
  if (!first || first > yesterday) return { processed: [], failed: [], remaining: 0 };
  const from = first > addDays(yesterday, -(lookbackDays - 1)) ? first : addDays(yesterday, -(lookbackDays - 1));

  const done = new Set(
    (
      await prisma.analyticsJobRun.findMany({
        where: { job: PRODUCT_DAILY_JOB, status: 'done', day: { gte: dbDate(from), lte: dbDate(yesterday) } },
        select: { day: true },
      })
    ).map((r) => r.day.toISOString().slice(0, 10))
  );
  const missing: string[] = [];
  for (let d = from; d <= yesterday; d = addDays(d, 1)) if (!done.has(d)) missing.push(d);
  const todo = missing.slice(0, maxDays);
  for (let i = 0; i < refreshDays && todo.length < maxDays; i++) {
    const d = addDays(yesterday, -i);
    if (d >= from && !todo.includes(d)) todo.push(d);
  }
  todo.sort();
  const result = await runDays(todo, now);
  const summary = { ...result, remaining: Math.max(missing.length - todo.filter((d) => missing.includes(d)).length, 0) };
  logger.info('analytics.product_daily', { category: 'cron', days: todo.length, failed: summary.failed.length, remaining: summary.remaining });
  return summary;
}

/**
 * One-off historical backfill: every finished day from the first data day (or `from`) to yesterday.
 * Days already done are skipped unless `force`; retention protection always applies.
 */
export async function backfillProductDaily(opts: { from?: string; to?: string; force?: boolean; now?: Date; onDay?: (r: DayResult) => void } = {}) {
  const now = opts.now ?? new Date();
  const yesterday = addDays(istDayOf(now), -1);
  const first = opts.from ?? (await firstDataDay());
  const to = opts.to && opts.to < yesterday ? opts.to : yesterday;
  if (!first || first > to) return { processed: [] as DayResult[], failed: [] as { day: string; error: string }[], from: first, to };
  const done = opts.force
    ? new Set<string>()
    : new Set(
        (await prisma.analyticsJobRun.findMany({ where: { job: PRODUCT_DAILY_JOB, status: 'done' }, select: { day: true } })).map((r) =>
          r.day.toISOString().slice(0, 10)
        )
      );
  const processed: DayResult[] = [];
  const failed: { day: string; error: string }[] = [];
  for (let d = first; d <= to; d = addDays(d, 1)) {
    if (done.has(d)) {
      const r: DayResult = { day: d, status: 'skipped', reason: 'already-done' };
      processed.push(r);
      opts.onDay?.(r);
      continue;
    }
    try {
      const r = await aggregateProductDay(d, { now });
      processed.push(r);
      opts.onDay?.(r);
    } catch (e) {
      failed.push({ day: d, error: (e as Error)?.message?.slice(0, 200) ?? 'error' });
      captureException(e, 'analytics.backfill_day_failed', { category: 'cron', day: d });
    }
  }
  return { processed, failed, from: first, to };
}
