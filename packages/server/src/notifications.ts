/**
 * Customer notifications: an in-app notification centre plus an email outbox.
 *
 * Email status is honest:
 *  - QUEUED   — written to the outbox, not yet handed to a provider
 *  - SENT     — the provider ACCEPTED the message (not proof of delivery)
 *  - DELIVERED/BOUNCED/COMPLAINED — only from a verified provider webhook
 *  - SKIPPED  — not attempted (no provider configured, no address, or customer opted out)
 *  - FAILED   — provider refused / network error (retried by the cron while attempts < MAX)
 * Notification failures never break the business action that triggered them.
 */
import { prisma, type NotificationType, type OrderStatus } from '@20mart/database';
import { z } from 'zod';
import type { AdminContext } from './auth/admin';
import { audit } from './audit';
import { EmailProviderError, getEmailProvider, verifyResendWebhook } from './email/provider';
import { money, renderEmail, type EmailContent } from './email/templates';
import { AppError, notFound } from './errors';
import { logger, serializeError } from './observability';

export const MAX_EMAIL_ATTEMPTS = 5;

type Category = 'account' | 'order' | 'marketing';
const CATEGORY: Record<NotificationType, Category> = {
  WELCOME: 'account',
  ORDER_CONFIRMATION: 'order',
  PAYMENT_CONFIRMATION: 'order',
  ORDER_STATUS: 'order',
  ORDER_CANCELLED: 'order',
  COUPON_ISSUED: 'marketing',
  CAMPAIGN_ANNOUNCEMENT: 'marketing',
};

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  /** Email content; omit to send in-app only. */
  email?: { subject: string; content: EmailContent } | null;
}

function logFailure(what: string, e: unknown) {
  // Never log addresses or message bodies — only what failed (messages are redacted by the logger).
  logger.error('notification.failed', { category: 'notification', what, error: serializeError(e) });
}

/** Create the in-app notification and (if allowed) queue + attempt the email. Never throws. */
export async function notify(userId: string, n: NotifyInput, opts: { dispatch?: boolean } = {}) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, status: true, profile: { select: { emailOrderUpdates: true, marketingOptIn: true } } },
    });
    if (!user) return null;
    await prisma.notification.create({ data: { userId, type: n.type, title: n.title.slice(0, 160), body: n.body.slice(0, 1000), link: n.link ?? null } });
    if (!n.email) return null;
    const cat = CATEGORY[n.type];
    const allowed =
      user.status === 'ACTIVE' &&
      !!user.email &&
      (cat === 'account' || (cat === 'order' ? (user.profile?.emailOrderUpdates ?? true) : (user.profile?.marketingOptIn ?? false)));
    const msg = await prisma.emailMessage.create({
      data: {
        userId,
        type: n.type,
        toEmail: user.email ?? '',
        subject: n.email.subject.slice(0, 200),
        html: renderEmail(n.email.content),
        status: allowed ? 'QUEUED' : 'SKIPPED',
        lastError: allowed ? null : !user.email ? 'No email address' : user.status !== 'ACTIVE' ? 'Account inactive' : 'Customer opted out',
      },
      select: { id: true, status: true },
    });
    if (msg.status === 'QUEUED' && opts.dispatch !== false) await dispatchEmail(msg.id);
    return msg.id;
  } catch (e) {
    logFailure(`notify(${n.type})`, e);
    return null;
  }
}

/**
 * Bulk variant of notify() for broadcasts (e.g. campaign announcements): same preference rules,
 * but in-app notifications and email outbox rows are written with createMany per batch and the
 * email HTML is rendered once. Emails are only QUEUED here; the cron/queue sends them.
 */
