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
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#FF7A00] via-[#FF850A] to-[#FF9E1B] p-4 sm:p-5 text-white shadow-xs mb-3.5 sm:mb-4">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/95 text-[#FF7A00] text-[11px] font-black shadow-xs">
            <Flame className="w-3.5 h-3.5 fill-current text-[#FF7A00]" />
            <span>Daily Deals</span>
          </div>
          <p className="mt-1.5 text-sm sm:text-base font-black">Everyday essentials priced below MRP</p>
          <p className="text-xs text-orange-100">No minimum purchase required.</p>
        </div>
      }
    />
  );
}
