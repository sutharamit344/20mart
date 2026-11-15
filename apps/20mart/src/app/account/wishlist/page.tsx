import { AccountLayout } from '../../../components/AccountLayout';
import { WishlistView } from '../../../components/WishlistView';

export default function AccountWishlistPage() {
  return (
    <AccountLayout title="My Wishlist" subtitle="Saved items with live prices and stock." activeKey="wishlist">
      <WishlistView compact />
    </AccountLayout>
  );
}
