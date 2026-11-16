/**
 * Coupon evaluation and redemption. All money is integer paise and every number
 * is computed here, on the server, from database state — the browser never sends
 * a discount amount.
 *
 * Concurrency model (see redeemCouponInTx):
 *  - checkout is already serialised per customer (advisory lock in placeOrder), which
 *    makes the per-customer limit check race-free;
 *  - the coupon row is locked FOR UPDATE inside the order transaction and usedCount is
 *    incremented conditionally, so the global usage limit can never be exceeded
 *    (a DB CHECK constraint backs this up).
 */
import { prisma, Prisma, type Coupon } from '@20mart/database';
import { formatPaise, type AppliedCoupon, type CartLine } from '@20mart/shared';
import { AppError } from './errors';

type Db = Prisma.TransactionClient | typeof prisma;

export const COUPON_CODE_RE = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;
export const normaliseCode = (code: string) => code.trim().toUpperCase().replace(/\s+/g, '');

export type CouponFailure =
  | 'NOT_FOUND'
  | 'INACTIVE'
  | 'NOT_STARTED'
  | 'EXPIRED'
  | 'EXHAUSTED'
  | 'NOT_ISSUED'
  | 'ALREADY_USED'
  | 'MIN_ORDER'
  | 'NOT_ELIGIBLE'
  | 'EMPTY_CART';

export type CouponWithRules = Coupon & { products: { productId: string }[]; categories: { categoryId: string }[] };

export type CouponEvaluation =
  | { ok: true; coupon: CouponWithRules; discountPaise: number; eligibleSubtotalPaise: number }
  | { ok: false; coupon: CouponWithRules | null; reason: CouponFailure; message: string };

const rulesInclude = { products: { select: { productId: true } }, categories: { select: { categoryId: true } } } as const;

export async function findCouponByCode(code: string, db: Db = prisma): Promise<CouponWithRules | null> {
  const c = normaliseCode(code);
  if (!COUPON_CODE_RE.test(c)) return null;
  return db.coupon.findUnique({ where: { code: c }, include: rulesInclude });
}

/** Is the coupon switched on and inside its date window? */
export function couponIsLive(c: Pick<Coupon, 'isActive' | 'startsAt' | 'endsAt'>, now = new Date()) {
  return c.isActive && c.startsAt <= now && (!c.endsAt || c.endsAt > now);
}

/** Pure discount maths. FIXED never exceeds the eligible subtotal; PERCENT floors and honours the cap. */
export function computeDiscount(c: Pick<Coupon, 'discountType' | 'discountValue' | 'maxDiscountPaise'>, eligibleSubtotalPaise: number) {
  if (eligibleSubtotalPaise <= 0) return 0;
  let d = c.discountType === 'FIXED' ? c.discountValue : Math.floor((eligibleSubtotalPaise * c.discountValue) / 10_000);
  if (c.maxDiscountPaise != null) d = Math.min(d, c.maxDiscountPaise);
  return Math.max(0, Math.min(d, eligibleSubtotalPaise));
}

/** Purchasable lines this coupon applies to. No product/category rules = whole cart. */
export function eligibleLines(c: CouponWithRules, lines: CartLine[]) {
  const ok = lines.filter((l) => l.state === 'ok');
  if (!c.products.length && !c.categories.length) return ok;
  const pids = new Set(c.products.map((p) => p.productId));
  const cids = new Set(c.categories.map((x) => x.categoryId));
  return ok.filter((l) => pids.has(l.productId) || cids.has(l.categoryId));
}

const fail = (coupon: CouponWithRules | null, reason: CouponFailure, message: string): CouponEvaluation => ({ ok: false, coupon, reason, message });

/**
 * Full validation of a coupon for a customer's cart lines.
 * The subtotal used for the minimum-order rule is the purchasable cart subtotal (before discount).
 */
