'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
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
      <div className="flex border-b border-line">
        <button
          type="button"
          onClick={() => setActiveTab('terms')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-all -mb-px ${
            activeTab === 'terms'
              ? 'border-brand-orange text-brand-orange'
              : 'border-transparent text-ink-500 hover:text-ink-800'
          }`}
        >
          Terms & Conditions
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('privacy')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-all -mb-px ${
            activeTab === 'privacy'
              ? 'border-brand-orange text-brand-orange'
              : 'border-transparent text-ink-500 hover:text-ink-800'
          }`}
        >
          Privacy Policy
        </button>
      </div>

      <div className="rounded-2xl border border-line-subtle bg-surface p-5 sm:p-8 text-sm text-ink-600 space-y-6 leading-relaxed">
        {activeTab === 'terms' ? (
          <>
            <h1 className="text-xl font-bold text-ink">20Mart Terms of Service</h1>
            <p className="text-xs text-ink-400">Last updated: November 2026</p>

            <section className="space-y-2">
              <h2 className="text-sm font-bold text-ink">1. Acceptance of Terms</h2>
              <p>
                By accessing or placing orders through 20Mart, you agree to comply with and be bound
                by these terms and conditions. These apply to all visitors, registered users, and
                customers purchasing products.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-bold text-ink">2. Orders and Product Availability</h2>
              <p>
                All orders placed on 20Mart are subject to product availability and acceptance. We
                reserve the right to limit the order quantity on any product per customer to ensure fair
                everyday value access for families across Ahmedabad.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-bold text-ink">3. Pricing, Discounts and Coupons</h2>
              <p>
                All prices are stated in Indian Rupees (₹) and inclusive of all applicable taxes.
                Any promotional offers will state their own minimum order thresholds and validity
                windows when they are introduced.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-bold text-ink">4. Delivery and Transit Replacements (No Returns)</h2>
              <p>
                Delivery times are estimates and may vary due to transit factors. All orders are final sale
                and non-returnable. If a product arrives physically damaged or defective in transit, notify us
                within 48 hours of receipt with proof for an immediate free replacement.
              </p>
            </section>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-ink">20Mart Privacy Policy</h1>
            <p className="text-xs text-ink-400">Last updated: November 2026</p>

            <section className="space-y-2">
              <h2 className="text-sm font-bold text-ink">1. Information We Collect</h2>
              <p>
                We collect your phone number, delivery address, order details, and survey feedback
                solely for fulfilling orders, providing delivery notifications, and issuing coupon
                rewards.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-bold text-ink">2. Data Security & Storage</h2>
              <p>
                All payment transactions are encrypted using bank-grade 256-bit encryption. We never
                store card CVV numbers or UPI PINs.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-bold text-ink">3. Contacting Us About Your Data</h2>
              <p>
                For questions regarding your saved profile data or addresses, please submit an inquiry via our{' '}
                <Link href="/contact" className="text-brand-orange font-bold underline">
                  Contact Support Page
                </Link>
                .
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
    <Suspense fallback={<div className="p-12 text-center text-xs text-ink-400">Loading terms...</div>}>
      <TermsContent />
    </Suspense>
  );
}
