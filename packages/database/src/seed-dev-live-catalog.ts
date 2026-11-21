/**
 * DEVELOPMENT-ONLY: make the local catalogue match the live store.
 *   pnpm db:seed               (first: seeds the 76 live products from seed-catalog.json)
 *   pnpm db:seed:dev-live      (then: this script)
 *
 * - Removes every local product that is not in the live catalogue (deleted, or archived
 *   when an order/cart/wishlist row still references it).
 * - Gives each live product 100 units in the local delivery warehouse (default AMD-GOTA,
 *   override with WAREHOUSE_CODE), matching live stock. Existing stock rows are left as is.
 * Refuses to run in production or against a non-local database. Idempotent.
 */
import { PrismaClient } from '@prisma/client';
import catalog from './seed-catalog.json';

// Prisma reads .env lazily; load it now so the safety check below sees DATABASE_URL.
try {
  process.loadEnvFile('.env');
} catch {
  /* env provided by the shell */
}

const dbHost = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').hostname;
  } catch {
    return '';
  }
})();
if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '::1'].includes(dbHost)) {
  console.error(`Refusing to run: dev-only script (NODE_ENV=${process.env.NODE_ENV ?? ''}, db host=${dbHost || 'unknown'}).`);
  process.exit(1);
}

const prisma = new PrismaClient();
const STOCK_PER_PRODUCT = 100;
const WAREHOUSE_CODE = process.env.WAREHOUSE_CODE ?? 'AMD-GOTA';

async function main() {
  const liveSkus = new Set(catalog.products.map((p) => p.sku));

  const extra = await prisma.product.findMany({ where: { sku: { notIn: [...liveSkus] }, status: { not: 'ARCHIVED' } }, select: { id: true, sku: true } });
  let deleted = 0;
  let archived = 0;
  for (const p of extra) {
    try {
      await prisma.product.delete({ where: { id: p.id } });
      deleted++;
    } catch {
      await prisma.product.update({ where: { id: p.id }, data: { status: 'ARCHIVED', isFeatured: false } });
      archived++;
    }
  }
  console.log(`Non-live products: deleted=${deleted} archived=${archived}`);

  const warehouse = await prisma.warehouse.findUnique({ where: { code: WAREHOUSE_CODE }, select: { id: true, name: true } });
  if (!warehouse) throw new Error(`Warehouse ${WAREHOUSE_CODE} not found. Create it in the admin or set WAREHOUSE_CODE.`);

  const products = await prisma.product.findMany({ where: { sku: { in: [...liveSkus] } }, select: { id: true } });
  if (products.length < liveSkus.size) console.warn(`Only ${products.length}/${liveSkus.size} live products exist locally. Run pnpm db:seed first.`);
  let stocked = 0;
  for (const p of products) {
    const existing = await prisma.inventory.findFirst({ where: { warehouseId: warehouse.id, productId: p.id, variantId: null }, select: { id: true } });
    if (existing) continue;
    await prisma.inventory.create({ data: { warehouseId: warehouse.id, productId: p.id, availableQuantity: STOCK_PER_PRODUCT } });
    stocked++;
  }
  console.log(`Stock: ${stocked} products given ${STOCK_PER_PRODUCT} units in ${warehouse.name} (${products.length - stocked} already had stock there).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
