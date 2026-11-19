import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import { prisma } from '@20mart/database';
import { adminRequest, adminSession, createCustomer, ctxParams, customerRequest, makeSellable, resetDb, setupDelivery, testWarehouse, VALID_ADDRESS } from './helpers';
import { createResendProvider, setEmailProviderForTests, type EmailProvider } from '../src/email/provider';
import { dispatchEmail, notify, notifyOrderStatus, processEmailQueue, processResendWebhook } from '../src/notifications';
import { addItem } from '../src/cart';
import { createAddress } from '../src/addresses';
import { placeOrder } from '../src/orders';
import { getAnalytics, resolveRange } from '../src/analytics';
import { checkServiceability, quoteDelivery } from '../src/delivery';
import { resetEnvCache } from '../src/env';

const A = '../../../apps/20martadmin/src/app/api/admin';
const S = '../../../apps/20mart/src/app/api';

beforeEach(resetDb);
afterEach(() => setEmailProviderForTests(null));

function fakeProvider(behaviour: 'ok' | 'fail' | 'reject' = 'ok') {
  const sent: { to: string; subject: string; idempotencyKey: string }[] = [];
  const p: EmailProvider = {
    name: 'FAKE',
    async send(input) {
      if (behaviour === 'fail') throw Object.assign(new Error('Service unavailable'), { name: 'EmailProviderError', retryable: true });
      sent.push({ to: input.to, subject: input.subject, idempotencyKey: input.idempotencyKey });
      return { id: `em_${sent.length}_${randomUUID()}` };
    },
  };
  return { p, sent };
}

describe('coupon admin RBAC and validation', () => {
  it('coupon routes enforce coupons.* permissions and reject bad input', async () => {
    const list = await import(`${A}/coupons/route`);
    const one = await import(`${A}/coupons/[id]/route`);
    const valid = { code: 'diwali-10', title: '10% off for Diwali', discountType: 'PERCENT', discountValue: 1000, maxDiscountPaise: 5000, minOrderValuePaise: 9900, isActive: true };
    const c = await createCustomer();
    expect((await list.POST(adminRequest('/x', { method: 'POST', token: c.token, body: valid }))).status).toBe(401);
    const om = await adminSession('ordermgr', ['ORDER_MANAGER']);
    expect((await list.GET(adminRequest('/x', { token: om.token }))).status).toBe(403);
    const mm = await adminSession('marketer', ['MARKETING_MANAGER']);
    expect((await list.POST(adminRequest('/x', { method: 'POST', token: mm.token, body: { ...valid, discountValue: 20000 } }))).status).toBe(400); // > 100%
    expect((await list.POST(adminRequest('/x', { method: 'POST', token: mm.token, body: { ...valid, discountType: 'FIXED' } }))).status).toBe(400); // max discount on FIXED
    expect((await list.POST(adminRequest('/x', { method: 'POST', token: mm.token, body: { ...valid, startsAt: '2026-12-10', endsAt: '2026-12-01' } }))).status).toBe(400);
    const created = await list.POST(adminRequest('/x', { method: 'POST', token: mm.token, body: valid }));
    expect(created.status).toBe(201);
    const { id, code } = await created.json();
    expect(code).toBe('DIWALI-10');
    expect((await list.POST(adminRequest('/x', { method: 'POST', token: mm.token, body: valid }))).status).toBe(409); // duplicate code
    expect(await prisma.adminAuditLog.count({ where: { entityId: id, category: 'COUPON' } })).toBe(1);

    // Used coupons: value fields are locked, deletion refused.
    const u = await createCustomer();
    const o = await prisma.order.create({
      data: { orderNumber: 'ZM261115-AAAAAA', userId: u.user.id, subtotalPaise: 20000, deliveryChargePaise: 0, discountPaise: 2000, taxPaise: 0, totalPaise: 18000, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: randomUUID(), shipName: 'x', shipPhone: '9876543210', shipLine1: 'x', shipCity: 'x', shipState: 'Gujarat', shipPincode: '380015' },
    });
    await prisma.couponRedemption.create({ data: { couponId: id, userId: u.user.id, orderId: o.id, discountPaise: 2000 } });
    const upd = await one.PUT(adminRequest('/x', { method: 'PUT', token: mm.token, body: { ...valid, discountValue: 2000 } }), ctxParams({ id }));
    expect(upd.status).toBe(409);
    expect((await one.PUT(adminRequest('/x', { method: 'PUT', token: mm.token, body: { ...valid, title: 'Diwali 10% (renamed)' } }), ctxParams({ id }))).status).toBe(200);
    expect((await one.DELETE(adminRequest('/x', { method: 'DELETE', token: mm.token }), ctxParams({ id }))).status).toBe(409);
    const detail = await (await one.GET(adminRequest('/x', { token: mm.token }), ctxParams({ id }))).json();
    expect(detail.stats).toMatchObject({ redeemed: 1, discountGivenPaise: 2000, issued: 0 });
  });

  it('manual issue grants once and reports unknown emails without creating accounts', async () => {
    const mm = await adminSession('marketer', ['MARKETING_MANAGER']);
    const coupon = await prisma.coupon.create({ data: { code: 'VIP200', title: '₹200 off', discountValue: 20000, requiresGrant: true, isActive: true, startsAt: new Date(Date.now() - 60_000) } });
    const c = await createCustomer();
    const issue = await import(`${A}/coupons/[id]/issue/route`);
    const body = { emails: [c.user.email, 'nobody@example.com'] };
    const r1 = await (await issue.POST(adminRequest('/x', { method: 'POST', token: mm.token, body }), ctxParams({ id: coupon.id }))).json();
    expect(r1).toEqual({ issued: 1, alreadyHad: 0, notFound: ['nobody@example.com'] });
    const r2 = await (await issue.POST(adminRequest('/x', { method: 'POST', token: mm.token, body }), ctxParams({ id: coupon.id }))).json();
    expect(r2.issued).toBe(0);
    expect(await prisma.user.count({ where: { email: 'nobody@example.com' } })).toBe(0);
  });
});

