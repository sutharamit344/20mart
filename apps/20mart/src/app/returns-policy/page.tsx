'use client';

import React from 'react';
import Link from 'next/link';
import { Breadcrumb } from '@20mart/ui';
import { RotateCcw, ShieldCheck, CheckCircle2, HelpCircle } from 'lucide-react';

export default function ReturnsPolicyPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Return & Refund Policy' },
        ]}
      />

      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[#0B5D3B] text-xs font-bold border border-emerald-200/50">
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Hassle-Free Guarantee</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
          Return & Refund Policy
        </h1>
        <p className="text-xs text-gray-400">7-day replacement guarantee on everyday household essentials</p>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-xs text-xs sm:text-sm text-gray-600 space-y-6 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-sm sm:text-base font-bold text-gray-900">1. 7-Day Return & Replacement Policy</h2>
          <p>
            At 20Mart, your satisfaction is our foremost priority. If any kitchen peeler, organizer, cleaning brush, or household item received is damaged, defective, or incorrect, you can request a replacement or full refund within 7 days of delivery.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm sm:text-base font-bold text-gray-900">2. Eligibility for Returns</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Product must be in its original unused condition with all tags and barcode labels intact.</li>
            <li>Original receipt or order confirmation email/SMS must be provided.</li>
            <li>For hygiene-sensitive products (e.g., opened personal care items), returns are accepted only in case of physical transit defects or expiry upon delivery.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm sm:text-base font-bold text-gray-900">3. How to Initiate a Return</h2>
          <p>
            Go to <Link href="/account/orders" className="text-[#0B5D3B] font-bold underline">My Orders</Link>, select the order containing the item, and tap "Request Return / Replacement". Alternatively, reach out to our WhatsApp or email support at{' '}
            <a href="mailto:support@20mart.in" className="text-[#FF7A00] font-bold underline">
              support@20mart.in
            </a>{' '}
            with a photo of the product.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm sm:text-base font-bold text-gray-900">4. Refund Processing Time</h2>
          <p>
            Once our delivery agent inspects and collects the return package:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>UPI & Net Banking:</strong> 24–48 working hours.</li>
            <li><strong>Credit & Debit Cards:</strong> 3–5 working days (subject to issuing bank cycle).</li>
            <li><strong>Cash on Delivery (COD):</strong> Instant refund into your 20Mart Wallet or direct IMPS to your bank account.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

