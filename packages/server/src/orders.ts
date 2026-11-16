import { createHash, randomInt } from 'node:crypto';
import { prisma, Prisma, type OrderStatus } from '@20mart/database';
import { z } from 'zod';
import { evaluateCart, findCartId, type CartLine } from './cart';
import { getOwnAddress } from './addresses';
import { lockAndEvaluateCoupon, recordRedemption, reverseRedemption } from './coupon-engine';
import { notifyOrderCancelled, notifyOrderPlaced, notifyPaymentConfirmed } from './notifications';
import { quoteDelivery } from './delivery';
import { countBy } from './counts';
import { AppError, badRequest, conflict, notFound } from './errors';
import { getPaymentProvider, PaymentProviderError } from './payments';
import { enabledPaymentMethods, getStoreSettings } from './settings';

type Tx = Prisma.TransactionClient;
const TX_OPTS = { timeout: 20_000, maxWait: 20_000 } as const;

/* ─────────────────────────────── Order numbers ─────────────────────────────── */

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** Non-sequential public reference, e.g. ZM261114-7K3QX9 (30 bits of randomness per day). */
export function generateOrderNumber(now = new Date()) {
  const ymd = now.toISOString().slice(2, 10).replace(/-/g, '');
  let rand = '';
  for (let i = 0; i < 6; i++) rand += CROCKFORD[randomInt(32)];
  return `ZM${ymd}-${rand}`;
}
const ORDER_NUMBER_RE = /^ZM\d{6}-[0-9A-Z]{6}$/;
export const orderNumberParam = z.string().regex(ORDER_NUMBER_RE, 'Invalid order number');

/* ───────────────────────────── Stock transitions ───────────────────────────── */
// Each transition first flips Order.inventoryHold atomically, so a second
// attempt (retry, duplicate webhook, race) finds nothing to do: stock never moves twice.

type StockLine = { inventoryId: string; quantity: number; productName: string };

async function itemsForStock(tx: Tx, orderId: string): Promise<StockLine[]> {
  const items = await tx.orderItem.findMany({ where: { orderId }, select: { inventoryId: true, quantity: true, productName: true } });
  return items.sort((a, b) => a.inventoryId.localeCompare(b.inventoryId)); // consistent lock order
}

async function flipHold(tx: Tx, orderId: string, from: 'RESERVED' | 'COMMITTED', to: 'COMMITTED' | 'RELEASED') {
  const n = await tx.$executeRaw`
    UPDATE "Order" SET "inventoryHold" = ${to}::"InventoryHold", "updatedAt" = (now() AT TIME ZONE 'UTC')
     WHERE "id" = ${orderId} AND "inventoryHold" = ${from}::"InventoryHold"`;
  return n === 1;
}

/** RESERVED → COMMITTED: reserved units become sold (available −q, reserved −q). */
export async function commitOrderStock(tx: Tx, orderId: string, orderNumber: string, adminId: string | null = null) {
  if (!(await flipHold(tx, orderId, 'RESERVED', 'COMMITTED'))) return false;
  for (const it of await itemsForStock(tx, orderId)) {
    const rows = await tx.$queryRaw<{ availableQuantity: number }[]>`
      UPDATE "Inventory"
         SET "availableQuantity" = "availableQuantity" - ${it.quantity},
             "reservedQuantity" = "reservedQuantity" - ${it.quantity},
             "updatedAt" = (now() AT TIME ZONE 'UTC')
       WHERE "id" = ${it.inventoryId} AND "reservedQuantity" >= ${it.quantity} AND "availableQuantity" >= ${it.quantity}
      RETURNING "availableQuantity"`;
    if (!rows.length) throw new AppError(500, 'STOCK_INCONSISTENT', 'Inventory reservation is inconsistent; please contact support');
    await tx.stockMovement.create({
      data: {
        inventoryId: it.inventoryId,
        movementType: 'SALE',
        quantity: -it.quantity,
        previousQuantity: rows[0].availableQuantity + it.quantity,
        newQuantity: rows[0].availableQuantity,
        reason: `Order ${orderNumber} confirmed`,
        reference: orderNumber,
        performedByAdminId: adminId,
      },
    });
  }
  return true;
}

