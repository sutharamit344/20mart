'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@20mart/ui';
import { CheckCircle2, Truck, ArrowRight, ShoppingBag } from 'lucide-react';

function OrderSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId') || 'ZM78321';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center space-y-6">
      {/* Celebration Bag & Checkmark Graphic (Screen 07 Reference) */}
      <div className="relative mx-auto flex h-28 w-28 sm:h-36 sm:w-36 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-amber-200/60 blur-xl animate-pulse" />
        <img
          src="/order-success-bag.png"
          alt="Order Successful"
          className="relative z-10 h-24 sm:h-32 w-auto object-contain drop-shadow-md"
        />
      </div>

      <div className="space-y-1.5">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
          Order Placed Successfully!
        </h1>
        <p className="text-xs sm:text-sm text-gray-600">
          Your order <span className="font-bold text-[#0B5D3B]">#{orderId}</span> has been received.
        </p>
      </div>

      <div className="mx-auto max-w-sm rounded-2xl bg-white border border-gray-100 p-3.5 shadow-xs flex items-center justify-center gap-3 text-xs">
        <div className="p-2 rounded-xl bg-[#FFF6E9] text-[#FF7A00]">
          <Truck className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <div className="text-left">
          <span className="text-[10px] text-gray-400 font-medium">Estimated Arrival</span>
          <p className="font-bold text-gray-900">Delivery by 05 Nov 2026</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-3 max-w-sm mx-auto">
        <Button
          size="md"
          variant="primary"
          onClick={() => router.push(`/account/orders/${orderId}`)}
          className="w-full sm:w-auto font-bold px-7 rounded-xl shadow-xs"
        >
          Track Order
        </Button>
        <Button
          size="md"
          variant="outline"
          onClick={() => router.push('/shop')}
          className="w-full sm:w-auto font-bold px-6 rounded-xl"
        >
          Continue Shopping
        </Button>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-gray-400">Loading order status...</div>}>
      <OrderSuccessContent />
    </Suspense>
  );
}
