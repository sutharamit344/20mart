'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { mockProducts, Product } from '@20mart/shared';
import { Breadcrumb, Button, ProductImage } from '@20mart/ui';
import { useStore } from '../../lib/store';
import {
  Trash2,
  ShoppingBag,
  Heart,
  ArrowRight,
  CheckSquare,
  Square,
  LayoutGrid,
  List,
  Star,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

export default function WishlistPage() {
  const router = useRouter();
  const { wishlist, toggleWishlist, addToCart, showToast } = useStore();

  const wishlistedProducts = mockProducts.filter((p) => wishlist.includes(p.id));
  const [selectedIds, setSelectedIds] = useState<string[]>(wishlist);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const validSelectedIds = selectedIds.filter((id) => wishlist.includes(id));

  const totalPrice = wishlistedProducts.reduce((sum, p) => sum + p.price, 0);
  const totalOriginalPrice = wishlistedProducts.reduce(
    (sum, p) => sum + (p.originalPrice || p.price),
    0
  );
  const totalSavings = Math.max(0, totalOriginalPrice - totalPrice);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (validSelectedIds.length === wishlistedProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(wishlistedProducts.map((p) => p.id));
    }
  };

  const moveSelectedToCart = () => {
    const toMove = wishlistedProducts.filter((p) => validSelectedIds.includes(p.id));
    toMove.forEach((p) => {
      addToCart(p, 1);
      toggleWishlist(p.id);
    });
    if (toMove.length > 0) {
      showToast(`Moved ${toMove.length} ${toMove.length === 1 ? 'item' : 'items'} to cart!`);
    }
  };

  const moveAllToCart = () => {
    wishlistedProducts.forEach((p) => {
      addToCart(p, 1);
      toggleWishlist(p.id);
    });
    showToast(`Moved all items to your cart!`);
  };

  const handleMoveItemToCart = (product: Product) => {
    addToCart(product, 1);
    toggleWishlist(product.id);
    showToast(`Moved ${product.name} to cart!`);
  };

  const clearWishlist = () => {
    wishlistedProducts.forEach((p) => toggleWishlist(p.id));
    showToast('Wishlist cleared');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-5">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: `My Wishlist (${wishlistedProducts.length})` },
        ]}
      />

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-gray-900">My Wishlist</h1>
            <span className="flex h-5 items-center justify-center rounded-full bg-[#FFF6E9] px-2 text-xs font-bold text-[#FF7A00] border border-orange-200/60">
              {wishlistedProducts.length} {wishlistedProducts.length === 1 ? 'item' : 'items'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Items you have saved to purchase later
          </p>
        </div>

        {wishlistedProducts.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* View Mode Toggle: Grid vs List */}
            <div className="flex items-center bg-gray-100/90 p-0.5 rounded-lg border border-gray-200/60">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white text-gray-900 shadow-2xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
                title="List View"
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">List</span>
              </button>
            </div>

            {/* Select All */}
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            >
              {validSelectedIds.length === wishlistedProducts.length ? (
                <CheckSquare className="w-4 h-4 text-[#0B5D3B]" />
              ) : (
                <Square className="w-4 h-4 text-gray-400" />
              )}
              <span>Select All</span>
            </button>

            {/* Move All to Cart */}
            <Button
              size="sm"
              variant="primary"
              disabled={validSelectedIds.length === 0}
              onClick={moveSelectedToCart}
              className="font-bold gap-1.5 h-8.5 rounded-xl shadow-xs"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>
                Move to Cart ({validSelectedIds.length})
              </span>
            </Button>
          </div>
        )}
      </div>

      {wishlistedProducts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 sm:p-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#FFF6E9] text-[#FF7A00] mx-auto mb-3 shadow-xs">
            <Heart className="w-8 h-8 fill-current" />
          </div>
          <h3 className="text-base font-bold text-gray-800">Your wishlist is empty</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-4 leading-relaxed">
            Browse our everyday values and tap the heart icon on any product to save it here!
          </p>
          <Button size="md" variant="primary" onClick={() => router.push('/shop')} className="font-bold">
            Start Shopping
          </Button>
        </div>
      ) : viewMode === 'grid' ? (
        /* ================= GRID VIEW ================= */
        <div className="space-y-4">
          {/* Quick value banner */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-orange-50/70 border border-orange-100/80 text-xs">
            <div className="flex items-center gap-2 text-gray-700 font-medium">
              <Sparkles className="w-4 h-4 text-[#FF7A00]" />
              <span>
                <strong>{wishlistedProducts.length} items</strong> saved • Total value: <strong>₹{totalPrice}</strong>
                {totalSavings > 0 && (
                  <span className="text-[#0B5D3B] ml-1.5 font-bold">
                    (You save ₹{totalSavings}!)
                  </span>
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={moveAllToCart}
              className="text-xs font-bold text-[#FF7A00] hover:text-[#E66E00] hover:underline cursor-pointer"
            >
              Move All to Cart →
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {wishlistedProducts.map((product) => {
              const isSelected = validSelectedIds.includes(product.id);
              return (
                <div
                  key={product.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-gray-200/90 bg-white p-2.5 sm:p-3 transition-all duration-300 hover:border-orange-300 hover:shadow-[0_8px_24px_-6px_rgba(255,122,0,0.14),0_2px_8px_-2px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 select-none"
                >
                  {/* Top Badges & Controls */}
                  <div className="relative mb-2 w-full overflow-hidden rounded-xl bg-[#F9FAFB] border border-gray-100 aspect-square flex items-center justify-center">
                    {/* Checkbox (top-left) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(product.id);
                      }}
                      className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-white/95 backdrop-blur-xs border border-gray-200 shadow-2xs hover:border-[#0B5D3B] transition-colors cursor-pointer"
                      title={isSelected ? 'Deselect item' : 'Select item'}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 text-[#0B5D3B]" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-gray-300" />
                      )}
                    </button>

                    {/* Discount Badge */}
                    {product.discountPercent > 0 && (
                      <div className="absolute left-9 top-2 z-10 rounded-md bg-[#FFF6E9] border border-orange-200/80 px-1.5 py-0.5 text-[10px] font-black text-[#FF7A00] shadow-2xs">
                        -{product.discountPercent}%
                      </div>
                    )}

                    {/* Remove Wishlist Button (top-right red heart) */}
                    <button
                      type="button"
                      aria-label="Remove from wishlist"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleWishlist(product.id);
                      }}
                      className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 backdrop-blur-xs border border-gray-100 text-red-500 shadow-xs transition-all hover:bg-red-50 hover:scale-110 active:scale-95 cursor-pointer"
                      title="Remove from wishlist"
                    >
                      <Heart className="h-3.5 w-3.5 fill-current" />
                    </button>

                    {/* Product Image */}
                    <div
                      onClick={() => router.push(`/product/${product.slug}`)}
                      className="h-full w-full cursor-pointer flex items-center justify-center p-2"
                    >
                      <ProductImage
                        src={product.images[0]}
                        alt={product.name}
                        aspectRatio="square"
                        padding="none"
                        className="group-hover:scale-105 transition-transform duration-300 bg-transparent"
                      />
                    </div>
                  </div>

                  {/* Info Section */}
                  <div className="flex flex-1 flex-col justify-between">
                    <div onClick={() => router.push(`/product/${product.slug}`)} className="cursor-pointer">
                      <p className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider truncate">
                        {product.subcategory || product.category}
                      </p>
                      <h3
                        className="font-semibold text-gray-800 line-clamp-2 group-hover:text-[#0B5D3B] transition-colors leading-snug text-xs sm:text-[13px] mt-0.5 h-8 sm:h-9"
                        title={product.name}
                      >
                        {product.name}
                      </h3>

                      {product.rating && (
                        <div className="mt-1 flex items-center gap-1">
                          <Star className="h-3 w-3 fill-current text-amber-500" />
                          <span className="text-[10px] font-bold text-gray-700">{product.rating}</span>
                          <span className="text-[9px] text-gray-400">({product.reviewCount})</span>
                        </div>
                      )}
                    </div>

                    {/* Price Row */}
                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-baseline gap-1.5">
                      <span className="text-sm sm:text-base font-black text-gray-900">
                        ₹{product.price}
                      </span>
                      {product.originalPrice > product.price && (
                        <span className="text-[10px] sm:text-xs text-gray-400 line-through">
                          ₹{product.originalPrice}
                        </span>
                      )}
                    </div>

                    {/* Move to Cart Button */}
                    <button
                      type="button"
                      onClick={() => handleMoveItemToCart(product)}
                      className="mt-2.5 w-full h-8 sm:h-8.5 rounded-xl bg-[#FF7A00] hover:bg-[#E66E00] active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Move to Cart</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ================= LIST VIEW (BALANCED 2-COLUMN) ================= */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Items List */}
          <div className="lg:col-span-8 space-y-3">
            {wishlistedProducts.map((product) => {
              const isSelected = validSelectedIds.includes(product.id);
              return (
                <div
                  key={product.id}
                  className="group relative flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border border-gray-200/90 bg-white shadow-xs hover:border-orange-200 transition-all"
                >
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={() => toggleSelect(product.id)}
                    className="p-1 text-gray-400 hover:text-[#0B5D3B] transition-colors shrink-0 cursor-pointer"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-[#0B5D3B]" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-300" />
                    )}
                  </button>

                  {/* Thumbnail */}
                  <div
                    onClick={() => router.push(`/product/${product.slug}`)}
                    className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-xl bg-[#F9FAFB] p-1 border border-gray-100 flex items-center justify-center overflow-hidden cursor-pointer"
                  >
                    <ProductImage
                      src={product.images[0]}
                      alt={product.name}
                      aspectRatio="square"
                      padding="none"
                      className="group-hover:scale-105 transition-transform duration-300 bg-transparent"
                    />
                  </div>

                  {/* Product Details */}
                  <div
                    onClick={() => router.push(`/product/${product.slug}`)}
                    className="flex-1 min-w-0 cursor-pointer"
                  >
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                      {product.subcategory || product.category}
                    </span>
                    <h3 className="text-xs sm:text-sm font-bold text-gray-900 truncate group-hover:text-[#0B5D3B] transition-colors">
                      {product.name}
                    </h3>
                    {product.rating && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Star className="h-3 w-3 fill-current text-amber-500" />
                        <span className="text-[10px] font-bold text-gray-700">{product.rating}</span>
                        <span className="text-[10px] text-gray-400">({product.reviewCount})</span>
                      </div>
                    )}
                    <div className="flex items-baseline gap-1.5 mt-1">
                      <span className="text-sm sm:text-base font-black text-gray-900">
                        ₹{product.price}
                      </span>
                      {product.originalPrice > product.price && (
                        <span className="text-xs text-gray-400 line-through">
                          ₹{product.originalPrice}
                        </span>
                      )}
                      {product.discountPercent > 0 && (
                        <span className="text-[10px] font-bold text-[#FF7A00] bg-[#FFF6E9] px-1.5 py-0.5 rounded">
                          -{product.discountPercent}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions: Move to Cart + Remove */}
                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleMoveItemToCart(product)}
                      className="gap-1.5 font-bold rounded-xl h-8.5 px-3 sm:px-4 text-xs"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Move to Cart</span>
                      <span className="sm:hidden">Move</span>
                    </Button>
                    <button
                      type="button"
                      onClick={() => toggleWishlist(product.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                      title="Remove from wishlist"
                      aria-label="Remove from wishlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Wishlist Summary Card */}
          <div className="lg:col-span-4 sticky top-24 space-y-4">
            <div className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-5 shadow-xs space-y-4">
              <h2 className="text-sm font-bold text-gray-900">Wishlist Summary</h2>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Saved Items</span>
                  <span className="font-bold text-gray-900">{wishlistedProducts.length}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Total Value</span>
                  <span className="font-black text-gray-900">₹{totalPrice}</span>
                </div>
                {totalSavings > 0 && (
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Total Discount Saved</span>
                    <span>-₹{totalSavings}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-gray-100 space-y-2">
                <Button
                  size="md"
                  variant="primary"
                  disabled={validSelectedIds.length === 0}
                  onClick={moveSelectedToCart}
                  className="w-full font-bold h-10 gap-2 rounded-xl shadow-xs"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Move Selected to Cart ({validSelectedIds.length})</span>
                </Button>

                <Button
                  size="md"
                  variant="outline"
                  onClick={() => router.push('/shop')}
                  className="w-full text-xs font-semibold h-9 rounded-xl"
                >
                  Continue Shopping
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
