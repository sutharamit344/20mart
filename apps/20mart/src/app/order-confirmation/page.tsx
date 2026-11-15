import { redirect } from 'next/navigation';

/** Legacy URL → the real order confirmation page. */
export default function OrderConfirmationPage({ searchParams }: { searchParams: { order?: string; orderId?: string } }) {
  const order = searchParams.order ?? searchParams.orderId;
  redirect(order ? `/order-success?order=${encodeURIComponent(order)}` : '/account/orders');
}
