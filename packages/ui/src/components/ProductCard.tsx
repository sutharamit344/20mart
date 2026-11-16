'use client';

import React from 'react';
import { cn } from '../lib/utils';
import { Heart, Plus, Minus } from 'lucide-react';
import { formatPaise, type StorefrontProduct } from '@20mart/shared';
import { ProductImage } from './ProductImage';

export interface ProductCardProps {
  product: StorefrontProduct;
  quantity?: number;
  onAddToCart?: (product: StorefrontProduct) => void;
  onIncrement?: (product: StorefrontProduct) => void;
  onDecrement?: (product: StorefrontProduct) => void;
  onToggleWishlist?: (product: StorefrontProduct) => void;
  onClick?: (product: StorefrontProduct) => void;
  isWishlisted?: boolean;
  compact?: boolean;
  /** Load the image eagerly (above-the-fold cards). */
  priority?: boolean;
  className?: string;
}

const ProductCardComponent: React.FC<ProductCardProps> = ({
  product,
  quantity = 0,
  onAddToCart,
  onIncrement,
  onDecrement,
  onToggleWishlist,
  onClick,
  isWishlisted = false,
  compact = false,
  priority = false,
  className,
}) => {
  const outOfStock = product.stockState === 'OUT';
  const lowStock = product.stockState === 'LOW';

  return (
    <div
      className={cn(
        'group relative flex flex-col justify-between h-full rounded-xl sm:rounded-2xl border border-gray-200/90 bg-white transition-all duration-300 hover:border-orange-300 hover:shadow-[0_6px_20px_-4px_rgba(255,122,0,0.14),0_2px_6px_-2px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 select-none',
        compact ? 'p-1.5 sm:p-2' : 'p-2 sm:p-2.5',
        className
      )}
    >
      {/* Image */}
      <div className="relative mb-1.5 w-full overflow-hidden rounded-lg sm:rounded-xl bg-[#F9FAFB] border border-gray-100 aspect-square flex items-center justify-center">
        {product.discountPercent > 0 && !outOfStock && (
          <div className="absolute left-1.5 top-1.5 z-10 rounded-md bg-[#FFF6E9] border border-orange-200/80 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black text-[#FF7A00] shadow-2xs">
            -{product.discountPercent}%
          </div>
        )}
        {outOfStock && (
          <div className="absolute left-1.5 top-1.5 z-10 rounded-md bg-gray-900/80 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-white">
            Out of stock
          </div>
        )}

        {onToggleWishlist && (
          <button
            type="button"
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            aria-pressed={isWishlisted}
            onClick={(e) => {
              e.stopPropagation();
              onToggleWishlist(product);
            }}
            className={cn(
              'absolute right-1.5 top-1.5 z-10 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-white/95 backdrop-blur-xs border border-gray-100 shadow-xs transition-all hover:scale-110 active:scale-95 cursor-pointer',
              isWishlisted ? 'text-red-500' : 'text-gray-400 hover:text-red-400'
            )}
          >
            <Heart className={cn('h-3 w-3 sm:h-3.5 sm:w-3.5', isWishlisted && 'fill-current')} />
          </button>
        )}

        <div
          onClick={() => onClick?.(product)}
          className={cn('h-full w-full cursor-pointer flex items-center justify-center p-1 sm:p-1.5', outOfStock && 'opacity-60 grayscale-[35%]')}
        >
          <ProductImage
            src={product.image?.url}
            alt={product.image?.alt ?? product.name}
            aspectRatio="square"
            padding="none"
            objectFit="contain"
            priority={priority}
            className="group-hover:scale-105 transition-transform duration-300 bg-transparent"
          />
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col justify-between">
        <div onClick={() => onClick?.(product)} className="cursor-pointer">
          <p className="text-[9px] sm:text-[10px] font-semibold text-gray-500 uppercase tracking-wider truncate">
            {product.brand ? product.brand.name : product.category.name}
          </p>
          <h3
            className={cn(
              'font-semibold text-gray-800 line-clamp-2 group-hover:text-[#0B5D3B] transition-colors leading-snug',
              compact ? 'text-[11px] sm:text-xs mt-0.5 h-7 sm:h-8' : 'text-xs sm:text-[13px] mt-0.5 h-8 sm:h-9'
            )}
            title={product.name}
          >
            {product.name}
          </h3>
          {/* Fixed-height availability line keeps card heights aligned */}
          <p className="mt-0.5 h-4 text-[10px] font-semibold leading-4">
            {lowStock ? <span className="text-amber-700">Only a few left</span> : outOfStock ? <span className="text-gray-500">Currently unavailable</span> : null}
          </p>
        </div>

        <div className="mt-auto pt-1.5 border-t border-gray-100 flex items-center justify-between gap-1 sm:gap-2">
          <div className="flex items-baseline gap-1 sm:gap-1.5 flex-wrap min-w-0">
            <span className="text-xs sm:text-sm md:text-base font-black text-gray-900">{formatPaise(product.sellingPricePaise)}</span>
            {product.mrpPaise > product.sellingPricePaise && (
              <span className="text-[10px] sm:text-xs text-gray-500 line-through">{formatPaise(product.mrpPaise)}</span>
            )}
          </div>

          {outOfStock ? (
            <span
              className={cn(
                'flex items-center justify-center rounded-lg sm:rounded-xl bg-gray-100 text-gray-400 font-bold shrink-0 leading-none',
                compact ? 'h-6.5 px-2 text-[10px] min-w-[56px]' : 'h-7 sm:h-7.5 px-2.5 text-[11px] min-w-[64px] sm:min-w-[70px]'
              )}
              aria-label="Out of stock"
            >
              Sold out
            </span>
          ) : quantity > 0 ? (
            <div
              className={cn(
                'flex items-center justify-between font-bold text-white bg-gradient-to-r from-[#FF7A00] to-[#FF6200] rounded-lg sm:rounded-xl shadow-xs shrink-0 select-none overflow-hidden border border-orange-500/20',
                compact ? 'h-6.5 min-w-[68px]' : 'h-7 sm:h-7.5 min-w-[74px] sm:min-w-[80px]'
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
                className="h-full px-1.5 sm:px-2 flex items-center justify-center hover:bg-black/15 active:scale-90 transition-all cursor-pointer text-white"
              >
                <Minus className="h-3 w-3 stroke-[2.5]" />
              </button>
              <span className="px-1 text-center font-black text-white text-[11px] sm:text-xs leading-none min-w-[14px]" aria-live="polite">
                {quantity}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={(e) => {
                  e.stopPropagation();
                  onIncrement?.(product);
                }}
                className="h-full px-1.5 sm:px-2 flex items-center justify-center hover:bg-black/15 active:scale-90 transition-all cursor-pointer text-white"
              >
                <Plus className="h-3 w-3 stroke-[2.5]" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              aria-label={`Add ${product.name} to cart`}
              onClick={(e) => {
                e.stopPropagation();
                onAddToCart?.(product);
              }}
              className={cn(
                'flex items-center justify-center font-bold text-white transition-all bg-[#FF7A00] hover:bg-[#E66E00] active:scale-95 shadow-xs hover:shadow-sm rounded-lg sm:rounded-xl shrink-0 cursor-pointer select-none leading-none',
                compact ? 'h-6.5 px-2 text-[10px] sm:text-[11px] gap-0.5 min-w-[56px]' : 'h-7 sm:h-7.5 px-2.5 sm:px-3 text-xs gap-1 min-w-[64px] sm:min-w-[70px]'
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

export const ProductCard = React.memo(ProductCardComponent, (prev, next) => {
  return (
    prev.product.id === next.product.id &&
    prev.product.stockState === next.product.stockState &&
    prev.product.sellingPricePaise === next.product.sellingPricePaise &&
    prev.quantity === next.quantity &&
    prev.isWishlisted === next.isWishlisted &&
    prev.compact === next.compact &&
    prev.className === next.className
  );
});

ProductCard.displayName = 'ProductCard';
