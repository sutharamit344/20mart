import { prisma, Prisma } from '@20mart/database';
import { z } from 'zod';
import type { AdminContext } from './auth/admin';
import { audit } from './audit';
import { onlinePaymentsAvailable } from './payments';
import { badRequest } from './errors';

const DEFAULT_ID = 'default';

/** Operational settings (singleton). Created with production-safe defaults if missing. */
export async function getStoreSettings() {
  return (
    (await prisma.storeSettings.findUnique({ where: { id: DEFAULT_ID } })) ??
    (await prisma.storeSettings.upsert({ where: { id: DEFAULT_ID }, update: {}, create: { id: DEFAULT_ID } }))
  );
}
export type StoreSettingsRow = Awaited<ReturnType<typeof getStoreSettings>>;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24h HH:MM');
const paise = z.coerce.number().int().min(0).max(10_000_000);

export const storeSettingsInput = z
  .object({
    deliveryEnabled: z.boolean(),
    codEnabled: z.boolean(),
    onlinePaymentEnabled: z.boolean(),
    deliveryFeePaise: paise,
    freeDeliveryThresholdPaise: paise,
    minOrderPaise: paise,
    defaultEstimateHours: z.coerce.number().int().min(1).max(24 * 14),
    operatingHoursStart: hhmm,
    operatingHoursEnd: hhmm,
    reservationMinutes: z.coerce.number().int().min(5).max(1440),
    maxQtyPerLine: z.coerce.number().int().min(1).max(100),
  })
  .partial();

export async function updateStoreSettings(actor: AdminContext, raw: unknown) {
  const input = storeSettingsInput.parse(raw);
  if (input.onlinePaymentEnabled && !onlinePaymentsAvailable()) {
    throw badRequest('Online payment cannot be enabled until Razorpay keys are configured on the server');
  }
  if (input.operatingHoursStart && input.operatingHoursEnd && input.operatingHoursStart >= input.operatingHoursEnd) {
    throw badRequest('Opening time must be before closing time');
  }
  await getStoreSettings();
  return prisma.$transaction(async (tx) => {
    const s = await tx.storeSettings.update({ where: { id: DEFAULT_ID }, data: { ...input, updatedById: actor.admin.id } });
    await audit(tx, actor, { action: 'Updated store settings', category: 'SETTINGS', entityType: 'StoreSettings', details: Object.keys(input).join(', ') });
    return s;
  });
}

/** Which payment methods a customer can actually use right now. */
export function enabledPaymentMethods(s: StoreSettingsRow) {
  const methods: ('ONLINE' | 'CASH_ON_DELIVERY')[] = [];
  if (s.onlinePaymentEnabled && onlinePaymentsAvailable()) methods.push('ONLINE');
  if (s.codEnabled) methods.push('CASH_ON_DELIVERY');
  return methods;
}

/* ─────────────────────────── Serviceable PIN codes ─────────────────────────── */

export const PINCODE_REGEX = /^[1-9]\d{5}$/;

export const pincodeInput = z.object({
  pincode: z.string().trim().regex(PINCODE_REGEX, 'Enter a valid 6-digit PIN code'),
  isServiceable: z.boolean().default(true),
  area: z.string().trim().max(80).optional().nullable(),
  city: z.string().trim().max(60).optional().nullable(),
  deliveryFeePaise: paise.optional().nullable(),
  estimateHours: z.coerce.number().int().min(1).max(24 * 14).optional().nullable(),
  /** Omitted = keep the current zone; null = remove from its zone. */
  zoneId: z.string().uuid().nullish(),
});
export const bulkPincodeInput = z.object({
  pincodes: z.array(z.string().trim()).min(1).max(500),
  isServiceable: z.boolean().default(true),
  city: z.string().trim().max(60).optional().nullable(),
  zoneId: z.string().uuid().nullish(),
});

async function assertZone(zoneId: string | null | undefined) {
  if (zoneId && !(await prisma.deliveryZone.count({ where: { id: zoneId } }))) throw badRequest('Selected delivery zone does not exist');
}

export async function listPincodes(params: { q?: string; page: number; pageSize: number; zoneId?: string }) {
  const where: Prisma.ServiceablePincodeWhereInput = {
    ...(params.q ? { OR: [{ pincode: { startsWith: params.q } }, { area: { contains: params.q, mode: 'insensitive' as const } }] } : {}),
    ...(params.zoneId ? { zoneId: params.zoneId } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.serviceablePincode.findMany({ where, orderBy: { pincode: 'asc' }, skip: (params.page - 1) * params.pageSize, take: params.pageSize, include: { zone: { select: { id: true, name: true } } } }),
    prisma.serviceablePincode.count({ where }),
  ]);
  return { items, total, page: params.page, pageSize: params.pageSize };
}

