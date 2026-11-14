import { prisma, Prisma } from '@20mart/database';
import { stockStateOf } from '@20mart/shared';
import { z } from 'zod';
import type { AdminContext } from './auth/admin';
import { audit } from './audit';
import { AppError, badRequest, conflict, notFound } from './errors';
import { notifyStorefront } from './revalidate';
import { idParam, pageQuery } from './catalog/common';

export const adjustInput = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('INITIAL_STOCK'),
    quantity: z.coerce.number().int().min(1).max(1_000_000),
    reason: z.string().trim().min(3).max(300),
    reference: z.string().trim().max(100).optional(),
  }),
  z.object({
    type: z.enum(['STOCK_IN', 'STOCK_OUT']),
    quantity: z.coerce.number().int().min(1).max(1_000_000),
    reason: z.string().trim().min(3).max(300),
    reference: z.string().trim().max(100).optional(),
  }),
  z.object({
    type: z.literal('ADJUSTMENT'),
    /** Absolute corrected on-hand quantity (e.g. after a physical count). */
    newQuantity: z.coerce.number().int().min(0).max(1_000_000),
    reason: z.string().trim().min(3).max(300),
    reference: z.string().trim().max(100).optional(),
  }),
]);
export type AdjustInput = z.infer<typeof adjustInput>;

export const thresholdInput = z.object({ lowStockThreshold: z.coerce.number().int().min(0).max(100_000) });

export const inventoryListQuery = pageQuery.extend({ stock: z.enum(['in', 'low', 'out']).optional() });

