/**
 * Phase B: analytics events wired into the real customer, payment and admin workflows.
 * Every scenario drives the production code path (route handlers where the request matters) and then
 * waits for the deferred analytics work with settleAnalytics().
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@20mart/database';
import { sha256 } from '../src/crypto';
import { addItem, removeItem, setQuantity } from '../src/cart';
import { createAddress } from '../src/addresses';
import { cancelOrderCore, markPaymentCaptured, placeOrder } from '../src/orders';
import { adminCancelOrder, initiateRefund, markRefundProcessed, recordManualRefund } from '../src/admin-orders';
import { createRazorpayProvider, setPaymentProviderForTests } from '../src/payments';
import { processRazorpayWebhook } from '../src/payments/webhook';
import { clearAnalyticsSettingsCache, getAbandonedCartSummary, getUnfulfilledDemand, settleAnalytics, stableEventId } from '../src/tracking';
import { adminRequest, adminSession, createCustomer, makeSellable, resetDb, setupDelivery, VALID_ADDRESS } from './helpers';

const STORE = '../../../apps/20mart/src/app/api';
const ADMIN = '../../../apps/20martadmin/src/app/api/admin';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const VID = 'visitor-token-aaaaaaaaaaaaaaaaaaaaaaaa';
const SID = 'session-token-bbbbbbbbbbbbbbbbbbbbbbbb';
const KEY_SECRET = 'test_key_secret';
const WEBHOOK_SECRET = 'test_webhook_secret';

/* ───────────────────────────── helpers ───────────────────────────── */

const CONSENTED = { '20m_consent': '1.granted', '20m_vid': VID, '20m_sid': SID };

function req(path: string, init: { method?: string; body?: unknown; cookies?: Record<string, string>; headers?: Record<string, string> } = {}) {
  const headers = new Headers({ 'user-agent': UA, origin: 'http://localhost:3000', ...(init.headers ?? {}) });
  const cookies = Object.entries(init.cookies ?? {}).map(([k, v]) => `${k}=${v}`);
  if (cookies.length) headers.set('cookie', cookies.join('; '));
  let body: string | undefined;
  if (init.body !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(init.body);
  }
  return new NextRequest(new URL(path, 'http://localhost:3000'), { method: init.method ?? 'GET', headers, body });
}
const params = (p: Record<string, string> = {}) => ({ params: Promise.resolve(p) });

const route = <T>(p: string) => import(`${STORE}/${p}/route`) as Promise<T>;
type Handler = (r: NextRequest, c?: { params: Promise<Record<string, string>> }) => Promise<Response>;
type Methods = { GET: Handler; POST: Handler; PATCH: Handler; DELETE: Handler };

const events = async (name?: string) => {
  await settleAnalytics();
  // Writes are deferred and may land out of order; the action time (stamped before deferring) is the order.
  return prisma.analyticsEvent.findMany({ where: name ? { name: name as never } : {}, orderBy: [{ occurredAt: 'asc' }, { receivedAt: 'asc' }] });
};

/** Simulate a real database failure: the table is temporarily missing (test DB only). */
async function withTableMissing<T>(table: string, fn: () => Promise<T>) {
  await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" RENAME TO "${table}_offline"`);
  try {
    const out = await fn();
    await settleAnalytics(); // deferred analytics must also run (and fail) while the table is missing
    return out;
  } finally {
    await prisma.$executeRawUnsafe(`ALTER TABLE "${table}_offline" RENAME TO "${table}"`);
  }
}

function fakeRazorpay() {
  let seq = 0;
  const orders = new Map<string, { amount: number }>();
  const payments = new Map<string, { id: string; order_id: string; amount: number; status: string }>();
  const refunds = new Map<string, { id: string; payment_id: string; amount: number; status: string }>();
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname.replace('/v1', '');
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (init?.method === 'POST' && path === '/orders') {
      const id = `order_${++seq}`;
      orders.set(id, { amount: body.amount });
      return json({ id, amount: body.amount, currency: 'INR' });
    }
    let m = /^\/payments\/([^/]+)$/.exec(path);
    if (m) return json(payments.get(m[1]));
    m = /^\/payments\/([^/]+)\/refund$/.exec(path);
    if (m) {
      const id = `rfnd_${++seq}`;
      refunds.set(id, { id, payment_id: m[1], amount: body.amount, status: 'processed' });
      return json(refunds.get(id));
    }
    return json({ error: { description: 'unsupported' } }, 400);
  }) as typeof fetch;
  return {
    fetchImpl,
    pay(orderId: string) {
      const id = `pay_${++seq}`;
      payments.set(id, { id, order_id: orderId, amount: orders.get(orderId)!.amount, status: 'captured' });
      return id;
    },
  };
}
const sign = (data: string, secret: string) => createHmac('sha256', secret).update(data).digest('hex');

let rz: ReturnType<typeof fakeRazorpay>;
beforeEach(async () => {
  await resetDb();
  clearAnalyticsSettingsCache();
  await setupDelivery({ onlinePaymentEnabled: true });
  rz = fakeRazorpay();
  setPaymentProviderForTests(createRazorpayProvider({ keyId: 'rzp_test_key', keySecret: KEY_SECRET, webhookSecret: WEBHOOK_SECRET, fetchImpl: rz.fetchImpl }));
});
afterAll(() => setPaymentProviderForTests(null));

