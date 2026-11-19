import { prisma, Prisma } from '@20mart/database';
import { z } from 'zod';
import { badRequest } from '../errors';

/**
 * Unfulfilled demand: what shoppers tried to buy but could not, from server-recorded events only.
 *
 *  - OUT_OF_STOCK_ADD_ATTEMPT (operational, always recorded): units refused for stock reasons when
 *    adding to the cart or raising a quantity. `quantity` is the shortfall the server computed and
 *    `unitPricePaise` is the database price at that moment, so nothing here comes from the browser.
 *    Repeat attempts for the same item from the same cart on the same day are stored once.
 *  - Estimated lost revenue = Σ shortfall × server unit price. It is an ESTIMATE (an upper bound):
 *    a shopper may later buy the item, a substitute, or nothing at all.
 *  - `notAtLocation` separates "out of stock at the shopper's delivery location" (stock exists
 *    elsewhere — a distribution problem) from "out of stock everywhere" (a purchasing problem).
 *  - PRODUCT_UNAVAILABLE_VIEWED is a behavioural, consent-only event: it under-counts and is shown
 *    as a supporting signal, never added to the revenue estimate.
 *  - Unserviceable DELIVERY_CHECKED events show demand from areas that are not delivered to.
 */
export const demandQuery = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict();

const MAX_RANGE_DAYS = 366;
const n = (v: bigint | number | null | undefined) => Number(v ?? 0);

export async function getUnfulfilledDemand(raw: unknown = {}, now = new Date()) {
  const q = demandQuery.parse(raw);
  const to = q.to ?? now;
  const from = q.from ?? new Date(to.getTime() - 30 * 86_400_000);
  if (from >= to) throw badRequest('The start must be before the end');
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) throw badRequest(`The range can be at most ${MAX_RANGE_DAYS} days`);
  // Event times are stored as UTC timestamps without a zone (Prisma default).
  const range = Prisma.sql`e."occurredAt" >= (${from}::timestamptz AT TIME ZONE 'UTC') AND e."occurredAt" < (${to}::timestamptz AT TIME ZONE 'UTC')`;

  const [products, totals, unavailableViews, areas] = await Promise.all([
    prisma.$queryRaw<
      { productId: string; variantId: string | null; attempts: bigint; units: bigint; lost: bigint; not_at_location: bigint; name: string | null; sku: string | null; variant_name: string | null; category_id: string | null }[]
    >`
      SELECT e."productId", e."variantId",
             count(*) AS attempts,
             coalesce(sum(e."quantity"), 0) AS units,
             coalesce(sum(e."quantity"::bigint * e."unitPricePaise"), 0) AS lost,
             count(*) FILTER (WHERE e."metadata"->>'atLocation' = 'true') AS not_at_location,
             p."name", coalesce(v."sku", p."sku") AS sku, v."name" AS variant_name, p."categoryId" AS category_id
        FROM "AnalyticsEvent" e
        LEFT JOIN "Product" p ON p."id" = e."productId"
        LEFT JOIN "ProductVariant" v ON v."id" = e."variantId"
       WHERE e."name" = 'OUT_OF_STOCK_ADD_ATTEMPT' AND e."productId" IS NOT NULL AND ${range}
       GROUP BY e."productId", e."variantId", p."name", p."sku", v."sku", v."name", p."categoryId"
       ORDER BY lost DESC, units DESC
       LIMIT ${q.limit}`,
    prisma.$queryRaw<{ attempts: bigint; units: bigint; lost: bigint; products: bigint }[]>`
      SELECT count(*) AS attempts, coalesce(sum(e."quantity"), 0) AS units,
             coalesce(sum(e."quantity"::bigint * e."unitPricePaise"), 0) AS lost,
             count(DISTINCT e."productId") AS products
        FROM "AnalyticsEvent" e
       WHERE e."name" = 'OUT_OF_STOCK_ADD_ATTEMPT' AND ${range}`,
    prisma.$queryRaw<{ productId: string; views: bigint }[]>`
      SELECT e."productId", count(*) AS views
        FROM "AnalyticsEvent" e
       WHERE e."name" = 'PRODUCT_UNAVAILABLE_VIEWED' AND e."productId" IS NOT NULL AND ${range}
       GROUP BY e."productId"`,
    prisma.$queryRaw<{ pincode: string; checks: bigint }[]>`
      SELECT e."pincode", count(*) AS checks
        FROM "AnalyticsEvent" e
       WHERE e."name" = 'DELIVERY_CHECKED' AND e."metadata"->>'serviceable' = 'false' AND e."pincode" IS NOT NULL AND ${range}
       GROUP BY e."pincode"
       ORDER BY checks DESC
       LIMIT ${q.limit}`,
  ]);

  const viewsByProduct = new Map(unavailableViews.map((r) => [r.productId, n(r.views)]));
  const t = totals[0];
  return {
    from,
    to,
    basis: 'server_verified' as const,
    totals: {
      attempts: n(t?.attempts),
      unitsRequested: n(t?.units),
      products: n(t?.products),
      estimatedLostRevenuePaise: n(t?.lost),
      unavailableProductViews: unavailableViews.reduce((a, r) => a + n(r.views), 0),
      unserviceableAreaChecks: areas.reduce((a, r) => a + n(r.checks), 0),
    },
    products: products.map((r) => ({
      productId: r.productId,
      variantId: r.variantId,
      name: r.name ?? '(deleted product)',
      variantName: r.variant_name,
      sku: r.sku,
      categoryId: r.category_id,
      attempts: n(r.attempts),
      unitsRequested: n(r.units),
      estimatedLostRevenuePaise: n(r.lost),
      notAtLocationAttempts: n(r.not_at_location),
      unavailableViews: viewsByProduct.get(r.productId) ?? 0,
    })),
    unserviceableAreas: areas.map((r) => ({ pincode: r.pincode, checks: n(r.checks) })),
  };
}
