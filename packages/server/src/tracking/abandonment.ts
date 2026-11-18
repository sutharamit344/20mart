import { prisma, Prisma } from '@20mart/database';
import { getAnalyticsSettings } from './settings';

/**
 * Cart abandonment: an ACTIVE cart that still has items and whose last activity (the cart or any
 * of its lines changing) is at least `cartAbandonmentHours` old. The threshold is configurable
 * (AnalyticsSettings, default 24 h). Converted carts are never abandoned.
 */
export function isCartAbandoned(lastActivityAt: Date, now: Date, thresholdHours: number) {
  return now.getTime() - lastActivityAt.getTime() >= thresholdHours * 3_600_000;
}

const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

/**
 * Snapshot of carts that are abandoned right now. Value uses today's server-side prices
 * (an estimate of potential lost revenue, never revenue). Guest carts are purged after 30 days
 * by maintenance, so older guest abandonment is only visible through recorded events.
 */
export async function getAbandonedCartSummary(now = new Date()) {
  const { cartAbandonmentHours } = await getAnalyticsSettings();
  const cutoff = new Date(now.getTime() - cartAbandonmentHours * 3_600_000);
  const [row] = await prisma.$queryRaw<{ carts: bigint; customer_carts: bigint; units: bigint; value: bigint }[]>`
    WITH c AS (
      SELECT ca."id", ca."userId",
             greatest(ca."updatedAt", max(ci."updatedAt")) AS last_activity,
             sum(ci."quantity") AS units,
             sum(ci."quantity" * coalesce(v."sellingPricePaise", p."sellingPricePaise")) AS value
        FROM "Cart" ca
        JOIN "CartItem" ci ON ci."cartId" = ca."id"
        JOIN "Product" p ON p."id" = ci."productId"
        LEFT JOIN "ProductVariant" v ON v."id" = ci."variantId"
       WHERE ca."status" = 'ACTIVE'
       GROUP BY ca."id")
    SELECT count(*) AS carts,
           count(*) FILTER (WHERE "userId" IS NOT NULL) AS customer_carts,
           coalesce(sum(units), 0) AS units,
           coalesce(sum(value), 0) AS value
      FROM c
     WHERE last_activity <= ${Prisma.sql`(${cutoff}::timestamptz AT TIME ZONE 'UTC')`}`;
  return {
    thresholdHours: cartAbandonmentHours,
    abandonedCarts: n(row?.carts),
    customerCarts: n(row?.customer_carts),
    guestCarts: n(row?.carts) - n(row?.customer_carts),
    units: n(row?.units),
    estimatedValuePaise: n(row?.value),
  };
}
