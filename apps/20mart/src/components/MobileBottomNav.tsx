'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, Flame, User, LucideIcon, Heart } from 'lucide-react';
import { cn } from '@20mart/ui';
import { useStore } from '../lib/store';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  exact: boolean;
  badge?: number;
}

/**
 * Mobile tab bar. Height is 3.5rem + the safe-area inset; the body padding (layout.tsx) and the consent
 * banner offset (ConsentBanner.tsx) use that same sum so nothing sits underneath it.
 */
export const MobileBottomNav: React.FC = () => {
  const pathname = usePathname();
  const { wishlist } = useStore();

  const navItems: NavItem[] = [
    { label: 'Home', href: '/', icon: Home, exact: true },
    { label: 'Shop', href: '/shop', icon: LayoutGrid, exact: false },
    { label: 'Wishlist', href: '/wishlist', icon: Heart, exact: false, badge: wishlist.length },
    { label: 'Deals', href: '/deals', icon: Flame, exact: false },
    { label: 'Account', href: '/account', icon: User, exact: false },
  ];

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 block border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-surface/90 md:hidden"
    >
      <div className="mx-auto grid h-14 max-w-md grid-cols-5">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : item.href === '/deals'
            ? pathname === '/deals' || pathname.startsWith('/deals') || pathname.includes('daily-deals')
            : item.href === '/shop'
            ? (pathname === '/shop' || pathname.startsWith('/shop')) && !pathname.includes('daily-deals') && !pathname.startsWith('/deals')
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group flex select-none flex-col items-center justify-center gap-0.5 focus:outline-none',
                isActive ? 'text-brand-orange-700' : 'text-ink-500 active:text-ink'
              )}
            >
              <span
                className={cn(
                  'relative flex h-7 w-12 items-center justify-center rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-brand-orange/50',
                  isActive && 'bg-brand-orange-50'
                )}
              >
                <Icon className={cn('h-5 w-5', isActive ? 'stroke-[2.25] text-brand-orange' : 'stroke-[1.75]')} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-0.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-orange px-1 text-[10px] font-bold leading-none tabular-nums text-white ring-2 ring-surface">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </span>
              <span className={cn('text-2xs leading-none', isActive ? 'font-semibold' : 'font-medium')}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