export async function notifyMany(
  users: { id: string; email: string | null; status: string; profile: { emailOrderUpdates: boolean; marketingOptIn: boolean } | null }[],
  n: NotifyInput
) {
  if (!users.length) return { notified: 0, queued: 0 };
  await prisma.notification.createMany({
    data: users.map((u) => ({ userId: u.id, type: n.type, title: n.title.slice(0, 160), body: n.body.slice(0, 1000), link: n.link ?? null })),
  });
  if (!n.email) return { notified: users.length, queued: 0 };
  const cat = CATEGORY[n.type];
  const html = renderEmail(n.email.content);
  const subject = n.email.subject.slice(0, 200);
  let queued = 0;
  await prisma.emailMessage.createMany({
    data: users.map((u) => {
      const allowed =
        u.status === 'ACTIVE' && !!u.email && (cat === 'account' || (cat === 'order' ? (u.profile?.emailOrderUpdates ?? true) : (u.profile?.marketingOptIn ?? false)));
      if (allowed) queued++;
      return {
        userId: u.id,
        type: n.type,
        toEmail: u.email ?? '',
        subject,
        html,
        status: allowed ? ('QUEUED' as const) : ('SKIPPED' as const),
        lastError: allowed ? null : !u.email ? 'No email address' : u.status !== 'ACTIVE' ? 'Account inactive' : 'Customer opted out',
      };
    }),
  });
  return { notified: users.length, queued };
}

/** Hand one queued/failed message to the provider. Idempotent per message id. */
export async function dispatchEmail(id: string) {
  const msg = await prisma.emailMessage.findUnique({ where: { id }, select: { id: true, status: true, attempts: true, toEmail: true, subject: true, html: true } });
  if (!msg || (msg.status !== 'QUEUED' && msg.status !== 'FAILED') || msg.attempts >= MAX_EMAIL_ATTEMPTS) return msg?.status ?? null;
  const provider = getEmailProvider();
  if (!provider) {
    await prisma.emailMessage.update({ where: { id }, data: { status: 'SKIPPED', lastError: 'Email provider not configured' } });
    return 'SKIPPED' as const;
  }
  // Optimistic claim: only one dispatcher wins this attempt number.
  const claimed = await prisma.emailMessage.updateMany({ where: { id, attempts: msg.attempts, status: { in: ['QUEUED', 'FAILED'] } }, data: { attempts: { increment: 1 }, provider: provider.name } });
  if (!claimed.count) return null;
  try {
    // The message id is the provider idempotency key, so a retry after a lost response is not delivered twice.
    const res = await provider.send({ to: msg.toEmail, subject: msg.subject, html: msg.html, idempotencyKey: msg.id });
    await prisma.emailMessage.update({ where: { id }, data: { status: 'SENT', providerMessageId: res.id, sentAt: new Date(), lastError: null } });
    return 'SENT' as const;
  } catch (e) {
    const retryable = e instanceof EmailProviderError ? e.retryable : true;
    await prisma.emailMessage.update({
      where: { id },
      data: { status: 'FAILED', lastError: (e as Error).message.slice(0, 300), ...(retryable ? {} : { attempts: MAX_EMAIL_ATTEMPTS }) },
    });
    return 'FAILED' as const;
  }
}

/** Cron: (re)try queued and retryable failed messages. */
export async function processEmailQueue(limit = 25) {
  const due = await prisma.emailMessage.findMany({
    where: { status: { in: ['QUEUED', 'FAILED'] }, attempts: { lt: MAX_EMAIL_ATTEMPTS } },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true },
  });
  const out = { processed: 0, sent: 0, failed: 0, skipped: 0 };
  for (const m of due) {
    const r = await dispatchEmail(m.id);
    out.processed++;
    if (r === 'SENT') out.sent++;
    else if (r === 'FAILED') out.failed++;
    else if (r === 'SKIPPED') out.skipped++;
  }
  return out;
}