async function loadInventory(tx: Prisma.TransactionClient, inventoryId: string) {
  const inv = await tx.inventory.findUnique({
    where: { id: inventoryId },
    select: {
      id: true,
      variantId: true,
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
 * Apply an auditable stock change. Every path writes a StockMovement in the same
 * transaction. Increments/decrements are a single conditional UPDATE so that
 * concurrent requests can never drive stock below the reserved quantity (or 0);
 * Postgres serialises updates on the row and re-checks the WHERE clause.
 */
export async function adjustStock(actor: AdminContext, inventoryId: string, raw: unknown) {
  idParam.parse(inventoryId);
  const input = adjustInput.parse(raw);

  const result = await prisma.$transaction(async (tx) => {
    const inv = await loadInventory(tx, inventoryId);
    const label = inv.variant ? `${inv.product.sku} / ${inv.variant.sku}` : inv.product.sku;
    let previous: number;
    let next: number;
    let delta: number;

    if (input.type === 'STOCK_IN' || input.type === 'STOCK_OUT') {
      delta = input.type === 'STOCK_IN' ? input.quantity : -input.quantity;
      const rows = await tx.$queryRaw<{ availableQuantity: number }[]>`
        UPDATE "Inventory"
           SET "availableQuantity" = "availableQuantity" + ${delta}, "updatedAt" = now()
         WHERE "id" = ${inventoryId}
           AND "availableQuantity" + ${delta} >= "reservedQuantity"
        RETURNING "availableQuantity"`;
      if (rows.length === 0) throw new AppError(409, 'INSUFFICIENT_STOCK', 'Not enough stock to remove that quantity');
      next = rows[0].availableQuantity;
      previous = next - delta;
    } else {
      // Lock the row so the read-modify-write below cannot interleave with other updates.
      const locked = await tx.$queryRaw<{ availableQuantity: number; reservedQuantity: number }[]>`
        SELECT "availableQuantity", "reservedQuantity" FROM "Inventory" WHERE "id" = ${inventoryId} FOR UPDATE`;
      previous = locked[0].availableQuantity;
      if (input.type === 'INITIAL_STOCK') {
        const prior = await tx.stockMovement.count({ where: { inventoryId } });
        if (prior > 0) throw conflict('Initial stock was already recorded. Use Stock in or Correction instead.');
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
  }, { timeout: 20_000, maxWait: 20_000 });

  notifyStorefront(['/', '/shop', `/product/${result.slug}`]);
  return result.movement;
}

export async function setLowStockThreshold(actor: AdminContext, inventoryId: string, raw: unknown) {
  idParam.parse(inventoryId);
  const { lowStockThreshold } = thresholdInput.parse(raw);
  return prisma.$transaction(async (tx) => {
    const inv = await tx.inventory.update({
      where: { id: inventoryId },
      data: { lowStockThreshold },
      select: { id: true, lowStockThreshold: true, product: { select: { sku: true } } },
    });
    await audit(tx, actor, {
      action: 'Changed low-stock threshold',
      category: 'INVENTORY',
      entityType: 'Inventory',
      entityId: inventoryId,
      details: `${inv.product.sku}: threshold ${lowStockThreshold}`,
    });
    return inv;
  });
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

/** Stock rows that actually hold stock: variant rows, or the product row when there are no variants. */
export async function listInventory(query: z.infer<typeof inventoryListQuery>) {
  const q = query.q ? `%${escapeLike(query.q)}%` : null;
  const stock = query.stock ?? null;
  const skip = (query.page - 1) * query.pageSize;
  const rows = await prisma.$queryRaw<{ id: string; total: bigint }[]>`
    SELECT i."id", COUNT(*) OVER() AS total
      FROM "Inventory" i
      JOIN "Product" p ON p."id" = i."productId"
      LEFT JOIN "ProductVariant" v ON v."id" = i."variantId"
     WHERE p."status" <> 'ARCHIVED'
       AND (i."variantId" IS NOT NULL OR NOT EXISTS (SELECT 1 FROM "ProductVariant" pv WHERE pv."productId" = p."id"))
       AND (${q}::text IS NULL OR p."name" ILIKE ${q} OR p."sku" ILIKE ${q} OR v."sku" ILIKE ${q} OR v."name" ILIKE ${q})
       AND (${stock}::text IS NULL
            OR (${stock} = 'out' AND i."availableQuantity" - i."reservedQuantity" <= 0)
            OR (${stock} = 'low' AND i."availableQuantity" - i."reservedQuantity" > 0
                                  AND i."availableQuantity" - i."reservedQuantity" <= i."lowStockThreshold")
            OR (${stock} = 'in' AND i."availableQuantity" - i."reservedQuantity" > i."lowStockThreshold"))
     ORDER BY (i."availableQuantity" - i."reservedQuantity") ASC, p."name" ASC, v."sortOrder" ASC NULLS FIRST
     LIMIT ${query.pageSize} OFFSET ${skip}`;
  const total = rows.length ? Number(rows[0].total) : 0;
  const ids = rows.map((r) => r.id);
  const details = await prisma.inventory.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      availableQuantity: true,
      reservedQuantity: true,
      lowStockThreshold: true,
      updatedAt: true,
      product: {
        select: { id: true, name: true, sku: true, status: true, images: { where: { isPrimary: true }, take: 1, select: { url: true } } },
      },
      variant: { select: { id: true, name: true, sku: true, status: true } },
      _count: { select: { movements: true } },
    },
  });
  const byId = new Map(details.map((d) => [d.id, d]));
  const items = ids
    .map((id) => byId.get(id)!)
    .filter(Boolean)
    .map(({ product, ...d }) => ({
      ...d,
      product: { id: product.id, name: product.name, sku: product.sku, status: product.status, imageUrl: product.images[0]?.url ?? null },
      sellable: d.availableQuantity - d.reservedQuantity,
      state: stockStateOf(d.availableQuantity - d.reservedQuantity, d.lowStockThreshold),
    }));
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

/** Aggregate stock KPIs over stock-holding rows of non-archived products. */
export async function inventoryStats() {
  const [row] = await prisma.$queryRaw<{ units: bigint | null; low: bigint; out: bigint; rows: bigint }[]>`
    SELECT SUM(i."availableQuantity") AS units,
           COUNT(*) FILTER (WHERE i."availableQuantity" - i."reservedQuantity" > 0
                              AND i."availableQuantity" - i."reservedQuantity" <= i."lowStockThreshold") AS low,
           COUNT(*) FILTER (WHERE i."availableQuantity" - i."reservedQuantity" <= 0) AS out,
           COUNT(*) AS rows
      FROM "Inventory" i
      JOIN "Product" p ON p."id" = i."productId"
     WHERE p."status" <> 'ARCHIVED'
       AND (i."variantId" IS NOT NULL OR NOT EXISTS (SELECT 1 FROM "ProductVariant" pv WHERE pv."productId" = p."id"))`;
  return { totalUnits: Number(row?.units ?? 0), lowStock: Number(row?.low ?? 0), outOfStock: Number(row?.out ?? 0), stockRows: Number(row?.rows ?? 0) };
}
