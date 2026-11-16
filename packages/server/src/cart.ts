import { prisma, Prisma } from '@20mart/database';
import { formatPaise, type AppliedCoupon, type CartLine, type CartLineState, type CartView } from '@20mart/shared';
import { z } from 'zod';
import { randomToken, sha256 } from './crypto';
import { AppError, badRequest, conflict, notFound } from './errors';
import { evaluateCartCoupon } from './coupon-engine';
import { getStoreSettings, PINCODE_REGEX } from './settings';
import { bestLineStock, lineKey, selectWarehouseFor, stockRows, warehouseCandidates, type StockRow, type WarehouseCandidate } from './fulfillment';

type Db = Prisma.TransactionClient | typeof prisma;

/** Customer's selected delivery PIN (location cookie or checkout address). */
export interface CartLocation {
  pincode?: string | null;
}
const validPin = (loc?: CartLocation) => (loc?.pincode && PINCODE_REGEX.test(loc.pincode) ? loc.pincode : null);

export type CartOwner = { userId: string; guestToken?: never } | { guestToken: string; userId?: never };

export type { CartLine, CartLineState, CartView } from '@20mart/shared';

export const addItemInput = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullish().transform((v) => v ?? null),
  quantity: z.coerce.number().int().min(1).max(100).default(1),
});
export const setQuantityInput = z.object({ quantity: z.coerce.number().int().min(0).max(100) });

const lineSelect = {
  id: true,
  quantity: true,
  addedPricePaise: true,
  product: {
    select: {
      id: true,
      slug: true,
      name: true,
      sku: true,
      status: true,
      categoryId: true,
      sellingPricePaise: true,
      mrpPaise: true,
      category: { select: { status: true } },
      brand: { select: { status: true, name: true } },
      images: { where: { isPrimary: true }, take: 1, select: { url: true } },
      variants: { where: { status: 'ACTIVE' }, select: { id: true }, take: 1 },
    },
  },
  variant: {
    select: {
      id: true,
      name: true,
      sku: true,
      status: true,
      sellingPricePaise: true,
      mrpPaise: true,
    },
  },
} satisfies Prisma.CartItemSelect;

type LineRow = Prisma.CartItemGetPayload<{ select: typeof lineSelect }>;

/**
 * Evaluate a cart line against live catalog, price and stock. `inv` is the stock row at the
 * warehouse that would fulfil the order (or the best active warehouse when no location is set).
 * `atLocation` switches the wording to the customer's delivery location.
 */
export function evaluateLine(row: LineRow, maxPerLine: number, inv: StockRow | null, atLocation = false): CartLine {
  const p = row.product;
  const v = row.variant;
  const sellable = inv?.sellable ?? 0;
  const unit = v ? v.sellingPricePaise : p.sellingPricePaise;
  const mrp = v ? v.mrpPaise : p.mrpPaise;
  const visible =
    p.status === 'ACTIVE' &&
    p.category.status === 'ACTIVE' &&
    (!p.brand || p.brand.status === 'ACTIVE') &&
    (!v || v.status === 'ACTIVE') &&
    !(p.variants.length > 0 && !v); // product now has options → this line must be re-chosen
  const maxQty = Math.min(sellable, maxPerLine);
  let state: CartLineState = 'ok';
  let message: string | null = null;
  if (!visible) {
    state = 'unavailable';
    message = 'This item is no longer available';
  } else if (sellable <= 0) {
    state = 'out_of_stock';
    message = atLocation ? 'Not available for delivery to your location' : 'Out of stock';
  } else if (row.quantity > sellable) {
    state = 'insufficient';
    message = atLocation ? `Only ${maxQty} available for your location — reduce the quantity` : `Only ${maxQty} available — reduce the quantity`;
  } else if (row.quantity > maxPerLine) {
    state = 'insufficient';
    message = `You can buy up to ${maxPerLine} of this item`;
  }
  const priceChanged = unit !== row.addedPricePaise;
  if (state === 'ok' && priceChanged) {
    message = unit < row.addedPricePaise ? `Price dropped to ${formatPaise(unit)}` : `Price changed to ${formatPaise(unit)}`;
  }
  return {
    id: row.id,
    productId: p.id,
    categoryId: p.categoryId,
    variantId: v?.id ?? null,
    inventoryId: inv?.inventoryId ?? null,
    slug: p.slug,
    name: p.name,
    sku: v?.sku ?? p.sku,
    variantName: v?.name ?? null,
    brandName: p.brand?.name ?? null,
    imageUrl: p.images[0]?.url ?? null,
    unitPricePaise: unit,
    mrpPaise: mrp,
    addedPricePaise: row.addedPricePaise,
    quantity: row.quantity,
    lineTotalPaise: unit * row.quantity,
    maxQty,
    state,
    priceChanged,
    message,
  };
}

