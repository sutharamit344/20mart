import React from 'react';
import { Breadcrumb } from '@20mart/ui';
import { HelpCircle } from 'lucide-react';
import { FaqAccordion } from '../../components/FaqAccordion';

export const metadata = {
  alternates: { canonical: '/faqs' },
  title: 'Frequently Asked Questions – 20Mart',
  description: 'Everything you need to know about shopping, delivery, and coupons at 20Mart.',
};

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
    q: 'Can I track my order?',
    a: 'Yes! Navigate to "My Orders" from your account menu. Tap on any active order to view its real-time 4-step progress: Order Placed, Processing, Out for Delivery, and Delivered.',
  },
  {
    q: 'Can I return an item?',
    a: 'To maintain our everyday rock-bottom value pricing (starting from ₹20), all sales are final and non-returnable. However, if any product arrives damaged or defective in transit, reach out via our Contact Support ticketing page and we will promptly send a free replacement!',
  },
];

export default function FaqsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Frequently Asked Questions' },
        ]}
      />

      <div className="text-center space-y-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-brand-orange mx-auto">
          <HelpCircle className="w-6 h-6" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
          Frequently Asked Questions
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto">
          Everything you need to know about shopping, delivery, and coupons at 20Mart
        </p>
      </div>

      <FaqAccordion items={faqs} />
    </div>
  );
}
