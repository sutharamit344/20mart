import { prisma, Prisma } from '@20mart/database';
import { z } from 'zod';
import type { AdminContext } from './auth/admin';
import { audit } from './audit';
import { findCartId, loadCartLines, summariseCart } from './cart';
import { COUPON_CODE_RE, couponIsLive, evaluateCoupon, findCouponByCode, normaliseCode } from './coupon-engine';
import { AppError, conflict, notFound } from './errors';
import { notifyCouponIssued } from './notifications';

/* ───────────────────────────── Customer: apply / remove ───────────────────────────── */

export const applyCouponInput = z.object({ code: z.string().trim().min(1, 'Enter a coupon code').max(40) });

/** Validate a code against the customer's live cart; only a valid coupon is stored on the cart. */
export async function applyCouponToCart(userId: string, raw: unknown) {
  const { code } = applyCouponInput.parse(raw);
  const cartId = await findCartId({ userId });
  if (!cartId) throw new AppError(409, 'COUPON_INVALID', 'Add items to your cart to use this coupon');
  const lines = await loadCartLines(cartId);
  const ev = await evaluateCoupon(await findCouponByCode(code), userId, lines);
  if (!ev.ok) throw new AppError(409, 'COUPON_INVALID', ev.message, { reason: ev.reason });
  await prisma.cart.update({ where: { id: cartId }, data: { couponCode: ev.coupon.code } });
  return summariseCart(cartId);
}

export async function removeCouponFromCart(userId: string) {
  const cartId = await findCartId({ userId });
  if (!cartId) return null;
  await prisma.cart.update({ where: { id: cartId }, data: { couponCode: null } });
  return summariseCart(cartId);
}

/* ───────────────────────────── Grants (distribution) ───────────────────────────── */

/** Issue a coupon to a customer once. Returns true only when a new grant was created. */
export async function grantCoupon(couponId: string, userId: string, source: 'WELCOME' | 'CAMPAIGN' | 'MANUAL', campaignId: string | null = null, db: Prisma.TransactionClient | typeof prisma = prisma) {
  const r = await db.couponGrant.createMany({ data: [{ couponId, userId, source, campaignId }], skipDuplicates: true });
  return r.count === 1;
}

/** On first sign-in: issue every live auto-issue coupon (e.g. the welcome coupon configured in admin). */
export async function issueSignupCoupons(userId: string) {
  const now = new Date();
  const coupons = await prisma.coupon.findMany({
    where: { autoIssueOnSignup: true, isActive: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    select: { id: true, code: true, title: true, endsAt: true, minOrderValuePaise: true },
  });
  for (const c of coupons) {
    if (await grantCoupon(c.id, userId, 'WELCOME')) await notifyCouponIssued(userId, c);
  }
  return coupons.length;
}

/** "My coupons": issued coupons with their real state + public live coupons. */
export async function listCustomerCoupons(userId: string) {
  const now = new Date();
  const [grants, used, publicCoupons] = await Promise.all([
    prisma.couponGrant.findMany({
      where: { userId },
      orderBy: { issuedAt: 'desc' },
      select: { issuedAt: true, source: true, coupon: { select: { id: true, code: true, title: true, description: true, discountType: true, discountValue: true, maxDiscountPaise: true, minOrderValuePaise: true, startsAt: true, endsAt: true, isActive: true, perCustomerLimit: true, usageLimit: true, usedCount: true } } },
    }),
    prisma.couponRedemption.groupBy({ by: ['couponId'], where: { userId, status: 'APPLIED' }, _count: { _all: true } }),
    prisma.coupon.findMany({
      where: { requiresGrant: false, isActive: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, code: true, title: true, description: true, discountType: true, discountValue: true, maxDiscountPaise: true, minOrderValuePaise: true, startsAt: true, endsAt: true, isActive: true, perCustomerLimit: true, usageLimit: true, usedCount: true },
    }),
  ]);
  const usedBy = new Map(used.map((u) => [u.couponId, u._count._all]));
  const state = (c: (typeof publicCoupons)[number]) => {
    const n = usedBy.get(c.id) ?? 0;
    if (n >= c.perCustomerLimit) return 'USED' as const;
    if (c.endsAt && c.endsAt <= now) return 'EXPIRED' as const;
    if (!c.isActive || (c.usageLimit != null && c.usedCount >= c.usageLimit)) return 'UNAVAILABLE' as const;
    if (c.startsAt > now) return 'UPCOMING' as const;
    return 'AVAILABLE' as const;
  };
  const strip = ({ usedCount: _u, usageLimit: _l, ...c }: (typeof publicCoupons)[number]) => c;
  const seen = new Set<string>();
  const items = [
    ...grants.map((g) => (seen.add(g.coupon.id), { ...strip(g.coupon), issued: true, issuedAt: g.issuedAt, state: state(g.coupon) })),
    ...publicCoupons.filter((c) => !seen.has(c.id)).map((c) => ({ ...strip(c), issued: false, issuedAt: null, state: state(c) })),
  ];
  return { items };
}

/* ───────────────────────────────── Admin ───────────────────────────────── */

const dateish = z
  .union([z.string().trim(), z.date(), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (v == null || v === '') return null;
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Invalid date' });
      return z.NEVER;
    }
    return d;
  });

