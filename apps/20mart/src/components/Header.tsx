'use client';

import React, { useState, useRef, useEffect, useId } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { Logo, cn, resolveImageSrc } from '@20mart/ui';
import { useStore } from '../lib/store';
import { useLocation } from '../lib/location';
import { LocationButton } from './LocationPicker';
import { Search as SearchIcon, ShoppingBag, Heart, User, MapPin, Menu, X, ArrowRight, TrendingUp, ChevronRight } from 'lucide-react';
import { formatPaise } from '@20mart/shared';

export interface HeaderCategory {
  name: string;
  slug: string;
}

interface Suggestion {
  slug: string;
  name: string;
  sellingPricePaise: number;
  imageUrl: string | null;
}

const POPULAR_SEARCHES = ['Kitchen tools', 'Storage', 'Notebook', 'Cleaning', 'Bottle', 'Hooks'];

const isDealsPath = (p: string) => p === '/deals' || p.startsWith('/deals') || p.includes('daily-deals');
const isShopPath = (p: string) => (p === '/shop' || p.startsWith('/shop')) && !isDealsPath(p);

/** Small icon button used for wishlist/cart/menu. */
const iconBtn =
  'relative flex h-10 w-10 items-center justify-center rounded-xl text-ink-700 transition-colors hover:bg-surface-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50';

const CountBadge: React.FC<{ n: number }> = ({ n }) =>
  n > 0 ? (
    <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-orange px-1 text-[10px] font-bold leading-none tabular-nums text-white ring-2 ring-surface">
      {n > 99 ? '99+' : n}
    </span>
  ) : null;

/**
 * Search combobox (rendered once for desktop and once for mobile). Arrow keys move through the
 * product suggestions and "Search all", Enter opens the highlighted option, Escape closes the list.
 */