async function shopper(sku: string, opts: { price?: number; stock?: number; qty?: number } = {}) {
  const { product, inventoryId } = await makeSellable({ sku, pricePaise: opts.price ?? 5000, stock: opts.stock ?? 10 });
  const c = await createCustomer();
  const address = await createAddress(c.user.id, VALID_ADDRESS);
  if (opts.qty) await addItem({ userId: c.user.id }, { productId: product.id, quantity: opts.qty });
  return { ...c, product, inventoryId, address };
}

/* ───────────────────────────── cart ───────────────────────────── */

describe('cart events', () => {
  it('CART_ITEM_ADDED carries server price/category, and identity only with consent', async () => {
    const { product } = await makeSellable({ sku: 'ZM-B-1', pricePaise: 4200 });
    const c = await createCustomer();
    const items = await route<Methods>('cart/items');
    // Client-sent price is ignored by validation; the event uses the database price.
    const ok = await items.POST(req('/api/cart/items', { method: 'POST', body: { productId: product.id, quantity: 2, pricePaise: 1 }, cookies: { '20m_session': c.token, '20m_pin': '380015', ...CONSENTED } }));
    expect(ok.status).toBe(200);
    // A guest without consent: event stored, but anonymous and without the cart id.
    const guest = await items.POST(req('/api/cart/items', { method: 'POST', body: { productId: product.id, quantity: 1 } }));
    expect(guest.status).toBe(200);

    const added = await events('CART_ITEM_ADDED');
    expect(added).toHaveLength(2);
    const signedIn = added.find((e) => e.quantity === 2)!;
    const anon = added.find((e) => e.quantity === 1)!;
    const cart = await prisma.cart.findFirstOrThrow({ where: { userId: c.user.id } });
    expect(signedIn).toMatchObject({
      category: 'OPERATIONAL', source: 'SERVER', productId: product.id, categoryId: product.categoryId, quantity: 2, unitPricePaise: 4200,
      userId: c.user.id, visitorId: sha256(VID), sessionId: sha256(SID), cartId: cart.id, pincode: '380015', metadata: { source: 'cart' },
    });
    expect(anon).toMatchObject({ quantity: 1, unitPricePaise: 4200, userId: null, visitorId: null, sessionId: null, cartId: null });
  });

  it('GPC overrides a stored consent cookie for server events', async () => {
    const { product } = await makeSellable({ sku: 'ZM-B-2' });
    const c = await createCustomer();
    const items = await route<Methods>('cart/items');
    await items.POST(req('/api/cart/items', { method: 'POST', body: { productId: product.id }, cookies: { '20m_session': c.token, ...CONSENTED }, headers: { 'sec-gpc': '1' } }));
    expect((await events('CART_ITEM_ADDED'))[0]).toMatchObject({ userId: null, visitorId: null, cartId: null });
  });

  it('quantity changes, removals and clearing record CART_ITEM_ADDED / CART_ITEM_REMOVED with the unit delta', async () => {
    const { product } = await makeSellable({ sku: 'ZM-B-3', pricePaise: 3000 });
    const { product: other } = await makeSellable({ sku: 'ZM-B-4', pricePaise: 1000 });
    const c = await createCustomer();
    const owner = { userId: c.user.id };
    const { cart } = await addItem(owner, { productId: product.id, quantity: 2 });
    await addItem(owner, { productId: other.id, quantity: 1 });
    const lineId = cart.lines[0].id;
    await setQuantity(owner, lineId, { quantity: 5 });
    await setQuantity(owner, lineId, { quantity: 3 });
    await setQuantity(owner, lineId, { quantity: 3 }); // no change → no event
    const added = await events('CART_ITEM_ADDED');
    expect(added.map((e) => [e.quantity, (e.metadata as { source: string }).source])).toEqual([[2, 'cart'], [1, 'cart'], [3, 'quantity_update']]);
    const removed = await events('CART_ITEM_REMOVED');
    expect(removed).toHaveLength(1);
    expect(removed[0]).toMatchObject({ productId: product.id, quantity: 2, unitPricePaise: 3000, metadata: { reason: 'quantity_decrease' } });

    await removeItem(owner, lineId);
    const clear = await route<Methods>('cart');
    expect((await clear.DELETE(req('/api/cart', { method: 'DELETE', cookies: { '20m_session': c.token } }))).status).toBe(200);
    const all = await events('CART_ITEM_REMOVED');
    expect(all.slice(1).map((e) => [e.productId, e.quantity, (e.metadata as { reason: string }).reason])).toEqual([
      [product.id, 3, 'removed'],
      [other.id, 1, 'cleared'],
    ]);
    expect(await prisma.cartItem.count()).toBe(0);
  });
});

/* ───────────────────────────── unfulfilled demand ───────────────────────────── */

