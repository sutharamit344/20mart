import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import { prisma } from '@20mart/database';
import { addItem } from '../src/cart';
import { createAddress } from '../src/addresses';
import { expireStaleReservations, markPaymentCaptured, placeOrder, retryPayment, verifyCheckoutPayment } from '../src/orders';
import { adminCancelOrder, initiateRefund } from '../src/admin-orders';
import { createRazorpayProvider, setPaymentProviderForTests } from '../src/payments';
import { processRazorpayWebhook } from '../src/payments/webhook';
import { toAppError } from '../src/errors';
import { adminSession, createCustomer, makeSellable, resetDb, setupDelivery, VALID_ADDRESS } from './helpers';

const KEY_SECRET = 'test_key_secret';
const WEBHOOK_SECRET = 'test_webhook_secret';

/** Minimal in-memory Razorpay API used behind the real adapter. */
function fakeRazorpay() {
  let seq = 0;
  const orders = new Map<string, { amount: number }>();
  const payments = new Map<string, { id: string; order_id: string; amount: number; status: string; error_description?: string }>();
  const refunds = new Map<string, { id: string; payment_id: string; amount: number; status: string }>();
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const u = new URL(String(url));
    const path = u.pathname.replace('/v1', '');
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (init?.method === 'POST' && path === '/orders') {
      const id = `order_${++seq}`;
      orders.set(id, { amount: body.amount });
      return json({ id, amount: body.amount, currency: 'INR' });
    }
    let m = /^\/payments\/([^/]+)$/.exec(path);
    if (m) return payments.has(m[1]) ? json(payments.get(m[1])) : json({ error: { description: 'not found' } }, 404);
    m = /^\/payments\/([^/]+)\/capture$/.exec(path);
    if (m) {
      const p = payments.get(m[1])!;
      p.status = 'captured';
      return json(p);
    }
    m = /^\/payments\/([^/]+)\/refund$/.exec(path);
    if (m) {
      const id = `rfnd_${++seq}`;
      refunds.set(id, { id, payment_id: m[1], amount: body.amount, status: 'pending' });
      return json(refunds.get(id));
    }
    m = /^\/refunds\/([^/]+)$/.exec(path);
    if (m) return json(refunds.get(m[1]));
    return json({ error: { description: 'unsupported' } }, 400);
  }) as typeof fetch;
  return {
    fetchImpl,
    /** Simulate the customer completing payment at Razorpay. */
    pay(orderId: string, opts: { status?: string; amount?: number } = {}) {
      const id = `pay_${++seq}`;
      payments.set(id, { id, order_id: orderId, amount: opts.amount ?? orders.get(orderId)!.amount, status: opts.status ?? 'captured' });
      return id;
    },
    refunds,
  };
}

const sign = (data: string, secret: string) => createHmac('sha256', secret).update(data).digest('hex');
const webhook = (event: unknown, eventId: string = randomUUID(), secret: string = WEBHOOK_SECRET) => {
  const raw = JSON.stringify(event);
  return processRazorpayWebhook(raw, sign(raw, secret), eventId);
};
const errOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return toAppError(e);
  }
  throw new Error('expected failure');
};

let rz: ReturnType<typeof fakeRazorpay>;
beforeEach(async () => {
  await resetDb();
  await setupDelivery({ onlinePaymentEnabled: true });
  rz = fakeRazorpay();
  setPaymentProviderForTests(createRazorpayProvider({ keyId: 'rzp_test_key', keySecret: KEY_SECRET, webhookSecret: WEBHOOK_SECRET, fetchImpl: rz.fetchImpl }));
});
afterAll(() => setPaymentProviderForTests(null));