/** Verified Resend delivery events. Only these move a message to DELIVERED/BOUNCED/COMPLAINED. */
export async function processResendWebhook(raw: string, headers: { id: string | null; timestamp: string | null; signature: string | null }) {
  if (!verifyResendWebhook(raw, headers)) throw new AppError(401, 'BAD_SIGNATURE', 'Invalid webhook signature');
  let evt: { type?: string; data?: { email_id?: string } };
  try {
    evt = JSON.parse(raw);
  } catch {
    throw new AppError(400, 'BAD_PAYLOAD', 'Invalid JSON');
  }
  const emailId = evt.data?.email_id;
  if (!emailId) return { handled: false };
  const msg = await prisma.emailMessage.findUnique({ where: { providerMessageId: emailId }, select: { id: true, userId: true, status: true } });
  if (!msg) return { handled: false };
  if (evt.type === 'email.delivered' && msg.status !== 'BOUNCED' && msg.status !== 'COMPLAINED') {
    await prisma.emailMessage.update({ where: { id: msg.id }, data: { status: 'DELIVERED', deliveredAt: new Date() } });
  } else if (evt.type === 'email.bounced') {
    await prisma.emailMessage.update({ where: { id: msg.id }, data: { status: 'BOUNCED', lastError: 'Bounced' } });
  } else if (evt.type === 'email.complained') {
    await prisma.emailMessage.update({ where: { id: msg.id }, data: { status: 'COMPLAINED' } });
    // Spam complaint → stop marketing email to this customer.
    if (msg.userId) await prisma.customerProfile.updateMany({ where: { userId: msg.userId }, data: { marketingOptIn: false } });
  } else {
    return { handled: false };
  }
  return { handled: true };
}

/* ───────────────────────────── Customer notification centre ───────────────────────────── */

export async function listNotifications(userId: string, page = 1, pageSize = 20) {
  const [items, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true },
    }),
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { items, total, unread, page, pageSize };
}

export const unreadNotificationCount = (userId: string) => prisma.notification.count({ where: { userId, readAt: null } });

export const markReadInput = z.union([z.object({ all: z.literal(true) }), z.object({ ids: z.array(z.string().uuid()).min(1).max(100) })]);

/** Mark own notifications read (scoped by userId — other customers' ids are ignored). */
export async function markNotificationsRead(userId: string, raw: unknown) {
  const input = markReadInput.parse(raw);
  const where = 'all' in input ? { userId, readAt: null } : { userId, id: { in: input.ids }, readAt: null };
  const n = await prisma.notification.updateMany({ where, data: { readAt: new Date() } });
  return { updated: n.count, unread: await unreadNotificationCount(userId) };
}

export const preferencesInput = z.object({ emailOrderUpdates: z.boolean().optional(), marketingOptIn: z.boolean().optional() }).strict();

export async function getNotificationPreferences(userId: string) {
  const p = await prisma.customerProfile.findUnique({ where: { userId }, select: { emailOrderUpdates: true, marketingOptIn: true } });
  return { emailOrderUpdates: p?.emailOrderUpdates ?? true, marketingOptIn: p?.marketingOptIn ?? false };
}

export async function updateNotificationPreferences(userId: string, raw: unknown) {
  const input = preferencesInput.parse(raw);
  await prisma.customerProfile.upsert({ where: { userId }, update: input, create: { userId, ...input } });
  return getNotificationPreferences(userId);
}

/* ─────────────────────────────── Domain notifications ─────────────────────────────── */

export async function notifyWelcome(userId: string, name: string | null) {
  return notify(userId, {
    type: 'WELCOME',
    title: 'Welcome to 20Mart',
    body: 'Your account is ready. Everyday essentials at ₹20, ₹40, ₹60 and ₹100.',
    link: '/shop',
    email: {
      subject: 'Welcome to 20Mart',
      content: {
        heading: `Welcome${name ? `, ${name.split(' ')[0]}` : ''}!`,
        paragraphs: ['Your 20Mart account is ready. Shop everyday home, kitchen and stationery essentials at simple price points.'],
        cta: { label: 'Start shopping', href: '/shop' },
      },
    },
  });
}