describe('out-of-stock attempts and unfulfilled demand', () => {
  it('records the shortfall at the server price once per item, cart and day; the limit refusal is not demand', async () => {
    const { product: gone } = await makeSellable({ sku: 'ZM-B-5', pricePaise: 2500, stock: 0 });
    const { product: few } = await makeSellable({ sku: 'ZM-B-6', pricePaise: 1000, stock: 3 });
    const c = await createCustomer();
    const items = await route<Methods>('cart/items');
    const post = (productId: string, quantity: number) =>
      items.POST(req('/api/cart/items', { method: 'POST', body: { productId, quantity }, cookies: { '20m_session': c.token } }));

    const r1 = await post(gone.id, 2);
    expect(r1.status).toBe(409);
    expect((await r1.json()).error.code).toBe('OUT_OF_STOCK');
    expect((await post(gone.id, 4)).status).toBe(409); // repeated tap: same item, cart and day → not counted again
    expect((await post(few.id, 5)).status).toBe(409); // only 3 sellable → 2 units short
    await setupDelivery({ maxQtyPerLine: 2 });
    expect((await (await post(few.id, 3)).json()).error.code).not.toBe('OUT_OF_STOCK'); // QTY_LIMIT (or stock): not double counted

    const oos = await events('OUT_OF_STOCK_ADD_ATTEMPT');
    expect(oos).toHaveLength(2);
    expect(oos.find((e) => e.productId === gone.id)).toMatchObject({ quantity: 2, unitPricePaise: 2500, userId: null, metadata: { reason: 'out_of_stock', atLocation: false, source: 'cart', sellable: 0 } });
    expect(oos.find((e) => e.productId === few.id)).toMatchObject({ quantity: 2, unitPricePaise: 1000, metadata: { reason: 'insufficient_stock', sellable: 3 } });
    expect(await prisma.cartItem.count()).toBe(0); // business behaviour unchanged: nothing added

    // A consenting shopper's browser reports seeing the item as unavailable (supporting signal only).
    // The server re-checks live stock for the visitor's served PIN: only the true claim is kept.
    const ingest = await route<Methods>('analytics/events');
    const view = (productId: string) => ({ id: randomUUID(), name: 'PRODUCT_UNAVAILABLE_VIEWED', productId, occurredAt: Date.now() });
    const send = async (evs: unknown[], cookies: Record<string, string>) =>
      (await ingest.POST(req('/api/analytics/events', { method: 'POST', body: { events: evs }, cookies }))).json();
    expect(await send([view(gone.id), view(few.id)], { ...CONSENTED, '20m_pin': '380015' })).toMatchObject({ accepted: 1, dropped: 1 }); // `few` is in stock: stale claim
    expect(await send([view(gone.id)], CONSENTED)).toMatchObject({ accepted: 0, dropped: 1 }); // no PIN → cannot be verified
    expect(await send([view(gone.id)], { ...CONSENTED, '20m_pin': '560001' })).toMatchObject({ accepted: 0, dropped: 1 }); // unserved PIN

    const demand = await getUnfulfilledDemand();
    expect(demand.totals).toMatchObject({ attempts: 2, unitsRequested: 4, products: 2, estimatedLostRevenuePaise: 2 * 2500 + 2 * 1000, unavailableProductViews: 1 });
    expect(demand.products[0]).toMatchObject({ productId: gone.id, name: 'Item ZM-B-5', unitsRequested: 2, estimatedLostRevenuePaise: 5000, unavailableViews: 1 });
    // Behavioural views never inflate the revenue estimate.
    expect(demand.products.reduce((a, p) => a + p.estimatedLostRevenuePaise, 0)).toBe(demand.totals.estimatedLostRevenuePaise);
  });

  it('a quantity increase beyond stock is an attempt for the extra units only', async () => {
    const { product } = await makeSellable({ sku: 'ZM-B-7', pricePaise: 2000, stock: 4 });
    const c = await createCustomer();
    const { cart } = await addItem({ userId: c.user.id }, { productId: product.id, quantity: 3 });
    await expect(setQuantity({ userId: c.user.id }, cart.lines[0].id, { quantity: 6 })).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    const [e] = await events('OUT_OF_STOCK_ADD_ATTEMPT');
    expect(e).toMatchObject({ quantity: 2, metadata: { source: 'quantity_update', reason: 'insufficient_stock' } });
    expect((await prisma.cartItem.findFirstOrThrow()).quantity).toBe(3);
  });

  it('includes unavailable product views and unserviceable PIN checks; the admin endpoint needs analytics.view', async () => {
    const check = await route<Methods>('delivery/check');
    const c = await createCustomer();
    for (let i = 0; i < 2; i++) await check.GET(req('/api/delivery/check?pincode=110001', { cookies: { '20m_session': c.token } })); // same shopper, same day → 1
    await check.GET(req('/api/delivery/check?pincode=110001')); // anonymous, no cookie → counted
    await check.GET(req('/api/delivery/check?pincode=12')); // malformed → never recorded
    const ok = await check.GET(req('/api/delivery/check?pincode=380015', { cookies: { '20m_session': c.token } }));
    expect(await ok.json()).toMatchObject({ serviceable: true });
    const checks = await events('DELIVERY_CHECKED');
    expect(checks).toHaveLength(3);
    expect(checks.filter((e) => (e.metadata as { serviceable: boolean }).serviceable === false)).toHaveLength(2);

    const loc = await route<Methods>('location');
    expect((await loc.POST(req('/api/location', { method: 'POST', body: { pincode: '560001' } }))).status).toBe(200);
    expect((await events('DELIVERY_CHECKED')).at(-1)).toMatchObject({ pincode: '560001', metadata: { source: 'location_set', serviceable: false, code: 'NOT_SERVICEABLE' } });

    const demand = await getUnfulfilledDemand();
    expect(demand.unserviceableAreas).toEqual([
      { pincode: '110001', checks: 2 },
      { pincode: '560001', checks: 1 },
    ]);

    const mkt = await adminSession('mkt', ['MARKETING_MANAGER']);
    const wh = await adminSession('orders', ['ORDER_MANAGER']);
    const admin = await import(`${ADMIN}/analytics/unfulfilled-demand/route`);
    const res = await admin.GET(adminRequest('/api/admin/analytics/unfulfilled-demand?limit=10', { token: mkt.token }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ basis: 'server_verified', totals: { unserviceableAreaChecks: 3 } });
    expect((await admin.GET(adminRequest('/api/admin/analytics/unfulfilled-demand', { token: wh.token }))).status).toBe(403);
    expect((await admin.GET(adminRequest('/api/admin/analytics/unfulfilled-demand?from=2026-01-01&to=2025-01-01', { token: mkt.token }))).status).toBe(400);
    expect((await admin.GET(adminRequest('/api/admin/analytics/unfulfilled-demand?evil=1', { token: mkt.token }))).status).toBe(400);
  });
});

