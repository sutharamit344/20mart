'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  Bell,
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
  const { user, logoutUser, wishlist } = useStore();

  const navItems = [
    { key: 'orders', label: 'My Orders', href: '/account/orders', icon: ShoppingBag },
    { key: 'tracking', label: 'Track Active Order', href: '/account/tracking', icon: Truck },
    { key: 'wishlist', label: 'My Wishlist', href: '/account/wishlist', icon: Heart, badge: String(wishlist.length) },
    { key: 'coupons', label: 'My Coupons', href: '/account/coupons', icon: Tag },
    { key: 'notifications', label: 'Notifications', href: '/account/notifications', icon: Bell },
    { key: 'addresses', label: 'My Addresses', href: '/account/addresses', icon: MapPin },
    { key: 'profile', label: 'Profile Details', href: '/account/profile', icon: User },
    { key: 'settings', label: 'Email Preferences', href: '/account/settings', icon: Settings },
    { key: 'help', label: 'Help & Support', href: '/contact', icon: HelpCircle },
  ];

  const handleLogout = async () => {
    await logoutUser();
    router.push('/');
    router.refresh();
  };

  const initials =
    (user?.name || user?.email || '?')
      .split(/[\s@]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0]?.toUpperCase())
      .join('') || '?';

  const isActive = (item: (typeof navItems)[number]) => (activeKey ? activeKey === item.key : pathname === item.href);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-3 sm:px-6 sm:pt-4">
      {/* Mobile: compact identity + horizontally scrolling section tabs */}
      <div className="mb-3 md:hidden">
        <div className="mb-2 flex items-center gap-3">
          {user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" referrerPolicy="no-referrer" className="h-9 w-9 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-green text-xs font-semibold text-white">{initials}</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{user?.name || 'My Account'}</p>
            <p className="truncate text-2xs text-ink-500">{user?.email || ' '}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-danger hover:bg-danger-soft"
          >
            <LogOut className="h-4 w-4" aria-hidden /> Sign out
          </button>
        </div>
        <nav aria-label="Account sections" className="-mx-4">
          <ul className="flex gap-1.5 overflow-x-auto px-4 pb-1 scrollbar-none">
            {navItems.map((item) => {
              const on = isActive(item);
              return (
                <li key={item.key} className="shrink-0">
                  <Link
                    href={item.href}
                    aria-current={on ? 'page' : undefined}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium ${
                      on ? 'border-brand-orange/40 bg-brand-orange-50 text-brand-orange-700' : 'border-line bg-surface text-ink-600'
                    }`}
                  >
                    {item.label}
                    {item.badge && item.badge !== '0' && <span className="tabular-nums text-ink-400">{item.badge}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-12 lg:gap-6">
        {/* Desktop/tablet sidebar */}
        <aside className="sticky top-24 hidden space-y-3 rounded-2xl border border-line-subtle bg-surface p-3 md:col-span-4 md:block lg:col-span-3">
          <div className="flex items-center gap-3 border-b border-line-subtle px-1 pb-3">
            {user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" referrerPolicy="no-referrer" className="h-10 w-10 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-green text-sm font-semibold text-white">{initials}</div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{user?.name || 'My Account'}</p>
              <p className="truncate text-2xs text-ink-500">{user?.email || ' '}</p>
            </div>
          </div>

          <nav aria-label="Account sections" className="space-y-0.5">
            {navItems.map((item) => {
              const on = isActive(item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={on ? 'page' : undefined}
                  className={`flex h-10 items-center justify-between rounded-xl px-3 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 ${
                    on ? 'bg-brand-orange-50 font-semibold text-brand-orange-700' : 'font-medium text-ink-700 hover:bg-surface-muted hover:text-ink'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className={`h-4 w-4 shrink-0 ${on ? 'text-brand-orange' : 'text-ink-400'}`} aria-hidden />
                    {item.label}
                  </span>
                  {item.badge && item.badge !== '0' ? (
                    <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-2xs font-semibold tabular-nums text-ink-600">{item.badge}</span>
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-ink-400" aria-hidden />
                  )}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={handleLogout}
              className="mt-1 flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-sm font-medium text-danger transition-colors hover:bg-danger-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50"
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              Sign out
            </button>
          </nav>
        </aside>

        {/* Content */}
        <section className="min-w-0 space-y-4 rounded-2xl border border-line-subtle bg-surface p-4 sm:p-5 md:col-span-8 lg:col-span-9">
          <div className="border-b border-line-subtle pb-3">
            <h1 className="text-lg font-semibold text-ink sm:text-xl">{title}</h1>
            {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
          </div>
          <div>{children}</div>
        </section>
      </div>
    </div>
  );
};
