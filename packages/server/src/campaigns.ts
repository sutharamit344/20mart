/**
 * Promotional campaigns and the Fill Your Cart pre-launch demand campaign.
 *
 * "Live" = isActive AND startsAt <= now AND (endsAt is null OR endsAt > now).
 * Customers only ever see live campaigns; everything else is a 404.
 *
 * Fill Your Cart data (participants, saved campaign carts, favourites) is a DEMAND
 * signal. It never touches Cart/Order/Inventory and is never counted as sales.
 */
import { prisma, Prisma, type CampaignType } from '@20mart/database';
import { slugify } from '@20mart/shared';
import { z } from 'zod';
import type { AdminContext } from './auth/admin';
import { audit } from './audit';
import { getPublicProductsByIds, visibleProductWhere } from './catalog/public';
import { grantCoupon } from './coupons';
import { AppError, badRequest, conflict, notFound } from './errors';
import { notifyCouponIssued, notifyMany, processEmailQueue } from './notifications';
import { notifyStorefront } from './revalidate';
import { deleteStoredImage, uploadImage } from './media';

export const MAX_CAMPAIGN_CART_ITEMS = 100;

export const liveCampaignWhere = (now = new Date()): Prisma.CampaignWhereInput => ({
  isActive: true,
  startsAt: { lte: now },
  OR: [{ endsAt: null }, { endsAt: { gt: now } }],
});

export function campaignState(c: { isActive: boolean; startsAt: Date; endsAt: Date | null }, now = new Date()) {
  if (!c.isActive) return 'INACTIVE' as const;
  if (c.startsAt > now) return 'SCHEDULED' as const;
  if (c.endsAt && c.endsAt <= now) return 'ENDED' as const;
  return 'LIVE' as const;
}

/* ───────────────────────────────── Public ───────────────────────────────── */

const publicSelect = {
  id: true,
  name: true,
  slug: true,
  type: true,
  description: true,
  bannerTitle: true,
  bannerSubtitle: true,
  bannerImageUrl: true,
  startsAt: true,
  endsAt: true,
  maxQtyPerItem: true,
  coupon: { select: { code: true, title: true, requiresGrant: true, isActive: true, startsAt: true, endsAt: true, minOrderValuePaise: true } },
} satisfies Prisma.CampaignSelect;

type PublicRow = Prisma.CampaignGetPayload<{ select: typeof publicSelect }>;

/** Only expose a coupon code publicly when it is a public (non-issued) coupon that is live itself. */
function publicCampaign(c: PublicRow, now = new Date()) {
  const { coupon, ...rest } = c;
  const couponLive = !!coupon && coupon.isActive && coupon.startsAt <= now && (!coupon.endsAt || coupon.endsAt > now);
  return {
    ...rest,
    coupon: coupon
      ? { title: coupon.title, minOrderValuePaise: coupon.minOrderValuePaise, code: !coupon.requiresGrant && couponLive ? coupon.code : null, issuedOnJoin: c.type === 'FILL_YOUR_CART' }
      : null,
  };
}

/** Live campaigns for the homepage / campaign index. */
export async function listLiveCampaigns(opts: { homepageOnly?: boolean; limit?: number } = {}) {
  const now = new Date();
  const rows = await prisma.campaign.findMany({
    where: { ...liveCampaignWhere(now), ...(opts.homepageOnly ? { showOnHomepage: true } : {}) },
    orderBy: [{ displayOrder: 'asc' }, { startsAt: 'desc' }],
    take: opts.limit ?? 10,
    select: { ...publicSelect, products: { orderBy: { sortOrder: 'asc' }, take: 10, select: { productId: true } } },
  });
  return Promise.all(
    rows.map(async ({ products, ...c }) => ({ ...publicCampaign(c, now), products: await getPublicProductsByIds(products.map((p) => p.productId), 10) }))
  );
}

