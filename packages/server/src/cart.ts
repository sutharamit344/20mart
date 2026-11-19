import { prisma, Prisma } from '@20mart/database';
import { formatPaise, type AppliedCoupon, type CartLine, type CartLineState, type CartView } from '@20mart/shared';
import { z } from 'zod';
import { randomToken, sha256 } from './crypto';
import { AppError, badRequest, conflict, notFound } from './errors';
import { evaluateCartCoupon } from './coupon-engine';
import { getStoreSettings, PINCODE_REGEX } from './settings';
import { bestLineStock, lineKey, selectWarehouseFor, stockRows, warehouseCandidates, type StockRow, type WarehouseCandidate } from './fulfillment';
import { consentedVisitorId, istDay, trackServerEvents, type AnalyticsCaller, type ServerEventInput } from './tracking/events';

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
      categoryId: true,
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
  return { name: product.name, categoryId: product.categoryId, price, sellable, atLocation: candidates.length > 0 };
}

/* ─────────────────────────────── Analytics ─────────────────────────────── */
// Operational cart events are written after the response (see tracking/schedule) and never
// affect the cart operation itself. Prices and categories always come from the database.

type Purchasable = Awaited<ReturnType<typeof loadPurchasable>>;
const STOCK_ERRORS = new Set(['OUT_OF_STOCK', 'INSUFFICIENT_STOCK']);

/**
 * Check a requested quantity; a refusal caused by stock is recorded as unfulfilled demand
 * (OUT_OF_STOCK_ADD_ATTEMPT) with the units that could not be supplied. One shopper's repeated
 * attempts for the same item on the same IST day count once (retries and repeated taps never inflate
 * demand). The shopper is identified, for deduplication only, by the first of:
 *   cart      - the existing cart (signed-in customers always have one here; guests with a cart cookie)
 *   visitor   - the analytics visitor id, only when the guest granted consent
 *   anonymous - no cart and no consent: one count per item, PIN code and day for ALL such guests.
 * The anonymous bucket deliberately under-counts rather than identify a visitor who did not consent
 * (no IP, fingerprint or new cookie is used). The scope is stored in metadata.dedupeScope.
 * Refusals for the per-line limit are not demand signals and are not recorded.
 */
function assertQuantityTracked(
  analytics: AnalyticsCaller,
  t: { cartId: string | null; productId: string; variantId: string | null; previousQty: number; desiredQty: number; source: string; pincode: string | null },
  item: Purchasable,
  maxPerLine: number
) {
  try {
    assertQuantity(t.desiredQty, item.sellable, maxPerLine, item.name, item.atLocation);
  } catch (e) {
    if (e instanceof AppError && STOCK_ERRORS.has(e.code)) {
      const increase = t.desiredQty - t.previousQty;
      const shortfall = Math.max(1, Math.min(increase, t.desiredQty - Math.max(item.sellable, 0)));
      const itemKey = `${t.productId}:${t.variantId ?? '-'}:${istDay()}`;
      trackServerEvents(analytics, (ctx) => {
        const visitorId = t.cartId ? null : consentedVisitorId(ctx);
        const [dedupeScope, owner] = t.cartId ? ['cart', `c:${t.cartId}`] : visitorId ? ['visitor', `v:${visitorId}`] : ['anonymous', `a:${t.pincode ?? '-'}`];
        return [
          {
            name: 'OUT_OF_STOCK_ADD_ATTEMPT',
            productId: t.productId,
            variantId: t.variantId ?? undefined,
            categoryId: item.categoryId,
            cartId: t.cartId ?? undefined,
            pincode: t.pincode ?? undefined,
            quantity: shortfall,
            unitPricePaise: item.price,
            metadata: {
              reason: e.code === 'OUT_OF_STOCK' ? 'out_of_stock' : 'insufficient_stock',
              atLocation: item.atLocation,
              source: t.source,
              sellable: Math.max(item.sellable, 0),
              dedupeScope,
            },
            dedupeKey: `${owner}:${itemKey}`,
          },
        ];
      });
    }
    throw e;
  }
}

