import { prisma, Prisma, type StockMovementType } from '@20mart/database';
import { stockStateOf } from '@20mart/shared';
import { z } from 'zod';
import type { AdminContext } from './auth/admin';
import { audit } from './audit';
import { countBy } from './counts';
import { AppError, badRequest, conflict, notFound } from './errors';
import { notifyStorefront } from './revalidate';
import { idParam, pageQuery } from './catalog/common';

type Tx = Prisma.TransactionClient;

const adjustFields = {
  reason: z.string().trim().min(3).max(300),
  reference: z.string().trim().max(100).optional(),
};
export const adjustInput = z.discriminatedUnion('type', [
  z.object({ type: z.literal('INITIAL_STOCK'), quantity: z.coerce.number().int().min(1).max(1_000_000), ...adjustFields }),
  z.object({ type: z.enum(['STOCK_IN', 'STOCK_OUT']), quantity: z.coerce.number().int().min(1).max(1_000_000), ...adjustFields }),
  z.object({
    type: z.literal('ADJUSTMENT'),
    /** Absolute corrected on-hand quantity (e.g. after a physical count). */
    newQuantity: z.coerce.number().int().min(0).max(1_000_000),
    ...adjustFields,
  }),
]);
export type AdjustInput = z.infer<typeof adjustInput>;

/** Target for stock that may not have a row yet at that warehouse. */
export const stockTargetInput = z.object({
  warehouseId: z.string().uuid('Select a warehouse'),
  productId: z.string().uuid('Select a product'),
  variantId: z.string().uuid().nullish().transform((v) => v ?? null),
});

export const thresholdInput = z
  .object({
    lowStockThreshold: z.coerce.number().int().min(0).max(100_000).optional(),
    safetyStock: z.coerce.number().int().min(0).max(100_000).optional(),
  })
  .refine((v) => v.lowStockThreshold !== undefined || v.safetyStock !== undefined, 'Nothing to change');

export const inventoryListQuery = pageQuery.extend({
  stock: z.enum(['in', 'low', 'out']).optional(),
  warehouseId: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
});

