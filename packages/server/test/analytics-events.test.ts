import { beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@20mart/database';
import { sha256 } from '../src/crypto';
import {
  clearAnalyticsSettingsCache,
  getAbandonedCartSummary,
  isCartAbandoned,
  normaliseSearchTerm,
  purgeAnalytics,
  recordServerEvent,
  settleAnalytics,
  trackingContext,
  updateAnalyticsSettings,
  type TrackingContext,
} from '../src/tracking';
import { runMaintenance } from '../src/maintenance';
import { addItem } from '../src/cart';
import { adminRequest, adminSession, createCustomer, makeSellable, resetDb } from './helpers';

const STORE = '../../../apps/20mart/src/app/api';
const ADMIN = '../../../apps/20martadmin/src/app/api/admin';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const VID = 'visitor-token-aaaaaaaaaaaaaaaaaaaaaaaa';
const SID = 'session-token-bbbbbbbbbbbbbbbbbbbbbbbb';
const DAY = 86_400_000;

/** Simulate a real database failure: the table is temporarily missing (test DB only). */
async function withTableMissing<T>(table: string, fn: () => Promise<T>) {
  await prisma.$executeRawUnsafe(`ALTER TABLE "${table}" RENAME TO "${table}_offline"`);
  try {
    return await fn();
  } finally {
    await prisma.$executeRawUnsafe(`ALTER TABLE "${table}_offline" RENAME TO "${table}"`);
  }
}

function req(path: string, init: { method?: string; body?: unknown; cookies?: Record<string, string>; headers?: Record<string, string>; origin?: string | null } = {}) {
  const headers = new Headers({ 'user-agent': UA, ...(init.headers ?? {}) });
  const cookies = Object.entries(init.cookies ?? {}).map(([k, v]) => `${k}=${v}`);
  if (cookies.length) headers.set('cookie', cookies.join('; '));
  if (init.origin !== null) headers.set('origin', init.origin ?? 'http://localhost:3000');
  let body: string | undefined;
  if (init.body !== undefined) {
    headers.set('content-type', 'application/json');
    body = typeof init.body === 'string' ? init.body : JSON.stringify(init.body);
  }
  return new NextRequest(new URL(path, 'http://localhost:3000'), { method: init.method ?? 'POST', headers, body });
}

const granted = { '20m_consent': '1.granted' };
const ev = (name: string, extra: Record<string, unknown> = {}) => ({ id: randomUUID(), name, occurredAt: Date.now(), ...extra });
const events = () => import(`${STORE}/analytics/events/route`);
const consent = () => import(`${STORE}/analytics/consent/route`);
const post = async (body: unknown, opts: Parameters<typeof req>[1] = {}) => (await events()).POST(req('/api/analytics/events', { body, ...opts }));

beforeEach(async () => {
  await resetDb();
  clearAnalyticsSettingsCache();
});

describe('analytics consent', () => {
  it('stores nothing and issues no identifiers without consent', async () => {
    const { product } = await makeSellable({ sku: 'ZM-AN-1' });
    const res = await post({ events: [ev('PRODUCT_VIEWED', { productId: product.id })] });
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ accepted: 0, dropped: 1, reason: 'no_consent' });
    expect(res.headers.getSetCookie().join(';')).not.toMatch(/20m_vid|20m_sid/);
    expect(await prisma.analyticsEvent.count()).toBe(0);
  });

  it('treats an explicit denial, Global Privacy Control and an outdated consent version as no consent', async () => {
    const { product } = await makeSellable({ sku: 'ZM-AN-2' });
    const body = () => ({ events: [ev('PRODUCT_VIEWED', { productId: product.id })] });
    expect(await (await post(body(), { cookies: { '20m_consent': '1.denied' } })).json()).toMatchObject({ reason: 'no_consent' });
    expect(await (await post(body(), { cookies: granted, headers: { 'sec-gpc': '1' } })).json()).toMatchObject({ reason: 'no_consent' });
    await prisma.analyticsSettings.upsert({ where: { id: 'default' }, update: { consentVersion: 2 }, create: { id: 'default', consentVersion: 2 } });
    clearAnalyticsSettingsCache();
    expect(await (await post(body(), { cookies: granted })).json()).toMatchObject({ reason: 'no_consent' });
    expect(await prisma.analyticsEvent.count()).toBe(0);
  });

  it('records the choice in a cookie; withdrawing erases this browser’s behavioural data only', async () => {
    const { product } = await makeSellable({ sku: 'ZM-AN-3' });
    const c = await consent();
    const g = await c.POST(req('/api/analytics/consent', { body: { analytics: true } }));
    expect(g.status).toBe(200);
    expect(g.cookies.get('20m_consent')?.value).toBe('1.granted');

    const other = 'other-visitor-cccccccccccccccccccccc';
    await post({ events: [ev('PRODUCT_VIEWED', { productId: product.id })] }, { cookies: { ...granted, '20m_vid': VID, '20m_sid': SID } });
    await post({ events: [ev('PRODUCT_VIEWED', { productId: product.id })] }, { cookies: { ...granted, '20m_vid': other } });
    const ctx = await trackingContext(req('/x', { cookies: { ...granted, '20m_vid': VID, '20m_sid': SID } }), null);
    await recordServerEvent({ name: 'CART_ITEM_ADDED', productId: product.id, quantity: 1 }, ctx);
    expect(await prisma.analyticsEvent.count({ where: { visitorId: sha256(VID) } })).toBe(2);

    const d = await c.POST(req('/api/analytics/consent', { body: { analytics: false }, cookies: { ...granted, '20m_vid': VID, '20m_sid': SID } }));
    expect(d.cookies.get('20m_consent')?.value).toBe('1.denied');
    expect(d.cookies.get('20m_vid')?.value).toBe('');
    expect(d.cookies.get('20m_sid')?.value).toBe('');
    expect(await prisma.analyticsEvent.count({ where: { visitorId: sha256(VID) } })).toBe(0);
    expect(await prisma.analyticsSession.count({ where: { visitorId: sha256(VID) } })).toBe(0);
    // Operational demand signal is kept, anonymised; the other visitor is untouched.
    expect(await prisma.analyticsEvent.findFirstOrThrow({ where: { name: 'CART_ITEM_ADDED' } })).toMatchObject({ visitorId: null, sessionId: null, userId: null });
    expect(await prisma.analyticsEvent.count({ where: { visitorId: sha256(other) } })).toBe(1);
  });

  it('GET reports the state without issuing identifiers', async () => {
    const res = await (await consent()).GET(req('/api/analytics/consent', { method: 'GET', headers: { 'sec-gpc': '1' } }));
    expect(await res.json()).toEqual({ analytics: 'denied', version: 1, browserOptOut: true });
    expect(res.headers.getSetCookie()).toEqual([]);
  });
});

