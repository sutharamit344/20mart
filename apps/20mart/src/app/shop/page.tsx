'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  mockProducts,
  mockCategories,
  Product,
} from '@20mart/shared';
import {
  ProductCard,
  Breadcrumb,
  Button,
  Drawer,
  Checkbox,
  Pagination,
} from '@20mart/ui';
import { useStore } from '../../lib/store';
import { Filter, SlidersHorizontal, ArrowUpDown, X, Search as SearchIcon } from 'lucide-react';

function ShopContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const initialCategory = searchParams.get('category') || '';
  const initialFilter = searchParams.get('filter') || '';
  const initialMaxPrice = searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : null;

  const { addToCart, toggleWishlist, isWishlisted } = useStore();

  // Filter States
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    initialCategory ? [initialCategory] : []
  );
  const [selectedPriceRanges, setSelectedPriceRanges] = useState<string[]>([]);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<string>('popular');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Price ranges
  const priceRanges = [
    { id: 'under-20', label: 'Below ₹20', min: 0, max: 20 },
    { id: '20-40', label: '₹20 – ₹40', min: 20, max: 40 },
    { id: '40-60', label: '₹40 – ₹60', min: 40, max: 60 },
    { id: '60-100', label: '₹60 – ₹100', min: 60, max: 100 },
    { id: 'above-100', label: 'Above ₹100', min: 100, max: 9999 },
  ];

  const handleCategoryToggle = (slug: string) => {
    setSelectedCategories((prev) =>
      prev.includes(slug) ? prev.filter((c) => c !== slug) : [...prev, slug]
    );
    setCurrentPage(1);
  };

  const handlePriceToggle = (rangeId: string) => {
    setSelectedPriceRanges((prev) =>
      prev.includes(rangeId) ? prev.filter((r) => r !== rangeId) : [...prev, rangeId]
    );
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedPriceRanges([]);
    setSelectedRating(null);
    setCurrentPage(1);
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    let result = [...mockProducts];

    // Search query
    if (initialQuery) {
      const q = initialQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Special query filters
    if (initialFilter === 'trending') {
      result = result.filter((p) => p.trending);
    } else if (initialFilter === 'daily-deals') {
      result = result.filter((p) => p.dailyDeal);
    }

    if (initialMaxPrice) {
      result = result.filter((p) => p.price <= initialMaxPrice);
    }

    // Category filter
    if (selectedCategories.length > 0) {
      result = result.filter((p) => selectedCategories.includes(p.categorySlug));
    }

    // Price ranges
    if (selectedPriceRanges.length > 0) {
      result = result.filter((p) => {
        return selectedPriceRanges.some((rangeId) => {
          const range = priceRanges.find((r) => r.id === rangeId);
          if (!range) return false;
          return p.price >= range.min && p.price <= range.max;
        });
      });
    }

    // Rating
    if (selectedRating !== null) {
      result = result.filter((p) => p.rating >= selectedRating);
    }

    // Sorting
    if (sortBy === 'price-low') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-high') {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating') {
      result.sort((a, b) => b.rating - a.rating);
    } else {
      result.sort((a, b) => b.reviewCount - a.reviewCount);
    }

    return result;
  }, [
    initialQuery,
    initialFilter,
    initialMaxPrice,
    selectedCategories,
    selectedPriceRanges,
    selectedRating,
    sortBy,
  ]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const FilterSidebar = (
    <div className="space-y-6">
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900 mb-3">
          Category
        </h4>
        <div className="space-y-2">
          {mockCategories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between text-xs">
              <Checkbox
                label={cat.name}
                checked={selectedCategories.includes(cat.slug)}
                onChange={() => handleCategoryToggle(cat.slug)}
              />
              <span className="text-gray-400 text-[11px] font-medium">({cat.itemCount})</span>
            </div>
          ))}
        </div>
      </div>

      <hr className="border-gray-100" />

      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900 mb-3">
          Price Range
        </h4>
        <div className="space-y-2">
          {priceRanges.map((range) => (
            <div key={range.id} className="text-xs">
              <Checkbox
                label={range.label}
                checked={selectedPriceRanges.includes(range.id)}
                onChange={() => handlePriceToggle(range.id)}
              />
            </div>
          ))}
        </div>
      </div>

      <hr className="border-gray-100" />

      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900 mb-3">
          Customer Rating
        </h4>
        <div className="space-y-2">
          {[4, 3].map((stars) => (
            <div key={stars} className="text-xs">
              <Checkbox
                label={`${stars}★ & above`}
                checked={selectedRating === stars}
                onChange={() => setSelectedRating(selectedRating === stars ? null : stars)}
              />
            </div>
          ))}
        </div>
      </div>

      {(selectedCategories.length > 0 || selectedPriceRanges.length > 0 || selectedRating !== null) && (
        <button
          type="button"
          onClick={clearAllFilters}
          className="w-full py-2 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
        >
          Clear All Filters
        </button>
      )}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: initialQuery ? `Search: "${initialQuery}"` : 'Shop - All Products' },
        ]}
        className="mb-4"
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900">
            {initialQuery ? `Search results for "${initialQuery}"` : 'All Products'}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Showing {filteredProducts.length} items available for doorstep delivery
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <button
            type="button"
            onClick={() => setMobileFilterOpen(true)}
            className="flex md:hidden items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 shadow-xs"
          >
            <Filter className="w-3.5 h-3.5 text-[#FF7A00]" />
            <span>Filter</span>
            {(selectedCategories.length > 0 || selectedPriceRanges.length > 0) && (
              <span className="w-2 h-2 rounded-full bg-[#FF7A00]" />
            )}
          </button>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500 font-medium hidden sm:inline">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 focus:outline-none focus:border-[#FF7A00]"
            >
              <option value="popular">Popular</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 lg:gap-6">
        <div className="hidden md:block col-span-1 rounded-2xl border border-gray-100 bg-white p-4 shadow-xs h-fit sticky top-24">
          <div className="flex items-center justify-between pb-2.5 border-b border-gray-100 mb-3.5">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#FF7A00]" />
              <h3 className="text-xs sm:text-sm font-bold text-gray-900">Filters</h3>
            </div>
            {(selectedCategories.length > 0 || selectedPriceRanges.length > 0) && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-[11px] font-bold text-red-500 hover:underline"
              >
                Reset
              </button>
            )}
          </div>
          {FilterSidebar}
        </div>

        <div className="col-span-1 md:col-span-3 space-y-5">
          {paginatedProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
              <SearchIcon className="w-8 h-8 text-gray-300 mx-auto mb-2.5" />
              <h3 className="text-sm font-bold text-gray-800">No products matched your filters</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-3.5">
                Try removing some of your selected filters or search with a different keyword.
              </p>
              <Button size="sm" variant="outline" onClick={clearAllFilters}>
                Clear All Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">
              {paginatedProducts.map((product) => (
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

          {totalPages > 1 && (
            <div className="pt-6">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </div>

      <Drawer
        isOpen={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        title="Filter Products"
        position="bottom"
      >
        <div className="space-y-4">
          {FilterSidebar}
          <div className="pt-4 border-t border-gray-100">
            <Button
              className="w-full"
              size="md"
              onClick={() => setMobileFilterOpen(false)}
            >
              Show {filteredProducts.length} Results
            </Button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-gray-400">Loading catalog...</div>}>
      <ShopContent />
    </Suspense>
  );
}
