'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  mockCategories,
  mockProducts,
} from '@20mart/shared';
import {
  ProductCard,
  CategoryCard,
  Button,
} from '@20mart/ui';
import { useStore } from '../lib/store';
import {
  ArrowRight,
  Sparkles,
  Flame,
  Percent,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ShoppingBag,
  Gift,
  RotateCcw,
  Truck,
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { addToCart, toggleWishlist, isWishlisted, getItemQuantity, updateItemQuantity } = useStore();

  const trendingProducts = mockProducts.filter((p) => p.trending);
  const dailyDeals = mockProducts.filter((p) => p.dailyDeal);

  return (
    <div className="space-y-6 sm:space-y-8 pb-8">
      {/* 1. Hero Banner (Screen 01 Desktop & Mobile 01) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-4 sm:pt-5">
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#064E2E] via-[#0B5D38] to-[#04341E] text-white shadow-xl shadow-emerald-950/15 border border-emerald-600/20">
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

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-1 flex-wrap">
                <button
                  onClick={() => router.push('/shop')}
                  className="group flex items-center gap-2 rounded-full font-bold px-6 py-2.5 sm:py-3 text-xs sm:text-sm bg-gradient-to-r from-[#FF7A00] to-[#FF5500] hover:from-[#FF8A00] hover:to-[#FF6600] text-white shadow-lg shadow-orange-950/30 border border-white/20 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
                >
                  <span>Explore Products</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={() => router.push('/early-access')}
                  className="flex items-center gap-2 px-4 py-2.5 sm:py-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/25 text-amber-200 hover:text-white transition-all text-xs sm:text-sm font-bold shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <Gift className="w-4 h-4 text-amber-300" />
                  <span>Claim ₹50 Coupon</span>
                </button>
              </div>
            </div>

            {/* Right: Grouped daily-use items & basket filling the banner space gracefully */}
            <div className="md:col-span-6 lg:col-span-7 xl:col-span-7 relative flex items-end justify-center md:justify-end px-3 sm:px-6 pt-4 md:pt-2 pb-2 md:pb-0">
              {/* Radiant ambient glow without clipping */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-80 sm:w-[500px] md:w-[600px] h-72 sm:h-96 rounded-full bg-gradient-to-tr from-emerald-400/30 via-emerald-300/20 to-transparent blur-3xl pointer-events-none" />
              </div>

              {/* Free Delivery Badge */}
              <div className="absolute top-2 sm:top-4 right-3 sm:right-6 z-10 bg-white/95 backdrop-blur-md rounded-full px-3.5 py-1.5 text-[11px] font-black text-[#0B5D38] flex items-center gap-1.5 shadow-lg shadow-emerald-950/20 border border-white">
                <Truck className="w-3.5 h-3.5 text-[#0B5D38]" />
                <span>Free Delivery &gt; ₹199</span>
              </div>

              {/* Grouped Daily Use Items & Basket 3D image - perfectly filling space on desktop & mobile */}
              <img
                src="/hero-group-transparent.png"
                alt="20Mart Household & Kitchen Essentials Cluster"
                className="relative z-0 h-52 sm:h-64 md:h-76 lg:h-[340px] xl:h-[380px] w-auto max-w-[96%] md:max-w-full object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.4)] hover:scale-105 transition-transform duration-500 ease-out"
              />

              {/* Floating Price Pill */}
              <div className="absolute bottom-2 sm:bottom-4 right-3 sm:right-6 z-10 bg-gradient-to-r from-[#FF7A00] to-[#FF5500] text-white rounded-full px-4 py-1.5 text-xs sm:text-sm font-black shadow-xl shadow-orange-950/35 border-2 border-white/90">
                Starts @ ₹20!
              </div>

              {/* Trust Badge */}
              <div className="absolute bottom-3 left-2 sm:left-4 z-10 hidden sm:flex items-center gap-1.5 bg-black/35 backdrop-blur-md rounded-full px-3 py-1 text-[11px] font-bold text-white border border-white/20">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>100% Everyday Essentials</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Value Props Bar (Matching reference 4 pills in Screen 01) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-gray-100/90 shadow-2xs hover:shadow-xs hover:border-orange-200 transition-all duration-200">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF6E9] text-[#FF7A00]">
              <Percent className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-gray-900 leading-snug">Great Value</h4>
              <p className="text-[11px] text-gray-500">Budget-friendly prices</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-gray-100/90 shadow-2xs hover:shadow-xs hover:border-emerald-200 transition-all duration-200">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-[#0B5D38]">
              <ShoppingBag className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-gray-900 leading-snug">Daily Use Items</h4>
              <p className="text-[11px] text-gray-500">For every home</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-gray-100/90 shadow-2xs hover:shadow-xs hover:border-amber-200 transition-all duration-200">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <Truck className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-gray-900 leading-snug">Fast Delivery</h4>
              <p className="text-[11px] text-gray-500">At your doorstep</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-gray-100/90 shadow-2xs hover:shadow-xs hover:border-orange-200 transition-all duration-200">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF6E9] text-[#FF7A00]">
              <RotateCcw className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-gray-900 leading-snug">Easy Returns</h4>
              <p className="text-[11px] text-gray-500">Hassle-free policy</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Shop by Category (Screen 01 Circular Badges) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-gray-900">Shop by Category</h2>
            <p className="text-xs text-gray-500">Explore everyday necessities by department</p>
          </div>
          <Link
            href="/shop"
            className="text-xs sm:text-sm font-bold text-[#FF7A00] hover:text-[#E66E00] flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-4">
          {mockCategories.slice(0, 6).map((cat) => (
            <CategoryCard
              key={cat.id}
              category={cat}
              variant="circle"
              onClick={() => router.push(`/category/${cat.slug}`)}
            />
          ))}
        </div>
      </section>

      {/* 4. Trending Everyday Finds (Screen 01) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#FFF6E9] text-[#FF7A00]">
              <Sparkles className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">Trending Finds</h2>
              <p className="text-xs text-gray-500">Popular items customers in Ahmedabad are buying right now</p>
            </div>
          </div>
          <Link
            href="/shop?filter=trending"
            className="text-xs sm:text-sm font-bold text-[#FF7A00] hover:underline"
          >
            See More →
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {trendingProducts.slice(0, 8).map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              quantity={getItemQuantity(product.id)}
              isWishlisted={isWishlisted(product.id)}
              onAddToCart={() => updateItemQuantity(product.id, 1)}
              onIncrement={() => updateItemQuantity(product.id, 1)}
              onDecrement={() => updateItemQuantity(product.id, -1)}
              onToggleWishlist={() => toggleWishlist(product.id)}
              onClick={() => router.push(`/product/${product.slug}`)}
            />
          ))}
        </div>
      </section>

      {/* 5. Steal Deals Under ₹50 */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#FF7A00] via-[#FF850A] to-[#FF9E1B] p-5 sm:p-7 text-white shadow-lg shadow-orange-950/15 border border-white/20">
          {/* Subtle ambient light */}
          <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/15 blur-2xl pointer-events-none" />
          <div className="absolute -left-10 -bottom-10 w-48 h-48 rounded-full bg-amber-300/20 blur-xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 sm:mb-5">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white text-[#FF7A00] text-xs font-black shadow-xs">
                <Flame className="w-3.5 h-3.5 fill-current text-[#FF7A00]" />
                <span>Today's Steal Deals</span>
              </div>
              <h2 className="text-lg sm:text-2xl font-black tracking-tight">Under ₹50 Everyday Essentials</h2>
            </div>
            <Link
              href="/shop?maxPrice=50"
              className="px-4 py-2 rounded-full bg-white text-[#FF7A00] text-xs sm:text-sm font-black hover:bg-orange-50 shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              View All ₹50 Deals →
            </Link>
          </div>

          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {dailyDeals.slice(0, 4).map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                quantity={getItemQuantity(product.id)}
                isWishlisted={isWishlisted(product.id)}
                onAddToCart={() => updateItemQuantity(product.id, 1)}
                onIncrement={() => updateItemQuantity(product.id, 1)}
                onDecrement={() => updateItemQuantity(product.id, -1)}
                onToggleWishlist={() => toggleWishlist(product.id)}
                onClick={() => router.push(`/product/${product.slug}`)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* 6. Early Access Campaign Promo Banner (Screen 16 Desktop & Mobile Screen 14) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#064E2E] via-[#0B5D38] to-[#04341E] text-white p-6 sm:p-8 shadow-xl shadow-emerald-950/15 border border-emerald-600/20 flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Ambient lighting */}
          <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-emerald-400/20 blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-2 max-w-xl text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-gradient-to-r from-[#FFD027] to-[#FFA200] text-gray-950 text-[11px] font-black uppercase tracking-wider shadow-xs">
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span>Early Access</span>
            </div>
            <h3 className="text-xl sm:text-3xl font-black tracking-tight">Join 20Mart Early!</h3>
            <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed">
              Add your favourite products and answer a few quick questions to unlock an extra{' '}
              <strong className="text-amber-300 font-black">₹50 welcome coupon</strong> for your first order.
            </p>
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-3">
            {/* Coupon preview card */}
            <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-white/10 px-5 py-3 text-center backdrop-blur-md shadow-inner">
              <span className="text-[10px] uppercase font-black text-amber-200 tracking-wider">Bonus Voucher</span>
              <div className="text-2xl font-black text-white">₹50 OFF</div>
              <span className="text-[10px] text-emerald-200 font-medium">Min. order ₹99</span>
            </div>

            <button
              onClick={() => router.push('/survey')}
              className="rounded-full font-black px-6 py-3 text-xs sm:text-sm bg-gradient-to-r from-[#FF7A00] to-[#FF5500] hover:from-[#FF8A00] hover:to-[#FF6600] text-white shadow-lg shadow-orange-950/30 border border-white/20 whitespace-nowrap hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              Join Early Access →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
