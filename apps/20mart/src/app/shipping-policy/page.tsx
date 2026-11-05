'use client';

import React from 'react';
import Link from 'next/link';
import { Breadcrumb } from '@20mart/ui';
import { Truck, Clock, MapPin, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function ShippingPolicyPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Shipping & Delivery Policy' },
        ]}
      />

      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[#0B5D3B] text-xs font-bold border border-emerald-200/50">
          <Truck className="w-3.5 h-3.5" />
          <span>Everyday Fast Delivery</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
          Shipping & Delivery Policy
        </h1>
        <p className="text-xs text-gray-400">Reliable doorstep fulfillment for home essentials</p>
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs space-y-1">
          <span className="text-2xl">⚡</span>
          <h3 className="text-xs font-bold text-gray-900">2–4 Days Standard</h3>
          <p className="text-[11px] text-gray-500">Fast delivery across all serviceable pincodes</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs space-y-1">
          <span className="text-2xl">🎉</span>
          <h3 className="text-xs font-bold text-gray-900">Free Delivery Above ₹199</h3>
          <p className="text-[11px] text-gray-500">Save ₹40 delivery fee on value carts</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-xs space-y-1">
          <span className="text-2xl">🏬</span>
          <h3 className="text-xs font-bold text-gray-900">Free Store Pickup</h3>
          <p className="text-[11px] text-gray-500">Pick up ready bags at local 20Mart stores</p>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-xs text-xs sm:text-sm text-gray-600 space-y-6 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-sm sm:text-base font-bold text-gray-900">1. Delivery Zones & Coverage</h2>
          <p>
            20Mart currently provides delivery throughout Ahmedabad and expanding metropolitan clusters in Gujarat. Enter your pincode at checkout or in the header bar to view real-time delivery estimates and slot availability.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm sm:text-base font-bold text-gray-900">2. Shipping Charges</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Standard Home Delivery:</strong> A flat ₹40 fee applies for orders below ₹199.</li>
            <li><strong>Free Delivery:</strong> All orders with a subtotal of ₹199 or greater receive 100% Free Doorstep Delivery.</li>
            <li><strong>Store Pickup:</strong> 100% Free for any order size. Available within 2 hours of confirmation.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm sm:text-base font-bold text-gray-900">3. Live Tracking & Dispatch</h2>
          <p>
            As soon as your package is dispatched from our fulfillment center, you will receive an SMS and WhatsApp message with your tracking link. You can also view step-by-step order milestones directly from your <Link href="/account/orders" className="text-[#0B5D3B] font-bold underline">My Orders</Link> dashboard.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm sm:text-base font-bold text-gray-900">4. Damaged Packages</h2>
          <p>
            In the rare event that an item is damaged or missing upon arrival, report it to our rider or raise a replacement request via <Link href="/contact" className="text-[#FF7A00] font-bold underline">Customer Support</Link> within 48 hours for immediate resolution.
          </p>
        </section>
      </div>
    </div>
  );
}