describe('browser event ingestion', () => {
  it('stores consented events with server-resolved price, category, location and hashed identifiers', async () => {
    const { product } = await makeSellable({ sku: 'ZM-AN-4', pricePaise: 4500 });
    const cat = await prisma.category.findUniqueOrThrow({ where: { slug: 'home' } });
    const res = await post(
      {
        events: [ev('PRODUCT_VIEWED', { productId: product.id }), ev('CATEGORY_VIEWED', { categoryId: cat.id }), ev('PRODUCT_SEARCHED', { searchTerm: '  Basmati   RICE ', resultCount: 3 })],
        context: { path: '/product/x?ref=abc', referrer: 'https://www.google.com/search?q=x', utmSource: 'Instagram' },
      },
      { cookies: { ...granted, '20m_pin': '380015' } }
    );
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ accepted: 3, dropped: 0, duplicates: 0 });
    const vid = res.cookies.get('20m_vid')!;
    const sid = res.cookies.get('20m_sid')!;
    expect(vid.httpOnly).toBe(true);
    expect(sid.maxAge).toBe(30 * 60);

    const rows = await prisma.analyticsEvent.findMany({ orderBy: { name: 'asc' } });
    expect(rows.every((r) => r.category === 'BEHAVIORAL' && r.source === 'CLIENT' && r.visitorId === sha256(vid.value) && r.sessionId === sha256(sid.value))).toBe(true);
    const view = rows.find((r) => r.name === 'PRODUCT_VIEWED')!;
    expect(view).toMatchObject({ unitPricePaise: 4500, categoryId: product.categoryId, pincode: '380015', userId: null });
    expect(rows.find((r) => r.name === 'PRODUCT_SEARCHED')).toMatchObject({ searchTerm: 'basmati rice', resultCount: 3 });
    const session = await prisma.analyticsSession.findUniqueOrThrow({ where: { id: sha256(sid.value) } });
    expect(session).toMatchObject({ landingPath: '/product/x', referrerHost: 'www.google.com', utmSource: 'instagram', deviceType: 'desktop', eventCount: 3 });
  });

  it('rejects client-supplied prices, stock, identity and server-only events', async () => {
    const { product } = await makeSellable({ sku: 'ZM-AN-5' });
    for (const bad of [
      { events: [ev('PRODUCT_VIEWED', { productId: product.id, unitPricePaise: 1 })] },
      { events: [ev('PRODUCT_VIEWED', { productId: product.id, userId: 'someone' })] },
      { events: [ev('PURCHASE_COMPLETED', { productId: product.id })] },
      { events: [ev('CART_ITEM_ADDED', { productId: product.id })] },
      { events: [{ ...ev('HOME_VIEWED'), id: 'not-a-uuid' }] },
      { events: Array.from({ length: 21 }, () => ev('HOME_VIEWED')) },
      { events: [] },
      { events: [ev('HOME_VIEWED')], extra: true },
    ]) {
      expect((await post(bad, { cookies: granted })).status).toBe(400);
    }
    expect((await post('{not json', { cookies: granted })).status).toBe(400);
    expect(await prisma.analyticsEvent.count()).toBe(0);
  });

  it('deduplicates re-sent events and drops events for unknown products, mismatched variants or categories', async () => {
    const { product } = await makeSellable({ sku: 'ZM-AN-6' });
    const { product: other } = await makeSellable({ sku: 'ZM-AN-7' });
    const v = await prisma.productVariant.create({ data: { productId: other.id, sku: 'ZM-AN-7-V', name: 'Big', sellingPricePaise: 900, mrpPaise: 900 } });
    const batch = { events: [ev('PRODUCT_VIEWED', { productId: product.id }), ev('APP_OPENED')] };
    const cookies = { ...granted, '20m_vid': VID, '20m_sid': SID };
    expect(await (await post(batch, { cookies })).json()).toMatchObject({ accepted: 2 });
    expect(await (await post(batch, { cookies })).json()).toMatchObject({ accepted: 0, duplicates: 2 });
    const dropped = await post(
      {
        events: [
          ev('PRODUCT_VIEWED', { productId: 'no-such-product' }),
          ev('PRODUCT_VIEWED', { productId: product.id, variantId: v.id }),
          ev('CATEGORY_VIEWED', { categoryId: 'nope' }),
          ev('PRODUCT_SEARCHED', { searchTerm: '   ' }),
          ev('PRODUCT_VIEWED', { productId: other.id, variantId: v.id }),
        ],
      },
      { cookies }
    );
    expect(await dropped.json()).toMatchObject({ accepted: 1, dropped: 4 });
    expect(await prisma.analyticsEvent.findFirstOrThrow({ where: { variantId: v.id } })).toMatchObject({ unitPricePaise: 900 });
    expect(await prisma.analyticsSession.findUniqueOrThrow({ where: { id: sha256(SID) } })).toMatchObject({ eventCount: 3 });
  });

  it('never stores personal-looking search terms and ignores implausible client clocks', async () => {
    const res = await post(
      {
        events: [
          ev('PRODUCT_SEARCHED', { searchTerm: 'me@example.com' }),
          ev('PRODUCT_SEARCHED', { searchTerm: 'call 98765 43210' }),
          ev('HOME_VIEWED', { occurredAt: Date.now() - 10 * DAY }),
        ],
      },
      { cookies: granted }
    );
    expect(await res.json()).toMatchObject({ accepted: 3 });
    const searches = await prisma.analyticsEvent.findMany({ where: { name: 'PRODUCT_SEARCHED' } });
    expect(searches.map((s) => s.searchTerm)).toEqual([null, null]);
    expect(searches.every((s) => (s.metadata as { termRedacted?: boolean }).termRedacted)).toBe(true);
    const home = await prisma.analyticsEvent.findFirstOrThrow({ where: { name: 'HOME_VIEWED' } });
    expect(Date.now() - home.occurredAt.getTime()).toBeLessThan(60_000);
    expect(normaliseSearchTerm('ATTA 5kg')).toBe('atta 5kg');
    expect(normaliseSearchTerm('560001')).toBe('560001');
  });

  it('ignores bots, blocks cross-origin posts and rate-limits', async () => {
    expect(await (await post({ events: [ev('HOME_VIEWED')] }, { cookies: granted, headers: { 'user-agent': 'Googlebot/2.1' } })).json()).toMatchObject({ reason: 'bot' });
    expect((await post({ events: [ev('HOME_VIEWED')] }, { cookies: granted, origin: 'https://evil.example' })).status).toBe(403);
    expect(await prisma.analyticsEvent.count()).toBe(0);
    let last = 202;
    for (let i = 0; i < 125 && last !== 429; i++) last = (await post({ events: [ev('HOME_VIEWED')] }, { cookies: granted })).status;
    expect(last).toBe(429);
  });

  it('links an anonymous session to the customer once they sign in', async () => {
    const c = await createCustomer();
    const cookies = { ...granted, '20m_vid': VID, '20m_sid': SID };
    await post({ events: [ev('HOME_VIEWED')] }, { cookies });
    expect((await prisma.analyticsSession.findUniqueOrThrow({ where: { id: sha256(SID) } })).userId).toBeNull();
    await post({ events: [ev('CART_VIEWED')] }, { cookies: { ...cookies, '20m_session': c.token } });
    expect((await prisma.analyticsSession.findUniqueOrThrow({ where: { id: sha256(SID) } })).userId).toBe(c.user.id);
    expect((await prisma.analyticsEvent.findFirstOrThrow({ where: { name: 'CART_VIEWED' } })).userId).toBe(c.user.id);
  });

  it('answers 202 and stores nothing when analytics storage fails', async () => {
    const res = await withTableMissing('AnalyticsEvent', () => post({ events: [ev('HOME_VIEWED')] }, { cookies: granted }));
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ accepted: 0 });
  });
});

