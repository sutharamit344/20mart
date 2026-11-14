import { beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@20mart/database';
import { addItem } from '../src/cart';
import { createAddress, updateAddress } from '../src/addresses';
import { checkServiceability, quoteDelivery } from '../src/delivery';
import { customerCancelOrder, expireStaleReservations, getCustomerOrder, listCustomerOrders, placeOrder } from '../src/orders';
import { toAppError } from '../src/errors';
import { createCustomer, makeSellable, resetDb, setupDelivery, VALID_ADDRESS } from './helpers';

beforeEach(async () => {
  await resetDb();
  await setupDelivery();
});
const errOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return toAppError(e);
  }
  throw new Error('expected failure');
};
const inv = (id: string) => prisma.inventory.findUniqueOrThrow({ where: { id } });

async function readyCustomer(productId: string, qty = 1) {
  const c = await createCustomer();
  const address = await createAddress(c.user.id, VALID_ADDRESS);
  await addItem({ userId: c.user.id }, { productId, quantity: qty });
  return { ...c, address };
}

describe('addresses and delivery serviceability', () => {
  it('validates Indian phone numbers, PIN codes and states', async () => {
    const { user } = await createCustomer();
    expect((await errOf(createAddress(user.id, { ...VALID_ADDRESS, phone: '12345' }))).status).toBe(400);
    expect((await errOf(createAddress(user.id, { ...VALID_ADDRESS, pincode: '012345' }))).status).toBe(400);
    expect((await errOf(createAddress(user.id, { ...VALID_ADDRESS, state: 'Atlantis' }))).status).toBe(400);
    const a = await createAddress(user.id, { ...VALID_ADDRESS, phone: '+91 98765-43210' });
    expect(a.phone).toBe('9876543210');
    expect(a.isDefault).toBe(true); // first address becomes default
    const b = await createAddress(user.id, { ...VALID_ADDRESS, name: 'Work', isDefault: true });
    expect(await prisma.address.count({ where: { userId: user.id, isDefault: true } })).toBe(1);
    expect(b.isDefault).toBe(true);
    const other = await createCustomer('other');
    expect((await errOf(updateAddress(other.user.id, a.id, VALID_ADDRESS))).status).toBe(404);
  });

  it('only configured PIN codes are serviceable; fees and minimums come from settings', async () => {
    expect((await checkServiceability('380015')).serviceable).toBe(true);
    expect((await checkServiceability('110001')).serviceable).toBe(false); // not configured → not promised
    await prisma.serviceablePincode.create({ data: { pincode: '380009', isServiceable: false } });
    expect((await checkServiceability('380009')).serviceable).toBe(false);
    expect((await quoteDelivery(1000, '380015')).blockers[0]).toMatch(/Minimum order/);
    expect((await quoteDelivery(5000, '380015')).deliveryChargePaise).toBe(4000);
    expect((await quoteDelivery(20000, '380015')).deliveryChargePaise).toBe(0); // free above ₹199
    await prisma.storeSettings.update({ where: { id: 'default' }, data: { defaultEstimateHours: 48 } });
    expect((await checkServiceability('380015')).estimateText).toMatch(/2 days/);
  });
});

