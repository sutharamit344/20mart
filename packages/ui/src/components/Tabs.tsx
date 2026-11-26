'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../lib/utils';
import { ChevronRight, ChevronLeft } from 'lucide-react';

export interface TabsProps {
  tabs: { id: string; label: string; count?: number; icon?: React.ReactNode }[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'underline' | 'pills' | 'segmented';
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'underline',
  className,
}) => {
  if (variant === 'pills') {
    return (
      <div className={cn('flex items-center gap-2 overflow-x-auto pb-1', className)}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                'inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all whitespace-nowrap',
                isActive
                  ? 'bg-brand-green text-white shadow-sm'
                  : 'bg-surface-muted text-ink-600 hover:bg-line hover:text-ink'
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded-full text-2xs font-bold',
                    isActive ? 'bg-surface/20 text-white' : 'bg-line text-ink-700'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn('flex border-b border-line overflow-x-auto', className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap -mb-px',
              isActive
                ? 'border-brand-orange text-brand-orange'
                : 'border-transparent text-ink-500 hover:text-ink-800 hover:border-line-strong'
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-bold',
                  isActive ? 'bg-brand-orange-100 text-brand-orange' : 'bg-surface-muted text-ink-600'
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className }) => {
  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0 text-xs text-ink-500', className)}>
      <ol className="flex min-w-0 items-center gap-1">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={idx} className={cn('flex items-center gap-1', isLast ? 'min-w-0' : 'shrink-0')}>
              {idx > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />}
              {isLast || !item.href ? (
                <span aria-current={isLast ? 'page' : undefined} className="truncate font-medium text-ink-700">
                  {item.label}
                </span>
              ) : (
                <a href={item.href} className="inline-flex min-h-6 items-center rounded transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50">
                  {item.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/** Pages to show: first, last, current ±1, with gaps (null) — never one button per page. */
export function paginationItems(current: number, total: number): (number | null)[] {
  const keep = new Set([1, total, current - 1, current, current + 1].filter((p) => p >= 1 && p <= total));
  if (current <= 3) [2, 3, 4].forEach((p) => p <= total && keep.add(p));
  if (current >= total - 2) [total - 3, total - 2, total - 1].forEach((p) => p >= 1 && keep.add(p));
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(p - sorted[i - 1] === 2 ? p - 1 : null);
    out.push(p);
  });
  return out;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className,
}) => {
  if (totalPages <= 1) return null;
  const arrow = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink-600 hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <nav aria-label="Pagination" className={cn('flex flex-wrap items-center justify-center gap-1.5', className)}>
      <button type="button" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)} className={arrow}>
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      </button>

      {paginationItems(currentPage, totalPages).map((page, i) =>
        page === null ? (
          <span key={`gap-${i}`} className="flex h-9 w-6 shrink-0 items-center justify-center text-xs text-ink-500" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={page}
            type="button"
            aria-label={`Page ${page}`}
            aria-current={currentPage === page ? 'page' : undefined}
            onClick={() => onPageChange(page)}
            className={cn(
              'flex h-9 min-w-9 shrink-0 items-center justify-center rounded-xl px-2 text-xs font-semibold tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50',
              currentPage === page ? 'bg-brand-orange text-white shadow-sm' : 'border border-line bg-surface text-ink-700 hover:bg-surface-muted'
            )}
          >
            {page}
          </button>
        )
      )}

      <button type="button" aria-label="Next page" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)} className={arrow}>
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </nav>
  );
};