/* ───────────────────────────── data-accuracy hardening ───────────────────────────── */

describe('data accuracy under retries and concurrency', () => {
  it('a guest without a cart: refused adds create no cart, and repeats never inflate demand (no new tracking)', async () => {
    const { product: gone } = await makeSellable({ sku: 'ZM-H-1', pricePaise: 2500, stock: 0 });
    const items = await route<Methods>('cart/items');
    const post = (cookies: Record<string, string> = {}, headers: Record<string, string> = {}) =>
      items.POST(req('/api/cart/items', { method: 'POST', body: { productId: gone.id, quantity: 1 }, cookies, headers }));

    // No consent, no cart: five taps → one anonymous count; a refusal creates no cart and sets no cookie.
    for (let i = 0; i < 5; i++) {
      const res = await post();
      expect(res.status).toBe(409);
      expect(res.headers.get('set-cookie') ?? '').not.toMatch(/20m_cart/);
    }
    expect(await prisma.cart.count()).toBe(0);
    // A visitor cookie left over after withdrawal, or overridden by GPC, is not used to tell guests apart.
    await post({ '20m_consent': '1.denied', '20m_vid': VID });
    await post(CONSENTED, { 'sec-gpc': '1' });
    let oos = await events('OUT_OF_STOCK_ADD_ATTEMPT');
    expect(oos).toHaveLength(1);
    expect(oos[0]).toMatchObject({ visitorId: null, cartId: null, metadata: { dedupeScope: 'anonymous' } });

    // A consenting guest is told apart by the consented visitor id, again once per day.
    await post(CONSENTED);
    await post(CONSENTED);
    oos = await events('OUT_OF_STOCK_ADD_ATTEMPT');
    expect(oos).toHaveLength(2);
    expect(oos[1]).toMatchObject({ visitorId: sha256(VID), metadata: { dedupeScope: 'visitor' } });

    // A guest with a cart: keyed by that cart (the cart id itself is not stored without consent).
    const { product: ok } = await makeSellable({ sku: 'ZM-H-2' });
    const added = await items.POST(req('/api/cart/items', { method: 'POST', body: { productId: ok.id, quantity: 1 } }));
    const cartCookie = /20m_cart=([^;]+)/.exec(added.headers.get('set-cookie') ?? '')![1];
    await post({ '20m_cart': cartCookie });
    await post({ '20m_cart': cartCookie });
    oos = await events('OUT_OF_STOCK_ADD_ATTEMPT');
    expect(oos).toHaveLength(3);
    expect(oos[2]).toMatchObject({ cartId: null, metadata: { dedupeScope: 'cart' } });
    expect(await prisma.cart.count()).toBe(1); // only the accepted add created a cart
  });

  it('concurrent quantity changes never double count the delta', async () => {
    const { product } = await makeSellable({ sku: 'ZM-H-3', stock: 20 });
    const c = await createCustomer();
    const owner = { userId: c.user.id };
    const { cart } = await addItem(owner, { productId: product.id, quantity: 2 });
    const lineId = cart.lines[0].id;
    await Promise.all([1, 2, 3].map(() => setQuantity(owner, lineId, { quantity: 5 })));
    const adds = (await events('CART_ITEM_ADDED')).filter((e) => (e.metadata as { source: string }).source === 'quantity_update');
    expect(adds.reduce((a, e) => a + (e.quantity ?? 0), 0)).toBe(3);
    await Promise.all([1, 2].map(() => setQuantity(owner, lineId, { quantity: 1 })));
    const removed = await events('CART_ITEM_REMOVED');
    expect(removed.reduce((a, e) => a + (e.quantity ?? 0), 0)).toBe(4);
    expect((await prisma.cartItem.findFirstOrThrow()).quantity).toBe(1);
  });

  it('simultaneous wishlist imports and adds record each logical addition exactly once', async () => {
    const { product: a } = await makeSellable({ sku: 'ZM-H-4' });
    const { product: b } = await makeSellable({ sku: 'ZM-H-5' });
    const c = await createCustomer();
    const imp = await route<Methods>('wishlist/import');
    const wl = await route<Methods>('wishlist');
    const cookies = { '20m_session': c.token };
    const results = await Promise.all([
      imp.POST(req('/api/wishlist/import', { method: 'POST', body: { ids: [a.id, b.id] }, cookies })),
      imp.POST(req('/api/wishlist/import', { method: 'POST', body: { ids: [b.id, a.id] }, cookies })),
      wl.POST(req('/api/wishlist', { method: 'POST', body: { productId: a.id }, cookies })),
      wl.POST(req('/api/wishlist', { method: 'POST', body: { productId: b.id }, cookies })),
    ]);
    expect(results.every((r) => r.status === 200 || r.status === 429)).toBe(true);
    const wished = await events('WISHLIST_ADDED');
    expect(wished.map((e) => e.productId).sort()).toEqual([a.id, b.id].sort());
    expect(await prisma.wishlistItem.count()).toBe(2);

    // Removing and saving again later is a new logical addition.
    await prisma.wishlistItem.deleteMany({ where: { productId: a.id } });
    await wl.POST(req('/api/wishlist', { method: 'POST', body: { productId: a.id }, cookies }));
    expect(await events('WISHLIST_ADDED')).toHaveLength(3);
  });

  it('DELIVERY_CHECKED never uses an unconsented visitor cookie to tell guests apart', async () => {
    const check = await route<Methods>('delivery/check');
    const get = (cookies: Record<string, string> = {}) => check.GET(req('/api/delivery/check?pincode=110001', { cookies }));
    await get({ '20m_consent': '1.denied', '20m_vid': VID });
    await get();
    await get(CONSENTED);
    await get(CONSENTED);
    const checks = await events('DELIVERY_CHECKED');
    expect(checks.map((e) => (e.metadata as { dedupeScope: string }).dedupeScope)).toEqual(['anonymous', 'visitor']);
    expect(checks[0]).toMatchObject({ visitorId: null });
  });
});

