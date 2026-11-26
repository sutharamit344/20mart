'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ProductGallery, Breadcrumb } from '@20mart/ui';
import { discountPercent, formatPaise, type StorefrontProduct, type StorefrontProductDetail } from '@20mart/shared';
import { ShieldCheck, Truck, Heart, Plus, Minus, Sparkles, ShoppingCart } from 'lucide-react';
import { useStore } from '../lib/store';
import { useLocation, useProductAvailability } from '../lib/location';
import { ProductGrid } from './StoreProductCard';
import { MapPin } from 'lucide-react';
import { TrackView } from './TrackView';

/** Location-aware delivery line: no promise is shown unless the selected PIN is actually served. */
function DeliveryInfo({ deliverable }: { deliverable: boolean | null }) {
  const { ready, pincode, serviceability, label, openPicker } = useLocation();
  if (!ready) return null;
  if (!pincode) {
    return (
      <button type="button" onClick={openPicker} className="inline-flex items-center gap-1 text-sm font-medium text-brand-orange-700 hover:underline cursor-pointer">
        <MapPin className="w-3.5 h-3.5" /> Enter your PIN code to check delivery
      </button>
    );
  }
  const change = (
    <button type="button" onClick={openPicker} className="font-semibold text-brand-orange-700 hover:underline cursor-pointer">
      Change
    </button>
  );
  if (!serviceability?.serviceable) {
    return (
      <span className="text-sm text-danger">
        {serviceability?.reason ?? 'We do not deliver here yet'} ({pincode}). {change}
      </span>
    );
  }
  if (deliverable === false) {
    return (
      <span className="text-sm text-danger">
        Not available for delivery to {label}. {change}
      </span>
    );
  }
  return (
    <span className="text-sm text-ink-600">
      {serviceability.estimateText ? `${serviceability.estimateText} to ${label}.` : `Delivers to ${label}.`} {change}
    </span>
  );
}

interface ProductDetailViewProps {
  product: StorefrontProductDetail;
  relatedProducts: StorefrontProduct[];
}

