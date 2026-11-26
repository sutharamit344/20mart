'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@20mart/ui';
import { getCategoryTheme } from '../lib/category-theme';

/** Horizontally scrolling category chips (mobile swipes, desktop wraps into one row). */
export function CategoryStrip({ categories }: { categories: { id?: string; name: string; slug: string }[] }) {
  const pathname = usePathname();
  if (!categories.length) return null;
  return (
    <nav aria-label="Categories" className="relative mx-auto max-w-7xl">
      <ul className="flex snap-x gap-2 overflow-x-auto px-4 py-1 scrollbar-none sm:px-6">
        {categories.map((cat) => {
          const theme = getCategoryTheme(cat.slug);
          const Icon = theme.icon;
          const active = pathname === `/category/${cat.slug}`;
          return (
            <li key={cat.id ?? cat.slug} className="shrink-0 snap-start">
              <Link
                href={`/category/${cat.slug}`}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group flex h-10 items-center gap-2 rounded-full border pl-1.5 pr-3.5 text-sm font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50',
                  active
                    ? 'border-brand-green/30 bg-brand-green-50 text-brand-green'
                    : 'border-line bg-surface text-ink-700 hover:border-line-strong hover:text-ink'
                )}
              >
                <span style={{ backgroundColor: theme.bg }} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                  <Icon className="h-3.5 w-3.5" style={{ color: theme.iconColor }} aria-hidden />
                </span>
                {cat.name}
              </Link>
            </li>
          );
        })}
      </ul>
      {/* Edge fade hints that the row scrolls (mobile only) */}
      <span className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface-page sm:hidden" aria-hidden />
    </nav>
  );
}