/** CART_ITEM_REMOVED events for lines that left the cart; price/category are looked up when written. */
function trackRemoved(analytics: AnalyticsCaller, cartId: string, removed: { productId: string; variantId: string | null; quantity: number }[], reason: string, pincode: string | null) {
  if (!removed.length) return;
  trackServerEvents(analytics, async () => {
    const products = await prisma.product.findMany({
      where: { id: { in: [...new Set(removed.map((r) => r.productId))] } },
      select: { id: true, categoryId: true, sellingPricePaise: true, variants: { select: { id: true, sellingPricePaise: true } } },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    return removed.map((r): ServerEventInput => {
      const p = byId.get(r.productId);
      const price = r.variantId ? p?.variants.find((v) => v.id === r.variantId)?.sellingPricePaise : p?.sellingPricePaise;
      return {
        name: 'CART_ITEM_REMOVED',
        productId: r.productId,
        variantId: r.variantId ?? undefined,
        categoryId: p?.categoryId,
        cartId,
        pincode: pincode ?? undefined,
        quantity: r.quantity,
        unitPricePaise: price,
        metadata: { reason },
      };
    });
  });
}

/**
 * Set a line's quantity and return the quantity it actually replaced. Compare-and-set, so when two
 * requests change the same line at once each sees its own predecessor and the recorded add/remove
 * deltas always sum to the real change (no double counting). The final quantity is still the last
 * request's, as before.
 */
async function swapLineQuantity(lineId: string, expected: number, quantity: number) {
  let previous = expected;
  for (let i = 0; i < 5; i++) {
    const { count } = await prisma.cartItem.updateMany({ where: { id: lineId, quantity: previous }, data: { quantity } });
    if (count) return previous;
    const current = await prisma.cartItem.findUnique({ where: { id: lineId }, select: { quantity: true } });
    if (!current) throw notFound('Cart item');
    previous = current.quantity;
  }
  throw conflict('Your cart was just changed. Please try again.');
}

/** Keep the cart's last-activity time (used for abandonment) current when lines change or leave. */
const touchCart = (cartId: string) => prisma.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });

function assertQuantity(qty: number, sellable: number, maxPerLine: number, name: string, atLocation = false) {
  if (sellable <= 0) {
    throw new AppError(409, 'OUT_OF_STOCK', atLocation ? `${name} is not available for delivery to your location` : `${name} is out of stock`);
  }
  if (qty > maxPerLine) throw new AppError(409, 'QTY_LIMIT', `You can buy up to ${maxPerLine} of this item`);
  if (qty > sellable) throw new AppError(409, 'INSUFFICIENT_STOCK', `Only ${Math.min(sellable, maxPerLine)} of ${name} available${atLocation ? ' for your location' : ''}`);
}

