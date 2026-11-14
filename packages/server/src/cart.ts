import { prisma, Prisma } from '@20mart/database';
import { formatPaise } from '@20mart/shared';
import { z } from 'zod';
import { randomToken, sha256 } from './crypto';
import { AppError, badRequest, conflict, notFound } from './errors';
import { getStoreSettings } from './settings';

type Db = Prisma.TransactionClient | typeof prisma;

export type CartOwner = { userId: string; guestToken?: never } | { guestToken: string; userId?: never };

export type CartLineState = 'ok' | 'insufficient' | 'out_of_stock' | 'unavailable';

export interface CartLine {
  id: string;
  productId: string;
  variantId: string | null;
  inventoryId: string | null;
  slug: string;
  name: string;
  sku: string;
  variantName: string | null;
  brandName: string | null;
  imageUrl: string | null;
  unitPricePaise: number;
  mrpPaise: number;
  addedPricePaise: number;
  quantity: number;
  lineTotalPaise: number;
  /** Max quantity the customer may set right now (stock and per-line cap). Never the raw stock figure above the cap. */
  maxQty: number;
  state: CartLineState;
  priceChanged: boolean;
  message: string | null;
}

export interface CartView {
  id: string | null;
  lines: CartLine[];
  totalQuantity: number;
  /** Subtotal of lines that can be purchased as-is (state 'ok'). Integer paise, computed on the server. */
  subtotalPaise: number;
  hasIssues: boolean;
  maxQtyPerLine: number;
}

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
      sellingPricePaise: true,
      mrpPaise: true,
      category: { select: { status: true } },
      brand: { select: { status: true, name: true } },
      images: { where: { isPrimary: true }, take: 1, select: { url: true } },
      inventories: { where: { variantId: null }, select: { id: true, availableQuantity: true, reservedQuantity: true } },
      _count: { select: { variants: { where: { status: 'ACTIVE' } } } },
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
      inventories: { select: { id: true, availableQuantity: true, reservedQuantity: true } },
    },
  },
} satisfies Prisma.CartItemSelect;

type LineRow = Prisma.CartItemGetPayload<{ select: typeof lineSelect }>;

/** Evaluate a cart line against live catalog, price and stock. */
export function evaluateLine(row: LineRow, maxPerLine: number): CartLine {
  const p = row.product;
  const v = row.variant;
  const inv = v ? v.inventories[0] : p.inventories[0];
  const sellable = inv ? Math.max(0, inv.availableQuantity - inv.reservedQuantity) : 0;
  const unit = v ? v.sellingPricePaise : p.sellingPricePaise;
  const mrp = v ? v.mrpPaise : p.mrpPaise;
  const visible =
    p.status === 'ACTIVE' &&
    p.category.status === 'ACTIVE' &&
    (!p.brand || p.brand.status === 'ACTIVE') &&
    (!v || v.status === 'ACTIVE') &&
    !(p._count.variants > 0 && !v); // product now has options → this line must be re-chosen
  const maxQty = Math.min(sellable, maxPerLine);
  let state: CartLineState = 'ok';
  let message: string | null = null;
  if (!visible) {
    state = 'unavailable';
    message = 'This item is no longer available';
  } else if (sellable <= 0) {
    state = 'out_of_stock';
    message = 'Out of stock';
  } else if (row.quantity > sellable) {
    state = 'insufficient';
    message = `Only ${maxQty} available — reduce the quantity`;
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
    variantId: v?.id ?? null,
    inventoryId: inv?.id ?? null,
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

export async function loadCartLines(cartId: string, db: Db = prisma) {
  const settings = await getStoreSettings();
  const rows = await db.cartItem.findMany({ where: { cartId }, orderBy: { createdAt: 'asc' }, select: lineSelect });
  return rows.map((r) => evaluateLine(r, settings.maxQtyPerLine));
}

export function summarise(cartId: string | null, lines: CartLine[], maxQtyPerLine: number): CartView {
  const okLines = lines.filter((l) => l.state === 'ok');
  return {
    id: cartId,
    lines,
    totalQuantity: lines.reduce((a, l) => a + l.quantity, 0),
    subtotalPaise: okLines.reduce((a, l) => a + l.lineTotalPaise, 0),
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

export async function getCart(owner: CartOwner | null): Promise<CartView> {
  const settings = await getStoreSettings();
  const cartId = owner ? await findCartId(owner) : null;
  if (!cartId) return summarise(null, [], settings.maxQtyPerLine);
  return summarise(cartId, await loadCartLines(cartId), settings.maxQtyPerLine);
}

/* ─────────────────────────────── Mutations ─────────────────────────────── */

async function loadPurchasable(productId: string, variantId: string | null) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      status: true,
      sellingPricePaise: true,
      category: { select: { status: true } },
      brand: { select: { status: true } },
      inventories: { where: { variantId: null }, select: { availableQuantity: true, reservedQuantity: true } },
      variants: {
        where: { status: 'ACTIVE' },
        select: { id: true, sellingPricePaise: true, inventories: { select: { availableQuantity: true, reservedQuantity: true } } },
      },
    },
  });
  if (!product || product.status !== 'ACTIVE' || product.category.status !== 'ACTIVE' || (product.brand && product.brand.status !== 'ACTIVE')) {
    throw notFound('Product');
  }
  let inv = product.inventories[0];
  let price = product.sellingPricePaise;
  if (product.variants.length) {
    if (!variantId) throw badRequest('Please choose an option for this product');
    const v = product.variants.find((x) => x.id === variantId);
    if (!v) throw notFound('Product option');
    inv = v.inventories[0];
    price = v.sellingPricePaise;
  } else if (variantId) {
    throw notFound('Product option');
  }
  const sellable = inv ? Math.max(0, inv.availableQuantity - inv.reservedQuantity) : 0;
  return { name: product.name, price, sellable };
}

