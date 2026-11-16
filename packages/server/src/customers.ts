/**
 * Admin customer management. Never selects credentials or identity secrets
 * (session tokens, Google subject id). Addresses are returned only to staff who
 * can also see orders (they are delivery data).
 */
import { prisma, Prisma } from '@20mart/database';
import { z } from 'zod';
import type { AdminContext } from './auth/admin';
import { audit } from './audit';
import { countBy } from './counts';
import { conflict, notFound } from './errors';

/** Payment states in which money was actually captured at some point. */
export const CAPTURED_PAYMENT = ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'REFUND_PENDING'] as const;

export const customerListQuery = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional().catch(undefined),
  segment: z.enum(['ordered', 'never_ordered', 'campaign', 'marketing_opt_in']).optional().catch(undefined),
  page: z.coerce.number().int().min(1).default(1).catch(1),
});

export async function listCustomersAdmin(raw: unknown) {
  const q = customerListQuery.parse(raw);
  const pageSize = 25;
  const and: Prisma.UserWhereInput[] = [];
  if (q.q) {
    const digits = q.q.replace(/\D/g, '');
    and.push({
      OR: [
        { name: { contains: q.q, mode: 'insensitive' } },
        { email: { contains: q.q.toLowerCase() } },
        ...(digits.length >= 4 ? [{ profile: { phone: { contains: digits.slice(-10) } } }] : []),
      ],
    });
  }
  if (q.status) and.push({ status: q.status });
  if (q.segment === 'ordered') and.push({ orders: { some: {} } });
  if (q.segment === 'never_ordered') and.push({ orders: { none: {} } });
  if (q.segment === 'campaign') and.push({ campaignJoins: { some: {} } });
  if (q.segment === 'marketing_opt_in') and.push({ profile: { marketingOptIn: true } });
  const where: Prisma.UserWhereInput = and.length ? { AND: and } : {};
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, name: true, email: true, status: true, createdAt: true, lastLoginAt: true,
        profile: { select: { phone: true, marketingOptIn: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  // Per-page aggregates (relation _count would aggregate the whole Order/redemption tables).
  const ids = rows.map((r) => r.id);
  const userIn = { userId: { in: ids } };
  const [spend, orders, joins, redemptions] = ids.length
    ? await Promise.all([
        prisma.order.groupBy({ by: ['userId'], where: { ...userIn, paymentStatus: { in: [...CAPTURED_PAYMENT] } }, _sum: { totalPaise: true } }),
        countBy(prisma.order.groupBy({ by: ['userId'], where: userIn, _count: { _all: true } }), (g) => g.userId),
        countBy(prisma.campaignParticipant.groupBy({ by: ['userId'], where: userIn, _count: { _all: true } }), (g) => g.userId),
        countBy(prisma.couponRedemption.groupBy({ by: ['userId'], where: { ...userIn, status: 'APPLIED' }, _count: { _all: true } }), (g) => g.userId),
      ])
    : [[], new Map<string, number>(), new Map<string, number>(), new Map<string, number>()];
  const spendBy = new Map(spend.map((s) => [s.userId, s._sum.totalPaise ?? 0]));
  return {
    items: rows.map((r) => ({
      ...r,
      _count: { orders: orders.get(r.id) ?? 0, campaignJoins: joins.get(r.id) ?? 0, redemptions: redemptions.get(r.id) ?? 0 },
      paidSpendPaise: spendBy.get(r.id) ?? 0,
    })),
    total,
    page: q.page,
    pageSize,
  };
}

export async function getCustomerAdmin(id: string, opts: { includeAddresses: boolean; includeOrders: boolean }) {
  z.string().uuid().parse(id);
  const u = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, name: true, email: true, image: true, status: true, createdAt: true, lastLoginAt: true, emailVerified: true,
      profile: { select: { phone: true, marketingOptIn: true, emailOrderUpdates: true } },
    },
  });
  if (!u) throw notFound('Customer');
  const [orderCount, wishlistCount] = await Promise.all([prisma.order.count({ where: { userId: id } }), prisma.wishlistItem.count({ where: { userId: id } })]);
  const [orders, orderAgg, addresses, campaigns, grants, redemptions] = await Promise.all([
    opts.includeOrders
      ? prisma.order.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, orderNumber: true, createdAt: true, status: true, paymentStatus: true, paymentMethod: true, totalPaise: true, couponCode: true } })
      : Promise.resolve(null),
    prisma.order.aggregate({ where: { userId: id, paymentStatus: { in: [...CAPTURED_PAYMENT] } }, _sum: { totalPaise: true }, _count: { _all: true } }),
    opts.includeAddresses
      ? prisma.address.findMany({ where: { userId: id }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }], select: { id: true, name: true, phone: true, addressLine1: true, addressLine2: true, landmark: true, city: true, state: true, pincode: true, type: true, isDefault: true } })
      : Promise.resolve(null),
    prisma.campaignParticipant.findMany({
      where: { userId: id },
      orderBy: { joinedAt: 'desc' },
      select: { joinedAt: true, campaign: { select: { id: true, name: true, type: true } } },
    }),
    prisma.couponGrant.findMany({ where: { userId: id }, orderBy: { issuedAt: 'desc' }, select: { issuedAt: true, source: true, coupon: { select: { id: true, code: true, title: true } } } }),
    prisma.couponRedemption.findMany({
      where: { userId: id },
      orderBy: { redeemedAt: 'desc' },
      take: 50,
      select: { id: true, discountPaise: true, status: true, redeemedAt: true, coupon: { select: { code: true } }, order: { select: { orderNumber: true } } },
    }),
  ]);
  const savedItems = await prisma.campaignCartItem.groupBy({ by: ['campaignId'], where: { userId: id }, _sum: { quantity: true } });
  const unitsBy = new Map(savedItems.map((s) => [s.campaignId, s._sum.quantity ?? 0]));
  return {
    ...u,
    _count: { orders: orderCount, wishlist: wishlistCount },
    paidOrders: orderAgg._count._all,
    paidSpendPaise: orderAgg._sum.totalPaise ?? 0,
    orders,
    addresses,
    campaigns: campaigns.map((c) => ({ ...c, savedUnits: unitsBy.get(c.campaign.id) ?? 0 })),
    couponGrants: grants,
    redemptions,
  };
}

export const customerStatusInput = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']), reason: z.string().trim().min(3, 'Give a reason').max(300) });

/** Suspend / reactivate. Suspension signs the customer out everywhere immediately. */
export async function setCustomerStatus(actor: AdminContext, id: string, raw: unknown) {
  z.string().uuid().parse(id);
  const { status, reason } = customerStatusInput.parse(raw);
  const u = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, status: true } });
  if (!u) throw notFound('Customer');
  if (u.status === status) throw conflict(`Customer is already ${status.toLowerCase()}`);
  const signedOut = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { status } });
    const removed = status === 'SUSPENDED' ? (await tx.userSession.deleteMany({ where: { userId: id } })).count : 0;
    await audit(tx, actor, {
      action: status === 'SUSPENDED' ? 'Suspended customer' : 'Reactivated customer',
      category: 'CUSTOMER',
      entityType: 'User',
      entityId: id,
      details: `${u.email ?? id}: ${reason}`,
    });
    return removed;
  });
  return { id, status, sessionsRevoked: signedOut };
}
