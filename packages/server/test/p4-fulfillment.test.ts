import { beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@20mart/database';
import { addItem, evaluateCart, findCartId } from '../src/cart';
import { createAddress } from '../src/addresses';
import { checkServiceability } from '../src/delivery';
import { placeOrder } from '../src/orders';
import { availabilityForPincode } from '../src/fulfillment';
import { adjustStockAt, ensureInventoryRow, listInventory } from '../src/inventory';
import { saveWarehouse, setWarehouseStatus, submitDeliveryInterest } from '../src/warehouses';
import { createPurchaseOrder, receiveGoods, saveSupplier, setPurchaseOrderStatus } from '../src/procurement';
import { markDeliveryFailed, transitionOrder } from '../src/admin-orders';
import { toAppError } from '../src/errors';
import type { AdminContext } from '../src/auth/admin';
import { adminRequest, adminSession, coverPincode, createCustomer, ctxParams, makeSellable, resetDb, setupDelivery, testWarehouse, VALID_ADDRESS } from './helpers';

const A = '../../../apps/20martadmin/src/app/api/admin';
const PIN = '380015';

const errOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return toAppError(e);
  }
  throw new Error('expected failure');
};
const inv = (id: string) => prisma.inventory.findUniqueOrThrow({ where: { id } });

async function warehouse(code: string, status: 'ACTIVE' | 'SETUP' | 'PAUSED' = 'ACTIVE', extra: Record<string, unknown> = {}) {
  return prisma.warehouse.create({
    data: { code, name: `WH ${code}`, status, addressLine1: '1 Road', city: 'Ahmedabad', state: 'Gujarat', pinCode: '380001', ...extra },
  });
}
async function stockAt(warehouseId: string, productId: string, qty: number, safetyStock = 0) {
  const id = await prisma.$transaction((tx) => ensureInventoryRow(tx, warehouseId, productId, null));
  await prisma.inventory.update({ where: { id }, data: { availableQuantity: qty, safetyStock } });
  return id;
}
async function shopper(items: { productId: string; quantity: number }[]) {
  const c = await createCustomer();
  const address = await createAddress(c.user.id, VALID_ADDRESS);
  for (const i of items) await addItem({ userId: c.user.id }, i);
  return { ...c, address };
}
const order = (c: { user: { id: string }; address: { id: string } }) =>
  placeOrder(c.user.id, { addressId: c.address.id, paymentMethod: 'CASH_ON_DELIVERY', idempotencyKey: randomUUID() });

let admin: AdminContext;
beforeEach(async () => {
  await resetDb();
  await setupDelivery(); // 380015 → "Test zone" → TEST-WH (ACTIVE, priority 1)
  ({ ctx: admin } = await adminSession('ops', ['SUPER_ADMIN']));
});

describe('PIN-code serviceability needs real warehouse coverage', () => {
  it('serviceable PIN without an active mapped warehouse is not deliverable', async () => {
    expect(await checkServiceability(PIN)).toMatchObject({ serviceable: true, code: 'OK' });
    const wh = await testWarehouse();
    await prisma.warehouse.update({ where: { id: wh.id }, data: { status: 'SETUP' } });
    expect(await checkServiceability(PIN)).toMatchObject({ serviceable: false, code: 'NOT_CONFIGURED', estimateText: null });
    await prisma.warehouse.update({ where: { id: wh.id }, data: { status: 'ACTIVE' } });
    await prisma.warehouseDeliveryZone.updateMany({ data: { isActive: false } });
    expect((await checkServiceability(PIN)).code).toBe('NOT_CONFIGURED');
    await prisma.warehouseDeliveryZone.updateMany({ data: { isActive: true, deliveryFeePaise: 1500, estimateHours: 12 } });
    expect(await checkServiceability(PIN)).toMatchObject({ serviceable: true, feePaise: 1500, estimateHours: 12 }); // mapping override
    expect((await checkServiceability('110001')).code).toBe('NOT_SERVICEABLE');
  });

  it('a warehouse at its daily capacity stops accepting orders for the area', async () => {
    const { product } = await makeSellable({ sku: 'CAP-1', stock: 10 });
    await prisma.warehouse.update({ where: { code: 'TEST-WH' }, data: { dailyOrderCapacity: 1 } });
    await order(await shopper([{ productId: product.id, quantity: 1 }]));
    expect((await checkServiceability(PIN)).code).toBe('AT_CAPACITY');
    const e = await errOf(order(await shopper([{ productId: product.id, quantity: 1 }])));
    expect(e.status).toBe(409);
  });
});

