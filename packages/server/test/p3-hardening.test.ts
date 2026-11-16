/**
 * P3 production-hardening tests: monitoring/redaction, client IP handling, JSON-LD escaping,
 * checkout price/availability re-validation, per-page counts, analytics, batched broadcasts,
 * maintenance purge, health/config checks and security headers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@20mart/database';
import { serializeJsonLd } from '@20mart/shared';
import { adminSession, createCustomer, makeSellable, resetDb, setupDelivery, VALID_ADDRESS } from './helpers';
import {
  captureException,
  flushMonitoring,
  parseSentryDsn,
  redact,
  redactString,
  setLogSinkForTests,
  setMonitoringFetchForTests,
} from '../src/observability';
import { clientIp, errorResponse } from '../src/next/http';
import { addItem, findCartId, loadCartLines } from '../src/cart';
import { createAddress } from '../src/addresses';
import { assertLinesCurrent, listCustomerOrders, placeOrder } from '../src/orders';
import { listAdminOrders, getAdminOrder } from '../src/admin-orders';
import { listCustomersAdmin, getCustomerAdmin } from '../src/customers';
import { getAnalytics } from '../src/analytics';
import { announceCampaign, createCampaign } from '../src/campaigns';
import { runMaintenance } from '../src/maintenance';
import { productionConfigIssues, healthReport } from '../src/health';
import { env, resetEnvCache } from '../src/env';
import { toAppError } from '../src/errors';
import { sha256 } from '../src/crypto';

const errOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return toAppError(e);
  }
  throw new Error('expected failure');
};

afterEach(() => {
  setLogSinkForTests(null);
  setMonitoringFetchForTests(null);
  delete process.env.SENTRY_DSN;
  delete process.env.MONITORING_WEBHOOK_URL;
  delete process.env.TRUST_PROXY_HOPS;
  delete process.env.CLIENT_IP_HEADER;
});

/* ─────────────────────────────── Monitoring ─────────────────────────────── */

