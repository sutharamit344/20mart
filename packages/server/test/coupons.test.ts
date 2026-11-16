import { beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@20mart/database';
import { addItem, getCart } from '../src/cart';
import { createAddress } from '../src/addresses';
import { computeDiscount } from '../src/coupon-engine';
import { applyCouponToCart, grantCoupon, listCustomerCoupons, removeCouponFromCart } from '../src/coupons';
import { onCustomerSignup } from '../src/lifecycle';
import { customerCancelOrder, expireStaleReservations, placeOrder } from '../src/orders';
import { getCheckoutSummary } from '../src/checkout';
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

const DAY = 86_400_000;
async function coupon(over: Record<string, unknown> = {}) {
  return prisma.coupon.create({
    data: { code: 'SAVE50', title: '₹50 off', discountType: 'FIXED', discountValue: 5000, minOrderValuePaise: 10000, isActive: true, perCustomerLimit: 1, ...over },
  });
}

async function shopper(productId: string, qty: number) {
  const c = await createCustomer();
  const address = await createAddress(c.user.id, VALID_ADDRESS);
  await addItem({ userId: c.user.id }, { productId, quantity: qty });
  return { ...c, address };
}
const order = (userId: string, addressId: string) => placeOrder(userId, { addressId, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: randomUUID() });

describe('discount maths', () => {
  it('FIXED never exceeds the eligible subtotal; PERCENT floors and respects the cap', () => {
    expect(computeDiscount({ discountType: 'FIXED', discountValue: 5000, maxDiscountPaise: null }, 12000)).toBe(5000);
    expect(computeDiscount({ discountType: 'FIXED', discountValue: 5000, maxDiscountPaise: null }, 3000)).toBe(3000);
    expect(computeDiscount({ discountType: 'PERCENT', discountValue: 1000, maxDiscountPaise: null }, 12345)).toBe(1234); // 10% floored
    expect(computeDiscount({ discountType: 'PERCENT', discountValue: 2500, maxDiscountPaise: 2000 }, 20000)).toBe(2000); // capped
    expect(computeDiscount({ discountType: 'PERCENT', discountValue: 10000, maxDiscountPaise: null }, 999)).toBe(999);
    expect(computeDiscount({ discountType: 'FIXED', discountValue: 5000, maxDiscountPaise: null }, 0)).toBe(0);
  });
});

describe('coupon validation on the cart', () => {
  it('rejects unknown, inactive, scheduled and expired coupons with clear reasons', async () => {
    const { product } = await makeSellable({ sku: 'MUG', pricePaise: 6000 });
    const c = await shopper(product.id, 2); // ₹120
    expect((await errOf(applyCouponToCart(c.user.id, { code: 'NOPE' }))).message).toMatch(/not valid/);
    const cp = await coupon({ isActive: false });
    expect((await errOf(applyCouponToCart(c.user.id, { code: 'save50' }))).message).toMatch(/not active/);
    await prisma.coupon.update({ where: { id: cp.id }, data: { isActive: true, startsAt: new Date(Date.now() + DAY) } });
    expect((await errOf(applyCouponToCart(c.user.id, { code: 'SAVE50' }))).message).toMatch(/not active yet/);
    await prisma.coupon.update({ where: { id: cp.id }, data: { startsAt: new Date(Date.now() - 2 * DAY), endsAt: new Date(Date.now() - DAY) } });
    expect((await errOf(applyCouponToCart(c.user.id, { code: 'SAVE50' }))).message).toMatch(/expired/);
    await prisma.coupon.update({ where: { id: cp.id }, data: { endsAt: new Date(Date.now() + DAY) } });
    const cart = await applyCouponToCart(c.user.id, { code: ' save50 ' });
    expect(cart.coupon).toMatchObject({ code: 'SAVE50', valid: true, discountPaise: 5000 });
    expect(cart.discountPaise).toBe(5000);
    expect((await removeCouponFromCart(c.user.id))?.coupon).toBeNull();
  });

  it('enforces minimum order and re-validates when the cart changes', async () => {
    const { product } = await makeSellable({ sku: 'PEN', pricePaise: 4000 });
    const c = await shopper(product.id, 3); // ₹120
    await coupon();
    await applyCouponToCart(c.user.id, { code: 'SAVE50' });
    const line = (await getCart({ userId: c.user.id })).lines[0];
    const { setQuantity } = await import('../src/cart');
    const view = await setQuantity({ userId: c.user.id }, line.id, { quantity: 2 }); // ₹80 < ₹100
    expect(view.coupon).toMatchObject({ valid: false, discountPaise: 0 });
    expect(view.coupon?.message).toMatch(/Add ₹20 more/);
    expect(view.discountPaise).toBe(0);
    const summary = await getCheckoutSummary(c.user.id);
    expect(summary.canPlaceOrder).toBe(false);
    expect(summary.blockers.join(' ')).toMatch(/SAVE50/);
  });

  it('issued-only coupons need a grant; product/category rules limit the discount to eligible items', async () => {
    const { product: mug } = await makeSellable({ sku: 'MUG', pricePaise: 6000, category: 'kitchen' });
    const { product: lamp } = await makeSellable({ sku: 'LAMP', pricePaise: 10000, category: 'home' });
    const c = await shopper(mug.id, 1);
    await addItem({ userId: c.user.id }, { productId: lamp.id, quantity: 1 }); // ₹160 total
    const kitchen = await prisma.category.findUniqueOrThrow({ where: { slug: 'kitchen' } });
    const pct = await coupon({ code: 'KITCHEN50', discountType: 'PERCENT', discountValue: 5000, minOrderValuePaise: 0, requiresGrant: true, categories: { create: { categoryId: kitchen.id } } });
    expect((await errOf(applyCouponToCart(c.user.id, { code: 'KITCHEN50' }))).message).toMatch(/not available on your account/);
    await grantCoupon(pct.id, c.user.id, 'MANUAL');
    const cart = await applyCouponToCart(c.user.id, { code: 'KITCHEN50' });
    expect(cart.discountPaise).toBe(3000); // 50% of the ₹60 kitchen item only
    const lampOnly = await coupon({ code: 'LAMPONLY', minOrderValuePaise: 0, products: { create: { productId: lamp.id } }, discountValue: 20000 });
    expect((await applyCouponToCart(c.user.id, { code: 'LAMPONLY' })).discountPaise).toBe(10000); // capped at the lamp's price
    void lampOnly;
  });

  it('guests cannot apply coupons (per-customer limits need an account)', async () => {
    const { product } = await makeSellable({ sku: 'MUG', pricePaise: 6000 });
    await coupon({ minOrderValuePaise: 0 });
    const { newGuestToken } = await addItem(null, { productId: product.id, quantity: 2 });
    const guestCart = await getCart({ guestToken: newGuestToken! });
    expect(guestCart.coupon).toBeNull();
  });
});

describe('coupon redemption at order time', () => {
  it('applies the server-computed discount, records one redemption and enforces the per-customer limit', async () => {
    const { product } = await makeSellable({ sku: 'MUG', pricePaise: 6000, stock: 20 });
    const c = await shopper(product.id, 2); // ₹120 + ₹40 delivery
    const cp = await coupon();
    await applyCouponToCart(c.user.id, { code: 'SAVE50' });
    const tampered = await placeOrder(c.user.id, { addressId: c.address.id, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: randomUUID(), discountPaise: 99999, totalPaise: 1 });
    expect(tampered.totalPaise).toBe(12000 + 4000 - 5000);
    const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber: tampered.orderNumber } });
    expect(o).toMatchObject({ discountPaise: 5000, couponCode: 'SAVE50', couponId: cp.id, subtotalPaise: 12000 });
    expect(await prisma.couponRedemption.count({ where: { couponId: cp.id, status: 'APPLIED' } })).toBe(1);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: cp.id } })).usedCount).toBe(1);

    // Second order with the same coupon → refused (limit 1 per customer).
    await addItem({ userId: c.user.id }, { productId: product.id, quantity: 2 });
    await expect(applyCouponToCart(c.user.id, { code: 'SAVE50' })).rejects.toThrow(/already used/);
    const cartRow = await prisma.cart.findFirstOrThrow({ where: { userId: c.user.id, status: 'ACTIVE' } });
    await prisma.cart.update({ where: { id: cartRow.id }, data: { couponCode: 'SAVE50' } }); // forced past the UI
    const e = await errOf(order(c.user.id, c.address.id));
    expect(e.code).toBe('COUPON_INVALID');
    expect((await prisma.inventory.findFirstOrThrow({ where: { productId: product.id } })).reservedQuantity).toBe(2); // nothing extra reserved

    // Cancelling the first order gives the use back.
    await customerCancelOrder(c.user.id, tampered.orderNumber, { reason: 'Changed my mind' });
    expect(await prisma.couponRedemption.findUniqueOrThrow({ where: { orderId: o.id } })).toMatchObject({ status: 'REVERSED' });
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: cp.id } })).usedCount).toBe(0);
    const again = await order(c.user.id, c.address.id);
    expect(again.totalPaise).toBe(12000 + 4000 - 5000);
  });

  it('a coupon that expires after being applied is refused at placement with nothing reserved', async () => {
    const { product, inventoryId } = await makeSellable({ sku: 'MUG', pricePaise: 6000 });
    const c = await shopper(product.id, 2);
    const cp = await coupon({ endsAt: new Date(Date.now() + DAY) });
    await applyCouponToCart(c.user.id, { code: 'SAVE50' });
    await prisma.coupon.update({ where: { id: cp.id }, data: { startsAt: new Date(Date.now() - 2 * DAY), endsAt: new Date(Date.now() - 1000) } });
    const e = await errOf(order(c.user.id, c.address.id));
    expect(e.status).toBe(409);
    expect(e.message).toMatch(/expired/);
    expect((await prisma.inventory.findUniqueOrThrow({ where: { id: inventoryId } })).reservedQuantity).toBe(0);
    expect(await prisma.order.count()).toBe(0);
  });

  it('global usage limit holds under concurrent checkouts (10 customers, limit 3)', async () => {
    const { product } = await makeSellable({ sku: 'MUG', pricePaise: 6000, stock: 100 });
    const cp = await coupon({ usageLimit: 3 });
    const shoppers = [];
    for (let i = 0; i < 10; i++) shoppers.push(await shopper(product.id, 2));
    for (const s of shoppers) await applyCouponToCart(s.user.id, { code: 'SAVE50' });
    const results = await Promise.allSettled(shoppers.map((s) => order(s.user.id, s.address.id)));
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected').map((r) => toAppError((r as PromiseRejectedResult).reason));
    expect(ok).toHaveLength(3);
    expect(failed.every((f) => f.code === 'COUPON_INVALID')).toBe(true);
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: cp.id } })).usedCount).toBe(3);
    expect(await prisma.couponRedemption.count({ where: { couponId: cp.id } })).toBe(3);
    expect((await prisma.inventory.findFirstOrThrow({ where: { productId: product.id } })).reservedQuantity).toBe(6);
  }, 60_000);

  it('expired online-payment orders reverse their redemption', async () => {
    const { product } = await makeSellable({ sku: 'MUG', pricePaise: 6000 });
    const c = await shopper(product.id, 2);
    const cp = await coupon();
    await applyCouponToCart(c.user.id, { code: 'SAVE50' });
    const placed = await order(c.user.id, c.address.id);
    const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber: placed.orderNumber } });
    // Simulate an abandoned online payment.
    await prisma.order.update({ where: { id: o.id }, data: { paymentMethod: 'ONLINE', reservationExpiresAt: new Date(Date.now() - 1000) } });
    await expireStaleReservations();
    expect((await prisma.couponRedemption.findUniqueOrThrow({ where: { orderId: o.id } })).status).toBe('REVERSED');
    expect((await prisma.coupon.findUniqueOrThrow({ where: { id: cp.id } })).usedCount).toBe(0);
  });
});

