'use client';

import React, { useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Drawer, Pagination, Radio, cn } from '@20mart/ui';
import { Loader2, SlidersHorizontal, X } from 'lucide-react';
import { PRICE_BUCKETS } from './price-buckets';

function useQueryUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const update = (changes: Record<string, string | null>, keepPage = false) => {
    const sp = new URLSearchParams(params.toString());
    Object.entries(changes).forEach(([k, v]) => (v ? sp.set(k, v) : sp.delete(k)));
    if (!keepPage) sp.delete('page');
    const qs = sp.toString();
    start(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: !keepPage ? false : true }));
  };
  return { params, update, pending };
}

export function SortSelect() {
  const { params, update, pending } = useQueryUpdater();
  return (
    <div className="flex items-center gap-2 text-sm">
      {pending && <Loader2 className="h-4 w-4 animate-spin text-ink-400" aria-label="Updating results" />}
      <label htmlFor="sort" className="sr-only font-medium text-ink-500 sm:not-sr-only">
        Sort by
      </label>
      <select
        id="sort"
        value={params.get('sort') ?? 'featured'}
        onChange={(e) => update({ sort: e.target.value === 'featured' ? null : e.target.value })}
        className="h-10 rounded-xl border border-line bg-surface pl-3 pr-8 text-sm font-medium text-ink-800 transition-colors hover:border-line-strong focus:border-brand-orange focus:outline-none focus:ring-4 focus:ring-brand-orange/10"
      >
        <option value="featured">Featured</option>
        <option value="newest">Newest</option>
        <option value="price_asc">Price: Low to High</option>
        <option value="price_desc">Price: High to Low</option>
        <option value="name_asc">Name: A to Z</option>
      </select>
    </div>
  );
}

type Opt = { slug: string; name: string; productCount: number };
export interface FilterProps {
  categories: Opt[];
  brands: Opt[];
  pricePoints: { amountPaise: number; label: string }[];
  showCategories: boolean;
}

const groupTitle = 'mb-2 text-2xs font-semibold uppercase tracking-wide text-ink-500';
const optionRow = 'flex min-h-8 items-center justify-between gap-2';
const count = 'text-2xs tabular-nums text-ink-400';