const couponBase = z.object({
  code: z
    .string()
    .trim()
    .transform(normaliseCode)
    .refine((c) => COUPON_CODE_RE.test(c), '3–32 characters: letters, numbers, - or _'),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(500).nullish().transform((v) => v || null),
  discountType: z.enum(['FIXED', 'PERCENT']),
  /** FIXED: paise. PERCENT: basis points (1000 = 10%). */
  discountValue: z.coerce.number().int().positive(),
  maxDiscountPaise: z.coerce.number().int().positive().nullish().transform((v) => v ?? null),
  minOrderValuePaise: z.coerce.number().int().min(0).default(0),
  startsAt: dateish,
  endsAt: dateish,
  isActive: z.boolean().default(false),
  usageLimit: z.coerce.number().int().positive().nullish().transform((v) => v ?? null),
  perCustomerLimit: z.coerce.number().int().min(1).max(100).default(1),
  requiresGrant: z.boolean().default(false),
  autoIssueOnSignup: z.boolean().default(false),
  productIds: z.array(z.string().uuid()).max(500).default([]),
  categoryIds: z.array(z.string().uuid()).max(50).default([]),
});

const refineCoupon = <T extends z.ZodTypeAny>(s: T) =>
  s.superRefine((v: z.infer<typeof couponBase>, ctx) => {
    if (v.discountType === 'PERCENT' && v.discountValue > 10_000) ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'Percentage cannot exceed 100%' });
    if (v.discountType === 'FIXED' && v.maxDiscountPaise != null) ctx.addIssue({ code: 'custom', path: ['maxDiscountPaise'], message: 'Maximum discount applies to percentage coupons only' });
    if (v.startsAt && v.endsAt && v.endsAt <= v.startsAt) ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'End must be after start' });
    if (v.autoIssueOnSignup && !v.requiresGrant) ctx.addIssue({ code: 'custom', path: ['autoIssueOnSignup'], message: 'Auto-issued coupons must be "issued customers only"' });
  });

export const couponInput = refineCoupon(couponBase);

export const couponListQuery = z.object({
  q: z.string().trim().max(60).optional(),
  status: z.enum(['live', 'scheduled', 'expired', 'inactive']).optional().catch(undefined),
  page: z.coerce.number().int().min(1).default(1).catch(1),
});

export async function listCoupons(raw: unknown) {
  const q = couponListQuery.parse(raw);
  const now = new Date();
  const pageSize = 25;
  const statusWhere: Prisma.CouponWhereInput =
    q.status === 'live'
      ? { isActive: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }
      : q.status === 'scheduled'
        ? { isActive: true, startsAt: { gt: now } }
        : q.status === 'expired'
          ? { endsAt: { lte: now } }
          : q.status === 'inactive'
            ? { isActive: false }
            : {};
  const where: Prisma.CouponWhereInput = {
    ...statusWhere,
    ...(q.q ? { AND: [{ OR: [{ code: { contains: q.q.toUpperCase() } }, { title: { contains: q.q, mode: 'insensitive' } }] }] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, code: true, title: true, discountType: true, discountValue: true, maxDiscountPaise: true, minOrderValuePaise: true,
        startsAt: true, endsAt: true, isActive: true, usageLimit: true, usedCount: true, perCustomerLimit: true, requiresGrant: true, autoIssueOnSignup: true,
        _count: { select: { grants: true, products: true, categories: true } },
      },
    }),
    prisma.coupon.count({ where }),
  ]);
  const discounts = rows.length
    ? await prisma.couponRedemption.groupBy({ by: ['couponId'], where: { couponId: { in: rows.map((r) => r.id) }, status: 'APPLIED' }, _sum: { discountPaise: true } })
    : [];
  const sumBy = new Map(discounts.map((d) => [d.couponId, d._sum.discountPaise ?? 0]));
  return {
    items: rows.map((r) => ({ ...r, live: couponIsLive(r, now), issuedCount: r._count.grants, redeemedCount: r.usedCount, discountGivenPaise: sumBy.get(r.id) ?? 0 })),
    total,
    page: q.page,
    pageSize,
  };
}

