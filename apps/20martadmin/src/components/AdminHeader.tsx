'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search, Menu, ChevronDown, ChevronRight, LogOut, ExternalLink } from 'lucide-react';
import { initials, type SidebarUser } from './AdminSidebar';

interface AdminHeaderProps {
  user: SidebarUser;
  onMenuClick: () => void;
  canSearchProducts: boolean;
  onLogout?: () => void;
  storefrontUrl?: string;
}

/** Readable names for top-level admin sections (breadcrumbs only; no routing or permission meaning). */
const SECTION_LABELS: Record<string, string> = {
  analytics: 'Analytics',
  products: 'Products',
  categories: 'Categories',
  brands: 'Brands',
  inventory: 'Inventory',
  warehouses: 'Warehouses',
  'purchase-orders': 'Purchase Orders',
  suppliers: 'Suppliers',
  orders: 'Orders',
  inquiries: 'Customer Inquiries',
  customers: 'Customers',
  delivery: 'Delivery & Payments',
  coupons: 'Coupons',
  campaigns: 'Campaigns',
  notifications: 'Email log',
  access: 'Access Management',
  audit: 'Audit Logs',
  movements: 'Movements',
  import: 'Bulk import',
  new: 'New',
  compare: 'Compare',
};

function crumbsFor(pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; href?: string }[] = [{ label: 'Dashboard', href: '/' }];
  parts.forEach((part, i) => {
    const href = '/' + parts.slice(0, i + 1).join('/');
    // Record ids (UUIDs, cuid-like strings) read as "Details"; readable slugs are shown as-is.
    const isId = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(part) || (part.length >= 20 && /\d/.test(part) && !part.includes('-'));
    const label = SECTION_LABELS[part] ?? (isId ? 'Details' : decodeURIComponent(part).replace(/-/g, ' '));
    crumbs.push({ label, href: i < parts.length - 1 ? href : undefined });
  });
  return crumbs;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ user, onMenuClick, canSearchProducts, onLogout, storefrontUrl }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => menuRef.current && !menuRef.current.contains(e.target as Node) && setMenuOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);
  useEffect(() => setMenuOpen(false), [pathname]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    router.push(`/products?q=${encodeURIComponent(term)}`);
  };

  const crumbs = crumbsFor(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full shrink-0 items-center gap-2 border-b border-line bg-surface/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-surface/90 sm:gap-3 sm:px-5">
      <button
        type="button"
        onClick={onMenuClick}
        className="-ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-ink-600 hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Breadcrumbs (desktop) */}
      <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
        <ol className="flex min-w-0 items-center gap-1 text-xs text-ink-500">
          {crumbs.map((c, i) => (
            <li key={i} className={`flex items-center gap-1 ${i === crumbs.length - 1 ? 'min-w-0' : 'shrink-0'}`}>
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden />}
              {c.href ? (
                <Link href={c.href} className="rounded hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40">
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page" className="truncate font-medium text-ink-800">
                  {c.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 md:flex-none">
        {canSearchProducts && (
          <form onSubmit={onSubmit} className="relative w-full max-w-xs" role="search">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search products or SKU…"
              aria-label="Search products"
              className="h-9 w-full rounded-lg border border-line bg-surface-page pl-8 pr-3 text-sm text-ink placeholder:text-ink-400 transition-colors hover:border-line-strong focus:border-brand-green focus:bg-surface focus:outline-none focus:ring-4 focus:ring-brand-green/10"
            />
          </form>
        )}

        {/* User menu */}
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Account menu for ${user.name}`}
            className="flex h-9 items-center gap-2 rounded-lg pl-1 pr-1.5 hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-green text-[11px] font-semibold text-white">{initials(user.name)}</span>
            <span className="hidden max-w-[9rem] text-left leading-tight xl:block">
              <span className="block truncate text-xs font-semibold text-ink">{user.name}</span>
              <span className="block truncate text-[10px] text-ink-500">{user.roleLabel}</span>
            </span>
            <ChevronDown className="hidden h-3.5 w-3.5 text-ink-400 sm:block" aria-hidden />
          </button>
          {menuOpen && (
            <div role="menu" className="absolute right-0 top-full z-50 mt-1.5 w-60 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-pop animate-pop-in">
              <div className="border-b border-line-subtle px-3 py-2.5">
                <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
                <p className="truncate text-2xs text-ink-500">{user.roleLabel}</p>
              </div>
              {storefrontUrl && (
                <a
                  role="menuitem"
                  href={storefrontUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 items-center gap-2 px-3 text-sm text-ink-700 hover:bg-surface-muted focus:bg-surface-muted focus:outline-none"
                >
                  <ExternalLink className="h-4 w-4 text-ink-400" aria-hidden /> Open storefront
                </a>
              )}
              {onLogout && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={onLogout}
                  className="flex h-9 w-full items-center gap-2 px-3 text-left text-sm text-danger hover:bg-danger-soft focus:bg-danger-soft focus:outline-none"
                >
                  <LogOut className="h-4 w-4" aria-hidden /> Sign out
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