describe('structured logging and error monitoring', () => {
  it('redacts secrets by key and masks e-mails, phones and bearer tokens in text', () => {
    const out = redact({
      password: 'hunter2',
      sessionToken: 'abc',
      authorization: 'Bearer xyz',
      nested: { apiKey: 'k', razorpay_signature: 's', cardNumber: '4111', ok: 'visible' },
      note: 'Contact asha.patel@example.com or +91 98765 43210 / 9876543210',
    }) as Record<string, any>;
    expect(out.password).toBe('[REDACTED]');
    expect(out.sessionToken).toBe('[REDACTED]');
    expect(out.authorization).toBe('[REDACTED]');
    expect(out.nested).toMatchObject({ apiKey: '[REDACTED]', razorpay_signature: '[REDACTED]', cardNumber: '[REDACTED]', ok: 'visible' });
    expect(out.note).not.toContain('asha.patel@');
    expect(out.note).toContain('a***@example.com');
    expect(out.note).not.toContain('9876543210');
    expect(out.note).toContain('******3210');
    expect(redactString('Authorization: Bearer eyJhbGciOi.abc.def')).toBe('Authorization: Bearer [REDACTED]');
  });

  it('writes one JSON line per event and never includes raw secrets from error messages', () => {
    const lines: Record<string, any>[] = [];
    setLogSinkForTests((l) => lines.push(l));
    const id = captureException(new Error('DB refused for user bob@example.com'), 'db.error', { category: 'db', path: '/api/x', token: 'secret' });
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ level: 'error', event: 'db.error', category: 'db', path: '/api/x', token: '[REDACTED]', eventId: id });
    expect(JSON.stringify(lines[0])).not.toContain('bob@example.com');
  });

  it('forwards errors to Sentry (envelope) and a webhook when configured', async () => {
    setLogSinkForTests(() => undefined);
    const calls: { url: string; init: RequestInit }[] = [];
    setMonitoringFetchForTests((async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch);
    process.env.SENTRY_DSN = 'https://publickey123@o1.ingest.sentry.io/4507';
    process.env.MONITORING_WEBHOOK_URL = 'https://hooks.example.com/monitor';
    const id = captureException(Object.assign(new Error('Payment provider is unreachable'), { name: 'PaymentProviderError' }), 'payment.error', { category: 'payment' });
    await flushMonitoring();
    expect(calls.map((c) => c.url).sort()).toEqual(['https://hooks.example.com/monitor', 'https://o1.ingest.sentry.io/api/4507/envelope/']);
    const sentry = calls.find((c) => c.url.includes('sentry'))!;
    expect((sentry.init.headers as Record<string, string>)['x-sentry-auth']).toContain('sentry_key=publickey123');
    const [header, item, event] = String(sentry.init.body).trim().split('\n').map((l) => JSON.parse(l));
    expect(header.event_id).toBe(id);
    expect(item.type).toBe('event');
    expect(event.exception.values[0]).toMatchObject({ type: 'PaymentProviderError', value: 'Payment provider is unreachable' });
    expect(event.tags.category).toBe('payment');
  });

  it('a failing monitoring endpoint never throws into the caller', async () => {
    setLogSinkForTests(() => undefined);
    setMonitoringFetchForTests((async () => {
      throw new Error('network down');
    }) as unknown as typeof fetch);
    process.env.SENTRY_DSN = 'https://k@sentry.example.com/1';
    expect(() => captureException(new Error('x'), 'app.error')).not.toThrow();
    await flushMonitoring();
  });

  it('parses only valid https Sentry DSNs', () => {
    expect(parseSentryDsn('https://abc@sentry.example.com/42')).toEqual({ endpoint: 'https://sentry.example.com/api/42/envelope/', publicKey: 'abc' });
    expect(parseSentryDsn('http://abc@sentry.example.com/42')).toBeNull();
    expect(parseSentryDsn('not a url')).toBeNull();
    expect(parseSentryDsn(undefined)).toBeNull();
  });

  it('5xx API responses carry a reference id but no stack trace or internals', async () => {
    const lines: Record<string, any>[] = [];
    setLogSinkForTests((l) => lines.push(l));
    const req = new NextRequest('http://localhost:3000/api/orders', { method: 'POST' });
    const res = errorResponse(new Error('connect ECONNREFUSED 10.0.0.5:5432 password=abc'), req);
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toMatchObject({ code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' });
    expect(body.error.reference).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(body)).not.toMatch(/ECONNREFUSED|stack|password/);
    expect(lines[0]).toMatchObject({ event: 'order.error', path: '/api/orders', eventId: body.error.reference });
  });
});

/* ─────────────────────────────── Client IP ─────────────────────────────── */

describe('client IP resolution (rate-limit key)', () => {
  const req = (headers: Record<string, string>) => new NextRequest('http://localhost:3000/api/x', { headers });

  it('ignores client-supplied left-most X-Forwarded-For entries', () => {
    // Attacker sends "X-Forwarded-For: 1.2.3.4"; the reverse proxy appends the real peer.
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9' }))).toBe('203.0.113.9');
    expect(clientIp(req({ 'x-forwarded-for': '203.0.113.9' }))).toBe('203.0.113.9');
  });

  it('honours TRUST_PROXY_HOPS and CLIENT_IP_HEADER', () => {
    process.env.TRUST_PROXY_HOPS = '2';
    expect(clientIp(req({ 'x-forwarded-for': 'spoof, 198.51.100.7, 10.0.0.2' }))).toBe('198.51.100.7');
    process.env.CLIENT_IP_HEADER = 'cf-connecting-ip';
    expect(clientIp(req({ 'cf-connecting-ip': '2001:db8::1', 'x-forwarded-for': '9.9.9.9' }))).toBe('2001:db8::1');
  });

  it('rejects values that are not IP addresses (no rate-limit key or log injection)', () => {
    expect(clientIp(req({ 'x-forwarded-for': 'evil" OR 1=1' }))).toBeNull();
    expect(clientIp(req({ 'x-forwarded-for': 'abc:def;rm' }))).toBeNull();
    expect(clientIp(req({ 'x-forwarded-for': '<script>' }))).toBeNull();
    expect(clientIp(req({}))).toBeNull();
  });
});