export const movementListQuery = pageQuery.extend({
  warehouseId: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
  type: z
    .enum(['INITIAL_STOCK', 'STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'RESERVATION', 'RELEASE', 'SALE', 'PURCHASE_RECEIPT'])
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

/**
 * Find or create the stock row for (warehouse, product[, variant]). Enforces the catalog rule:
 * products with variants hold stock per variant only; products without variants per product.
 */
export async function ensureInventoryRow(tx: Tx, warehouseId: string, productId: string, variantId: string | null) {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { id: true, _count: { select: { variants: true } }, variants: variantId ? { where: { id: variantId }, select: { id: true } } : false },
  });
  if (!product) throw notFound('Product');
  if (variantId && !product.variants?.length) throw notFound('Variant');
  if (!variantId && product._count.variants > 0) throw conflict('Stock for this product is tracked per variant. Choose a variant.');
  const wh = await tx.warehouse.findUnique({ where: { id: warehouseId }, select: { id: true } });
  if (!wh) throw notFound('Warehouse');
  if (variantId) {
    await tx.$executeRaw`
      INSERT INTO "Inventory" ("id", "warehouseId", "productId", "variantId", "updatedAt")
      VALUES (gen_random_uuid()::text, ${warehouseId}, ${productId}, ${variantId}, (now() AT TIME ZONE 'UTC'))
      ON CONFLICT ("warehouseId", "variantId") WHERE "variantId" IS NOT NULL DO NOTHING`;
  } else {
    await tx.$executeRaw`
      INSERT INTO "Inventory" ("id", "warehouseId", "productId", "variantId", "updatedAt")
      VALUES (gen_random_uuid()::text, ${warehouseId}, ${productId}, NULL, (now() AT TIME ZONE 'UTC'))
      ON CONFLICT ("warehouseId", "productId") WHERE "variantId" IS NULL DO NOTHING`;
  }
  const row = await tx.inventory.findFirst({ where: { warehouseId, productId, variantId }, select: { id: true } });
  return row!.id;
}

async function loadInventory(tx: Tx, inventoryId: string) {
  const inv = await tx.inventory.findUnique({
    where: { id: inventoryId },
    select: {
      id: true,
      variantId: true,
      warehouse: { select: { code: true } },
      product: { select: { id: true, sku: true, slug: true, name: true, _count: { select: { variants: true } } } },
      variant: { select: { sku: true, name: true } },
    },
  });
  if (!inv) throw notFound('Inventory record');
  if (!inv.variantId && inv.product._count.variants > 0) {
    throw conflict('Stock for this product is tracked per variant. Adjust a variant instead.');
  }
  return inv;
}

/**
 * Increase on-hand stock inside an existing transaction (goods receipts, restocks) with its movement.
 * Never use this to decrease stock.
 */
export async function receiveIntoStock(
  tx: Tx,
  inventoryId: string,
  quantity: number,
  movement: { type: StockMovementType; reason: string; reference?: string | null; adminId?: string | null }
) {
  if (quantity <= 0) throw badRequest('Quantity must be positive');
  const rows = await tx.$queryRaw<{ availableQuantity: number }[]>`
    UPDATE "Inventory" SET "availableQuantity" = "availableQuantity" + ${quantity}, "updatedAt" = (now() AT TIME ZONE 'UTC')
     WHERE "id" = ${inventoryId}
    RETURNING "availableQuantity"`;
  if (!rows.length) throw notFound('Inventory record');
  await tx.stockMovement.create({
    data: {
      inventoryId,
      movementType: movement.type,
      quantity,
      previousQuantity: rows[0].availableQuantity - quantity,
      newQuantity: rows[0].availableQuantity,
      reason: movement.reason,
      reference: movement.reference ?? null,
      performedByAdminId: movement.adminId ?? null,
    },
  });
}

async function applyAdjustment(tx: Tx, actor: AdminContext, inventoryId: string, input: AdjustInput) {
  const inv = await loadInventory(tx, inventoryId);
  const label = `${inv.warehouse.code}: ${inv.variant ? `${inv.product.sku} / ${inv.variant.sku}` : inv.product.sku}`;
  let previous: number;
  let next: number;
  let delta: number;

  if (input.type === 'STOCK_IN' || input.type === 'STOCK_OUT') {
    delta = input.type === 'STOCK_IN' ? input.quantity : -input.quantity;
    // Single conditional UPDATE: concurrent requests can never drive stock below reserved (or 0).
    const rows = await tx.$queryRaw<{ availableQuantity: number }[]>`
      UPDATE "Inventory"
         SET "availableQuantity" = "availableQuantity" + ${delta}, "updatedAt" = (now() AT TIME ZONE 'UTC')
       WHERE "id" = ${inventoryId}
         AND "availableQuantity" + ${delta} >= "reservedQuantity"
      RETURNING "availableQuantity"`;
    if (rows.length === 0) throw new AppError(409, 'INSUFFICIENT_STOCK', 'Not enough unreserved stock to remove that quantity');
    next = rows[0].availableQuantity;
    previous = next - delta;
  } else {
    // Lock the row so the read-modify-write below cannot interleave with other updates.
    const locked = await tx.$queryRaw<{ availableQuantity: number; reservedQuantity: number }[]>`
      SELECT "availableQuantity", "reservedQuantity" FROM "Inventory" WHERE "id" = ${inventoryId} FOR UPDATE`;
    previous = locked[0].availableQuantity;
    if (input.type === 'INITIAL_STOCK') {
      const prior = await tx.stockMovement.count({ where: { inventoryId } });
      if (prior > 0) throw conflict('Initial stock was already recorded here. Use Stock in or Correction instead.');
      next = previous + input.quantity;
    } else if (input.type === 'ADJUSTMENT') {
      if (input.newQuantity < locked[0].reservedQuantity) {
        throw new AppError(409, 'INSUFFICIENT_STOCK', `Cannot go below ${locked[0].reservedQuantity} reserved unit(s)`);
      }
      if (input.newQuantity === previous) throw badRequest('Quantity is unchanged');
      next = input.newQuantity;
    } else {
      throw badRequest('Unsupported movement type');
    }
    delta = next - previous;
    await tx.inventory.update({ where: { id: inventoryId }, data: { availableQuantity: next } });
  }

  const movement = await tx.stockMovement.create({
    data: {
      inventoryId,
      movementType: input.type,
      quantity: delta,
      previousQuantity: previous,
      newQuantity: next,
      reason: input.reason,
      reference: input.reference || null,
      performedByAdminId: actor.admin.id,
    },
    select: { id: true, movementType: true, quantity: true, previousQuantity: true, newQuantity: true, createdAt: true },
  });
  await audit(tx, actor, {
    action: 'Adjusted stock',
    category: 'INVENTORY',
    entityType: 'Inventory',
    entityId: inventoryId,
    details: `${label}: ${input.type} ${delta > 0 ? '+' : ''}${delta} (${previous} → ${next}). ${input.reason}`,
  });
  return { movement, slug: inv.product.slug };
}

/** Auditable stock change on an existing stock row. */
export async function adjustStock(actor: AdminContext, inventoryId: string, raw: unknown) {
  idParam.parse(inventoryId);
  const input = adjustInput.parse(raw);
  const result = await prisma.$transaction((tx) => applyAdjustment(tx, actor, inventoryId, input), { timeout: 20_000, maxWait: 20_000 });
  notifyStorefront(['/', '/shop', `/product/${result.slug}`]);
  return result.movement;
}

/** Auditable stock change at a warehouse, creating the stock row on first use. */
export async function adjustStockAt(actor: AdminContext, raw: unknown) {
  const target = stockTargetInput.parse(raw);
  const input = adjustInput.parse(raw);
  const result = await prisma.$transaction(
    async (tx) => {
      const inventoryId = await ensureInventoryRow(tx, target.warehouseId, target.productId, target.variantId);
      return applyAdjustment(tx, actor, inventoryId, input);
    },
    { timeout: 20_000, maxWait: 20_000 }
  );
  notifyStorefront(['/', '/shop', `/product/${result.slug}`]);
  return result.movement;
}

export async function setLowStockThreshold(actor: AdminContext, inventoryId: string, raw: unknown) {
  idParam.parse(inventoryId);
  const input = thresholdInput.parse(raw);
  const result = await prisma.$transaction(async (tx) => {
    const inv = await tx.inventory.update({
      where: { id: inventoryId },
      data: input,
      select: { id: true, lowStockThreshold: true, safetyStock: true, product: { select: { sku: true, slug: true } }, warehouse: { select: { code: true } } },
    });
    await audit(tx, actor, {
      action: 'Changed stock levels',
      category: 'INVENTORY',
      entityType: 'Inventory',
      entityId: inventoryId,
      details: `${inv.warehouse.code}: ${inv.product.sku}: low-stock threshold ${inv.lowStockThreshold}, safety stock ${inv.safetyStock}`,
    });
    return inv;
  });
  if (input.safetyStock !== undefined) notifyStorefront(['/', '/shop', `/product/${result.product.slug}`]);
  return result;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);
const SELLABLE = Prisma.sql`GREATEST(i."availableQuantity" - i."reservedQuantity" - i."safetyStock", 0)`;
/** Stock rows that actually hold stock: variant rows, or the product row when there are no variants. */
const STOCK_HOLDING = Prisma.sql`(i."variantId" IS NOT NULL OR NOT EXISTS (SELECT 1 FROM "ProductVariant" pv WHERE pv."productId" = p."id"))`;

export async function listInventory(query: z.infer<typeof inventoryListQuery>) {
  const q = query.q ? `%${escapeLike(query.q)}%` : null;
  const stock = query.stock ?? null;
  const wh = query.warehouseId ?? null;
  const skip = (query.page - 1) * query.pageSize;
  const rows = await prisma.$queryRaw<{ id: string; total: bigint }[]>`
    SELECT i."id", COUNT(*) OVER() AS total
      FROM "Inventory" i
      JOIN "Product" p ON p."id" = i."productId"
      JOIN "Warehouse" w ON w."id" = i."warehouseId"
      LEFT JOIN "ProductVariant" v ON v."id" = i."variantId"
     WHERE p."status" <> 'ARCHIVED'
       AND ${STOCK_HOLDING}
       AND (${wh}::text IS NULL OR i."warehouseId" = ${wh})
       AND (${q}::text IS NULL OR p."name" ILIKE ${q} OR p."sku" ILIKE ${q} OR v."sku" ILIKE ${q} OR v."name" ILIKE ${q})
       AND (${stock}::text IS NULL
            OR (${stock} = 'out' AND ${SELLABLE} <= 0)
            OR (${stock} = 'low' AND ${SELLABLE} > 0 AND ${SELLABLE} <= i."lowStockThreshold")
            OR (${stock} = 'in' AND ${SELLABLE} > i."lowStockThreshold"))
     ORDER BY ${SELLABLE} ASC, p."name" ASC, v."sortOrder" ASC NULLS FIRST, w."code" ASC
     LIMIT ${query.pageSize} OFFSET ${skip}`;
  const total = rows.length ? Number(rows[0].total) : 0;
  const ids = rows.map((r) => r.id);
  const details = await prisma.inventory.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      availableQuantity: true,
      reservedQuantity: true,
      safetyStock: true,
      lowStockThreshold: true,
      updatedAt: true,
      warehouse: { select: { id: true, name: true, code: true, status: true } },
      product: {
        select: { id: true, name: true, sku: true, status: true, images: { where: { isPrimary: true }, take: 1, select: { url: true } } },
      },
      variant: { select: { id: true, name: true, sku: true, status: true } },
    },
  });
  // Movement counts for this page only (StockMovement is the fastest-growing table).
  const movementCounts = await countBy(
    ids.length ? prisma.stockMovement.groupBy({ by: ['inventoryId'], where: { inventoryId: { in: ids } }, _count: { _all: true } }) : [],
    (g) => g.inventoryId
  );
  const byId = new Map(details.map((d) => [d.id, { ...d, _count: { movements: movementCounts.get(d.id) ?? 0 } }]));
  const items = ids
    .map((id) => byId.get(id)!)
    .filter(Boolean)
    .map(({ product, ...d }) => {
      const sellable = Math.max(0, d.availableQuantity - d.reservedQuantity - d.safetyStock);
      return {
        ...d,
        product: { id: product.id, name: product.name, sku: product.sku, status: product.status, imageUrl: product.images[0]?.url ?? null },
        sellable,
        state: stockStateOf(sellable, d.lowStockThreshold),
      };
    });
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function getStockHistory(inventoryId: string, page = 1, pageSize = 20) {
  idParam.parse(inventoryId);
  const [items, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where: { inventoryId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        movementType: true,
        quantity: true,
        previousQuantity: true,
        newQuantity: true,
        reason: true,
        reference: true,
        createdAt: true,
        performedBy: { select: { name: true, username: true } },
      },
    }),
    prisma.stockMovement.count({ where: { inventoryId } }),
  ]);
  return { items, total, page, pageSize };
}