describe('order placement', () => {
  it('creates an order with server-computed totals, immutable snapshots, reserved stock and a converted cart', async () => {
    const { product, inventoryId } = await makeSellable({ sku: 'ZM-ORD', name: 'Peeler', pricePaise: 2000, mrpPaise: 3000, stock: 10 });
    const c = await readyCustomer(product.id, 3);
    const res = await placeOrder(c.user.id, {
      addressId: c.address.id,
      paymentMethod: 'CASH_ON_DELIVERY',
      idempotencyKey: randomUUID(),
      totalPaise: 1, // tampered client total must be ignored
      subtotalPaise: 1,
    } as never);
    expect(res.orderNumber).toMatch(/^ZM\d{6}-[0-9A-Z]{6}$/);
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber: res.orderNumber }, include: { items: true, payments: true, history: true } });
    expect(order.subtotalPaise).toBe(6000);
    expect(order.deliveryChargePaise).toBe(4000);
    expect(order.totalPaise).toBe(10000);
    expect(order.shipPincode).toBe('380015');
    expect(order.items[0]).toMatchObject({ productName: 'Peeler', productSku: 'ZM-ORD', unitPricePaise: 2000, quantity: 3, totalPricePaise: 6000 });
    expect(order.payments[0]).toMatchObject({ provider: 'COD', status: 'PENDING', amountPaise: 10000 });
    expect(order.history.map((h) => h.toStatus)).toEqual(['PENDING']);
    expect(await inv(inventoryId)).toMatchObject({ availableQuantity: 10, reservedQuantity: 3 });
    expect((await prisma.cart.findFirstOrThrow({ where: { userId: c.user.id } })).status).toBe('CONVERTED');
    // Editing the product later does not change the order snapshot.
    await prisma.product.update({ where: { id: product.id }, data: { name: 'Renamed', sellingPricePaise: 9900, mrpPaise: 9900 } });
    expect((await getCustomerOrder(c.user.id, res.orderNumber)).items[0]).toMatchObject({ productName: 'Peeler', unitPricePaise: 2000 });
  });

  it('is idempotent: repeated submits with the same key return the same order', async () => {
    const { product, inventoryId } = await makeSellable({ sku: 'ZM-IDEM', stock: 10 });
    const c = await readyCustomer(product.id, 2);
    const key = randomUUID();
    const body = { addressId: c.address.id, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: key };
    const results = await Promise.all([placeOrder(c.user.id, body), placeOrder(c.user.id, body), placeOrder(c.user.id, body)]);
    expect(new Set(results.map((r) => r.orderNumber)).size).toBe(1);
    expect(await prisma.order.count()).toBe(1);
    expect((await inv(inventoryId)).reservedQuantity).toBe(2);
  });

  it('blocks non-serviceable PINs, other customers’ addresses, empty carts, disabled methods and changed carts', async () => {
    const { product, inventoryId } = await makeSellable({ sku: 'ZM-BLK', stock: 5 });
    const c = await readyCustomer(product.id, 2);
    const farAddress = await createAddress(c.user.id, { ...VALID_ADDRESS, pincode: '110001', state: 'Delhi', city: 'Delhi' });
    const key = () => randomUUID();
    expect((await errOf(placeOrder(c.user.id, { addressId: farAddress.id, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: key() }))).message).toMatch(/do not deliver/);
    const stranger = await createCustomer('stranger');
    expect((await errOf(placeOrder(stranger.user.id, { addressId: c.address.id, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: key() }))).status).toBe(404);
    expect((await errOf(placeOrder(c.user.id, { addressId: c.address.id, paymentMethod: 'ONLINE', idempotencyKey: key() }))).code).toBe('PAYMENT_METHOD_UNAVAILABLE');
    await prisma.inventory.update({ where: { id: inventoryId }, data: { availableQuantity: 1 } });
    expect((await errOf(placeOrder(c.user.id, { addressId: c.address.id, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: key() }))).code).toBe('CART_NEEDS_ATTENTION');
    const empty = await createCustomer('empty');
    const ea = await createAddress(empty.user.id, VALID_ADDRESS);
    expect((await errOf(placeOrder(empty.user.id, { addressId: ea.id, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: key() }))).message).toMatch(/empty/);
    expect(await prisma.order.count()).toBe(0);
    expect((await inv(inventoryId)).reservedQuantity).toBe(0);
  });

  it('never oversells: 20 customers race for the last 3 units', async () => {
    const { product, inventoryId } = await makeSellable({ sku: 'ZM-LAST', pricePaise: 10000, stock: 3 });
    const buyers = [];
    for (let i = 0; i < 20; i++) buyers.push(await readyCustomer(product.id, 1));
    const results = await Promise.allSettled(
      buyers.map((b) => placeOrder(b.user.id, { addressId: b.address.id, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: randomUUID() }))
    );
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(ok).toHaveLength(3);
    expect(failed).toHaveLength(17);
    expect(failed.every((f) => toAppError(f.reason).status === 409)).toBe(true);
    const row = await inv(inventoryId);
    expect(row).toMatchObject({ availableQuantity: 3, reservedQuantity: 3 });
    expect(await prisma.order.count()).toBe(3);
    expect(await prisma.stockMovement.count({ where: { inventoryId, movementType: 'RESERVATION' } })).toBe(3);
  }, 120_000);
});