/* ───────────────────────────── wishlist & coupon ───────────────────────────── */

describe('wishlist and coupon events', () => {
  it('WISHLIST_ADDED only for new entries; move-to-cart records a wishlist-sourced cart add', async () => {
    const { product } = await makeSellable({ sku: 'ZM-B-8', pricePaise: 1500 });
    const { product: p2 } = await makeSellable({ sku: 'ZM-B-9' });
    const c = await createCustomer();
    const wl = await route<Methods>('wishlist');
    const add = () => wl.POST(req('/api/wishlist', { method: 'POST', body: { productId: product.id }, cookies: { '20m_session': c.token, ...CONSENTED } }));
    expect((await add()).status).toBe(200);
    expect((await add()).status).toBe(200); // already saved → no second event
    const imp = await route<Methods>('wishlist/import');
    expect((await imp.POST(req('/api/wishlist/import', { method: 'POST', body: { ids: [product.id, p2.id] }, cookies: { '20m_session': c.token } }))).status).toBe(200);
    const wished = await events('WISHLIST_ADDED');
    expect(wished.map((e) => [e.productId, (e.metadata as { source: string }).source])).toEqual([
      [product.id, 'product'],
      [p2.id, 'import'],
    ]);
    expect(wished[0]).toMatchObject({ userId: c.user.id, unitPricePaise: 1500, categoryId: product.categoryId });

    const move = await route<Methods>(`wishlist/[productId]/move-to-cart`);
    expect((await move.POST(req(`/api/wishlist/${product.id}/move-to-cart`, { method: 'POST', body: {}, cookies: { '20m_session': c.token } }), params({ productId: product.id }))).status).toBe(200);
    expect((await events('CART_ITEM_ADDED'))[0]).toMatchObject({ productId: product.id, quantity: 1, metadata: { source: 'wishlist' } });
  });

  it('COUPON_APPLIED once per cart and coupon, with the server discount and no code', async () => {
    const s = await shopper('ZM-B-10', { price: 6000, qty: 2 });
    const coupon = await prisma.coupon.create({ data: { id: '12345678-1234-4123-8123-123456789012', code: 'SAVE50', title: '₹50 off', discountType: 'FIXED', discountValue: 5000, minOrderValuePaise: 10000, isActive: true, perCustomerLimit: 1, startsAt: new Date(Date.now() - 60_000) } });
    const cp = await route<Methods>('cart/coupon');
    const apply = () => cp.POST(req('/api/cart/coupon', { method: 'POST', body: { code: 'save50' }, cookies: { '20m_session': s.token } }));
    expect((await apply()).status).toBe(200);
    expect((await apply()).status).toBe(200);
    expect((await cp.POST(req('/api/cart/coupon', { method: 'POST', body: { code: 'NOPE' }, cookies: { '20m_session': s.token } }))).status).toBe(409);
    const applied = await events('COUPON_APPLIED');
    expect(applied).toHaveLength(1);
    expect(applied[0].metadata).toEqual({ couponId: coupon.id, discountPaise: 5000, subtotalPaise: 12000 });
    expect(JSON.stringify(applied[0])).not.toMatch(/SAVE50/i);
  });
});

/* ───────────────────────────── checkout, purchase, cancel, refund ───────────────────────────── */

