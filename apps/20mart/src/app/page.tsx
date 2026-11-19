import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Sparkles, Flame, Truck, PackageSearch } from 'lucide-react';
import { getCategories, getHomepageCampaigns, getPopular, getPricePoints, getProducts } from '../lib/catalog';
import { CampaignBanners, type HomeCampaign } from '../components/campaigns/CampaignBanners';
import { getCategoryTheme } from '../lib/category-theme';
import { ProductGrid } from '../components/StoreProductCard';
import { captureException } from '@20mart/server';
import type { Metadata } from 'next';
import { organizationJsonLd, pageMetadata, websiteJsonLd } from '../lib/seo';
import { JsonLd } from '../components/JsonLd';
import { TrackView } from '../components/TrackView';
import { formatPaise } from '@20mart/shared';
import { resolveImageSrc } from '@20mart/ui';

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
      {/* Top Section: Category Strip + Hero Banner with tight Amazon-style spacing & gap */}
      <div className="space-y-1.5 sm:space-y-2">
        {/* 1. Category Scroll Strip (Amazon-style: compact spacing, gap, font-size) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-1 sm:pt-1.5 pb-0">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto whitespace-nowrap scrollbar-none py-0.5">
            {categories.map((cat) => {
              const theme = getCategoryTheme(cat.slug);
              const Icon = theme.icon;
              return (
                <Link
                  key={cat.id}
                  href={`/category/${cat.slug}`}
                  className="group flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1 rounded-full bg-white hover:bg-orange-50/20 border border-gray-200/90 hover:border-[#FF7A00]/50 shadow-2xs hover:shadow-xs shrink-0 cursor-pointer select-none transition-all duration-150"
                >
                  <div
                    style={{ backgroundColor: theme.bg }}
                    className="flex h-5 w-5 sm:h-5.5 sm:w-5.5 items-center justify-center rounded-full shrink-0"
                  >
                    <Icon
                      className="h-3 w-3 sm:h-3.5 sm:w-3.5"
                      style={{ color: theme.iconColor }}
                    />
                  </div>
                  <span className="text-[13px] sm:text-sm font-medium text-gray-700 group-hover:text-[#FF7A00] transition-colors whitespace-nowrap">
                    {cat.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* 2. Hero Banner (Screen 01 Desktop & Mobile 01) */}
        <section className="max-w-7xl mx-auto px-0 sm:px-6">
          <div className="relative overflow-hidden rounded-none sm:rounded-3xl bg-gradient-to-br from-[#064E2E] via-[#0B5D38] to-[#04341E] text-white shadow-xl shadow-emerald-950/15 border-y sm:border border-emerald-600/20">
          {/* Vibrant radiant glows & ambient lighting */}
          <div className="absolute -top-24 -right-24 w-96 sm:w-[500px] h-96 sm:h-[500px] rounded-full bg-emerald-400/25 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-10 w-80 h-80 rounded-full bg-emerald-300/20 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-amber-400/15 blur-3xl pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(52,211,153,0.22),transparent_65%)] pointer-events-none" />
          <div className="absolute inset-0 opacity-[0.035] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 items-stretch">
            {/* Left Content */}
            <div className="md:col-span-6 lg:col-span-5 xl:col-span-5 p-5 sm:p-8 lg:p-10 space-y-3.5 sm:space-y-5 flex flex-col justify-center">
              {/* Coming Soon Pill (Screen 01) */}
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-gradient-to-r from-[#FFD027] via-[#FFB703] to-[#FFA200] text-gray-950 text-xs font-black tracking-wide uppercase shadow-md shadow-amber-950/20 border border-yellow-200/60 w-fit">
                <Sparkles className="w-3.5 h-3.5 fill-current text-gray-950" />
                <span>Coming Soon</span>
              </div>

              {/* Headline */}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-black tracking-tight text-white leading-[1.15]">
                Your Everyday <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 bg-clip-text text-transparent drop-shadow-[0_2px_12px_rgba(251,191,36,0.3)]">
                  Value Market
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-xs sm:text-sm lg:text-[15px] text-emerald-50/95 max-w-md font-medium leading-relaxed">
                Useful products, Affordable prices, Everyday convenience. Curated household, kitchen, and cleaning necessities delivered straight to your door.
              </p>

              {/* Action Buttons + trust chips */}
              <div className="flex items-center gap-3 pt-1 flex-wrap">
                <Link
                  href="/shop"
                  className="group flex items-center gap-2 rounded-full font-bold px-6 py-2.5 sm:py-3 text-xs sm:text-sm bg-gradient-to-r from-[#FF7A00] to-[#FF5500] hover:from-[#FF8A00] hover:to-[#FF6600] text-white shadow-lg shadow-orange-950/30 border border-white/20 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
                >
                  <span>Explore Products</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-emerald-50 backdrop-blur-sm">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  100% Everyday Essentials
                </span>
              </div>

              {/* Mobile: offer chips sit in the flow instead of floating over the product tiles */}
              <div className="flex flex-wrap gap-2 md:hidden">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-black text-[#0B5D38] shadow-md">
                  <Truck className="w-3.5 h-3.5" />
                  Free Delivery &gt; ₹199
                </span>
                <span className="inline-flex items-center rounded-full bg-gradient-to-r from-[#FF7A00] to-[#FF5500] px-3 py-1 text-[11px] font-black text-white shadow-md">
                  Starts @ ₹20!
                </span>
              </div>
            </div>

            {/* Right: featured products in a compact, staggered 2×2 showcase */}
            <div className="md:col-span-6 lg:col-span-7 xl:col-span-7 relative flex items-center justify-center">
              {/* Soft glow behind the showcase */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-72 sm:w-[420px] h-72 sm:h-[420px] rounded-full bg-gradient-to-tr from-emerald-300/25 via-emerald-200/10 to-transparent blur-3xl" />
              </div>

              {/* Mobile: swipeable row (image tiles link to the same products shown in New Arrivals) */}
              {heroProducts.length > 0 && (
                <div className="md:hidden relative w-full px-4 pb-5">
                  <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory">
                    {heroProducts.map((product, index) => (
                      <Link
                        key={product.id}
                        href={`/product/${product.slug}`}
                        className="group snap-start flex w-[140px] shrink-0 flex-col rounded-2xl bg-white p-2 text-left text-gray-900 shadow-lg shadow-emerald-950/25 transition active:scale-[0.98]"
                      >
                        <span className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#F6F7F5]">
                          <Image src={resolveImageSrc(product.image?.url)} alt={product.image?.alt ?? product.name} fill sizes="140px" priority={index === 0} className="object-contain p-1.5" />
                        </span>
                        <span className="mt-1.5 block truncate text-[11px] font-bold">{product.name}</span>
                        <span className="text-[11px] font-black text-[#0B5D3B]">{formatPaise(product.sellingPricePaise)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Desktop: centred showcase; the right column is offset so the grid feels lively, never clipped */}
              <div className="relative hidden md:block py-10 lg:py-12">
                {heroProducts.length > 0 && (
                  <div className={`grid gap-4 lg:gap-5 ${heroProducts.length === 1 ? 'grid-cols-1' : heroProducts.length >= 3 ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2'}`}>
                    {heroProducts.map((product, index) => (
                      <Link
                        key={product.id}
                        href={`/product/${product.slug}`}
                        className={`group ${index >= 4 ? 'hidden lg:flex' : 'flex'} w-[150px] lg:w-[160px] flex-col rounded-2xl bg-white p-2.5 text-left text-gray-900 shadow-xl shadow-emerald-950/30 ring-1 ring-white/60 transition duration-200 hover:-translate-y-1.5 hover:shadow-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${index % 2 === 1 ? 'md:translate-y-6 md:hover:translate-y-4' : 'md:translate-y-0 md:hover:-translate-y-1.5'} ${heroProducts.length >= 3 ? (index % 3 === 1 ? 'lg:translate-y-6 lg:hover:translate-y-4' : 'lg:translate-y-0 lg:hover:-translate-y-1.5') : ''}`}
                      >
                        <span className="relative aspect-[5/4] w-full overflow-hidden rounded-xl bg-[#F6F7F5]">
                          <Image src={resolveImageSrc(product.image?.url)} alt={product.image?.alt ?? product.name} fill sizes="(min-width: 1024px) 160px, 150px" priority={index === 0} className="object-contain p-2 transition-transform duration-300 group-hover:scale-105" />
                        </span>
                        <span className="mt-2 block w-full truncate text-xs font-bold group-hover:text-[#C25D00]">{product.name}</span>
                        <span className="mt-0.5 text-sm font-black text-[#0B5D3B]">{formatPaise(product.sellingPricePaise)}</span>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Stickers anchored to the showcase corners (outside the tiles' content area) */}
                <div className={`${heroProducts.length ? 'absolute top-3 -right-6 lg:-right-10' : 'relative mb-3'} z-10 flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[11px] font-black text-[#0B5D38] shadow-lg shadow-emerald-950/25 rotate-3`}>
                  <Truck className="w-3.5 h-3.5" />
                  <span>Free Delivery &gt; ₹199</span>
                </div>
                <div className={`${heroProducts.length ? 'absolute bottom-1 -left-8 lg:-left-12' : 'relative'} z-10 w-fit rounded-full bg-gradient-to-r from-[#FF7A00] to-[#FF5500] px-4 py-1.5 text-sm font-black text-white shadow-xl shadow-orange-950/35 border-2 border-white -rotate-3`}>
                  Starts @ ₹20!
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
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
                className="group flex flex-col items-center justify-center rounded-2xl border border-orange-100 bg-gradient-to-br from-[#FFF6E9] to-white py-3 sm:py-4 shadow-2xs transition-all hover:border-[#FF7A00]/50 hover:shadow-xs"
              >
                <span className="text-[10px] sm:text-xs font-semibold text-gray-500">Everything at</span>
                <span className="text-lg sm:text-2xl font-black text-[#FF7A00] group-hover:scale-105 transition-transform">{pp.label}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 3. Popular (by real units sold; falls back to featured) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#FFF6E9] text-[#FF7A00]">
              <Sparkles className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">Popular right now</h2>
              <p className="text-xs text-gray-500">Everyday favourites from the 20Mart shelves</p>
            </div>
          </div>
          <Link
            href="/shop"
            className="text-xs sm:text-sm font-bold text-[#FF7A00] hover:underline"
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
            <PackageSearch className="mb-2 h-8 w-8 text-[#FF7A00]" />
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
            <Link href="/shop?sort=newest" className="text-xs sm:text-sm font-bold text-[#FF7A00] hover:underline">
              See all →
            </Link>
          </div>
          <ProductGrid products={newest} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 min-[960px]:grid-cols-5 gap-2 sm:gap-2.5" />
        </section>
      )}

      {/* 5. Steal Deals Under ₹50 (only when real below-MRP products exist) */}
      {deals.length > 0 && (
      <section className="max-w-7xl mx-auto px-0 sm:px-6">
        <div className="relative overflow-hidden rounded-none sm:rounded-3xl bg-gradient-to-r from-[#FF7A00] via-[#FF850A] to-[#FF9E1B] px-3.5 py-5 sm:p-7 text-white shadow-lg shadow-orange-950/15 border-y sm:border border-white/20">
          {/* Subtle ambient light */}
          <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/15 blur-2xl pointer-events-none" />
          <div className="absolute -left-10 -bottom-10 w-48 h-48 rounded-full bg-amber-300/20 blur-xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 sm:mb-5">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white text-[#FF7A00] text-xs font-black shadow-xs">
                <Flame className="w-3.5 h-3.5 fill-current text-[#FF7A00]" />
                <span>Today&apos;s Steal Deals</span>
              </div>
              <h2 className="text-lg sm:text-2xl font-black tracking-tight">Under ₹50 Everyday Essentials</h2>
            </div>
            <Link
              href="/deals"
              className="px-4 py-2 rounded-full bg-white text-[#FF7A00] text-xs sm:text-sm font-black hover:bg-orange-50 shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              View All Daily Deals →
            </Link>
          </div>

          <div className="relative z-10">
            <ProductGrid
              products={deals}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 min-[960px]:grid-cols-5 gap-2 sm:gap-2.5"
            />
          </div>
        </div>
      </section>
      )}

    </div>
    </>
  );
}
