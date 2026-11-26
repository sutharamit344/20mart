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
      <button type="button" onClick={openPicker} className="inline-flex items-center gap-1 text-xs font-semibold text-[#C25D00] hover:underline cursor-pointer">
        <MapPin className="w-3.5 h-3.5" /> Enter your PIN code to check delivery
      </button>
    );
  }
  const change = (
    <button type="button" onClick={openPicker} className="font-bold text-[#C25D00] hover:underline cursor-pointer">
      Change
    </button>
  );
  if (!serviceability?.serviceable) {
    return (
      <span className="text-xs text-red-600">
        {serviceability?.reason ?? 'We do not deliver here yet'} ({pincode}). {change}
      </span>
    );
  }
  if (deliverable === false) {
    return (
      <span className="text-xs text-red-600">
        Not available for delivery to {label}. {change}
      </span>
    );
  }
  return (
    <span className="text-xs text-gray-600">
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-2 pb-8 sm:pt-2.5 sm:pb-10">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: product.category.name, href: `/category/${product.category.slug}` },
          { label: product.name },
        ]}
        className="mb-2 sm:mb-2.5"
      />

      <div className="mt-1.5 sm:mt-2 grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-8 bg-white rounded-2xl border border-gray-100 p-3.5 sm:p-5 lg:p-6 shadow-xs">
        <div className="md:col-span-5 flex justify-center">
          <div className="w-full max-w-[340px] sm:max-w-[380px] lg:max-w-[400px]">
            <ProductGallery images={images} alts={product.images.map((i) => i.alt)} productName={product.name} />
          </div>
        </div>

        <div className="md:col-span-7 flex flex-col justify-between space-y-4 min-w-0">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs text-gray-400">
              <span className="font-semibold text-brand-green uppercase tracking-wider truncate">
                {product.brand ? product.brand.name : product.category.name}
              </span>
              <span className="shrink-0">SKU: {product.sku}</span>
            </div>

            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 leading-snug break-words">{product.name}</h1>

            <div className="flex flex-wrap items-center gap-2">
              {outOfStock ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-50 text-red-700 text-xs font-bold">Out of stock</span>
              ) : stockState === 'LOW' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 text-xs font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Only a few left
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  In stock
                </span>
              )}
              <DeliveryInfo deliverable={avail ? !outOfStock : null} />
              {/* Demand signal: the shopper saw this item (or option) as unavailable for their delivery
                  location. Only from live location availability (already fetched above), never from
                  the cached page; the server re-verifies it. Consent-only. */}
              {avail && outOfStock && <TrackView name="PRODUCT_UNAVAILABLE_VIEWED" productId={product.id} variantId={variant?.id} />}
            </div>

            <div className="flex items-baseline gap-2 pt-0.5 flex-wrap">
              <span className="text-xl sm:text-2xl font-black text-gray-900">{formatPaise(price)}</span>
              {mrp > price && (
                <>
                  <span className="text-sm text-gray-400 line-through">{formatPaise(mrp)}</span>
                  <span className="rounded-md bg-brand-cream border border-orange-100 px-1.5 py-0.5 text-xs font-bold text-brand-orange">Save {discount}%</span>
                </>
              )}
              <span className="text-[11px] text-gray-400">Inclusive of all taxes</span>
            </div>

            {product.variants.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-900">Choose option</p>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Product options">
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
                      className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        v.id === variantId ? 'border-brand-orange bg-orange-50 text-brand-orange-600' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      } ${v.stockState === 'OUT' ? 'opacity-50 line-through' : ''}`}
                    >
                      {v.name} · {formatPaise(v.sellingPricePaise)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(product.description || product.shortDescription) && (
              <p className="text-xs sm:text-sm text-gray-600 leading-relaxed whitespace-pre-line break-words">
                {product.description || product.shortDescription}
              </p>
            )}
          </div>

          <div className="space-y-2.5 pt-3 border-t border-gray-100">
            <div ref={mainActionsRef} className="flex items-center gap-2 sm:gap-2.5">
              {!inCart && (
              <div className="flex shrink-0 items-center rounded-xl border border-gray-200 bg-gray-50 p-0.5">
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  disabled={quantity <= 1 || outOfStock}
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-white transition-all disabled:opacity-40 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-9 text-center text-xs font-bold text-gray-900" aria-live="polite">
                  {quantity}
                </span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  disabled={quantity >= MAX_QTY || outOfStock}
                  onClick={() => setQuantity(Math.min(MAX_QTY, quantity + 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-white transition-all disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              )}

              {inCart ? (
                <Link
                  href="/cart"
                  className="flex-1 min-w-0 flex items-center justify-center gap-2 font-black rounded-xl text-xs sm:text-sm shadow-md shadow-emerald-950/20 bg-brand-green hover:bg-brand-green-hover text-white active:scale-[0.98] transition-all py-2.5"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Go to Cart <span className="font-semibold opacity-80">({inCartQty} in cart)</span>
                </Link>
              ) : (
              <button
                type="button"
                onClick={add}
                disabled={outOfStock}
                className="flex-1 min-w-0 flex items-center justify-center gap-2 font-black rounded-xl text-xs sm:text-sm shadow-md shadow-orange-950/20 bg-gradient-to-r from-brand-orange to-[#FF5500] hover:from-[#FF8A00] hover:to-[#FF6600] text-white hover:scale-[1.01] active:scale-[0.98] transition-all py-2.5 cursor-pointer disabled:from-gray-300 disabled:to-gray-300 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {outOfStock ? 'Out of stock' : 'Add to Cart'}
              </button>
              )}

              <button
                type="button"
                aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                aria-pressed={wishlisted}
                onClick={() => toggleWishlist(product.id)}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all cursor-pointer ${
                  wishlisted ? 'border-red-200 bg-red-50 text-red-500' : 'border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Heart className={`w-4 h-4 ${wishlisted ? 'fill-current' : ''}`} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-emerald-50/70 border border-emerald-100">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-green shrink-0" />
                <span className="text-[10px] font-bold text-emerald-950">Quality checked</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-amber-50/70 border border-amber-100">
                <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="text-[10px] font-bold text-amber-950">Value for money</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-blue-50/70 border border-blue-100">
                <Truck className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                <span className="text-[10px] font-bold text-blue-950">Home delivery</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky mobile add-to-cart bar */}
      <div
        className={`fixed bottom-14 inset-x-0 z-30 block md:hidden transition-all duration-300 transform ${
          isStickyVisible ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-white/95 backdrop-blur-md border-t border-gray-200/90 px-4 py-2.5 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block leading-none mb-1">Total price</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-black text-gray-900 leading-none">{formatPaise(price * quantity)}</span>
                {mrp > price && <span className="text-xs text-gray-400 line-through">{formatPaise(mrp * quantity)}</span>}
              </div>
            </div>
            {inCart ? (
              <Link
                href="/cart"
                className="flex-1 max-w-[200px] h-10 px-4 rounded-xl bg-brand-green text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-950/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Go to Cart</span>
              </Link>
            ) : (
            <button
              type="button"
              onClick={add}
              disabled={outOfStock}
              className="flex-1 max-w-[200px] h-10 px-4 rounded-xl bg-gradient-to-r from-brand-orange to-[#FF5500] text-white font-black text-xs sm:text-sm shadow-md shadow-orange-950/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:from-gray-300 disabled:to-gray-300 disabled:shadow-none"
            >
              {outOfStock ? (
                'Out of stock'
              ) : (
                <>
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>Add to Cart</span>
                </>
              )}
            </button>
            )}
          </div>
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <section className="mt-6 sm:mt-8 space-y-2.5">
          <h2 className="text-base sm:text-lg font-bold text-gray-900">Similar everyday essentials</h2>
          <ProductGrid products={relatedProducts} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 min-[960px]:grid-cols-5 gap-2 sm:gap-2.5" />
        </section>
      )}
    </div>
  );
};
