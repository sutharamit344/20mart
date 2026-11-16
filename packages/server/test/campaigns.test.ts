import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@20mart/database';
import { adminRequest, adminSession, createCustomer, ctxParams, customerRequest, makeSellable, resetDb } from './helpers';
import { getCampaignAnalytics, getPublicCampaign, listLiveCampaigns } from '../src/campaigns';
import { getAnalytics } from '../src/analytics';

const ADMIN = '../../../apps/20martadmin/src/app/api/admin/campaigns';
const STORE = '../../../apps/20mart/src/app/api/campaigns/[slug]';
const DAY = 86_400_000;

beforeEach(resetDb);

async function adminCreate(token: string, body: Record<string, unknown>) {
  const { POST } = await import(`${ADMIN}/route`);
  return POST(adminRequest('/api/admin/campaigns', { method: 'POST', token, body }));
}

async function fycSetup() {
  const { product: mug } = await makeSellable({ sku: 'MUG', pricePaise: 6000, stock: 1, category: 'kitchen' });
  const { product: lamp } = await makeSellable({ sku: 'LAMP', pricePaise: 10000, stock: 0, category: 'home' });
  const { product: other } = await makeSellable({ sku: 'OTHER', pricePaise: 2000 });
  const reward = await prisma.coupon.create({ data: { code: 'CAMPAIGN100', title: '₹100 off', discountValue: 10000, minOrderValuePaise: 49900, requiresGrant: true, isActive: false } });
  const mm = await adminSession('marketer', ['MARKETING_MANAGER']);
  const res = await adminCreate(mm.token, { name: 'Fill Your Cart', type: 'FILL_YOUR_CART', isActive: true, couponId: reward.id, productIds: [mug.id, lamp.id], maxQtyPerItem: 5 });
  expect(res.status).toBe(201);
  const created = await res.json();
  return { mug, lamp, other, reward, mm, campaign: created };
}

describe('campaign visibility', () => {
  it('customers never see inactive, scheduled or expired campaigns', async () => {
    const mm = await adminSession('marketer', ['MARKETING_MANAGER']);
    await adminCreate(mm.token, { name: 'Live Sale', type: 'PROMOTION', isActive: true });
    await adminCreate(mm.token, { name: 'Draft Sale', type: 'PROMOTION', isActive: false });
    await adminCreate(mm.token, { name: 'Future Sale', type: 'PROMOTION', isActive: true, startsAt: new Date(Date.now() + DAY).toISOString() });
    await adminCreate(mm.token, { name: 'Old Sale', type: 'PROMOTION', isActive: true, startsAt: new Date(Date.now() - 3 * DAY).toISOString(), endsAt: new Date(Date.now() - DAY).toISOString() });
    expect((await listLiveCampaigns()).map((c) => c.name)).toEqual(['Live Sale']);
    expect(await getPublicCampaign('draft-sale')).toBeNull();
    expect(await getPublicCampaign('future-sale')).toBeNull();
    expect(await getPublicCampaign('old-sale')).toBeNull();
    expect((await getPublicCampaign('live-sale'))?.name).toBe('Live Sale');
    const bad = await adminCreate(mm.token, { name: 'Broken', type: 'PROMOTION', startsAt: '2026-12-10', endsAt: '2026-12-01' });
    expect(bad.status).toBe(400);
  });

  it('issued-only campaign coupon codes are never exposed on public pages', async () => {
    const { reward } = await fycSetup();
    await prisma.coupon.update({ where: { id: reward.id }, data: { isActive: true } });
    const pub = await getPublicCampaign('fill-your-cart');
    expect(pub?.coupon).toMatchObject({ code: null, issuedOnJoin: true });
    expect(JSON.stringify(pub)).not.toContain('CAMPAIGN100');
  });
});

