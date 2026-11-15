import { getCart } from './cart';
import { listAddresses } from './addresses';
import { quoteDelivery } from './delivery';
import { enabledPaymentMethods, getStoreSettings } from './settings';

/**
 * Everything the checkout page needs, computed on the server:
 * re-priced cart, saved addresses, delivery quote for the chosen address,
 * payment methods that are actually enabled, and blocking issues.
 */
export async function getCheckoutSummary(userId: string, addressId?: string | null) {
  const settings = await getStoreSettings();
  const [cart, addresses] = await Promise.all([getCart({ userId }), listAddresses(userId)]);
  const selected = addresses.find((a) => a.id === addressId) ?? addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
  const quote = await quoteDelivery(cart.subtotalPaise, selected?.pincode ?? null, settings);
  const paymentMethods = enabledPaymentMethods(settings);
  const blockers = [...quote.blockers];
  if (!cart.lines.length) blockers.unshift('Your cart is empty');
  if (cart.hasIssues) blockers.push('Some items in your cart need attention');
  if (!selected) blockers.push('Add a delivery address');
  if (!paymentMethods.length) blockers.push('Ordering is temporarily unavailable — no payment method is enabled');
  return {
    cart,
    addresses,
    selectedAddressId: selected?.id ?? null,
    delivery: quote,
    totalPaise: cart.subtotalPaise + quote.deliveryChargePaise,
    paymentMethods,
    blockers,
    canPlaceOrder: blockers.length === 0,
  };
}
