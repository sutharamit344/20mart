import React from 'react';
import Link from 'next/link';
import { Logo } from '@20mart/ui';
import { PrivacyChoicesLink } from './ConsentBanner';
import { ShieldCheck, Truck, BadgeCheck, Headphones, type LucideIcon } from 'lucide-react';

const PILLARS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: ShieldCheck, title: 'Great Value', text: 'Everyday budget prices' },
  { icon: Truck, title: 'Home Delivery', text: 'Direct to your doorstep' },
  { icon: BadgeCheck, title: '100% Genuine', text: 'Quality assured essentials' },
  { icon: Headphones, title: '24/7 Support', text: 'Dedicated assistance' },
];

const linkCls =
  'inline-flex py-1 text-sm text-ink-600 transition-colors hover:text-ink focus:outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-brand-orange/50';

const Column: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h2 className="mb-2 text-2xs font-semibold uppercase tracking-wide text-ink-500">{title}</h2>
    <ul className="space-y-0.5">{children}</ul>
  </div>
);

export const Footer: React.FC<{ categories: { name: string; slug: string }[] }> = ({ categories }) => {
  return (
    <footer className="mt-10 border-t border-line bg-surface sm:mt-14">
      {/* Value pillars */}
      <div className="border-b border-line-subtle">
        <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-4 px-4 py-5 sm:px-6 md:grid-cols-4">
          {PILLARS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-green-50 text-brand-green">
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{title}</span>
                <span className="block text-2xs text-ink-500">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Navigation */}
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-8 px-4 py-8 sm:px-6 sm:py-10 md:grid-cols-12">
        <div className="col-span-2 space-y-3 md:col-span-5 md:pr-8">
          <Logo size="md" showTagline={true} />
          <p className="max-w-sm text-sm leading-relaxed text-ink-500">
            20Mart is your everyday value market, curating high-utility, reliable household essentials, kitchenware, organizers, and
            stationery at unbeatable neighborhood prices.
          </p>
        </div>

        <div className="md:col-span-2">
          <Column title="Categories">
            {categories.slice(0, 6).map((c) => (
              <li key={c.slug}>
                <Link href={`/category/${c.slug}`} className={linkCls}>
                  {c.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/shop" className={linkCls}>
                All Products
              </Link>
            </li>
          </Column>
        </div>

        <div className="md:col-span-3">
          <Column title="Customer Care">
            <li>
              <Link href="/account/orders" className={linkCls}>
                My Orders &amp; Tracking
              </Link>
            </li>
            <li>
              <Link href="/cart" className={linkCls}>
                Shopping Cart
              </Link>
            </li>
            <li>
              <Link href="/wishlist" className={linkCls}>
                My Wishlist
              </Link>
            </li>
            <li>
              <Link href="/faqs" className={linkCls}>
                FAQs &amp; Help Center
              </Link>
            </li>
            <li>
              <Link href="/contact" className={linkCls}>
                Contact Us
              </Link>
            </li>
          </Column>
        </div>

        <div className="col-span-2 sm:col-span-1 md:col-span-2">
          <Column title="About & Legal">
            <li>
              <Link href="/about" className={linkCls}>
                About 20Mart
              </Link>
            </li>
            <li>
              <Link href="/shipping-policy" className={linkCls}>
                Shipping &amp; Delivery
              </Link>
            </li>
            <li>
              <Link href="/terms" className={linkCls}>
                Terms &amp; Conditions
              </Link>
            </li>
            <li>
              <Link href="/privacy" className={linkCls}>
                Privacy Policy
              </Link>
            </li>
            <li>
              <PrivacyChoicesLink className={`${linkCls} text-left`} />
            </li>
          </Column>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-line-subtle bg-surface-page">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 text-2xs text-ink-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© 2026 20Mart. All rights reserved. Your Everyday Value Market.</p>
          <p>Made with precision for Indian households</p>
        </div>
      </div>
    </footer>
  );
};