/** Customer landing page. Not live → null (rendered as 404). */
export async function getPublicCampaign(slug: string) {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const now = new Date();
  const c = await prisma.campaign.findFirst({
    where: { slug, ...liveCampaignWhere(now) },
    select: { ...publicSelect, products: { orderBy: { sortOrder: 'asc' }, select: { productId: true } } },
  });
  if (!c) return null;
  const { products, ...rest } = c;
  return { ...publicCampaign(rest, now), products: await getPublicProductsByIds(products.map((p) => p.productId), 200) };
}

/* ─────────────────────────────── Fill Your Cart ─────────────────────────────── */

async function liveFycCampaign(slug: string) {
  const c = await prisma.campaign.findFirst({
    where: { slug, type: 'FILL_YOUR_CART', ...liveCampaignWhere() },
    select: { id: true, name: true, couponId: true, maxQtyPerItem: true, _count: { select: { products: true } } },
  });
  if (!c) throw notFound('Campaign');
  return c;
}

/** Join (idempotent). Issues the campaign coupon once, if one is attached. */
export async function joinCampaign(userId: string, slug: string) {
  const c = await liveFycCampaign(slug);
  const r = await prisma.campaignParticipant.createMany({ data: [{ campaignId: c.id, userId }], skipDuplicates: true });
  const joined = r.count === 1;
  let couponIssued = false;
  if (c.couponId) {
    couponIssued = await grantCoupon(c.couponId, userId, 'CAMPAIGN', c.id);
    if (couponIssued) {
      const coupon = await prisma.coupon.findUnique({ where: { id: c.couponId }, select: { code: true, title: true, endsAt: true, minOrderValuePaise: true } });
      if (coupon) await notifyCouponIssued(userId, coupon);
    }
  }
  return { joined: true, newlyJoined: joined, couponIssued };
}

async function assertCampaignProduct(campaign: { id: string; _count: { products: number } }, productId: string) {
  z.string().uuid().parse(productId);
  const product = await prisma.product.findFirst({ where: { AND: [visibleProductWhere, { id: productId }] }, select: { id: true } });
  if (!product) throw notFound('Product');
  if (campaign._count.products > 0) {
    const inCampaign = await prisma.campaignProduct.count({ where: { campaignId: campaign.id, productId } });
    if (!inCampaign) throw badRequest('This product is not part of this campaign');
  }
}

export const campaignCartInput = z.object({ productId: z.string().uuid(), quantity: z.coerce.number().int().min(0).max(99) });

/** Set the quantity of a product in the customer's saved campaign cart (0 removes). Auto-joins. No stock is reserved. */
export async function setCampaignCartItem(userId: string, slug: string, raw: unknown) {
  const { productId, quantity } = campaignCartInput.parse(raw);
  const c = await liveFycCampaign(slug);
  if (quantity === 0) {
    await prisma.campaignCartItem.deleteMany({ where: { campaignId: c.id, userId, productId } });
    return getMyCampaignCart(userId, slug);
  }
  if (quantity > c.maxQtyPerItem) throw new AppError(409, 'QTY_LIMIT', `You can save up to ${c.maxQtyPerItem} of each item`);
  await assertCampaignProduct(c, productId);
  await joinCampaign(userId, slug);
  const exists = await prisma.campaignCartItem.findUnique({ where: { campaignId_userId_productId: { campaignId: c.id, userId, productId } }, select: { id: true } });
  if (!exists && (await prisma.campaignCartItem.count({ where: { campaignId: c.id, userId } })) >= MAX_CAMPAIGN_CART_ITEMS) {
    throw new AppError(409, 'CART_FULL', `Your campaign cart can hold up to ${MAX_CAMPAIGN_CART_ITEMS} different items`);
  }
  await prisma.campaignCartItem.upsert({
    where: { campaignId_userId_productId: { campaignId: c.id, userId, productId } },
    update: { quantity },
    create: { campaignId: c.id, userId, productId, quantity },
  });
  return getMyCampaignCart(userId, slug);
}

export const campaignFavoriteInput = z.object({ productId: z.string().uuid(), favorite: z.boolean() });