/** Movement ledger across products (optionally one warehouse / one movement type). */
export async function listMovements(query: z.infer<typeof movementListQuery>) {
  const where: Prisma.StockMovementWhereInput = {
    ...(query.warehouseId ? { inventory: { warehouseId: query.warehouseId } } : {}),
    ...(query.type ? { movementType: query.type } : {}),
    ...(query.q
      ? {
          OR: [
            { reference: { contains: query.q, mode: 'insensitive' } },
            { inventory: { product: { name: { contains: query.q, mode: 'insensitive' } } } },
            { inventory: { product: { sku: { contains: query.q, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        movementType: true,
        quantity: true,
        previousQuantity: true,
        newQuantity: true,
        reason: true,
        reference: true,
        createdAt: true,
        performedBy: { select: { name: true } },
        inventory: {
          select: {
            warehouse: { select: { code: true, name: true } },
            product: { select: { name: true, sku: true } },
            variant: { select: { name: true, sku: true } },
          },
        },
      },
    }),
    prisma.stockMovement.count({ where }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

/** Aggregate stock KPIs over stock-holding rows of non-archived products (one warehouse or all). */
export async function inventoryStats(warehouseId?: string | null) {
  const wh = warehouseId ?? null;
  const [row] = await prisma.$queryRaw<
    { units: bigint | null; reserved: bigint | null; sellable: bigint | null; low: bigint; out: bigint; rows: bigint }[]
  >`
    SELECT SUM(i."availableQuantity") AS units,
           SUM(i."reservedQuantity") AS reserved,
           SUM(${SELLABLE}) AS sellable,
           COUNT(*) FILTER (WHERE ${SELLABLE} > 0 AND ${SELLABLE} <= i."lowStockThreshold") AS low,
           COUNT(*) FILTER (WHERE ${SELLABLE} <= 0) AS out,
           COUNT(*) AS rows
      FROM "Inventory" i
      JOIN "Product" p ON p."id" = i."productId"
     WHERE p."status" <> 'ARCHIVED'
       AND ${STOCK_HOLDING}
       AND (${wh}::text IS NULL OR i."warehouseId" = ${wh})`;
  return {
    totalUnits: Number(row?.units ?? 0),
    reservedUnits: Number(row?.reserved ?? 0),
    sellableUnits: Number(row?.sellable ?? 0),
    lowStock: Number(row?.low ?? 0),
    outOfStock: Number(row?.out ?? 0),
    stockRows: Number(row?.rows ?? 0),
  };
}