describe('customer order history, cancellation and expiry', () => {
  it('lists only own orders; other customers get 404', async () => {
    const { product } = await makeSellable({ sku: 'ZM-HIST', stock: 10 });
    const a = await readyCustomer(product.id);
    const order = await placeOrder(a.user.id, { addressId: a.address.id, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: randomUUID() });
    const b = await createCustomer('b');
    expect((await listCustomerOrders(a.user.id)).total).toBe(1);
    expect((await listCustomerOrders(b.user.id)).total).toBe(0);
    expect((await errOf(getCustomerOrder(b.user.id, order.orderNumber))).status).toBe(404);
    expect((await errOf(customerCancelOrder(b.user.id, order.orderNumber, { reason: 'not mine' }))).status).toBe(404);
  });

  it('customer cancellation releases reserved stock and records history', async () => {
    const { product, inventoryId } = await makeSellable({ sku: 'ZM-CAN', stock: 4 });
    const c = await readyCustomer(product.id, 2);
    const o = await placeOrder(c.user.id, { addressId: c.address.id, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: randomUUID() });
    await customerCancelOrder(c.user.id, o.orderNumber, { reason: 'Ordered by mistake' });
    expect(await inv(inventoryId)).toMatchObject({ availableQuantity: 4, reservedQuantity: 0 });
    const detail = await getCustomerOrder(c.user.id, o.orderNumber);
    expect(detail.status).toBe('CANCELLED');
    expect(detail.history.map((h) => h.status)).toEqual(['PENDING', 'CANCELLED']);
    // Second cancel is rejected and stock is not released twice.
    expect((await errOf(customerCancelOrder(c.user.id, o.orderNumber, { reason: 'again' }))).status).toBe(409);
    expect((await inv(inventoryId)).reservedQuantity).toBe(0);
  });

  it('expires abandoned online payments and releases their stock', async () => {
    const { product, inventoryId } = await makeSellable({ sku: 'ZM-EXP', stock: 5 });
    const c = await readyCustomer(product.id, 2);
    const order = await prisma.order.create({
      data: {
        orderNumber: 'ZM261115-EXPIRE',
        userId: c.user.id,
        shipName: 'x', shipPhone: '9876543210', shipLine1: 'x', shipCity: 'x', shipState: 'Gujarat', shipPincode: '380015',
        subtotalPaise: 4000, totalPaise: 4000, paymentMethod: 'ONLINE', idempotencyKey: randomUUID(),
        reservationExpiresAt: new Date(Date.now() - 1000),
        items: { create: { productId: product.id, inventoryId, productName: 'x', productSku: 'ZM-EXP', quantity: 2, unitPricePaise: 2000, mrpPaise: 2000, totalPricePaise: 4000 } },
      },
    });
    await prisma.inventory.update({ where: { id: inventoryId }, data: { reservedQuantity: 2 } });
    expect((await expireStaleReservations()).expired).toBe(1);
    expect((await expireStaleReservations()).expired).toBe(0); // idempotent
    const after = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after).toMatchObject({ status: 'FAILED', paymentStatus: 'FAILED', inventoryHold: 'RELEASED' });
    expect((await inv(inventoryId)).reservedQuantity).toBe(0);
  });
});
