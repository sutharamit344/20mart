import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@20mart/database';
import { addVariant, createProduct } from '../src/catalog/products';
import { adjustStock, getStockHistory, inventoryStats, listInventory, setLowStockThreshold } from '../src/inventory';
import { toAppError } from '../src/errors';
import type { AdminContext } from '../src/auth/admin';
import { adminSession, categoryId, resetDb } from './helpers';

let actor: AdminContext;
let invId: string;
let productId: string;

beforeEach(async () => {
  await resetDb();
  ({ ctx: actor } = await adminSession('invmgr', ['INVENTORY_MANAGER', 'PRODUCT_MANAGER']));
  const p = await createProduct(actor, { name: 'Bag Clips', sku: 'ZM-DLY-004', categoryId: await categoryId(), sellingPricePaise: 2000, mrpPaise: 3000 });
  productId = p.id;
  invId = (await prisma.inventory.findFirstOrThrow({ where: { productId } })).id;
});

const qty = async () => (await prisma.inventory.findUniqueOrThrow({ where: { id: invId } })).availableQuantity;
const statusOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return 200;
  } catch (e) {
    return toAppError(e).status;
  }
};

describe('stock adjustments', () => {
  it('records initial stock once, then stock in/out and corrections with full history', async () => {
    await adjustStock(actor, invId, { type: 'INITIAL_STOCK', quantity: 20, reason: 'Opening count', reference: 'GRN-1' });
    expect(await qty()).toBe(20);
    expect(await statusOf(adjustStock(actor, invId, { type: 'INITIAL_STOCK', quantity: 5, reason: 'again' }))).toBe(409);

    await adjustStock(actor, invId, { type: 'STOCK_IN', quantity: 10, reason: 'Supplier delivery' });
    await adjustStock(actor, invId, { type: 'STOCK_OUT', quantity: 4, reason: 'Damaged in transit' });
    await adjustStock(actor, invId, { type: 'ADJUSTMENT', newQuantity: 23, reason: 'Physical count' });
    expect(await qty()).toBe(23);

    const history = await getStockHistory(invId);
    expect(history.total).toBe(4);
    const [correction, out, inn, initial] = history.items;
    expect(initial).toMatchObject({ movementType: 'INITIAL_STOCK', quantity: 20, previousQuantity: 0, newQuantity: 20, reference: 'GRN-1' });
    expect(inn).toMatchObject({ movementType: 'STOCK_IN', quantity: 10, previousQuantity: 20, newQuantity: 30 });
    expect(out).toMatchObject({ movementType: 'STOCK_OUT', quantity: -4, previousQuantity: 30, newQuantity: 26 });
    expect(correction).toMatchObject({ movementType: 'ADJUSTMENT', quantity: -3, previousQuantity: 26, newQuantity: 23, reason: 'Physical count' });
    expect(correction.performedBy?.username).toBe('invmgr');
    expect(await prisma.adminAuditLog.count({ where: { category: 'INVENTORY' } })).toBe(4);
  });

  it('prevents negative stock and leaves the quantity and history untouched', async () => {
    await adjustStock(actor, invId, { type: 'INITIAL_STOCK', quantity: 3, reason: 'Opening' });
    expect(await statusOf(adjustStock(actor, invId, { type: 'STOCK_OUT', quantity: 4, reason: 'Too many' }))).toBe(409);
    expect(await qty()).toBe(3);
    expect((await getStockHistory(invId)).total).toBe(1);
    // Validation: zero/negative/fractional quantities and missing reasons are rejected.
    expect(await statusOf(adjustStock(actor, invId, { type: 'STOCK_IN', quantity: 0, reason: 'x y z' }))).toBe(400);
    expect(await statusOf(adjustStock(actor, invId, { type: 'STOCK_IN', quantity: -5, reason: 'x y z' }))).toBe(400);
    expect(await statusOf(adjustStock(actor, invId, { type: 'STOCK_IN', quantity: 1.5, reason: 'x y z' }))).toBe(400);
    expect(await statusOf(adjustStock(actor, invId, { type: 'STOCK_IN', quantity: 5, reason: '' }))).toBe(400);
    expect(await statusOf(adjustStock(actor, invId, { type: 'ADJUSTMENT', newQuantity: -1, reason: 'count' }))).toBe(400);
  });

  it('the database itself refuses negative stock (CHECK constraint)', async () => {
    await expect(prisma.inventory.update({ where: { id: invId }, data: { availableQuantity: -1 } })).rejects.toThrow(/Inventory_quantities_check/);
  });

  it('stays exact under 50 concurrent stock-outs (no overselling, every change logged)', async () => {
    await adjustStock(actor, invId, { type: 'INITIAL_STOCK', quantity: 30, reason: 'Opening' });
    const results = await Promise.allSettled(
      Array.from({ length: 50 }, (_, i) => adjustStock(actor, invId, { type: 'STOCK_OUT', quantity: 1, reason: `Concurrent ${i}` }))
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    expect(ok).toBe(30);
    expect(rejected).toHaveLength(20);
    expect(rejected.every((r) => toAppError(r.reason).status === 409)).toBe(true);
    expect(await qty()).toBe(0);
    const movements = await prisma.stockMovement.findMany({ where: { inventoryId: invId, movementType: 'STOCK_OUT' } });
    expect(movements).toHaveLength(30);
    // Every movement's snapshot chain is consistent (each new = previous - 1, all distinct).
    expect(new Set(movements.map((m) => m.newQuantity)).size).toBe(30);
    expect(movements.every((m) => m.newQuantity === m.previousQuantity - 1)).toBe(true);
  }, 90_000);

  it('stays consistent under concurrent mixed stock-in and stock-out', async () => {
    await adjustStock(actor, invId, { type: 'INITIAL_STOCK', quantity: 100, reason: 'Opening' });
    await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        adjustStock(actor, invId, i % 2 ? { type: 'STOCK_IN', quantity: 3, reason: 'Restock' } : { type: 'STOCK_OUT', quantity: 2, reason: 'Damaged' })
      )
    );
    expect(await qty()).toBe(100 + 20 * 3 - 20 * 2);
  }, 90_000);
});

