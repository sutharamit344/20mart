'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ProductCard } from '@20mart/ui';
import type { StorefrontProduct } from '@20mart/shared';
import { useStore } from '../lib/store';
import { useProductAvailability } from '../lib/location';

/** ProductCard wired to the client cart/wishlist. Safe to render from Server Components. */
export function StoreProductCard({ product, compact, priority }: { product: StorefrontProduct; compact?: boolean; priority?: boolean }) {
  const router = useRouter();
  const { getItemQuantity, updateItemQuantity, isWishlisted, toggleWishlist } = useStore();
  // At a served delivery location, show that location's stock instead of the cached global state.
  const avail = useProductAvailability(product.id);
  const shown = avail && avail.state !== product.stockState ? { ...product, stockState: avail.state } : product;
  return (
    <ProductCard
      product={shown}
      compact={compact}
      priority={priority}
      quantity={product.hasVariants ? 0 : getItemQuantity(product.id)}
      isWishlisted={isWishlisted(product.id)}
      onClick={(p) => router.push(`/product/${p.slug}`)}
      onAddToCart={(p) => (p.hasVariants ? router.push(`/product/${p.slug}`) : updateItemQuantity(p, 1))}
      onIncrement={(p) => updateItemQuantity(p, 1)}
      onDecrement={(p) => updateItemQuantity(p, -1)}
      onToggleWishlist={(p) => toggleWishlist(p.id)}
    />
  );
}

export function ProductGrid({
  products,
  compact,
  priorityCount = 0,
  className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3',
}: {
  products: StorefrontProduct[];
  compact?: boolean;
  priorityCount?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {products.map((p, i) => (
        <StoreProductCard key={p.id} product={p} compact={compact} priority={i < priorityCount} />
      ))}
    </div>
  );
}
