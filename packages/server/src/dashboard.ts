import { prisma } from '@20mart/database';
import { inventoryStats } from './inventory';
import { procurementStats } from './procurement';

/** Real catalog & stock KPIs for the admin dashboard. */
export async function getDashboardStats() {
  const [totalProducts, activeProducts, draftProducts, totalCategories, totalBrands, stock, lowStockItems] = await Promise.all([
    prisma.product.count({ where: { status: { not: 'ARCHIVED' } } }),
    prisma.product.count({ where: { status: 'ACTIVE' } }),
    prisma.product.count({ where: { status: 'DRAFT' } }),
    prisma.category.count(),
    prisma.brand.count(),
    inventoryStats(),
    prisma.$queryRaw<
      { inventoryId: string; productId: string; name: string; sku: string; variantName: string | null; warehouse: string; sellable: number; threshold: number }[]
    >`
      SELECT i."id" AS "inventoryId", p."id" AS "productId", p."name", COALESCE(v."sku", p."sku") AS sku,
             v."name" AS "variantName", w."code" AS warehouse,
             GREATEST(i."availableQuantity" - i."reservedQuantity" - i."safetyStock", 0)::int AS sellable,
             i."lowStockThreshold" AS threshold
        FROM "Inventory" i
        JOIN "Product" p ON p."id" = i."productId"
        JOIN "Warehouse" w ON w."id" = i."warehouseId" AND w."status" IN ('ACTIVE', 'PAUSED')
        LEFT JOIN "ProductVariant" v ON v."id" = i."variantId"
       WHERE p."status" = 'ACTIVE'
         AND (i."variantId" IS NOT NULL OR NOT EXISTS (SELECT 1 FROM "ProductVariant" pv WHERE pv."productId" = p."id"))
         AND i."availableQuantity" - i."reservedQuantity" - i."safetyStock" <= i."lowStockThreshold"
       ORDER BY sellable ASC, p."name" ASC
       LIMIT 8`,
  ]);
  return {
    totalProducts,
    activeProducts,
    draftProducts,
    totalCategories,
    totalBrands,
    totalInventoryUnits: stock.totalUnits,
    reservedUnits: stock.reservedUnits,
    sellableUnits: stock.sellableUnits,
    lowStock: stock.lowStock,
    outOfStock: stock.outOfStock,
    lowStockItems,
  };
}

const OPEN = ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY'] as const;

/**
 * Operations KPIs (last 30 days where time-bound). Money is split strictly by payment state:
 * paid value counts only PAID / PARTIALLY_REFUNDED orders; pending and cancelled are separate;
 * pre-launch interest is a count of people, never sales.
 */
export async function getOperationsStats() {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [warehouses, zones, byWarehouse, movements, adjustments, procurement, interest] = await Promise.all([
    prisma.warehouse.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.deliveryZone.count({ where: { isActive: true, warehouses: { some: { isActive: true, warehouse: { status: 'ACTIVE' } } } } }),
    prisma.$queryRaw<{ code: string | null; name: string | null; orders: bigint; open: bigint; paid: bigint | null; pending: bigint | null; cancelled: bigint }[]>`
      SELECT w."code", w."name",
             COUNT(*) AS orders,
             COUNT(*) FILTER (WHERE o."status"::text IN (${OPEN[0]}, ${OPEN[1]}, ${OPEN[2]}, ${OPEN[3]}, ${OPEN[4]}, ${OPEN[5]})) AS open,
             SUM(o."totalPaise") FILTER (WHERE o."paymentStatus" IN ('PAID', 'PARTIALLY_REFUNDED')) AS paid,
             SUM(o."totalPaise") FILTER (WHERE o."paymentStatus" = 'PENDING' AND o."status" NOT IN ('CANCELLED', 'FAILED')) AS pending,
             COUNT(*) FILTER (WHERE o."status" IN ('CANCELLED', 'FAILED')) AS cancelled
        FROM "Order" o LEFT JOIN "Warehouse" w ON w."id" = o."fulfillmentWarehouseId"
       WHERE o."createdAt" >= ${since}
       GROUP BY w."code", w."name"
       ORDER BY orders DESC`,
    prisma.stockMovement.groupBy({ by: ['movementType'], where: { createdAt: { gte: since } }, _count: { _all: true }, _sum: { quantity: true } }),
    prisma.stockMovement.count({ where: { createdAt: { gte: since }, movementType: { in: ['ADJUSTMENT', 'STOCK_IN', 'STOCK_OUT', 'INITIAL_STOCK'] } } }),
    procurementStats(),
    prisma.deliveryInterest.count(),
  ]);
  const ws = Object.fromEntries(warehouses.map((w) => [w.status, w._count._all])) as Record<string, number>;
  return {
    warehouses: { active: ws.ACTIVE ?? 0, paused: ws.PAUSED ?? 0, setup: ws.SETUP ?? 0, inactive: ws.INACTIVE ?? 0 },
    activeDeliveryAreas: zones,
    ordersByWarehouse: byWarehouse.map((r) => ({
      code: r.code,
      name: r.name,
      orders: Number(r.orders),
      open: Number(r.open),
      paidPaise: Number(r.paid ?? 0),
      pendingPaise: Number(r.pending ?? 0),
      cancelled: Number(r.cancelled),
    })),
    movements30d: movements.map((m) => ({ type: m.movementType, count: m._count._all, units: m._sum.quantity ?? 0 })),
    manualAdjustments30d: adjustments,
    procurement,
    deliveryInterest: interest,
  };
}