export async function evaluateCoupon(
  coupon: CouponWithRules | null,
  userId: string,
  lines: CartLine[],
  db: Db = prisma,
  now = new Date()
): Promise<CouponEvaluation> {
  if (!coupon) return fail(null, 'NOT_FOUND', 'This coupon code is not valid');
  if (!coupon.isActive) return fail(coupon, 'INACTIVE', 'This coupon is not active');
  if (coupon.startsAt > now) return fail(coupon, 'NOT_STARTED', 'This coupon is not active yet');
  if (coupon.endsAt && coupon.endsAt <= now) return fail(coupon, 'EXPIRED', 'This coupon has expired');
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return fail(coupon, 'EXHAUSTED', 'This coupon has reached its usage limit');
  if (coupon.requiresGrant) {
    const grant = await db.couponGrant.findUnique({ where: { couponId_userId: { couponId: coupon.id, userId } }, select: { id: true } });
    if (!grant) return fail(coupon, 'NOT_ISSUED', 'This coupon is not available on your account');
  }
  const used = await db.couponRedemption.count({ where: { couponId: coupon.id, userId, status: 'APPLIED' } });
  if (used >= coupon.perCustomerLimit) {
    return fail(coupon, 'ALREADY_USED', coupon.perCustomerLimit === 1 ? 'You have already used this coupon' : `You have used this coupon ${used} times (limit ${coupon.perCustomerLimit})`);
  }
  const subtotal = lines.filter((l) => l.state === 'ok').reduce((a, l) => a + l.lineTotalPaise, 0);
  if (subtotal <= 0) return fail(coupon, 'EMPTY_CART', 'Add items to your cart to use this coupon');
  if (subtotal < coupon.minOrderValuePaise) {
    return fail(coupon, 'MIN_ORDER', `Add ${formatPaise(coupon.minOrderValuePaise - subtotal)} more to use this coupon (minimum ${formatPaise(coupon.minOrderValuePaise)})`);
  }
  const eligible = eligibleLines(coupon, lines);
  const eligibleSubtotal = eligible.reduce((a, l) => a + l.lineTotalPaise, 0);
  if (eligibleSubtotal <= 0) return fail(coupon, 'NOT_ELIGIBLE', 'This coupon does not apply to the items in your cart');
  const discountPaise = computeDiscount(coupon, eligibleSubtotal);
  if (discountPaise <= 0) return fail(coupon, 'NOT_ELIGIBLE', 'This coupon does not apply to the items in your cart');
  return { ok: true, coupon, discountPaise, eligibleSubtotalPaise: eligibleSubtotal };
}

/** Customer-facing view of a coupon applied to a cart. */
export function appliedCouponView(code: string, ev: CouponEvaluation): AppliedCoupon {
  return ev.ok
    ? { code: ev.coupon.code, title: ev.coupon.title, discountPaise: ev.discountPaise, valid: true, message: null }
    : { code: ev.coupon?.code ?? normaliseCode(code), title: ev.coupon?.title ?? '', discountPaise: 0, valid: false, message: ev.message };
}

/** Evaluate the coupon code stored on a cart (if any) for a signed-in customer. */
export async function evaluateCartCoupon(code: string | null, userId: string | null, lines: CartLine[]) {
  if (!code || !userId) return null;
  const coupon = await findCouponByCode(code);
  const ev = await evaluateCoupon(coupon, userId, lines);
  return appliedCouponView(code, ev);
}

/* ───────────────────────────── Order-time redemption ───────────────────────────── */

/**
 * Lock the coupon row and re-validate it inside the order transaction.
 * Throws 409 COUPON_INVALID when it no longer applies — the customer must see that
 * rather than silently paying more than they were shown.
 */
export async function lockAndEvaluateCoupon(tx: Prisma.TransactionClient, code: string, userId: string, lines: CartLine[]) {
  const c = normaliseCode(code);
  const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Coupon" WHERE "code" = ${c} FOR UPDATE`;
  const coupon = locked.length ? await tx.coupon.findUnique({ where: { id: locked[0].id }, include: rulesInclude }) : null;
  const ev = await evaluateCoupon(coupon, userId, lines, tx);
  if (!ev.ok) throw new AppError(409, 'COUPON_INVALID', `Coupon ${c}: ${ev.message}. Remove it to continue.`, { reason: ev.reason });
  return ev;
}

/** Record the redemption and consume one use. Must run in the same transaction as lockAndEvaluateCoupon. */
export async function recordRedemption(tx: Prisma.TransactionClient, couponId: string, userId: string, orderId: string, discountPaise: number) {
  const n = await tx.$executeRaw`
    UPDATE "Coupon" SET "usedCount" = "usedCount" + 1, "updatedAt" = (now() AT TIME ZONE 'UTC')
     WHERE "id" = ${couponId} AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")`;
  if (n !== 1) throw new AppError(409, 'COUPON_INVALID', 'This coupon has just reached its usage limit. Remove it to continue.', { reason: 'EXHAUSTED' });
  await tx.couponRedemption.create({ data: { couponId, userId, orderId, discountPaise } });
}

/**
 * Give the coupon use back when an order is cancelled or fails. Idempotent: only an
 * APPLIED redemption flips to REVERSED, and only then is usedCount decremented.
 */
export async function reverseRedemption(tx: Prisma.TransactionClient, orderId: string) {
  const r = await tx.couponRedemption.findUnique({ where: { orderId }, select: { id: true, couponId: true } });
  if (!r) return false;
  const n = await tx.couponRedemption.updateMany({ where: { id: r.id, status: 'APPLIED' }, data: { status: 'REVERSED', reversedAt: new Date() } });
  if (!n.count) return false;
  await tx.$executeRaw`UPDATE "Coupon" SET "usedCount" = GREATEST("usedCount" - 1, 0), "updatedAt" = (now() AT TIME ZONE 'UTC') WHERE "id" = ${r.couponId}`;
  return true;
}
