'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Breadcrumb, Button } from '@20mart/ui';
import { useStore } from '../../../lib/store';
import { Gift, Copy, CheckCircle2, ArrowRight, ShoppingBag, Sparkles } from 'lucide-react';

export default function CouponUnlockSuccessPage() {
  const router = useRouter();
  const { applyCoupon, showToast } = useStore();
  const [copied, setCopied] = useState(false);

  const couponCode = 'SURVEY50';

  const handleCopy = () => {
    navigator.clipboard?.writeText(couponCode);
    setCopied(true);
    showToast('Coupon SURVEY50 copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleApplyAndShop = () => {
    applyCoupon(couponCode);
    router.push('/cart');
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12 space-y-6">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Survey', href: '/survey' },
          { label: 'Reward Unlocked' },
        ]}
      />

      <div className="rounded-3xl border border-orange-100 bg-white p-6 sm:p-10 text-center shadow-lg space-y-6 relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-orange-100/60 pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-44 h-44 rounded-full bg-emerald-100/50 pointer-events-none" />

        <div className="relative z-10 space-y-5">
          {/* Animated Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-orange-100 text-[#FF7A00]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Reward Unlocked</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 leading-tight">
            Congratulations! ₹50 Saved
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 max-w-md mx-auto">
            Your exclusive survey coupon is active and stored in your 20Mart rewards wallet.
          </p>

          {/* Coupon Voucher Card */}
          <div className="mx-auto max-w-sm rounded-3xl bg-gradient-to-r from-amber-400 via-orange-400 to-[#FF7A00] p-6 text-white shadow-xl border border-white/40">
            <div className="flex items-center justify-between text-xs font-bold text-amber-100 pb-2 border-b border-white/20">
              <span>SURVEY REWARD</span>
              <span>20MART VOUCHER</span>
            </div>

            <div className="my-4">
              <span className="text-4xl font-black tracking-tight drop-shadow-xs">₹50 OFF</span>
              <p className="text-xs text-white/90 font-medium mt-0.5">On everyday essentials above ₹99</p>
            </div>

            <div className="pt-3 border-t border-dashed border-white/30 flex items-center justify-between">
              <span className="font-mono font-black text-sm tracking-widest bg-white/20 px-3 py-1 rounded-lg">
                {couponCode}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs font-bold bg-white text-orange-600 px-3 py-1.5 rounded-lg shadow-xs hover:bg-gray-50 transition-colors cursor-pointer"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Button
              size="md"
              variant="primary"
              onClick={handleApplyAndShop}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="w-full sm:w-auto font-bold px-8 shadow-md"
            >
              Apply Code & Go to Cart
            </Button>
            <Button
              size="md"
              variant="outline"
              onClick={() => router.push('/account/coupons')}
              className="w-full sm:w-auto font-bold px-6"
            >
              View My Coupons
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

