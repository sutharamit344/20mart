import React from 'react';
import Link from 'next/link';
import { PackageSearch } from 'lucide-react';
import { EmptyState } from '@20mart/ui';
import { SectionHeader } from '../components/SectionHeader';
import { getCategories, getHomepageCampaigns, getPopular, getPricePoints, getProducts } from '../lib/catalog';
import { CampaignBanners, type HomeCampaign } from '../components/campaigns/CampaignBanners';
import { CategoryStrip } from '../components/CategoryStrip';
import { HomeHero } from '../components/home/HomeHero';
import { DealsShowcase } from '../components/home/DealsShowcase';
import { ProductGrid } from '../components/StoreProductCard';
import { captureException } from '@20mart/server';
import type { Metadata } from 'next';
import { organizationJsonLd, pageMetadata, websiteJsonLd } from '../lib/seo';
import { JsonLd } from '../components/JsonLd';
import { TrackView } from '../components/TrackView';

// Statically rendered and refreshed every minute (plus on-demand revalidation from the admin).
export const revalidate = 60;

const HOME_GRID = 'grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 min-[960px]:grid-cols-5';

export const metadata: Metadata = pageMetadata({ title: '20Mart – Your Everyday Value Market', path: '/' });

async function loadHome() {
  try {
    const [categories, popular, newest, deals, pricePoints, campaigns] = await Promise.all([
      getCategories(),
      getPopular(10),
      getProducts({ sort: 'newest', pageSize: 10, inStock: true }),
      getProducts({ deals: true, maxPrice: 5000, sort: 'price_asc', pageSize: 5, inStock: true }),
      getPricePoints(),
      getHomepageCampaigns().catch(() => []),
    ]);
    return {
      categories,
      trending: popular,
      // Don't repeat products already shown in "Popular right now" (falls back to the plain list if that empties it).
      newest: (() => {
        const shown = new Set(popular.map((p) => p.id));
        const fresh = newest.items.filter((p) => !shown.has(p.id));
        return (fresh.length >= 2 ? fresh : newest.items).slice(0, 5);
      })(),
      deals: deals.items,
      pricePoints,
      campaigns: campaigns as unknown as HomeCampaign[],
      heroProducts: newest.items.filter((product) => product.image).slice(0, 6),
      error: false,
    };
  } catch (e) {
    captureException(e, 'db.catalog_unavailable', { category: 'db', what: 'home page' });
    return { categories: [], trending: [], newest: [], deals: [], pricePoints: [], campaigns: [] as HomeCampaign[], heroProducts: [], error: true };
  }
}

export default async function HomePage() {
  const { categories, trending, newest, deals, pricePoints, campaigns, heroProducts, error } = await loadHome();

  return (
    <>
    {/* Outside the space-y container: a <script> sibling would otherwise add top margin to the first section */}
    <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
    <TrackView name="HOME_VIEWED" />
    <div className="space-y-8 pb-8 sm:space-y-10">
      {/* Category chips + hero (shared components) */}
      <div className="space-y-3 pt-3">
        <CategoryStrip categories={categories} />
        <HomeHero products={heroProducts} />
      </div>

      {/* Live campaigns from the admin (never inactive, scheduled or expired) */}
      <CampaignBanners campaigns={campaigns} />

      {/* Shop by price — real price-point collections */}
      {pricePoints.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6" aria-labelledby="shop-by-price">
          <SectionHeader id="shop-by-price" title="Shop by price" subtitle="Everyday essentials at fixed prices" />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
            {pricePoints.map((pp) => (
              <Link
                key={pp.amountPaise}
                href={`/shop?pricePoint=${pp.amountPaise}`}
                className="group flex flex-col items-center justify-center rounded-2xl border border-line-subtle bg-surface py-3 shadow-card transition-[border-color,box-shadow] hover:border-brand-orange/40 hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 sm:py-4"
              >
                <span className="text-2xs font-medium text-ink-500">Everything at</span>
                <span className="text-xl font-bold tabular-nums text-brand-orange-700 sm:text-2xl">{pp.label}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Popular (by real units sold; falls back to featured) */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6" aria-labelledby="popular-title">
        <SectionHeader id="popular-title" title="Popular right now" subtitle="Everyday favourites from the 20Mart shelves" href="/shop" />
        {trending.length ? (
          <ProductGrid products={trending} priorityCount={2} className={HOME_GRID} />
        ) : (
          <div className="rounded-2xl border border-dashed border-line bg-surface">
            <EmptyState
              icon={<PackageSearch className="h-7 w-7" />}
              title={error ? 'Products are temporarily unavailable' : 'New products are on their way'}
              description={error ? 'Please refresh in a moment.' : 'Check back soon — we are stocking the shelves.'}
            />
          </div>
        )}
      </section>

      {/* New arrivals */}
      {newest.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6" aria-labelledby="new-title">
          <SectionHeader id="new-title" title="New arrivals" subtitle="Just added to the shelves" href="/shop?sort=newest" />
          <ProductGrid products={newest} className={HOME_GRID} />
        </section>
      )}

      {/* 5. Steal deals under ₹50 (only when real below-MRP products exist) */}
      <DealsShowcase products={deals} />

    </div>
    </>
  );
}
