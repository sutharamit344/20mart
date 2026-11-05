'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Breadcrumb, Button } from '@20mart/ui';
import { useStore } from '../../lib/store';
import { Gift, Tag, Sparkles, CheckCircle2, Copy, ArrowRight } from 'lucide-react';

export default function CouponsPage() {
  const router = useRouter();
  const { coupons, applyCoupon, showToast } = useStore();
  const [activeTab, setActiveTab] = useState<'coupons' | 'rewards'>('coupons');

  const unlockedCount = coupons.filter((c) => c.isUnlocked).length;

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    showToast(`Copied ${code} to clipboard!`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Coupons & Rewards' },
        ]}
      />

      {/* Header Banner (Screen 14 & Mobile Screen 10) */}
      <div className="rounded-3xl bg-gradient-to-r from-amber-500 to-orange-500 p-6 sm:p-8 text-white shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-xs">
            <Gift className="w-8 h-8 text-white" />
          </div>
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-amber-200">
              Rewards Wallet
            </span>
            <h1 className="text-xl sm:text-2xl font-black">Your Rewards</h1>
            <p className="text-xs sm:text-sm text-amber-100 mt-0.5">
              You have <span className="font-bold underline">{unlockedCount} unlocked coupons</span>{' '}
              ready to apply at checkout!
            </p>
          </div>
        </div>

        <Link
          href="/survey"
          className="px-5 py-3 rounded-xl bg-white text-gray-900 text-xs font-bold shadow-md hover:bg-gray-50 transition-colors whitespace-nowrap"
        >
          Take Survey (+₹50 Bonus) →
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('coupons')}
          className={`px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all -mb-px ${
            activeTab === 'coupons'
              ? 'border-[#FF7A00] text-[#FF7A00]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Coupons ({unlockedCount})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('rewards')}
          className={`px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all -mb-px ${
            activeTab === 'rewards'
              ? 'border-[#FF7A00] text-[#FF7A00]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Reward Badges & Milestones
        </button>
      </div>

      {/* Content */}
      {activeTab === 'coupons' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {coupons.map((coupon) => (
            <div
              key={coupon.id}
              className={`rounded-3xl border p-5 transition-all shadow-xs flex flex-col justify-between ${
                coupon.isUnlocked
                  ? 'border-orange-200 bg-white hover:border-[#FF7A00] hover:shadow-md'
                  : 'border-gray-200 bg-gray-50/70 opacity-70'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-orange-50 border border-orange-200 font-black text-[#FF7A00] text-sm tracking-wider uppercase">
                    <Tag className="w-3.5 h-3.5" />
                    <span>{coupon.code}</span>
                  </div>

                  {coupon.isUnlocked ? (
                    <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                      Locked
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-black text-gray-900 mt-3">{coupon.title}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{coupon.description}</p>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-400">
                  <span>Min order: ₹{coupon.minOrderValue}</span>
                  <span>•</span>
                  <span>Valid till {coupon.validUntil}</span>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => copyCode(coupon.code)}
                  className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Code</span>
                </button>

                {coupon.isUnlocked ? (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      applyCoupon(coupon.code);
                      router.push('/cart');
                    }}
                    className="rounded-xl font-bold px-4"
                  >
                    Use Now
                  </Button>
                ) : (
                  <Link href="/survey">
                    <Button size="sm" variant="secondary" className="rounded-xl font-bold">
                      Unlock via Survey
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-xs space-y-6">
          <h3 className="text-base font-black text-gray-900">20Mart Value Club Milestones</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-emerald-900">First Purchase Milestone</h4>
                <p className="text-[11px] text-emerald-700">Get ₹50 flat off on your first order of ₹99+.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-100">
              <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-900">Survey Contributor Badge</h4>
                <p className="text-[11px] text-amber-700">Answer 3 questions to unlock ₹50 bonus credit.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