export async function setCampaignFavorite(userId: string, slug: string, raw: unknown) {
  const { productId, favorite } = campaignFavoriteInput.parse(raw);
  const c = await liveFycCampaign(slug);
  if (!favorite) {
    await prisma.campaignFavorite.deleteMany({ where: { campaignId: c.id, userId, productId } });
  } else {
    await assertCampaignProduct(c, productId);
    await joinCampaign(userId, slug);
    await prisma.campaignFavorite.createMany({ data: [{ campaignId: c.id, userId, productId }], skipDuplicates: true });
  }
  return getMyCampaignCart(userId, slug);
}

/** The customer's own saved campaign cart. Values are estimates at today's prices — not an order. */
export async function getMyCampaignCart(userId: string, slug: string) {
  const c = await prisma.campaign.findFirst({ where: { slug, type: 'FILL_YOUR_CART' }, select: { id: true, isActive: true, startsAt: true, endsAt: true } });
  if (!c) throw notFound('Campaign');
  const [participant, items, favorites] = await Promise.all([
    prisma.campaignParticipant.findUnique({ where: { campaignId_userId: { campaignId: c.id, userId } }, select: { joinedAt: true } }),
    prisma.campaignCartItem.findMany({ where: { campaignId: c.id, userId }, orderBy: { createdAt: 'asc' }, select: { productId: true, quantity: true } }),
    prisma.campaignFavorite.findMany({ where: { campaignId: c.id, userId }, select: { productId: true } }),
  ]);
  const products = await getPublicProductsByIds(items.map((i) => i.productId), MAX_CAMPAIGN_CART_ITEMS);
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = items.filter((i) => byId.has(i.productId)).map((i) => ({ product: byId.get(i.productId)!, quantity: i.quantity, estimatedPaise: byId.get(i.productId)!.sellingPricePaise * i.quantity }));
  return {
    joined: !!participant,
    joinedAt: participant?.joinedAt ?? null,
    editable: campaignState(c) === 'LIVE',
    lines,
    favorites: favorites.map((f) => f.productId),
    totalUnits: lines.reduce((a, l) => a + l.quantity, 0),
    estimatedValuePaise: lines.reduce((a, l) => a + l.estimatedPaise, 0),
  };
}

/* ───────────────────────────────── Admin ───────────────────────────────── */

const dateish = z
  .union([z.string().trim(), z.date(), z.null()])
  .optional()
  .transform((v, ctx) => {
    if (v == null || v === '') return null;
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Invalid date' });
      return z.NEVER;
    }
    return d;
  });

const optText = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null);

export const campaignInput = z
  .object({
    name: z.string().trim().min(3).max(120),
    slug: z.string().trim().max(80).optional(),
    type: z.enum(['PROMOTION', 'FILL_YOUR_CART']),
    description: optText(2000),
    bannerTitle: optText(120),
    bannerSubtitle: optText(240),
    bannerImageUrl: z.string().trim().url().max(500).nullish().transform((v) => v || null),
    isActive: z.boolean().default(false),
    showOnHomepage: z.boolean().default(true),
    startsAt: dateish,
    endsAt: dateish,
    couponId: z.string().uuid().nullish().transform((v) => v ?? null),
    maxQtyPerItem: z.coerce.number().int().min(1).max(99).default(10),
    displayOrder: z.coerce.number().int().min(0).max(1000).default(0),
    productIds: z.array(z.string().uuid()).max(500).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.startsAt && v.endsAt && v.endsAt <= v.startsAt) ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'End must be after start' });
  });

export const campaignListQuery = z.object({
  q: z.string().trim().max(60).optional(),
  type: z.enum(['PROMOTION', 'FILL_YOUR_CART']).optional().catch(undefined),
  page: z.coerce.number().int().min(1).default(1).catch(1),
});