export interface CartEvaluation {
  lines: CartLine[];
  /** PIN the lines were evaluated for (null = no location; stock from the best active warehouse). */
  pincode: string | null;
  /** Location has at least one active, mapped warehouse. */
  covered: boolean;
  /** Warehouse that can fulfil every line at this location, or null. */
  warehouse: WarehouseCandidate | null;
}

/**
 * Evaluate the cart for a delivery location. With a covered PIN code every line is checked
 * against ONE warehouse (the one that would ship the whole order); otherwise lines use the best
 * active warehouse so the cart still makes sense before a location is chosen.
 */
export async function evaluateCart(cartId: string, loc: CartLocation = {}, db: Db = prisma): Promise<CartEvaluation> {
  const settings = await getStoreSettings();
  const rows = await db.cartItem.findMany({ where: { cartId }, orderBy: { createdAt: 'asc' }, select: lineSelect });
  const pincode = validPin(loc);
  const wanted = rows.map((r) => ({ productId: r.product.id, variantId: r.variant?.id ?? null, quantity: r.quantity }));
  if (pincode && rows.length) {
    const sel = await selectWarehouseFor(pincode, wanted, db);
    if (sel.candidates.length) {
      const lines = rows.map((r) => evaluateLine(r, settings.maxQtyPerLine, sel.stock.get(lineKey(r.product.id, r.variant?.id ?? null)) ?? null, true));
      return { lines, pincode, covered: true, warehouse: sel.warehouse };
    }
  }
  const stock = await stockRows(wanted.map((w) => w.productId), 'active', db);
  const lines = rows.map((r) => evaluateLine(r, settings.maxQtyPerLine, bestLineStock(stock, r.product.id, r.variant?.id ?? null)));
  return { lines, pincode, covered: false, warehouse: null };
}

export async function loadCartLines(cartId: string, db: Db = prisma, loc: CartLocation = {}) {
  return (await evaluateCart(cartId, loc, db)).lines;
}

export function summarise(cartId: string | null, lines: CartLine[], maxQtyPerLine: number, coupon: AppliedCoupon | null = null): CartView {
  const okLines = lines.filter((l) => l.state === 'ok');
  return {
    id: cartId,
    lines,
    totalQuantity: lines.reduce((a, l) => a + l.quantity, 0),
    subtotalPaise: okLines.reduce((a, l) => a + l.lineTotalPaise, 0),
    discountPaise: coupon?.valid ? coupon.discountPaise : 0,
    coupon,
    hasIssues: lines.some((l) => l.state !== 'ok'),
    maxQtyPerLine,
  };
}

/* ─────────────────────────────── Cart lookup ─────────────────────────────── */

async function findCartId(owner: CartOwner, db: Db = prisma): Promise<string | null> {
  if (owner.userId) {
    const c = await db.cart.findFirst({ where: { userId: owner.userId, status: 'ACTIVE' }, select: { id: true } });
    return c?.id ?? null;
  }
  if (!owner.guestToken) return null;
  const c = await db.cart.findFirst({ where: { sessionId: sha256(owner.guestToken), userId: null, status: 'ACTIVE' }, select: { id: true } });
  return c?.id ?? null;
}