const MAX_QTY = 10;

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({ product, relatedProducts }) => {
  const { cart, addToCart, toggleWishlist, isWishlisted, cartBusy } = useStore();
  const [variantId, setVariantId] = useState<string | null>(
    product.variants.find((v) => v.stockState !== 'OUT')?.id ?? product.variants[0]?.id ?? null
  );
  const variant = product.variants.find((v) => v.id === variantId) ?? null;
  const price = variant?.sellingPricePaise ?? product.sellingPricePaise;
  const mrp = variant?.mrpPaise ?? product.mrpPaise;
  // At a served location, stock is that location's (best single warehouse); otherwise all active warehouses.
  const avail = useProductAvailability(product.id);
  const stockState = avail ? (variant ? (avail.variants[variant.id] ?? 'OUT') : avail.state) : (variant?.stockState ?? product.stockState);
  const outOfStock = stockState === 'OUT';
  const discount = discountPercent(price, mrp);
  // Quantity of this exact product + option already in the cart; once added, the CTA becomes "Go to Cart".
  const inCartQty = cart.lines
    .filter((l) => l.productId === product.id && (l.variantId ?? null) === (variant?.id ?? null))
    .reduce((a, l) => a + l.quantity, 0);
  const inCart = inCartQty > 0 && !outOfStock;

  const [quantity, setQuantity] = useState(1);
  const [isStickyVisible, setIsStickyVisible] = useState(false);
  const mainActionsRef = useRef<HTMLDivElement>(null);
  const wishlisted = isWishlisted(product.id);

  useEffect(() => {
    const handleScroll = () => {
      if (!mainActionsRef.current) return;
      setIsStickyVisible(mainActionsRef.current.getBoundingClientRect().bottom < 60);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // The server re-prices and checks stock; quantities above what is available are rejected with a clear message.
  const add = async () => {
    if (outOfStock || cartBusy) return;
    if (await addToCart(product.id, quantity, variant?.id ?? null)) setQuantity(1);
  };

  const images = product.images.length ? product.images.map((i) => i.url) : [];


  const qtyBtn =
    'flex h-full w-10 items-center justify-center text-ink-600 transition-colors hover:bg-surface-muted disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-orange/50';

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-3 sm:px-6 sm:pt-4">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: product.category.name, href: `/category/${product.category.slug}` },
          { label: product.name },
        ]}
        className="mb-3"
      />

      <div className="grid grid-cols-1 gap-5 rounded-2xl border border-line-subtle bg-surface p-3 sm:p-5 md:grid-cols-12 lg:gap-10 lg:p-6">
        <div className="md:col-span-6 lg:col-span-5">
          <div className="mx-auto w-full max-w-[480px] md:sticky md:top-24">
            <ProductGallery images={images} alts={product.images.map((i) => i.alt)} productName={product.name} />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4 md:col-span-6 lg:col-span-7">
          {/* Identity */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-2xs">
              <span className="truncate font-semibold uppercase tracking-wide text-brand-green">
                {product.brand ? product.brand.name : product.category.name}
              </span>
              <span className="shrink-0 text-ink-400">SKU {product.sku}</span>
            </div>
            <h1 className="break-words text-lg font-semibold leading-snug text-ink sm:text-xl lg:text-2xl">{product.name}</h1>
          </div>

          {/* Price */}
          <div className="space-y-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-2xl font-bold tabular-nums text-ink sm:text-[1.75rem]">{formatPaise(price)}</span>
              {mrp > price && (
                <>
                  <span className="text-sm tabular-nums text-ink-400">
                    MRP <span className="line-through">{formatPaise(mrp)}</span>
                  </span>
                  <span className="rounded-md bg-brand-orange-50 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-brand-orange-700 ring-1 ring-inset ring-brand-orange-200/70">
                    Save {discount}%
                  </span>
                </>
              )}
            </div>
            <p className="text-2xs text-ink-500">Inclusive of all taxes</p>
          </div>

          {/* Availability + delivery */}
          <div className="flex flex-col gap-1.5 rounded-xl bg-surface-page px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            {outOfStock ? (
              <span className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-danger">
                <span className="h-2 w-2 rounded-full bg-danger" aria-hidden />
                Out of stock
              </span>
            ) : stockState === 'LOW' ? (
              <span className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-warning">
                <span className="h-2 w-2 rounded-full bg-warning" aria-hidden />
                Only a few left
              </span>
            ) : (
              <span className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-success">
                <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
                In stock
              </span>
            )}
            <DeliveryInfo deliverable={avail ? !outOfStock : null} />
            {/* Demand signal: the shopper saw this item (or option) as unavailable for their delivery
                location. Only from live location availability (already fetched above), never from
                the cached page; the server re-verifies it. Consent-only. */}
            {avail && outOfStock && <TrackView name="PRODUCT_UNAVAILABLE_VIEWED" productId={product.id} variantId={variant?.id} />}
          </div>

          {product.variants.length > 0 && (
            <div className="space-y-2">
              <p className="text-2xs font-semibold uppercase tracking-wide text-ink-500">Choose option</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Product options">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    role="radio"
                    aria-checked={v.id === variantId}
                    onClick={() => {
                      setVariantId(v.id);
                      setQuantity(1);
                    }}
                    className={`min-h-10 rounded-xl border px-3.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 ${
                      v.id === variantId ? 'border-brand-orange bg-brand-orange-50 text-brand-orange-700' : 'border-line bg-surface text-ink-700 hover:border-line-strong'
                    } ${v.stockState === 'OUT' ? 'line-through opacity-50' : ''}`}
                  >
                    {v.name} · <span className="tabular-nums">{formatPaise(v.sellingPricePaise)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Purchase */}
          <div ref={mainActionsRef} className="flex items-center gap-2">
            {!inCart && (
              <div className="flex h-11 shrink-0 items-center overflow-hidden rounded-xl border border-line bg-surface">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={quantity <= 1 || outOfStock}
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className={qtyBtn}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center text-sm font-semibold tabular-nums text-ink" aria-live="polite">
                  {quantity}
                </span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  disabled={quantity >= MAX_QTY || outOfStock}
                  onClick={() => setQuantity(Math.min(MAX_QTY, quantity + 1))}
                  className={qtyBtn}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            )}

            {inCart ? (
              <Link
                href="/cart"
                className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-green px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-green-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40 focus-visible:ring-offset-2"
              >
                <ShoppingCart className="h-4 w-4" />
                Go to cart <span className="font-normal text-white/80">({inCartQty} in cart)</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={add}
                disabled={outOfStock}
                className="flex h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-orange px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-orange-600 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-400 disabled:shadow-none"
              >
                {outOfStock ? (
                  'Out of stock'
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4" /> Add to cart
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              aria-pressed={wishlisted}
              onClick={() => toggleWishlist(product.id)}
              className={`flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 ${
                wishlisted ? 'border-danger-line bg-danger-soft text-danger' : 'border-line bg-surface text-ink-500 hover:bg-surface-muted hover:text-ink-700'
              }`}
            >
              <Heart className={`h-5 w-5 ${wishlisted ? 'fill-current' : ''}`} />
            </button>
          </div>

          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-medium text-ink-600">
            <li className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 shrink-0 text-brand-green" aria-hidden /> Quality checked
            </li>
            <li className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 shrink-0 text-brand-green" aria-hidden /> Value for money
            </li>
            <li className="flex items-center gap-1.5">
              <Truck className="h-4 w-4 shrink-0 text-brand-green" aria-hidden /> Home delivery
            </li>
          </ul>

          {(product.description || product.shortDescription) && (
            <section className="border-t border-line-subtle pt-4" aria-labelledby="pd-desc">
              <h2 id="pd-desc" className="mb-1.5 text-sm font-semibold text-ink">
                About this product
              </h2>
              <p className="whitespace-pre-line break-words text-sm leading-relaxed text-ink-600">
                {product.description || product.shortDescription}
              </p>
            </section>
          )}
        </div>
      </div>

      {/* Sticky mobile purchase bar (sits on top of the bottom navigation) */}
      <div
        data-mobile-action-bar
        className={`fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 block transition-[transform,opacity] duration-200 md:hidden ${
          isStickyVisible ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0'
        }`}
        aria-hidden={!isStickyVisible}
      >
        <div className="border-t border-line bg-surface/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-surface/90">
          <div className="mx-auto flex max-w-md items-center justify-between gap-3">
            <div className="min-w-0 leading-tight">
              <span className="block text-2xs text-ink-500">{quantity > 1 && !inCart ? `${quantity} × ${formatPaise(price)}` : 'Price'}</span>
              <span className="flex items-baseline gap-1.5">
                <span className="text-base font-bold tabular-nums text-ink">{formatPaise(price * quantity)}</span>
                {mrp > price && <span className="text-xs tabular-nums text-ink-400 line-through">{formatPaise(mrp * quantity)}</span>}
              </span>
            </div>
            {inCart ? (
              <Link
                href="/cart"
                tabIndex={isStickyVisible ? 0 : -1}
                className="flex h-11 max-w-[200px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-green px-4 text-sm font-semibold text-white"
              >
                <ShoppingCart className="h-4 w-4" />
                Go to cart
              </Link>
            ) : (
              <button
                type="button"
                onClick={add}
                disabled={outOfStock}
                tabIndex={isStickyVisible ? 0 : -1}
                className="flex h-11 max-w-[200px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-brand-orange px-4 text-sm font-semibold text-white shadow-sm active:scale-[0.98] disabled:bg-surface-muted disabled:text-ink-400 disabled:shadow-none"
              >
                {outOfStock ? (
                  'Out of stock'
                ) : (
                  <>
                    <Plus className="h-4 w-4 stroke-[2.5]" /> Add to cart
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <section className="mt-8 sm:mt-10" aria-labelledby="related-title">
          <h2 id="related-title" className="mb-3 text-base font-semibold text-ink sm:text-lg">
            Similar everyday essentials
          </h2>
          <ProductGrid products={relatedProducts} className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 min-[960px]:grid-cols-5" />
        </section>
      )}
    </div>
  );
};
