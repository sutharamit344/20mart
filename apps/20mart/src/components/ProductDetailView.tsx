'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Product } from '@20mart/shared';
import { ProductGallery, Breadcrumb, ProductCard } from '@20mart/ui';
import { useStore } from '../lib/store';
import {
  Star,
  ShieldCheck,
  Truck,
  Heart,
  Check,
  Plus,
  Minus,
  Sparkles,
} from 'lucide-react';

interface ProductDetailViewProps {
  product: Product;
  relatedProducts: Product[];
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  product,
  relatedProducts,
}) => {
  const router = useRouter();
  const { addToCart, toggleWishlist, isWishlisted, getItemQuantity, updateItemQuantity } = useStore();

  const [quantity, setQuantity] = useState(1);
  const [isStickyVisible, setIsStickyVisible] = useState(false);
  const mainActionsRef = useRef<HTMLDivElement>(null);
  const wishlisted = isWishlisted(product.id);

  useEffect(() => {
    const handleScroll = () => {
      if (!mainActionsRef.current) return;
      const rect = mainActionsRef.current.getBoundingClientRect();
      if (rect.bottom < 60) {
        setIsStickyVisible(true);
      } else {
        setIsStickyVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-2 pb-8 sm:pt-2.5 sm:pb-10">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: product.category, href: `/category/${product.categorySlug}` },
          { label: product.name },
        ]}
        className="mb-2 sm:mb-2.5"
      />

      {/* Main Product Section (Screen 04) */}
      <div className="mt-1.5 sm:mt-2 grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-8 bg-white rounded-2xl border border-gray-100 p-3.5 sm:p-5 lg:p-6 shadow-xs">
        {/* Gallery Column */}
        <div className="md:col-span-5 lg:col-span-5 flex justify-center">
          <div className="w-full max-w-[340px] sm:max-w-[380px] lg:max-w-[400px]">
            <ProductGallery
              images={product.images}
              productName={product.name}
            />
          </div>
        </div>

        {/* Product Details Column */}
        <div className="md:col-span-7 lg:col-span-7 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            {/* Category & SKU */}
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span className="font-semibold text-[#0B5D3B] uppercase tracking-wider">
                {product.category}
              </span>
              <span>SKU: {product.sku}</span>
            </div>

            {/* Title */}
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 leading-snug">
              {product.name}
            </h1>

            {/* Rating & In-stock row */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-900 text-xs font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                <span>{product.rating}</span>
                <span className="text-gray-400 font-normal">({product.reviewCount} reviews)</span>
              </div>

              {product.inStock ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>In Stock</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-50 text-red-700 text-xs font-bold">
                  <span>Out of Stock</span>
                </span>
              )}

              <span className="text-xs text-gray-500">{product.deliveryInfo}</span>
            </div>

            {/* Pricing */}
            <div className="flex items-baseline gap-2 pt-0.5">
              <span className="text-xl sm:text-2xl font-black text-gray-900">
                ₹{product.price}
              </span>
              {product.originalPrice > product.price && (
                <>
                  <span className="text-sm text-gray-400 line-through">
                    ₹{product.originalPrice}
                  </span>
                  <span className="rounded-md bg-[#FFF6E9] border border-orange-100 px-1.5 py-0.5 text-xs font-bold text-[#FF7A00]">
                    Save {product.discountPercent}%
                  </span>
                </>
              )}
            </div>

            {/* Description */}
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{product.description}</p>

            {/* Highlights */}
            {product.features && product.features.length > 0 && (
              <div className="space-y-1.5 pt-0.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-900">
                  Key Features
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {product.features.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-gray-700">
                      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[#0B5D3B]">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quantity Selector and CTA Actions */}
          <div className="space-y-2.5 pt-3 border-t border-gray-100">
            <div ref={mainActionsRef} className="flex flex-wrap items-center gap-2.5">
              {/* Stepper */}
              <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50 p-0.5">
                <button
                  type="button"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-white transition-all disabled:opacity-40 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-9 text-center text-xs font-bold text-gray-900">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-white transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Add to Cart Button */}
              <button
                type="button"
                onClick={() => addToCart(product, quantity)}
                className="flex-1 flex items-center justify-center gap-2 font-black rounded-xl text-xs sm:text-sm shadow-md shadow-orange-950/20 bg-gradient-to-r from-[#FF7A00] to-[#FF5500] hover:from-[#FF8A00] hover:to-[#FF6600] text-white hover:scale-[1.01] active:scale-[0.98] transition-all py-2.5 cursor-pointer"
              >
                <span>Add to Cart</span>
              </button>

              {/* Wishlist Button */}
              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-all cursor-pointer ${
                  wishlisted
                    ? 'border-red-200 bg-red-50 text-red-500'
                    : 'border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Heart className={`w-4 h-4 ${wishlisted ? 'fill-current' : ''}`} />
              </button>
            </div>

            {/* Value Guarantees row */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-emerald-50/70 border border-emerald-100 text-center sm:text-left">
                <ShieldCheck className="w-3.5 h-3.5 text-[#0B5D3B] shrink-0" />
                <span className="text-[10px] font-bold text-emerald-950">Great Quality</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-amber-50/70 border border-amber-100 text-center sm:text-left">
                <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="text-[10px] font-bold text-amber-950">Value for Money</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-blue-50/70 border border-blue-100 text-center sm:text-left">
                <Truck className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                <span className="text-[10px] font-bold text-blue-950">Home Delivery</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Mobile Add To Cart Bar */}
      <div
        className={`fixed bottom-14 inset-x-0 z-30 block md:hidden transition-all duration-300 transform ${
          isStickyVisible
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="bg-white/95 backdrop-blur-md border-t border-gray-200/90 px-4 py-2.5 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block leading-none mb-1">
                Total Price
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-black text-gray-900 leading-none">
                  ₹{product.price * quantity}
                </span>
                {product.originalPrice > product.price && (
                  <span className="text-xs text-gray-400 line-through">
                    ₹{product.originalPrice * quantity}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => addToCart(product, quantity)}
              className="flex-1 max-w-[200px] h-10 px-4 rounded-xl bg-gradient-to-r from-[#FF7A00] to-[#FF5500] hover:from-[#FF8A00] hover:to-[#FF6600] text-white font-black text-xs sm:text-sm shadow-md shadow-orange-950/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Add to Cart</span>
            </button>
          </div>
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="mt-6 sm:mt-8 space-y-2.5">
          <h2 className="text-base sm:text-lg font-bold text-gray-900">Similar Everyday Essentials</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 min-[960px]:grid-cols-5 lg:grid-cols-5 xl:grid-cols-5 gap-2 sm:gap-2.5">
            {relatedProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                quantity={getItemQuantity(p.id)}
                isWishlisted={isWishlisted(p.id)}
                onAddToCart={() => updateItemQuantity(p.id, 1)}
                onIncrement={() => updateItemQuantity(p.id, 1)}
                onDecrement={() => updateItemQuantity(p.id, -1)}
                onToggleWishlist={() => toggleWishlist(p.id)}
                onClick={() => router.push(`/product/${p.slug}`)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
