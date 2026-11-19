import React, { Suspense } from 'react';
import Link from 'next/link';
import { Breadcrumb } from '@20mart/ui';
import { PackageSearch } from 'lucide-react';
import { captureException, type PublicProductQuery } from '@20mart/server';
import { getBrands, getCategories, getPricePoints, getProducts } from '../../lib/catalog';
import { ProductGrid } from '../StoreProductCard';
import { CatalogPagination, FilterSidebar, MobileFilterButton, SortSelect } from './CatalogControls';
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-2.5 pb-8 sm:pt-3.5 sm:pb-10">
      {trackSearch && query.q && result && (
        <TrackView name="PRODUCT_SEARCHED" searchTerm={query.q} resultCount={total} once={query.q.trim().toLowerCase()} />
      )}
      <Breadcrumb items={breadcrumb} className="mb-2 sm:mb-2.5" />
      {banner}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2.5 border-b border-gray-100 mb-3.5 sm:mb-4">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-black text-gray-900 break-words">{title}</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {subtitle ? subtitle(total) : `${total} item${total === 1 ? '' : 's'} available for doorstep delivery`}
          </p>
        </div>
        <Suspense>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <MobileFilterButton {...filterProps} total={total} />
            <SortSelect />
          </div>
        </Suspense>
      </div>

      <div className="flex flex-col md:flex-row gap-4 lg:gap-5 items-start">
        <Suspense>
          <FilterSidebar {...filterProps} />
        </Suspense>
        <div className="flex-1 min-w-0 space-y-4 w-full">
          {!result ? (
            <EmptyBox title="We couldn't load products right now" body="Please refresh the page in a moment." />
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
              className="grid grid-cols-2 md:grid-cols-3 min-[960px]:grid-cols-4 gap-2 sm:gap-2.5"
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

function EmptyBox({ title, body, action }: { title: string; body: string; action?: { href: string; label: string } }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
      <PackageSearch className="w-8 h-8 text-gray-300 mx-auto mb-2.5" />
      <h2 className="text-sm font-bold text-gray-800">{title}</h2>
      <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-3.5">{body}</p>
      {action && (
        <Link href={action.href} className="inline-flex h-8 items-center rounded-xl border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50">
          {action.label}
        </Link>
      )}
    </div>
  );
}
