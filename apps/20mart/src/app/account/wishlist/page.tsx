'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@20mart/ui';
import { AccountLayout } from '../../../components/AccountLayout';
import { useStore } from '../../../lib/store';
import { mockProducts } from '@20mart/shared';
import { Heart, Trash2, ShoppingCart, CheckSquare, Square } from 'lucide-react';

export default function AccountWishlistPage() {
  const router = useRouter();
  const { wishlist, toggleWishlist, addToCart, showToast } = useStore();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Resolve full product objects from wishlist IDs
  const wishlistProducts = wishlist
    .map((id) => mockProducts.find((p) => p.id === id))
    .filter(Boolean) as typeof mockProducts;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === wishlistProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(wishlistProducts.map((p) => p.id));
    }
  };

  const handleAddToCart = (product: (typeof mockProducts)[0]) => {
    addToCart(product);
    toggleWishlist(product.id);
    showToast(`Added ${product.name} to cart!`);
  };

  const handleAddSelectedToCart = () => {
    const selectedProducts = wishlistProducts.filter((p) => selectedIds.includes(p.id));
    selectedProducts.forEach((product) => {
      addToCart(product);
      toggleWishlist(product.id);
    });
    setSelectedIds([]);
    showToast(`Moved ${selectedProducts.length} items to cart!`);
  };

  return (
    <AccountLayout
      title="My Wishlist"
      subtitle="Save favourite everyday finds and purchase whenever you're ready"
      activeKey="wishlist"
    >
      <div className="space-y-4">
        {wishlistProducts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center">
            <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-800">Your wishlist is empty</h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto mt-1 mb-5">
              Explore groceries and home essentials to save your favourites.
            </p>
            <Button size="sm" onClick={() => router.push('/shop')}>
              Browse Products
            </Button>
          </div>
        ) : (
          <>
            {/* Batch Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-white rounded-2xl border border-gray-100 shadow-xs">
              <button
                type="button"
                onClick={selectAll}
                className="flex items-center gap-2 text-xs font-bold text-gray-700 hover:text-gray-900 cursor-pointer"
              >
                {selectedIds.length === wishlistProducts.length && wishlistProducts.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-[#0B5D3B]" />
                ) : (
                  <Square className="w-4 h-4 text-gray-400" />
                )}
                <span>Select All ({selectedIds.length}/{wishlistProducts.length})</span>
              </button>

              {selectedIds.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleAddSelectedToCart}
                  leftIcon={<ShoppingCart className="w-3.5 h-3.5" />}
                >
                  Move to Cart ({selectedIds.length})
                </Button>
              )}
            </div>

            {/* Wishlist Items */}
            <div className="space-y-3">
              {wishlistProducts.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl sm:rounded-3xl border border-gray-100 bg-white shadow-xs hover:border-orange-100 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleSelect(item.id)}
                        className="text-gray-400 hover:text-gray-700 cursor-pointer shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#0B5D3B]" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400" />
                        )}
                      </button>

                      <Link
                        href={`/product/${item.slug}`}
                        className="h-16 w-16 shrink-0 rounded-2xl bg-gray-50 p-2 border border-gray-100 flex items-center justify-center"
                      >
                        <img
                          src={item.images[0]}
                          alt={item.name}
                          className="h-full w-full object-contain"
                        />
                      </Link>

                      <div className="space-y-0.5 min-w-0">
                        <Link
                          href={`/product/${item.slug}`}
                          className="text-xs sm:text-sm font-bold text-gray-900 hover:text-[#0B5D3B] line-clamp-1"
                        >
                          {item.name}
                        </Link>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-gray-900">₹{item.price}</span>
                          {item.originalPrice > item.price && (
                            <span className="text-xs text-gray-400 line-through">
                              ₹{item.originalPrice}
                            </span>
                          )}
                          {item.discountPercent > 0 && (
                            <span className="text-[10px] font-bold text-[#FF7A00] bg-orange-50 px-1.5 py-0.5 rounded-sm">
                              -{item.discountPercent}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Button
                        size="sm"
                        onClick={() => handleAddToCart(item)}
                        leftIcon={<ShoppingCart className="w-3.5 h-3.5" />}
                      >
                        Add to Cart
                      </Button>
                      <button
                        type="button"
                        onClick={() => toggleWishlist(item.id)}
                        className="p-2 text-gray-400 hover:text-red-500 rounded-xl hover:bg-red-50 transition-colors cursor-pointer"
                        title="Remove from wishlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AccountLayout>
  );
}