describe('warehouse selection and order assignment', () => {
  it('ships the whole order from the highest-priority warehouse that has everything; never splits', async () => {
    const a = await makeSellable({ sku: 'SEL-A', stock: 5 }); // stocked at TEST-WH
    const b = await makeSellable({ sku: 'SEL-B', stock: 0 }); // nothing at TEST-WH
    const second = await warehouse('WH-2');
    await coverPincode(PIN, second.id, { priority: 2 });
    const aAt2 = await stockAt(second.id, a.product.id, 3);
    const bAt2 = await stockAt(second.id, b.product.id, 3);

    const c = await shopper([{ productId: a.product.id, quantity: 2 }]);
    await addItem({ userId: c.user.id }, { productId: b.product.id, quantity: 1 }, { pincode: PIN });
    const ev = await evaluateCart((await findCartId({ userId: c.user.id }))!, { pincode: PIN });
    expect(ev.warehouse?.code).toBe('WH-2'); // TEST-WH (priority 1) lacks SEL-B
    const placed = await order(c);
    const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber: placed.orderNumber }, include: { fulfillmentWarehouse: true } });
    expect(o.fulfillmentWarehouse?.code).toBe('WH-2');
    expect((await inv(aAt2)).reservedQuantity).toBe(2);
    expect((await inv(bAt2)).reservedQuantity).toBe(1);
    expect((await inv(a.inventoryId)).reservedQuantity).toBe(0); // priority-1 warehouse untouched
  });

  it('blocks checkout and names the item when no single warehouse can ship the cart', async () => {
    const a = await makeSellable({ sku: 'SPL-A', stock: 5 });
    const b = await makeSellable({ sku: 'SPL-B', stock: 0 });
    const second = await warehouse('WH-3');
    await coverPincode(PIN, second.id, { priority: 2 });
    await stockAt(second.id, b.product.id, 5); // A only at TEST-WH, B only at WH-3
    const c = await shopper([{ productId: a.product.id, quantity: 1 }]);
    await addItem({ userId: c.user.id }, { productId: b.product.id, quantity: 1 });
    const ev = await evaluateCart((await findCartId({ userId: c.user.id }))!, { pincode: PIN });
    expect(ev.warehouse).toBeNull();
    expect(ev.lines.filter((l) => l.state !== 'ok').map((l) => l.sku)).toEqual(['SPL-B']);
    expect(ev.lines.find((l) => l.sku === 'SPL-B')?.message).toMatch(/your location/);
    const e = await errOf(order(c));
    expect(e.code).toBe('CART_NEEDS_ATTENTION');
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.stockMovement.count({ where: { movementType: 'RESERVATION' } })).toBe(0);
  });

  it('safety stock is never sold and availability is per location', async () => {
    const { product, inventoryId } = await makeSellable({ sku: 'SAFE-1', stock: 3 });
    await prisma.inventory.update({ where: { id: inventoryId }, data: { safetyStock: 2 } });
    const avail = await availabilityForPincode(PIN, [product.id]);
    expect(avail.covered).toBe(true);
    expect(avail.products[product.id].state).toBe('LOW'); // 1 sellable
    const c = await shopper([{ productId: product.id, quantity: 1 }]);
    expect((await errOf(addItem({ userId: c.user.id }, { productId: product.id, quantity: 1 }, { pincode: PIN }))).code).toBe('INSUFFICIENT_STOCK');
    // Elsewhere: no coverage → nothing deliverable there.
    expect((await availabilityForPincode('110001', [product.id])).covered).toBe(false);
    // Stock in a non-active warehouse never counts.
    const setup = await warehouse('WH-SETUP', 'SETUP');
    await coverPincode(PIN, setup.id, { priority: 0 });
    await stockAt(setup.id, product.id, 50);
    expect((await availabilityForPincode(PIN, [product.id])).products[product.id].state).toBe('LOW');
  });

  it('two customers racing for the last unit: exactly one order wins, stock never negative', async () => {
    const { product, inventoryId } = await makeSellable({ sku: 'LAST-1', stock: 1 });
    const c1 = await shopper([{ productId: product.id, quantity: 1 }]);
    const c2 = await shopper([{ productId: product.id, quantity: 1 }]);
    const results = await Promise.allSettled([order(c1), order(c2)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const row = await inv(inventoryId);
    expect(row.reservedQuantity).toBe(1);
    expect(row.availableQuantity).toBe(1);
  });

  it('failed delivery returns the goods to the fulfilment warehouse exactly once', async () => {
    const { product, inventoryId } = await makeSellable({ sku: 'FAIL-1', stock: 4 });
    const placed = await order(await shopper([{ productId: product.id, quantity: 2 }]));
    const o = await prisma.order.findUniqueOrThrow({ where: { orderNumber: placed.orderNumber } });
    for (const s of ['CONFIRMED', 'PROCESSING', 'PACKED', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY'] as const) await transitionOrder(admin, o.id, { toStatus: s });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).dispatchedAt).not.toBeNull();
    expect((await inv(inventoryId)).availableQuantity).toBe(2);
    await markDeliveryFailed(admin, o.id, { reason: 'Customer unreachable' });
    expect((await inv(inventoryId)).availableQuantity).toBe(4);
    expect((await errOf(markDeliveryFailed(admin, o.id, { reason: 'again' }))).status).toBe(409);
    expect((await inv(inventoryId)).availableQuantity).toBe(4);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: o.id } })).deliveryFailureReason).toBe('Customer unreachable');
  });
});