function assertQuantity(qty: number, sellable: number, maxPerLine: number, name: string) {
  if (sellable <= 0) throw new AppError(409, 'OUT_OF_STOCK', `${name} is out of stock`);
  if (qty > maxPerLine) throw new AppError(409, 'QTY_LIMIT', `You can buy up to ${maxPerLine} of this item`);
  if (qty > sellable) throw new AppError(409, 'INSUFFICIENT_STOCK', `Only ${Math.min(sellable, maxPerLine)} of ${name} available`);
}

export async function addItem(owner: CartOwner | null, raw: unknown) {
  const input = addItemInput.parse(raw);
  const settings = await getStoreSettings();
  const item = await loadPurchasable(input.productId, input.variantId);
  const { cartId, newGuestToken } = await ensureCart(owner);
  const where = { cartId, productId: input.productId, variantId: input.variantId };
  const existing = await prisma.cartItem.findFirst({ where, select: { id: true, quantity: true } });
  const newQty = (existing?.quantity ?? 0) + input.quantity;
  assertQuantity(newQty, item.sellable, settings.maxQtyPerLine, item.name);
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
  return { cart: await summariseCart(cartId), newGuestToken };
}

async function summariseCart(cartId: string) {
  const settings = await getStoreSettings();
  return summarise(cartId, await loadCartLines(cartId), settings.maxQtyPerLine);
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

export async function setQuantity(owner: CartOwner | null, itemId: string, raw: unknown) {
  const { quantity } = setQuantityInput.parse(raw);
  const { cartId, line } = await ownLine(owner, itemId);
  if (quantity === 0) {
    await prisma.cartItem.delete({ where: { id: line.id } });
  } else {
    const settings = await getStoreSettings();
    // Decreasing is always allowed (helps fix "insufficient" lines); increasing re-checks stock.
    if (quantity > line.quantity) {
      const item = await loadPurchasable(line.productId, line.variantId);
      assertQuantity(quantity, item.sellable, settings.maxQtyPerLine, item.name);
    }
    await prisma.cartItem.update({ where: { id: line.id }, data: { quantity } });
  }
  return summariseCart(cartId);
}

export async function removeItem(owner: CartOwner | null, itemId: string) {
  const { cartId, line } = await ownLine(owner, itemId);
  await prisma.cartItem.delete({ where: { id: line.id } });
  return summariseCart(cartId);
}

export async function clearCart(owner: CartOwner | null) {
  const cartId = owner ? await findCartId(owner) : null;
  if (cartId) await prisma.cartItem.deleteMany({ where: { cartId } });
  return getCart(owner);
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
