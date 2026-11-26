import React from 'react';
import Link from 'next/link';
import { Sparkles, PackageSearch } from 'lucide-react';
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
      newest: newest.items.slice(0, 5),
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
    <div className="space-y-6 sm:space-y-8 pb-8">
      {/* Category chips + hero (shared components) */}
      <div className="space-y-3 pt-3">
        <CategoryStrip categories={categories} />
        <HomeHero products={heroProducts} />
      </div>

      {/* Live campaigns from the admin (never inactive, scheduled or expired) */}
      <CampaignBanners campaigns={campaigns} />

      {/* Shop by price — real price-point collections */}
      {pricePoints.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6">
          <h2 className="mb-2 text-base sm:text-lg font-bold text-gray-900">Shop by price</h2>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
            {pricePoints.map((pp) => (
              <Link
                key={pp.amountPaise}
                href={`/shop?pricePoint=${pp.amountPaise}`}
                className="group flex flex-col items-center justify-center rounded-2xl border border-orange-100 bg-gradient-to-br from-brand-cream to-white py-3 sm:py-4 shadow-2xs transition-all hover:border-brand-orange/50 hover:shadow-xs"
              >
                <span className="text-[10px] sm:text-xs font-semibold text-gray-500">Everything at</span>
                <span className="text-lg sm:text-2xl font-black text-brand-orange group-hover:scale-105 transition-transform">{pp.label}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 3. Popular (by real units sold; falls back to featured) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-brand-cream text-brand-orange">
              <Sparkles className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">Popular right now</h2>
              <p className="text-xs text-gray-500">Everyday favourites from the 20Mart shelves</p>
            </div>
          </div>
          <Link
            href="/shop"
            className="text-xs sm:text-sm font-bold text-brand-orange hover:underline"
          >
            See More →
          </Link>
        </div>

        {trending.length ? (
          <ProductGrid
            products={trending}
            priorityCount={2}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 min-[960px]:grid-cols-5 gap-2 sm:gap-2.5"
          />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-10 text-center">
            <PackageSearch className="mb-2 h-8 w-8 text-brand-orange" />
            <p className="text-sm font-bold text-gray-900">{error ? 'Products are temporarily unavailable' : 'New products are on their way'}</p>
            <p className="mt-1 text-xs text-gray-500">{error ? 'Please refresh in a moment.' : 'Check back soon — we are stocking the shelves.'}</p>
          </div>
        )}
      </section>

      {/* New arrivals */}
      {newest.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-bold text-gray-900">New arrivals</h2>
            <Link href="/shop?sort=newest" className="text-xs sm:text-sm font-bold text-brand-orange hover:underline">
              See all →
            </Link>
          </div>
          <ProductGrid products={newest} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 min-[960px]:grid-cols-5 gap-2 sm:gap-2.5" />
        </section>
      )}

      {/* 5. Steal deals under ₹50 (only when real below-MRP products exist) */}
      <DealsShowcase products={deals} />

    </div>
    </>
  );
}