describe('warehouse administration', () => {
  it('locations cannot be activated with placeholder details; stock is per warehouse with an audit trail', async () => {
    const w = await saveWarehouse(admin, null, { name: 'Bopal store room', code: 'amd-02', addressLine1: 'Plot 4, Bopal', city: 'Ahmedabad', state: 'Gujarat', pinCode: '380058' });
    expect(w.code).toBe('AMD-02');
    expect(w.status).toBe('SETUP');
    const placeholder = await prisma.warehouse.create({
      data: { code: 'PRIMARY', name: 'Primary', addressLine1: 'Address not configured', city: 'Not configured', state: 'Not configured', pinCode: '000000' },
    });
    expect((await errOf(setWarehouseStatus(admin, placeholder.id, { status: 'ACTIVE' }))).code).toBe('WAREHOUSE_INCOMPLETE');
    await setWarehouseStatus(admin, w.id, { status: 'ACTIVE' });

    const { product } = await makeSellable({ sku: 'MULTI-1', stock: 7 });
    await adjustStockAt(admin, { warehouseId: w.id, productId: product.id, type: 'STOCK_IN', quantity: 3, reason: 'Opening count' });
    const rows = await listInventory({ page: 1, pageSize: 20, q: 'MULTI-1' });
    expect(rows.items.map((r) => [r.warehouse.code, r.availableQuantity]).sort()).toEqual([
      ['AMD-02', 3],
      ['TEST-WH', 7],
    ]);
    const only = await listInventory({ page: 1, pageSize: 20, warehouseId: w.id });
    expect(only.items).toHaveLength(1);
    expect(await prisma.stockMovement.count({ where: { inventory: { warehouseId: w.id } } })).toBe(1);
    expect(await prisma.adminAuditLog.count({ where: { category: 'WAREHOUSE' } })).toBeGreaterThanOrEqual(2);
  });

  it('demand interest records people, not orders', async () => {
    await submitDeliveryInterest({ pincode: '110001', email: 'A@Example.com' });
    await submitDeliveryInterest({ pincode: '110001', email: 'a@example.com' }); // same person
    expect(await prisma.deliveryInterest.count()).toBe(1);
    expect(await prisma.order.count()).toBe(0);
  });
});

