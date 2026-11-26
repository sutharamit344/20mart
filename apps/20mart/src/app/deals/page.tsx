import type { Metadata } from 'next';
import { Flame } from 'lucide-react';
import { CatalogListing } from '../../components/catalog/CatalogListing';

export const metadata: Metadata = {
  alternates: { canonical: '/deals' },
  title: 'Daily Deals – 20Mart',
  description: 'Everyday essentials priced below MRP at 20Mart.',
};
export const revalidate = 60;

export default async function DealsPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const searchParams = await props.searchParams;
  return (
    <CatalogListing
      searchParams={searchParams}
      fixed={{ deals: true }}
      title="Today's best value deals"
      subtitle={(total) => `${total} deal${total === 1 ? '' : 's'} below MRP`}
      breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Daily Deals' }]}
      banner={
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-brand-orange-200/60 bg-brand-cream p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-brand-orange shadow-card">
            <Flame className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">Everyday essentials priced below MRP</p>
            <p className="text-xs text-ink-600">No minimum purchase required.</p>
          </div>
        </div>
      }
    />
  );
}
