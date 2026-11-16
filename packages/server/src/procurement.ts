import { randomInt } from 'node:crypto';
import { prisma, Prisma, type PurchaseOrderStatus } from '@20mart/database';
import { z } from 'zod';
import type { AdminContext } from './auth/admin';
import { audit } from './audit';
import { AppError, badRequest, conflict, notFound } from './errors';
import { idParam, pageQuery } from './catalog/common';
import { ensureInventoryRow, receiveIntoStock } from './inventory';
import { notifyStorefront } from './revalidate';
import { PINCODE_REGEX } from './settings';

type Tx = Prisma.TransactionClient;
const TX_OPTS = { timeout: 30_000, maxWait: 20_000 } as const;

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function docNumber(prefix: string) {
  const ymd = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  let r = '';
  for (let i = 0; i < 5; i++) r += CROCKFORD[randomInt(32)];
  return `${prefix}${ymd}-${r}`;
}

/* ─────────────────────────────── Suppliers ─────────────────────────────── */

export const supplierInput = z.object({
  name: z.string().trim().min(2).max(120),
  contactPerson: optText(80),
  phone: z
    .string()
    .trim()
    .regex(/^(\+91[\s-]?)?[6-9]\d{9}$|^0\d{2,4}[\s-]?\d{6,8}$/, 'Enter a valid phone number')
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
  email: z.string().trim().toLowerCase().email().max(160).optional().nullable().or(z.literal('').transform(() => null)),
  address: optText(300),
  city: optText(80),
  state: optText(80),
  pinCode: z.string().trim().regex(PINCODE_REGEX, 'Enter a valid 6-digit PIN code').optional().nullable().or(z.literal('').transform(() => null)),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Enter a valid 15-character GSTIN')
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  notes: optText(1000),
});

export const supplierListQuery = pageQuery.extend({ status: z.enum(['ACTIVE', 'INACTIVE']).optional().or(z.literal('').transform(() => undefined)) });

export async function listSuppliers(query: z.infer<typeof supplierListQuery>) {
  const where: Prisma.SupplierWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? { OR: [{ name: { contains: query.q, mode: 'insensitive' } }, { contactPerson: { contains: query.q, mode: 'insensitive' } }, { gstin: { contains: query.q, mode: 'insensitive' } }] }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      include: { _count: { select: { purchaseOrders: true } } },
    }),
    prisma.supplier.count({ where }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function supplierOptions() {
  return prisma.supplier.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' }, select: { id: true, name: true } });
}

export async function saveSupplier(actor: AdminContext, id: string | null, raw: unknown) {
  if (id) idParam.parse(id);
  const input = supplierInput.parse(raw);
  try {
    return await prisma.$transaction(async (tx) => {
      const s = id ? await tx.supplier.update({ where: { id }, data: input }) : await tx.supplier.create({ data: input });
      await audit(tx, actor, { action: id ? 'Updated supplier' : 'Created supplier', category: 'PROCUREMENT', entityType: 'Supplier', entityId: s.id, details: `${s.name} (${s.status})` });
      return s;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') throw notFound('Supplier');
    throw e;
  }
}

/* ─────────────────────────────── Purchase orders ─────────────────────────────── */

const poItemInput = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullish().transform((v) => v ?? null),
  quantity: z.coerce.number().int().min(1).max(1_000_000),
  unitCostPaise: z.coerce.number().int().min(0).max(100_000_000),
});

export const purchaseOrderInput = z.object({
  supplierId: z.string().uuid('Select a supplier'),
  warehouseId: z.string().uuid('Select the receiving warehouse'),
  expectedDate: z.preprocess((v) => (v === '' || v == null ? null : v), z.coerce.date().nullable()),
  notes: optText(1000),
  items: z.array(poItemInput).min(1, 'Add at least one product').max(200),
});

export const poListQuery = pageQuery.extend({
  status: z.enum(['DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED']).optional().or(z.literal('').transform(() => undefined)),
  supplierId: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
  warehouseId: z.string().uuid().optional().or(z.literal('').transform(() => undefined)),
});

async function validatePo(tx: Tx, input: z.infer<typeof purchaseOrderInput>) {
  const [supplier, warehouse] = await Promise.all([
    tx.supplier.findUnique({ where: { id: input.supplierId }, select: { status: true, name: true } }),
    tx.warehouse.findUnique({ where: { id: input.warehouseId }, select: { status: true, code: true } }),
  ]);
  if (!supplier) throw badRequest('Selected supplier does not exist');
  if (supplier.status !== 'ACTIVE') throw conflict('This supplier is inactive');
  if (!warehouse) throw badRequest('Selected warehouse does not exist');
  if (warehouse.status === 'INACTIVE') throw conflict('Goods cannot be received into an inactive warehouse');
  const seen = new Set<string>();
  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const products = await tx.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, status: true, variants: { select: { id: true } } },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const it of input.items) {
    const key = `${it.productId}:${it.variantId ?? ''}`;
    if (seen.has(key)) throw badRequest('Each product/variant can appear only once on a purchase order');
    seen.add(key);
    const p = byId.get(it.productId);
    if (!p || p.status === 'ARCHIVED') throw badRequest('A selected product does not exist or is archived');
    if (p.variants.length && !it.variantId) throw badRequest('Choose a variant for products that have variants');
    if (it.variantId && !p.variants.some((v) => v.id === it.variantId)) throw badRequest('Selected variant does not belong to the product');
  }
  return { supplier, warehouse };
}