/** RESERVED → RELEASED: give reserved units back (reserved −q). Movement snapshots track reservedQuantity. */
export async function releaseOrderStock(tx: Tx, orderId: string, orderNumber: string, reason: string, adminId: string | null = null) {
  if (!(await flipHold(tx, orderId, 'RESERVED', 'RELEASED'))) return false;
  for (const it of await itemsForStock(tx, orderId)) {
    const rows = await tx.$queryRaw<{ reservedQuantity: number }[]>`
      UPDATE "Inventory" SET "reservedQuantity" = "reservedQuantity" - ${it.quantity}, "updatedAt" = (now() AT TIME ZONE 'UTC')
       WHERE "id" = ${it.inventoryId} AND "reservedQuantity" >= ${it.quantity}
      RETURNING "reservedQuantity"`;
    if (!rows.length) throw new AppError(500, 'STOCK_INCONSISTENT', 'Inventory reservation is inconsistent; please contact support');
    await tx.stockMovement.create({
      data: {
        inventoryId: it.inventoryId,
        movementType: 'RELEASE',
        quantity: -it.quantity,
        previousQuantity: rows[0].reservedQuantity + it.quantity,
        newQuantity: rows[0].reservedQuantity,
        reason: `${reason} (order ${orderNumber})`,
        reference: orderNumber,
        performedByAdminId: adminId,
      },
    });
  }
  return true;
}

/** COMMITTED → RELEASED: put sold units back on the shelf (available +q). */
export async function restockOrder(tx: Tx, orderId: string, orderNumber: string, reason: string, adminId: string | null = null) {
  if (!(await flipHold(tx, orderId, 'COMMITTED', 'RELEASED'))) return false;
  for (const it of await itemsForStock(tx, orderId)) {
    const rows = await tx.$queryRaw<{ availableQuantity: number }[]>`
      UPDATE "Inventory" SET "availableQuantity" = "availableQuantity" + ${it.quantity}, "updatedAt" = (now() AT TIME ZONE 'UTC')
       WHERE "id" = ${it.inventoryId}
      RETURNING "availableQuantity"`;
    await tx.stockMovement.create({
      data: {
        inventoryId: it.inventoryId,
        movementType: 'STOCK_IN',
        quantity: it.quantity,
        previousQuantity: rows[0].availableQuantity - it.quantity,
        newQuantity: rows[0].availableQuantity,
        reason: `${reason} (order ${orderNumber})`,
        reference: orderNumber,
        performedByAdminId: adminId,
      },
    });
  }
  return true;
}

export async function addHistory(
  tx: Tx,
  orderId: string,
  from: OrderStatus | null,
  to: OrderStatus,
  actor: { label: string; adminId?: string | null; userId?: string | null },
  reason?: string | null
) {
  await tx.orderStatusHistory.create({
    data: { orderId, fromStatus: from, toStatus: to, actor: actor.label, changedByAdminId: actor.adminId ?? null, changedByUserId: actor.userId ?? null, reason: reason ?? null },
  });
}

/* ─────────────────────────────── Place order ─────────────────────────────── */

export const placeOrderInput = z.object({
  addressId: z.string().uuid('Select a delivery address'),
  paymentMethod: z.enum(['ONLINE', 'CASH_ON_DELIVERY']),
  /** Client-generated once per checkout attempt; repeated submits return the same order. */
  idempotencyKey: z.string().uuid('Invalid request key'),
  notes: z.string().trim().max(300).optional(),
});

export interface CheckoutPaymentParams {
  provider: 'RAZORPAY';
  keyId: string;
  providerOrderId: string;
  amountPaise: number;
  currency: 'INR';
  orderNumber: string;
  prefill: { name: string | null; email: string | null; contact: string | null };
}

export interface PlaceOrderResult {
  orderNumber: string;
  status: OrderStatus;
  totalPaise: number;
  paymentMethod: 'ONLINE' | 'CASH_ON_DELIVERY';
  duplicate: boolean;
  payment: CheckoutPaymentParams | null;
  paymentError: string | null;
}

/**
 * Inside the order transaction: the products/variants still exist, are ACTIVE, and cost exactly what
 * the customer was shown. Rows are locked FOR SHARE until commit (admins' price edits wait).
 */
