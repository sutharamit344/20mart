import { prisma, Prisma } from '@20mart/database';
import { z } from 'zod';
import type { AdminContext } from './auth/admin';
import { audit } from './audit';
import { AppError, badRequest, conflict, notFound } from './errors';
import { idParam } from './catalog/common';
import { notifyStorefront } from './revalidate';
import { PINCODE_REGEX } from './settings';
import { istDayStart } from './fulfillment';

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const coord = (min: number, max: number) =>
  z.preprocess((v) => (v === '' || v === undefined ? null : v), z.coerce.number().min(min).max(max).nullable());

export const warehouseInput = z.object({
  name: z.string().trim().min(2).max(80),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-]{1,19}$/, 'Use 2–20 letters, digits or dashes'),
  type: z.enum(['WAREHOUSE', 'FULFILLMENT_CENTER', 'STORAGE', 'SUPPLIER_DISPATCH']).default('WAREHOUSE'),
  addressLine1: z.string().trim().min(3).max(200),
  addressLine2: optText(200),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  country: z.string().trim().length(2).toUpperCase().default('IN'),
  pinCode: z.string().trim().regex(PINCODE_REGEX, 'Enter a valid 6-digit PIN code'),
  latitude: coord(-90, 90),
  longitude: coord(-180, 180),
  contactName: optText(80),
  contactNumber: z
    .string()
    .trim()
    .regex(/^(\+91[\s-]?)?[6-9]\d{9}$|^0\d{2,4}[\s-]?\d{6,8}$/, 'Enter a valid phone number')
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
  dailyOrderCapacity: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.coerce.number().int().min(1).max(100_000).nullable()),
  notes: optText(500),
});

export const warehouseStatusInput = z.object({ status: z.enum(['SETUP', 'ACTIVE', 'PAUSED', 'INACTIVE']) });

export const mappingInput = z.object({
  zoneId: z.string().uuid('Select a delivery area'),
  priority: z.coerce.number().int().min(0).max(999).default(1),
  deliveryFeePaise: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.coerce.number().int().min(0).max(100_000).nullable()),
  estimateHours: z.preprocess((v) => (v === '' || v === undefined ? null : v), z.coerce.number().int().min(1).max(720).nullable()),
  cutoffTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM')
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
  isActive: z.boolean().default(true),
});

function mapUnique(e: unknown, what: string): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw conflict(`${what} already exists`);
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') throw notFound('Warehouse');
  throw e;
}

/** All warehouses with live stock and order counts. */
export async function listWarehouses() {
  const [warehouses, stock, openOrders] = await Promise.all([
    prisma.warehouse.findMany({
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: { deliveryZones: { include: { zone: { select: { id: true, name: true, isActive: true } } }, orderBy: { priority: 'asc' } } },
    }),
    prisma.$queryRaw<{ warehouseId: string; onHand: bigint; reserved: bigint; sellable: bigint; skus: bigint; out: bigint }[]>`
      SELECT i."warehouseId", SUM(i."availableQuantity") AS "onHand", SUM(i."reservedQuantity") AS reserved,
             SUM(GREATEST(i."availableQuantity" - i."reservedQuantity" - i."safetyStock", 0)) AS sellable,
             COUNT(*) AS skus,
             COUNT(*) FILTER (WHERE i."availableQuantity" - i."reservedQuantity" - i."safetyStock" <= 0) AS out
        FROM "Inventory" i JOIN "Product" p ON p."id" = i."productId" AND p."status" <> 'ARCHIVED'
       GROUP BY i."warehouseId"`,
    prisma.order.groupBy({
      by: ['fulfillmentWarehouseId'],
      where: { status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY'] } },
      _count: { _all: true },
    }),
  ]);
  const s = new Map(stock.map((r) => [r.warehouseId, r]));
  const o = new Map(openOrders.map((r) => [r.fulfillmentWarehouseId, r._count._all]));
  return warehouses.map((w) => {
    const st = s.get(w.id);
    return {
      ...w,
      latitude: w.latitude?.toString() ?? null,
      longitude: w.longitude?.toString() ?? null,
      stock: {
        onHand: Number(st?.onHand ?? 0),
        reserved: Number(st?.reserved ?? 0),
        sellable: Number(st?.sellable ?? 0),
        skus: Number(st?.skus ?? 0),
        outOfStock: Number(st?.out ?? 0),
      },
      openOrders: o.get(w.id) ?? 0,
    };
  });
}

export async function getWarehouse(id: string) {
  idParam.parse(id);
  const w = (await listWarehouses()).find((x) => x.id === id);
  if (!w) throw notFound('Warehouse');
  const today = await prisma.order.count({ where: { fulfillmentWarehouseId: id, createdAt: { gte: istDayStart() }, status: { notIn: ['CANCELLED', 'FAILED'] } } });
  return { ...w, ordersToday: today };
}

/** Simple list for selects (inventory filters, purchase orders). */
export async function warehouseOptions() {
  return prisma.warehouse.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, code: true, status: true } });
}