const total = (items: { quantity: number; unitCostPaise: number }[]) => items.reduce((a, i) => a + i.quantity * i.unitCostPaise, 0);

export async function createPurchaseOrder(actor: AdminContext, raw: unknown) {
  const input = purchaseOrderInput.parse(raw);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const { supplier, warehouse } = await validatePo(tx, input);
        const po = await tx.purchaseOrder.create({
          data: {
            poNumber: docNumber('PO'),
            supplierId: input.supplierId,
            warehouseId: input.warehouseId,
            expectedDate: input.expectedDate,
            notes: input.notes,
            totalPaise: total(input.items),
            createdById: actor.admin.id,
            items: { create: input.items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantityOrdered: i.quantity, unitCostPaise: i.unitCostPaise })) },
          },
          select: { id: true, poNumber: true },
        });
        await audit(tx, actor, {
          action: 'Created purchase order',
          category: 'PROCUREMENT',
          entityType: 'PurchaseOrder',
          entityId: po.id,
          details: `${po.poNumber}: ${supplier.name} → ${warehouse.code}, ${input.items.length} line(s)`,
        });
        return po;
      }, TX_OPTS);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && String(e.meta?.target ?? '').includes('poNumber')) continue;
      throw e;
    }
  }
  throw new AppError(500, 'PO_FAILED', 'Could not create the purchase order. Please try again.');
}

/** Draft POs can be edited freely (lines replaced). */
export async function updatePurchaseOrder(actor: AdminContext, id: string, raw: unknown) {
  idParam.parse(id);
  const input = purchaseOrderInput.parse(raw);
  return prisma.$transaction(async (tx) => {
    const [po] = await tx.$queryRaw<{ status: PurchaseOrderStatus; poNumber: string }[]>`
      SELECT "status", "poNumber" FROM "PurchaseOrder" WHERE "id" = ${id} FOR UPDATE`;
    if (!po) throw notFound('Purchase order');
    if (po.status !== 'DRAFT') throw conflict('Only draft purchase orders can be edited');
    await validatePo(tx, input);
    await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
    const updated = await tx.purchaseOrder.update({
      where: { id },
      data: {
        supplierId: input.supplierId,
        warehouseId: input.warehouseId,
        expectedDate: input.expectedDate,
        notes: input.notes,
        totalPaise: total(input.items),
        items: { create: input.items.map((i) => ({ productId: i.productId, variantId: i.variantId, quantityOrdered: i.quantity, unitCostPaise: i.unitCostPaise })) },
      },
      select: { id: true, poNumber: true },
    });
    await audit(tx, actor, { action: 'Updated purchase order', category: 'PROCUREMENT', entityType: 'PurchaseOrder', entityId: id, details: `${po.poNumber}: ${input.items.length} line(s)` });
    return updated;
  }, TX_OPTS);
}

export const poStatusInput = z.object({ status: z.enum(['ORDERED', 'CANCELLED', 'CLOSED']), reason: optText(300) });

/** Allowed manual transitions. Receiving statuses are set only by goods receipts. */
const PO_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  DRAFT: ['ORDERED', 'CANCELLED'],
  ORDERED: ['CANCELLED', 'CLOSED'],
  PARTIALLY_RECEIVED: ['CLOSED'],
  RECEIVED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
};

/** Ordering a PO does NOT change inventory. Closing a partial PO short-closes the remaining quantity. */
export async function setPurchaseOrderStatus(actor: AdminContext, id: string, raw: unknown) {
  idParam.parse(id);
  const { status, reason } = poStatusInput.parse(raw);
  return prisma.$transaction(async (tx) => {
    const [po] = await tx.$queryRaw<{ status: PurchaseOrderStatus; poNumber: string }[]>`
      SELECT "status", "poNumber" FROM "PurchaseOrder" WHERE "id" = ${id} FOR UPDATE`;
    if (!po) throw notFound('Purchase order');
    if (!PO_TRANSITIONS[po.status].includes(status)) throw conflict(`A ${po.status.toLowerCase().replace('_', ' ')} purchase order cannot be marked ${status.toLowerCase()}`);
    if (status === 'CANCELLED' && (await tx.goodsReceipt.count({ where: { purchaseOrderId: id } }))) {
      throw conflict('Goods were already received against this purchase order. Close it instead.');
    }
    const updated = await tx.purchaseOrder.update({
      where: { id },
      data: { status, ...(status === 'ORDERED' ? { orderedAt: new Date() } : {}), ...(status === 'CLOSED' || status === 'CANCELLED' ? { closedAt: new Date() } : {}) },
      select: { id: true, status: true },
    });
    await audit(tx, actor, {
      action: 'Changed purchase order status',
      category: 'PROCUREMENT',
      entityType: 'PurchaseOrder',
      entityId: id,
      details: `${po.poNumber}: ${po.status} → ${status}${reason ? `. ${reason}` : ''}`,
    });
    return updated;
  });
}