export async function assertLinesCurrent(tx: Tx, lines: CartLine[]) {
  const productIds = [...new Set(lines.map((l) => l.productId))];
  const variantIds = [...new Set(lines.map((l) => l.variantId).filter((v): v is string => !!v))];
  const products = await tx.$queryRaw<{ id: string; price: number; status: string }[]>`
    SELECT "id", "sellingPricePaise" AS price, "status"::text AS status FROM "Product"
     WHERE "id" IN (${Prisma.join(productIds)}) ORDER BY "id" FOR SHARE`;
  const variants = variantIds.length
    ? await tx.$queryRaw<{ id: string; price: number; status: string }[]>`
        SELECT "id", "sellingPricePaise" AS price, "status"::text AS status FROM "ProductVariant"
         WHERE "id" IN (${Prisma.join(variantIds)}) ORDER BY "id" FOR SHARE`
    : [];
  const p = new Map(products.map((r) => [r.id, r]));
  const v = new Map(variants.map((r) => [r.id, r]));
  for (const l of lines) {
    const prod = p.get(l.productId);
    const row = l.variantId ? v.get(l.variantId) : prod;
    const label = `${l.name}${l.variantName ? ` (${l.variantName})` : ''}`;
    if (!prod || prod.status !== 'ACTIVE' || !row || row.status !== 'ACTIVE') {
      throw new AppError(409, 'CART_NEEDS_ATTENTION', `${label} is no longer available. Please review your cart.`, { issues: [`${label}: no longer available`] });
    }
    if (row.price !== l.unitPricePaise) {
      throw new AppError(409, 'PRICE_CHANGED', `The price of ${label} just changed. Please review your cart before placing the order.`, {
        issues: [`${label}: price changed`],
      });
    }
  }
}

function cartBlockers(lines: CartLine[]) {
  return lines.filter((l) => l.state !== 'ok').map((l) => `${l.name}${l.variantName ? ` (${l.variantName})` : ''}: ${l.message}`);
}

/**
 * Atomically convert the customer's cart into an order.
 * Every amount is computed here from database prices; the browser sends none.
 */
export async function placeOrder(userId: string, raw: unknown): Promise<PlaceOrderResult> {
  const input = placeOrderInput.parse(raw);
  try {
    return await placeOrderOnce(userId, input);
  } catch (e) {
    // A concurrent duplicate submit may have won (e.g. its cart conversion made ours look empty):
    // the same idempotency key must always resolve to that one order.
    const winner = await prisma.order.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
      select: { id: true },
    });
    if (winner) return existingOrderResult(winner.id, userId);
    throw e;
  }
}

