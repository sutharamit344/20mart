import { redirect } from 'next/navigation';

/** Legacy URL → the real order confirmation page. */
export default async function OrderConfirmationPage(props: { searchParams: Promise<{ order?: string; orderId?: string }> }) {
  const searchParams = await props.searchParams;
  const order = searchParams.order ?? searchParams.orderId;
  redirect(order ? `/order-success?order=${encodeURIComponent(order)}` : '/account/orders');
}
