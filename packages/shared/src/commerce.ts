/** Cart / order DTOs shared by the storefront client and the server services. All money is integer paise. */

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
  /** Max quantity allowed right now (min of stock and per-line cap). */
  maxQty: number;
  state: CartLineState;
  priceChanged: boolean;
  message: string | null;
}

export interface CartView {
  id: string | null;
  lines: CartLine[];
  totalQuantity: number;
  /** Subtotal of purchasable lines only; computed on the server. */
  subtotalPaise: number;
  hasIssues: boolean;
  maxQtyPerLine: number;
}

export const EMPTY_CART: CartView = { id: null, lines: [], totalQuantity: 0, subtotalPaise: 0, hasIssues: false, maxQtyPerLine: 10 };

export interface SavedAddress {
  id: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  type: string;
  isDefault: boolean;
}

export type OrderStatusCode =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'PACKED'
  | 'READY_FOR_DISPATCH'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED'
  | 'REFUNDED';

export type PaymentStatusCode = 'PENDING' | 'PAID' | 'FAILED' | 'REFUND_PENDING' | 'PARTIALLY_REFUNDED' | 'REFUNDED';

/** Customer-facing fulfilment steps (the timeline shown in tracking). */
export const FULFILMENT_STEPS: { status: OrderStatusCode; label: string }[] = [
  { status: 'PENDING', label: 'Order placed' },
  { status: 'CONFIRMED', label: 'Confirmed' },
  { status: 'PROCESSING', label: 'Processing' },
  { status: 'PACKED', label: 'Packed' },
  { status: 'READY_FOR_DISPATCH', label: 'Ready for dispatch' },
  { status: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { status: 'DELIVERED', label: 'Delivered' },
];

export const PAYMENT_STATUS_LABEL: Record<PaymentStatusCode, string> = {
  PENDING: 'Payment pending',
  PAID: 'Paid',
  FAILED: 'Payment failed',
  REFUND_PENDING: 'Refund in progress',
  PARTIALLY_REFUNDED: 'Partially refunded',
  REFUNDED: 'Refunded',
};

export const INDIAN_STATE_NAMES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
] as const;