async function placeOrderOnce(userId: string, input: z.infer<typeof placeOrderInput>): Promise<PlaceOrderResult> {

  const existing = await prisma.order.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
    select: { id: true },
  });
  if (existing) return existingOrderResult(existing.id, userId);

  await expireStaleReservations().catch(() => undefined); // free stock held by abandoned payments

  const settings = await getStoreSettings();
  if (!enabledPaymentMethods(settings).includes(input.paymentMethod)) {
    throw new AppError(409, 'PAYMENT_METHOD_UNAVAILABLE', 'This payment method is not available');
  }
  const address = await getOwnAddress(userId, input.addressId);
  const cartId = await findCartId({ userId });
  if (!cartId) throw badRequest('Your cart is empty');
  // Lines are evaluated against the ONE warehouse that would ship to this address.
  const evaluation = await evaluateCart(cartId, { pincode: address.pincode });
  const lines = evaluation.lines;
  if (!lines.length) throw badRequest('Your cart is empty');
  const issues = cartBlockers(lines);
  if (issues.length) throw new AppError(409, 'CART_NEEDS_ATTENTION', 'Some items in your cart need attention', { issues });

  const subtotal = lines.reduce((a, l) => a + l.unitPricePaise * l.quantity, 0);
  const quote = await quoteDelivery(subtotal, address.pincode, settings, evaluation.warehouse);
  if (quote.blockers.length) throw new AppError(409, 'CHECKOUT_BLOCKED', quote.blockers[0], { issues: quote.blockers });
  const warehouse = evaluation.warehouse;
  if (!warehouse) {
    // Serviceable area but no single warehouse holds every item: never split silently.
    throw new AppError(409, 'CART_NEEDS_ATTENTION', 'Some items cannot be delivered together to this address', {
      issues: ['Some items are not available for delivery to this address. Please review your cart.'],
    });
  }
  const deliveryCharge = quote.deliveryChargePaise;
  const cartCoupon = (await prisma.cart.findUnique({ where: { id: cartId! }, select: { couponCode: true } }))?.couponCode ?? null;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true, profile: { select: { phone: true } } } });
  const isOnline = input.paymentMethod === 'ONLINE';

  let orderId: string | null = null;
  let duplicateOf: string | null = null;
  for (let attempt = 0; attempt < 3 && !orderId && !duplicateOf; attempt++) {
    const orderNumber = generateOrderNumber();
    try {
      const outcome = await prisma.$transaction(async (tx) => {
        // 0) Serialise checkout per customer, then re-check under the lock: a concurrent
        //    duplicate submit sees the winner's order instead of a now-converted cart.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'checkout:' + userId}))`;
        const dup = await tx.order.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } }, select: { id: true } });
        if (dup) return { duplicateOf: dup.id, orderId: null };
        const cartNow = await tx.cart.findUnique({ where: { id: cartId! }, select: { status: true, updatedAt: true } });
        if (cartNow?.status !== 'ACTIVE') throw conflict('Your cart has changed. Please review it and try again.');
        // The fulfilment warehouse must still be active (an admin pausing it waits for us, or we see it).
        const [wh] = await tx.$queryRaw<{ status: string }[]>`SELECT "status"::text AS status FROM "Warehouse" WHERE "id" = ${warehouse.id} FOR SHARE`;
        if (wh?.status !== 'ACTIVE') throw new AppError(409, 'CHECKOUT_BLOCKED', 'Delivery to this address is temporarily unavailable. Please try again shortly.');
        // 0a) Prices/availability were read before this transaction: re-check them under a share lock so
        //     a concurrent admin price change either lands before (→ 409, customer reviews) or waits for us.
        await assertLinesCurrent(tx, lines);
        // 0b) Coupon: lock the coupon row and re-validate everything (dates, limits, grant, eligibility).
        //     Lock order is always coupon → inventory, so concurrent checkouts cannot deadlock.
        const coupon = cartCoupon ? await lockAndEvaluateCoupon(tx, cartCoupon, userId, lines) : null;
        const discount = coupon?.discountPaise ?? 0;
        const total = subtotal + deliveryCharge - discount;
        // 1) Reserve stock line by line in a fixed order (prevents deadlocks). Any shortfall aborts everything.
        const sorted = [...lines].sort((a, b) => (a.inventoryId ?? '').localeCompare(b.inventoryId ?? ''));
        for (const l of sorted) {
          if (!l.inventoryId) throw conflict(`${l.name} is not available`);
          const rows = await tx.$queryRaw<{ reservedQuantity: number }[]>`
            UPDATE "Inventory" SET "reservedQuantity" = "reservedQuantity" + ${l.quantity}, "updatedAt" = (now() AT TIME ZONE 'UTC')
             WHERE "id" = ${l.inventoryId} AND "availableQuantity" - "reservedQuantity" - "safetyStock" >= ${l.quantity}
            RETURNING "reservedQuantity"`;
          if (!rows.length) {
            throw new AppError(409, 'OUT_OF_STOCK', `Sorry, ${l.name}${l.variantName ? ` (${l.variantName})` : ''} just sold out or has fewer units left. Please update your cart.`);
          }
          await tx.stockMovement.create({
            data: {
              inventoryId: l.inventoryId,
              movementType: 'RESERVATION',
              quantity: l.quantity,
              previousQuantity: rows[0].reservedQuantity - l.quantity,
              newQuantity: rows[0].reservedQuantity,
              reason: `Reserved for order ${orderNumber}`,
              reference: orderNumber,
            },
          });
        }
        // 2) Order with immutable item and address snapshots.
        const order = await tx.order.create({
          data: {
            orderNumber,
            userId,
            addressId: address.id,
            shipName: address.name,
            shipPhone: address.phone,
            shipLine1: address.addressLine1,
            shipLine2: address.addressLine2,
            shipLandmark: address.landmark,
            shipCity: address.city,
            shipState: address.state,
            shipPincode: address.pincode,
            shipCountry: address.country,
            subtotalPaise: subtotal,
            deliveryChargePaise: deliveryCharge,
            discountPaise: discount,
            couponId: coupon?.coupon.id ?? null,
            couponCode: coupon?.coupon.code ?? null,
            taxPaise: 0, // prices are tax-inclusive (MRP regime)
            totalPaise: total,
            paymentMethod: input.paymentMethod,
            paymentStatus: 'PENDING',
            inventoryHold: 'RESERVED',
            reservationExpiresAt: isOnline ? new Date(Date.now() + settings.reservationMinutes * 60_000) : null,
            idempotencyKey: input.idempotencyKey,
            deliveryEstimate: quote.serviceability?.estimateText ?? null,
            fulfillmentWarehouseId: warehouse.id,
            notes: input.notes ?? null,
            items: {
              create: lines.map((l) => ({
                productId: l.productId,
                variantId: l.variantId,
                inventoryId: l.inventoryId!,
                productName: l.name,
                productSku: l.sku,
                variantName: l.variantName,
                productImage: l.imageUrl,
                brandName: l.brandName,
                quantity: l.quantity,
                unitPricePaise: l.unitPricePaise,
                mrpPaise: l.mrpPaise,
                totalPricePaise: l.unitPricePaise * l.quantity,
              })),
            },
            payments: isOnline
              ? undefined
              : { create: { provider: 'COD', paymentMethod: 'CASH_ON_DELIVERY', amountPaise: total, status: 'PENDING' } },
          },
          select: { id: true },
        });
        if (coupon) await recordRedemption(tx, coupon.coupon.id, userId, order.id, discount);
        await addHistory(tx, order.id, null, 'PENDING', { label: 'customer', userId }, isOnline ? 'Awaiting payment' : 'Cash on delivery order placed');
        // 3) The cart is converted (kept for audit, no longer active).
        await tx.cart.update({ where: { id: cartId! }, data: { status: 'CONVERTED' } });
        return { orderId: order.id, duplicateOf: null };
      }, TX_OPTS);
      if (outcome.duplicateOf) duplicateOf = outcome.duplicateOf;
      else if (outcome.orderId) orderId = outcome.orderId;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const target = String(e.meta?.target ?? '');
        if (target.includes('orderNumber')) continue; // astronomically rare collision → new number
        // Concurrent duplicate submit with the same idempotency key: return the winner.
        const dup = await prisma.order.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } }, select: { id: true } });
        if (dup) return existingOrderResult(dup.id, userId);
      }
      throw e;
    }
  }
  if (duplicateOf) return existingOrderResult(duplicateOf, userId);
  if (!orderId) throw new AppError(500, 'ORDER_FAILED', 'Could not create your order. Please try again.');

  let payment: CheckoutPaymentParams | null = null;
  let paymentError: string | null = null;
  if (!isOnline) await notifyOrderPlaced(orderId); // online orders are announced once payment is confirmed
  if (isOnline) {
    try {
      payment = await startOnlinePayment(orderId, { name: user.name, email: user.email, contact: user.profile?.phone ?? null });
    } catch (e) {
      // The order stays PENDING with stock reserved until expiry; the customer can retry payment.
      paymentError = e instanceof AppError || e instanceof PaymentProviderError ? e.message : 'Could not start payment';
    }
  }
  const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, select: { orderNumber: true, status: true, totalPaise: true } });
  return { ...o, paymentMethod: input.paymentMethod, duplicate: false, payment, paymentError };
}