describe('server-side operational events', () => {
  const anon: TrackingContext = { consent: 'denied', visitorToken: VID, sessionToken: SID, userId: 'u1', pincode: '380015', userAgent: UA };

  it('are always recorded but carry identity only with consent', async () => {
    expect(await recordServerEvent({ name: 'OUT_OF_STOCK_ADD_ATTEMPT', productId: 'p1', quantity: 3, unitPricePaise: 2500, metadata: { reason: 'out_of_stock' } }, anon)).toBe(true);
    expect(await recordServerEvent({ name: 'CART_ITEM_ADDED', productId: 'p1', quantity: 1 }, { ...anon, consent: 'granted' })).toBe(true);
    const [oos, add] = await Promise.all([
      prisma.analyticsEvent.findFirstOrThrow({ where: { name: 'OUT_OF_STOCK_ADD_ATTEMPT' } }),
      prisma.analyticsEvent.findFirstOrThrow({ where: { name: 'CART_ITEM_ADDED' } }),
    ]);
    expect(oos).toMatchObject({ category: 'OPERATIONAL', source: 'SERVER', userId: null, visitorId: null, sessionId: null, pincode: '380015', quantity: 3, unitPricePaise: 2500 });
    expect(add).toMatchObject({ userId: 'u1', visitorId: sha256(VID), sessionId: sha256(SID) });
  });

  it('never throw: invalid input, personal metadata and database failures return false', async () => {
    expect(await recordServerEvent({ name: 'PRODUCT_VIEWED' as never })).toBe(false);
    expect(await recordServerEvent({ name: 'COUPON_APPLIED', metadata: { email: 'a@b.co' } })).toBe(false);
    expect(await recordServerEvent({ name: 'COUPON_APPLIED', unitPricePaise: -1 })).toBe(false);
    await expect(withTableMissing('AnalyticsEvent', () => recordServerEvent({ name: 'ORDER_CANCELLED', orderId: 'o1' }))).resolves.toBe(false);
    expect(await prisma.analyticsEvent.count()).toBe(0);
  });

  it('leave existing cart behaviour unchanged; a call without a request records an anonymous event', async () => {
    const { product } = await makeSellable({ sku: 'ZM-AN-8' });
    const c = await createCustomer();
    await addItem({ userId: c.user.id }, { productId: product.id, quantity: 1 });
    expect(await prisma.cartItem.count()).toBe(1);
    await settleAnalytics();
    expect(await prisma.analyticsEvent.findFirstOrThrow()).toMatchObject({ name: 'CART_ITEM_ADDED', userId: null, visitorId: null, cartId: null, quantity: 1, unitPricePaise: 2000 });
  });
});

