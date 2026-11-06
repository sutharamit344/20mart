'use client';

import React from 'react';
import { cn } from '../lib/utils';
import { Heart, Star, Plus, Minus } from 'lucide-react';
import { Product } from '@20mart/shared';
import { ProductImage } from './ProductImage';

export interface ProductCardProps {
  product: Product;
  quantity?: number;
  onAddToCart?: (product: Product) => void;
  onIncrement?: (product: Product) => void;
  onDecrement?: (product: Product) => void;
  onToggleWishlist?: (product: Product) => void;
  onClick?: (product: Product) => void;
  isWishlisted?: boolean;
  compact?: boolean;
  className?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  quantity = 0,
  onAddToCart,
  onIncrement,
  onDecrement,
  onToggleWishlist,
  onClick,
  isWishlisted = false,
  compact = false,
  className,
}) => {
  return (
    <div
      className={cn(
        'group relative flex flex-col justify-between rounded-2xl border border-gray-200/90 bg-white transition-all duration-300 hover:border-orange-300 hover:shadow-[0_8px_24px_-6px_rgba(255,122,0,0.14),0_2px_8px_-2px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 select-none',
        compact ? 'p-2 sm:p-2.5' : 'p-2.5 sm:p-3',
        className
      )}
    >
      {/* Top Image Container with Badges */}
      <div className="relative mb-2 w-full overflow-hidden rounded-xl bg-[#F9FAFB] border border-gray-100 aspect-square flex items-center justify-center">
        {/* Discount Badge */}
        {product.discountPercent > 0 && (
          <div className="absolute left-2 top-2 z-10 rounded-md bg-[#FFF6E9] border border-orange-200/80 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-black text-[#FF7A00] shadow-2xs">
            -{product.discountPercent}%
          </div>
        )}

        {/* Wishlist Button */}
        <button
          type="button"
          aria-label="Add to wishlist"
          onClick={(e) => {
            e.stopPropagation();
            onToggleWishlist?.(product);
          }}
          className={cn(
            'absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 backdrop-blur-xs border border-gray-100 shadow-xs transition-all hover:scale-110 active:scale-95 cursor-pointer',
            isWishlisted ? 'text-red-500' : 'text-gray-400 hover:text-red-400'
          )}
        >
          <Heart className={cn('h-3.5 w-3.5', isWishlisted && 'fill-current')} />
        </button>

        {/* Standardized Product Image with Hover Zoom */}
        <div
          onClick={() => onClick?.(product)}
          className="h-full w-full cursor-pointer flex items-center justify-center"
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
        <div onClick={() => onClick?.(product)} className="cursor-pointer">
          {/* Subtitle / Brand / Category */}
          <p className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider truncate">
            {product.subcategory || product.category}
          </p>

          {/* Product Title - Fixed 2-line clamp with uniform height */}
          <h3
            className={cn(
              'font-semibold text-gray-800 line-clamp-2 group-hover:text-[#0B5D3B] transition-colors leading-snug',
              compact ? 'text-xs mt-0.5 h-8' : 'text-xs sm:text-[13px] mt-1 h-8 sm:h-9'
            )}
            title={product.name}
          >
            {product.name}
          </h3>

          {/* Ratings */}
          {product.rating && (
            <div className="mt-1 flex items-center gap-1">
              <div className="flex items-center text-amber-500">
                <Star className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-current" />
              </div>
              <span className="text-[10px] sm:text-[11px] font-bold text-gray-700">{product.rating}</span>
              <span className="text-[9px] sm:text-[10px] text-gray-400">({product.reviewCount})</span>
            </div>
          )}
        </div>

        {/* Pricing & Add to Cart / Counter Button */}
        <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between gap-1.5 sm:gap-2">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1 sm:gap-1.5 flex-wrap">
              <span className="text-sm sm:text-base font-black text-gray-900">₹{product.price}</span>
              {product.originalPrice > product.price && (
                <span className="text-[10px] sm:text-xs text-gray-400 line-through">₹{product.originalPrice}</span>
              )}
            </div>
          </div>

          {/* If item in cart (quantity > 0): Show Counter */}
          {quantity > 0 ? (
            <div
              className={cn(
                'flex items-center justify-between font-bold text-white bg-gradient-to-r from-[#FF7A00] to-[#FF6200] rounded-lg sm:rounded-xl shadow-xs shrink-0 select-none overflow-hidden border border-orange-500/20',
                compact ? 'h-7 min-w-[76px]' : 'h-8 min-w-[84px]'
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={(e) => {
                  e.stopPropagation();
                  onDecrement?.(product);
                }}
                className="h-full px-2 flex items-center justify-center hover:bg-black/15 active:scale-90 transition-all cursor-pointer text-white"
              >
                <Minus className="h-3 w-3 sm:h-3.5 sm:w-3.5 stroke-[2.5]" />
              </button>
              <span className="px-1 text-center font-black text-white text-xs sm:text-[13px] leading-none min-w-[16px]">
                {quantity}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={(e) => {
                  e.stopPropagation();
                  onIncrement?.(product);
                }}
                className="h-full px-2 flex items-center justify-center hover:bg-black/15 active:scale-90 transition-all cursor-pointer text-white"
              >
                <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5 stroke-[2.5]" />
              </button>
            </div>
          ) : (
            /* Otherwise: Show "+ Add" Button with FIXED GUARANTEED HEIGHT */
            <button
              type="button"
              aria-label={`Add ${product.name} to cart`}
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart?.(product);
              }}
              className={cn(
                'flex items-center justify-center font-bold text-white transition-all bg-[#FF7A00] hover:bg-[#E66E00] active:scale-95 shadow-xs hover:shadow-sm rounded-lg sm:rounded-xl shrink-0 cursor-pointer select-none leading-none',
                compact ? 'h-7 px-2.5 text-[11px] gap-0.5 min-w-[62px]' : 'h-8 px-3.5 text-xs gap-1 min-w-[72px]'
              )}
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>Add</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