export async function listCampaigns(raw: unknown) {
  const q = campaignListQuery.parse(raw);
  const pageSize = 25;
  const where: Prisma.CampaignWhereInput = { type: q.type, ...(q.q ? { name: { contains: q.q, mode: 'insensitive' } } : {}) };
  const [rows, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip: (q.page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, name: true, slug: true, type: true, isActive: true, showOnHomepage: true, startsAt: true, endsAt: true, displayOrder: true,
        coupon: { select: { id: true, code: true } },
        _count: { select: { products: true, participants: true, grants: true } },
      },
    }),
    prisma.campaign.count({ where }),
  ]);
  return { items: rows.map((r) => ({ ...r, state: campaignState(r) })), total, page: q.page, pageSize };
}

export async function getCampaign(id: string) {
  z.string().uuid().parse(id);
  const c = await prisma.campaign.findUnique({
    where: { id },
    include: {
      coupon: { select: { id: true, code: true, title: true, isActive: true } },
      products: { orderBy: { sortOrder: 'asc' }, select: { product: { select: { id: true, name: true, sku: true, status: true, sellingPricePaise: true } } } },
      _count: { select: { participants: true, grants: true } },
    },
  });
  if (!c) throw notFound('Campaign');
  return { ...c, state: campaignState(c) };
}

async function uniqueSlug(base: string, excludeId?: string) {
  const root = slugify(base).slice(0, 70) || 'campaign';
  for (let i = 0; i < 50; i++) {
    const s = i ? `${root}-${i + 1}` : root;
    const hit = await prisma.campaign.findFirst({ where: { slug: s, ...(excludeId ? { NOT: { id: excludeId } } : {}) }, select: { id: true } });
    if (!hit) return s;
  }
  throw conflict('Could not generate a unique slug');
}

async function checkCampaignRefs(v: z.infer<typeof campaignInput>) {
  if (v.couponId && !(await prisma.coupon.count({ where: { id: v.couponId } }))) throw badRequest('Selected coupon does not exist');
  const ids = [...new Set(v.productIds)];
  if (ids.length && (await prisma.product.count({ where: { id: { in: ids } } })) !== ids.length) throw badRequest('One or more selected products do not exist');
  return ids;
}

export async function createCampaign(actor: AdminContext, raw: unknown) {
  const v = campaignInput.parse(raw);
  const ids = await checkCampaignRefs(v);
  const slug = await uniqueSlug(v.slug || v.name);
  const { productIds: _p, startsAt, ...data } = v;
  return prisma.$transaction(async (tx) => {
    const c = await tx.campaign.create({
      data: { ...data, slug, startsAt: startsAt ?? new Date(), products: { create: ids.map((productId, i) => ({ productId, sortOrder: i })) } },
      select: { id: true, slug: true },
    });
    await audit(tx, actor, { action: 'Created campaign', category: 'CAMPAIGN', entityType: 'Campaign', entityId: c.id, details: `${v.name} (${v.type}), active=${v.isActive}` });
    return c;
  }).then((c) => (notifyStorefront(['/', `/campaigns/${c.slug}`]), c));
}

export async function updateCampaign(actor: AdminContext, id: string, raw: unknown) {
  z.string().uuid().parse(id);
  const v = campaignInput.parse(raw);
  const existing = await prisma.campaign.findUnique({ where: { id }, select: { type: true, startsAt: true, _count: { select: { participants: true } } } });
  if (!existing) throw notFound('Campaign');
  if (existing.type !== v.type && existing._count.participants) throw conflict('Campaign type cannot change after customers have joined');
  const ids = await checkCampaignRefs(v);
  const slug = await uniqueSlug(v.slug || v.name, id);
  const { productIds: _p, startsAt, ...data } = v;
  await prisma.$transaction(async (tx) => {
    await tx.campaign.update({ where: { id }, data: { ...data, slug, startsAt: startsAt ?? existing.startsAt } });
    await tx.campaignProduct.deleteMany({ where: { campaignId: id } });
    if (ids.length) await tx.campaignProduct.createMany({ data: ids.map((productId, i) => ({ campaignId: id, productId, sortOrder: i })) });
    await audit(tx, actor, { action: 'Updated campaign', category: 'CAMPAIGN', entityType: 'Campaign', entityId: id, details: `${v.name}, active=${v.isActive}` });
  });
  notifyStorefront(['/', `/campaigns/${slug}`]);
  return { id, slug };
}