export async function listPurchaseOrders(query: z.infer<typeof poListQuery>) {
  const where: Prisma.PurchaseOrderWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.supplierId ? { supplierId: query.supplierId } : {}),
    ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    ...(query.q ? { OR: [{ poNumber: { contains: query.q, mode: 'insensitive' } }, { supplier: { name: { contains: query.q, mode: 'insensitive' } } }] } : {}),
  };
  const [items, count] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        poNumber: true,
        status: true,
        totalPaise: true,
        expectedDate: true,
        createdAt: true,
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        items: { select: { quantityOrdered: true, quantityReceived: true, quantityRejected: true } },
      },
    }),
    prisma.purchaseOrder.count({ where }),
  ]);
  return {
    items: items.map(({ items: lines, ...po }) => ({
      ...po,
      lineCount: lines.length,
      ordered: lines.reduce((a, l) => a + l.quantityOrdered, 0),
      received: lines.reduce((a, l) => a + l.quantityReceived, 0),
      rejected: lines.reduce((a, l) => a + l.quantityRejected, 0),
    })),
    total: count,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getPurchaseOrder(id: string) {
  idParam.parse(id);
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true, phone: true, email: true, gstin: true } },
      warehouse: { select: { id: true, code: true, name: true, status: true } },
      createdBy: { select: { name: true } },
      items: {
        orderBy: { id: 'asc' },
        include: { product: { select: { name: true, sku: true } }, variant: { select: { name: true, sku: true } } },
      },
      receipts: {
        orderBy: { createdAt: 'desc' },
        include: { receivedBy: { select: { name: true } }, items: { include: { purchaseOrderItem: { select: { product: { select: { name: true } }, variant: { select: { name: true } } } } } } },
      },
    },
  });
  if (!po) throw notFound('Purchase order');
  return po;
}

/* ─────────────────────────────── Goods receiving ─────────────────────────────── */

export const goodsReceiptInput = z.object({
  idempotencyKey: z.string().uuid(),
  notes: optText(1000),
  items: z
    .array(
      z.object({
        purchaseOrderItemId: z.string().uuid(),
        quantityAccepted: z.coerce.number().int().min(0).max(1_000_000),
        quantityRejected: z.coerce.number().int().min(0).max(1_000_000).default(0),
        discrepancyNote: optText(300),
      })
    )
    .min(1)
    .max(200),
});

/**
 * Confirm physically received goods. Only accepted units enter stock (at the PO's warehouse),
 * each with a PURCHASE_RECEIPT movement. Rejected units are recorded as discrepancies and never
 * stocked. Partial receipts are supported; a repeated submit (same idempotency key) is applied once.
 */
