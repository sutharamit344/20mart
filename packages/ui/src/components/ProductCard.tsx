'use client';

import React from 'react';
import { cn } from '../lib/utils';
import { Heart, Star, Plus } from 'lucide-react';
import { Product } from '@20mart/shared';
import { ProductImage } from './ProductImage';

export interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
  onToggleWishlist?: (product: Product) => void;
  onClick?: (product: Product) => void;
  isWishlisted?: boolean;
  compact?: boolean;
  className?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  onToggleWishlist,
  onClick,
  isWishlisted = false,
  compact = false,
  className,
}) => {
  return (
    <div
      className={cn(
        'group relative flex flex-col justify-between rounded-2xl border border-gray-100 bg-white transition-all duration-200 hover:shadow-md hover:border-orange-200 select-none',
        compact ? 'p-2 sm:p-2.5' : 'p-2.5 sm:p-3',
        className
      )}
    >
      {/* Top Image Container with Badges */}
      <div className="relative mb-2 w-full overflow-hidden rounded-xl bg-white border border-gray-100/80 aspect-square">
        {/* Discount Badge */}
        {product.discountPercent > 0 && (
          <div className="absolute left-2 top-2 z-10 rounded-md bg-[#FFF6E9] border border-orange-100 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-bold text-[#FF7A00]">
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
            'absolute right-2 top-2 z-10 flex h-6.5 w-6.5 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-white/95 backdrop-blur-xs shadow-xs transition-transform active:scale-90',
            isWishlisted ? 'text-red-500' : 'text-gray-400 hover:text-gray-600'
          )}
        >
          <Heart className={cn('h-3.5 w-3.5 sm:h-4 sm:w-4', isWishlisted && 'fill-current')} />
        </button>

        {/* Standardized Product Image with Hover Zoom */}
        <div
          onClick={() => onClick?.(product)}
          className="h-full w-full cursor-pointer flex items-center justify-center p-2"
        >
          <ProductImage
            src={product.images[0]}
            alt={product.name}
            aspectRatio="square"
            padding="none"
            className="group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      </div>

      {/* Info Section */}
      <div className="flex flex-1 flex-col justify-between">
        <div onClick={() => onClick?.(product)} className="cursor-pointer">
          {/* Subtitle / Brand / Category */}
          <p className="text-[10px] sm:text-[11px] font-medium text-gray-400 truncate">
            {product.subcategory || product.category}
          </p>

          {/* Product Title - Fixed 2-line clamp */}
          <h3
            className={cn(
              'font-semibold text-gray-800 line-clamp-2 hover:text-[#0B5D3B] transition-colors leading-snug',
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

        {/* Pricing & Add to Cart Button */}
        <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between gap-1.5 sm:gap-2">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1 sm:gap-1.5 flex-wrap">
              <span className="text-sm sm:text-base font-black text-gray-900">₹{product.price}</span>
              {product.originalPrice > product.price && (
                <span className="text-[10px] sm:text-xs text-gray-400 line-through">₹{product.originalPrice}</span>
              )}
            </div>
          </div>

          {/* Add Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddToCart?.(product);
            }}
            className={cn(
              'flex items-center justify-center font-bold text-white transition-all bg-[#FF7A00] hover:bg-[#E66E00] active:scale-95 shadow-xs rounded-lg sm:rounded-xl shrink-0',
              compact ? 'h-7 px-2 text-[11px] gap-0.5' : 'h-7 sm:h-8 px-2.5 sm:px-3 text-xs gap-1'
            )}
          >
            <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5 stroke-[2.5]" />
            <span>Add</span>
          </button>
        </div>
      </div>
    </div>
  );
};
