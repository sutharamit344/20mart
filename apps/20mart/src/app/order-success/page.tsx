import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { formatPaise, PAYMENT_STATUS_LABEL } from '@20mart/shared';
import { getCustomerOrder } from '@20mart/server';
import { getCurrentCustomer } from '@20mart/server/next';
import { ArrowRight, Truck } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Order placed – 20Mart', robots: { index: false } };

/** Confirmation page — shows the real order owned by the signed-in customer, or nothing. */
export default async function OrderSuccessPage(props: { searchParams: Promise<{ order?: string }> }) {
  const searchParams = await props.searchParams;
  const customer = await getCurrentCustomer();
  const order = customer && searchParams.order ? await getCustomerOrder(customer.id, searchParams.order).catch(() => null) : null;
  if (!order) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-base font-semibold text-ink">We couldn&apos;t find that order.</p>
        <Link href="/account/orders" className="mt-3 inline-flex text-sm font-semibold text-brand-orange-700 hover:underline">
          View my orders →
        </Link>
      </div>
    );
  }
  const awaitingPayment = order.status === 'PENDING' && order.paymentMethod === 'ONLINE';
  const confirmed = order.status !== 'PENDING';
  return (
    <div className="max-w-md mx-auto px-4 py-10 sm:py-14 text-center space-y-5">
      <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-brand-cream">
        <Image src="/order-success-bag.png" alt="" width={112} height={112} priority className="h-20 w-auto object-contain" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-ink">{awaitingPayment ? 'Order created — payment pending' : 'Order placed!'}</h1>
        <p className="text-sm text-ink-500">
          Order <b className="font-semibold tabular-nums text-ink">#{order.orderNumber}</b> · {formatPaise(order.totalPaise)} ·{' '}
          {order.paymentMethod === 'CASH_ON_DELIVERY' ? 'Cash on delivery' : PAYMENT_STATUS_LABEL[order.paymentStatus]}
        </p>
      </div>
      <div className="rounded-2xl border border-success-line bg-success-soft p-3 text-left text-sm text-success">
        <p className="flex items-center gap-1.5 font-semibold">
          <Truck className="h-4 w-4" />
          {confirmed ? 'Your order is confirmed.' : awaitingPayment ? 'Complete payment to confirm your order.' : 'We will confirm your order shortly.'}
        </p>
        {order.deliveryEstimate && <p className="mt-1">{order.deliveryEstimate}</p>}
      </div>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <Link href={`/account/orders/${order.orderNumber}`} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-brand-green px-5 text-sm font-semibold text-white hover:bg-brand-green-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40 focus-visible:ring-offset-2">
          Track order <ArrowRight className="h-4 w-4" />
        </Link>
        <Link href="/shop" className="inline-flex h-11 items-center justify-center rounded-xl border border-line-strong bg-surface px-5 text-sm font-semibold text-ink-700 hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