describe('retention', () => {
  const at = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY);
  const row = (category: 'BEHAVIORAL' | 'OPERATIONAL', daysAgo: number) => ({
    id: randomUUID(),
    name: (category === 'BEHAVIORAL' ? 'HOME_VIEWED' : 'CART_ITEM_ADDED') as 'HOME_VIEWED',
    category,
    source: (category === 'BEHAVIORAL' ? 'CLIENT' : 'SERVER') as 'CLIENT',
    occurredAt: at(daysAgo),
    userId: 'u1',
    visitorId: 'v1',
    sessionId: 's1',
  });

  it('deletes behavioural data after 180 days, anonymises then deletes operational data, and leaves security logs alone', async () => {
    await prisma.analyticsEvent.createMany({ data: [row('BEHAVIORAL', 181), row('BEHAVIORAL', 179), row('OPERATIONAL', 200), row('OPERATIONAL', 10), row('OPERATIONAL', 400)] });
    await prisma.analyticsSession.createMany({ data: [{ id: 'old', visitorId: 'v1', lastSeenAt: at(181) }, { id: 'new', visitorId: 'v1', lastSeenAt: at(1) }] });
    await prisma.adminLoginAttempt.create({ data: { identifier: 'x', success: false, createdAt: at(5) } });

    const r = await runMaintenance();
    expect(r.analytics).toEqual({ behavioralEventsDeleted: 1, operationalEventsAnonymised: 1, operationalEventsDeleted: 1, sessionsDeleted: 1 });
    const left = await prisma.analyticsEvent.findMany({ orderBy: { occurredAt: 'asc' } });
    expect(left.map((e) => [e.category, e.visitorId])).toEqual([
      ['OPERATIONAL', null],
      ['BEHAVIORAL', 'v1'],
      ['OPERATIONAL', 'v1'],
    ]);
    expect(await prisma.analyticsSession.findMany({ select: { id: true } })).toEqual([{ id: 'new' }]);
    expect(await prisma.adminLoginAttempt.count()).toBe(1);
    // Idempotent.
    expect((await purgeAnalytics()).behavioralEventsDeleted).toBe(0);
  });

  it('an analytics purge failure does not stop the security purges', async () => {
    await prisma.adminLoginAttempt.create({ data: { identifier: 'x', success: false, createdAt: at(40) } });
    const r = await withTableMissing('AnalyticsSettings', () => runMaintenance());
    expect(r.analytics).toBeNull();
    expect(r.loginAttempts).toBe(1);
  });
});