describe('low stock and variants', () => {
  it('detects low and out-of-stock rows using per-item thresholds', async () => {
    expect((await inventoryStats()).outOfStock).toBe(1);
    await adjustStock(actor, invId, { type: 'INITIAL_STOCK', quantity: 8, reason: 'Opening' });
    expect((await listInventory({ page: 1, pageSize: 20, stock: 'low' })).total).toBe(1); // default threshold 10
    await setLowStockThreshold(actor, invId, { lowStockThreshold: 5 });
    expect((await listInventory({ page: 1, pageSize: 20, stock: 'low' })).total).toBe(0);
    expect((await listInventory({ page: 1, pageSize: 20, stock: 'in' })).total).toBe(1);
    const stats = await inventoryStats();
    expect(stats).toMatchObject({ totalUnits: 8, lowStock: 0, outOfStock: 0 });
  });

  it('tracks stock per variant once variants exist', async () => {
    const v = await addVariant(actor, productId, { name: 'Pack of 12', sku: 'ZM-DLY-004-12', sellingPricePaise: 3500, mrpPaise: 4000 });
    const vInv = await prisma.inventory.findFirstOrThrow({ where: { variantId: v.id } });
    // Product-level row can no longer be adjusted.
    expect(await statusOf(adjustStock(actor, invId, { type: 'STOCK_IN', quantity: 1, reason: 'x y z' }))).toBe(409);
    await adjustStock(actor, vInv.id, { type: 'INITIAL_STOCK', quantity: 12, reason: 'Opening' });
    const list = await listInventory({ page: 1, pageSize: 20 });
    expect(list.items.map((i) => i.variant?.sku)).toEqual(['ZM-DLY-004-12']);
    // A second product-level inventory row for the same product is impossible (partial unique index).
    await expect(prisma.inventory.create({ data: { productId } })).rejects.toThrow();
  });

  it('cannot add variants while product-level stock exists', async () => {
    await adjustStock(actor, invId, { type: 'INITIAL_STOCK', quantity: 2, reason: 'Opening' });
    expect(await statusOf(addVariant(actor, productId, { name: 'Big', sku: 'ZM-BIG', sellingPricePaise: 3000, mrpPaise: 3000 }))).toBe(409);
  });
});
