import React from 'react';
import Link from 'next/link';
import { Logo } from '@20mart/ui';
import { PrivacyChoicesLink } from './ConsentBanner';
import {
  ShieldCheck,
  Truck,
  Headphones,
} from 'lucide-react';

export const Footer: React.FC<{ categories: { name: string; slug: string }[] }> = ({ categories }) => {
  return (
    <footer className="mt-10 sm:mt-14 bg-white border-t border-gray-100">
      {/* 1. Value Pillars Row */}
      <div className="border-b border-gray-100 py-6 sm:py-8 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF6E9] text-[#FF7A00]">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-gray-900">Great Value</h4>
              <p className="text-[10px] sm:text-[11px] text-gray-500">Everyday budget prices</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-[#0B5D3B]">
              <Truck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-gray-900">Home Delivery</h4>
              <p className="text-[10px] sm:text-[11px] text-gray-500">Direct to your doorstep</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-gray-900">100% Genuine</h4>
              <p className="text-[10px] sm:text-[11px] text-gray-500">Quality assured essentials</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF6E9] text-[#FF7A00]">
              <Headphones className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-gray-900">24/7 Support</h4>
              <p className="text-[10px] sm:text-[11px] text-gray-500">Dedicated assistance</p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Footer Navigation */}
      <div className="py-8 sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Info */}
          <div className="md:col-span-2 space-y-3 sm:space-y-4">
            <Logo size="md" showTagline={true} />
            <p className="text-xs text-gray-500 max-w-sm leading-relaxed">
              20Mart is your everyday value market, curating high-utility, reliable household essentials,
              kitchenware, organizers, and stationery at unbeatable neighborhood prices.
            </p>
          </div>

          {/* Quick Categories */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900">Categories</h4>
            <ul className="space-y-1.5 text-xs text-gray-500">
              {categories.slice(0, 6).map((c) => (
                <li key={c.slug}>
                  <Link href={`/category/${c.slug}`} className="inline-block py-1 hover:text-[#FF7A00] transition-colors">
                    {c.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/shop" className="inline-block py-1 hover:text-[#FF7A00] transition-colors">
                  All Products
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900">Customer Care</h4>
            <ul className="space-y-1.5 text-xs text-gray-500">
              <li>
                <Link href="/account/orders" className="inline-block py-1 hover:text-[#FF7A00] transition-colors">
                  My Orders & Tracking
                </Link>
              </li>
              <li>
                <Link href="/cart" className="inline-block py-1 hover:text-[#FF7A00] transition-colors">
                  Shopping Cart
                </Link>
              </li>
              <li>
                <Link href="/wishlist" className="inline-block py-1 hover:text-[#FF7A00] transition-colors">
                  My Wishlist
                </Link>
              </li>
              <li>
                <Link href="/faqs" className="inline-block py-1 hover:text-[#FF7A00] transition-colors">
                  FAQs & Help Center
                </Link>
              </li>
              <li>
                <Link href="/contact" className="inline-block py-1 hover:text-[#FF7A00] transition-colors">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* About & Policies */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900">About & Legal</h4>
            <ul className="space-y-1.5 text-xs text-gray-500">
              <li>
                <Link href="/about" className="inline-block py-1 hover:text-[#FF7A00] transition-colors">
                  About 20Mart
                </Link>
              </li>
              <li>
                <Link href="/shipping-policy" className="inline-block py-1 hover:text-[#FF7A00] transition-colors">
                  Shipping & Delivery
                </Link>
              </li>

              <li>
                <Link href="/terms" className="inline-block py-1 hover:text-[#FF7A00] transition-colors">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="inline-block py-1 hover:text-[#FF7A00] transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <PrivacyChoicesLink className="inline-block py-1 text-left hover:text-[#FF7A00] transition-colors" />
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* 3. Bottom Copyright */}
      <div className="border-t border-gray-100 py-6 bg-gray-50 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 20Mart. All rights reserved. Your Everyday Value Market.</p>
          <div className="flex items-center gap-4 text-gray-400">
            <span>Made with precision for Indian households</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