export async function saveWarehouse(actor: AdminContext, id: string | null, raw: unknown) {
  if (id) idParam.parse(id);
  const input = warehouseInput.parse(raw);
  try {
    const row = await prisma.$transaction(async (tx) => {
      const w = id ? await tx.warehouse.update({ where: { id }, data: input }) : await tx.warehouse.create({ data: input });
      await audit(tx, actor, {
        action: id ? 'Updated warehouse' : 'Created warehouse',
        category: 'WAREHOUSE',
        entityType: 'Warehouse',
        entityId: w.id,
        details: `${w.code} · ${w.name} · ${w.city} ${w.pinCode}`,
      });
      return w;
    });
    if (id) notifyStorefront(['/', '/shop']);
    return row;
  } catch (e) {
    mapUnique(e, 'A warehouse with this code');
  }
}

/**
 * Only verified locations may serve customers: activation requires a real address
 * (the migration placeholder uses PIN 000000 and cannot be activated until edited).
 */
export async function setWarehouseStatus(actor: AdminContext, id: string, raw: unknown) {
  idParam.parse(id);
  const { status } = warehouseStatusInput.parse(raw);
  const w = await prisma.warehouse.findUnique({ where: { id } });
  if (!w) throw notFound('Warehouse');
  if (w.status === status) return w;
  if (status === 'ACTIVE' && (!PINCODE_REGEX.test(w.pinCode) || /not configured/i.test(`${w.addressLine1} ${w.city} ${w.state}`))) {
    throw new AppError(409, 'WAREHOUSE_INCOMPLETE', 'Enter the real address and PIN code of this location before activating it');
  }
  const row = await prisma.$transaction(async (tx) => {
    const u = await tx.warehouse.update({ where: { id }, data: { status } });
    await audit(tx, actor, { action: 'Changed warehouse status', category: 'WAREHOUSE', entityType: 'Warehouse', entityId: id, details: `${w.code}: ${w.status} → ${status}` });
    return u;
  });
  notifyStorefront(['/', '/shop']);
  return row;
}

/* ─────────────────────── Warehouse ↔ delivery area mapping ─────────────────────── */

export async function saveMapping(actor: AdminContext, warehouseId: string, raw: unknown) {
  idParam.parse(warehouseId);
  const input = mappingInput.parse(raw);
  const [w, zone] = await Promise.all([
    prisma.warehouse.findUnique({ where: { id: warehouseId }, select: { code: true } }),
    prisma.deliveryZone.findUnique({ where: { id: input.zoneId }, select: { name: true } }),
  ]);
  if (!w) throw notFound('Warehouse');
  if (!zone) throw badRequest('Selected delivery area does not exist');
  const { zoneId, ...data } = input;
  const row = await prisma.$transaction(async (tx) => {
    const m = await tx.warehouseDeliveryZone.upsert({
      where: { warehouseId_zoneId: { warehouseId, zoneId } },
      update: data,
      create: { warehouseId, zoneId, ...data },
    });
    await audit(tx, actor, {
      action: 'Saved warehouse delivery area',
      category: 'WAREHOUSE',
      entityType: 'Warehouse',
      entityId: warehouseId,
      details: `${w.code} → ${zone.name}: priority ${m.priority}${m.isActive ? '' : ' (inactive)'}`,
    });
    return m;
  });
  notifyStorefront(['/']);
  return row;
}

export async function deleteMapping(actor: AdminContext, warehouseId: string, mappingId: string) {
  idParam.parse(warehouseId);
  idParam.parse(mappingId);
  const m = await prisma.warehouseDeliveryZone.findFirst({ where: { id: mappingId, warehouseId }, include: { zone: true, warehouse: true } });
  if (!m) throw notFound('Mapping');
  await prisma.$transaction(async (tx) => {
    await tx.warehouseDeliveryZone.delete({ where: { id: mappingId } });
    await audit(tx, actor, { action: 'Removed warehouse delivery area', category: 'WAREHOUSE', entityType: 'Warehouse', entityId: warehouseId, details: `${m.warehouse.code} ✕ ${m.zone.name}` });
  });
  return { ok: true };
}

/* ─────────────────────────────── Demand interest ─────────────────────────────── */

export const deliveryInterestInput = z.object({
  pincode: z.string().trim().regex(PINCODE_REGEX, 'Enter a valid 6-digit PIN code'),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(160),
  name: optText(80),
});

/** Record interest from an unserved PIN code. Creates no order, cart hold or reservation. */
export async function submitDeliveryInterest(raw: unknown, userId: string | null = null) {
  const input = deliveryInterestInput.parse(raw);
  await prisma.deliveryInterest.upsert({
    where: { pincode_email: { pincode: input.pincode, email: input.email } },
    update: { name: input.name ?? undefined, userId: userId ?? undefined },
    create: { ...input, userId },
  });
  return { ok: true };
}

export async function deliveryInterestSummary(limit = 50) {
  const rows = await prisma.deliveryInterest.groupBy({
    by: ['pincode'],
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: { _count: { pincode: 'desc' } },
    take: limit,
  });
  const total = await prisma.deliveryInterest.count();
  return { total, byPincode: rows.map((r) => ({ pincode: r.pincode, count: r._count._all, lastAt: r._max.createdAt })) };
}
