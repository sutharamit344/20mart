'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@20mart/ui';
import { AccountLayout } from '../../../components/AccountLayout';
import { useStore } from '../../../lib/store';
import { Gift, Tag, Sparkles, CheckCircle2, Copy, ArrowRight } from 'lucide-react';

export default function AccountCouponsPage() {
  const router = useRouter();
  const { coupons, applyCoupon, showToast } = useStore();
  const [activeTab, setActiveTab] = useState<'coupons' | 'rewards'>('coupons');

  const unlockedCount = coupons.filter((c) => c.isUnlocked).length;

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    showToast(`Copied code "${code}" to clipboard!`);
  };

  const handleUseNow = (code: string) => {
    applyCoupon(code);
    router.push('/cart');
  };

  return (
    <AccountLayout
      title="Coupons & Rewards"
      subtitle="Exclusive member discounts, launch credits and earned vouchers"
      activeKey="coupons"
    >
      <div className="space-y-5">
        {/* Banner (Screen 14 Desktop & Screen 10 Mobile) */}
        <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-r from-amber-500 to-[#FF7A00] p-5 sm:p-6 text-white shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 text-center sm:text-left">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-xs">
              <Gift className="w-7 h-7 text-white" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-200">
                Member Perks
              </span>
              <h2 className="text-lg sm:text-xl font-black">Your Rewards</h2>
              <p className="text-xs text-amber-100">
                Unlock exclusive offers and save more on everyday essentials!
              </p>
            </div>
          </div>

          <Link
            href="/survey"
            className="px-4 py-2 rounded-xl bg-white text-gray-900 text-xs font-bold shadow-xs hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            Take Survey (+₹50) →
          </Link>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('coupons')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'coupons'
                ? 'bg-[#0B5D3B] text-white shadow-xs'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Coupons ({unlockedCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('rewards')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'rewards'
                ? 'bg-[#0B5D3B] text-white shadow-xs'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Rewards & Badges
          </button>
        </div>

        {activeTab === 'coupons' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {coupons.map((coupon) => (
              <div
                key={coupon.id}
                className={`rounded-2xl sm:rounded-3xl border p-4.5 transition-all shadow-xs flex flex-col justify-between ${
                  coupon.isUnlocked
                    ? 'border-orange-200 bg-white hover:border-[#FF7A00] hover:shadow-sm'
                    : 'border-gray-200 bg-gray-50/70 opacity-70'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#FFF6E9] border border-orange-200/60 font-black text-[#FF7A00] text-xs tracking-wider uppercase">
                      <Tag className="w-3.5 h-3.5" />
                      <span>{coupon.code}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => copyCode(coupon.code)}
                      className="p-1 text-gray-400 hover:text-gray-700 transition-colors"
                      title="Copy coupon code"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="mt-3 space-y-1">
                    <h3 className="text-sm font-black text-gray-900">
                      ₹{coupon.discountValue} {coupon.description || 'Savings Voucher'}
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Minimum order: ₹{coupon.minOrderValue}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      Valid till {coupon.validUntil}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#0B5D3B]">
                    {coupon.isUnlocked ? 'Unlocked' : 'Locked'}
                  </span>
                  {coupon.isUnlocked ? (
                    <button
                      type="button"
                      onClick={() => handleUseNow(coupon.code)}
                      className="px-3.5 py-1.5 rounded-lg bg-[#FF7A00] text-white text-xs font-bold hover:bg-[#e06c00] transition-colors shadow-xs"
                    >
                      Use Now
                    </button>
                  ) : (
                    <Link
                      href="/survey"
                      className="text-xs font-bold text-[#FF7A00] hover:underline"
                    >
                      Unlock via Survey →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-gray-900">Your Shopping Badges</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/50 text-center space-y-1">
                <span className="text-2xl">🌟</span>
                <h4 className="text-xs font-bold text-gray-900">Early Pioneer</h4>
                <p className="text-[10px] text-gray-500">Joined during launch season</p>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/50 text-center space-y-1">
                <span className="text-2xl">🌱</span>
                <h4 className="text-xs font-bold text-gray-900">Smart Saver</h4>
                <p className="text-[10px] text-gray-500">Saved over ₹500 on groceries</p>
              </div>
              <div className="p-4 rounded-2xl bg-orange-50/70 border border-orange-200/50 text-center space-y-1">
                <span className="text-2xl">🚀</span>
                <h4 className="text-xs font-bold text-gray-900">Value Hunter</h4>
                <p className="text-[10px] text-gray-500">Completed feedback surveys</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AccountLayout>
  );
}

