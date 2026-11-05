'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Grid, Tag, Flame, User, LucideIcon } from 'lucide-react';
import { cn } from '@20mart/ui';
import { useStore } from '../lib/store';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  exact: boolean;
  badge?: number;
}

export const MobileBottomNav: React.FC = () => {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { label: 'Home', href: '/', icon: Home, exact: true },
    { label: 'Shop', href: '/shop', icon: Grid, exact: false },
    { label: 'Offers', href: '/coupons', icon: Tag, exact: false },
    { label: 'Deals', href: '/shop?filter=daily-deals', icon: Flame, exact: false },
    { label: 'Account', href: '/account', icon: User, exact: false },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 block md:hidden bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-[0_-2px_10px_rgba(0,0,0,0.04)] px-1 pt-1.5 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                'relative flex flex-col items-center justify-center py-0.5 px-2.5 min-w-[52px] transition-all select-none',
                isActive ? 'text-[#FF7A00]' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <div className="relative">
                <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 flex h-3.5 min-w-3.5 px-0.5 items-center justify-center rounded-full bg-[#FF7A00] text-[9px] font-bold text-white leading-none">
                    {item.badge}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] mt-0.5 tracking-tight leading-none',
                  isActive ? 'font-bold text-[#FF7A00]' : 'font-medium text-gray-500'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