describe('email notifications', () => {
  it('never marks an email sent without provider acceptance; retries are idempotent', async () => {
    const c = await createCustomer();
    // No provider configured → SKIPPED (in-app notification still created).
    const id1 = await notify(c.user.id, { type: 'WELCOME', title: 'Hi', body: 'Welcome', email: { subject: 'Welcome', content: { heading: 'Hi <script>', paragraphs: ['x'] } } });
    expect((await prisma.emailMessage.findUniqueOrThrow({ where: { id: id1! } })).status).toBe('SKIPPED');
    expect((await prisma.emailMessage.findUniqueOrThrow({ where: { id: id1! } })).html).not.toContain('<script>');
    expect(await prisma.notification.count({ where: { userId: c.user.id } })).toBe(1);

    // Provider failing → FAILED, retried by the queue, then SENT with the provider id.
    const failing = fakeProvider('fail');
    setEmailProviderForTests(failing.p);
    const id2 = await notify(c.user.id, { type: 'WELCOME', title: 'Hi', body: 'Welcome', email: { subject: 'Welcome again', content: { heading: 'Hi', paragraphs: ['x'] } } });
    expect((await prisma.emailMessage.findUniqueOrThrow({ where: { id: id2! } })).status).toBe('FAILED');
    const ok = fakeProvider('ok');
    setEmailProviderForTests(ok.p);
    expect(await processEmailQueue()).toMatchObject({ processed: 1, sent: 1 });
    const sent = await prisma.emailMessage.findUniqueOrThrow({ where: { id: id2! } });
    expect(sent).toMatchObject({ status: 'SENT', attempts: 2 });
    expect(sent.deliveredAt).toBeNull(); // accepted ≠ delivered
    expect(ok.sent[0].idempotencyKey).toBe(id2);
    expect(await dispatchEmail(id2!)).toBe('SENT'); // already sent → not sent again
    expect(ok.sent).toHaveLength(1);
  });

  it('respects customer preferences: order emails opt-out, marketing opt-in', async () => {
    setEmailProviderForTests(fakeProvider().p);
    const c = await createCustomer();
    const prefs = await import(`${S}/account/notification-preferences/route`);
    const upd = await prefs.PATCH(customerRequest('/x', { method: 'PATCH', token: c.token, body: { emailOrderUpdates: false } }));
    expect(await upd.json()).toEqual({ emailOrderUpdates: false, marketingOptIn: false });
    await notify(c.user.id, { type: 'ORDER_STATUS', title: 't', body: 'b', email: { subject: 's', content: { heading: 'h', paragraphs: [] } } });
    await notify(c.user.id, { type: 'CAMPAIGN_ANNOUNCEMENT', title: 't', body: 'b', email: { subject: 's', content: { heading: 'h', paragraphs: [] } } });
    const rows = await prisma.emailMessage.findMany({ where: { userId: c.user.id }, orderBy: { createdAt: 'asc' } });
    expect(rows.map((r) => [r.type, r.status])).toEqual([
      ['ORDER_STATUS', 'SKIPPED'],
      ['CAMPAIGN_ANNOUNCEMENT', 'SKIPPED'],
    ]);
    await prefs.PATCH(customerRequest('/x', { method: 'PATCH', token: c.token, body: { marketingOptIn: true } }));
    await notify(c.user.id, { type: 'CAMPAIGN_ANNOUNCEMENT', title: 't', body: 'b', email: { subject: 's', content: { heading: 'h', paragraphs: [] } } });
    expect((await prisma.emailMessage.findFirstOrThrow({ where: { userId: c.user.id }, orderBy: { createdAt: 'desc' } })).status).toBe('SENT');
    expect((await prefs.PATCH(customerRequest('/x', { method: 'PATCH', token: c.token, body: { isAdmin: true } }))).status).toBe(400);
  });

  it('order lifecycle creates in-app notifications; customers only read their own', async () => {
    await setupDelivery();
    setEmailProviderForTests(fakeProvider().p);
    const { product } = await makeSellable({ sku: 'MUG', pricePaise: 6000 });
    const c = await createCustomer();
    const a = await createAddress(c.user.id, VALID_ADDRESS);
    await addItem({ userId: c.user.id }, { productId: product.id, quantity: 2 });
    const placed = await placeOrder(c.user.id, { addressId: a.id, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: randomUUID() });
    const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber: placed.orderNumber } });
    await notifyOrderStatus(o.id, 'OUT_FOR_DELIVERY');
    const route = await import(`${S}/account/notifications/route`);
    const mine = await (await route.GET(customerRequest('/x', { token: c.token }))).json();
    expect(mine.items.map((n: { type: string }) => n.type)).toEqual(['ORDER_STATUS', 'ORDER_CONFIRMATION']);
    expect(mine.unread).toBe(2);
    const other = await createCustomer('other');
    const r = await route.PATCH(customerRequest('/x', { method: 'PATCH', token: other.token, body: { ids: mine.items.map((n: { id: string }) => n.id) } }));
    expect((await r.json()).updated).toBe(0); // cannot mark someone else's as read
    const r2 = await (await route.PATCH(customerRequest('/x', { method: 'PATCH', token: c.token, body: { all: true } }))).json();
    expect(r2).toEqual({ updated: 2, unread: 0 });
  });

  it('only signed Resend webhooks can mark delivery; complaints stop marketing email', async () => {
    process.env.RESEND_WEBHOOK_SECRET = 'whsec_' + Buffer.from('test-webhook-secret-32-bytes-long!!').toString('base64');
    resetEnvCache();
    try {
      setEmailProviderForTests(fakeProvider().p);
      const c = await createCustomer();
      await prisma.customerProfile.update({ where: { userId: c.user.id }, data: { marketingOptIn: true } });
      const id = await notify(c.user.id, { type: 'WELCOME', title: 't', body: 'b', email: { subject: 's', content: { heading: 'h', paragraphs: [] } } });
      const msg = await prisma.emailMessage.findUniqueOrThrow({ where: { id: id! } });
      const body = JSON.stringify({ type: 'email.delivered', data: { email_id: msg.providerMessageId } });
      const ts = String(Math.floor(Date.now() / 1000));
      const sign = (raw: string, svixId = 'msg_1') =>
        'v1,' + createHmac('sha256', Buffer.from('test-webhook-secret-32-bytes-long!!')).update(`${svixId}.${ts}.${raw}`).digest('base64');
      await expect(processResendWebhook(body, { id: 'msg_1', timestamp: ts, signature: 'v1,forged' })).rejects.toThrow(/signature/);
      expect((await prisma.emailMessage.findUniqueOrThrow({ where: { id: id! } })).status).toBe('SENT');
      const hook = await import(`${S}/email/resend/webhook/route`);
      const { NextRequest } = await import('next/server');
      const res = await hook.POST(new NextRequest('http://localhost:3000/api/email/resend/webhook', { method: 'POST', body, headers: { 'svix-id': 'msg_1', 'svix-timestamp': ts, 'svix-signature': sign(body) } }));
      expect(res.status).toBe(200);
      expect((await prisma.emailMessage.findUniqueOrThrow({ where: { id: id! } })).status).toBe('DELIVERED');
      const complaint = JSON.stringify({ type: 'email.complained', data: { email_id: msg.providerMessageId } });
      await processResendWebhook(complaint, { id: 'msg_2', timestamp: ts, signature: sign(complaint, 'msg_2') });
      expect((await prisma.customerProfile.findUniqueOrThrow({ where: { userId: c.user.id } })).marketingOptIn).toBe(false);
    } finally {
      delete process.env.RESEND_WEBHOOK_SECRET;
      resetEnvCache();
    }
  });

  it('the Resend adapter only reports success when the API returns a message id', async () => {
    const calls: RequestInit[] = [];
    const ok = createResendProvider({ apiKey: 're_test', from: '20Mart <orders@example.com>', fetchImpl: (async (_u: string, init: RequestInit) => (calls.push(init), new Response(JSON.stringify({ id: 'abc' }), { status: 200 }))) as unknown as typeof fetch });
    expect(await ok.send({ to: 'a@example.com', subject: 's', html: '<p>x</p>', idempotencyKey: 'k1' })).toEqual({ id: 'abc' });
    expect((calls[0].headers as Record<string, string>)['Idempotency-Key']).toBe('k1');
    const bad = createResendProvider({ apiKey: 're_test', from: 'x@example.com', fetchImpl: (async () => new Response(JSON.stringify({ message: 'Domain not verified' }), { status: 403 })) as unknown as typeof fetch });
    await expect(bad.send({ to: 'a@example.com', subject: 's', html: 'x', idempotencyKey: 'k2' })).rejects.toMatchObject({ message: 'Domain not verified', retryable: false });
  });
});

