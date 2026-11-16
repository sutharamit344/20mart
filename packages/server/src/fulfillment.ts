import { prisma, Prisma } from '@20mart/database';
import { stockStateOf, type StockState } from '@20mart/shared';

/**
 * Location-based fulfilment: which warehouses may serve a PIN code, how much each can sell,
 * and which single warehouse fulfils an order. Every storefront surface (product page,
 * cart, checkout, order placement) goes through these functions so availability is
 * computed one way only.
 *
 * Coverage chain: ServiceablePincode (isServiceable) → DeliveryZone (isActive)
 *   → WarehouseDeliveryZone (isActive, priority) → Warehouse (status ACTIVE).
 * A PIN code that is serviceable but has no active mapped warehouse is NOT deliverable.
 */

type Db = Prisma.TransactionClient | typeof prisma;

export interface WarehouseCandidate {
  id: string;
  name: string;
  code: string;
  priority: number;
  /** Mapping overrides (null = fall back to PIN/zone/store values). */
  feePaise: number | null;
  estimateHours: number | null;
  cutoffTime: string | null;
  zoneId: string;
  atCapacity: boolean;
}

const TZ_OFFSET_MIN = 330; // IST, no DST
/** Start of the current IST calendar day as a UTC instant. */
export function istDayStart(now = new Date()) {
  const ist = new Date(now.getTime() + TZ_OFFSET_MIN * 60_000);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - TZ_OFFSET_MIN * 60_000);
}

/** Active warehouses mapped to the PIN code's active delivery area, best priority first. */
export async function warehouseCandidates(pincode: string, db: Db = prisma): Promise<WarehouseCandidate[]> {
  const rows = await db.$queryRaw<
    { id: string; name: string; code: string; priority: number; fee: number | null; hours: number | null; cutoff: string | null; zoneId: string; cap: number | null }[]
  >`
    SELECT w."id", w."name", w."code", m."priority", m."deliveryFeePaise" AS fee, m."estimateHours" AS hours,
           m."cutoffTime" AS cutoff, z."id" AS "zoneId", w."dailyOrderCapacity" AS cap
      FROM "ServiceablePincode" sp
      JOIN "DeliveryZone" z ON z."id" = sp."zoneId" AND z."isActive"
      JOIN "WarehouseDeliveryZone" m ON m."zoneId" = z."id" AND m."isActive"
      JOIN "Warehouse" w ON w."id" = m."warehouseId" AND w."status" = 'ACTIVE'
     WHERE sp."pincode" = ${pincode} AND sp."isServiceable"
     ORDER BY m."priority" ASC, w."code" ASC`;
  if (!rows.length) return [];
  const capped = rows.filter((r) => r.cap != null).map((r) => r.id);
  const load = new Map<string, number>();
  if (capped.length) {
    const counts = await db.order.groupBy({
      by: ['fulfillmentWarehouseId'],
      where: { fulfillmentWarehouseId: { in: capped }, createdAt: { gte: istDayStart() }, status: { notIn: ['CANCELLED', 'FAILED'] } },
      _count: { _all: true },
    });
    for (const c of counts) if (c.fulfillmentWarehouseId) load.set(c.fulfillmentWarehouseId, c._count._all);
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    code: r.code,
    priority: r.priority,
    feePaise: r.fee,
    estimateHours: r.hours,
    cutoffTime: r.cutoff,
    zoneId: r.zoneId,
    atCapacity: r.cap != null && (load.get(r.id) ?? 0) >= r.cap,
  }));
}

export interface StockRow {
  inventoryId: string;
  warehouseId: string;
  productId: string;
  variantId: string | null;
  /** onHand − reserved − safetyStock, floored at 0. */
  sellable: number;
  lowStockThreshold: number;
}

export const lineKey = (productId: string, variantId: string | null) => `${productId}:${variantId ?? ''}`;

/**
 * Stock rows for products at the given warehouses, or at every ACTIVE warehouse when
 * `warehouseIds` is 'active'. Inactive variants are excluded.
 */
export async function stockRows(productIds: string[], warehouseIds: string[] | 'active', db: Db = prisma): Promise<StockRow[]> {
  if (!productIds.length || (Array.isArray(warehouseIds) && !warehouseIds.length)) return [];
  const rows = await db.inventory.findMany({
    where: {
      productId: { in: [...new Set(productIds)] },
      ...(warehouseIds === 'active' ? { warehouse: { status: 'ACTIVE' } } : { warehouseId: { in: warehouseIds } }),
      OR: [{ variantId: null }, { variant: { status: 'ACTIVE' } }],
    },
    select: { id: true, warehouseId: true, productId: true, variantId: true, availableQuantity: true, reservedQuantity: true, safetyStock: true, lowStockThreshold: true },
  });
  return rows.map((r) => ({
    inventoryId: r.id,
    warehouseId: r.warehouseId,
    productId: r.productId,
    variantId: r.variantId,
    sellable: Math.max(0, r.availableQuantity - r.reservedQuantity - r.safetyStock),
    lowStockThreshold: r.lowStockThreshold,
  }));
}

