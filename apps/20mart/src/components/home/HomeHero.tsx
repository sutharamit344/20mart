import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Truck, Tag } from 'lucide-react';
import type { StorefrontProduct } from '@20mart/shared';
import { formatPaise } from '@20mart/shared';
import { resolveImageSrc } from '@20mart/ui';

/** Product tile used in the hero showcase (links to the same products shown in New arrivals). */
function HeroTile({ product, priority, className = '' }: { product: StorefrontProduct; priority?: boolean; className?: string }) {
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

/**
 * Home hero: solid brand green, one primary CTA, factual delivery/price notes (the same ones shown in the
 * header and the shipping policy), and a quiet showcase of real in-stock products in a single row.
 */
export function HomeHero({ products }: { products: StorefrontProduct[] }) {
  const desktopTiles = products.slice(0, 3);
  const mobileTiles = products.slice(0, 6);

  return (
    <section className="mx-auto max-w-7xl sm:px-6" aria-labelledby="home-hero-title">
      <div className="h-auto overflow-hidden bg-brand-green text-white sm:rounded-2xl">
        <div className="grid grid-cols-1 items-center md:grid-cols-12">
          <div className="space-y-3 px-4 py-5 sm:px-6 sm:py-6 md:col-span-6 md:py-6 lg:col-span-5 lg:py-7 lg:pl-8">
            <p className="text-2xs font-semibold uppercase tracking-[0.12em] text-brand-orange-300">Everyday essentials</p>
            <h1 id="home-hero-title" className="font-heading text-2xl font-bold leading-tight tracking-tight sm:text-3xl lg:text-[2rem]">
              Your everyday <span className="text-brand-orange-300">value market</span>
            </h1>
            <p className="max-w-md text-xs sm:text-sm leading-relaxed text-white/80">
              Useful products, affordable prices, everyday convenience. Household, kitchen and cleaning essentials delivered to your door.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <Link
                href="/shop"
                className="group inline-flex h-10 items-center gap-2 rounded-xl bg-brand-orange px-4.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-green"
              >
                Explore products
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/deals"
                className="inline-flex h-10 items-center rounded-xl px-3.5 text-sm font-semibold text-white/90 ring-1 ring-inset ring-white/25 transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                Daily deals
              </Link>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-1 pt-0.5 text-xs text-white/80">
              <li className="flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-brand-orange-300" aria-hidden />
                Free delivery above ₹199
              </li>
              <li className="flex items-center gap-1.5">
                <Tag className="h-4 w-4 text-brand-orange-300" aria-hidden />
                Prices from ₹20
              </li>
            </ul>
          </div>

          {desktopTiles.length > 0 && (
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
          )}
        </div>
      </div>
    </section>
  );
}