describe('customer management', () => {
  it('lists without secrets, hides addresses without orders.view, and suspension signs the customer out', async () => {
    const c = await createCustomer();
    await createAddress(c.user.id, VALID_ADDRESS);
    const list = await import(`${A}/customers/route`);
    const one = await import(`${A}/customers/[id]/route`);
    const status = await import(`${A}/customers/[id]/status/route`);
    const mm = await adminSession('marketer', ['MARKETING_MANAGER']); // customers.view, no orders.view
    const listed = await (await list.GET(adminRequest('/x?q=cust', { token: mm.token }))).json();
    expect(listed.total).toBe(1);
    const raw = JSON.stringify(listed);
    expect(raw).not.toContain('googleSubjectId');
    expect(raw).not.toContain(c.user.googleSubjectId!);
    const detail = await (await one.GET(adminRequest('/x', { token: mm.token }), ctxParams({ id: c.user.id }))).json();
    expect(detail.addresses).toBeNull();
    expect(detail.orders).toBeNull();
    expect(JSON.stringify(detail)).not.toMatch(/tokenHash|googleSubjectId/);
    const om = await adminSession('ordermgr', ['ORDER_MANAGER']);
    const full = await (await one.GET(adminRequest('/x', { token: om.token }), ctxParams({ id: c.user.id }))).json();
    expect(full.addresses).toHaveLength(1);

    // customers.update is required to suspend.
    expect((await status.PATCH(adminRequest('/x', { method: 'PATCH', token: mm.token, body: { status: 'SUSPENDED', reason: 'Fraud check' } }), ctxParams({ id: c.user.id }))).status).toBe(403);
    const admin = await adminSession('boss', ['ADMIN']);
    const r = await status.PATCH(adminRequest('/x', { method: 'PATCH', token: admin.token, body: { status: 'SUSPENDED', reason: 'Fraud check' } }), ctxParams({ id: c.user.id }));
    expect(await r.json()).toMatchObject({ status: 'SUSPENDED', sessionsRevoked: 1 });
    const me = await import(`${S}/account/profile/route`);
    expect((await me.GET(customerRequest('/x', { token: c.token }))).status).toBe(401);
    expect(await prisma.adminAuditLog.count({ where: { category: 'CUSTOMER', entityId: c.user.id } })).toBe(1);
  });
});

