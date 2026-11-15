import { beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@20mart/database';
import { addItem } from '../src/cart';
import { createAddress } from '../src/addresses';
import { placeOrder } from '../src/orders';
import { adminRequest, adminSession, createCustomer, ctxParams, customerRequest, makeSellable, resetDb, setupDelivery, VALID_ADDRESS } from './helpers';

const STORE = '../../../apps/20mart/src/app/api';
const ADMIN = '../../../apps/20martadmin/src/app/api/admin';

beforeEach(async () => {
  await resetDb();
  await setupDelivery();
});

async function codOrder(stock = 5, qty = 2) {
  const { product, inventoryId } = await makeSellable({ sku: `ZM-R-${randomUUID().slice(0, 5)}`.toUpperCase(), pricePaise: 5000, stock });
  const c = await createCustomer();
  const address = await createAddress(c.user.id, VALID_ADDRESS);
  await addItem({ userId: c.user.id }, { productId: product.id, quantity: qty });
  const res = await placeOrder(c.user.id, { addressId: address.id, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: randomUUID() });
  const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber: res.orderNumber } });
  return { ...c, address, order, inventoryId, product };
}
const inv = (id: string) => prisma.inventory.findUniqueOrThrow({ where: { id } });

describe('storefront customer APIs', () => {
  it('require sign-in for orders, addresses, wishlist and checkout', async () => {
    const orders = await import(`${STORE}/orders/route`);
    const addresses = await import(`${STORE}/account/addresses/route`);
    const wishlist = await import(`${STORE}/wishlist/route`);
    const summary = await import(`${STORE}/checkout/summary/route`);
    expect((await orders.GET(customerRequest('/api/orders'))).status).toBe(401);
    expect((await orders.POST(customerRequest('/api/orders', { method: 'POST', body: {} }))).status).toBe(401);
    expect((await addresses.GET(customerRequest('/api/account/addresses'))).status).toBe(401);
    expect((await wishlist.GET(customerRequest('/api/wishlist'))).status).toBe(401);
    expect((await summary.GET(customerRequest('/api/checkout/summary'))).status).toBe(401);
  });

  it('a customer cannot read or cancel another customer’s order (404), and cross-origin writes are blocked', async () => {
    const a = await codOrder();
    const b = await createCustomer('b');
    const detail = await import(`${STORE}/orders/[orderNumber]/route`);
    const cancel = await import(`${STORE}/orders/[orderNumber]/cancel/route`);
    const p = ctxParams({ orderNumber: a.order.orderNumber });
    expect((await detail.GET(customerRequest(`/api/orders/${a.order.orderNumber}`, { token: a.token }), p)).status).toBe(200);
    expect((await detail.GET(customerRequest(`/api/orders/${a.order.orderNumber}`, { token: b.token }), p)).status).toBe(404);
    expect((await cancel.POST(customerRequest('/x', { method: 'POST', token: b.token, body: { reason: 'hijack' } }), p)).status).toBe(404);
    expect((await cancel.POST(customerRequest('/x', { method: 'POST', token: a.token, origin: 'https://evil.example', body: { reason: 'csrf' } }), p)).status).toBe(403);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: a.order.id } })).status).toBe('PENDING');
  });

  it('ignores client-supplied prices/totals and cannot touch another cart’s items', async () => {
    const { product } = await makeSellable({ sku: 'ZM-PRICE', pricePaise: 6000, stock: 5 });
    const a = await createCustomer('a');
    const b = await createCustomer('b');
    const items = await import(`${STORE}/cart/items/route`);
    const item = await import(`${STORE}/cart/items/[itemId]/route`);
    const res = await items.POST(customerRequest('/api/cart/items', { method: 'POST', token: a.token, body: { productId: product.id, quantity: 1, pricePaise: 1, subtotalPaise: 1 } }));
    const cart = await res.json();
    expect(cart.lines[0].unitPricePaise).toBe(6000);
    expect(cart.subtotalPaise).toBe(6000);
    const lineId = cart.lines[0].id;
    const hijack = await item.PATCH(customerRequest('/x', { method: 'PATCH', token: b.token, body: { quantity: 3 } }), ctxParams({ itemId: lineId }));
    expect(hijack.status).toBe(404);
  });

  it('guest cart cookie is issued on first add and only that cookie can read it', async () => {
    const { product } = await makeSellable({ sku: 'ZM-GUEST', stock: 5 });
    const items = await import(`${STORE}/cart/items/route`);
    const cartRoute = await import(`${STORE}/cart/route`);
    const res = await items.POST(customerRequest('/api/cart/items', { method: 'POST', body: { productId: product.id } }));
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/20m_cart=/);
    expect(setCookie.toLowerCase()).toContain('httponly');
    const token = /20m_cart=([^;]+)/.exec(setCookie)![1];
    expect((await (await cartRoute.GET(customerRequest('/api/cart', { guestToken: token }))).json()).totalQuantity).toBe(1);
    expect((await (await cartRoute.GET(customerRequest('/api/cart', { guestToken: 'someone-else' }))).json()).totalQuantity).toBe(0);
  });

  it('forged webhooks are rejected at the route', async () => {
    const webhook = await import(`${STORE}/payments/razorpay/webhook/route`);
    const res = await webhook.POST(customerRequest('/api/payments/razorpay/webhook', { method: 'POST', origin: null, body: '{"event":"payment.captured"}' }));
    expect([401, 503]).toContain(res.status); // 503 when Razorpay is not configured, 401 for a bad signature
  });
});