/* ─────────────────────────────── JSON-LD ─────────────────────────────── */

describe('JSON-LD serialisation', () => {
  it('cannot break out of the script element and stays valid JSON', () => {
    const LS = String.fromCharCode(0x2028);
    const evil = { name: `</script><script>alert(1)</script>${LS}` };
    const out = serializeJsonLd(evil);
    expect(out).not.toContain('<');
    expect(out).not.toContain(LS);
    expect(JSON.parse(out)).toEqual(evil);
  });
});

/* ───────────────────────────── Checkout re-validation ───────────────────────────── */

describe('order placement re-validates price and availability inside the transaction', () => {
  beforeEach(async () => {
    await resetDb();
    await setupDelivery();
  });

  it('rejects a line whose price changed after the cart was read (no silent over/under-charge)', async () => {
    const { product } = await makeSellable({ sku: 'P3-PRICE', pricePaise: 5000, stock: 5 });
    const c = await createCustomer();
    await addItem({ userId: c.user.id }, { productId: product.id, quantity: 1 });
    const lines = await loadCartLines((await findCartId({ userId: c.user.id }))!);
    await prisma.product.update({ where: { id: product.id }, data: { sellingPricePaise: 6000, mrpPaise: 6000 } });
    const e = await errOf(prisma.$transaction((tx) => assertLinesCurrent(tx, lines)));
    expect(e).toMatchObject({ status: 409, code: 'PRICE_CHANGED' });

    await prisma.product.update({ where: { id: product.id }, data: { status: 'INACTIVE' } });
    expect(await errOf(prisma.$transaction((tx) => assertLinesCurrent(tx, lines)))).toMatchObject({ status: 409, code: 'CART_NEEDS_ATTENTION' });
  });

  it('places the order at the current database price after a price change', async () => {
    const { product, inventoryId } = await makeSellable({ sku: 'P3-NEWPRICE', pricePaise: 5000, stock: 5 });
    const c = await createCustomer();
    const address = await createAddress(c.user.id, VALID_ADDRESS);
    await addItem({ userId: c.user.id }, { productId: product.id, quantity: 2 });
    await prisma.product.update({ where: { id: product.id }, data: { sellingPricePaise: 4500 } });
    const r = await placeOrder(c.user.id, { addressId: address.id, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: randomUUID() });
    const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber: r.orderNumber }, include: { items: true } });
    expect(o.items[0]).toMatchObject({ unitPricePaise: 4500, totalPricePaise: 9000 });
    expect(o.subtotalPaise).toBe(9000);
    expect((await prisma.inventory.findUniqueOrThrow({ where: { id: inventoryId } })).reservedQuantity).toBe(2);
  });
});

/* ───────────────────────────── Per-page counts ───────────────────────────── */

describe('list views count child rows per page (no whole-table aggregates)', () => {
  beforeEach(async () => {
    await resetDb();
    await setupDelivery();
  });

  it('admin orders, customer orders, customers and order detail report correct counts', async () => {
    const a = await makeSellable({ sku: 'P3-A', pricePaise: 3000, stock: 50 });
    const b = await makeSellable({ sku: 'P3-B', pricePaise: 4000, stock: 50 });
    const c = await createCustomer();
    const address = await createAddress(c.user.id, VALID_ADDRESS);
    await addItem({ userId: c.user.id }, { productId: a.product.id, quantity: 1 });
    await addItem({ userId: c.user.id }, { productId: b.product.id, quantity: 3 });
    const two = await placeOrder(c.user.id, { addressId: address.id, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: randomUUID() });
    await addItem({ userId: c.user.id }, { productId: a.product.id, quantity: 1 });
    const one = await placeOrder(c.user.id, { addressId: address.id, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: randomUUID() });
    const other = await createCustomer('other');

    const admin = await listAdminOrders({});
    const byNum = new Map(admin.items.map((o) => [o.orderNumber, o._count.items]));
    expect(byNum.get(two.orderNumber)).toBe(2);
    expect(byNum.get(one.orderNumber)).toBe(1);

    const mine = await listCustomerOrders(c.user.id);
    expect(mine.items.map((o) => o._count.items).sort()).toEqual([1, 2]);
    expect(mine.items[0]).not.toHaveProperty('id'); // internal ids are not exposed to customers

    const customers = await listCustomersAdmin({});
    expect(customers.items.find((u) => u.id === c.user.id)?._count).toEqual({ orders: 2, campaignJoins: 0, redemptions: 0 });
    expect(customers.items.find((u) => u.id === other.user.id)?._count.orders).toBe(0);

    const detail = await getCustomerAdmin(c.user.id, { includeAddresses: false, includeOrders: true });
    expect(detail._count).toEqual({ orders: 2, wishlist: 0 });
    const order = await prisma.order.findUniqueOrThrow({ where: { orderNumber: two.orderNumber } });
    expect((await getAdminOrder(order.id)).user._count.orders).toBe(2);
  });
});

