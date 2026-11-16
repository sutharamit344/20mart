import type { Metadata } from 'next';
import { CatalogListing } from '../../components/catalog/CatalogListing';

export const metadata: Metadata = {
  alternates: { canonical: '/shop' },
  title: 'Shop all products – 20Mart',
  description: 'Affordable home, kitchen, stationery and daily-use essentials from ₹20 with fast delivery.',
};
export const revalidate = 60;

export default async function ShopPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  const q = typeof searchParams.q === 'string' ? searchParams.q : undefined;
  return (
    <CatalogListing
      searchParams={searchParams}
      title={q ? `Search results for “${q}”` : 'All Products'}
      breadcrumb={[{ label: 'Home', href: '/' }, { label: q ? `Search: “${q}”` : 'Shop – All Products' }]}
    />
  );
}
