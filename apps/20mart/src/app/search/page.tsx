import type { Metadata } from 'next';
import { CatalogListing } from '../../components/catalog/CatalogListing';

export const metadata: Metadata = { title: 'Search – 20Mart', robots: { index: false } };

export default function SearchPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const q = typeof searchParams.q === 'string' ? searchParams.q.trim() : '';
  return (
    <CatalogListing
      searchParams={searchParams}
      title={q ? `Results for “${q}”` : 'Search products'}
      subtitle={(total) => (q ? `${total} matching item${total === 1 ? '' : 's'}` : 'Type in the search bar above to find products')}
      breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Search' }]}
    />
  );
}