async function onlineOrder(stock = 5, qty = 2) {
  const { product, inventoryId } = await makeSellable({ sku: `ZM-ON-${randomUUID().slice(0, 6)}`.toUpperCase(), pricePaise: 5000, stock });
  const c = await createCustomer();
  const address = await createAddress(c.user.id, VALID_ADDRESS);
  await addItem({ userId: c.user.id }, { productId: product.id, quantity: qty });
  const res = await placeOrder(c.user.id, { addressId: address.id, paymentMethod: 'ONLINE', idempotencyKey: randomUUID() });
  return { ...c, res, inventoryId };
}
const inv = (id: string) => prisma.inventory.findUniqueOrThrow({ where: { id } });
const orderOf = (orderNumber: string) => prisma.order.findUniqueOrThrow({ where: { orderNumber }, include: { payments: true, refunds: true, history: true } });

describe('online checkout verification', () => {
  it('confirms only after signature + provider status + amount checks, and commits stock exactly once', async () => {
    const { user, res, inventoryId } = await onlineOrder();
    expect(res.payment).toMatchObject({ provider: 'RAZORPAY', keyId: 'rzp_test_key', amountPaise: 10000 + 4000 });
    const providerOrderId = res.payment!.providerOrderId;
    const payId = rz.pay(providerOrderId);

    // Forged browser callback: bad signature → rejected, order untouched.
    expect((await errOf(verifyCheckoutPayment(user.id, { razorpay_order_id: providerOrderId, razorpay_payment_id: payId, razorpay_signature: 'ab'.repeat(32) }))).code).toBe('BAD_SIGNATURE');
    expect((await orderOf(res.orderNumber)).status).toBe('PENDING');

    const good = { razorpay_order_id: providerOrderId, razorpay_payment_id: payId, razorpay_signature: sign(`${providerOrderId}|${payId}`, KEY_SECRET) };
    expect(await verifyCheckoutPayment(user.id, good)).toMatchObject({ status: 'confirmed' });
    expect(await verifyCheckoutPayment(user.id, good)).toMatchObject({ status: 'already_paid' }); // duplicate callback
    const o = await orderOf(res.orderNumber);
    expect(o).toMatchObject({ status: 'CONFIRMED', paymentStatus: 'PAID', inventoryHold: 'COMMITTED' });
    expect(o.payments[0]).toMatchObject({ status: 'PAID', providerPaymentId: payId });
    expect(await inv(inventoryId)).toMatchObject({ availableQuantity: 3, reservedQuantity: 0 });
    expect(await prisma.stockMovement.count({ where: { inventoryId, movementType: 'SALE' } })).toBe(1);
  });

  it('rejects amount mismatches and someone else’s payment', async () => {
    const { user, res } = await onlineOrder();
    const providerOrderId = res.payment!.providerOrderId;
    const payId = rz.pay(providerOrderId, { amount: 100 });
    const body = { razorpay_order_id: providerOrderId, razorpay_payment_id: payId, razorpay_signature: sign(`${providerOrderId}|${payId}`, KEY_SECRET) };
    expect((await errOf(verifyCheckoutPayment(user.id, body))).code).toBe('AMOUNT_MISMATCH');
    const other = await createCustomer('other');
    expect((await errOf(verifyCheckoutPayment(other.user.id, body))).status).toBe(404);
    expect((await orderOf(res.orderNumber)).paymentStatus).toBe('PENDING');
  });

  it('handles failure then retry with a new payment attempt', async () => {
    const { user, res } = await onlineOrder();
    const first = res.payment!.providerOrderId;
    const failedPay = rz.pay(first, { status: 'failed' });
    await webhook({ event: 'payment.failed', payload: { payment: { entity: { id: failedPay, order_id: first, amount: 14000, status: 'failed', error_description: 'Card declined' } } } });
    let o = await orderOf(res.orderNumber);
    expect(o).toMatchObject({ status: 'PENDING', paymentStatus: 'FAILED' });
    const retry = await retryPayment(user.id, res.orderNumber);
    expect(retry.providerOrderId).not.toBe(first);
    const payId = rz.pay(retry.providerOrderId);
    await webhook({ event: 'payment.captured', payload: { payment: { entity: { id: payId, order_id: retry.providerOrderId, amount: 14000, status: 'captured' } } } });
    o = await orderOf(res.orderNumber);
    expect(o).toMatchObject({ status: 'CONFIRMED', paymentStatus: 'PAID' });
    expect(o.payments.map((p) => [p.attempt, p.status])).toEqual([[1, 'FAILED'], [2, 'PAID']]);
  });
});

