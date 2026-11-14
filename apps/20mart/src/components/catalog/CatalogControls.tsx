'use client';

import React, { useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Drawer, Pagination, Radio } from '@20mart/ui';
import { Filter, Loader2, SlidersHorizontal } from 'lucide-react';
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
    <div className="flex items-center gap-2 text-xs">
      {pending && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
      <label htmlFor="sort" className="text-gray-500 font-medium hidden sm:inline">
        Sort by:
      </label>
      <select
        id="sort"
        value={params.get('sort') ?? 'popular'}
        onChange={(e) => update({ sort: e.target.value === 'popular' ? null : e.target.value })}
        className="rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 focus:outline-none focus:border-[#FF7A00]"
      >
        <option value="popular">Popular</option>
        <option value="newest">Newest</option>
        <option value="price_asc">Price: Low to High</option>
        <option value="price_desc">Price: High to Low</option>
      </select>
    </div>
  );
}

function FilterPanel({ categories, showCategories }: { categories: { slug: string; name: string; productCount: number }[]; showCategories: boolean }) {
  const { params, update } = useQueryUpdater();
  const category = params.get('category');
  const price = params.get('price');
  const active = !!category || !!price;
  return (
    <div className="space-y-4">
      {showCategories && (
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-900 mb-2">Category</h4>
          <div className="space-y-1.5">
            <div className="text-xs">
              <Radio name="category" label="All categories" checked={!category} onChange={() => update({ category: null })} />
            </div>
            {categories.map((c) => (
              <div key={c.slug} className="flex items-center justify-between text-xs">
                <Radio name="category" label={c.name} checked={category === c.slug} onChange={() => update({ category: c.slug })} />
                <span className="text-gray-400 text-[10px] font-medium">({c.productCount})</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {showCategories && <hr className="border-gray-100" />}
      <div>
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-900 mb-2">Price</h4>
        <div className="space-y-1.5">
          <div className="text-xs">
            <Radio name="price" label="Any price" checked={!price} onChange={() => update({ price: null })} />
          </div>
          {PRICE_BUCKETS.map((b) => (
            <div key={b.id} className="text-xs">
              <Radio name="price" label={b.label} checked={price === b.id} onChange={() => update({ price: b.id })} />
            </div>
          ))}
        </div>
      </div>
      {active && (
        <button
          type="button"
          onClick={() => update({ category: showCategories ? null : category, price: null })}
          className="w-full py-1.5 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

export function FilterSidebar(props: { categories: { slug: string; name: string; productCount: number }[]; showCategories: boolean }) {
  return (
    <aside className="hidden md:block w-48 lg:w-52 shrink-0 rounded-2xl border border-gray-100 bg-white p-3.5 shadow-xs sticky top-20">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-100 mb-3">
        <SlidersHorizontal className="w-4 h-4 text-[#FF7A00]" />
        <h3 className="text-xs font-bold text-gray-900">Filters</h3>
      </div>
      <FilterPanel {...props} />
    </aside>
  );
}

export function MobileFilterButton(props: { categories: { slug: string; name: string; productCount: number }[]; showCategories: boolean; total: number }) {
  const [open, setOpen] = useState(false);
  const params = useSearchParams();
  const active = !!params.get('price') || (props.showCategories && !!params.get('category'));
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex md:hidden items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-700 shadow-xs"
      >
        <Filter className="w-3.5 h-3.5 text-[#FF7A00]" />
        <span>Filter</span>
        {active && <span className="w-2 h-2 rounded-full bg-[#FF7A00]" />}
      </button>
      <Drawer isOpen={open} onClose={() => setOpen(false)} title="Filter products" position="bottom">
        <div className="space-y-4">
          <FilterPanel categories={props.categories} showCategories={props.showCategories} />
          <button type="button" onClick={() => setOpen(false)} className="w-full h-10 rounded-xl bg-[#FF7A00] text-sm font-bold text-white">
            Show results
          </button>
        </div>
      </Drawer>
    </>
  );
}

export function CatalogPagination({ page, totalPages }: { page: number; totalPages: number }) {
  const { update } = useQueryUpdater();
  return (
    <div className="pt-4">
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => update({ page: p > 1 ? String(p) : null }, true)} />
    </div>
  );
}
