import { prisma } from '@20mart/database';
import { z } from 'zod';
import { AppError, notFound } from './errors';
import { PINCODE_REGEX } from './settings';

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
] as const;

export const MAX_ADDRESSES = 10;

const opt = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);

export const addressInput = z.object({
  name: z.string().trim().min(2, 'Enter the recipient’s full name').max(80),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=[6-9]\d{9}$)/, ''))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number')),
  addressLine1: z.string().trim().min(5, 'Enter house / flat and street').max(120),
  addressLine2: opt(120),
  landmark: opt(80),
  city: z.string().trim().min(2, 'Enter a city').max(60),
  state: z.enum(INDIAN_STATES, { errorMap: () => ({ message: 'Select a state' }) }),
  pincode: z.string().trim().regex(PINCODE_REGEX, 'Enter a valid 6-digit PIN code'),
  country: z.literal('IN').default('IN'),
  type: z.enum(['Home', 'Work', 'Other']).default('Home'),
  isDefault: z.boolean().optional(),
});
export type AddressInput = z.infer<typeof addressInput>;

const addressSelect = {
  id: true,
  name: true,
  phone: true,
  addressLine1: true,
  addressLine2: true,
  landmark: true,
  city: true,
  state: true,
  pincode: true,
  country: true,
  type: true,
  isDefault: true,
} as const;

export const listAddresses = (userId: string) =>
  prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }], select: addressSelect });

/** Fetch an address only if it belongs to the user. */
export async function getOwnAddress(userId: string, id: string) {
  z.string().uuid().parse(id);
  const a = await prisma.address.findFirst({ where: { id, userId }, select: addressSelect });
  if (!a) throw notFound('Address');
  return a;
}

export async function createAddress(userId: string, raw: unknown) {
  const input = addressInput.parse(raw);
  const count = await prisma.address.count({ where: { userId } });
  if (count >= MAX_ADDRESSES) throw new AppError(409, 'ADDRESS_LIMIT', `You can save up to ${MAX_ADDRESSES} addresses`);
  const makeDefault = input.isDefault || count === 0;
  return prisma.$transaction(async (tx) => {
    if (makeDefault) await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    return tx.address.create({ data: { ...input, userId, isDefault: makeDefault }, select: addressSelect });
  });
}

export async function updateAddress(userId: string, id: string, raw: unknown) {
  await getOwnAddress(userId, id);
  const input = addressInput.parse(raw);
  return prisma.$transaction(async (tx) => {
    if (input.isDefault) await tx.address.updateMany({ where: { userId, isDefault: true, id: { not: id } }, data: { isDefault: false } });
    return tx.address.update({ where: { id }, data: { ...input, isDefault: input.isDefault ?? undefined }, select: addressSelect });
  });
}

export async function setDefaultAddress(userId: string, id: string) {
  await getOwnAddress(userId, id);
  await prisma.$transaction([
    prisma.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } }),
    prisma.address.update({ where: { id }, data: { isDefault: true } }),
  ]);
}

/** Orders keep their own address snapshot, so deleting a saved address never alters order history. */
export async function deleteAddress(userId: string, id: string) {
  const a = await getOwnAddress(userId, id);
  await prisma.$transaction(async (tx) => {
    await tx.address.delete({ where: { id } });
    if (a.isDefault) {
      const next = await tx.address.findFirst({ where: { userId }, orderBy: { updatedAt: 'desc' }, select: { id: true } });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
}

export const profileInput = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=[6-9]\d{9}$)/, ''))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'))
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export async function getProfile(userId: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true, createdAt: true, profile: { select: { phone: true } } },
  });
}

export async function updateProfile(userId: string, raw: unknown) {
  const input = profileInput.parse(raw);
  await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      profile: { upsert: { create: { phone: input.phone ?? null }, update: { phone: input.phone ?? null } } },
    },
  });
  return getProfile(userId);
}
