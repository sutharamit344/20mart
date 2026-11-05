'use client';

import React from 'react';
import Link from 'next/link';
import { Breadcrumb, Button } from '@20mart/ui';
import {
  Sparkles,
  Gift,
  Tag,
  ShoppingBag,
  ShieldCheck,
  Truck,
  Percent,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

export default function EarlyAccessPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Early Access Campaign' },
        ]}
      />

      {/* Hero Banner (Screen 16 Desktop & Screen 14 Mobile) */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B5D3B] via-[#094c30] to-[#063321] text-white p-6 sm:p-12 shadow-lg">
        {/* Subtle decorative circles */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-orange-500/10 pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black tracking-wide uppercase bg-amber-300 text-gray-900 shadow-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Early Access Exclusive</span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
              Join 20Mart Early!
            </h1>

            <p className="text-sm sm:text-base text-emerald-100 max-w-lg leading-relaxed">
              Add your favourite everyday products, answer a few quick questions about what you need at home, and immediately unlock an extra <strong className="text-white underline decoration-[#FF7A00] decoration-2">₹50 Coupon</strong> for your first order!
            </p>

            {/* Benefit Bullets */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 text-xs font-bold text-emerald-100">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-amber-300" />
                ₹20 & More Everyday Essentials
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-amber-300" />
                Free Delivery Above ₹199
              </span>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
              <Link
                href="/survey"
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-[#FF7A00] hover:bg-[#e06c00] text-white text-sm font-black shadow-md hover:shadow-lg transition-all text-center flex items-center justify-center gap-2"
              >
                <span>Join Early Access & Claim ₹50</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/shop"
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white text-sm font-bold border border-white/20 transition-all text-center"
              >
                Explore Catalogue
              </Link>
            </div>
          </div>

          {/* Right Visual: ₹50 Extra Coupon Card & Bag Artwork */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center space-y-4">
            {/* Voucher Card (Screen 14 Mobile & Screen 16 Desktop) */}
            <div className="relative w-full max-w-xs rounded-3xl bg-gradient-to-r from-amber-400 via-orange-400 to-[#FF7A00] p-6 text-white shadow-xl border-2 border-white/30 transform hover:scale-105 transition-transform">
              <div className="flex items-center justify-between pb-3 border-b border-white/20">
                <span className="text-[11px] font-black uppercase tracking-wider text-amber-100">
                  Welcome Voucher
                </span>
                <span className="text-xs bg-white text-orange-600 px-2 py-0.5 rounded-full font-bold">
                  SURVEY BONUS
                </span>
              </div>

              <div className="my-4 text-center">
                <div className="text-4xl sm:text-5xl font-black tracking-tight drop-shadow-xs">
                  ₹50
                </div>
                <div className="text-xs font-bold text-white/90 uppercase tracking-widest mt-1">
                  Extra Coupon
                </div>
              </div>

              <div className="pt-3 border-t border-dashed border-white/30 text-center text-[11px] text-white/80">
                Valid on orders above ₹99 • Instantly Unlocked
              </div>
            </div>

            {/* Shopping Basket & Bags Graphic Placeholder */}
            <div className="flex items-center gap-3 text-xs text-emerald-200">
              <ShoppingBag className="w-4 h-4 text-amber-300" />
              <span>Over 1,200+ households joined this week</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Step Explanation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-6 shadow-xs space-y-2 text-center sm:text-left">
          <div className="h-10 w-10 rounded-2xl bg-emerald-50 text-[#0B5D3B] font-black text-sm flex items-center justify-center">
            01
          </div>
          <h3 className="text-sm font-bold text-gray-900">1. Share Your Needs</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Answer 3 simple questions about your regular kitchen and home product habits.
          </p>
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-6 shadow-xs space-y-2 text-center sm:text-left">
          <div className="h-10 w-10 rounded-2xl bg-orange-50 text-[#FF7A00] font-black text-sm flex items-center justify-center">
            02
          </div>
          <h3 className="text-sm font-bold text-gray-900">2. Pick Favourite Items</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Vote on peelers, containers, cleaning tools or organizers you want stocked.
          </p>
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-6 shadow-xs space-y-2 text-center sm:text-left">
          <div className="h-10 w-10 rounded-2xl bg-amber-50 text-amber-700 font-black text-sm flex items-center justify-center">
            03
          </div>
          <h3 className="text-sm font-bold text-gray-900">3. Unlock ₹50 Off</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Get your instant code <code className="bg-orange-50 text-[#FF7A00] px-1 py-0.5 rounded-sm font-bold">SURVEY50</code> applied to your checkout cart.
          </p>
        </div>
      </div>
    </div>
  );
}

