'use client';

import React, { useState } from 'react';
import { Breadcrumb } from '@20mart/ui';
import { ChevronDown, HelpCircle } from 'lucide-react';

export default function FaqsPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const faqs = [
    {
      q: 'What is 20Mart?',
      a: '20Mart is your everyday value market, dedicated to providing high-utility household essentials, kitchen tools, cleaning products, and stationery at budget-friendly neighborhood prices.',
    },
    {
      q: 'How can I place an order?',
      a: 'Browse our categories, add desired items to your shopping cart, proceed to checkout, enter your delivery address in Ahmedabad, choose your preferred payment method (UPI, Card, or Cash on Delivery), and click Place Order.',
    },
    {
      q: 'What are the delivery charges?',
      a: 'We offer standard doorstep delivery for ₹40. Orders above ₹199 qualify for completely FREE doorstep delivery! Store pickup from our Ahmedabad fulfillment centers is also always free.',
    },
    {
      q: 'How do I use a coupon?',
      a: 'In your shopping cart or checkout page, locate the "Have a coupon code?" field, type your coupon code (e.g. WELCOME50 or SURVEY50) and tap "Apply". The discount is immediately deducted from your subtotal.',
    },
    {
      q: 'Can I track my order?',
      a: 'Yes! Navigate to "My Orders" from your account menu. Tap on any active order to view its real-time 4-step progress: Order Placed, Processing, Out for Delivery, and Delivered.',
    },
    {
      q: 'What is your return & replacement policy?',
      a: 'We offer a 7-day hassle-free replacement guarantee on damaged, defective, or incorrect items. Simply contact our support team at support@20mart.in with your order number.',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Frequently Asked Questions' },
        ]}
      />

      <div className="text-center space-y-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-[#FF7A00] mx-auto">
          <HelpCircle className="w-6 h-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
          Frequently Asked Questions
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto">
          Everything you need to know about shopping, delivery, and coupons at 20Mart
        </p>
      </div>

      {/* FAQ Accordions (Desktop Screen 18) */}
      <div className="space-y-3">
        {faqs.map((faq, idx) => {
          const isOpen = openIdx === idx;
          return (
            <div
              key={idx}
              className="rounded-2xl border border-gray-100 bg-white overflow-hidden shadow-xs transition-all"
            >
              <button
                type="button"
                onClick={() => setOpenIdx(isOpen ? null : idx)}
                className="w-full flex items-center justify-between p-4 sm:p-5 text-left text-xs sm:text-sm font-bold text-gray-900 hover:text-[#0B5D3B] transition-colors"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-[#FF7A00]' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-4 pb-5 sm:px-5 sm:pb-5 text-xs text-gray-600 leading-relaxed border-t border-gray-50 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

