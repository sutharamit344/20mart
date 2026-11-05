'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AccountLayout } from '../../components/AccountLayout';
import { useStore } from '../../lib/store';
import { Button } from '@20mart/ui';
import {
  ShoppingBag,
  Tag,
  Heart,
  MapPin,
  Truck,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

export default function AccountOverviewPage() {
  const router = useRouter();
  const { user, orders, coupons, wishlist, addresses } = useStore();

  const recentOrder = orders[0];

  return (
    <AccountLayout
      title="Account Dashboard"
      subtitle="Welcome back! Manage your orders, rewards, addresses, and personal profile."
      activeKey="profile"
    >
      <div className="space-y-5">
        {/* Metric Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          <div
            onClick={() => router.push('/account/orders')}
            className="p-3 rounded-2xl bg-gray-50 hover:bg-[#FFF6E9] transition-all cursor-pointer border border-gray-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#0B5D3B] shadow-xs mb-1.5">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div className="text-lg font-bold text-gray-900">{orders.length}</div>
            <div className="text-[11px] text-gray-500 font-medium">Total Orders</div>
          </div>

          <div
            onClick={() => router.push('/account/coupons')}
            className="p-3 rounded-2xl bg-gray-50 hover:bg-[#FFF6E9] transition-all cursor-pointer border border-gray-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#FF7A00] shadow-xs mb-1.5">
              <Tag className="w-4 h-4" />
            </div>
            <div className="text-lg font-bold text-gray-900">{coupons.length}</div>
            <div className="text-[11px] text-gray-500 font-medium">Coupons Available</div>
          </div>

          <div
            onClick={() => router.push('/account/wishlist')}
            className="p-3 rounded-2xl bg-gray-50 hover:bg-[#FFF6E9] transition-all cursor-pointer border border-gray-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-red-500 shadow-xs mb-1.5">
              <Heart className="w-4 h-4" />
            </div>
            <div className="text-lg font-bold text-gray-900">{wishlist.length}</div>
            <div className="text-[11px] text-gray-500 font-medium">Wishlist Items</div>
          </div>

          <div
            onClick={() => router.push('/account/addresses')}
            className="p-3 rounded-2xl bg-gray-50 hover:bg-[#FFF6E9] transition-all cursor-pointer border border-gray-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-blue-600 shadow-xs mb-1.5">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="text-lg font-bold text-gray-900">{addresses.length}</div>
            <div className="text-[11px] text-gray-500 font-medium">Saved Addresses</div>
          </div>
        </div>

        {/* Latest Order Card */}
        {recentOrder && (
          <div className="rounded-2xl border border-gray-100 p-4 space-y-3 bg-white shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-gray-400">Recent Order</span>
                <h3 className="text-xs sm:text-sm font-bold text-gray-900">
                  Order #{recentOrder.orderNumber}
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100">
                {recentOrder.status.replace('_', ' ')}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-600 pt-1 border-t border-gray-100">
              <span>Placed on {recentOrder.createdAt}</span>
              <span className="font-bold text-gray-900">₹{recentOrder.total}</span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                variant="primary"
                onClick={() => router.push(`/account/orders/${recentOrder.orderNumber}`)}
                className="font-bold text-xs"
              >
                Track Order
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push('/account/orders')}
                className="text-xs"
              >
                View All Orders
              </Button>
            </div>
          </div>
        )}

        {/* Profile Card & Address Preview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="p-3.5 rounded-2xl border border-gray-100 bg-gray-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-900">Default Delivery Address</h4>
              <Link href="/account/addresses" className="text-[11px] font-bold text-[#FF7A00] hover:underline">
                Manage
              </Link>
            </div>
            {addresses[0] ? (
              <div className="text-xs text-gray-600 space-y-0.5">
                <p className="font-bold text-gray-900">{addresses[0].name} ({addresses[0].type})</p>
                <p>{addresses[0].addressLine1}, {addresses[0].city} – {addresses[0].pincode}</p>
                <p className="text-[11px] text-gray-500">{addresses[0].phone}</p>
              </div>
            ) : (
              <p className="text-xs text-gray-400">No saved address yet.</p>
            )}
          </div>

          <div className="p-3.5 rounded-2xl border border-gray-100 bg-gray-50/50 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-900">Quick Links</h4>
            </div>
            <div className="space-y-1.5 text-xs">
              <Link href="/coupons" className="flex items-center justify-between text-gray-700 hover:text-[#FF7A00]">
                <span>Claim ₹50 Survey Coupon</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link href="/contact" className="flex items-center justify-between text-gray-700 hover:text-[#FF7A00]">
                <span>Contact 20Mart Support</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link href="/faqs" className="flex items-center justify-between text-gray-700 hover:text-[#FF7A00]">
                <span>Frequently Asked Questions</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AccountLayout>
  );
}