export async function setCampaignActive(actor: AdminContext, id: string, isActive: boolean) {
  z.string().uuid().parse(id);
  const c = await prisma.campaign.findUnique({ where: { id }, select: { name: true, slug: true } });
  if (!c) throw notFound('Campaign');
  await prisma.$transaction(async (tx) => {
    await tx.campaign.update({ where: { id }, data: { isActive } });
    await audit(tx, actor, { action: isActive ? 'Activated campaign' : 'Deactivated campaign', category: 'CAMPAIGN', entityType: 'Campaign', entityId: id, details: c.name });
  });
  notifyStorefront(['/', `/campaigns/${c.slug}`]);
  return { id, isActive };
}

export async function deleteCampaign(actor: AdminContext, id: string) {
  z.string().uuid().parse(id);
  const c = await prisma.campaign.findUnique({ where: { id }, select: { name: true, _count: { select: { participants: true, grants: true } } } });
  if (!c) throw notFound('Campaign');
  if (c._count.participants || c._count.grants) throw conflict('Customers have joined this campaign. Deactivate it instead of deleting, so its demand data is kept.');
  await prisma.$transaction(async (tx) => {
    await tx.campaign.delete({ where: { id } });
    await audit(tx, actor, { action: 'Deleted campaign', category: 'CAMPAIGN', entityType: 'Campaign', entityId: id, details: c.name });
  });
  notifyStorefront(['/']);
  return { deleted: true };
}

/* ─────────────────────────── Performance & demand analytics ─────────────────────────── */

const PAID: Prisma.OrderWhereInput = { paymentStatus: { in: ['PAID', 'PARTIALLY_REFUNDED'] } };

/** Sales performance of a PROMOTION (or FYC after launch): only paid orders count. */
async function campaignSales(c: { id: string; couponId: string | null; startsAt: Date; endsAt: Date | null }) {
  const window = { gte: c.startsAt, ...(c.endsAt ? { lt: c.endsAt } : {}) };
  const [couponOrders, productUnits] = await Promise.all([
    c.couponId
      ? prisma.order.aggregate({ where: { ...PAID, couponId: c.couponId, createdAt: window }, _count: { _all: true }, _sum: { totalPaise: true, discountPaise: true } })
      : null,
    prisma.orderItem.aggregate({
      where: { order: { ...PAID, createdAt: window }, product: { campaignProducts: { some: { campaignId: c.id } } } },
      _sum: { quantity: true, totalPricePaise: true },
    }),
  ]);
  return {
    couponPaidOrders: couponOrders?._count._all ?? 0,
    couponPaidRevenuePaise: couponOrders?._sum.totalPaise ?? 0,
    couponDiscountPaise: couponOrders?._sum.discountPaise ?? 0,
    campaignProductUnitsSold: productUnits._sum.quantity ?? 0,
    campaignProductRevenuePaise: productUnits._sum.totalPricePaise ?? 0,
  };
}

/**
 * Fill Your Cart demand analytics. Everything here is INTEREST, valued at current prices —
 * it is reported separately from (and never added to) sales.
 */