async function existingOrderResult(orderId: string, userId: string): Promise<PlaceOrderResult> {
  const o = await prisma.order.findFirstOrThrow({
    where: { id: orderId, userId },
    select: { orderNumber: true, status: true, totalPaise: true, paymentMethod: true },
  });
  return { orderNumber: o.orderNumber, status: o.status, totalPaise: o.totalPaise, paymentMethod: o.paymentMethod === 'ONLINE' ? 'ONLINE' : 'CASH_ON_DELIVERY', duplicate: true, payment: null, paymentError: null };
}

/* ─────────────────────────────── Online payment ─────────────────────────────── */

/** Create a provider order + Payment attempt for a payable order. */
async function startOnlinePayment(orderId: string, prefill: CheckoutPaymentParams['prefill']): Promise<CheckoutPaymentParams> {
  const provider = getPaymentProvider();
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { orderNumber: true, totalPaise: true },
  });
  const attempts = await prisma.payment.count({ where: { orderId } });
  const po = await provider.createOrder({ amountPaise: order.totalPaise, receipt: order.orderNumber, notes: { orderNumber: order.orderNumber } });
  await prisma.payment.create({
    data: {
      orderId,
      provider: 'RAZORPAY',
      paymentMethod: 'ONLINE',
      amountPaise: order.totalPaise,
      status: 'PENDING',
      attempt: attempts + 1,
      providerOrderId: po.id,
    },
  });
  return { provider: 'RAZORPAY', keyId: provider.publicKey, providerOrderId: po.id, amountPaise: order.totalPaise, currency: 'INR', orderNumber: order.orderNumber, prefill };
}

function isPayable(o: { status: OrderStatus; paymentMethod: string; paymentStatus: string; reservationExpiresAt: Date | null }) {
  return (
    o.status === 'PENDING' &&
    o.paymentMethod === 'ONLINE' &&
    (o.paymentStatus === 'PENDING' || o.paymentStatus === 'FAILED') &&
    !!o.reservationExpiresAt &&
    o.reservationExpiresAt.getTime() > Date.now()
  );
}