/* ─────────────────────────────── Analytics ─────────────────────────────── */

describe('analytics repeat buyers', () => {
  beforeEach(resetDb);

  it('counts buyers in range and repeat buyers (2+ captured orders up to range end)', async () => {
    const base = { deliveryChargePaise: 0, discountPaise: 0, taxPaise: 0, paymentMethod: 'CASH_ON_DELIVERY' as const, shipName: 'x', shipPhone: '9876543210', shipLine1: 'x', shipCity: 'x', shipState: 'Gujarat', shipPincode: '380015', status: 'DELIVERED' as const };
    let n = 0;
    const order = (userId: string, createdAt: Date, paymentStatus: 'PAID' | 'FAILED' = 'PAID') =>
      prisma.order.create({ data: { ...base, userId, orderNumber: `ZM261101-B${String(++n).padStart(5, '0')}`, idempotencyKey: randomUUID(), subtotalPaise: 1000, totalPaise: 1000, paymentStatus, createdAt } });
    const now = new Date();
    const old = new Date(now.getTime() - 60 * 86_400_000);
    const [twiceInRange, earlierPlusNow, onceOnly, onlyOld, failedEarlier] = await Promise.all([1, 2, 3, 4, 5].map(() => createCustomer('b').then((c) => c.user.id)));
    await order(twiceInRange, now);
    await order(twiceInRange, now);
    await order(earlierPlusNow, old);
    await order(earlierPlusNow, now);
    await order(onceOnly, now);
    await order(onlyOld, old); // not a buyer in range
    await order(failedEarlier, old, 'FAILED'); // failed payment does not count
    await order(failedEarlier, now);
    const r = await getAnalytics({ range: '30d' }, now);
    expect(r.customers).toMatchObject({ buyers: 4, repeatBuyers: 2 });
  });
});

/* ───────────────────────────── Broadcasts ───────────────────────────── */

describe('campaign announcement (batched)', () => {
  beforeEach(resetDb);

  it('notifies every active customer in-app and queues email only for marketing opt-ins', async () => {
    const { ctx } = await adminSession('mkt', ['MARKETING_MANAGER']);
    const optIn = await createCustomer('optin');
    await prisma.customerProfile.update({ where: { userId: optIn.user.id }, data: { marketingOptIn: true } });
    const optOut = await createCustomer('optout');
    const suspended = await createCustomer('susp');
    await prisma.user.update({ where: { id: suspended.user.id }, data: { status: 'SUSPENDED' } });
    const camp = await createCampaign(ctx, { name: 'Monsoon savings', type: 'PROMOTION', isActive: true, startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 86_400_000) });
    const r = await announceCampaign(ctx, camp.id);
    expect(r.notified).toBe(2);
    const notes = await prisma.notification.findMany({ where: { type: 'CAMPAIGN_ANNOUNCEMENT' }, select: { userId: true } });
    expect(notes.map((x) => x.userId).sort()).toEqual([optIn.user.id, optOut.user.id].sort());
    const emails = await prisma.emailMessage.findMany({ where: { type: 'CAMPAIGN_ANNOUNCEMENT' }, select: { userId: true, status: true, lastError: true } });
    expect(emails.find((e) => e.userId === optOut.user.id)).toMatchObject({ status: 'SKIPPED', lastError: 'Customer opted out' });
    // With no provider configured the opt-in message is not "sent" — it is skipped honestly or stays queued.
    expect(['QUEUED', 'SKIPPED']).toContain(emails.find((e) => e.userId === optIn.user.id)?.status);
    expect(emails.some((e) => e.userId === suspended.user.id)).toBe(false);
    // Re-announcing within 6 hours is refused.
    expect((await errOf(announceCampaign(ctx, camp.id))).status).toBe(409);
  });
});