export async function getCampaignAnalytics(id: string) {
  z.string().uuid().parse(id);
  const c = await prisma.campaign.findUnique({ where: { id }, select: { id: true, name: true, type: true, couponId: true, startsAt: true, endsAt: true, isActive: true } });
  if (!c) throw notFound('Campaign');

  const [participants, savedCarts, favoritesTotal, joinsByDay, topAdded, topFav, byCategory, byPricePoint, grants, redemptions] = await Promise.all([
    prisma.campaignParticipant.count({ where: { campaignId: id } }),
    prisma.campaignCartItem.groupBy({ by: ['userId'], where: { campaignId: id } }).then((r) => r.length),
    prisma.campaignFavorite.count({ where: { campaignId: id } }),
    prisma.$queryRaw<{ day: string; n: bigint }[]>`
      SELECT to_char(("joinedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') AS day, count(*) AS n
        FROM "CampaignParticipant" WHERE "campaignId" = ${id} GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<{ productId: string; name: string; units: bigint; customers: bigint; valuePaise: bigint }[]>`
      SELECT p."id" AS "productId", p."name", sum(ci."quantity") AS units, count(DISTINCT ci."userId") AS customers, sum(ci."quantity" * p."sellingPricePaise") AS "valuePaise"
        FROM "CampaignCartItem" ci JOIN "Product" p ON p."id" = ci."productId"
       WHERE ci."campaignId" = ${id} GROUP BY p."id", p."name" ORDER BY units DESC, customers DESC LIMIT 15`,
    prisma.$queryRaw<{ productId: string; name: string; favorites: bigint }[]>`
      SELECT p."id" AS "productId", p."name", count(*) AS favorites
        FROM "CampaignFavorite" f JOIN "Product" p ON p."id" = f."productId"
       WHERE f."campaignId" = ${id} GROUP BY p."id", p."name" ORDER BY favorites DESC LIMIT 15`,
    prisma.$queryRaw<{ category: string; units: bigint; customers: bigint; valuePaise: bigint }[]>`
      SELECT cat."name" AS category, sum(ci."quantity") AS units, count(DISTINCT ci."userId") AS customers, sum(ci."quantity" * p."sellingPricePaise") AS "valuePaise"
        FROM "CampaignCartItem" ci JOIN "Product" p ON p."id" = ci."productId" JOIN "Category" cat ON cat."id" = p."categoryId"
       WHERE ci."campaignId" = ${id} GROUP BY cat."name" ORDER BY units DESC`,
    prisma.$queryRaw<{ pricePaise: number; units: bigint; customers: bigint }[]>`
      SELECT p."sellingPricePaise" AS "pricePaise", sum(ci."quantity") AS units, count(DISTINCT ci."userId") AS customers
        FROM "CampaignCartItem" ci JOIN "Product" p ON p."id" = ci."productId"
       WHERE ci."campaignId" = ${id} GROUP BY p."sellingPricePaise" ORDER BY p."sellingPricePaise"`,
    prisma.couponGrant.count({ where: { campaignId: id } }),
    c.couponId
      ? prisma.couponRedemption.count({ where: { couponId: c.couponId, status: 'APPLIED', user: { couponGrants: { some: { campaignId: id } } } } })
      : 0,
  ]);
  const totals = await prisma.$queryRaw<{ units: bigint | null; valuePaise: bigint | null }[]>`
    SELECT sum(ci."quantity") AS units, sum(ci."quantity" * p."sellingPricePaise") AS "valuePaise"
      FROM "CampaignCartItem" ci JOIN "Product" p ON p."id" = ci."productId" WHERE ci."campaignId" = ${id}`;
  const n = (v: bigint | number | null | undefined) => Number(v ?? 0);
  return {
    campaign: { ...c, state: campaignState(c) },
    demand: {
      participants,
      savedCarts,
      savedUnits: n(totals[0]?.units),
      /** Value of saved carts at today's prices. Interest only — NOT revenue. */
      estimatedInterestPaise: n(totals[0]?.valuePaise),
      favorites: favoritesTotal,
      joinsByDay: joinsByDay.map((d) => ({ day: d.day, joins: n(d.n) })),
      mostAdded: topAdded.map((r) => ({ productId: r.productId, name: r.name, units: n(r.units), customers: n(r.customers), valuePaise: n(r.valuePaise) })),
      mostFavorited: topFav.map((r) => ({ productId: r.productId, name: r.name, favorites: n(r.favorites) })),
      byCategory: byCategory.map((r) => ({ category: r.category, units: n(r.units), customers: n(r.customers), valuePaise: n(r.valuePaise) })),
      byPricePoint: byPricePoint.map((r) => ({ pricePaise: n(r.pricePaise), units: n(r.units), customers: n(r.customers) })),
    },
    coupons: { distributed: grants, redeemed: redemptions },
    sales: await campaignSales(c),
  };
}

/* ───────────────────────────── Campaign announcement ───────────────────────────── */

const ANNOUNCE_BATCH = 500;

/**
 * Announce a live campaign: in-app notification for every active customer; email only to
 * customers who opted in to marketing. Emails are queued and handed to the provider in batches.
 */
export async function announceCampaign(actor: AdminContext, id: string) {
  z.string().uuid().parse(id);
  const c = await prisma.campaign.findUnique({ where: { id }, select: { id: true, name: true, slug: true, isActive: true, startsAt: true, endsAt: true, bannerTitle: true, bannerSubtitle: true, description: true } });
  if (!c) throw notFound('Campaign');
  if (campaignState(c) !== 'LIVE') throw conflict('Only live campaigns can be announced');
  const recent = await prisma.adminAuditLog.count({ where: { entityType: 'Campaign', entityId: id, action: 'Announced campaign', createdAt: { gt: new Date(Date.now() - 6 * 3600_000) } } });
  if (recent) throw conflict('This campaign was announced in the last 6 hours');
  const title = c.bannerTitle || c.name;
  const body = c.bannerSubtitle || c.description?.slice(0, 200) || 'A new 20Mart campaign is live.';
  const link = `/campaigns/${c.slug}`;
  const message = { type: 'CAMPAIGN_ANNOUNCEMENT' as const, title, body, link, email: { subject: title, content: { heading: title, paragraphs: [body], cta: { label: 'See the campaign', href: link } } } };
  // In-app for every active customer, email only where allowed (same rules as notify()). Customers are
  // paged by id and written in bulk, so the request stays fast with many customers. Emails are only
  // queued here; the first batch is sent below and the cron drains the rest.
  let notified = 0;
  let cursor: string | undefined;
  for (;;) {
    const page = await prisma.user.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { id: 'asc' },
      take: ANNOUNCE_BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, email: true, status: true, profile: { select: { emailOrderUpdates: true, marketingOptIn: true } } },
    });
    if (!page.length) break;
    notified += (await notifyMany(page, message)).notified;
    cursor = page[page.length - 1].id;
    if (page.length < ANNOUNCE_BATCH) break;
  }
  await audit(prisma, actor, { action: 'Announced campaign', category: 'CAMPAIGN', entityType: 'Campaign', entityId: id, details: `${c.name}: ${notified} customer(s) notified` });
  const queue = await processEmailQueue(25);
  const emails = await prisma.emailMessage.groupBy({ by: ['status'], where: { type: 'CAMPAIGN_ANNOUNCEMENT', createdAt: { gt: new Date(Date.now() - 3600_000) } }, _count: { _all: true } });
  return { notified, emailStatus: Object.fromEntries(emails.map((e) => [e.status, e._count._all])), queue };
}

/** Upload/replace the banner image (stored in the configured image storage). */
export async function setCampaignBanner(actor: AdminContext, id: string, file: Blob) {
  z.string().uuid().parse(id);
  const existing = await prisma.campaign.findUnique({ where: { id }, select: { bannerImageKey: true, name: true, slug: true } });
  if (!existing) throw notFound('Campaign');
  const stored = await uploadImage(file, 'campaigns');
  try {
    await prisma.$transaction(async (tx) => {
      await tx.campaign.update({ where: { id }, data: { bannerImageUrl: stored.url, bannerImageKey: stored.key } });
      await audit(tx, actor, { action: 'Updated campaign banner', category: 'MEDIA', entityType: 'Campaign', entityId: id, details: existing.name });
    });
  } catch (e) {
    await deleteStoredImage(stored.key);
    throw e;
  }
  await deleteStoredImage(existing.bannerImageKey);
  notifyStorefront(['/', `/campaigns/${existing.slug}`]);
  return { bannerImageUrl: stored.url };
}

export type { CampaignType };