/** Customer retries payment for their own pending online order (before the reservation expires). */
export async function retryPayment(userId: string, orderNumber: string) {
  orderNumberParam.parse(orderNumber);
  await expireStaleReservations().catch(() => undefined);
  const o = await prisma.order.findFirst({
    where: { orderNumber, userId },
    select: { id: true, status: true, paymentMethod: true, paymentStatus: true, reservationExpiresAt: true, user: { select: { name: true, email: true, profile: { select: { phone: true } } } } },
  });
  if (!o) throw notFound('Order');
  if (!isPayable(o)) throw new AppError(409, 'NOT_PAYABLE', 'This order can no longer be paid. Please place a new order.');
  return startOnlinePayment(o.id, { name: o.user.name, email: o.user.email, contact: o.user.profile?.phone ?? null });
}

export const verifyCheckoutInput = z.object({
  razorpay_order_id: z.string().min(5).max(64),
  razorpay_payment_id: z.string().min(5).max(64),
  razorpay_signature: z.string().min(16).max(256),
});

/**
 * Browser callback after checkout. NOT trusted on its own: the signature is verified,
 * then the payment is re-fetched from the provider and its status and amount checked.
 */
export async function verifyCheckoutPayment(userId: string, raw: unknown) {
  const input = verifyCheckoutInput.parse(raw);
  const payment = await prisma.payment.findUnique({
    where: { providerOrderId: input.razorpay_order_id },
    select: { amountPaise: true, order: { select: { userId: true, orderNumber: true } } },
  });
  if (!payment || payment.order.userId !== userId) throw notFound('Payment');
  const provider = getPaymentProvider();
  if (!provider.verifyCheckoutSignature({ providerOrderId: input.razorpay_order_id, providerPaymentId: input.razorpay_payment_id, signature: input.razorpay_signature })) {
    throw new AppError(400, 'BAD_SIGNATURE', 'Payment verification failed');
  }
  let p = await provider.fetchPayment(input.razorpay_payment_id);
  if (p.orderId !== input.razorpay_order_id) throw new AppError(400, 'PAYMENT_MISMATCH', 'Payment does not belong to this order');
  if (p.status === 'authorized') p = await provider.capturePayment(p.id, payment.amountPaise);
  if (p.status !== 'captured') {
    await handlePaymentFailed(input.razorpay_order_id, p.id, p.errorDescription ?? `Payment ${p.status}`);
    throw new AppError(402, 'PAYMENT_NOT_CAPTURED', 'Payment was not completed');
  }
  const result = await markPaymentCaptured(input.razorpay_order_id, p.id, p.amountPaise);
  return { orderNumber: payment.order.orderNumber, ...result };
}

/**
 * Single idempotent entry point for a confirmed capture (browser verify or webhook).
 * Amount must match exactly. Applies at most once per Payment row.
 */
export async function markPaymentCaptured(providerOrderId: string, providerPaymentId: string, amountPaise: number) {
  const payment = await prisma.payment.findUnique({
    where: { providerOrderId },
    select: { id: true, status: true, amountPaise: true, providerPaymentId: true, orderId: true, order: { select: { orderNumber: true, totalPaise: true } } },
  });
  if (!payment) throw notFound('Payment');
  if (payment.status === 'PAID') return { applied: false, status: 'already_paid' as const };
  if (amountPaise !== payment.amountPaise || amountPaise !== payment.order.totalPaise) {
    await prisma.payment.update({ where: { id: payment.id }, data: { failureReason: `Amount mismatch: got ${amountPaise}, expected ${payment.amountPaise}` } });
    throw new AppError(400, 'AMOUNT_MISMATCH', 'Payment amount does not match the order total');
  }
  const result = await prisma.$transaction(async (tx) => {
    const n = await tx.payment.updateMany({
      where: { id: payment.id, status: { in: ['PENDING', 'FAILED'] } },
      data: { status: 'PAID', providerPaymentId, capturedAt: new Date(), failureReason: null },
    });
    if (n.count === 0) return { applied: false, status: 'already_paid' as const };
    // Confirm only if the order is still awaiting payment (atomic with respect to expiry/cancel).
    const confirmed = await tx.order.updateMany({
      where: { id: payment.orderId, status: 'PENDING' },
      data: { paymentStatus: 'PAID', status: 'CONFIRMED', reservationExpiresAt: null },
    });
    if (confirmed.count === 1) {
      await commitOrderStock(tx, payment.orderId, payment.order.orderNumber);
      await addHistory(tx, payment.orderId, 'PENDING', 'CONFIRMED', { label: 'payment' }, 'Online payment received');
      return { applied: true, status: 'confirmed' as const };
    }
    // Paid after the order expired or was cancelled → money must go back.
    await tx.order.update({ where: { id: payment.orderId }, data: { paymentStatus: 'REFUND_PENDING' } });
    await tx.refund.create({
      data: {
        orderId: payment.orderId,
        paymentId: payment.id,
        provider: 'RAZORPAY',
        amountPaise,
        status: 'REQUESTED',
        reason: 'Payment received after the order was cancelled or expired',
      },
    });
    return { applied: true, status: 'refund_required' as const };
  }, TX_OPTS);
  if (result.status === 'confirmed') await notifyPaymentConfirmed(payment.orderId);
  return result;
}