export async function notifyCouponIssued(userId: string, c: { code: string; title: string; endsAt: Date | null; minOrderValuePaise: number }) {
  const until = c.endsAt ? ` Valid until ${c.endsAt.toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' })}.` : '';
  const min = c.minOrderValuePaise > 0 ? ` On orders of ${money(c.minOrderValuePaise)} or more.` : '';
  return notify(userId, {
    type: 'COUPON_ISSUED',
    title: `New coupon: ${c.code}`,
    body: `${c.title}.${min}${until}`,
    link: '/account/coupons',
    email: { subject: `Your 20Mart coupon ${c.code}`, content: { heading: c.title, paragraphs: [`Use code ${c.code} at checkout.${min}${until}`], cta: { label: 'View my coupons', href: '/account/coupons' } } },
  });
}

async function orderForEmail(orderId: string) {
  const [order, items] = await Promise.all([orderForEmailRow(orderId), prisma.orderItem.count({ where: { orderId } })]);
  return order ? { ...order, _count: { items } } : null;
}

async function orderForEmailRow(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    select: {
      userId: true,
      orderNumber: true,
      status: true,
      paymentMethod: true,
      subtotalPaise: true,
      discountPaise: true,
      deliveryChargePaise: true,
      totalPaise: true,
      couponCode: true,
      deliveryEstimate: true,
      cancelReason: true,
    },
  });
}

const orderRows = (o: NonNullable<Awaited<ReturnType<typeof orderForEmail>>>): [string, string][] => [
  ['Order', o.orderNumber],
  ['Items', String(o._count.items)],
  ['Subtotal', money(o.subtotalPaise)],
  ...(o.discountPaise > 0 ? ([[`Coupon${o.couponCode ? ` ${o.couponCode}` : ''}`, `−${money(o.discountPaise)}`]] as [string, string][]) : []),
  ['Delivery', o.deliveryChargePaise ? money(o.deliveryChargePaise) : 'Free'],
  ['Total', money(o.totalPaise)],
];

/** Order placed: sent immediately for COD; for online orders, after payment is confirmed (see notifyPaymentConfirmed). */
export async function notifyOrderPlaced(orderId: string) {
  const o = await orderForEmail(orderId).catch(() => null);
  if (!o) return null;
  const link = `/account/orders/${o.orderNumber}`;
  return notify(o.userId, {
    type: 'ORDER_CONFIRMATION',
    title: `Order ${o.orderNumber} placed`,
    body: `We received your order of ${money(o.totalPaise)}${o.paymentMethod === 'CASH_ON_DELIVERY' ? ' (cash on delivery)' : ''}. We'll update you as it progresses.`,
    link,
    email: {
      subject: `Order ${o.orderNumber} received`,
      content: { heading: 'Thanks for your order!', paragraphs: ['We have received your order and will confirm it shortly.', ...(o.deliveryEstimate ? [o.deliveryEstimate] : [])], rows: orderRows(o), cta: { label: 'View order', href: link } },
    },
  });
}

export async function notifyPaymentConfirmed(orderId: string) {
  const o = await orderForEmail(orderId).catch(() => null);
  if (!o) return null;
  const link = `/account/orders/${o.orderNumber}`;
  return notify(o.userId, {
    type: 'PAYMENT_CONFIRMATION',
    title: `Payment received for ${o.orderNumber}`,
    body: `We received your payment of ${money(o.totalPaise)}. Your order is confirmed.`,
    link,
    email: {
      subject: `Payment received — order ${o.orderNumber} confirmed`,
      content: { heading: 'Payment received', paragraphs: ['Your payment was successful and your order is confirmed.', ...(o.deliveryEstimate ? [o.deliveryEstimate] : [])], rows: orderRows(o), cta: { label: 'Track order', href: link } },
    },
  });
}

const STATUS_COPY: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: 'Your order is confirmed.',
  PROCESSING: 'We are preparing your order.',
  PACKED: 'Your order is packed.',
  READY_FOR_DISPATCH: 'Your order is ready for dispatch.',
  OUT_FOR_DELIVERY: 'Your order is out for delivery.',
  DELIVERED: 'Your order has been delivered. Thank you for shopping with 20Mart!',
};

