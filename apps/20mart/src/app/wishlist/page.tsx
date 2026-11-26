import type { Metadata } from 'next';
import { Breadcrumb } from '@20mart/ui';
import { WishlistView } from '../../components/WishlistView';

export const metadata: Metadata = { title: 'My Wishlist – 20Mart', robots: { index: false } };

export default function WishlistPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-2.5 pb-8 sm:pt-3.5 space-y-3">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Wishlist' }]} />
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-ink">My Wishlist</h1>
        <p className="text-xs text-ink-500">Prices and availability are always up to date.</p>
      </div>
      <WishlistView />
    </div>
  );
}