/** Find or create the owner's active cart. For new guests a fresh token is returned (to be set as cookie). */
async function ensureCart(owner: CartOwner | null): Promise<{ cartId: string; newGuestToken: string | null }> {
  if (owner) {
    const existing = await findCartId(owner);
    if (existing) return { cartId: existing, newGuestToken: null };
  }
  if (owner?.userId) {
    try {
      const c = await prisma.cart.create({ data: { userId: owner.userId }, select: { id: true } });
      return { cartId: c.id, newGuestToken: null };
    } catch (e) {
      // Concurrent create hit the "one active cart per user" index: use the winner.
      const again = await findCartId(owner);
      if (again) return { cartId: again, newGuestToken: null };
      throw e;
    }
  }
  const token = randomToken();
  const c = await prisma.cart.create({ data: { sessionId: sha256(token) }, select: { id: true } });
  return { cartId: c.id, newGuestToken: token };
}

export async function getCart(owner: CartOwner | null, loc: CartLocation = {}): Promise<CartView> {
  const settings = await getStoreSettings();
  const cartId = owner ? await findCartId(owner) : null;
  if (!cartId) return summarise(null, [], settings.maxQtyPerLine);
  return summariseCart(cartId, loc);
}

/* ─────────────────────────────── Mutations ─────────────────────────────── */

async function loadPurchasable(productId: string, variantId: string | null, loc: CartLocation = {}) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      status: true,
      sellingPricePaise: true,
      category: { select: { status: true } },
      brand: { select: { status: true } },
      variants: { where: { status: 'ACTIVE' }, select: { id: true, sellingPricePaise: true } },
    },
  });
  if (!product || product.status !== 'ACTIVE' || product.category.status !== 'ACTIVE' || (product.brand && product.brand.status !== 'ACTIVE')) {
    throw notFound('Product');
  }
  let price = product.sellingPricePaise;
  if (product.variants.length) {
    if (!variantId) throw badRequest('Please choose an option for this product');
    const v = product.variants.find((x) => x.id === variantId);
    if (!v) throw notFound('Product option');
    price = v.sellingPricePaise;
  } else if (variantId) {
    throw notFound('Product option');
  }
  // At a covered delivery location only that location's warehouses count; otherwise any active warehouse.
  const pin = validPin(loc);
  const candidates = pin ? (await warehouseCandidates(pin)).filter((c) => !c.atCapacity) : [];
  const rows = await stockRows([productId], candidates.length ? candidates.map((c) => c.id) : 'active');
  const sellable = bestLineStock(rows, productId, variantId)?.sellable ?? 0;
  return { name: product.name, price, sellable, atLocation: candidates.length > 0 };
}

function assertQuantity(qty: number, sellable: number, maxPerLine: number, name: string, atLocation = false) {
  if (sellable <= 0) {
    throw new AppError(409, 'OUT_OF_STOCK', atLocation ? `${name} is not available for delivery to your location` : `${name} is out of stock`);
  }
  if (qty > maxPerLine) throw new AppError(409, 'QTY_LIMIT', `You can buy up to ${maxPerLine} of this item`);
  if (qty > sellable) throw new AppError(409, 'INSUFFICIENT_STOCK', `Only ${Math.min(sellable, maxPerLine)} of ${name} available${atLocation ? ' for your location' : ''}`);
}

export async function addItem(owner: CartOwner | null, raw: unknown, loc: CartLocation = {}) {
  const input = addItemInput.parse(raw);
  const settings = await getStoreSettings();
  const item = await loadPurchasable(input.productId, input.variantId, loc);
  const { cartId, newGuestToken } = await ensureCart(owner);
  const where = { cartId, productId: input.productId, variantId: input.variantId };
  const existing = await prisma.cartItem.findFirst({ where, select: { id: true, quantity: true } });
  const newQty = (existing?.quantity ?? 0) + input.quantity;
  assertQuantity(newQty, item.sellable, settings.maxQtyPerLine, item.name, item.atLocation);
  if (existing) {
    await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: newQty, addedPricePaise: item.price } });
  } else {
    try {
      await prisma.cartItem.create({ data: { ...where, quantity: newQty, addedPricePaise: item.price } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw conflict('This item was just added. Please refresh your cart.');
      }
      throw e;
    }
  }
  await prisma.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });
  return { cart: await summariseCart(cartId, loc), newGuestToken };
}

/** Re-priced cart view including the (re-validated) coupon for signed-in owners. */
export async function summariseCart(cartId: string, loc: CartLocation = {}) {
  return summariseLines(cartId, await loadCartLines(cartId, prisma, loc));
}

