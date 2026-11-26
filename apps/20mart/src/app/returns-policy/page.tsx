import React from 'react';
import Link from 'next/link';
import { Breadcrumb } from '@20mart/ui';
import { ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { pageMetadata } from '../../lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Returns & Refunds Policy – 20Mart',
  description: 'How returns, cancellations and refunds work at 20Mart.',
  path: '/returns-policy',
});

export default function ReturnsPolicyPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'No Returns Policy' },
        ]}
      />

      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-brand-green text-xs font-bold border border-emerald-200/50">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Everyday Direct Value</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
          No Returns Policy
        </h1>
        <p className="text-xs text-gray-400">All sales are final to ensure unbeatable direct-to-consumer prices starting at ₹20</p>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-6 sm:p-8 shadow-xs text-xs sm:text-sm text-gray-600 space-y-6 leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-sm sm:text-base font-bold text-gray-900">1. All Sales Are Final (No Returns)</h2>
          <p>
            At 20Mart, we procure household and kitchen essentials directly from quality manufacturers to deliver everyday neighborhood prices starting at just ₹20. Because reverse logistics on small-ticket items would drive prices up, <strong>we do not accept product returns or exchanges once an order is delivered</strong>.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm sm:text-base font-bold text-gray-900">2. Damaged or Defective Items in Transit</h2>
          <p>
            Your satisfaction matters. If an item arrives physically damaged, broken, or defective during delivery, please notify us within <strong>48 hours of delivery</strong>:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Send a photo or short video showing the damaged item and packaging box.</li>
            <li>Include your order number and registered phone number.</li>
            <li>Our support team will verify the damage and send an immediate <strong>free replacement</strong> or issue store wallet credit.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm sm:text-base font-bold text-gray-900">3. Contact Support</h2>
          <p>
            For assistance with transit damage or order issues, please submit a ticket through our{' '}
            <Link href="/contact" className="text-brand-orange font-bold underline">
              Contact Support Form
            </Link>
            . Our team reviews all inquiries promptly.
          </p>
        </section>
      </div>
    </div>
  );
}