export async function addItem(owner: CartOwner | null, raw: unknown, loc: CartLocation = {}, analytics: AnalyticsCaller = null, source: 'cart' | 'wishlist' = 'cart') {
  const input = addItemInput.parse(raw);
  const settings = await getStoreSettings();
  const item = await loadPurchasable(input.productId, input.variantId, loc);
  // Signed-in customers get their (single) cart up front. A guest's cart is created only once the
  // add is accepted: a refused add must not leave an orphan empty cart behind (its new cookie never
  // reached the browser on the error response, so every retry used to create another cart).
  const known = owner?.userId ? await ensureCart(owner) : { cartId: owner ? await findCartId(owner) : null, newGuestToken: null };
  const existing = known.cartId
    ? await prisma.cartItem.findFirst({ where: { cartId: known.cartId, productId: input.productId, variantId: input.variantId }, select: { id: true, quantity: true } })
    : null;
  const newQty = (existing?.quantity ?? 0) + input.quantity;
  const pincode = validPin(loc);
  assertQuantityTracked(
    analytics,
    { cartId: known.cartId, productId: input.productId, variantId: input.variantId, previousQty: existing?.quantity ?? 0, desiredQty: newQty, source, pincode },
    item,
    settings.maxQtyPerLine
  );
  const { cartId, newGuestToken } = known.cartId ? { cartId: known.cartId, newGuestToken: known.newGuestToken } : await ensureCart(owner);
  const where = { cartId, productId: input.productId, variantId: input.variantId };
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
  trackServerEvents(analytics, () => [
    {
      name: 'CART_ITEM_ADDED',
      productId: input.productId,
      variantId: input.variantId ?? undefined,
      categoryId: item.categoryId,
      cartId,
      pincode: pincode ?? undefined,
      quantity: input.quantity,
      unitPricePaise: item.price,
      metadata: { source },
    },
  ]);
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

export async function setQuantity(owner: CartOwner | null, itemId: string, raw: unknown, loc: CartLocation = {}, analytics: AnalyticsCaller = null) {
  const { quantity } = setQuantityInput.parse(raw);
  const { cartId, line } = await ownLine(owner, itemId);
  const pincode = validPin(loc);
  if (quantity === 0) {
    await prisma.cartItem.delete({ where: { id: line.id } });
    await touchCart(cartId);
    trackRemoved(analytics, cartId, [line], 'removed', pincode);
  } else {
    const settings = await getStoreSettings();
    // Decreasing is always allowed (helps fix "insufficient" lines); increasing re-checks stock.
    let added: Purchasable | null = null;
    if (quantity > line.quantity) {
      added = await loadPurchasable(line.productId, line.variantId, loc);
      assertQuantityTracked(
        analytics,
        { cartId, productId: line.productId, variantId: line.variantId, previousQty: line.quantity, desiredQty: quantity, source: 'quantity_update', pincode },
        added,
        settings.maxQtyPerLine
      );
    }
    const previous = await swapLineQuantity(line.id, line.quantity, quantity);
    if (quantity !== previous) await touchCart(cartId);
    if (quantity > previous) {
      const checked = added;
      trackServerEvents(analytics, async () => {
        // Price/category come from the stock check; in the rare race where the change only became an
        // increase concurrently, they are looked up after the response instead.
        const item = checked ?? (await loadPurchasable(line.productId, line.variantId, loc).catch(() => null));
        return [
          {
            name: 'CART_ITEM_ADDED',
            productId: line.productId,
            variantId: line.variantId ?? undefined,
            categoryId: item?.categoryId,
            cartId,
            pincode: pincode ?? undefined,
            quantity: quantity - previous,
            unitPricePaise: item?.price,
            metadata: { source: 'quantity_update' },
          },
        ];
      });
    } else if (quantity < previous) {
      trackRemoved(analytics, cartId, [{ ...line, quantity: previous - quantity }], 'quantity_decrease', pincode);
    }
  }
  return summariseCart(cartId, loc);
}

export async function removeItem(owner: CartOwner | null, itemId: string, loc: CartLocation = {}, analytics: AnalyticsCaller = null) {
  const { cartId, line } = await ownLine(owner, itemId);
  await prisma.cartItem.delete({ where: { id: line.id } });
  await touchCart(cartId);
  trackRemoved(analytics, cartId, [line], 'removed', validPin(loc));
  return summariseCart(cartId, loc);
}

export async function clearCart(owner: CartOwner | null, loc: CartLocation = {}, analytics: AnalyticsCaller = null) {
  const cartId = owner ? await findCartId(owner) : null;
  if (cartId) {
    const lines = await prisma.cartItem.findMany({ where: { cartId }, select: { id: true, productId: true, variantId: true, quantity: true } });
    // Record exactly the lines this call deleted (a concurrent removal is not counted twice).
    const { count } = await prisma.cartItem.deleteMany({ where: { cartId, id: { in: lines.map((l) => l.id) } } });
    if (count) {
      await touchCart(cartId);
      if (count === lines.length) trackRemoved(analytics, cartId, lines, 'cleared', validPin(loc));
    }
    await prisma.cartItem.deleteMany({ where: { cartId } }); // anything added concurrently is cleared too, as before
  }
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
