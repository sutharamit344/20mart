'use client';

import React from 'react';
import Link from 'next/link';
import { Logo } from '@20mart/ui';
import {
  ShieldCheck,
  Truck,
  RotateCcw,
  Headphones,
  MapPin,
  Mail,
  Phone,
} from 'lucide-react';

export const Footer: React.FC = () => {
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
              <h4 className="text-xs sm:text-sm font-bold text-gray-900">Fast Delivery</h4>
              <p className="text-[10px] sm:text-[11px] text-gray-500">Direct to your doorstep</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-gray-900">Easy Returns</h4>
              <p className="text-[10px] sm:text-[11px] text-gray-500">Hassle-free guarantee</p>
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
            <div className="space-y-1.5 text-xs text-gray-600 pt-1">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#FF7A00] shrink-0" />
                <span>Chanakyapuri, Ahmedabad, Gujarat 380061</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#FF7A00] shrink-0" />
                <span>+91 98765 43210</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#FF7A00] shrink-0" />
                <span>support@20mart.in</span>
              </div>
            </div>
          </div>

          {/* Quick Categories */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-900">Categories</h4>
            <ul className="space-y-1.5 text-xs text-gray-500">
              <li>
                <Link href="/category/kitchen-home" className="hover:text-[#FF7A00] transition-colors">
                  Kitchen & Home
                </Link>
              </li>
              <li>
                <Link href="/category/cleaning-care" className="hover:text-[#FF7A00] transition-colors">
                  Cleaning & Care
                </Link>
              </li>
              <li>
                <Link href="/category/stationery-school" className="hover:text-[#FF7A00] transition-colors">
                  Stationery & School
                </Link>
              </li>
              <li>
                <Link href="/category/daily-use" className="hover:text-[#FF7A00] transition-colors">
                  Daily Use Items
                </Link>
              </li>
              <li>
                <Link href="/category/personal-care" className="hover:text-[#FF7A00] transition-colors">
                  Personal Care
                </Link>
              </li>
              <li>
                <Link href="/shop" className="hover:text-[#FF7A00] transition-colors">
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
                <Link href="/account/orders" className="hover:text-[#FF7A00] transition-colors">
                  My Orders & Tracking
                </Link>
              </li>
              <li>
                <Link href="/cart" className="hover:text-[#FF7A00] transition-colors">
                  Shopping Cart
                </Link>
              </li>
              <li>
                <Link href="/wishlist" className="hover:text-[#FF7A00] transition-colors">
                  My Wishlist
                </Link>
              </li>
              <li>
                <Link href="/coupons" className="hover:text-[#FF7A00] transition-colors">
                  Coupons & Rewards
                </Link>
              </li>
              <li>
                <Link href="/faqs" className="hover:text-[#FF7A00] transition-colors">
                  FAQs & Help Center
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-[#FF7A00] transition-colors">
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
                <Link href="/about" className="hover:text-[#FF7A00] transition-colors">
                  About 20Mart
                </Link>
              </li>
              <li>
                <Link href="/early-access" className="hover:text-[#FF7A00] transition-colors">
                  Early Access Campaign
                </Link>
              </li>
              <li>
                <Link href="/survey" className="hover:text-[#FF7A00] transition-colors">
                  Product Survey Reward
                </Link>
              </li>
              <li>
                <Link href="/shipping-policy" className="hover:text-[#FF7A00] transition-colors">
                  Shipping & Delivery
                </Link>
              </li>
              <li>
                <Link href="/returns-policy" className="hover:text-[#FF7A00] transition-colors">
                  Returns & Refunds
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-[#FF7A00] transition-colors">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-[#FF7A00] transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <a
                  href="http://localhost:3001"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-[#0B5D3B] hover:underline"
                >
                  20MartAdmin Portal ↗
                </a>
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
