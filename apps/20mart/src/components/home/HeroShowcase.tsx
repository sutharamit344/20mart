'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { StorefrontProduct } from '@20mart/shared';
import { formatPaise } from '@20mart/shared';
import { resolveImageSrc } from '@20mart/ui';

/** Product tile used in the hero showcase. */
function HeroTile({
  product,
  priority,
  className = '',
}: {
  product: StorefrontProduct;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={`/product/${product.slug}`}
      className={`group flex flex-col rounded-xl bg-surface p-2 text-ink ring-1 ring-black/5 transition-shadow hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange-300 ${className}`}
    >
      <span className="relative aspect-square w-full overflow-hidden rounded-lg bg-surface-sunken">
        <Image
          src={resolveImageSrc(product.image?.url)}
          alt={product.image?.alt ?? product.name}
          fill
          sizes="(min-width: 1024px) 150px, (min-width: 768px) 140px, 128px"
          priority={priority}
          className="object-contain p-2 mix-blend-multiply transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </span>
      <span className="mt-1.5 block truncate text-xs font-medium text-ink-800">{product.name}</span>
      <span className="text-sm font-bold tabular-nums">{formatPaise(product.sellingPricePaise)}</span>
    </Link>
  );
}

function shuffleProducts(items: StorefrontProduct[]): StorefrontProduct[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function HeroShowcase({ products }: { products: StorefrontProduct[] }) {
  const [shuffled, setShuffled] = useState<StorefrontProduct[]>(products);

  useEffect(() => {
    if (products.length > 1) {
      setShuffled(shuffleProducts(products));
    }
  }, [products]);

  if (shuffled.length === 0) return null;

  const desktopTiles = shuffled.slice(0, 3);
  const mobileTiles = shuffled.slice(0, 6);

  return (
    <div className="md:col-span-6 lg:col-span-7">
      {/* Mobile: swipeable row */}
      <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-5 scrollbar-none md:hidden">
        {mobileTiles.map((p, i) => (
          <HeroTile key={p.id} product={p} priority={i === 0} className="w-32 shrink-0 snap-start" />
        ))}
      </div>
      {/* Tablet/desktop: clean single-row grid */}
      <div className="hidden p-4 md:block lg:p-6">
        <div className="grid grid-cols-3 gap-2.5 rounded-2xl bg-white/[0.06] p-2.5 ring-1 ring-inset ring-white/10 lg:gap-3 lg:p-3">
          {desktopTiles.map((p, i) => (
            <HeroTile key={p.id} product={p} priority={i === 0} />
          ))}
        </div>
      </div>
    </div>
  );
}
