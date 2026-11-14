import { prisma } from '@20mart/database';
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
});
export const bulkPincodeInput = z.object({
  pincodes: z.array(z.string().trim()).min(1).max(500),
  isServiceable: z.boolean().default(true),
  city: z.string().trim().max(60).optional().nullable(),
});

export async function listPincodes(params: { q?: string; page: number; pageSize: number }) {
  const where = params.q ? { OR: [{ pincode: { startsWith: params.q } }, { area: { contains: params.q, mode: 'insensitive' as const } }] } : {};
  const [items, total] = await Promise.all([
    prisma.serviceablePincode.findMany({ where, orderBy: { pincode: 'asc' }, skip: (params.page - 1) * params.pageSize, take: params.pageSize }),
    prisma.serviceablePincode.count({ where }),
  ]);
  return { items, total, page: params.page, pageSize: params.pageSize };
}

export async function upsertPincode(actor: AdminContext, raw: unknown) {
  const input = pincodeInput.parse(raw);
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
  await prisma.$transaction(async (tx) => {
    for (const pincode of pins) {
      await tx.serviceablePincode.upsert({
        where: { pincode },
        update: { isServiceable: input.isServiceable, ...(input.city ? { city: input.city } : {}) },
        create: { pincode, isServiceable: input.isServiceable, city: input.city ?? null },
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
