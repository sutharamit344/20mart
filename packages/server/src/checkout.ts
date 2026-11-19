import { evaluateCart, findCartId, summarise, summariseLines } from './cart';
import { listAddresses } from './addresses';
import { quoteDelivery } from './delivery';
import { enabledPaymentMethods, getStoreSettings } from './settings';
import { istDay, trackServerEvents, type AnalyticsCaller } from './tracking/events';

/**
 * Everything the checkout page needs, computed on the server:
 * cart re-priced and checked against the warehouse that would ship to the chosen address,
 * saved addresses, delivery quote, payment methods that are actually enabled, and blockers.
 */
export async function getCheckoutSummary(userId: string, addressId?: string | null, analytics: AnalyticsCaller = null) {
  const settings = await getStoreSettings();
  const [cartId, addresses] = await Promise.all([findCartId({ userId }), listAddresses(userId)]);
  const selected = addresses.find((a) => a.id === addressId) ?? addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
  const evaluation = cartId ? await evaluateCart(cartId, { pincode: selected?.pincode ?? null }) : null;
  const cart = cartId && evaluation ? await summariseLines(cartId, evaluation.lines) : summarise(null, [], settings.maxQtyPerLine);
  const quote = await quoteDelivery(cart.subtotalPaise, selected?.pincode ?? null, settings, evaluation?.warehouse ?? null);
  const paymentMethods = enabledPaymentMethods(settings);
  const blockers = [...quote.blockers];
  if (!cart.lines.length) blockers.unshift('Your cart is empty');
  if (cart.hasIssues) {
    // Name each item so the customer knows exactly what to change (or picks another address).
    for (const l of cart.lines.filter((x) => x.state !== 'ok')) blockers.push(`${l.name}${l.variantName ? ` (${l.variantName})` : ''}: ${l.message ?? 'needs attention'}`);
  }
  else if (cart.lines.length && quote.serviceability?.serviceable && !evaluation?.warehouse) {
    blockers.push('Some items cannot be delivered together to this address');
  }
  if (!selected) blockers.push('Add a delivery address');
  if (cart.coupon && !cart.coupon.valid) blockers.push(`Coupon ${cart.coupon.code}: ${cart.coupon.message ?? 'not valid'} — remove it to continue`);
  if (!paymentMethods.length) blockers.push('Ordering is temporarily unavailable — no payment method is enabled');
  // CHECKOUT_STARTED: the customer reached checkout with a non-empty cart. Reloads, address changes
  // and retries on the same day count once per cart.
  if (cartId && cart.lines.length) {
    const day = istDay();
    trackServerEvents(analytics, () => [
      {
        name: 'CHECKOUT_STARTED',
        cartId,
        warehouseId: evaluation?.warehouse?.id,
        pincode: selected?.pincode ?? undefined,
        quantity: cart.totalQuantity,
        metadata: { lines: cart.lines.length, subtotalPaise: cart.subtotalPaise, canPlaceOrder: blockers.length === 0, blockers: blockers.length },
        dedupeKey: `${cartId}:${day}`,
      },
    ]);
  }
  return {
    cart,
    addresses,
    selectedAddressId: selected?.id ?? null,
    delivery: quote,
    discountPaise: cart.discountPaise,
    totalPaise: cart.subtotalPaise + quote.deliveryChargePaise - cart.discountPaise,
    paymentMethods,
    blockers,
    canPlaceOrder: blockers.length === 0,
  };
}