/* ───────────────────────────── Maintenance ───────────────────────────── */

describe('maintenance purge', () => {
  beforeEach(resetDb);

  it('removes only expired sessions, stale throttle rows and abandoned guest carts', async () => {
    const c = await createCustomer('keep');
    const now = new Date();
    const past = new Date(now.getTime() - 1000);
    const expired = await prisma.userSession.create({ data: { tokenHash: sha256(randomUUID()), userId: c.user.id, expiresAt: past } });
    const { id: adminId } = await adminSession('maint', ['SUPER_ADMIN']);
    const idle = await prisma.adminSession.create({
      data: { tokenHash: sha256(randomUUID()), adminId, expiresAt: new Date(now.getTime() + 3600_000), lastSeenAt: new Date(now.getTime() - 3 * 3600_000) },
    });
    await prisma.adminLoginAttempt.createMany({
      data: [
        { identifier: 'old', success: false, createdAt: new Date(now.getTime() - 40 * 86_400_000) },
        { identifier: 'recent', success: false, createdAt: now },
      ],
    });
    const staleGuest = await prisma.cart.create({ data: { sessionId: sha256('g1'), updatedAt: new Date(now.getTime() - 40 * 86_400_000) } });
    const freshGuest = await prisma.cart.create({ data: { sessionId: sha256('g2') } });
    const oldUserCart = await prisma.cart.create({ data: { userId: c.user.id, updatedAt: new Date(now.getTime() - 90 * 86_400_000) } });

    const r = await runMaintenance(now);
    expect(r).toMatchObject({ customerSessions: 1, adminSessions: 1, loginAttempts: 1, guestCarts: 1 });
    expect(await prisma.userSession.findUnique({ where: { id: expired.id } })).toBeNull();
    expect(await prisma.userSession.count({ where: { userId: c.user.id } })).toBe(1); // the live session stays
    expect(await prisma.adminSession.findUnique({ where: { id: idle.id } })).toBeNull();
    expect(await prisma.adminSession.count({ where: { adminId } })).toBe(1);
    expect(await prisma.adminLoginAttempt.findMany({ where: { identifier: { in: ['old', 'recent'] } }, select: { identifier: true } })).toEqual([{ identifier: 'recent' }]);
    expect(await prisma.cart.findUnique({ where: { id: staleGuest.id } })).toBeNull();
    expect(await prisma.cart.findUnique({ where: { id: freshGuest.id } })).not.toBeNull();
    expect(await prisma.cart.findUnique({ where: { id: oldUserCart.id } })).not.toBeNull(); // customer carts are never purged
  });

  it('the cron endpoint requires the secret', async () => {
    const route = await import('../../../apps/20mart/src/app/api/cron/maintenance/route');
    const call = (secret?: string) => route.POST(new NextRequest('http://localhost:3000/api/cron/maintenance', { method: 'POST', headers: secret ? { 'x-cron-secret': secret } : {} }));
    const saved = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'c'.repeat(40);
    resetEnvCache();
    try {
      expect((await call()).status).toBe(401);
      expect((await call('wrong')).status).toBe(401);
      expect((await call('c'.repeat(40))).status).toBe(200);
    } finally {
      process.env.CRON_SECRET = saved;
      resetEnvCache();
    }
  });
});

