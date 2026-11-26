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
import type { Metadata } from 'next';
import { pageMetadata } from '../../lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'About 20Mart – Your Everyday Value Market',
  description: 'Our story: curated, affordable household, kitchen and daily-use essentials with doorstep delivery in Ahmedabad.',
  path: '/about',
});

export default function AboutPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'About 20Mart' },
        ]}
      />

      {/* Hero (Desktop Screen 16) */}
      <div className="space-y-3 rounded-2xl bg-brand-green p-6 text-center text-white sm:p-10">
        <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-brand-orange-300 text-2xs font-semibold uppercase tracking-wide">
          Our Mission & Promise
        </span>
        <h1 className="text-2xl font-bold sm:text-3xl">About 20Mart</h1>
        <p className="text-sm sm:text-base text-white/80 max-w-2xl mx-auto leading-relaxed">
          20Mart is your everyday value market for useful, affordable and daily-use products for home,
          kitchen, school and more. We believe everyone deserves quality utility goods without high prices.
        </p>
      </div>

      {/* Core Brand Pillars (Desktop Screen 16 badges) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-5 rounded-2xl border border-line-subtle bg-surface space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-orange-100 text-brand-orange">
            <Sparkles className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-ink">Affordable for Everyone</h3>
          <p className="text-xs text-ink-500 leading-relaxed">
            Budget-friendly price points starting from just ₹20, making household shopping stress-free.
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-line-subtle bg-surface space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-green-50 text-brand-green">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-ink">Wide Range of Daily-Use</h3>
          <p className="text-xs text-ink-500 leading-relaxed">
            From stainless peelers to airtight containers and flexible brushes, everything a modern home needs.
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-line-subtle bg-surface space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-info">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-ink">Strict Quality & Reliable</h3>
          <p className="text-xs text-ink-500 leading-relaxed">
            Every product passes quality inspections for durability, non-toxic materials, and ergonomics.
          </p>
        </div>

        <div className="p-5 rounded-2xl border border-line-subtle bg-surface space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning-soft text-warning">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-ink">Customer-First Approach</h3>
          <p className="text-xs text-ink-500 leading-relaxed">
            Fast doorstep delivery in 2–4 days, transparent order tracking, and unbeatable everyday direct-value prices.
          </p>
        </div>
      </div>

    </div>
  );
}