describe('checkout and order lifecycle events', () => {
  it('CHECKOUT_STARTED once per cart per day; none for an empty cart', async () => {
    const empty = await createCustomer();
    const summary = await route<Methods>('checkout/summary');
    await summary.GET(req('/api/checkout/summary', { cookies: { '20m_session': empty.token } }));
    const s = await shopper('ZM-B-11', { qty: 2 });
    for (let i = 0; i < 3; i++) {
      const r = await summary.GET(req(`/api/checkout/summary?addressId=${s.address.id}`, { cookies: { '20m_session': s.token, ...CONSENTED } }));
      expect(r.status).toBe(200);
    }
    const started = await events('CHECKOUT_STARTED');
    expect(started).toHaveLength(1);
    expect(started[0]).toMatchObject({ userId: s.user.id, quantity: 2, pincode: '380015', metadata: { lines: 1, subtotalPaise: 10000, canPlaceOrder: true } });
  });

  it('COD: PURCHASE_COMPLETED per line from the order snapshot; a retried submit adds nothing', async () => {
    const s = await shopper('ZM-B-12', { price: 5000, qty: 2 });
    const { product: p2 } = await makeSellable({ sku: 'ZM-B-13', pricePaise: 3000 });
    await addItem({ userId: s.user.id }, { productId: p2.id, quantity: 1 });
    const orders = await route<Methods>('orders');
    const body = { addressId: s.address.id, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: randomUUID() };
    const first = await orders.POST(req('/api/orders', { method: 'POST', body, cookies: { '20m_session': s.token, ...CONSENTED } }));
    expect(first.status).toBe(201);
    const again = await orders.POST(req('/api/orders', { method: 'POST', body, cookies: { '20m_session': s.token, ...CONSENTED } }));
    expect(await again.json()).toMatchObject({ duplicate: true });
    const order = await prisma.order.findFirstOrThrow();
    const purchases = await events('PURCHASE_COMPLETED');
    expect(purchases).toHaveLength(2);
    expect(purchases.map((e) => [e.productId, e.quantity, e.unitPricePaise]).sort()).toEqual([[p2.id, 1, 3000], [s.product.id, 2, 5000]].sort());
    expect(purchases[0]).toMatchObject({ orderId: order.id, userId: s.user.id, pincode: '380015', warehouseId: order.fulfillmentWarehouseId, metadata: { paymentMethod: 'CASH_ON_DELIVERY', orderLines: 2 } });
  });

  it('online: no purchase until capture; browser verify + duplicate webhook record it once', async () => {
    const s = await shopper('ZM-B-14', { price: 5000, qty: 2 });
    const res = await placeOrder(s.user.id, { addressId: s.address.id, paymentMethod: 'ONLINE', idempotencyKey: randomUUID() });
    expect(await events('PURCHASE_COMPLETED')).toHaveLength(0);
    const providerOrderId = res.payment!.providerOrderId;
    const payId = rz.pay(providerOrderId);
    const verify = await route<Methods>('payments/razorpay/verify');
    const v = await verify.POST(
      req('/api/payments/razorpay/verify', {
        method: 'POST',
        body: { razorpay_order_id: providerOrderId, razorpay_payment_id: payId, razorpay_signature: sign(`${providerOrderId}|${payId}`, KEY_SECRET) },
        cookies: { '20m_session': s.token, ...CONSENTED },
      })
    );
    expect(await v.json()).toMatchObject({ status: 'confirmed' });
    const raw = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: payId, order_id: providerOrderId, amount: 14000, currency: 'INR', status: 'captured' } } } });
    await processRazorpayWebhook(raw, sign(raw, WEBHOOK_SECRET), randomUUID());
    await processRazorpayWebhook(raw, sign(raw, WEBHOOK_SECRET), randomUUID());
    await markPaymentCaptured(providerOrderId, payId, 14000, 'INR'); // direct replay
    const purchases = await events('PURCHASE_COMPLETED');
    expect(purchases).toHaveLength(1);
    expect(purchases[0]).toMatchObject({ userId: s.user.id, quantity: 2, unitPricePaise: 5000, metadata: { paymentMethod: 'ONLINE' } });
  });

  it('a webhook-only confirmation is recorded without identity', async () => {
    const s = await shopper('ZM-B-15', { qty: 1 });
    const res = await placeOrder(s.user.id, { addressId: s.address.id, paymentMethod: 'ONLINE', idempotencyKey: randomUUID() });
    const payId = rz.pay(res.payment!.providerOrderId);
    const raw = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: payId, order_id: res.payment!.providerOrderId, amount: 9000, currency: 'INR', status: 'captured' } } } });
    expect(await processRazorpayWebhook(raw, sign(raw, WEBHOOK_SECRET), randomUUID())).toMatchObject({ handled: true });
    expect((await events('PURCHASE_COMPLETED'))[0]).toMatchObject({ userId: null, visitorId: null });
  });

  it('ORDER_CANCELLED per line (customer with consent, admin anonymous), no free-text reason, never twice', async () => {
    const s = await shopper('ZM-B-16', { price: 5000, qty: 2 });
    const r1 = await placeOrder(s.user.id, { addressId: s.address.id, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: randomUUID() });
    const cancel = await route<Methods>('orders/[orderNumber]/cancel');
    const reason = 'call me on 9876543210';
    const res = await cancel.POST(req(`/api/orders/${r1.orderNumber}/cancel`, { method: 'POST', body: { reason }, cookies: { '20m_session': s.token, ...CONSENTED } }), params({ orderNumber: r1.orderNumber }));
    expect(res.status).toBe(200);
    const again = await cancel.POST(req(`/api/orders/${r1.orderNumber}/cancel`, { method: 'POST', body: { reason }, cookies: { '20m_session': s.token } }), params({ orderNumber: r1.orderNumber }));
    expect(again.status).toBe(409);

    await addItem({ userId: s.user.id }, { productId: s.product.id, quantity: 1 });
    const r2 = await placeOrder(s.user.id, { addressId: s.address.id, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: randomUUID() });
    const o2 = await prisma.order.findUniqueOrThrow({ where: { orderNumber: r2.orderNumber } });
    const { ctx } = await adminSession('ops', ['ADMIN']);
    await adminCancelOrder(ctx, o2.id, { reason: 'Customer asked' });

    const cancelled = await events('ORDER_CANCELLED');
    expect(cancelled).toHaveLength(2);
    expect(cancelled[0]).toMatchObject({ userId: s.user.id, quantity: 2, unitPricePaise: 5000, metadata: { by: 'customer', fromStatus: 'PENDING', refundRequired: false } });
    expect(cancelled[1]).toMatchObject({ orderId: o2.id, userId: null, metadata: { by: 'admin' } });
    expect(JSON.stringify(cancelled)).not.toContain('9876543210');
  });

  it('REFUND_PROCESSED once per refund across provider response, webhook, sync and manual recording', async () => {
    // Online paid order cancelled → refund requested → provider confirms immediately.
    const s = await shopper('ZM-B-17', { price: 5000, qty: 2 });
    const res = await placeOrder(s.user.id, { addressId: s.address.id, paymentMethod: 'ONLINE', idempotencyKey: randomUUID() });
    const payId = rz.pay(res.payment!.providerOrderId);
    await markPaymentCaptured(res.payment!.providerOrderId, payId, 14000, 'INR');
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber: res.orderNumber } });
    await cancelOrderCore(order.id, { by: 'customer', reason: 'Changed my mind', actorLabel: 'customer', userId: s.user.id });
    const refund = await prisma.refund.findFirstOrThrow({ where: { orderId: order.id } });
    expect(await events('REFUND_PROCESSED')).toHaveLength(0); // requested is not processed
    const { ctx } = await adminSession('fin', ['SUPER_ADMIN']);
    expect(await initiateRefund(ctx, refund.id)).toMatchObject({ status: 'processed' });
    const processed = await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
    await markRefundProcessed(processed.providerRefundId!); // webhook replay → no-op
    const raw = JSON.stringify({ event: 'refund.processed', payload: { refund: { entity: { id: processed.providerRefundId, payment_id: payId, amount: 14000, status: 'processed' } } } });
    await processRazorpayWebhook(raw, sign(raw, WEBHOOK_SECRET), randomUUID());

    // COD order delivered-failed style manual refund: recorded once.
    const cod = await shopper('ZM-B-18', { price: 5000, qty: 1 });
    const r2 = await placeOrder(cod.user.id, { addressId: cod.address.id, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: randomUUID() });
    const o2 = await prisma.order.findUniqueOrThrow({ where: { orderNumber: r2.orderNumber }, include: { payments: true } });
    await prisma.payment.update({ where: { id: o2.payments[0].id }, data: { status: 'PAID' } });
    await prisma.order.update({ where: { id: o2.id }, data: { paymentStatus: 'PAID' } });
    await cancelOrderCore(o2.id, { by: 'admin', reason: 'Damaged', actorLabel: 'ops' });
    const codRefund = await prisma.refund.findFirstOrThrow({ where: { orderId: o2.id } });
    await recordManualRefund(ctx, codRefund.id, { reference: 'CASH-001' });
    await expect(recordManualRefund(ctx, codRefund.id, { reference: 'CASH-001' })).rejects.toMatchObject({ status: 409 });

    const refunds = await events('REFUND_PROCESSED');
    expect(refunds).toHaveLength(2);
    expect(refunds[0]).toMatchObject({ orderId: order.id, userId: null, metadata: { amountPaise: 14000, provider: 'RAZORPAY', fullRefund: true } });
    expect(refunds[1]).toMatchObject({ orderId: o2.id, metadata: { provider: 'MANUAL' } });
    expect(JSON.stringify(refunds)).not.toContain('CASH-001');
  });
});