export async function getCoupon(id: string) {
  z.string().uuid().parse(id);
  const c = await prisma.coupon.findUnique({
    where: { id },
    include: {
      products: { select: { product: { select: { id: true, name: true, sku: true } } } },
      categories: { select: { category: { select: { id: true, name: true } } } },
      campaigns: { select: { id: true, name: true, slug: true } },
      _count: { select: { grants: true } },
    },
  });
  if (!c) throw notFound('Coupon');
  const [redemptions, applied, reversed] = await Promise.all([
    prisma.couponRedemption.findMany({
      where: { couponId: id },
      orderBy: { redeemedAt: 'desc' },
      take: 50,
      select: { id: true, discountPaise: true, status: true, redeemedAt: true, reversedAt: true, order: { select: { id: true, orderNumber: true, totalPaise: true, status: true } }, user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.couponRedemption.aggregate({ where: { couponId: id, status: 'APPLIED' }, _sum: { discountPaise: true }, _count: { _all: true } }),
    prisma.couponRedemption.count({ where: { couponId: id, status: 'REVERSED' } }),
  ]);
  return {
    ...c,
    live: couponIsLive(c),
    stats: { issued: c._count.grants, redeemed: applied._count._all, reversed, discountGivenPaise: applied._sum.discountPaise ?? 0 },
    redemptions,
  };
}

async function checkRefs(productIds: string[], categoryIds: string[]) {
  const [p, cat] = await Promise.all([
    productIds.length ? prisma.product.count({ where: { id: { in: productIds } } }) : 0,
    categoryIds.length ? prisma.category.count({ where: { id: { in: categoryIds } } }) : 0,
  ]);
  if (p !== new Set(productIds).size) throw new AppError(400, 'VALIDATION_ERROR', 'One or more selected products do not exist');
  if (cat !== new Set(categoryIds).size) throw new AppError(400, 'VALIDATION_ERROR', 'One or more selected categories do not exist');
}

const describe = (v: z.infer<typeof couponBase>) =>
  `${v.code}: ${v.discountType === 'FIXED' ? `₹${v.discountValue / 100}` : `${v.discountValue / 100}%`} off, min ₹${v.minOrderValuePaise / 100}, active=${v.isActive}`;

export async function createCoupon(actor: AdminContext, raw: unknown) {
  const v = couponInput.parse(raw) as z.infer<typeof couponBase>;
  await checkRefs(v.productIds, v.categoryIds);
  const { productIds, categoryIds, startsAt, ...data } = v;
  try {
    return await prisma.$transaction(async (tx) => {
      const c = await tx.coupon.create({
        data: {
          ...data,
          startsAt: startsAt ?? new Date(),
          createdById: actor.admin.id,
          products: { create: [...new Set(productIds)].map((productId) => ({ productId })) },
          categories: { create: [...new Set(categoryIds)].map((categoryId) => ({ categoryId })) },
        },
        select: { id: true, code: true },
      });
      await audit(tx, actor, { action: 'Created coupon', category: 'COUPON', entityType: 'Coupon', entityId: c.id, details: describe(v) });
      return c;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw conflict(`Coupon code ${v.code} already exists`);
    throw e;
  }
}

/** Fields that would change what existing customers were promised are locked once a coupon has been redeemed. */
const LOCKED_AFTER_USE = ['code', 'discountType', 'discountValue', 'maxDiscountPaise'] as const;

export async function updateCoupon(actor: AdminContext, id: string, raw: unknown) {
  z.string().uuid().parse(id);
  const v = couponInput.parse(raw) as z.infer<typeof couponBase>;
  const existing = await prisma.coupon.findUnique({ where: { id } });
  if (!existing) throw notFound('Coupon');
  const redemptions = await prisma.couponRedemption.count({ where: { couponId: id } });
  if (redemptions > 0) {
    const changed = LOCKED_AFTER_USE.filter((k) => (existing as Record<string, unknown>)[k] !== (v as Record<string, unknown>)[k]);
    if (changed.length) throw conflict(`This coupon has been used, so ${changed.join(', ')} can no longer change. Create a new coupon instead.`);
  }
  if (v.usageLimit != null && v.usageLimit < existing.usedCount) throw conflict(`Usage limit cannot be lower than the ${existing.usedCount} uses so far`);
  await checkRefs(v.productIds, v.categoryIds);
  const { productIds, categoryIds, startsAt, ...data } = v;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.coupon.update({ where: { id }, data: { ...data, startsAt: startsAt ?? existing.startsAt } });
      await tx.couponProduct.deleteMany({ where: { couponId: id } });
      await tx.couponCategory.deleteMany({ where: { couponId: id } });
      if (productIds.length) await tx.couponProduct.createMany({ data: [...new Set(productIds)].map((productId) => ({ couponId: id, productId })) });
      if (categoryIds.length) await tx.couponCategory.createMany({ data: [...new Set(categoryIds)].map((categoryId) => ({ couponId: id, categoryId })) });
      await audit(tx, actor, { action: 'Updated coupon', category: 'COUPON', entityType: 'Coupon', entityId: id, details: describe(v) });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw conflict(`Coupon code ${v.code} already exists`);
    throw e;
  }
  return { id };
}

export async function setCouponActive(actor: AdminContext, id: string, isActive: boolean) {
  z.string().uuid().parse(id);
  const c = await prisma.coupon.findUnique({ where: { id }, select: { code: true } });
  if (!c) throw notFound('Coupon');
  await prisma.$transaction([
    prisma.coupon.update({ where: { id }, data: { isActive } }),
    prisma.adminAuditLog.create({ data: { adminId: actor.admin.id, adminName: actor.admin.name, action: isActive ? 'Activated coupon' : 'Deactivated coupon', category: 'COUPON', entityType: 'Coupon', entityId: id, details: c.code } }),
  ]);
  return { id, isActive };
}

/** Only never-redeemed coupons can be deleted (redemption history is permanent). */
export async function deleteCoupon(actor: AdminContext, id: string) {
  z.string().uuid().parse(id);
  const c = await prisma.coupon.findUnique({ where: { id }, select: { code: true, _count: { select: { redemptions: true } } } });
  if (!c) throw notFound('Coupon');
  if (c._count.redemptions) throw conflict('This coupon has redemption history. Deactivate it instead of deleting.');
  await prisma.$transaction(async (tx) => {
    await tx.coupon.delete({ where: { id } });
    await audit(tx, actor, { action: 'Deleted coupon', category: 'COUPON', entityType: 'Coupon', entityId: id, details: c.code });
  });
  return { deleted: true };
}

export const issueCouponInput = z.object({ emails: z.array(z.string().trim().toLowerCase().email()).min(1).max(200) });

/** Manually issue a coupon to existing customers by email. Unknown emails are reported, not created. */
export async function issueCouponToCustomers(actor: AdminContext, id: string, raw: unknown) {
  z.string().uuid().parse(id);
  const { emails } = issueCouponInput.parse(raw);
  const c = await prisma.coupon.findUnique({ where: { id }, select: { id: true, code: true, title: true, endsAt: true, minOrderValuePaise: true } });
  if (!c) throw notFound('Coupon');
  const users = await prisma.user.findMany({ where: { email: { in: emails }, status: 'ACTIVE' }, select: { id: true, email: true } });
  let issued = 0;
  for (const u of users) {
    if (await grantCoupon(c.id, u.id, 'MANUAL')) {
      issued++;
      await notifyCouponIssued(u.id, c);
    }
  }
  const found = new Set(users.map((u) => u.email));
  await audit(prisma, actor, { action: 'Issued coupon', category: 'COUPON', entityType: 'Coupon', entityId: c.id, details: `${c.code} issued to ${issued} customer(s)` });
  return { issued, alreadyHad: users.length - issued, notFound: emails.filter((e) => !found.has(e)) };
}
