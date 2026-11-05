'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  mockProducts,
  Product,
} from '@20mart/shared';
import {
  ProductGallery,
  Breadcrumb,
  Button,
  Badge,
  ProductCard,
} from '@20mart/ui';
import { useStore } from '../../../lib/store';
import {
  Star,
  ShieldCheck,
  Truck,
  RotateCcw,
  Heart,
  Share2,
  Check,
  Plus,
  Minus,
  Sparkles,
} from 'lucide-react';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const { addToCart, toggleWishlist, isWishlisted } = useStore();

  const product =
    mockProducts.find((p) => p.slug === slug) ||
    mockProducts.find((p) => p.id === slug) ||
    mockProducts[0];

  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(product.variants?.[0]?.id || '');
  const wishlisted = isWishlisted(product.id);

  const relatedProducts = mockProducts
    .filter((p) => p.id !== product.id && p.categorySlug === product.categorySlug)
    .slice(0, 4);

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-10">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: product.category, href: `/category/${product.categorySlug}` },
          { label: product.name },
        ]}
      />

      {/* Main Product Section (Screen 04) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 bg-white rounded-3xl border border-gray-100 p-4 sm:p-8 shadow-xs">
        {/* Gallery Column */}
        <div className="md:col-span-6 lg:col-span-5">
          <ProductGallery
            images={product.images}
            productName={product.name}
          />
        </div>

        {/* Product Details Column */}
        <div className="md:col-span-6 lg:col-span-7 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            {/* Category & SKU */}
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span className="font-semibold text-[#0B5D3B] uppercase tracking-wider">
                {product.category}
              </span>
              <span>SKU: {product.sku}</span>
            </div>

            {/* Title */}
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 leading-tight">
              {product.name}
            </h1>

            {/* Rating & In-stock row */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
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
            <div className="flex items-baseline gap-2.5 pt-1">
              <span className="text-2xl sm:text-3xl font-bold text-gray-900">
                ₹{product.price}
              </span>
              {product.originalPrice > product.price && (
                <>
                  <span className="text-base text-gray-400 line-through">
                    ₹{product.originalPrice}
                  </span>
                  <span className="rounded-md bg-[#FFF6E9] border border-orange-100 px-2 py-0.5 text-xs font-bold text-[#FF7A00]">
                    Save {product.discountPercent}%
                  </span>
                </>
              )}
            </div>

            {/* Description */}
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{product.description}</p>

            {/* Highlights */}
            {product.features && product.features.length > 0 && (
              <div className="space-y-2 pt-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900">
                  Key Features
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <div className="flex flex-wrap items-center gap-3">
              {/* Stepper */}
              <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50 p-0.5">
                <button
                  type="button"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-white transition-all disabled:opacity-40"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-10 text-center text-xs font-bold text-gray-900">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 hover:bg-white transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Add to Cart Button */}
              <Button
                size="md"
                variant="primary"
                onClick={() => addToCart(product, quantity)}
                className="flex-1 font-bold rounded-xl text-xs sm:text-sm shadow-xs"
              >
                Add to Cart
              </Button>

              {/* Wishlist Button */}
              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                className={`flex h-9.5 w-9.5 items-center justify-center rounded-xl border transition-all ${
                  wishlisted
                    ? 'border-red-200 bg-red-50 text-red-500'
                    : 'border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Heart className={`w-4 h-4 ${wishlisted ? 'fill-current' : ''}`} />
              </button>
            </div>

            {/* Value Guarantees row */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-gray-50 text-center sm:text-left">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-[10px] sm:text-[11px] font-bold text-gray-700">Great Quality</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-gray-50 text-center sm:text-left">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="text-[10px] sm:text-[11px] font-bold text-gray-700">Value for Money</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-xl bg-gray-50 text-center sm:text-left">
                <RotateCcw className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="text-[10px] sm:text-[11px] font-bold text-gray-700">Easy Returns</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Mobile Add To Cart Bar */}
      <div className="fixed bottom-14 inset-x-0 z-30 block md:hidden bg-white/95 backdrop-blur-md border-t border-gray-200 p-2.5 shadow-lg">
        <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
          <div>
            <span className="text-[10px] text-gray-400">Total</span>
            <div className="text-base font-bold text-gray-900 leading-none">₹{product.price * quantity}</div>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={() => addToCart(product, quantity)}
            className="flex-1 font-bold"
          >
            Add to Cart
          </Button>
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900">Similar Everyday Essentials</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
            {relatedProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                isWishlisted={isWishlisted(p.id)}
                onAddToCart={() => addToCart(p)}
                onToggleWishlist={() => toggleWishlist(p.id)}
                onClick={() => router.push(`/product/${p.slug}`)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