describe('delivery zones', () => {
  it('zone fee, estimate and minimum apply unless the PIN overrides; paused zones are not serviceable', async () => {
    await setupDelivery();
    const admin = await adminSession('boss', ['ADMIN']);
    const zones = await import(`${A}/delivery/zones/route`);
    const res = await zones.POST(adminRequest('/x', { method: 'POST', token: admin.token, body: { name: 'West Ahmedabad', deliveryFeePaise: 2500, estimateHours: 6, minOrderPaise: 5000 } }));
    expect(res.status).toBe(201);
    const zone = await res.json();
    await prisma.serviceablePincode.update({ where: { pincode: '380015' }, data: { zoneId: zone.id } });
    // A zone with no warehouse mapped is not deliverable (no fake promise).
    expect(await checkServiceability('380015')).toMatchObject({ serviceable: false, code: 'NOT_CONFIGURED' });
    await prisma.warehouseDeliveryZone.create({ data: { warehouseId: (await testWarehouse()).id, zoneId: zone.id } });
    const s = await checkServiceability('380015');
    expect(s).toMatchObject({ serviceable: true, feePaise: 2500, estimateHours: 6, zone: 'West Ahmedabad', minOrderPaise: 5000 });
    expect((await quoteDelivery(4000, '380015')).blockers[0]).toMatch(/₹50/);
    await prisma.serviceablePincode.update({ where: { pincode: '380015' }, data: { deliveryFeePaise: 1000 } });
    expect((await checkServiceability('380015')).feePaise).toBe(1000); // PIN override wins
    const one = await import(`${A}/delivery/zones/[id]/route`);
    await one.PATCH(adminRequest('/x', { method: 'PATCH', token: admin.token, body: { name: 'West Ahmedabad', isActive: false } }), ctxParams({ id: zone.id }));
    expect((await checkServiceability('380015')).serviceable).toBe(false);
    const om = await adminSession('ordermgr', ['ORDER_MANAGER']); // delivery.view only
    expect((await zones.GET(adminRequest('/x', { token: om.token }))).status).toBe(200);
    expect((await zones.POST(adminRequest('/x', { method: 'POST', token: om.token, body: { name: 'East' } }))).status).toBe(403);
  });
});

