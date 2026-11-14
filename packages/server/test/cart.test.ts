import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@20mart/database';
import { addItem, clearCart, getCart, mergeGuestCart, removeItem, setQuantity } from '../src/cart';
import { addToWishlist, listWishlist, moveWishlistItemToCart, removeFromWishlist } from '../src/wishlist';
import { toAppError } from '../src/errors';
import { createCustomer, makeSellable, resetDb, setupDelivery } from './helpers';

beforeEach(async () => {
  await resetDb();
  await setupDelivery();
});
const statusOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return 200;
  } catch (e) {
    return toAppError(e).status;
  }
};

describe('cart', () => {
  it('adds, increments, updates, removes and clears with server-side prices', async () => {
    const { product } = await makeSellable({ sku: 'ZM-A', pricePaise: 2000, stock: 8 });
    const { product: b } = await makeSellable({ sku: 'ZM-B', pricePaise: 6000, stock: 5 });
    const { user } = await createCustomer();
    const owner = { userId: user.id };
    await addItem(owner, { productId: product.id, quantity: 2 });
    let { cart } = await addItem(owner, { productId: product.id, quantity: 1 }); // increments, no duplicate line
    ({ cart } = await addItem(owner, { productId: b.id }));
    expect(cart.lines).toHaveLength(2);
    expect(cart.totalQuantity).toBe(4);
    expect(cart.subtotalPaise).toBe(3 * 2000 + 6000);
    const lineA = cart.lines.find((l) => l.productId === product.id)!;
    cart = await setQuantity(owner, lineA.id, { quantity: 5 });
    expect(cart.subtotalPaise).toBe(5 * 2000 + 6000);
    cart = await removeItem(owner, cart.lines.find((l) => l.productId === b.id)!.id);
    expect(cart.lines).toHaveLength(1);
    cart = await clearCart(owner);
    expect(cart.lines).toHaveLength(0);
    expect(cart.subtotalPaise).toBe(0);
  });

  it('enforces stock and the per-line limit; ignores any client price', async () => {
    const { product } = await makeSellable({ sku: 'ZM-S', pricePaise: 2000, stock: 3 });
    const { user } = await createCustomer();
    const owner = { userId: user.id };
    expect(await statusOf(addItem(owner, { productId: product.id, quantity: 4 }))).toBe(409);
    const { cart } = await addItem(owner, { productId: product.id, quantity: 3, pricePaise: 1, unitPricePaise: 1 } as never);
    expect(cart.lines[0].unitPricePaise).toBe(2000);
    expect(await statusOf(addItem(owner, { productId: product.id, quantity: 1 }))).toBe(409);
    const { product: big } = await makeSellable({ sku: 'ZM-BIG', stock: 500 });
    expect(await statusOf(addItem(owner, { productId: big.id, quantity: 11 }))).toBe(409); // maxQtyPerLine 10
    const { product: none } = await makeSellable({ sku: 'ZM-NONE', stock: 0 });
    expect(await statusOf(addItem(owner, { productId: none.id }))).toBe(409);
  });

  it('flags price changes, stock drops and unavailable products on read', async () => {
    const { product, inventoryId } = await makeSellable({ sku: 'ZM-P', pricePaise: 2000, mrpPaise: 3000, stock: 5 });
    const { product: gone } = await makeSellable({ sku: 'ZM-G' });
    const { user } = await createCustomer();
    const owner = { userId: user.id };
    await addItem(owner, { productId: product.id, quantity: 4 });
    await addItem(owner, { productId: gone.id });
    await prisma.product.update({ where: { id: product.id }, data: { sellingPricePaise: 2500 } });
    await prisma.inventory.update({ where: { id: inventoryId }, data: { availableQuantity: 2 } });
    await prisma.product.update({ where: { id: gone.id }, data: { status: 'INACTIVE' } });
    const cart = await getCart(owner);
    const p = cart.lines.find((l) => l.productId === product.id)!;
    expect(p.priceChanged).toBe(true);
    expect(p.unitPricePaise).toBe(2500);
    expect(p.state).toBe('insufficient');
    expect(p.maxQty).toBe(2);
    expect(cart.lines.find((l) => l.productId === gone.id)!.state).toBe('unavailable');
    expect(cart.subtotalPaise).toBe(0); // nothing purchasable as-is
    expect(cart.hasIssues).toBe(true);
    expect(await statusOf(setQuantity(owner, p.id, { quantity: 2 }))).toBe(200); // decreasing is allowed
  });

  it('isolates carts: another customer cannot touch my cart lines', async () => {
    const { product } = await makeSellable({ sku: 'ZM-I' });
    const a = await createCustomer('a');
    const b = await createCustomer('b');
    const { cart } = await addItem({ userId: a.user.id }, { productId: product.id });
    const lineId = cart.lines[0].id;
    expect(await statusOf(setQuantity({ userId: b.user.id }, lineId, { quantity: 5 }))).toBe(404);
    expect(await statusOf(removeItem({ userId: b.user.id }, lineId))).toBe(404);
    expect(await statusOf(removeItem({ guestToken: 'random-guest-token' }, lineId))).toBe(404);
    expect((await getCart({ userId: a.user.id })).lines[0].quantity).toBe(1);
  });

  it('merges a guest cart into the customer cart without duplicates, capped by stock', async () => {
    const { product: x } = await makeSellable({ sku: 'ZM-X', stock: 5 });
    const { product: y } = await makeSellable({ sku: 'ZM-Y', stock: 5 });
    const { product: z } = await makeSellable({ sku: 'ZM-Z', stock: 5 });
    const guest = await addItem(null, { productId: x.id, quantity: 4 });
    const guestToken = guest.newGuestToken!;
    expect(guestToken).toBeTruthy();
    await addItem({ guestToken }, { productId: y.id, quantity: 1 });
    await addItem({ guestToken }, { productId: z.id, quantity: 1 });
    await prisma.product.update({ where: { id: z.id }, data: { status: 'INACTIVE' } });
    const { user } = await createCustomer();
    await addItem({ userId: user.id }, { productId: x.id, quantity: 3 }); // existing customer cart is kept
    const result = await mergeGuestCart(guestToken, user.id);
    expect(result).toEqual({ merged: 2, dropped: 1 });
    const cart = await getCart({ userId: user.id });
    expect(cart.lines.map((l) => [l.productId, l.quantity]).sort()).toEqual([[x.id, 5], [y.id, 1]].sort()); // 3 + 4 capped at stock 5
    expect((await getCart({ guestToken })).lines).toHaveLength(0); // guest cart gone
  });
});

