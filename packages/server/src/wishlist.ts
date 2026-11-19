import { prisma } from '@20mart/database';
import { z } from 'zod';
import { addItem } from './cart';
import { getPublicProductsByIds, visibleProductWhere } from './catalog/public';
import { badRequest, notFound } from './errors';
import { trackServerEvents, type AnalyticsCaller } from './tracking/events';

/**
 * WISHLIST_ADDED for wishlist rows this request actually inserted. The rows come from one atomic
 * INSERT … ON CONFLICT DO NOTHING RETURNING, so of any number of concurrent requests (single adds or
 * imports) exactly one sees a given row. The row id is also the dedupe key, so a logical addition can
 * never be stored twice; removing and saving again later creates a new row and a new event.
 */
function trackWishlisted(analytics: AnalyticsCaller, created: { id: string; productId: string }[], source: 'product' | 'import') {
  if (!created.length) return;
  trackServerEvents(analytics, async () => {
    const products = await prisma.product.findMany({
      where: { id: { in: created.map((c) => c.productId) } },
      select: { id: true, categoryId: true, sellingPricePaise: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    return created.flatMap((c) => {
      const p = byId.get(c.productId);
      if (!p) return [];
      return [{ name: 'WISHLIST_ADDED' as const, productId: p.id, categoryId: p.categoryId, unitPricePaise: p.sellingPricePaise, metadata: { source }, dedupeKey: c.id }];
    });
  });
}

const insertWishlistRows = (userId: string, productIds: string[]) =>
  prisma.wishlistItem.createManyAndReturn({
    data: productIds.map((productId) => ({ userId, productId })),
    skipDuplicates: true,
    select: { id: true, productId: true },
  });

const productIdSchema = z.string().uuid('Invalid product');

/** Wishlisted products with live price and stock state (hidden products drop out automatically). */
export async function listWishlist(userId: string) {
  const rows = await prisma.wishlistItem.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { productId: true } });
  const products = await getPublicProductsByIds(rows.map((r) => r.productId));
  return { productIds: rows.map((r) => r.productId), items: products };
}

export async function addToWishlist(userId: string, productId: string, analytics: AnalyticsCaller = null) {
  productIdSchema.parse(productId);
  const visible = await prisma.product.count({ where: { AND: [visibleProductWhere, { id: productId }] } });
  if (!visible) throw notFound('Product');
  // Idempotent: the (userId, productId) unique key prevents duplicates; only a new row is returned.
  trackWishlisted(analytics, await insertWishlistRows(userId, [productId]), 'product');
}

export async function removeFromWishlist(userId: string, productId: string) {
  productIdSchema.parse(productId);
  await prisma.wishlistItem.deleteMany({ where: { userId, productId } });
}

/** Add one unit to the cart, then remove from the wishlist (only if the cart add succeeded). */
export async function moveWishlistItemToCart(userId: string, productId: string, variantId?: string | null, analytics: AnalyticsCaller = null) {
  productIdSchema.parse(productId);
  const owned = await prisma.wishlistItem.findUnique({ where: { userId_productId: { userId, productId } } });
  if (!owned) throw notFound('Wishlist item');
  const result = await addItem({ userId }, { productId, variantId: variantId ?? null, quantity: 1 }, {}, analytics, 'wishlist');
  await prisma.wishlistItem.delete({ where: { id: owned.id } });
  return result.cart;
}

/** One-time import of a pre-login (localStorage) wishlist. Only visible products are kept. */
export async function importWishlist(userId: string, raw: unknown, analytics: AnalyticsCaller = null) {
  const ids = z.array(z.string()).max(100).parse(raw);
  const valid = ids.filter((id) => productIdSchema.safeParse(id).success);
  if (ids.length && !valid.length) throw badRequest('No valid products to import');
  const visible = await prisma.product.findMany({ where: { AND: [visibleProductWhere, { id: { in: valid } }] }, select: { id: true } });
  const created = visible.length ? await insertWishlistRows(userId, visible.map((p) => p.id)) : [];
  trackWishlisted(analytics, created, 'import');
  return { imported: visible.length };
}