export async function handlePaymentFailed(providerOrderId: string, providerPaymentId: string | null, reason: string) {
  const payment = await prisma.payment.findUnique({ where: { providerOrderId }, select: { id: true, orderId: true } });
  if (!payment) return { applied: false };
  const n = await prisma.payment.updateMany({
    where: { id: payment.id, status: 'PENDING' },
    data: { status: 'FAILED', failureReason: reason.slice(0, 300), providerPaymentId: providerPaymentId ?? undefined },
  });
  if (n.count) await prisma.order.updateMany({ where: { id: payment.orderId, status: 'PENDING', paymentStatus: 'PENDING' }, data: { paymentStatus: 'FAILED' } });
  return { applied: n.count > 0 };
}

/* ───────────────────────── Abandoned payment expiry ───────────────────────── */

/** Fail online orders whose payment window passed and release their reserved stock. */
export async function expireStaleReservations(now = new Date(), limit = 50) {
  const stale = await prisma.order.findMany({
    where: { status: 'PENDING', paymentMethod: 'ONLINE', paymentStatus: { in: ['PENDING', 'FAILED'] }, reservationExpiresAt: { lt: now } },
    select: { id: true, orderNumber: true },
    take: limit,
  });
  let expired = 0;
  for (const o of stale) {
    await prisma.$transaction(async (tx) => {
      const n = await tx.order.updateMany({
        where: { id: o.id, status: 'PENDING', paymentStatus: { in: ['PENDING', 'FAILED'] } },
        data: { status: 'FAILED', paymentStatus: 'FAILED', reservationExpiresAt: null },
      });
      if (!n.count) return; // paid/cancelled concurrently
      await releaseOrderStock(tx, o.id, o.orderNumber, 'Payment not completed in time');
      await reverseRedemption(tx, o.id); // the coupon use is given back
      await tx.payment.updateMany({ where: { orderId: o.id, status: 'PENDING' }, data: { status: 'FAILED', failureReason: 'Payment window expired' } });
      await addHistory(tx, o.id, 'PENDING', 'FAILED', { label: 'system' }, 'Payment not completed in time');
      expired++;
    }, TX_OPTS);
  }
  return { expired };
}

/* ─────────────────────────────── Cancellation ─────────────────────────────── */

export const CUSTOMER_CANCELLABLE: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING'];
export const ADMIN_CANCELLABLE: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'READY_FOR_DISPATCH', 'OUT_FOR_DELIVERY'];

export const cancelInput = z.object({ reason: z.string().trim().min(3, 'Please give a reason').max(300) });

/** Shared cancellation core: status, stock, payment/refund and history in one transaction. */
export async function cancelOrderCore(
  orderId: string,
  opts: { by: 'customer' | 'admin'; reason: string; actorLabel: string; adminId?: string | null; userId?: string | null }
) {
  const result = await prisma.$transaction(async (tx) => {
    const o = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: { id: true, orderNumber: true, status: true, paymentStatus: true, totalPaise: true, payments: { where: { status: 'PAID' }, select: { id: true, provider: true } } },
    });
    const allowed = opts.by === 'customer' ? CUSTOMER_CANCELLABLE : ADMIN_CANCELLABLE;
    if (!allowed.includes(o.status)) {
      throw new AppError(409, 'NOT_CANCELLABLE', opts.by === 'customer' ? 'This order can no longer be cancelled online. Please contact support.' : `Orders in status ${o.status} cannot be cancelled`);
    }
    const n = await tx.order.updateMany({
      where: { id: o.id, status: o.status },
      data: { status: 'CANCELLED', cancelReason: opts.reason, cancelledAt: new Date(), reservationExpiresAt: null },
    });
    if (!n.count) throw conflict('The order was updated at the same time. Please refresh and try again.');
    const released =
      (await releaseOrderStock(tx, o.id, o.orderNumber, 'Order cancelled', opts.adminId ?? null)) ||
      (await restockOrder(tx, o.id, o.orderNumber, 'Order cancelled', opts.adminId ?? null));
    void released;
    await reverseRedemption(tx, o.id);
    await tx.payment.updateMany({ where: { orderId: o.id, status: 'PENDING' }, data: { status: 'FAILED', failureReason: 'Order cancelled' } });
    let refundRequired = false;
    if (o.paymentStatus === 'PAID' && o.payments.length) {
      refundRequired = true;
      await tx.order.update({ where: { id: o.id }, data: { paymentStatus: 'REFUND_PENDING' } });
      await tx.refund.create({
        data: { orderId: o.id, paymentId: o.payments[0].id, provider: o.payments[0].provider, amountPaise: o.totalPaise, status: 'REQUESTED', reason: `Order cancelled: ${opts.reason}` },
      });
    }
    await addHistory(tx, o.id, o.status, 'CANCELLED', { label: opts.actorLabel, adminId: opts.adminId, userId: opts.userId }, opts.reason);
    return { orderNumber: o.orderNumber, refundRequired };
  }, TX_OPTS);
  await notifyOrderCancelled(orderId, result.refundRequired);
  return result;
}

