import { prisma } from '@20mart/database';
import { z } from 'zod';
import { addItem } from './cart';
import { getPublicProductsByIds, visibleProductWhere } from './catalog/public';
import { badRequest, notFound } from './errors';

const productIdSchema = z.string().uuid('Invalid product');

/** Wishlisted products with live price and stock state (hidden products drop out automatically). */
export async function listWishlist(userId: string) {
  const rows = await prisma.wishlistItem.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { productId: true } });
  const products = await getPublicProductsByIds(rows.map((r) => r.productId));
  return { productIds: rows.map((r) => r.productId), items: products };
}

export async function addToWishlist(userId: string, productId: string) {
  productIdSchema.parse(productId);
  const visible = await prisma.product.count({ where: { AND: [visibleProductWhere, { id: productId }] } });
  if (!visible) throw notFound('Product');
  // Idempotent: the (userId, productId) unique key prevents duplicates.
  await prisma.wishlistItem.upsert({ where: { userId_productId: { userId, productId } }, update: {}, create: { userId, productId } });
}

export async function removeFromWishlist(userId: string, productId: string) {
  productIdSchema.parse(productId);
  await prisma.wishlistItem.deleteMany({ where: { userId, productId } });
}

/** Add one unit to the cart, then remove from the wishlist (only if the cart add succeeded). */
export async function moveWishlistItemToCart(userId: string, productId: string, variantId?: string | null) {
  productIdSchema.parse(productId);
  const owned = await prisma.wishlistItem.findUnique({ where: { userId_productId: { userId, productId } } });
  if (!owned) throw notFound('Wishlist item');
  const result = await addItem({ userId }, { productId, variantId: variantId ?? null, quantity: 1 });
  await prisma.wishlistItem.delete({ where: { id: owned.id } });
  return result.cart;
}

/** One-time import of a pre-login (localStorage) wishlist. Only visible products are kept. */
export async function importWishlist(userId: string, raw: unknown) {
  const ids = z.array(z.string()).max(100).parse(raw);
  const valid = ids.filter((id) => productIdSchema.safeParse(id).success);
  if (ids.length && !valid.length) throw badRequest('No valid products to import');
  const visible = await prisma.product.findMany({ where: { AND: [visibleProductWhere, { id: { in: valid } }] }, select: { id: true } });
  await prisma.wishlistItem.createMany({ data: visible.map((p) => ({ userId, productId: p.id })), skipDuplicates: true });
  return { imported: visible.length };
}
