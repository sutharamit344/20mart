'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Breadcrumb } from '@20mart/ui';

function TermsContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'privacy' ? 'privacy' : 'terms';
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(initialTab);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: activeTab === 'terms' ? 'Terms & Conditions' : 'Privacy Policy' },
        ]}
      />

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab('terms')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-all -mb-px ${
            activeTab === 'terms'
              ? 'border-[#FF7A00] text-[#FF7A00]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Terms & Conditions
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('privacy')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-all -mb-px ${
            activeTab === 'privacy'
              ? 'border-[#FF7A00] text-[#FF7A00]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Privacy Policy
        </button>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-xs text-xs sm:text-sm text-gray-600 space-y-6 leading-relaxed">
        {activeTab === 'terms' ? (
          <>
            <h1 className="text-xl font-black text-gray-900">20Mart Terms of Service</h1>
            <p className="text-xs text-gray-400">Last updated: November 2026</p>

            <section className="space-y-2">
              <h2 className="text-sm font-bold text-gray-900">1. Acceptance of Terms</h2>
              <p>
                By accessing or placing orders through 20Mart, you agree to comply with and be bound
                by these terms and conditions. These apply to all visitors, registered users, and
                customers purchasing products.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-bold text-gray-900">2. Orders and Product Availability</h2>
              <p>
                All orders placed on 20Mart are subject to product availability and acceptance. We
                reserve the right to limit the order quantity on any product per customer to ensure fair
                everyday value access for families across Ahmedabad.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-bold text-gray-900">3. Pricing, Discounts and Coupons</h2>
              <p>
                All prices are stated in Indian Rupees (₹) and inclusive of all applicable taxes.
                Coupons and promotional discounts (such as WELCOME50 and SURVEY50) are subject to
                specified minimum order thresholds and validity windows.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-bold text-gray-900">4. Delivery and Returns</h2>
              <p>
                Delivery times are estimates and may vary due to transit factors. If a product arrives
                damaged or defective, notify us within 7 days of receipt for an immediate free
                replacement or refund.
              </p>
            </section>
          </>
        ) : (
          <>
            <h1 className="text-xl font-black text-gray-900">20Mart Privacy Policy</h1>
            <p className="text-xs text-gray-400">Last updated: November 2026</p>

            <section className="space-y-2">
              <h2 className="text-sm font-bold text-gray-900">1. Information We Collect</h2>
              <p>
                We collect your phone number, delivery address, order details, and survey feedback
                solely for fulfilling orders, providing delivery notifications, and issuing coupon
                rewards.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-bold text-gray-900">2. Data Security & Storage</h2>
              <p>
                All payment transactions are encrypted using bank-grade 256-bit encryption. We never
                store card CVV numbers or UPI PINs.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-bold text-gray-900">3. Contacting Us About Your Data</h2>
              <p>
                For questions regarding your saved profile data or addresses, please email us at
                privacy@20mart.in.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default function TermsPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-gray-400">Loading terms...</div>}>
      <TermsContent />
    </Suspense>
  );
}
