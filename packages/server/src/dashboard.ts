import { prisma } from '@20mart/database';
import { inventoryStats } from './inventory';

/** Real catalog & stock KPIs for the admin dashboard (no order/revenue data in P0). */
export async function getDashboardStats() {
  const [totalProducts, activeProducts, draftProducts, totalCategories, totalBrands, stock, lowStockItems] = await Promise.all([
    prisma.product.count({ where: { status: { not: 'ARCHIVED' } } }),
    prisma.product.count({ where: { status: 'ACTIVE' } }),
    prisma.product.count({ where: { status: 'DRAFT' } }),
    prisma.category.count(),
    prisma.brand.count(),
    inventoryStats(),
    prisma.$queryRaw<
      { inventoryId: string; productId: string; name: string; sku: string; variantName: string | null; sellable: number; threshold: number }[]
    >`
      SELECT i."id" AS "inventoryId", p."id" AS "productId", p."name", COALESCE(v."sku", p."sku") AS sku,
             v."name" AS "variantName", (i."availableQuantity" - i."reservedQuantity")::int AS sellable,
             i."lowStockThreshold" AS threshold
        FROM "Inventory" i
        JOIN "Product" p ON p."id" = i."productId"
        LEFT JOIN "ProductVariant" v ON v."id" = i."variantId"
       WHERE p."status" = 'ACTIVE'
         AND (i."variantId" IS NOT NULL OR NOT EXISTS (SELECT 1 FROM "ProductVariant" pv WHERE pv."productId" = p."id"))
         AND i."availableQuantity" - i."reservedQuantity" <= i."lowStockThreshold"
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
    lowStock: stock.lowStock,
    outOfStock: stock.outOfStock,
    lowStockItems,
  };
}