describe('wishlist', () => {
  it('adds without duplicates, lists live data, removes and moves to cart', async () => {
    const { product } = await makeSellable({ sku: 'ZM-W', pricePaise: 4000 });
    const { user } = await createCustomer();
    await addToWishlist(user.id, product.id);
    await addToWishlist(user.id, product.id);
    expect(await prisma.wishlistItem.count()).toBe(1);
    await prisma.product.update({ where: { id: product.id }, data: { sellingPricePaise: 3500 } });
    const list = await listWishlist(user.id);
    expect(list.items[0].sellingPricePaise).toBe(3500);
    const cart = await moveWishlistItemToCart(user.id, product.id);
    expect(cart.lines[0].productId).toBe(product.id);
    expect(await prisma.wishlistItem.count()).toBe(0);
    await addToWishlist(user.id, product.id);
    await removeFromWishlist(user.id, product.id);
    expect((await listWishlist(user.id)).items).toHaveLength(0);
  });

  it('keeps wishlists private and rejects hidden products', async () => {
    const { product } = await makeSellable({ sku: 'ZM-PRIV' });
    const a = await createCustomer('a');
    const b = await createCustomer('b');
    await addToWishlist(a.user.id, product.id);
    expect((await listWishlist(b.user.id)).items).toHaveLength(0);
    expect(await statusOf(moveWishlistItemToCart(b.user.id, product.id))).toBe(404);
    await removeFromWishlist(b.user.id, product.id); // no effect on A
    expect((await listWishlist(a.user.id)).items).toHaveLength(1);
    await prisma.product.update({ where: { id: product.id }, data: { status: 'DRAFT' } });
    expect(await statusOf(addToWishlist(b.user.id, product.id))).toBe(404);
  });
});