function FilterPanel({ categories, brands, pricePoints, showCategories }: FilterProps) {
  const { params, update } = useQueryUpdater();
  const category = params.get('category');
  const price = params.get('price');
  const brand = params.get('brand');
  const pricePoint = params.get('pricePoint');
  const inStock = params.get('inStock') === '1';
  const active = (showCategories && !!category) || !!price || !!brand || !!pricePoint || inStock;
  return (
    <div className="divide-y divide-line-subtle [&>*]:py-3.5 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
      {showCategories && (
        <div role="group" aria-label="Category">
          <p className={groupTitle} aria-hidden>Category</p>
          <div className={optionRow}>
            <Radio name="category" label="All categories" checked={!category} onChange={() => update({ category: null })} />
          </div>
          {categories.map((c) => (
            <div key={c.slug} className={optionRow}>
              <Radio name="category" label={c.name} checked={category === c.slug} onChange={() => update({ category: c.slug })} />
              <span className={count}>{c.productCount}</span>
            </div>
          ))}
        </div>
      )}
      <div role="group" aria-label="Price">
        <p className={groupTitle} aria-hidden>Price</p>
        <div className={optionRow}>
          <Radio name="price" label="Any price" checked={!price} onChange={() => update({ price: null })} />
        </div>
        {PRICE_BUCKETS.map((b) => (
          <div key={b.id} className={optionRow}>
            <Radio name="price" label={b.label} checked={price === b.id} onChange={() => update({ price: b.id })} />
          </div>
        ))}
      </div>
      {pricePoints.length > 0 && (
        <div>
          <p className={groupTitle}>Price point</p>
          <div className="flex flex-wrap gap-1.5">
            {pricePoints.map((pp) => {
              const on = pricePoint === String(pp.amountPaise);
              return (
                <button
                  key={pp.amountPaise}
                  type="button"
                  aria-pressed={on}
                  onClick={() => update({ pricePoint: on ? null : String(pp.amountPaise), price: null })}
                  className={cn(
                    'h-8 rounded-full border px-3 text-xs font-semibold tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50',
                    on ? 'border-brand-orange bg-brand-orange-50 text-brand-orange-700' : 'border-line bg-surface text-ink-600 hover:border-line-strong'
                  )}
                >
                  {pp.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <label className="flex min-h-8 cursor-pointer items-center justify-between gap-2 text-sm font-medium text-ink-700">
        <span>In stock only</span>
        <input
          type="checkbox"
          className="h-4 w-4 rounded accent-brand-orange focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50"
          checked={inStock}
          onChange={(e) => update({ inStock: e.target.checked ? '1' : null })}
        />
      </label>
      {brands.length > 0 && (
        <div role="group" aria-label="Brand">
          <p className={groupTitle} aria-hidden>Brand</p>
          <div className="max-h-48 overflow-y-auto">
            <div className={optionRow}>
              <Radio name="brand" label="All brands" checked={!brand} onChange={() => update({ brand: null })} />
            </div>
            {brands.map((b) => (
              <div key={b.slug} className={optionRow}>
                <Radio name="brand" label={b.name} checked={brand === b.slug} onChange={() => update({ brand: b.slug })} />
                <span className={count}>{b.productCount}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {active && (
        <div>
          <button
            type="button"
            onClick={() => update({ category: showCategories ? null : category, price: null, brand: null, pricePoint: null, inStock: null })}
            className="h-9 w-full rounded-xl border border-line text-sm font-semibold text-ink-700 transition-colors hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}

export function FilterSidebar(props: FilterProps) {
  return (
    <aside aria-label="Filters" className="sticky top-20 hidden w-52 shrink-0 rounded-2xl border border-line-subtle bg-surface p-4 md:block lg:w-56">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <SlidersHorizontal className="h-4 w-4 text-ink-500" aria-hidden /> Filters
      </h2>
      <FilterPanel {...props} />
    </aside>
  );
}

/** Removable chips for the filters currently applied (all widths). */
export function ActiveFilters(props: FilterProps) {
  const { params, update } = useQueryUpdater();
  const chips: { key: string; label: string; clear: Record<string, null> }[] = [];
  const category = params.get('category');
  if (props.showCategories && category)
    chips.push({ key: 'category', label: props.categories.find((c) => c.slug === category)?.name ?? category, clear: { category: null } });
  const price = PRICE_BUCKETS.find((b) => b.id === params.get('price'));
  if (price) chips.push({ key: 'price', label: price.label, clear: { price: null } });
  const pp = props.pricePoints.find((p) => String(p.amountPaise) === params.get('pricePoint'));
  if (pp) chips.push({ key: 'pricePoint', label: `At ${pp.label}`, clear: { pricePoint: null } });
  const brand = params.get('brand');
  if (brand) chips.push({ key: 'brand', label: props.brands.find((b) => b.slug === brand)?.name ?? brand, clear: { brand: null } });
  if (params.get('inStock') === '1') chips.push({ key: 'inStock', label: 'In stock', clear: { inStock: null } });
  if (!chips.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Applied filters">
      {chips.map((c) => (
        <li key={c.key}>
          <button
            type="button"
            onClick={() => update(c.clear)}
            aria-label={`Remove filter: ${c.label}`}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-surface pl-3 pr-2 text-xs font-medium text-ink-700 transition-colors hover:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50"
          >
            {c.label}
            <X className="h-3.5 w-3.5 text-ink-400" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function MobileFilterButton(props: FilterProps & { total: number }) {
  const [open, setOpen] = useState(false);
  const params = useSearchParams();
  const activeCount = [
    props.showCategories && params.get('category'),
    params.get('price'),
    params.get('brand'),
    params.get('pricePoint'),
    params.get('inStock') === '1',
  ].filter(Boolean).length;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm font-medium text-ink-700 transition-colors hover:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 md:hidden"
      >
        <SlidersHorizontal className="h-4 w-4 text-ink-500" aria-hidden />
        <span>Filters</span>
        {activeCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-orange px-1 text-2xs font-semibold tabular-nums text-white">
            {activeCount}
          </span>
        )}
      </button>
      <Drawer isOpen={open} onClose={() => setOpen(false)} title="Filter products" position="bottom">
        <div className="space-y-4">
          <FilterPanel categories={props.categories} brands={props.brands} pricePoints={props.pricePoints} showCategories={props.showCategories} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="sticky bottom-0 h-11 w-full rounded-xl bg-brand-orange text-sm font-semibold text-white shadow-sm hover:bg-brand-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 focus-visible:ring-offset-2"
          >
            Show {props.total} result{props.total === 1 ? '' : 's'}
          </button>
        </div>
      </Drawer>
    </>
  );
}

export function CatalogPagination({ page, totalPages }: { page: number; totalPages: number }) {
  const { update } = useQueryUpdater();
  return (
    <div className="pt-6">
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => update({ page: p > 1 ? String(p) : null }, true)} />
    </div>
  );
}