/** Fulfilment status update. Only customer-meaningful statuses produce an email. */
export async function notifyOrderStatus(orderId: string, status: OrderStatus) {
  const copy = STATUS_COPY[status];
  if (!copy) return null;
  const o = await orderForEmail(orderId).catch(() => null);
  if (!o) return null;
  const link = `/account/orders/${o.orderNumber}`;
  const emailWorthy = status === 'CONFIRMED' || status === 'OUT_FOR_DELIVERY' || status === 'DELIVERED';
  return notify(o.userId, {
    type: 'ORDER_STATUS',
    title: `Order ${o.orderNumber}: ${copy.replace(/\.$/, '')}`,
    body: copy,
    link,
    email: emailWorthy ? { subject: `Order ${o.orderNumber} update`, content: { heading: copy, paragraphs: [], rows: [['Order', o.orderNumber]], cta: { label: 'View order', href: link } } } : null,
  });
}

export async function notifyOrderCancelled(orderId: string, refundRequired: boolean) {
  const o = await orderForEmail(orderId).catch(() => null);
  if (!o) return null;
  const link = `/account/orders/${o.orderNumber}`;
  const refund = refundRequired ? ' Your refund has been requested; we will update you when it is processed.' : '';
  return notify(o.userId, {
    type: 'ORDER_CANCELLED',
    title: `Order ${o.orderNumber} cancelled`,
    body: `Your order was cancelled${o.cancelReason ? `: ${o.cancelReason}` : ''}.${refund}`,
    link,
    email: { subject: `Order ${o.orderNumber} cancelled`, content: { heading: 'Your order was cancelled', paragraphs: [o.cancelReason ? `Reason: ${o.cancelReason}` : 'Your order was cancelled.', ...(refund ? [refund.trim()] : [])], rows: [['Order', o.orderNumber], ['Amount', money(o.totalPaise)]], cta: { label: 'View order', href: link } } },
  });
}

/* ───────────────────────────────── Admin ───────────────────────────────── */

export const emailLogQuery = z.object({
  status: z.enum(['QUEUED', 'SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'FAILED', 'SKIPPED']).optional().catch(undefined),
  type: z.enum(['WELCOME', 'ORDER_CONFIRMATION', 'PAYMENT_CONFIRMATION', 'ORDER_STATUS', 'ORDER_CANCELLED', 'COUPON_ISSUED', 'CAMPAIGN_ANNOUNCEMENT']).optional().catch(undefined),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1).catch(1),
});

/** Outbox log for admins. HTML bodies are not returned in the list. */
export async function listEmailLog(raw: unknown) {
  const q = emailLogQuery.parse(raw);
  const pageSize = 30;
  const where = { status: q.status, type: q.type, ...(q.q ? { OR: [{ toEmail: { contains: q.q, mode: 'insensitive' as const } }, { subject: { contains: q.q, mode: 'insensitive' as const } }] } : {}) };
  const [items, total, byStatus] = await Promise.all([
    prisma.emailMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * pageSize,
      take: pageSize,
      select: { id: true, type: true, toEmail: true, subject: true, status: true, provider: true, attempts: true, lastError: true, sentAt: true, deliveredAt: true, createdAt: true },
    }),
    prisma.emailMessage.count({ where }),
    prisma.emailMessage.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  return { items, total, page: q.page, pageSize, byStatus: Object.fromEntries(byStatus.map((b) => [b.status, b._count._all])) as Record<string, number> };
}

export async function retryEmail(actor: AdminContext, id: string) {
  z.string().uuid().parse(id);
  const m = await prisma.emailMessage.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!m) throw notFound('Email');
  if (m.status !== 'FAILED' && m.status !== 'SKIPPED') throw new AppError(409, 'NOT_RETRYABLE', 'Only failed or skipped emails can be retried');
  await prisma.emailMessage.update({ where: { id }, data: { status: 'QUEUED', attempts: 0, lastError: null } });
  await audit(prisma, actor, { action: 'Retried email', category: 'NOTIFICATION', entityType: 'EmailMessage', entityId: id, details: `Re-queued email ${id}` });
  return { status: await dispatchEmail(id) };
}
