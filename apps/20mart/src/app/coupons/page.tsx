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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-2.5 pb-8 sm:pt-3.5 space-y-3.5 sm:space-y-4">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Coupons & Rewards' },
        ]}
        className="mb-1.5 sm:mb-2"
      />

      {/* Header Banner (Screen 14 & Mobile Screen 10) */}
      <div className="rounded-2xl bg-gradient-to-r from-[#FF7A00] via-[#FF850A] to-[#FF9E1B] p-4 sm:p-5 text-white shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 text-left">
          <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-xs">
            <Gift className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
          </div>
          <div>
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-100">
              Rewards Wallet
            </span>
            <h1 className="text-lg sm:text-2xl font-black leading-tight text-white">Your Rewards</h1>
            <p className="text-xs text-orange-100 mt-0.5">
              You have <span className="font-bold underline">{unlockedCount} unlocked coupons</span>{' '}
              ready to apply at checkout!
            </p>
          </div>
        </div>

        <Link
          href="/survey"
          className="w-full sm:w-auto text-center px-4 py-2.5 rounded-xl bg-white text-[#FF7A00] text-xs font-bold shadow-xs hover:bg-orange-50 transition-colors whitespace-nowrap cursor-pointer shrink-0"
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

