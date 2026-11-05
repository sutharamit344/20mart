'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { mockProducts, Product } from '@20mart/shared';
import { Breadcrumb, Button, ProductCard, Search } from '@20mart/ui';
import { useStore } from '../../lib/store';
import { Search as SearchIcon, Filter, SlidersHorizontal, ArrowUpDown } from 'lucide-react';

function SearchResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryParam = searchParams.get('q') || '';

  const { addToCart, toggleWishlist, isWishlisted } = useStore();

  const [searchWord, setSearchWord] = useState(queryParam);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedPriceMax, setSelectedPriceMax] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<string>('popular');

  const popularSearches = ['Peeler', 'Storage Basket', 'Cleaning Brush', 'Clips', 'Container', 'Scissors'];

  const filteredResults = useMemo(() => {
    let list = [...mockProducts];
    const q = (searchWord || queryParam).toLowerCase().trim();

    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.subcategory?.toLowerCase().includes(q) ||
          p.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (selectedCategory !== 'All') {
      list = list.filter((p) => p.category === selectedCategory || p.categorySlug === selectedCategory);
    }

    if (selectedPriceMax) {
      list = list.filter((p) => p.price <= selectedPriceMax);
    }

    if (sortBy === 'price-low') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-high') {
      list.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating') {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    return list;
  }, [searchWord, queryParam, selectedCategory, selectedPriceMax, sortBy]);

  const handleSearchSubmit = (text: string) => {
    router.push(`/search?q=${encodeURIComponent(text.trim())}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Search Results' },
        ]}
      />

      {/* Main Search Input Container */}
      <div className="rounded-2xl bg-white border border-gray-100 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="max-w-2xl">
          <label className="block text-xs font-bold text-gray-700 mb-1.5">
            Search for household essentials
          </label>
          <div className="flex gap-2">
            <Search
              value={searchWord}
              onChange={setSearchWord}
              onSearch={handleSearchSubmit}
              onClear={() => setSearchWord('')}
              placeholder="Search e.g. peeler, storage basket, cleaning brush..."
            />
            <Button
              size="md"
              variant="primary"
              onClick={() => handleSearchSubmit(searchWord)}
              className="shrink-0 px-4 font-bold"
            >
              Search
            </Button>
          </div>
        </div>

        {/* Popular Search tags */}
        <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
          <span className="text-gray-400 font-medium">Popular:</span>
          {popularSearches.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setSearchWord(item);
                handleSearchSubmit(item);
              }}
              className="px-2.5 py-1 rounded-full bg-gray-50 hover:bg-[#FFF6E9] hover:text-[#FF7A00] text-gray-600 transition-colors text-[11px] font-semibold"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Results Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-gray-900">
            {queryParam ? (
              <>
                Search results for <span className="text-[#0B5D3B]">"{queryParam}"</span>
              </>
            ) : (
              'All Matching Everyday Products'
            )}
            <span className="ml-2 text-xs font-normal text-gray-500">({filteredResults.length} items)</span>
          </h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            Doorstep delivery available across Ahmedabad & Gandhinagar
          </p>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto text-xs">
          <span className="text-gray-400 font-medium">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none focus:border-[#FF7A00]"
          >
            <option value="popular">Popularity</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="rating">Highest Rated</option>
          </select>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {['All', 'Kitchen & Home', 'Cleaning & Care', 'Stationery & School', 'Daily Use', 'Personal Care'].map(
          (cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-[#0B5D3B] text-white shadow-xs'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {cat}
              </button>
            );
          }
        )}
      </div>

      {/* Product Results Grid */}
      {filteredResults.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
          <SearchIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-800">No products matched your search</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-4">
            Try searching with broader terms like "brush", "peeler", "basket", or explore our categories!
          </p>
          <div className="flex justify-center gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setSearchWord('');
                setSelectedCategory('All');
                setSelectedPriceMax(null);
                router.push('/shop');
              }}
            >
              Browse All Products
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push('/category')}
            >
              View Categories
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {filteredResults.map((product) => (
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

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-gray-400">Loading search results...</div>}>
      <SearchResultsContent />
    </Suspense>
  );
}

