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

/**
 * Storefront product tile. One border, one loud element (the cart control), price as the strongest text.
 * The product name is a real button stretched over the card, so the whole tile is clickable and keyboard
 * reachable; the wishlist and cart controls sit above it (z-10).
 */
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
  const hasMrp = product.mrpPaise > product.sellingPricePaise;

  const controlH = compact ? 'h-8' : 'h-8 sm:h-9';

  return (
    <div
      className={cn(
        'group relative flex h-full flex-col rounded-2xl border border-line-subtle bg-surface transition-[border-color,box-shadow] duration-150 hover:border-line hover:shadow-card-hover select-none',
        compact ? 'p-2' : 'p-2 sm:p-2.5',
        className
      )}
    >
      {/* Image well: no border of its own, consistent 1:1 fit for every product photo */}
      <div className="relative overflow-hidden rounded-xl bg-surface-sunken">
        <ProductImage
          src={product.image?.url}
          alt={product.image?.alt ?? product.name}
          aspectRatio="square"
          padding={compact ? 'sm' : 'md'}
          objectFit="contain"
          priority={priority}
          className={cn('rounded-none bg-transparent', outOfStock && 'opacity-60 grayscale-[35%]')}
          imgClassName="mix-blend-multiply transition-transform duration-300 group-hover:scale-[1.03]"
        />

        {outOfStock ? (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-ink/80 px-1.5 py-0.5 text-2xs font-semibold text-white">Out of stock</span>
        ) : product.discountPercent > 0 ? (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-brand-orange-50 px-1.5 py-0.5 text-2xs font-bold tabular-nums text-brand-orange-700 ring-1 ring-inset ring-brand-orange-200/70">
            {product.discountPercent}% off
          </span>
        ) : null}

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
              'absolute right-1 top-1 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 shadow-card transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50',
              isWishlisted ? 'text-danger' : 'text-ink-400 hover:text-danger'
            )}
          >
            <Heart className={cn('h-4 w-4', isWishlisted && 'fill-current')} />
          </button>
        )}
      </div>

      {/* Info */}
      <div className={cn('flex flex-1 flex-col', compact ? 'pt-1.5' : 'pt-2')}>
        <p className="truncate text-2xs font-medium text-ink-500">
          {lowStock ? (
            <span className="inline-flex items-center gap-1 font-semibold text-warning">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden />
              Only a few left
            </span>
          ) : (
            product.brand?.name ?? product.category.name
          )}
        </p>
        <h3 className={cn('mt-0.5 font-medium leading-snug text-ink-800', compact ? 'text-xs' : 'text-xs sm:text-sm')} title={product.name}>
          <button
            type="button"
            onClick={() => onClick?.(product)}
            className={cn(
              'line-clamp-2 w-full text-left cursor-pointer group-hover:text-ink focus:outline-none',
              // Stretched hit area: the whole card opens the product; focus ring is drawn on the card outline.
              "after:absolute after:inset-0 after:z-0 after:rounded-2xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-brand-orange/60"
            )}
          >
            {product.name}
          </button>
        </h3>

        <div className={cn('mt-auto flex items-end justify-between gap-1.5', compact ? 'pt-1.5' : 'pt-2')}>
          <div className="min-w-0 leading-tight">
            <span className={cn('block font-bold tabular-nums text-ink', compact ? 'text-sm' : 'text-sm sm:text-base')}>
              {formatPaise(product.sellingPricePaise)}
            </span>
            {hasMrp && (
              <span className="block text-2xs tabular-nums text-ink-400">
                MRP <span className="line-through">{formatPaise(product.mrpPaise)}</span>
              </span>
            )}
          </div>

          {outOfStock ? (
            <span
              className={cn('relative z-10 inline-flex shrink-0 items-center justify-center rounded-lg bg-surface-muted px-2.5 text-2xs font-semibold text-ink-400', controlH)}
              aria-label="Out of stock"
            >
              Sold out
            </span>
          ) : quantity > 0 ? (
            <div
              className={cn('relative z-10 flex shrink-0 items-center rounded-lg bg-brand-orange text-white shadow-sm', controlH)}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                aria-label={`Decrease quantity of ${product.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onDecrement?.(product);
                }}
                className="flex h-full w-7 sm:w-8 items-center justify-center rounded-l-lg hover:bg-brand-orange-600 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80"
              >
                <Minus className="h-3.5 w-3.5 stroke-[2.5]" />
              </button>
              <span className="min-w-[1.25rem] text-center text-xs font-bold tabular-nums" aria-live="polite">
                {quantity}
              </span>
              <button
                type="button"
                aria-label={`Increase quantity of ${product.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onIncrement?.(product);
                }}
                className="flex h-full w-7 sm:w-8 items-center justify-center rounded-r-lg hover:bg-brand-orange-600 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80"
              >
                <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
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
                'relative z-10 inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-brand-orange bg-surface px-3 text-xs font-semibold text-brand-orange transition-colors hover:bg-brand-orange hover:text-white active:scale-[0.97] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 focus-visible:ring-offset-1',
                controlH
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
