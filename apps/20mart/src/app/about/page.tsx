'use client';

import React from 'react';
import Link from 'next/link';
import { Breadcrumb, Button } from '@20mart/ui';
import {
  ShieldCheck,
  Truck,
  RotateCcw,
  Sparkles,
  ShoppingBag,
  Users,
  Award,
  ArrowRight,
} from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-12">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'About 20Mart' },
        ]}
      />

      {/* Hero (Desktop Screen 16) */}
      <div className="relative overflow-hidden rounded-3xl bg-[#0B5D3B] text-white p-8 sm:p-12 shadow-sm text-center space-y-4">
        <span className="inline-block px-3 py-1 rounded-full bg-amber-400 text-[#0B5D3B] text-xs font-black uppercase tracking-wider">
          Our Mission & Promise
        </span>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black">About 20Mart</h1>
        <p className="text-sm sm:text-base text-emerald-100 max-w-2xl mx-auto leading-relaxed">
          20Mart is your everyday value market for useful, affordable and daily-use products for home,
          kitchen, school and more. We believe everyone deserves quality utility goods without high prices.
        </p>
      </div>

      {/* Core Brand Pillars (Desktop Screen 16 badges) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 rounded-3xl border border-gray-100 bg-white shadow-xs space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-[#FF7A00]">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-gray-900">Affordable for Everyone</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Budget-friendly price points starting from just ₹20, making household shopping stress-free.
          </p>
        </div>

        <div className="p-6 rounded-3xl border border-gray-100 bg-white shadow-xs space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-[#0B5D3B]">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-gray-900">Wide Range of Daily-Use</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            From stainless peelers to airtight containers and flexible brushes, everything a modern home needs.
          </p>
        </div>

        <div className="p-6 rounded-3xl border border-gray-100 bg-white shadow-xs space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-gray-900">Strict Quality & Reliable</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Every product passes quality inspections for durability, non-toxic materials, and ergonomics.
          </p>
        </div>

        <div className="p-6 rounded-3xl border border-gray-100 bg-white shadow-xs space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-gray-900">Customer-First Approach</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Fast doorstep delivery in 2–4 days, transparent order tracking, and hassle-free returns.
          </p>
        </div>
      </div>

      {/* Early Access Member Offer */}
      <div className="rounded-3xl bg-gradient-to-r from-orange-500 to-amber-500 text-white p-8 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-md">
        <div className="space-y-2 text-center md:text-left">
          <h2 className="text-2xl sm:text-3xl font-black">Be an Early 20Mart Member!</h2>
          <p className="text-xs sm:text-sm text-amber-100 max-w-md">
            Unlock an extra ₹50 coupon by completing our short product preference survey.
          </p>
        </div>
        <Link href="/survey">
          <Button
            size="lg"
            className="bg-white text-gray-900 hover:bg-gray-100 font-black rounded-xl shadow-md"
          >
            Join Early Access →
          </Button>
        </Link>
      </div>
    </div>
  );
}