describe('welcome coupon distribution', () => {
  it('auto-issues only coupons configured for signup (data, not code) and lists them as issued, not redeemed', async () => {
    const c = await createCustomer();
    await onCustomerSignup(c.user.id, 'Asha');
    expect(await prisma.couponGrant.count()).toBe(0); // nothing configured → nothing issued
    expect(await prisma.notification.count({ where: { userId: c.user.id, type: 'WELCOME' } })).toBe(1);

    await coupon({ code: 'WELCOME50', requiresGrant: true, autoIssueOnSignup: true, minOrderValuePaise: 19900 });
    await coupon({ code: 'CAMPAIGN100', discountValue: 10000, requiresGrant: true, isActive: false });
    const d = await createCustomer();
    await onCustomerSignup(d.user.id, 'Dev');
    const grants = await prisma.couponGrant.findMany({ where: { userId: d.user.id }, include: { coupon: true } });
    expect(grants.map((g) => g.coupon.code)).toEqual(['WELCOME50']);
    expect(await prisma.notification.count({ where: { userId: d.user.id, type: 'COUPON_ISSUED' } })).toBe(1);
    const mine = await listCustomerCoupons(d.user.id);
    expect(mine.items.find((i) => i.code === 'WELCOME50')).toMatchObject({ issued: true, state: 'AVAILABLE' });
    expect(mine.items.some((i) => i.code === 'CAMPAIGN100')).toBe(false); // inactive + not issued → hidden
    // Email outbox is honest: no provider in tests → SKIPPED, never SENT.
    const emails = await prisma.emailMessage.findMany({ where: { userId: d.user.id } });
    expect(emails.length).toBeGreaterThan(0);
    expect(emails.every((e) => e.status === 'SKIPPED')).toBe(true);
  });
});
