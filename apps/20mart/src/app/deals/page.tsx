'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { mockProducts, Product } from '@20mart/shared';
import { ProductCard, Breadcrumb } from '@20mart/ui';
import { useStore } from '../../lib/store';
import { Flame, Sparkles, Clock, ArrowRight } from 'lucide-react';

export default function DailyDealsPage() {
  const router = useRouter();
  const { toggleWishlist, isWishlisted, getItemQuantity, updateItemQuantity } = useStore();
  const [sortBy, setSortBy] = useState<string>('popular');

  const dealProducts = useMemo(() => {
    const list = mockProducts.filter((p) => p.dailyDeal || p.discountPercent >= 25);
    if (sortBy === 'price-low') {
      return [...list].sort((a, b) => a.price - b.price);
    }
    if (sortBy === 'price-high') {
      return [...list].sort((a, b) => b.price - a.price);
    }
    if (sortBy === 'discount') {
      return [...list].sort((a, b) => b.discountPercent - a.discountPercent);
    }
    return [...list].sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
  }, [sortBy]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-2.5 pb-8 sm:pt-3.5 sm:pb-10">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Daily Deals' },
        ]}
        className="mb-2 sm:mb-2.5"
      />

      {/* Header Banner - Compact & Minimal */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#FF7A00] via-[#FF850A] to-[#FF9E1B] p-4 sm:p-5 text-white shadow-xs mb-3.5 sm:mb-4">
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/95 text-[#FF7A00] text-[11px] font-black shadow-xs">
              <Flame className="w-3.5 h-3.5 fill-current text-[#FF7A00]" />
              <span>Limited-Time Daily Deals</span>
            </div>
            <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white">
              Today's Best Value Deals
            </h1>
            <p className="text-xs text-orange-100 max-w-xl">
              Hand-picked daily essentials with up to 33% discount. No minimum purchase required!
            </p>
          </div>

          <div className="flex items-center gap-2 bg-black/20 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-white/20 text-xs font-bold text-white shrink-0 self-start sm:self-auto">
            <Clock className="w-3.5 h-3.5 text-amber-300" />
            <span>Refreshes Daily at Midnight</span>
          </div>
        </div>
      </div>

      {/* Controls Bar: Count + Sort */}
      <div className="flex items-center justify-between pb-2.5 border-b border-gray-100 mb-3 sm:mb-3.5">
        <span className="text-xs font-bold text-gray-500">
          Showing {dealProducts.length} Daily Deals
        </span>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-400 font-medium hidden sm:inline">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 focus:outline-none focus:border-[#FF7A00]"
          >
            <option value="popular">Popular Deals</option>
            <option value="discount">Highest Discount</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Product Grid - Full-Width 5-Card Layout Without Filter Sidebar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 min-[960px]:grid-cols-5 lg:grid-cols-5 xl:grid-cols-5 gap-2 sm:gap-3">
        {dealProducts.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            quantity={getItemQuantity(product.id)}
            isWishlisted={isWishlisted(product.id)}
            onAddToCart={() => updateItemQuantity(product.id, 1)}
            onIncrement={() => updateItemQuantity(product.id, 1)}
            onDecrement={() => updateItemQuantity(product.id, -1)}
            onToggleWishlist={() => toggleWishlist(product.id)}
            onClick={() => router.push(`/product/${product.slug}`)}
          />
        ))}
      </div>
    </div>
  );
}