describe('cart abandonment and settings', () => {
  it('uses a configurable inactivity threshold (24 h by default)', async () => {
    expect(isCartAbandoned(new Date(Date.now() - 25 * 3_600_000), new Date(), 24)).toBe(true);
    expect(isCartAbandoned(new Date(Date.now() - 23 * 3_600_000), new Date(), 24)).toBe(false);

    const { product } = await makeSellable({ sku: 'ZM-AN-9', pricePaise: 3000 });
    const c1 = await createCustomer();
    const c2 = await createCustomer();
    await addItem({ userId: c1.user.id }, { productId: product.id, quantity: 2 });
    await addItem({ userId: c2.user.id }, { productId: product.id, quantity: 1 });
    const old = new Date(Date.now() - 30 * 3_600_000);
    const cart1 = await prisma.cart.findFirstOrThrow({ where: { userId: c1.user.id } });
    await prisma.cart.update({ where: { id: cart1.id }, data: { updatedAt: old } });
    await prisma.cartItem.updateMany({ where: { cartId: cart1.id }, data: { updatedAt: old } });

    expect(await getAbandonedCartSummary()).toMatchObject({ thresholdHours: 24, abandonedCarts: 1, customerCarts: 1, guestCarts: 0, units: 2, estimatedValuePaise: 6000 });
    const { ctx } = await adminSession('analyst', ['SUPER_ADMIN']);
    await updateAnalyticsSettings(ctx, { cartAbandonmentHours: 48 });
    expect((await getAbandonedCartSummary()).abandonedCarts).toBe(0);
  });

  it('settings: view needs analytics.view, changes need analytics.manage (super admin only), validated and audited', async () => {
    const route = await import(`${ADMIN}/analytics/settings/route`);
    const marketing = await adminSession('mkt', ['MARKETING_MANAGER']);
    const admin = await adminSession('ops', ['ADMIN']);
    const root = await adminSession('root', ['SUPER_ADMIN']);
    const put = (token: string, body: unknown) => route.PUT(adminRequest('/api/admin/analytics/settings', { method: 'PUT', token, body }));

    expect((await route.GET(adminRequest('/api/admin/analytics/settings', { token: marketing.token }))).status).toBe(200);
    expect((await put(marketing.token, { cartAbandonmentHours: 12 })).status).toBe(403);
    expect((await put(admin.token, { cartAbandonmentHours: 12 })).status).toBe(403);
    expect((await put(root.token, { behavioralRetentionDays: 7 })).status).toBe(400);
    expect((await put(root.token, { behavioralRetentionDays: 400, operationalRetentionDays: 365 })).status).toBe(400);
    expect((await put(root.token, { unknown: 1 })).status).toBe(400);
    const ok = await put(root.token, { cartAbandonmentHours: 12, consentVersion: 2 });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ cartAbandonmentHours: 12, consentVersion: 2, behavioralRetentionDays: 180 });
    expect((await put(root.token, { consentVersion: 1 })).status).toBe(400);
    const log = await prisma.adminAuditLog.findFirstOrThrow({ where: { action: 'Updated analytics settings' } });
    expect(log.details).toContain('cartAbandonmentHours: 24 → 12');

    const abandoned = await import(`${ADMIN}/analytics/abandoned-carts/route`);
    expect((await abandoned.GET(adminRequest('/api/admin/analytics/abandoned-carts', { token: marketing.token }))).status).toBe(200);
    const orders = await adminSession('orders', ['ORDER_MANAGER']);
    expect((await abandoned.GET(adminRequest('/api/admin/analytics/abandoned-carts', { token: orders.token }))).status).toBe(403);
  });
});