export async function customerCancelOrder(userId: string, orderNumber: string, raw: unknown) {
  orderNumberParam.parse(orderNumber);
  const { reason } = cancelInput.parse(raw);
  const o = await prisma.order.findFirst({ where: { orderNumber, userId }, select: { id: true } });
  if (!o) throw notFound('Order');
  return cancelOrderCore(o.id, { by: 'customer', reason, actorLabel: 'customer', userId });
}

/* ─────────────────────────────── Customer views ─────────────────────────────── */

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Order placed',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  PACKED: 'Packed',
  READY_FOR_DISPATCH: 'Ready for dispatch',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  FAILED: 'Payment failed',
  REFUNDED: 'Refunded',
};
export const orderStatusLabel = (s: OrderStatus) => STATUS_LABEL[s];

export async function listCustomerOrders(userId: string, page = 1, pageSize = 10) {
  const where = { userId };
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        orderNumber: true,
        createdAt: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        totalPaise: true,
        deliveryEstimate: true,
        id: true,
        items: { select: { productName: true, productImage: true, quantity: true }, take: 4 },
      },
    }),
    prisma.order.count({ where }),
  ]);
  const itemCounts = await countBy(
    rows.length ? prisma.orderItem.groupBy({ by: ['orderId'], where: { orderId: { in: rows.map((r) => r.id) } }, _count: { _all: true } }) : [],
    (g) => g.orderId
  );
  // The internal id is only used to join counts; customers address orders by orderNumber.
  const items = rows.map(({ id, ...r }) => ({ ...r, _count: { items: itemCounts.get(id) ?? 0 }, statusLabel: STATUS_LABEL[r.status] }));
  return { items, total, page, pageSize };
}

/** A customer's own order. Other customers' orders are indistinguishable from missing ones (404). */
export async function getCustomerOrder(userId: string, orderNumber: string) {
  if (!ORDER_NUMBER_RE.test(orderNumber)) throw notFound('Order');
  const o = await prisma.order.findFirst({
    where: { orderNumber, userId },
    select: {
      orderNumber: true,
      createdAt: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      subtotalPaise: true,
      deliveryChargePaise: true,
      discountPaise: true,
      couponCode: true,
      taxPaise: true,
      totalPaise: true,
      shipName: true,
      shipPhone: true,
      shipLine1: true,
      shipLine2: true,
      shipLandmark: true,
      shipCity: true,
      shipState: true,
      shipPincode: true,
      deliveryEstimate: true,
      reservationExpiresAt: true,
      cancelReason: true,
      cancelledAt: true,
      deliveredAt: true,
      items: {
        select: { id: true, productId: true, productName: true, productSku: true, variantName: true, productImage: true, brandName: true, quantity: true, unitPricePaise: true, mrpPaise: true, totalPricePaise: true, product: { select: { slug: true } } },
      },
      history: { orderBy: { createdAt: 'asc' }, select: { toStatus: true, createdAt: true, reason: true, actor: true } },
      refunds: { select: { status: true, amountPaise: true, createdAt: true, processedAt: true } },
    },
  });
  if (!o) throw notFound('Order');
  return {
    ...o,
    statusLabel: STATUS_LABEL[o.status],
    // Customers see what happened and when — not which staff member did it.
    history: o.history.map((h) => ({ status: h.toStatus, label: STATUS_LABEL[h.toStatus], at: h.createdAt, note: h.actor === 'customer' || h.actor === 'system' || h.actor === 'payment' ? h.reason : null })),
    canCancel: CUSTOMER_CANCELLABLE.includes(o.status),
    canPay: isPayable(o),
  };
}

/** Content hash used for webhook dedupe records. */
export const hashPayload = (raw: string) => createHash('sha256').update(raw).digest('hex');
