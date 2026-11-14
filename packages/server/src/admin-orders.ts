import { prisma, type OrderStatus, type Prisma } from '@20mart/database';
import { z } from 'zod';
import type { AdminContext } from './auth/admin';
import { audit } from './audit';
import { AppError, badRequest, conflict, forbidden, notFound } from './errors';
import { addHistory, cancelInput, cancelOrderCore, commitOrderStock, expireStaleReservations, orderStatusLabel } from './orders';
import { getPaymentProvider, PaymentProviderError } from './payments';

const TX_OPTS = { timeout: 20_000, maxWait: 20_000 } as const;

/** Forward-only fulfilment flow. Cancellation is separate (needs orders.cancel). */
export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDING: 'CONFIRMED',
  CONFIRMED: 'PROCESSING',
  PROCESSING: 'PACKED',
  PACKED: 'READY_FOR_DISPATCH',
  READY_FOR_DISPATCH: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'DELIVERED',
};

const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'FAILED'] as const;
const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'] as const;

export const adminOrderListQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(80).optional().transform((v) => v || undefined),
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function listAdminOrders(raw: unknown) {
  const query = adminOrderListQuery.parse(raw);
  await expireStaleReservations().catch(() => undefined);
  const where: Prisma.OrderWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: new Date(`${query.from}T00:00:00+05:30`) } : {}),
            ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999+05:30`) } : {}),
          },
        }
      : {}),
    ...(query.q
      ? {
          OR: [
            { orderNumber: { contains: query.q.toUpperCase() } },
            { shipPincode: { startsWith: query.q } },
            { shipPhone: { contains: query.q.replace(/\D/g, '') || query.q } },
            { shipName: { contains: query.q, mode: 'insensitive' } },
            { user: { email: { contains: query.q.toLowerCase() } } },
            { user: { name: { contains: query.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        orderNumber: true,
        createdAt: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        totalPaise: true,
        shipName: true,
        shipPincode: true,
        user: { select: { name: true, email: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}

export async function getAdminOrder(id: string) {
  z.string().uuid().parse(id);
  const o = await prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, createdAt: true, profile: { select: { phone: true } }, _count: { select: { orders: true } } } },
      items: true,
      payments: { orderBy: { createdAt: 'asc' } },
      refunds: { orderBy: { createdAt: 'asc' }, include: { initiatedBy: { select: { name: true } } } },
      history: { orderBy: { createdAt: 'asc' }, include: { changedByAdmin: { select: { name: true } } } },
      orderNotes: { orderBy: { createdAt: 'desc' }, include: { admin: { select: { name: true } } } },
    },
  });
  if (!o) throw notFound('Order');
  const { idempotencyKey: _k, ...safe } = o;
  return { ...safe, nextStatus: NEXT_STATUS[o.status] ?? null, statusLabel: orderStatusLabel(o.status) };
}

export const transitionInput = z.object({
  toStatus: z.enum(['CONFIRMED', 'PROCESSING', 'PACKED', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERED']),
  reason: z.string().trim().max(300).optional(),
});

/** Move an order one step forward. Only the next status in the flow is allowed. */
export async function transitionOrder(actor: AdminContext, orderId: string, raw: unknown) {
  z.string().uuid().parse(orderId);
  const { toStatus, reason } = transitionInput.parse(raw);
  return prisma.$transaction(async (tx) => {
    const o = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, orderNumber: true, status: true, paymentMethod: true, paymentStatus: true, inventoryHold: true, totalPaise: true },
    });
    if (!o) throw notFound('Order');
    if (NEXT_STATUS[o.status] !== toStatus) {
      throw new AppError(409, 'INVALID_TRANSITION', `Cannot move an order from ${orderStatusLabel(o.status)} to ${orderStatusLabel(toStatus)}`);
    }
    if (toStatus === 'CONFIRMED' && o.paymentMethod === 'ONLINE' && o.paymentStatus !== 'PAID') {
      throw new AppError(409, 'NOT_PAID', 'Online orders are confirmed automatically once payment is verified');
    }
    const data: Prisma.OrderUpdateManyMutationInput = { status: toStatus };
    if (toStatus === 'DELIVERED') data.deliveredAt = new Date();
    const n = await tx.order.updateMany({ where: { id: o.id, status: o.status }, data });
    if (!n.count) throw conflict('The order was updated at the same time. Please refresh.');
    if (toStatus === 'CONFIRMED') await commitOrderStock(tx, o.id, o.orderNumber, actor.admin.id); // COD: reserved → sold
    if (toStatus === 'DELIVERED' && o.paymentMethod === 'CASH_ON_DELIVERY' && o.paymentStatus === 'PENDING') {
      // Cash collected on delivery is the payment event for COD orders.
      await tx.payment.updateMany({ where: { orderId: o.id, provider: 'COD', status: 'PENDING' }, data: { status: 'PAID', capturedAt: new Date() } });
      await tx.order.update({ where: { id: o.id }, data: { paymentStatus: 'PAID' } });
    }
    await addHistory(tx, o.id, o.status, toStatus, { label: actor.admin.name, adminId: actor.admin.id }, reason);
    await audit(tx, actor, { action: 'Updated order status', category: 'ORDER', entityType: 'Order', entityId: o.id, details: `${o.orderNumber}: ${o.status} → ${toStatus}${reason ? ` (${reason})` : ''}` });
    return { status: toStatus };
  }, TX_OPTS);
}

export async function adminCancelOrder(actor: AdminContext, orderId: string, raw: unknown) {
  z.string().uuid().parse(orderId);
  const { reason } = cancelInput.parse(raw);
  const result = await cancelOrderCore(orderId, { by: 'admin', reason, actorLabel: actor.admin.name, adminId: actor.admin.id });
  await audit(prisma, actor, { action: 'Cancelled order', category: 'ORDER', entityType: 'Order', entityId: orderId, details: `${result.orderNumber}: ${reason}` });
  return result;
}

export const noteInput = z.object({ note: z.string().trim().min(1).max(1000) });
export async function addOrderNote(actor: AdminContext, orderId: string, raw: unknown) {
  z.string().uuid().parse(orderId);
  const { note } = noteInput.parse(raw);
  if (!(await prisma.order.count({ where: { id: orderId } }))) throw notFound('Order');
  return prisma.orderNote.create({ data: { orderId, adminId: actor.admin.id, note }, select: { id: true, note: true, createdAt: true } });
}

/* ──────────────────────────────── Refunds ──────────────────────────────── */

async function settleOrderRefundStatus(tx: Prisma.TransactionClient, orderId: string) {
  const [order, processed] = await Promise.all([
    tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { totalPaise: true } }),
    tx.refund.aggregate({ where: { orderId, status: 'PROCESSED' }, _sum: { amountPaise: true } }),
  ]);
  const refunded = processed._sum.amountPaise ?? 0;
  const open = await tx.refund.count({ where: { orderId, status: { in: ['REQUESTED', 'PENDING'] } } });
  const paymentStatus = refunded >= order.totalPaise ? 'REFUNDED' : refunded > 0 ? 'PARTIALLY_REFUNDED' : open ? 'REFUND_PENDING' : undefined;
  if (paymentStatus) await tx.order.update({ where: { id: orderId }, data: { paymentStatus } });
}

/**
 * Start a requested refund with the provider. It is only marked PROCESSED when the
 * provider says so (API response or webhook) — never assumed.
 */
export async function initiateRefund(actor: AdminContext, refundId: string) {
  z.string().uuid().parse(refundId);
  const r = await prisma.refund.findUnique({
    where: { id: refundId },
    select: { id: true, orderId: true, status: true, provider: true, amountPaise: true, payment: { select: { providerPaymentId: true } }, order: { select: { orderNumber: true } } },
  });
  if (!r) throw notFound('Refund');
  if (r.status !== 'REQUESTED' && r.status !== 'FAILED') throw conflict('This refund has already been initiated');
  if (r.provider !== 'RAZORPAY') throw badRequest('Cash refunds are recorded manually with a reference');
  if (!r.payment?.providerPaymentId) throw badRequest('No captured provider payment to refund');
  // Claim the refund first so double clicks cannot create two provider refunds.
  const claimed = await prisma.refund.updateMany({ where: { id: r.id, status: { in: ['REQUESTED', 'FAILED'] } }, data: { status: 'PENDING', initiatedById: actor.admin.id, failureReason: null } });
  if (!claimed.count) throw conflict('This refund has already been initiated');
  try {
    const pr = await getPaymentProvider().createRefund({ paymentId: r.payment.providerPaymentId, amountPaise: r.amountPaise, notes: { orderNumber: r.order.orderNumber } });
    await prisma.$transaction(async (tx) => {
      await tx.refund.update({
        where: { id: r.id },
        data: { providerRefundId: pr.id, status: pr.status === 'processed' ? 'PROCESSED' : pr.status === 'failed' ? 'FAILED' : 'PENDING', processedAt: pr.status === 'processed' ? new Date() : null },
      });
      await settleOrderRefundStatus(tx, r.orderId);
      await audit(tx, actor, { action: 'Initiated refund', category: 'PAYMENT', entityType: 'Order', entityId: r.orderId, details: `${r.order.orderNumber}: ${r.amountPaise} paise → ${pr.status}` });
    });
    return { status: pr.status };
  } catch (e) {
    await prisma.refund.update({ where: { id: r.id }, data: { status: 'FAILED', failureReason: (e as Error).message.slice(0, 300) } });
    if (e instanceof PaymentProviderError) throw new AppError(502, 'REFUND_FAILED', `Refund could not be started: ${e.message}`);
    throw e;
  }
}

/** Ask the provider for the latest refund status (e.g. when a webhook was missed). */
export async function syncRefund(actor: AdminContext, refundId: string) {
  z.string().uuid().parse(refundId);
  const r = await prisma.refund.findUnique({ where: { id: refundId }, select: { providerRefundId: true } });
  if (!r?.providerRefundId) throw badRequest('Refund has not been sent to the provider yet');
  const pr = await getPaymentProvider().fetchRefund(r.providerRefundId);
  if (pr.status === 'processed') await markRefundProcessed(pr.id);
  else if (pr.status === 'failed') await markRefundFailed(pr.id, 'Provider reported failure');
  void actor;
  return { status: pr.status };
}

export const manualRefundInput = z.object({ reference: z.string().trim().min(3).max(100) });
/** Cash (COD) refunds are made outside the system; record them with a reference. */
export async function recordManualRefund(actor: AdminContext, refundId: string, raw: unknown) {
  z.string().uuid().parse(refundId);
  const { reference } = manualRefundInput.parse(raw);
  const r = await prisma.refund.findUnique({ where: { id: refundId }, select: { id: true, orderId: true, status: true, provider: true, order: { select: { orderNumber: true } } } });
  if (!r) throw notFound('Refund');
  if (r.provider === 'RAZORPAY') throw badRequest('Online refunds must go through the payment provider');
  if (r.status === 'PROCESSED') throw conflict('Refund already recorded');
  await prisma.$transaction(async (tx) => {
    await tx.refund.update({ where: { id: r.id }, data: { status: 'PROCESSED', provider: 'MANUAL', reference, processedAt: new Date(), initiatedById: actor.admin.id } });
    await settleOrderRefundStatus(tx, r.orderId);
    await audit(tx, actor, { action: 'Recorded manual refund', category: 'PAYMENT', entityType: 'Order', entityId: r.orderId, details: `${r.order.orderNumber}: ref ${reference}` });
  });
}

export async function markRefundProcessed(providerRefundId: string) {
  const r = await prisma.refund.findUnique({ where: { providerRefundId }, select: { id: true, orderId: true, status: true } });
  if (!r) return { applied: false };
  if (r.status === 'PROCESSED') return { applied: false };
  await prisma.$transaction(async (tx) => {
    await tx.refund.update({ where: { id: r.id }, data: { status: 'PROCESSED', processedAt: new Date() } });
    await settleOrderRefundStatus(tx, r.orderId);
  });
  return { applied: true };
}

export async function markRefundFailed(providerRefundId: string, reason: string) {
  const n = await prisma.refund.updateMany({ where: { providerRefundId, status: 'PENDING' }, data: { status: 'FAILED', failureReason: reason.slice(0, 300) } });
  return { applied: n.count > 0 };
}

/* ──────────────────────────────── Customers ──────────────────────────────── */

export async function listCustomers(raw: unknown) {
  const q = z
    .object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), q: z.string().trim().max(80).optional() })
    .parse(raw);
  const where: Prisma.UserWhereInput = q.q ? { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { email: { contains: q.q.toLowerCase() } }] } : {};
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      select: { id: true, name: true, email: true, status: true, createdAt: true, lastLoginAt: true, profile: { select: { phone: true } }, _count: { select: { orders: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  const ids = rows.map((r) => r.id);
  const spend = await prisma.order.groupBy({ by: ['userId'], where: { userId: { in: ids }, paymentStatus: 'PAID' }, _sum: { totalPaise: true } });
  const spendBy = new Map(spend.map((s) => [s.userId, s._sum.totalPaise ?? 0]));
  return { items: rows.map((r) => ({ ...r, paidSpendPaise: spendBy.get(r.id) ?? 0 })), total, page: q.page, pageSize: q.pageSize };
}

/** Order KPIs. Revenue counts only orders whose payment was actually received (PAID). */
export async function getOrderStats() {
  const [byStatus, customers, paid, recent] = await Promise.all([
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.user.count(),
    prisma.order.aggregate({ where: { paymentStatus: 'PAID' }, _sum: { totalPaise: true }, _count: { _all: true } }),
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, orderNumber: true, createdAt: true, status: true, paymentStatus: true, totalPaise: true, shipName: true },
    }),
  ]);
  const count = (s: OrderStatus) => byStatus.find((b) => b.status === s)?._count._all ?? 0;
  return {
    totalOrders: byStatus.reduce((a, b) => a + b._count._all, 0),
    pending: count('PENDING'),
    confirmed: count('CONFIRMED'),
    processing: count('PROCESSING') + count('PACKED') + count('READY_FOR_DISPATCH') + count('OUT_FOR_DELIVERY'),
    delivered: count('DELIVERED'),
    cancelled: count('CANCELLED') + count('FAILED'),
    totalCustomers: customers,
    paidRevenuePaise: paid._sum.totalPaise ?? 0,
    paidOrders: paid._count._all,
    recent,
  };
}

/** Guard used by routes that combine permissions (e.g. refunds need orders.refund). */
export function requireRefundPermission(actor: AdminContext) {
  if (!actor.permissions.has('orders.refund')) throw forbidden('Refunds require orders.refund');
}
