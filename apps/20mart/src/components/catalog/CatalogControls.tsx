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
        value={params.get('sort') ?? 'featured'}
        onChange={(e) => update({ sort: e.target.value === 'featured' ? null : e.target.value })}
        className="rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 focus:outline-none focus:border-[#FF7A00]"
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

function FilterPanel({ categories, brands, pricePoints, showCategories }: FilterProps) {
  const { params, update } = useQueryUpdater();
  const category = params.get('category');
  const price = params.get('price');
  const brand = params.get('brand');
  const pricePoint = params.get('pricePoint');
  const inStock = params.get('inStock') === '1';
  const active = !!category || !!price || !!brand || !!pricePoint || inStock;
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
      <hr className="border-gray-100" />
      <label className="flex items-center justify-between gap-2 text-xs font-semibold text-gray-700">
        <span>In stock only</span>
        <input type="checkbox" className="h-4 w-4 accent-[#FF7A00]" checked={inStock} onChange={(e) => update({ inStock: e.target.checked ? '1' : null })} />
      </label>
      {pricePoints.length > 0 && (
        <>
          <hr className="border-gray-100" />
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-900 mb-2">Price point</h4>
            <div className="flex flex-wrap gap-1.5">
              {pricePoints.map((pp) => {
                const on = pricePoint === String(pp.amountPaise);
                return (
                  <button
                    key={pp.amountPaise}
                    type="button"
                    aria-pressed={on}
                    onClick={() => update({ pricePoint: on ? null : String(pp.amountPaise), price: null })}
                    className={`h-7 rounded-full border px-2.5 text-[11px] font-bold ${on ? 'border-[#FF7A00] bg-orange-50 text-[#E66E00]' : 'border-gray-200 text-gray-600'}`}
                  >
                    {pp.label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
      {brands.length > 0 && (
        <>
          <hr className="border-gray-100" />
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-900 mb-2">Brand</h4>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              <div className="text-xs">
                <Radio name="brand" label="All brands" checked={!brand} onChange={() => update({ brand: null })} />
              </div>
              {brands.map((b) => (
                <div key={b.slug} className="flex items-center justify-between text-xs">
                  <Radio name="brand" label={b.name} checked={brand === b.slug} onChange={() => update({ brand: b.slug })} />
                  <span className="text-gray-400 text-[10px] font-medium">({b.productCount})</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      {active && (
        <button
          type="button"
          onClick={() => update({ category: showCategories ? null : category, price: null, brand: null, pricePoint: null, inStock: null })}
          className="w-full py-1.5 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

export function FilterSidebar(props: FilterProps) {
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

export function MobileFilterButton(props: FilterProps & { total: number }) {
  const [open, setOpen] = useState(false);
  const params = useSearchParams();
  const active =
    !!params.get('price') || !!params.get('brand') || !!params.get('pricePoint') || params.get('inStock') === '1' || (props.showCategories && !!params.get('category'));
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
          <FilterPanel categories={props.categories} brands={props.brands} pricePoints={props.pricePoints} showCategories={props.showCategories} />
          <button type="button" onClick={() => setOpen(false)} className="w-full h-10 rounded-xl bg-[#FF7A00] text-sm font-bold text-white">
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
    <div className="pt-4">
      <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => update({ page: p > 1 ? String(p) : null }, true)} />
    </div>
  );
}
