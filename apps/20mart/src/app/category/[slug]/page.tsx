'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  mockCategories,
  mockProducts,
} from '@20mart/shared';
import {
  ProductCard,
  Breadcrumb,
  Button,
} from '@20mart/ui';
import { useStore } from '../../../lib/store';
import { ArrowLeft, Sparkles } from 'lucide-react';

export default function CategoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const { addToCart, toggleWishlist, isWishlisted } = useStore();

  const category = mockCategories.find((c) => c.slug === slug) || mockCategories[0];
  const subcategories = category.subcategories || ['All', 'Popular', 'Best Value'];

  const [activeSubcategory, setActiveSubcategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('popular');

  const categoryProducts = mockProducts.filter((p) => {
    const matchesCategory = p.categorySlug === category.slug || p.category === category.name;
    if (activeSubcategory === 'All') return matchesCategory;
    return matchesCategory && p.subcategory === activeSubcategory;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Categories', href: '/shop' },
          { label: category.name },
        ]}
      />

      {/* Category Hero Banner (Screen 03) */}
      <div
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl p-5 sm:p-7 flex flex-col sm:flex-row items-center justify-between gap-5 shadow-xs border border-gray-100"
        style={{
          background: `linear-gradient(135deg, ${category.color} 0%, #FFFFFF 100%)`,
        }}
      >
        <div className="space-y-1.5 text-center sm:text-left z-10">
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/80 text-xs font-bold text-gray-700 backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#FF7A00]" />
            <span>Curated Collection</span>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{category.name}</h1>
          <p className="text-xs sm:text-sm text-gray-600 max-w-md">
            Everyday {category.name.toLowerCase()} essentials at great value, backed by 20Mart quality.
          </p>
        </div>

        <div className="relative h-24 sm:h-32 w-24 sm:w-32 shrink-0 rounded-2xl overflow-hidden bg-white/70 p-2 shadow-xs border border-white flex items-center justify-center">
          <img
            src={category.image}
            alt={category.name}
            className="h-full w-full object-contain"
          />
        </div>
      </div>

      {/* Sub-category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {subcategories.map((sub) => {
          const isActive = activeSubcategory === sub;
          return (
            <button
              key={sub}
              type="button"
              onClick={() => setActiveSubcategory(sub)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shadow-2xs ${
                isActive
                  ? 'bg-[#0B5D3B] text-white shadow-xs'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {sub}
            </button>
          );
        })}
      </div>

      {/* Product count and Sort */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs font-bold text-gray-500">
          Showing {categoryProducts.length} products
        </span>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-400 font-medium">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 focus:outline-none focus:border-[#FF7A00]"
          >
            <option value="popular">Popular</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Product Grid */}
      {categoryProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
          <p className="text-xs sm:text-sm font-bold text-gray-600">No items found in this subcategory.</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveSubcategory('All')}
            className="mt-3"
          >
            View All {category.name}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {categoryProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isWishlisted={isWishlisted(product.id)}
              onAddToCart={() => addToCart(product)}
              onToggleWishlist={() => toggleWishlist(product.id)}
              onClick={() => router.push(`/product/${product.slug}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