export async function receiveGoods(actor: AdminContext, purchaseOrderId: string, raw: unknown) {
  idParam.parse(purchaseOrderId);
  const input = goodsReceiptInput.parse(raw);
  const lines = input.items.filter((i) => i.quantityAccepted + i.quantityRejected > 0);
  if (!lines.length) throw badRequest('Enter the quantity received for at least one product');
  if (new Set(lines.map((l) => l.purchaseOrderItemId)).size !== lines.length) throw badRequest('Each product can appear only once per receipt');
  for (const l of lines) if (l.quantityRejected > 0 && !l.discrepancyNote) throw badRequest('Describe why units were rejected (damaged, wrong item, …)');

  const result = await prisma.$transaction(async (tx) => {
    const [po] = await tx.$queryRaw<{ status: PurchaseOrderStatus; poNumber: string; warehouseId: string }[]>`
      SELECT "status", "poNumber", "warehouseId" FROM "PurchaseOrder" WHERE "id" = ${purchaseOrderId} FOR UPDATE`;
    if (!po) throw notFound('Purchase order');
    const dup = await tx.goodsReceipt.findUnique({ where: { idempotencyKey: input.idempotencyKey }, select: { id: true, receiptNumber: true, purchaseOrderId: true } });
    if (dup) {
      if (dup.purchaseOrderId !== purchaseOrderId) throw conflict('This receipt key was already used');
      return { receipt: dup, duplicate: true, slugs: [] as string[] };
    }
    if (po.status !== 'ORDERED' && po.status !== 'PARTIALLY_RECEIVED') {
      throw conflict(po.status === 'DRAFT' ? 'Mark the purchase order as ordered before receiving goods' : `Goods cannot be received on a ${po.status.toLowerCase().replace('_', ' ')} purchase order`);
    }
    const poItems = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId },
      select: { id: true, productId: true, variantId: true, quantityOrdered: true, quantityReceived: true, quantityRejected: true, product: { select: { slug: true, sku: true } } },
    });
    const byId = new Map(poItems.map((i) => [i.id, i]));
    for (const l of lines) {
      const it = byId.get(l.purchaseOrderItemId);
      if (!it) throw badRequest('A receipt line does not belong to this purchase order');
      const outstanding = it.quantityOrdered - it.quantityReceived - it.quantityRejected;
      if (l.quantityAccepted + l.quantityRejected > outstanding) {
        throw new AppError(409, 'RECEIPT_EXCEEDS_ORDER', `${it.product.sku}: only ${outstanding} unit(s) are outstanding on this purchase order`);
      }
    }
    const receipt = await tx.goodsReceipt.create({
      data: {
        receiptNumber: docNumber('GRN'),
        purchaseOrderId,
        idempotencyKey: input.idempotencyKey,
        receivedById: actor.admin.id,
        notes: input.notes,
        items: { create: lines.map((l) => ({ purchaseOrderItemId: l.purchaseOrderItemId, quantityAccepted: l.quantityAccepted, quantityRejected: l.quantityRejected, discrepancyNote: l.discrepancyNote })) },
      },
      select: { id: true, receiptNumber: true, purchaseOrderId: true },
    });
    // Fixed order (PO item id) keeps inventory row locks deadlock-free across concurrent receipts.
    for (const l of [...lines].sort((a, b) => a.purchaseOrderItemId.localeCompare(b.purchaseOrderItemId))) {
      const it = byId.get(l.purchaseOrderItemId)!;
      // Guarded increment: the CHECK constraint also blocks over-receipt under concurrency.
      await tx.purchaseOrderItem.update({
        where: { id: it.id },
        data: { quantityReceived: { increment: l.quantityAccepted }, quantityRejected: { increment: l.quantityRejected } },
      });
      if (l.quantityAccepted > 0) {
        const inventoryId = await ensureInventoryRow(tx, po.warehouseId, it.productId, it.variantId);
        await receiveIntoStock(tx, inventoryId, l.quantityAccepted, {
          type: 'PURCHASE_RECEIPT',
          reason: `Goods received ${receipt.receiptNumber} (PO ${po.poNumber})`,
          reference: receipt.receiptNumber,
          adminId: actor.admin.id,
        });
      }
    }
    const after = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId }, select: { quantityOrdered: true, quantityReceived: true, quantityRejected: true } });
    const complete = after.every((i) => i.quantityReceived + i.quantityRejected >= i.quantityOrdered);
    await tx.purchaseOrder.update({ where: { id: purchaseOrderId }, data: { status: complete ? 'RECEIVED' : 'PARTIALLY_RECEIVED' } });
    const accepted = lines.reduce((a, l) => a + l.quantityAccepted, 0);
    const rejected = lines.reduce((a, l) => a + l.quantityRejected, 0);
    await audit(tx, actor, {
      action: 'Received goods',
      category: 'PROCUREMENT',
      entityType: 'PurchaseOrder',
      entityId: purchaseOrderId,
      details: `${receipt.receiptNumber} for ${po.poNumber}: ${accepted} accepted, ${rejected} rejected${complete ? ' (fully received)' : ''}`,
    });
    return { receipt, duplicate: false, slugs: lines.map((l) => byId.get(l.purchaseOrderItemId)!.product.slug) };
  }, TX_OPTS);
  if (result.slugs.length) notifyStorefront(['/', '/shop', ...[...new Set(result.slugs)].map((s) => `/product/${s}`)]);
  return { ...result.receipt, duplicate: result.duplicate };
}

/** Procurement KPIs for the dashboard (counts only, never revenue). */
export async function procurementStats() {
  const [open, receipts30d, received30d] = await Promise.all([
    prisma.purchaseOrder.count({ where: { status: { in: ['ORDERED', 'PARTIALLY_RECEIVED'] } } }),
    prisma.goodsReceipt.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } }),
    prisma.goodsReceiptItem.aggregate({
      where: { goodsReceipt: { createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } },
      _sum: { quantityAccepted: true, quantityRejected: true },
    }),
  ]);
  return {
    openPurchaseOrders: open,
    receipts30d,
    unitsReceived30d: received30d._sum.quantityAccepted ?? 0,
    unitsRejected30d: received30d._sum.quantityRejected ?? 0,
  };
}
