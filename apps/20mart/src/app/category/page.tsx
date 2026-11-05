'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { mockCategories } from '@20mart/shared';
import { Breadcrumb, Button } from '@20mart/ui';
import { ArrowRight, Sparkles, ShoppingBag, Layers, Utensils, BookOpen, HeartHandshake } from 'lucide-react';

export default function CategoryListingPage() {
  const router = useRouter();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Categories' },
        ]}
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Shop by Category
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Explore curated household, kitchen, cleaning, and daily-use necessities
          </p>
        </div>
        <Link
          href="/shop"
          className="text-xs font-bold text-[#FF7A00] hover:underline flex items-center gap-1"
        >
          <span>View All Products</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Category Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {mockCategories.map((category) => (
          <div
            key={category.id}
            onClick={() => router.push(`/category/${category.slug}`)}
            className="group relative flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-orange-200 transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#FFF6E9] text-[10px] sm:text-[11px] font-bold text-[#FF7A00]">
                  {category.itemCount}+ Items
                </span>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-[#0B5D3B] transition-colors">
                  {category.name}
                </h3>
                <p className="text-xs text-gray-500 line-clamp-2">
                  Quality daily-use {category.name.toLowerCase()} at budget-friendly neighborhood prices.
                </p>
              </div>

              {/* Category Image container */}
              <div className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-2xl bg-[#FFF6E9] p-2 flex items-center justify-center border border-orange-100/70 overflow-hidden">
                <img
                  src={category.image}
                  alt={category.name}
                  className="h-full w-full object-contain group-hover:scale-110 transition-transform duration-300"
                />
              </div>
            </div>

            {/* Subcategories list */}
            {category.subcategories && category.subcategories.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-1.5">
                {category.subcategories.slice(0, 4).map((sub, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] sm:text-[11px] font-medium text-gray-600 bg-gray-50 px-2 py-0.5 rounded-md hover:bg-orange-50 hover:text-[#FF7A00] transition-colors"
                  >
                    {sub}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3.5 flex items-center justify-between text-xs font-bold text-[#FF7A00] group-hover:translate-x-0.5 transition-transform">
              <span>Browse Catalog</span>
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        ))}
      </div>

      {/* Promotional Banner */}
      <div className="rounded-2xl sm:rounded-3xl bg-[#0B5D3B] text-white p-5 sm:p-7 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400 text-[#0B5D3B] text-[10px] font-bold uppercase tracking-wider">
            <Sparkles className="w-3 h-3 fill-current" />
            <span>Curated For Your Home</span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold">Can't find what you are looking for?</h3>
          <p className="text-xs text-emerald-100">
            Tell us in our 1-minute product interest survey and get a ₹50 discount coupon.
          </p>
        </div>
        <Button
          size="md"
          variant="primary"
          onClick={() => router.push('/survey')}
          className="rounded-xl font-bold whitespace-nowrap shadow-xs"
        >
          Take Survey & Claim ₹50 →
        </Button>
      </div>
    </div>
  );
}