describe('procurement and goods receiving', () => {
  async function po(qty = 10) {
    const supplier = await saveSupplier(admin, null, { name: 'Shree Plastics', gstin: '24AAACS1234A1Z5' });
    const { product, inventoryId } = await makeSellable({ sku: 'PO-1', stock: 0 });
    const wh = await testWarehouse();
    const created = await createPurchaseOrder(admin, { supplierId: supplier.id, warehouseId: wh.id, items: [{ productId: product.id, quantity: qty, unitCostPaise: 1200 }] });
    const item = await prisma.purchaseOrderItem.findFirstOrThrow({ where: { purchaseOrderId: created.id } });
    return { id: created.id, itemId: item.id, inventoryId, productId: product.id };
  }

  it('ordering never changes stock; only confirmed receipts do (partial, idempotent, capped)', async () => {
    const p = await po(10);
    const receipt = (key: string, accepted: number, rejected = 0, note?: string) =>
      receiveGoods(admin, p.id, { idempotencyKey: key, items: [{ purchaseOrderItemId: p.itemId, quantityAccepted: accepted, quantityRejected: rejected, discrepancyNote: note }] });
    expect((await errOf(receipt(randomUUID(), 1))).status).toBe(409); // draft cannot be received
    await setPurchaseOrderStatus(admin, p.id, { status: 'ORDERED' });
    expect((await inv(p.inventoryId)).availableQuantity).toBe(0); // ordering ≠ stock

    const key = randomUUID();
    await receipt(key, 6);
    const again = await receipt(key, 6); // double submit
    expect(again.duplicate).toBe(true);
    expect((await inv(p.inventoryId)).availableQuantity).toBe(6);
    expect((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: p.id } })).status).toBe('PARTIALLY_RECEIVED');

    expect((await errOf(receipt(randomUUID(), 5))).code).toBe('RECEIPT_EXCEEDS_ORDER'); // only 4 outstanding
    expect((await errOf(receipt(randomUUID(), 2, 2))).status).toBe(400); // rejected units need a note
    await receipt(randomUUID(), 2, 2, 'Two cartons crushed');
    const done = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: p.id }, include: { items: true } });
    expect(done.status).toBe('RECEIVED');
    expect(done.items[0]).toMatchObject({ quantityReceived: 8, quantityRejected: 2 });
    expect((await inv(p.inventoryId)).availableQuantity).toBe(8); // rejected never stocked
    const moves = await prisma.stockMovement.findMany({ where: { inventoryId: p.inventoryId }, orderBy: { createdAt: 'asc' } });
    expect(moves.map((m) => [m.movementType, m.quantity])).toEqual([
      ['PURCHASE_RECEIPT', 6],
      ['PURCHASE_RECEIPT', 2],
    ]);
    expect((await errOf(setPurchaseOrderStatus(admin, p.id, { status: 'CANCELLED' }))).status).toBe(409);
  });

  it('permissions are enforced on the server for warehouses and receiving', async () => {
    const p = await po(5);
    await setPurchaseOrderStatus(admin, p.id, { status: 'ORDERED' });
    const om = await adminSession('ordermgr', ['ORDER_MANAGER']);
    const cm = await adminSession('content', ['CONTENT_MANAGER']);
    const receive = await import(`${A}/purchase-orders/[id]/receive/route`);
    const body = { idempotencyKey: randomUUID(), items: [{ purchaseOrderItemId: p.itemId, quantityAccepted: 5 }] };
    const res = await receive.POST(adminRequest('/x', { method: 'POST', token: om.token, body }), ctxParams({ id: p.id }));
    expect(res.status).toBe(403);
    expect((await inv(p.inventoryId)).availableQuantity).toBe(0);

    const whs = await import(`${A}/warehouses/route`);
    expect((await whs.GET(adminRequest('/x', { token: om.token }))).status).toBe(200); // view only
    expect((await whs.GET(adminRequest('/x', { token: cm.token }))).status).toBe(403);
    const create = await whs.POST(adminRequest('/x', { method: 'POST', token: om.token, body: { name: 'X', code: 'X1', addressLine1: 'a b c', city: 'Ahmedabad', state: 'Gujarat', pinCode: '380001' } }));
    expect(create.status).toBe(403);

    const im = await adminSession('invmgr', ['INVENTORY_MANAGER']);
    const ok = await receive.POST(adminRequest('/x', { method: 'POST', token: im.token, body }), ctxParams({ id: p.id }));
    expect(ok.status).toBe(201);
    expect((await inv(p.inventoryId)).availableQuantity).toBe(5);
    const log = await prisma.adminAuditLog.findFirstOrThrow({ where: { action: 'Received goods' } });
    expect(log.adminName).toBe('invmgr name');
  });
});