/* ───────────────────────────── failure isolation ───────────────────────────── */

describe('analytics failures never affect the business flow', () => {
  it('cart, checkout, order placement, payment and cancellation succeed while the event table is down', async () => {
    const s = await shopper('ZM-B-19', { price: 5000 });
    const cookies = { '20m_session': s.token, ...CONSENTED };
    await withTableMissing('AnalyticsEvent', async () => {
      const items = await route<Methods>('cart/items');
      expect((await items.POST(req('/api/cart/items', { method: 'POST', body: { productId: s.product.id, quantity: 2 }, cookies }))).status).toBe(200);
      const summary = await route<Methods>('checkout/summary');
      expect((await summary.GET(req('/api/checkout/summary', { cookies }))).status).toBe(200);
      const orders = await route<Methods>('orders');
      const placed = await orders.POST(req('/api/orders', { method: 'POST', body: { addressId: s.address.id, paymentMethod: 'ONLINE', idempotencyKey: randomUUID() }, cookies }));
      expect(placed.status).toBe(201);
      const { payment, orderNumber } = await placed.json();
      const payId = rz.pay(payment.providerOrderId);
      const verify = await route<Methods>('payments/razorpay/verify');
      const v = await verify.POST(
        req('/api/payments/razorpay/verify', { method: 'POST', body: { razorpay_order_id: payment.providerOrderId, razorpay_payment_id: payId, razorpay_signature: sign(`${payment.providerOrderId}|${payId}`, KEY_SECRET) }, cookies })
      );
      expect(await v.json()).toMatchObject({ status: 'confirmed' });
      const cancel = await route<Methods>('orders/[orderNumber]/cancel');
      expect((await cancel.POST(req(`/api/orders/${orderNumber}/cancel`, { method: 'POST', body: { reason: 'Changed my mind' }, cookies }), params({ orderNumber }))).status).toBe(200);
    });
    const o = await prisma.order.findFirstOrThrow({ include: { refunds: true } });
    expect(o).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUND_PENDING' });
    expect(o.refunds).toHaveLength(1);
    expect(await prisma.analyticsEvent.count()).toBe(0);
  });

  it('out-of-stock refusal is unchanged when analytics is down', async () => {
    const { product } = await makeSellable({ sku: 'ZM-B-20', stock: 0 });
    const items = await route<Methods>('cart/items');
    const res = await withTableMissing('AnalyticsEvent', () => items.POST(req('/api/cart/items', { method: 'POST', body: { productId: product.id } })));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('OUT_OF_STOCK');
  });

  it('when consent settings cannot be read, events are still recorded but anonymously', async () => {
    const { product } = await makeSellable({ sku: 'ZM-B-21' });
    const c = await createCustomer();
    const items = await route<Methods>('cart/items');
    clearAnalyticsSettingsCache();
    const res = await withTableMissing('AnalyticsSettings', () => items.POST(req('/api/cart/items', { method: 'POST', body: { productId: product.id }, cookies: { '20m_session': c.token, ...CONSENTED } })));
    expect(res.status).toBe(200);
    expect((await events('CART_ITEM_ADDED'))[0]).toMatchObject({ userId: null, visitorId: null, cartId: null });
  });
});

