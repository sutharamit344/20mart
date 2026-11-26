import React, { Suspense } from 'react';
import Link from 'next/link';
import { Breadcrumb } from '@20mart/ui';
import { PackageSearch } from 'lucide-react';
import { captureException, type PublicProductQuery } from '@20mart/server';
import { getBrands, getCategories, getPricePoints, getProducts } from '../../lib/catalog';
import { ProductGrid } from '../StoreProductCard';
import { ActiveFilters, CatalogPagination, FilterSidebar, MobileFilterButton, SortSelect } from './CatalogControls';
import { PRICE_BUCKETS } from './price-buckets';
import { TrackView } from '../TrackView';

export const PAGE_SIZE = 24;

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Translate URL search params into a validated public catalog query. */
export function queryFromSearchParams(sp: SP, fixed: Partial<PublicProductQuery> = {}): PublicProductQuery {
  const bucket = PRICE_BUCKETS.find((b) => b.id === one(sp.price));
  const sort = one(sp.sort);
  return {
    q: one(sp.q)?.slice(0, 80) || undefined,
    category: one(sp.category) || undefined,
    sort: sort === 'newest' || sort === 'price_asc' || sort === 'price_desc' || sort === 'name_asc' ? sort : 'featured',
    brand: one(sp.brand) || undefined,
    pricePoint: Number(one(sp.pricePoint)) || undefined,
    inStock: one(sp.inStock) === '1' ? true : undefined,
    page: Math.max(1, Math.min(500, Number(one(sp.page)) || 1)),
    pageSize: PAGE_SIZE,
    minPrice: bucket?.min,
    maxPrice: bucket?.max,
    ...fixed,
  };
}

/**
 * Shared server-rendered product listing (shop, search, deals, category).
 * Filtering, sorting and pagination happen in the database.
 */
export async function CatalogListing({
  searchParams,
  title,
  subtitle,
  breadcrumb,
  fixed = {},
  showCategoryFilter = true,
  emptyAction,
  banner,
  trackSearch = false,
}: {
  /** Record PRODUCT_SEARCHED (term + result count) for this listing's query. */
  trackSearch?: boolean;
  banner?: React.ReactNode;
  searchParams: SP;
  title: string;
  subtitle?: (total: number) => string;
  breadcrumb: { label: string; href?: string }[];
  fixed?: Partial<PublicProductQuery>;
  showCategoryFilter?: boolean;
  emptyAction?: { href: string; label: string };
}) {
  const query = queryFromSearchParams(searchParams, fixed);
  let result: Awaited<ReturnType<typeof getProducts>> | null = null;
  let categories: Awaited<ReturnType<typeof getCategories>> = [];
  let brands: Awaited<ReturnType<typeof getBrands>> = [];
  let pricePoints: Awaited<ReturnType<typeof getPricePoints>> = [];
  try {
    [result, categories, brands, pricePoints] = await Promise.all([getProducts(query), getCategories(), getBrands(), getPricePoints()]);
  } catch (e) {
    captureException(e, 'db.catalog_unavailable', { category: 'db', what: 'catalog listing' });
  }
  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filterProps = {
    categories: categories.map((c) => ({ slug: c.slug, name: c.name, productCount: c.productCount })),
    brands,
    pricePoints,
    showCategories: showCategoryFilter,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-3 sm:px-6 sm:pt-4">
      {trackSearch && query.q && result && (
        <TrackView name="PRODUCT_SEARCHED" searchTerm={query.q} resultCount={total} once={query.q.trim().toLowerCase()} />
      )}
      <Breadcrumb items={breadcrumb} className="mb-3" />
      {banner}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-lg font-semibold text-ink sm:text-xl">{title}</h1>
          <p className="mt-0.5 text-xs text-ink-500">
            {subtitle ? subtitle(total) : `${total} item${total === 1 ? '' : 's'} available for doorstep delivery`}
          </p>
        </div>
        <Suspense>
          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end">
            <MobileFilterButton {...filterProps} total={total} />
            <SortSelect />
          </div>
        </Suspense>
      </div>

      <div className="flex flex-col items-start gap-5 md:flex-row lg:gap-6">
        <Suspense>
          <FilterSidebar {...filterProps} />
        </Suspense>
        <div className="w-full min-w-0 flex-1 space-y-3">
          <Suspense>
            <ActiveFilters {...filterProps} />
          </Suspense>
          {!result ? (
            <EmptyBox tone="error" title="We couldn't load products right now" body="Please refresh the page in a moment." />
          ) : result.items.length === 0 ? (
            <EmptyBox
              title="No products found"
              body={query.q ? `Nothing matched "${query.q}". Try a different word or browse categories.` : 'Try removing a filter or check back soon.'}
              action={emptyAction ?? { href: '/shop', label: 'Browse all products' }}
            />
          ) : (
            <ProductGrid
              products={result.items}
              priorityCount={2}
              className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 min-[960px]:grid-cols-4"
            />
          )}
          {totalPages > 1 && (
            <Suspense>
              <CatalogPagination page={query.page ?? 1} totalPages={totalPages} />
            </Suspense>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyBox({ title, body, action, tone }: { title: string; body: string; action?: { href: string; label: string }; tone?: 'error' }) {
  return (
    <div role={tone === 'error' ? 'alert' : undefined} className="rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
      <span className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${tone === 'error' ? 'bg-danger-soft text-danger' : 'bg-surface-muted text-ink-400'}`}>
        <PackageSearch className="h-6 w-6" aria-hidden />
      </span>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">{body}</p>
      {action && (
        <Link
          href={action.href}
          className="mt-4 inline-flex h-10 items-center rounded-xl border border-line-strong bg-surface px-4 text-sm font-semibold text-ink-700 hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