export async function upsertPincode(actor: AdminContext, raw: unknown) {
  const input = pincodeInput.parse(raw);
  await assertZone(input.zoneId);
  return prisma.$transaction(async (tx) => {
    const row = await tx.serviceablePincode.upsert({ where: { pincode: input.pincode }, update: input, create: input });
    await audit(tx, actor, { action: 'Updated delivery PIN code', category: 'SETTINGS', entityType: 'ServiceablePincode', entityId: row.id, details: `${row.pincode} serviceable=${row.isServiceable}` });
    return row;
  });
}

export async function bulkUpsertPincodes(actor: AdminContext, raw: unknown) {
  const input = bulkPincodeInput.parse(raw);
  const pins = [...new Set(input.pincodes)];
  const invalid = pins.filter((p) => !PINCODE_REGEX.test(p));
  if (invalid.length) throw badRequest(`Invalid PIN code(s): ${invalid.slice(0, 10).join(', ')}`);
  await assertZone(input.zoneId);
  const zone = input.zoneId !== undefined ? { zoneId: input.zoneId ?? null } : {};
  await prisma.$transaction(async (tx) => {
    for (const pincode of pins) {
      await tx.serviceablePincode.upsert({
        where: { pincode },
        update: { isServiceable: input.isServiceable, ...(input.city ? { city: input.city } : {}), ...zone },
        create: { pincode, isServiceable: input.isServiceable, city: input.city ?? null, ...zone },
      });
    }
    await audit(tx, actor, { action: 'Bulk updated delivery PIN codes', category: 'SETTINGS', details: `${pins.length} PINs serviceable=${input.isServiceable}` });
  });
  return { count: pins.length };
}

export async function deletePincode(actor: AdminContext, pincode: string) {
  if (!PINCODE_REGEX.test(pincode)) throw badRequest('Invalid PIN code');
  await prisma.$transaction(async (tx) => {
    await tx.serviceablePincode.delete({ where: { pincode } });
    await audit(tx, actor, { action: 'Removed delivery PIN code', category: 'SETTINGS', details: pincode });
  });
}

/* ─────────────────────────────── Delivery zones ─────────────────────────────── */

export const zoneInput = z.object({
  name: z.string().trim().min(2).max(60),
  isActive: z.boolean().default(true),
  deliveryFeePaise: paise.optional().nullable(),
  estimateHours: z.coerce.number().int().min(1).max(24 * 14).optional().nullable(),
  minOrderPaise: paise.optional().nullable(),
});

export async function listZones() {
  const zones = await prisma.deliveryZone.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { pincodes: true } } } });
  return zones.map(({ _count, ...z }) => ({ ...z, pincodeCount: _count.pincodes }));
}

export async function saveZone(actor: AdminContext, id: string | null, raw: unknown) {
  if (id) z.string().uuid().parse(id);
  const input = zoneInput.parse(raw);
  try {
    return await prisma.$transaction(async (tx) => {
      const row = id ? await tx.deliveryZone.update({ where: { id }, data: input }) : await tx.deliveryZone.create({ data: input });
      await audit(tx, actor, {
        action: id ? 'Updated delivery zone' : 'Created delivery zone',
        category: 'DELIVERY',
        entityType: 'DeliveryZone',
        entityId: row.id,
        details: `${row.name}: active=${row.isActive} fee=${row.deliveryFeePaise ?? 'default'} min=${row.minOrderPaise ?? 'default'} hours=${row.estimateHours ?? 'default'}`,
      });
      return row;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw badRequest('A zone with this name already exists');
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') throw badRequest('Zone not found');
    throw e;
  }
}

/** Deleting a zone keeps its PIN codes (they fall back to store defaults). */
export async function deleteZone(actor: AdminContext, id: string) {
  z.string().uuid().parse(id);
  await prisma.$transaction(async (tx) => {
    const row = await tx.deliveryZone.delete({ where: { id } });
    await audit(tx, actor, { action: 'Deleted delivery zone', category: 'DELIVERY', entityType: 'DeliveryZone', entityId: id, details: row.name });
  });
  return { deleted: true };
}