describe('webhooks', () => {
  it('rejects forged signatures and processes duplicate deliveries once', async () => {
    const { res, inventoryId } = await onlineOrder();
    const po = res.payment!.providerOrderId;
    const payId = rz.pay(po);
    const event = { event: 'payment.captured', payload: { payment: { entity: { id: payId, order_id: po, amount: 14000, status: 'captured' } } } };
    expect((await errOf(webhook(event, 'evt_forged', 'wrong-secret'))).status).toBe(401);
    expect((await errOf(processRazorpayWebhook(JSON.stringify(event), null, 'evt_nosig'))).status).toBe(401);
    expect((await orderOf(res.orderNumber)).status).toBe('PENDING');
    expect(await webhook(event, 'evt_1')).toMatchObject({ duplicate: false });
    expect(await webhook(event, 'evt_1')).toMatchObject({ duplicate: true });
    expect(await webhook(event, 'evt_2')).toMatchObject({ duplicate: false }); // new id, same payment: idempotent anyway
    expect((await inv(inventoryId)).availableQuantity).toBe(3);
    expect(await prisma.stockMovement.count({ where: { inventoryId, movementType: 'SALE' } })).toBe(1);
  });

  it('a payment captured after the order expired triggers a refund request instead of fulfilment', async () => {
    const { res, inventoryId } = await onlineOrder();
    await prisma.order.update({ where: { orderNumber: res.orderNumber }, data: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    await expireStaleReservations();
    const po = res.payment!.providerOrderId;
    const payId = rz.pay(po);
    expect(await markPaymentCaptured(po, payId, 14000)).toMatchObject({ status: 'refund_required' });
    const o = await orderOf(res.orderNumber);
    expect(o).toMatchObject({ status: 'FAILED', paymentStatus: 'REFUND_PENDING' });
    expect(o.refunds[0]).toMatchObject({ status: 'REQUESTED', amountPaise: 14000 });
    expect(await inv(inventoryId)).toMatchObject({ availableQuantity: 5, reservedQuantity: 0 });
  });
});

describe('refunds', () => {
  it('is only marked processed after provider confirmation', async () => {
    const { user, res, inventoryId } = await onlineOrder();
    const po = res.payment!.providerOrderId;
    const payId = rz.pay(po);
    await verifyCheckoutPayment(user.id, { razorpay_order_id: po, razorpay_payment_id: payId, razorpay_signature: sign(`${po}|${payId}`, KEY_SECRET) });
    const { ctx } = await adminSession('refunder', ['ADMIN']);
    const order = await orderOf(res.orderNumber);
    await adminCancelOrder(ctx, order.id, { reason: 'Customer request' });
    let o = await orderOf(res.orderNumber);
    expect(o).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUND_PENDING', inventoryHold: 'RELEASED' });
    expect(await inv(inventoryId)).toMatchObject({ availableQuantity: 5, reservedQuantity: 0 }); // restocked
    const refund = o.refunds[0];
    expect(refund.status).toBe('REQUESTED');

    await initiateRefund(ctx, refund.id);
    o = await orderOf(res.orderNumber);
    expect(o.refunds[0].status).toBe('PENDING'); // provider said "pending" → not complete yet
    expect(o.paymentStatus).toBe('REFUND_PENDING');
    expect((await errOf(initiateRefund(ctx, refund.id))).status).toBe(409); // no double refund

    const providerRefundId = o.refunds[0].providerRefundId!;
    await webhook({ event: 'refund.processed', payload: { refund: { entity: { id: providerRefundId, payment_id: payId, amount: 14000, status: 'processed' } } } });
    o = await orderOf(res.orderNumber);
    expect(o.refunds[0].status).toBe('PROCESSED');
    expect(o.paymentStatus).toBe('REFUNDED');
    expect(rz.refunds.size).toBe(1);
  });
});