/* ───────────────────────────── Health & config ───────────────────────────── */

describe('health check and production configuration review', () => {
  it('reports database health; details only with the secret, without secret values', async () => {
    const base = await healthReport(false);
    expect(base).toMatchObject({ status: 'ok', checks: { database: { ok: true } } });
    expect(base).not.toHaveProperty('integrations');
    const full = await healthReport(true);
    expect(full).toHaveProperty('integrations.storage');
    expect(full.checks).toMatchObject({ sessionTimeZone: 'UTC' }); // forced by @20mart/database
    expect(JSON.stringify(full)).not.toContain(env().AUTH_SECRET);
    expect(JSON.stringify(full)).not.toContain(env().DATABASE_URL);

    const route = await import('../../../apps/20mart/src/app/api/health/route');
    const res = await route.GET(new NextRequest('http://localhost:3000/api/health'));
    expect(res.status).toBe(200);
    expect(await res.json()).not.toHaveProperty('config');
  });

  it('flags unsafe production settings', () => {
    const e = env();
    const issues = productionConfigIssues({
      ...e,
      APP_URL: 'http://shop.example.in',
      ADMIN_APP_URL: 'http://shop.example.in',
      DATABASE_URL: 'postgresql://postgres:x@db.example.in:5432/app',
      RAZORPAY_KEY_ID: 'rzp_live_x',
      RAZORPAY_KEY_SECRET: '',
      RAZORPAY_WEBHOOK_SECRET: '',
      CRON_SECRET: '',
      STORAGE_DRIVER: 'local',
    });
    const keys = issues.filter((i) => i.level === 'error').map((i) => i.key);
    expect(keys).toEqual(expect.arrayContaining(['APP_URL', 'ADMIN_APP_URL', 'RAZORPAY_*', 'CRON_SECRET']));
    const warnings = issues.filter((i) => i.level === 'warning').map((i) => i.key);
    expect(warnings).toEqual(expect.arrayContaining(['DATABASE_URL', 'STORAGE_DRIVER']));
    expect(JSON.stringify(issues)).not.toContain('rzp_live_x');
  });
});

/* ───────────────────────────── Security headers ───────────────────────────── */

describe('security headers (next.config)', () => {
  it('storefront sends CSP, HSTS on https, and noindex on private routes', async () => {
    const saved = { APP_URL: process.env.APP_URL, NODE_ENV: process.env.NODE_ENV };
    process.env.APP_URL = 'https://shop.example.in';
    try {
      vi.resetModules(); // re-evaluate the config with the https origin
      // @ts-expect-error -- untyped .mjs Next config
      const { default: cfg } = await import('../../../apps/20mart/next.config.mjs');
      const rules = await cfg.headers();
      const global = Object.fromEntries(rules[0].headers.map((h: { key: string; value: string }) => [h.key, h.value]));
      expect(global['Content-Security-Policy']).toContain("frame-ancestors 'none'");
      expect(global['Content-Security-Policy']).toContain("object-src 'none'");
      expect(global['Content-Security-Policy']).toContain('https://checkout.razorpay.com');
      expect(global['Strict-Transport-Security']).toBe('max-age=31536000');
      const privateSources = rules.slice(1).map((r: { source: string }) => r.source);
      expect(privateSources).toEqual(expect.arrayContaining(['/account/:path*', '/checkout', '/cart', '/api/:path*']));
    } finally {
      process.env.APP_URL = saved.APP_URL;
    }
  });

  it('admin CSP allows no third-party origins', async () => {
    vi.resetModules();
    // @ts-expect-error -- untyped .mjs Next config
    const { default: cfg } = await import('../../../apps/20martadmin/next.config.mjs');
    const h = Object.fromEntries((await cfg.headers())[0].headers.map((x: { key: string; value: string }) => [x.key, x.value]));
    expect(h['Content-Security-Policy']).not.toMatch(/https:\/\/(?!$)[a-z]/);
    expect(h['X-Robots-Tag']).toBe('noindex, nofollow');
  });
});
