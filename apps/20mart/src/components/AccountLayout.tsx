'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Breadcrumb } from '@20mart/ui';
import { useStore } from '../lib/store';
import {
  ShoppingBag,
  Heart,
  Tag,
  User,
  MapPin,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  Truck,
  Compass,
} from 'lucide-react';

interface AccountLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  activeKey?: string;
}

export const AccountLayout: React.FC<AccountLayoutProps> = ({
  children,
  title,
  subtitle,
  activeKey,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logoutUser, orders, coupons, wishlist } = useStore();

  const navItems = [
    { key: 'orders', label: 'My Orders', href: '/account/orders', icon: ShoppingBag, badge: String(orders.length) },
    { key: 'tracking', label: 'Track Active Order', href: '/account/tracking', icon: Truck },
    { key: 'coupons', label: 'My Rewards & Coupons', href: '/account/coupons', icon: Tag, badge: String(coupons.length) },
    { key: 'wishlist', label: 'My Wishlist', href: '/account/wishlist', icon: Heart, badge: String(wishlist.length) },
    { key: 'addresses', label: 'My Addresses', href: '/account/addresses', icon: MapPin },
    { key: 'profile', label: 'Profile Details', href: '/account/profile', icon: User },
    { key: 'settings', label: 'Account Settings', href: '/account/settings', icon: Settings },
    { key: 'help', label: 'Help & Support', href: '/contact', icon: HelpCircle },
  ];

  const handleLogout = () => {
    logoutUser();
    router.push('/');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5">
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'My Account', href: '/account' },
          { label: title },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Left Side Navigation Menu (Desktop & Tablet) */}
        <div className="md:col-span-4 rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-4 sm:p-5 shadow-xs space-y-4">
          {/* User Profile Card Header */}
          <div className="flex items-center gap-3 pb-3.5 border-b border-gray-100">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0B5D3B] text-white font-bold text-lg shadow-xs">
              {user?.name?.split(' ').map((n) => n[0]).join('') || 'AK'}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm sm:text-base font-bold text-gray-900 truncate">
                {user?.name || 'Amit Kumar'}
              </h2>
              <p className="text-[11px] text-gray-500 truncate">{user?.phone || '+91 98765 43210'}</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = activeKey ? activeKey === item.key : pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs sm:text-[13px] font-semibold transition-all ${
                    isActive
                      ? 'bg-[#FFF6E9] text-[#FF7A00] font-bold'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#FF7A00]' : 'text-gray-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {item.badge && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          isActive
                            ? 'bg-[#FF7A00] text-white'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight className={`w-3.5 h-3.5 ${isActive ? 'text-[#FF7A00]' : 'text-gray-300'}`} />
                  </div>
                </Link>
              );
            })}

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs sm:text-[13px] font-semibold text-red-600 hover:bg-red-50 transition-colors mt-2"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Sign Out</span>
            </button>
          </nav>
        </div>

        {/* Right Content Panel */}
        <div className="md:col-span-8 rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-4 sm:p-6 shadow-xs space-y-4">
          <div className="pb-3 border-b border-gray-100">
            <h1 className="text-base sm:text-lg font-bold text-gray-900">{title}</h1>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>

          <div>{children}</div>
        </div>
      </div>
    </div>
  );
};

