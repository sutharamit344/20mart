/**
 * Analytics constants shared by the storefront browser code and the server.
 * Nothing here is trusted on its own: the server re-validates every value.
 */

/** Consent cookie (readable by the page so it can skip sending events). Value: `<version>.<granted|denied>`. */
export const CONSENT_COOKIE = '20m_consent';

/** Events a browser may send. Everything else is recorded only by the server. */
export const CLIENT_EVENT_NAMES = [
  'APP_OPENED',
  'HOME_VIEWED',
  'CATEGORY_VIEWED',
  'PRODUCT_VIEWED',
  'PRODUCT_SEARCHED',
  'CART_VIEWED',
  'PRODUCT_UNAVAILABLE_VIEWED',
] as const;
export type ClientEventName = (typeof CLIENT_EVENT_NAMES)[number];

/** Events recorded by server code paths (cart, checkout, orders, payments). */
export const SERVER_EVENT_NAMES = [
  'CART_ITEM_ADDED',
  'CART_ITEM_REMOVED',
  'CHECKOUT_STARTED',
  'PURCHASE_COMPLETED',
  'OUT_OF_STOCK_ADD_ATTEMPT',
  'WISHLIST_ADDED',
  'DELIVERY_CHECKED',
  'COUPON_APPLIED',
  'ORDER_CANCELLED',
  'REFUND_PROCESSED',
] as const;
export type ServerEventName = (typeof SERVER_EVENT_NAMES)[number];

/** Max events per browser batch. */
export const MAX_CLIENT_EVENT_BATCH = 20;

export type ConsentState = 'granted' | 'denied' | 'unset';

/** Parse the consent cookie; a decision made under an older consent version counts as unset. */
export function parseConsent(raw: string | null | undefined, currentVersion: number): ConsentState {
  const m = /^(\d{1,4})\.(granted|denied)$/.exec(raw ?? '');
  if (!m || Number(m[1]) !== currentVersion) return 'unset';
  return m[2] as 'granted' | 'denied';
}