describe('analytics', () => {
  it('IST date presets resolve to correct boundaries', () => {
    const now = new Date('2026-11-15T20:00:00Z'); // 16 Nov 01:30 IST
    expect(resolveRange({ range: 'today' }, now)).toMatchObject({ fromDate: '2026-11-16', toDate: '2026-11-16' });
    expect(resolveRange({ range: 'today' }, now).start.toISOString()).toBe('2026-11-15T18:30:00.000Z');
    expect(resolveRange({ range: '7d' }, now)).toMatchObject({ fromDate: '2026-11-10', toDate: '2026-11-16' });
    expect(resolveRange({ range: 'month' }, now)).toMatchObject({ fromDate: '2026-11-01' });
    expect(resolveRange({ range: 'custom', from: '2026-10-01', to: '2026-10-31' }, now)).toMatchObject({ fromDate: '2026-10-01', toDate: '2026-10-31' });
    expect(() => resolveRange({ range: 'custom', from: '2026-10-31', to: '2026-10-01' }, now)).toThrow();
  });

  it('counts only captured payments as revenue and nets processed refunds', async () => {
    await setupDelivery();
    const c = await createCustomer();
    const base = { userId: c.user.id, deliveryChargePaise: 0, discountPaise: 0, taxPaise: 0, paymentMethod: 'CASH_ON_DELIVERY' as const, shipName: 'x', shipPhone: '9876543210', shipLine1: 'x', shipCity: 'x', shipState: 'Gujarat', shipPincode: '380015' };
    const mk = (n: string, total: number, paymentStatus: 'PAID' | 'PENDING' | 'FAILED' | 'PARTIALLY_REFUNDED', status: 'DELIVERED' | 'PENDING' | 'CANCELLED' = 'DELIVERED') =>
      prisma.order.create({ data: { ...base, orderNumber: `ZM261115-${n}`, idempotencyKey: randomUUID(), subtotalPaise: total, totalPaise: total, paymentStatus, status } });
    await mk('AAAAA1', 10000, 'PAID');
    const partly = await mk('AAAAA2', 20000, 'PARTIALLY_REFUNDED');
    await mk('AAAAA3', 50000, 'PENDING', 'PENDING'); // unpaid → not revenue
    await mk('AAAAA4', 70000, 'FAILED', 'CANCELLED');
    await prisma.refund.create({ data: { orderId: partly.id, provider: 'MANUAL', amountPaise: 5000, status: 'PROCESSED', reason: 'Damaged item', processedAt: new Date() } });
    await prisma.refund.create({ data: { orderId: partly.id, provider: 'MANUAL', amountPaise: 3000, status: 'PENDING', reason: 'Late' } }); // not confirmed → not netted
    const r = await getAnalytics({ range: 'today' });
    expect(r.sales).toMatchObject({ grossPaidRevenuePaise: 30000, refundedPaise: 5000, netRevenuePaise: 25000, paidOrders: 2, averageOrderValuePaise: 15000 });
    expect(r.orders).toMatchObject({ placed: 4, awaiting: 1, cancelled: 1 });
    expect(r.customers).toMatchObject({ buyers: 1, repeatBuyers: 1 });
    expect(r.series.at(-1)).toMatchObject({ revenuePaise: 30000, orders: 2 });
    const route = await import(`${A}/analytics/route`);
    const inv = await adminSession('invmgr', ['INVENTORY_MANAGER']);
    expect((await route.GET(adminRequest('/x', { token: inv.token }))).status).toBe(403);
    const mm = await adminSession('marketer', ['MARKETING_MANAGER']);
    expect((await route.GET(adminRequest('/x?range=custom&from=2026-11-20&to=2026-11-01', { token: mm.token }))).status).toBe(400);
  });
});