/** Cart view for already-evaluated lines (coupon re-validated). */
export async function summariseLines(cartId: string, lines: CartLine[]) {
  const settings = await getStoreSettings();
  const cart = await prisma.cart.findUnique({ where: { id: cartId }, select: { userId: true, couponCode: true } });
  const coupon = await evaluateCartCoupon(cart?.couponCode ?? null, cart?.userId ?? null, lines);
  return summarise(cartId, lines, settings.maxQtyPerLine, coupon);
}

/** Resolve a line id strictly within the owner's cart (prevents IDOR). */
async function ownLine(owner: CartOwner | null, itemId: string) {
  z.string().uuid().parse(itemId);
  const cartId = owner ? await findCartId(owner) : null;
  if (!cartId) throw notFound('Cart item');
  const line = await prisma.cartItem.findFirst({
    where: { id: itemId, cartId },
    select: { id: true, productId: true, variantId: true, quantity: true },
  });
  if (!line) throw notFound('Cart item');
  return { cartId, line };
}

export async function setQuantity(owner: CartOwner | null, itemId: string, raw: unknown, loc: CartLocation = {}) {
  const { quantity } = setQuantityInput.parse(raw);
  const { cartId, line } = await ownLine(owner, itemId);
  if (quantity === 0) {
    await prisma.cartItem.delete({ where: { id: line.id } });
  } else {
    const settings = await getStoreSettings();
    // Decreasing is always allowed (helps fix "insufficient" lines); increasing re-checks stock.
    if (quantity > line.quantity) {
      const item = await loadPurchasable(line.productId, line.variantId, loc);
      assertQuantity(quantity, item.sellable, settings.maxQtyPerLine, item.name, item.atLocation);
    }
    await prisma.cartItem.update({ where: { id: line.id }, data: { quantity } });
  }
  return summariseCart(cartId, loc);
}

export async function removeItem(owner: CartOwner | null, itemId: string, loc: CartLocation = {}) {
  const { cartId, line } = await ownLine(owner, itemId);
  await prisma.cartItem.delete({ where: { id: line.id } });
  return summariseCart(cartId, loc);
}

export async function clearCart(owner: CartOwner | null, loc: CartLocation = {}) {
  const cartId = owner ? await findCartId(owner) : null;
  if (cartId) await prisma.cartItem.deleteMany({ where: { cartId } });
  return getCart(owner, loc);
}

/**
 * Merge a guest cart into the customer's cart after sign-in.
 * Same product/variant lines are combined, capped by current stock and the per-line limit.
 * Unavailable lines are dropped. The customer's existing cart is never overwritten.
 */
export async function mergeGuestCart(guestToken: string | null | undefined, userId: string) {
  if (!guestToken) return { merged: 0, dropped: 0 };
  const guestCartId = await findCartId({ guestToken });
  if (!guestCartId) return { merged: 0, dropped: 0 };
  const settings = await getStoreSettings();
  const guestLines = await loadCartLines(guestCartId);
  const { cartId } = await ensureCart({ userId });
  let merged = 0;
  let dropped = 0;
  await prisma.$transaction(async (tx) => {
    for (const g of guestLines) {
      if (g.state === 'unavailable' || g.state === 'out_of_stock') {
        dropped++;
        continue;
      }
      const sellable = g.maxQty; // already min(stock, cap)
      const existing = await tx.cartItem.findFirst({ where: { cartId, productId: g.productId, variantId: g.variantId }, select: { id: true, quantity: true } });
      const qty = Math.min((existing?.quantity ?? 0) + g.quantity, sellable, settings.maxQtyPerLine);
      if (qty <= 0) {
        dropped++;
        continue;
      }
      if (existing) await tx.cartItem.update({ where: { id: existing.id }, data: { quantity: qty } });
      else await tx.cartItem.create({ data: { cartId, productId: g.productId, variantId: g.variantId, quantity: qty, addedPricePaise: g.unitPricePaise } });
      merged++;
    }
    await tx.cart.delete({ where: { id: guestCartId } });
  });
  return { merged, dropped };
}

export { findCartId };