describe('admin order management', () => {
  it('customers and unauthorized staff cannot use admin order APIs', async () => {
    const a = await codOrder();
    const list = await import(`${ADMIN}/orders/route`);
    const status = await import(`${ADMIN}/orders/[id]/status/route`);
    expect((await list.GET(adminRequest('/api/admin/orders', { token: a.token }))).status).toBe(401); // customer session token
    const im = await adminSession('invmgr', ['INVENTORY_MANAGER']);
    expect((await list.GET(adminRequest('/api/admin/orders', { token: im.token }))).status).toBe(403);
    const res = await status.POST(adminRequest('/x', { method: 'POST', token: im.token, body: { toStatus: 'CONFIRMED' } }), ctxParams({ id: a.order.id }));
    expect(res.status).toBe(403);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: a.order.id } })).status).toBe('PENDING');
  });

  it('walks a COD order through fulfilment, committing stock once and recording cash on delivery', async () => {
    const a = await codOrder(5, 2);
    const om = await adminSession('ordermgr', ['ORDER_MANAGER']);
    const status = await import(`${ADMIN}/orders/[id]/status/route`);
    const go = (toStatus: string) => status.POST(adminRequest('/x', { method: 'POST', token: om.token, body: { toStatus } }), ctxParams({ id: a.order.id }));

    expect((await go('PACKED')).status).toBe(409); // cannot skip steps
    expect((await go('CONFIRMED')).status).toBe(200);
    expect(await inv(a.inventoryId)).toMatchObject({ availableQuantity: 3, reservedQuantity: 0 });
    expect((await go('CONFIRMED')).status).toBe(409); // no double confirmation / double deduction
    for (const s of ['PROCESSING', 'PACKED', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERED']) expect((await go(s)).status).toBe(200);
    const o = await prisma.order.findUniqueOrThrow({ where: { id: a.order.id }, include: { history: true, payments: true } });
    expect(o).toMatchObject({ status: 'DELIVERED', paymentStatus: 'PAID' });
    expect(o.deliveredAt).toBeInstanceOf(Date);
    expect(o.payments[0].status).toBe('PAID');
    expect(o.history.map((h) => h.toStatus)).toEqual(['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY', 'DELIVERED']);
    expect(await inv(a.inventoryId)).toMatchObject({ availableQuantity: 3, reservedQuantity: 0 });
    expect(await prisma.stockMovement.count({ where: { inventoryId: a.inventoryId, movementType: 'SALE' } })).toBe(1);
    // Delivered orders cannot be cancelled.
    const cancel = await import(`${ADMIN}/orders/[id]/cancel/route`);
    expect((await cancel.POST(adminRequest('/x', { method: 'POST', token: om.token, body: { reason: 'too late' } }), ctxParams({ id: a.order.id }))).status).toBe(409);
  });

  it('cancelling after confirmation restocks; ORDER_MANAGER cannot refund', async () => {
    const a = await codOrder(5, 2);
    const om = await adminSession('ordermgr', ['ORDER_MANAGER']);
    const status = await import(`${ADMIN}/orders/[id]/status/route`);
    const cancel = await import(`${ADMIN}/orders/[id]/cancel/route`);
    await status.POST(adminRequest('/x', { method: 'POST', token: om.token, body: { toStatus: 'CONFIRMED' } }), ctxParams({ id: a.order.id }));
    const res = await cancel.POST(adminRequest('/x', { method: 'POST', token: om.token, body: { reason: 'Customer called to cancel' } }), ctxParams({ id: a.order.id }));
    expect(res.status).toBe(200);
    expect(await inv(a.inventoryId)).toMatchObject({ availableQuantity: 5, reservedQuantity: 0 });
    const o = await prisma.order.findUniqueOrThrow({ where: { id: a.order.id } });
    expect(o).toMatchObject({ status: 'CANCELLED', inventoryHold: 'RELEASED', cancelReason: 'Customer called to cancel' });
    const refund = await import(`${ADMIN}/refunds/[id]/initiate/route`);
    expect((await refund.POST(adminRequest('/x', { method: 'POST', token: om.token, body: {} }), ctxParams({ id: randomUUID() }))).status).toBe(403);
  });

  it('dashboard revenue counts only paid orders', async () => {
    await codOrder(); // pending COD, unpaid
    const { getOrderStats } = await import('../src/admin-orders');
    const stats = await getOrderStats();
    expect(stats.totalOrders).toBe(1);
    expect(stats.pending).toBe(1);
    expect(stats.paidRevenuePaise).toBe(0);
  });
});
