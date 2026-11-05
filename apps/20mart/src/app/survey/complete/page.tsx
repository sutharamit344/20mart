'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Breadcrumb, Button } from '@20mart/ui';
import { CheckCircle2, Gift, ArrowRight, ShoppingCart } from 'lucide-react';

export default function SurveyCompletePage() {
  const router = useRouter();

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12 space-y-6">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Survey', href: '/survey' },
          { label: 'Completed' },
        ]}
      />

      <div className="rounded-3xl border border-emerald-100 bg-white p-8 sm:p-12 text-center shadow-sm space-y-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-50 text-[#0B5D3B] mx-auto shadow-inner">
          <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
        </div>

        <div className="space-y-2">
          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
            Survey Recorded!
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
            Thank You for Your Feedback
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
            Your preferences help us curate high-demand kitchen and household essentials at everyday ₹20 & more value pricing.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button
            size="md"
            variant="primary"
            onClick={() => router.push('/survey/reward')}
            rightIcon={<ArrowRight className="w-4 h-4" />}
            className="w-full sm:w-auto font-bold px-8"
          >
            Claim Your ₹50 Reward
          </Button>
          <Button
            size="md"
            variant="outline"
            onClick={() => router.push('/shop')}
            className="w-full sm:w-auto font-bold px-6"
          >
            Explore Catalogue
          </Button>
        </div>
      </div>
    </div>
  );
}

