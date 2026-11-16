/**
 * Business analytics on real data only.
 *
 * Definitions (shown in the UI next to each number):
 *  - Paid revenue (gross): order totals of orders placed in the range whose payment was captured
 *    (PAID, PARTIALLY_REFUNDED, REFUNDED, REFUND_PENDING). COD counts once cash is collected.
 *  - Refunded: refunds the provider confirmed (PROCESSED) in the range.
 *  - Net revenue = gross − refunded.
 *  - Coupons distributed (issued) and redeemed are different numbers; reversed redemptions are excluded.
 *  - Fill Your Cart saved carts are pre-launch INTEREST and are never added to sales.
 * Day boundaries are Asia/Kolkata.
 */
import { prisma, Prisma } from '@20mart/database';
import { z } from 'zod';
import { CAPTURED_PAYMENT } from './customers';
import { badRequest } from './errors';

const IST_OFFSET_MS = 330 * 60_000;
export type RangePreset = 'today' | '7d' | '30d' | 'month' | 'custom';

/** Midnight IST of the given IST calendar date, as a UTC instant. */
function istMidnight(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m, d) - IST_OFFSET_MS);
}
function istParts(now: Date) {
  const t = new Date(now.getTime() + IST_OFFSET_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() };
}

export const analyticsQuery = z.object({
  range: z.enum(['today', '7d', '30d', 'month', 'custom']).default('30d').catch('30d'),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
});

