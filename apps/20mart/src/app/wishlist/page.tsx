'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { mockProducts, Product } from '@20mart/shared';
import { Breadcrumb, Button } from '@20mart/ui';
import { useStore } from '../../lib/store';
import { Trash2, ShoppingBag, Heart, ArrowRight, CheckSquare, Square } from 'lucide-react';

export default function WishlistPage() {
  const router = useRouter();
  const { wishlist, toggleWishlist, addToCart } = useStore();

  const wishlistedProducts = mockProducts.filter((p) => wishlist.includes(p.id));
  const [selectedIds, setSelectedIds] = useState<string[]>(wishlist);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === wishlistedProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(wishlistedProducts.map((p) => p.id));
    }
  };

  const moveSelectedToCart = () => {
    wishlistedProducts
      .filter((p) => selectedIds.includes(p.id))
      .forEach((p) => {
        addToCart(p);
        toggleWishlist(p.id);
      });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: `My Wishlist (${wishlistedProducts.length})` },
        ]}
      />

      {/* Header Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            My Wishlist ({wishlistedProducts.length})
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Items you have saved to purchase later
          </p>
        </div>

        {wishlistedProducts.length > 0 && (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors"
            >
              {selectedIds.length === wishlistedProducts.length ? (
                <CheckSquare className="w-4 h-4 text-[#0B5D3B]" />
              ) : (
                <Square className="w-4 h-4 text-gray-400" />
              )}
              <span>Select All</span>
            </button>
            <Button
              size="sm"
              variant="primary"
              disabled={selectedIds.length === 0}
              onClick={moveSelectedToCart}
              className="font-bold"
            >
              Move to Cart ({selectedIds.length})
            </Button>
          </div>
        )}
      </div>

      {wishlistedProducts.length === 0 ? (
        <div className="rounded-2xl sm:rounded-3xl border border-dashed border-gray-200 bg-white p-10 sm:p-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#FFF6E9] text-[#FF7A00] mx-auto mb-3">
            <Heart className="w-8 h-8 fill-current" />
          </div>
          <h3 className="text-base font-bold text-gray-800">Your wishlist is empty</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-4">
            Browse our everyday values and tap the heart icon on any product to save it here!
          </p>
          <Button size="md" variant="primary" onClick={() => router.push('/shop')}>
            Start Shopping
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {wishlistedProducts.map((product) => {
            const isChecked = selectedIds.includes(product.id);
            return (
              <div
                key={product.id}
                className="flex items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border border-gray-100 bg-white shadow-xs hover:border-orange-200 transition-all"
              >
                {/* Checkbox */}
                <button
                  type="button"
                  onClick={() => toggleSelect(product.id)}
                  className="p-1 text-gray-400 hover:text-[#0B5D3B] transition-colors"
                >
                  {isChecked ? (
                    <CheckSquare className="w-4 h-4 text-[#0B5D3B]" />
                  ) : (
                    <Square className="w-4 h-4 text-gray-300" />
                  )}
                </button>

                {/* Product Info & Thumbnail */}
                <div
                  onClick={() => router.push(`/product/${product.slug}`)}
                  className="flex items-center gap-3 sm:gap-4 cursor-pointer flex-1 min-w-0"
                >
                  <div className="h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-xl bg-white p-1.5 flex items-center justify-center border border-gray-100 overflow-hidden">
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] uppercase font-bold text-gray-400">
                      {product.category}
                    </span>
                    <h3 className="text-xs sm:text-sm font-semibold text-gray-900 truncate hover:text-[#0B5D3B] transition-colors">
                      {product.name}
                    </h3>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-sm sm:text-base font-bold text-gray-900">
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
                </div>

                {/* Actions: Add to Cart + Remove */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      addToCart(product);
                      toggleWishlist(product.id);
                    }}
                    className="gap-1 font-bold rounded-xl"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Add to Cart</span>
                  </Button>
                  <button
                    type="button"
                    onClick={() => toggleWishlist(product.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                    aria-label="Remove from wishlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