/* ───────────────────────────── dedupe ids & abandonment ───────────────────────────── */

describe('event ids and cart abandonment', () => {
  it('stable ids are deterministic UUIDs that differ per event and key', () => {
    const a = stableEventId('PURCHASE_COMPLETED', 'o1:i1');
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(stableEventId('PURCHASE_COMPLETED', 'o1:i1')).toBe(a);
    expect(stableEventId('ORDER_CANCELLED', 'o1:i1')).not.toBe(a);
    expect(stableEventId('PURCHASE_COMPLETED', 'o1:i2')).not.toBe(a);
    // Keyed with the server secret: not derivable from the key alone.
    expect(a.replace(/-/g, '').slice(0, 12)).not.toBe(sha256('20mart-analytics:PURCHASE_COMPLETED:o1:i1').slice(0, 12));
  });

  it('removing or changing a line counts as activity; converted carts are never abandoned', async () => {
    const s = await shopper('ZM-B-22', { price: 3000, qty: 2 });
    const { product: p2 } = await makeSellable({ sku: 'ZM-B-23', pricePaise: 1000 });
    const { cart } = await addItem({ userId: s.user.id }, { productId: p2.id, quantity: 1 });
    const old = new Date(Date.now() - 30 * 3_600_000);
    const age = async () => {
      await prisma.cart.update({ where: { id: cart.id! }, data: { updatedAt: old } });
      await prisma.cartItem.updateMany({ where: { cartId: cart.id! }, data: { updatedAt: old } });
    };
    await age();
    expect(await getAbandonedCartSummary()).toMatchObject({ abandonedCarts: 1, units: 3, estimatedValuePaise: 7000 });
    // Removing a line is activity (previously only adds refreshed the cart's activity time).
    await removeItem({ userId: s.user.id }, cart.lines.find((l) => l.productId === p2.id)!.id);
    expect((await getAbandonedCartSummary()).abandonedCarts).toBe(0);
    await age();
    expect(await getAbandonedCartSummary()).toMatchObject({ abandonedCarts: 1, units: 2 });
    await setQuantity({ userId: s.user.id }, cart.lines.find((l) => l.productId === s.product.id)!.id, { quantity: 1 });
    expect((await getAbandonedCartSummary()).abandonedCarts).toBe(0);
    await age();
    await placeOrder(s.user.id, { addressId: s.address.id, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: randomUUID() });
    expect(await prisma.cart.findUniqueOrThrow({ where: { id: cart.id! } })).toMatchObject({ status: 'CONVERTED' });
    await age(); // an old converted cart still holding its lines
    expect((await getAbandonedCartSummary()).abandonedCarts).toBe(0);
  });
});