const HeaderSearch: React.FC<{
  variant: 'desktop' | 'mobile';
  query: string;
  setQuery: (q: string) => void;
  results: Suggestion[];
  categories: HeaderCategory[];
  onSearch: (q: string) => void;
  onNavigate: (href: string) => void;
}> = ({ variant, query, setQuery, results, categories, onSearch, onNavigate }) => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const typed = query.trim().length > 0;
  // Keyboard-navigable options while typing: each product, then "Search all".
  const optionCount = typed ? results.length + 1 : 0;

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => setActive(-1), [query, results.length]);

  const close = () => {
    setOpen(false);
    setActive(-1);
  };
  const go = (href: string) => {
    close();
    inputRef.current?.blur();
    onNavigate(href);
  };
  const search = (q: string) => {
    close();
    inputRef.current?.blur();
    onSearch(q);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      close();
      return;
    }
    if (!optionCount) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % optionCount);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? optionCount - 1 : i - 1));
    } else if (e.key === 'Enter' && open && active >= 0) {
      e.preventDefault();
      if (active < results.length) {
        setQuery('');
        go(`/product/${results[active]!.slug}`);
      } else search(query);
    }
  };

  const optId = (i: number) => `${listId}-opt-${i}`;
  const mobile = variant === 'mobile';

  return (
    <div ref={wrapRef} className="relative w-full">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          search(query);
        }}
        className="relative flex items-center"
      >
        <SearchIcon className="pointer-events-none absolute left-3 h-4 w-4 text-ink-400" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? optId(active) : undefined}
          aria-label="Search products"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder={mobile ? 'Search everyday products' : 'Search for peelers, storage, brushes…'}
          className="h-10 w-full appearance-none rounded-xl border border-line bg-surface-muted pl-9 pr-[4.75rem] text-sm text-ink placeholder:text-ink-400 transition-colors hover:border-line-strong focus:border-brand-orange focus:bg-surface focus:outline-none focus:ring-4 focus:ring-brand-orange/10 [&::-webkit-search-cancel-button]:hidden"
        />
        <div className="absolute right-1 flex items-center gap-0.5">
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-surface-muted hover:text-ink-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="submit"
            aria-label="Search"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-orange text-white transition-colors hover:bg-brand-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 focus-visible:ring-offset-1"
          >
            <SearchIcon className="h-4 w-4" />
          </button>
        </div>
      </form>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop animate-pop-in">
          {typed ? (
            <div className="p-1.5">
              <p className="px-2.5 pb-1 pt-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-500">Products</p>
              <ul id={listId} role="listbox" aria-label="Search suggestions">
                {results.map((prod, i) => (
                  <li
                    key={prod.slug}
                    id={optId(i)}
                    role="option"
                    aria-selected={active === i}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setQuery('');
                      go(`/product/${prod.slug}`);
                    }}
                    className={cn('flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-1.5', active === i && 'bg-surface-muted')}
                  >
                    {prod.imageUrl ? (
                      <Image
                        src={resolveImageSrc(prod.imageUrl)}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 shrink-0 rounded-lg bg-surface-sunken object-contain p-0.5 mix-blend-multiply"
                      />
                    ) : (
                      <span className="h-10 w-10 shrink-0 rounded-lg bg-surface-sunken" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-800">{prod.name}</span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{formatPaise(prod.sellingPricePaise)}</span>
                  </li>
                ))}
                {results.length === 0 && <li className="px-2.5 py-3 text-sm text-ink-500">No matching products yet</li>}
                <li
                  id={optId(results.length)}
                  role="option"
                  aria-selected={active === results.length}
                  onMouseEnter={() => setActive(results.length)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => search(query)}
                  className={cn(
                    'mt-1 flex cursor-pointer items-center gap-2 rounded-xl border-t border-line-subtle px-2.5 py-2.5 text-sm font-semibold text-brand-orange-700',
                    active === results.length && 'bg-brand-orange-50'
                  )}
                >
                  <SearchIcon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">Search all for “{query.trim()}”</span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </li>
              </ul>
            </div>
          ) : (
            <div id={listId} className="space-y-3 p-3">
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-500">
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden /> Popular searches
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_SEARCHES.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => search(term)}
                      className="h-8 rounded-full border border-line bg-surface px-3 text-xs font-medium text-ink-700 transition-colors hover:border-brand-orange/40 hover:bg-brand-orange-50 hover:text-brand-orange-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
              {categories.length > 0 && (
                <div>
                  <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-ink-500">Categories</p>
                  <div className="grid grid-cols-2 gap-0.5">
                    {categories.slice(0, 4).map((cat) => (
                      <button
                        key={cat.slug}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => go(`/category/${cat.slug}`)}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm text-ink-700 transition-colors hover:bg-surface-muted hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50"
                      >
                        <span className="truncate">{cat.name}</span>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const Header: React.FC<{ categories: HeaderCategory[] }> = ({ categories }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { cartCount, wishlist, user, searchQuery, setSearchQuery } = useStore();
  const { label: locationLabel, openPicker } = useLocation();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Debounced live suggestions from the real catalog.
  const [searchResults, setSearchResults] = useState<Suggestion[]>([]);
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/catalog/search?q=${encodeURIComponent(q)}&limit=5`, { signal: ctrl.signal });
        if (res.ok) setSearchResults(((await res.json()) as { items: Suggestion[] }).items);
      } catch {
        /* aborted or offline */
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [searchQuery]);

  const executeSearch = (query: string) => {
    const q = query.trim();
    if (!q) return;
    setSearchQuery(q);
    router.push(`/shop?q=${encodeURIComponent(q)}`);
  };

  // Drawer: close on Escape and on route change.
  useEffect(() => {
    if (!mobileDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileDrawerOpen]);
  useEffect(() => setMobileDrawerOpen(false), [pathname]);

  const searchProps = {
    query: searchQuery,
    setQuery: setSearchQuery,
    results: searchResults,
    categories,
    onSearch: executeSearch,
    onNavigate: (href: string) => router.push(href),
  };

  const navLink = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex h-10 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50',
        active ? 'text-ink after:absolute after:inset-x-3 after:-bottom-[11px] after:h-0.5 after:rounded-full after:bg-brand-orange' : 'text-ink-600 hover:bg-surface-muted hover:text-ink'
      )}
    >
      {label}
    </Link>
  );

  const drawerLink = (href: string, label: React.ReactNode, active: boolean) => (
    <Link
      href={href}
      onClick={() => setMobileDrawerOpen(false)}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-11 items-center justify-between rounded-xl px-3 text-sm transition-colors',
        active ? 'bg-brand-orange-50 font-semibold text-brand-orange-700' : 'font-medium text-ink-700 hover:bg-surface-muted'
      )}
    >
      {label}
    </Link>
  );

  return (
    <>
      {/* Utility bar (scrolls away; the main row below stays sticky) */}
      <div className="bg-brand-green text-2xs text-white/80">
        <div className="mx-auto flex h-8 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <LocationButton tone="dark" className="max-w-full md:max-w-xs" />
          <div className="hidden items-center gap-4 md:flex">
            <span>
              Free delivery on orders above <span className="font-semibold text-white">₹199</span>
            </span>
            <span className="h-3 w-px bg-white/20" aria-hidden />
            <Link href="/about" className="hover:text-white">
              Why 20Mart?
            </Link>
            <Link href="/contact" className="hover:text-white">
              Help &amp; Support
            </Link>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 w-full border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/90">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex h-14 items-center gap-2 md:h-16 md:gap-4">
            <button type="button" onClick={() => setMobileDrawerOpen(true)} className={cn(iconBtn, '-ml-2 md:hidden')} aria-label="Open menu" aria-expanded={mobileDrawerOpen}>
              <Menu className="h-5 w-5" />
            </button>

            <Link href="/" aria-label="20Mart home" className="flex shrink-0 items-center rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50">
              {/* Only the mobile logo is preloaded: the hidden variant would otherwise be fetched too. */}
              <Logo size="sm" showTagline={false} className="sm:hidden" priority />
              <Logo size="md" showTagline={false} className="hidden sm:inline-flex" />
            </Link>

            <nav aria-label="Primary" className="hidden shrink-0 items-center md:flex">
              {navLink('/shop', 'Shop', isShopPath(pathname))}
              {navLink('/deals', 'Daily Deals', isDealsPath(pathname))}
            </nav>

            <div className="hidden min-w-0 flex-1 md:block md:max-w-xl md:mx-auto">
              <HeaderSearch variant="desktop" {...searchProps} />
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1 md:ml-0">
              <Link href="/wishlist" className={iconBtn} aria-label={`Wishlist${wishlist.length ? `, ${wishlist.length} items` : ''}`} title="Wishlist">
                <Heart className="h-5 w-5" />
                <CountBadge n={wishlist.length} />
              </Link>
              <Link href="/cart" className={iconBtn} aria-label={`Cart${cartCount ? `, ${cartCount} items` : ''}`} title="Cart">
                <ShoppingBag className="h-5 w-5" />
                <CountBadge n={cartCount} />
              </Link>

              {/* Account: desktop only (mobile uses the bottom navigation) */}
              {user ? (
                <Link
                  href="/account"
                  className="ml-1 hidden items-center gap-2 rounded-xl p-1 pr-1 transition-colors hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 md:flex xl:pr-2.5"
                  title={user.name ?? 'My Account'}
                >
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.image} alt="" referrerPolicy="no-referrer" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-brand-green text-xs font-semibold text-white">
                      {(user.name || user.email || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="hidden max-w-[9rem] flex-col text-left leading-tight xl:flex">
                    <span className="truncate text-xs font-semibold text-ink-800">{user.name ?? 'My Account'}</span>
                    <span className="text-2xs text-ink-500">My Account</span>
                  </span>
                </Link>
              ) : (
                <Link
                  href="/auth"
                  className="ml-1 hidden h-9 items-center rounded-lg bg-brand-green px-3.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-green-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40 focus-visible:ring-offset-2 md:inline-flex"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>

          {/* Mobile search row */}
          <div className="pb-2.5 md:hidden">
            <HeaderSearch variant="mobile" {...searchProps} />
          </div>
        </div>
      </header>

      {/* Mobile slide-over drawer */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="fixed inset-0 bg-ink/40 animate-fade-in" onClick={() => setMobileDrawerOpen(false)} />

          <div className="relative z-10 flex h-full w-80 max-w-[85vw] flex-col bg-surface shadow-pop animate-fade-in">
            <div className="flex h-14 items-center justify-between border-b border-line-subtle px-4">
              <Logo size="sm" showTagline={false} />
              <button type="button" onClick={() => setMobileDrawerOpen(false)} className={cn(iconBtn, '-mr-2')} aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-3">
              <button
                type="button"
                onClick={() => {
                  setMobileDrawerOpen(false);
                  openPicker();
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-line-subtle bg-surface-page p-3 text-left"
              >
                <MapPin className="h-4 w-4 shrink-0 text-brand-orange" />
                <span className="min-w-0 flex-1">
                  <span className="block text-2xs text-ink-500">Delivery location</span>
                  <span className="block truncate text-sm font-semibold text-ink">{locationLabel ?? 'Select location'}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-400" />
              </button>

              <nav aria-label="Menu" className="space-y-0.5">
                {drawerLink('/', 'Home', pathname === '/')}
                {drawerLink('/shop', 'Shop all products', isShopPath(pathname))}
                {drawerLink(
                  '/deals',
                  <>
                    <span>Daily Deals</span>
                    <span className="rounded-full bg-brand-orange-50 px-2 py-0.5 text-2xs font-semibold text-brand-orange-700">Hot</span>
                  </>,
                  isDealsPath(pathname)
                )}
                {drawerLink('/category', 'Categories', pathname === '/category')}
              </nav>

              {categories.length > 0 && (
                <div>
                  <p className="px-3 pb-1 text-2xs font-semibold uppercase tracking-wide text-ink-500">Shop by category</p>
                  <div className="space-y-0.5">
                    {categories.map((c) => (
                      <React.Fragment key={c.slug}>{drawerLink(`/category/${c.slug}`, c.name, pathname === `/category/${c.slug}`)}</React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-line-subtle p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {user ? (
                <Link
                  href="/account"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="flex h-11 items-center gap-2 rounded-xl bg-brand-green-50 px-3 text-sm font-semibold text-brand-green"
                >
                  <User className="h-4 w-4" />
                  <span className="truncate">My Account{user.name ? ` (${user.name})` : ''}</span>
                </Link>
              ) : (
                <Link
                  href="/auth"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="flex h-11 w-full items-center justify-center rounded-xl bg-brand-green text-sm font-semibold text-white hover:bg-brand-green-hover"
                >
                  Sign in with Google
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
