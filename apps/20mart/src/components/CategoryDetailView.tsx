'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ProductCategory, Product } from '@20mart/shared';
import { ProductCard, Breadcrumb, Button } from '@20mart/ui';
import { useStore } from '../lib/store';
import { Sparkles } from 'lucide-react';

interface CategoryDetailViewProps {
  category: ProductCategory;
  allProducts: Product[];
}

export const CategoryDetailView: React.FC<CategoryDetailViewProps> = ({
  category,
  allProducts,
}) => {
  const router = useRouter();
  const { toggleWishlist, isWishlisted, getItemQuantity, updateItemQuantity } = useStore();

  const subcategories: string[] = category.subcategories || ['All', 'Popular', 'Best Value'];
  const [activeSubcategory, setActiveSubcategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<string>('popular');

  const categoryProducts = useMemo(() => {
    let list = allProducts.filter((p) => {
      const matchesCategory = p.categorySlug === category.slug || p.category === category.name;
      if (activeSubcategory === 'All') return matchesCategory;
      return matchesCategory && p.subcategory === activeSubcategory;
    });

    if (sortBy === 'price-low') {
      list = [...list].sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-high') {
      list = [...list].sort((a, b) => b.price - a.price);
    }

    return list;
  }, [allProducts, category, activeSubcategory, sortBy]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-2.5 pb-8 sm:pt-3.5 space-y-3.5 sm:space-y-4">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Categories', href: '/shop' },
          { label: category.name },
        ]}
        className="mb-1.5 sm:mb-2"
      />

      {/* Category Hero Banner - Compact & Minimal */}
      <div
        className="relative overflow-hidden rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs border border-gray-100"
        style={{
          background: `linear-gradient(135deg, ${category.color} 0%, #FFFFFF 100%)`,
        }}
      >
        <div className="space-y-1 text-center sm:text-left z-10">
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/80 text-xs font-bold text-gray-700 backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#FF7A00]" />
            <span>Curated Collection</span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">{category.name}</h1>
          <p className="text-xs text-gray-600 max-w-md">
            Everyday {category.name.toLowerCase()} essentials at great value, backed by 20Mart quality.
          </p>
        </div>

        <div className="relative h-20 sm:h-24 w-20 sm:w-24 shrink-0 rounded-xl overflow-hidden bg-white/70 p-1.5 shadow-xs border border-white flex items-center justify-center">
          <Image
            src={category.image}
            alt={category.name}
            width={96}
            height={96}
            className="h-full w-full object-contain"
          />
        </div>
      </div>

      {/* Sub-category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {subcategories.map((sub: string) => {
          const isActive = activeSubcategory === sub;
          return (
            <button
              key={sub}
              type="button"
              onClick={() => setActiveSubcategory(sub)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap shadow-2xs cursor-pointer ${
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
            className="mt-3 cursor-pointer"
          >
            View All {category.name}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 min-[960px]:grid-cols-5 lg:grid-cols-5 xl:grid-cols-5 gap-2 sm:gap-2.5">
          {categoryProducts.map((product) => (
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
      )}
    </div>
  );
};