describe('Fill Your Cart', () => {
  it('requires sign-in, keeps a separate saved cart, reserves nothing and creates no orders', async () => {
    const { mug, lamp, other, campaign } = await fycSetup();
    const cart = await import(`${STORE}/cart/route`);
    const join = await import(`${STORE}/join/route`);
    const fav = await import(`${STORE}/favorites/route`);
    const p = ctxParams({ slug: campaign.slug });
    expect((await join.POST(customerRequest('/x', { method: 'POST' }), p)).status).toBe(401);

    const c = await createCustomer();
    const joined = await (await join.POST(customerRequest('/x', { method: 'POST', token: c.token }), p)).json();
    expect(joined).toMatchObject({ joined: true, couponIssued: true });
    // Second join: idempotent, coupon not issued twice.
    expect((await (await join.POST(customerRequest('/x', { method: 'POST', token: c.token }), p)).json()).couponIssued).toBe(false);
    expect(await prisma.couponGrant.count({ where: { userId: c.user.id } })).toBe(1);

    // Out-of-stock products can still be wanted (demand), above stock too — nothing is reserved.
    let r = await cart.PUT(customerRequest('/x', { method: 'PUT', token: c.token, body: { productId: lamp.id, quantity: 3 } }), p);
    expect(r.status).toBe(200);
    r = await cart.PUT(customerRequest('/x', { method: 'PUT', token: c.token, body: { productId: mug.id, quantity: 4 } }), p);
    const view = await r.json();
    expect(view).toMatchObject({ joined: true, totalUnits: 7, estimatedValuePaise: 3 * 10000 + 4 * 6000 });
    expect((await cart.PUT(customerRequest('/x', { method: 'PUT', token: c.token, body: { productId: mug.id, quantity: 6 } }), p)).status).toBe(409); // > maxQtyPerItem
    expect((await cart.PUT(customerRequest('/x', { method: 'PUT', token: c.token, body: { productId: other.id, quantity: 1 } }), p)).status).toBe(400); // not in campaign
    await fav.PUT(customerRequest('/x', { method: 'PUT', token: c.token, body: { productId: mug.id, favorite: true } }), p);

    expect(await prisma.inventory.aggregate({ _sum: { reservedQuantity: true } })).toMatchObject({ _sum: { reservedQuantity: 0 } });
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.cartItem.count()).toBe(0); // the real cart is untouched
    expect(await prisma.stockMovement.count({ where: { movementType: 'RESERVATION' } })).toBe(0);

    // Another customer cannot see this customer's saved cart.
    const d = await createCustomer('other');
    const theirs = await (await cart.GET(customerRequest('/x', { token: d.token }), p)).json();
    expect(theirs).toMatchObject({ joined: false, lines: [], totalUnits: 0 });
  });

  it('demand analytics are interest only and never appear as sales', async () => {
    const { mug, lamp, campaign, mm } = await fycSetup();
    const cart = await import(`${STORE}/cart/route`);
    const fav = await import(`${STORE}/favorites/route`);
    const p = ctxParams({ slug: campaign.slug });
    for (let i = 0; i < 3; i++) {
      const c = await createCustomer();
      await cart.PUT(customerRequest('/x', { method: 'PUT', token: c.token, body: { productId: mug.id, quantity: 2 } }), p);
      if (i < 2) await cart.PUT(customerRequest('/x', { method: 'PUT', token: c.token, body: { productId: lamp.id, quantity: 1 } }), p);
      if (i === 0) await fav.PUT(customerRequest('/x', { method: 'PUT', token: c.token, body: { productId: lamp.id, favorite: true } }), p);
    }
    const a = await getCampaignAnalytics(campaign.id);
    expect(a.demand).toMatchObject({ participants: 3, savedCarts: 3, savedUnits: 8, favorites: 1, estimatedInterestPaise: 6 * 6000 + 2 * 10000 });
    expect(a.demand.mostAdded[0]).toMatchObject({ name: 'Item MUG', units: 6, customers: 3 });
    expect(a.demand.mostFavorited[0]).toMatchObject({ name: 'Item LAMP', favorites: 1 });
    expect(a.demand.byCategory.map((c) => c.category).sort()).toEqual(['Home', 'Kitchen']);
    expect(a.demand.byPricePoint).toEqual([
      { pricePaise: 6000, units: 6, customers: 3 },
      { pricePaise: 10000, units: 2, customers: 2 },
    ]);
    expect(a.coupons).toEqual({ distributed: 3, redeemed: 0 });
    expect(a.sales.couponPaidOrders).toBe(0);

    const report = await getAnalytics({ range: '7d' });
    expect(report.sales.grossPaidRevenuePaise).toBe(0); // saved carts are not sales
    expect(report.interest).toMatchObject({ fycJoins: 3, savedCarts: 3, savedUnits: 8 });
    expect(report.coupons).toMatchObject({ distributed: 3, redeemed: 0 });

    // Admin analytics route needs campaigns.view; order staff cannot read it.
    const route = await import(`${ADMIN}/[id]/analytics/route`);
    expect((await route.GET(adminRequest('/x', { token: mm.token }), ctxParams({ id: campaign.id }))).status).toBe(200);
    const om = await adminSession('ordermgr', ['ORDER_MANAGER']);
    expect((await route.GET(adminRequest('/x', { token: om.token }), ctxParams({ id: campaign.id }))).status).toBe(403);
  });

  it('a campaign with participants cannot be deleted; ended campaigns are read-only', async () => {
    const { mug, campaign, mm } = await fycSetup();
    const c = await createCustomer();
    const cart = await import(`${STORE}/cart/route`);
    const p = ctxParams({ slug: campaign.slug });
    await cart.PUT(customerRequest('/x', { method: 'PUT', token: c.token, body: { productId: mug.id, quantity: 1 } }), p);
    const one = await import(`${ADMIN}/[id]/route`);
    expect((await one.DELETE(adminRequest('/x', { method: 'DELETE', token: mm.token }), ctxParams({ id: campaign.id }))).status).toBe(409);
    await prisma.campaign.update({ where: { id: campaign.id }, data: { startsAt: new Date(Date.now() - 2 * DAY), endsAt: new Date(Date.now() - 1000) } });
    expect((await cart.PUT(customerRequest('/x', { method: 'PUT', token: c.token, body: { productId: mug.id, quantity: 2 } }), p)).status).toBe(404);
    const saved = await (await cart.GET(customerRequest('/x', { token: c.token }), p)).json();
    expect(saved).toMatchObject({ editable: false, totalUnits: 1 });
  });
});

describe('campaign RBAC', () => {
  it('only marketing permissions can manage campaigns', async () => {
    const inv = await adminSession('invmgr', ['INVENTORY_MANAGER']);
    expect((await adminCreate(inv.token, { name: 'X Sale', type: 'PROMOTION' })).status).toBe(403);
    const c = await createCustomer();
    expect((await adminCreate(c.token, { name: 'X Sale', type: 'PROMOTION' })).status).toBe(401);
  });
});
