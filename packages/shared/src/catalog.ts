/**
 * Catalog DTOs shared by storefront/admin and money helpers.
 * Money is always integer paise. Never do float arithmetic on prices.
 */

export type StockState = 'IN_STOCK' | 'LOW' | 'OUT';

/** Lean product shape exposed to the public storefront. */
export interface StorefrontProduct {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  sellingPricePaise: number;
  mrpPaise: number;
  discountPercent: number;
  brand: { name: string; slug: string } | null;
  category: { name: string; slug: string };
  image: { url: string; alt: string } | null;
  stockState: StockState;
  isFeatured: boolean;
}

export interface StorefrontVariant {
  id: string;
  name: string;
  sellingPricePaise: number;
  mrpPaise: number;
  stockState: StockState;
}

export interface StorefrontProductDetail extends StorefrontProduct {
  description: string | null;
  sku: string;
  images: { url: string; alt: string }[];
  variants: StorefrontVariant[];
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface StorefrontCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  productCount: number;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** ₹ formatting from paise. 2000 → "₹20", 2050 → "₹20.50". */
export function formatPaise(paise: number): string {
  if (!Number.isInteger(paise)) throw new Error('paise must be an integer');
  const neg = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rem = abs % 100;
  const r = rupees.toLocaleString('en-IN');
  return `${neg ? '-' : ''}₹${rem ? `${r}.${String(rem).padStart(2, '0')}` : r}`;
}

/**
 * Parse a rupee string ("20", "20.5", "20.50", "₹1,299") into integer paise
 * using string arithmetic only. Returns null when invalid.
 */
export function parseRupeesToPaise(input: string | number): number | null {
  const s = String(input).replace(/[₹,\s]/g, '');
  const m = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const whole = parseInt(m[1], 10);
  const frac = m[2] ? parseInt(m[2].padEnd(2, '0'), 10) : 0;
  return whole * 100 + frac;
}

/** Paise → editable rupee string ("2050" → "20.50", "2000" → "20"). */
export function paiseToRupeeInput(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const rem = paise % 100;
  return rem ? `${rupees}.${String(rem).padStart(2, '0')}` : String(rupees);
}

export function discountPercent(sellingPaise: number, mrpPaise: number): number {
  if (mrpPaise <= 0 || sellingPaise >= mrpPaise) return 0;
  return Math.floor(((mrpPaise - sellingPaise) * 100) / mrpPaise);
}

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SKU_REGEX = /^[A-Z0-9][A-Z0-9-_]{1,39}$/;

export function stockStateOf(sellable: number, lowThreshold: number): StockState {
  if (sellable <= 0) return 'OUT';
  if (sellable <= lowThreshold) return 'LOW';
  return 'IN_STOCK';
}