/**
 * Product-level stock state. Each order ships from one warehouse, so the product is as
 * available as its BEST single warehouse (not the sum across warehouses).
 * Products with variants count their variant rows; others their product row.
 */
export function productStockState(rows: StockRow[], hasVariants: boolean): { sellable: number; state: StockState } {
  const relevant = rows.filter((r) => (hasVariants ? r.variantId : !r.variantId));
  const byWh = new Map<string, { sellable: number; threshold: number }>();
  for (const r of relevant) {
    const g = byWh.get(r.warehouseId) ?? { sellable: 0, threshold: 0 };
    g.sellable += r.sellable;
    g.threshold = Math.max(g.threshold, r.lowStockThreshold);
    byWh.set(r.warehouseId, g);
  }
  let best = { sellable: 0, threshold: 0 };
  for (const g of byWh.values()) if (g.sellable > best.sellable) best = g;
  return { sellable: best.sellable, state: stockStateOf(best.sellable, best.threshold) as StockState };
}

/** Best single-warehouse sellable quantity for one product/variant line. */
export function bestLineStock(rows: StockRow[], productId: string, variantId: string | null) {
  let best: StockRow | null = null;
  for (const r of rows) {
    if (r.productId !== productId || r.variantId !== variantId) continue;
    if (!best || r.sellable > best.sellable) best = r;
  }
  return best;
}

export interface SelectionLine {
  productId: string;
  variantId: string | null;
  quantity: number;
}

export interface WarehouseSelection {
  /** Warehouse that can ship EVERY line, or null. */
  warehouse: WarehouseCandidate | null;
  /** Warehouse used to explain shortages when none can ship everything (most lines fulfilled). */
  reference: WarehouseCandidate | null;
  /** Stock row per line at the chosen (or reference) warehouse. */
  stock: Map<string, StockRow | null>;
}

/**
 * One warehouse per order: the highest-priority eligible warehouse (not at its daily
 * capacity) holding enough sellable stock for every line. Orders are never split.
 */
export function chooseWarehouse(candidates: WarehouseCandidate[], lines: SelectionLine[], rows: StockRow[]): WarehouseSelection {
  const at = (whId: string) => {
    const m = new Map<string, StockRow | null>();
    for (const l of lines) {
      m.set(lineKey(l.productId, l.variantId), rows.find((r) => r.warehouseId === whId && r.productId === l.productId && r.variantId === l.variantId) ?? null);
    }
    return m;
  };
  let reference: { c: WarehouseCandidate; ok: number; stock: Map<string, StockRow | null> } | null = null;
  for (const c of candidates) {
    if (c.atCapacity) continue;
    const stock = at(c.id);
    const ok = lines.filter((l) => (stock.get(lineKey(l.productId, l.variantId))?.sellable ?? 0) >= l.quantity).length;
    if (ok === lines.length) return { warehouse: c, reference: c, stock };
    if (!reference || ok > reference.ok) reference = { c, ok, stock };
  }
  return { warehouse: null, reference: reference?.c ?? null, stock: reference?.stock ?? new Map() };
}

/** Candidates + stock + choice in one call (outside the order transaction). */
export async function selectWarehouseFor(pincode: string, lines: SelectionLine[], db: Db = prisma) {
  const candidates = await warehouseCandidates(pincode, db);
  const rows = await stockRows(lines.map((l) => l.productId), candidates.map((c) => c.id), db);
  return { candidates, ...chooseWarehouse(candidates, lines, rows) };
}

/* ───────────────────────── Storefront availability ───────────────────────── */

export interface LocationAvailability {
  pincode: string;
  /** false when the PIN has no active warehouse coverage. */
  covered: boolean;
  products: Record<string, { state: StockState; deliverable: boolean; variants: Record<string, StockState> }>;
}

/** Per-product availability for a delivery PIN code (product pages, cards, cart hints). */
export async function availabilityForPincode(pincode: string, productIds: string[]): Promise<LocationAvailability> {
  const ids = [...new Set(productIds)].filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 60);
  const candidates = (await warehouseCandidates(pincode)).filter((c) => !c.atCapacity);
  const products: LocationAvailability['products'] = {};
  if (!ids.length) return { pincode, covered: candidates.length > 0, products };
  const [rows, variantCounts] = await Promise.all([
    stockRows(ids, candidates.map((c) => c.id)),
    prisma.productVariant.groupBy({ by: ['productId'], where: { productId: { in: ids }, status: 'ACTIVE' }, _count: { _all: true } }),
  ]);
  const hasVariants = new Set(variantCounts.map((v) => v.productId));
  for (const id of ids) {
    const mine = rows.filter((r) => r.productId === id);
    const { state } = productStockState(mine, hasVariants.has(id));
    const variants: Record<string, StockState> = {};
    for (const r of mine) {
      if (!r.variantId) continue;
      const best = bestLineStock(mine, id, r.variantId)!;
      variants[r.variantId] = stockStateOf(best.sellable, best.lowStockThreshold) as StockState;
    }
    products[id] = { state, deliverable: state !== 'OUT', variants };
  }
  return { pincode, covered: candidates.length > 0, products };
}
