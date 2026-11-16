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
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-sm font-bold text-gray-900">We couldn&apos;t find that order.</p>
        <Link href="/account/orders" className="mt-3 inline-flex text-xs font-bold text-[#FF7A00]">
          View my orders →
        </Link>
      </div>
    );
  }
  const awaitingPayment = order.status === 'PENDING' && order.paymentMethod === 'ONLINE';
  const confirmed = order.status !== 'PENDING';
  return (
    <div className="max-w-md mx-auto px-4 py-10 sm:py-14 text-center space-y-5">
      <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-amber-200/60 blur-xl" />
        <Image src="/order-success-bag.png" alt="" width={112} height={112} priority className="relative z-10 h-24 w-auto object-contain" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-black text-gray-900">{awaitingPayment ? 'Order created — payment pending' : 'Order placed!'}</h1>
        <p className="text-xs text-gray-500">
          Order <b className="text-gray-900">#{order.orderNumber}</b> · {formatPaise(order.totalPaise)} ·{' '}
          {order.paymentMethod === 'CASH_ON_DELIVERY' ? 'Cash on delivery' : PAYMENT_STATUS_LABEL[order.paymentStatus]}
        </p>
      </div>
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-left text-xs text-emerald-900">
        <p className="flex items-center gap-1.5 font-bold">
          <Truck className="h-4 w-4" />
          {confirmed ? 'Your order is confirmed.' : awaitingPayment ? 'Complete payment to confirm your order.' : 'We will confirm your order shortly.'}
        </p>
        {order.deliveryEstimate && <p className="mt-1">{order.deliveryEstimate}</p>}
      </div>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <Link href={`/account/orders/${order.orderNumber}`} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#0B5D3B] px-5 text-sm font-bold text-white">
          Track order <ArrowRight className="h-4 w-4" />
        </Link>
        <Link href="/shop" className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-300 px-5 text-sm font-semibold text-gray-700">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