/** Resolve a preset to [start, end) in UTC instants aligned to IST days. `to` is inclusive for custom ranges. */
export function resolveRange(raw: unknown, now = new Date()) {
  const q = analyticsQuery.parse(raw ?? {});
  const { y, m, d } = istParts(now);
  const tomorrow = istMidnight(y, m, d + 1);
  let start: Date;
  let end = tomorrow;
  switch (q.range) {
    case 'today':
      start = istMidnight(y, m, d);
      break;
    case '7d':
      start = istMidnight(y, m, d - 6);
      break;
    case 'month':
      start = istMidnight(y, m, 1);
      break;
    case 'custom': {
      if (!q.from || !q.to) throw badRequest('Choose a start and end date');
      const [fy, fm, fd] = q.from.split('-').map(Number);
      const [ty, tm, td] = q.to.split('-').map(Number);
      start = istMidnight(fy, fm - 1, fd);
      end = istMidnight(ty, tm - 1, td + 1);
      if (end <= start) throw badRequest('End date must be on or after the start date');
      if (end.getTime() - start.getTime() > 366 * 86_400_000) throw badRequest('Ranges are limited to one year');
      break;
    }
    default:
      start = istMidnight(y, m, d - 29);
  }
  const fmt = (dt: Date) => new Date(dt.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
  return { range: q.range, start, end, label: `${fmt(start)} → ${fmt(new Date(end.getTime() - 1))}`, fromDate: fmt(start), toDate: fmt(new Date(end.getTime() - 1)) };
}

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

/**
 * A Date as a UTC wall-clock `timestamp` for raw SQL. Prisma binds Dates as timestamptz; comparing
 * that with our `timestamp(3)` (UTC) columns would apply the session time zone, so convert explicitly.
 */
const ts = (d: Date) => Prisma.sql`(${d}::timestamptz AT TIME ZONE 'UTC')`;

export async function getAnalytics(raw: unknown, now = new Date()) {
  const r = resolveRange(raw, now);
  const inRange = { gte: r.start, lt: r.end };
  const captured: Prisma.OrderWhereInput = { paymentStatus: { in: [...CAPTURED_PAYMENT] }, createdAt: inRange };
  const capturedList = Prisma.join(CAPTURED_PAYMENT.map((s) => Prisma.sql`${s}::"PaymentStatus"`));

  const [
    paid, refunded, placedByStatus, daily, topProducts, byCategory, newCustomers, totalCustomers, buyers,
    grants, redemptions, topCoupons, fycJoins, fycSaved, emailByStatus,
  ] = await Promise.all([
    prisma.order.aggregate({ where: captured, _sum: { totalPaise: true, discountPaise: true }, _count: { _all: true } }),
    prisma.refund.aggregate({ where: { status: 'PROCESSED', processedAt: inRange }, _sum: { amountPaise: true }, _count: { _all: true } }),
    prisma.order.groupBy({ by: ['status'], where: { createdAt: inRange }, _count: { _all: true } }),
    prisma.$queryRaw<{ day: string; revenue: bigint; orders: bigint }[]>`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day,
             sum("totalPaise") AS revenue, count(*) AS orders
        FROM "Order"
       WHERE "createdAt" >= ${ts(r.start)} AND "createdAt" < ${ts(r.end)} AND "paymentStatus" IN (${capturedList})
       GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ productId: string; name: string; units: bigint; revenue: bigint }[]>`
      SELECT oi."productId", max(oi."productName") AS name, sum(oi."quantity") AS units, sum(oi."totalPricePaise") AS revenue
        FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
       WHERE o."createdAt" >= ${ts(r.start)} AND o."createdAt" < ${ts(r.end)} AND o."paymentStatus" IN (${capturedList})
       GROUP BY oi."productId" ORDER BY units DESC, revenue DESC LIMIT 10`,
    prisma.$queryRaw<{ category: string; units: bigint; revenue: bigint }[]>`
      SELECT c."name" AS category, sum(oi."quantity") AS units, sum(oi."totalPricePaise") AS revenue
        FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
        JOIN "Product" p ON p."id" = oi."productId" JOIN "Category" c ON c."id" = p."categoryId"
       WHERE o."createdAt" >= ${ts(r.start)} AND o."createdAt" < ${ts(r.end)} AND o."paymentStatus" IN (${capturedList})
       GROUP BY c."name" ORDER BY revenue DESC`,
    prisma.user.count({ where: { createdAt: inRange } }),
    prisma.user.count(),
    // Buyers in range, and how many of them are repeat buyers: ≥2 captured orders up to the end of the
    // range ⇔ ≥2 in range, or ≥1 in range plus an earlier one. One query, using the (userId, createdAt) index.
    prisma.$queryRaw<{ buyers: bigint; repeat: bigint }[]>`
      WITH b AS (
        SELECT "userId", count(*) AS n FROM "Order"
         WHERE "createdAt" >= ${ts(r.start)} AND "createdAt" < ${ts(r.end)} AND "paymentStatus" IN (${capturedList})
         GROUP BY "userId")
      SELECT count(*) AS buyers,
             count(*) FILTER (WHERE b.n >= 2 OR EXISTS (
               SELECT 1 FROM "Order" o2
                WHERE o2."userId" = b."userId" AND o2."createdAt" < ${ts(r.start)} AND o2."paymentStatus" IN (${capturedList}))) AS repeat
        FROM b`,
    prisma.couponGrant.count({ where: { issuedAt: inRange } }),
    prisma.couponRedemption.aggregate({ where: { status: 'APPLIED', redeemedAt: inRange }, _sum: { discountPaise: true }, _count: { _all: true } }),
    prisma.$queryRaw<{ code: string; redeemed: bigint; discount: bigint }[]>`
      SELECT c."code", count(*) AS redeemed, sum(r."discountPaise") AS discount
        FROM "CouponRedemption" r JOIN "Coupon" c ON c."id" = r."couponId"
       WHERE r."status" = 'APPLIED' AND r."redeemedAt" >= ${ts(r.start)} AND r."redeemedAt" < ${ts(r.end)}
       GROUP BY c."code" ORDER BY redeemed DESC LIMIT 8`,
    prisma.campaignParticipant.count({ where: { joinedAt: inRange, campaign: { type: 'FILL_YOUR_CART' } } }),
    prisma.$queryRaw<{ carts: bigint; units: bigint; value: bigint }[]>`
      SELECT count(DISTINCT (ci."campaignId", ci."userId")) AS carts, coalesce(sum(ci."quantity"), 0) AS units,
             coalesce(sum(ci."quantity" * p."sellingPricePaise"), 0) AS value
        FROM "CampaignCartItem" ci JOIN "Product" p ON p."id" = ci."productId"
       WHERE ci."updatedAt" >= ${ts(r.start)} AND ci."updatedAt" < ${ts(r.end)}`,
    prisma.emailMessage.groupBy({ by: ['status'], where: { createdAt: inRange }, _count: { _all: true } }),
  ]);


  // Fill the daily series so empty days show as zero (not missing).
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const series: { day: string; revenuePaise: number; orders: number }[] = [];
  for (let t = r.start.getTime(); t < r.end.getTime(); t += 86_400_000) {
    const day = new Date(t + IST_OFFSET_MS).toISOString().slice(0, 10);
    const row = byDay.get(day);
    series.push({ day, revenuePaise: n(row?.revenue), orders: n(row?.orders) });
  }

  const gross = paid._sum.totalPaise ?? 0;
  const refundedPaise = refunded._sum.amountPaise ?? 0;
  const count = (s: string) => placedByStatus.find((b) => b.status === s)?._count._all ?? 0;
  return {
    range: r,
    sales: {
      grossPaidRevenuePaise: gross,
      refundedPaise,
      refundsProcessed: refunded._count._all,
      netRevenuePaise: gross - refundedPaise,
      paidOrders: paid._count._all,
      averageOrderValuePaise: paid._count._all ? Math.round(gross / paid._count._all) : 0,
      discountOnPaidOrdersPaise: paid._sum.discountPaise ?? 0,
    },
    orders: {
      placed: placedByStatus.reduce((a, b) => a + b._count._all, 0),
      awaiting: count('PENDING'),
      delivered: count('DELIVERED'),
      cancelled: count('CANCELLED'),
      failed: count('FAILED'),
    },
    series,
    topProducts: topProducts.map((p) => ({ productId: p.productId, name: p.name, units: n(p.units), revenuePaise: n(p.revenue) })),
    byCategory: byCategory.map((c) => ({ category: c.category, units: n(c.units), revenuePaise: n(c.revenue) })),
    customers: { newCustomers, totalCustomers, buyers: n(buyers[0]?.buyers), repeatBuyers: n(buyers[0]?.repeat) },
    coupons: {
      distributed: grants,
      redeemed: redemptions._count._all,
      discountGivenPaise: redemptions._sum.discountPaise ?? 0,
      top: topCoupons.map((c) => ({ code: c.code, redeemed: n(c.redeemed), discountPaise: n(c.discount) })),
    },
    interest: { fycJoins, savedCarts: n(fycSaved[0]?.carts), savedUnits: n(fycSaved[0]?.units), estimatedInterestPaise: n(fycSaved[0]?.value) },
    email: Object.fromEntries(emailByStatus.map((e) => [e.status, e._count._all])) as Record<string, number>,
  };
}

export type AnalyticsReport = Awaited<ReturnType<typeof getAnalytics>>;
