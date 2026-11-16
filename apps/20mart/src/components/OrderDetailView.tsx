'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { resolveImageSrc } from '@20mart/ui';
import { useRouter } from 'next/navigation';
import { FULFILMENT_STEPS, formatPaise, PAYMENT_STATUS_LABEL, type OrderStatusCode, type PaymentStatusCode } from '@20mart/shared';
import { Check, CreditCard, Loader2, MapPin, Package, XCircle } from 'lucide-react';
import { storeApi, useStore } from '../lib/store';
import { payWithRazorpay, type CheckoutPaymentParams } from '../lib/razorpay';

export interface CustomerOrderDetail {
  orderNumber: string;
  createdAt: string;
  status: OrderStatusCode;
  statusLabel: string;
  paymentStatus: PaymentStatusCode;
  paymentMethod: string;
  subtotalPaise: number;
  deliveryChargePaise: number;
  discountPaise: number;
  couponCode?: string | null;
  totalPaise: number;
  shipName: string;
  shipPhone: string;
  shipLine1: string;
  shipLine2: string | null;
  shipLandmark: string | null;
  shipCity: string;
  shipState: string;
  shipPincode: string;
  deliveryEstimate: string | null;
  reservationExpiresAt: string | null;
  cancelReason: string | null;
  items: {
    id: string;
    productName: string;
    variantName: string | null;
    productImage: string | null;
    brandName: string | null;
    quantity: number;
    unitPricePaise: number;
    totalPricePaise: number;
    product: { slug: string } | null;
  }[];
  history: { status: OrderStatusCode; label: string; at: string; note: string | null }[];
  refunds: { status: string; amountPaise: number }[];
  canCancel: boolean;
  canPay: boolean;
}

const fmtDate = (d: string) => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });

/** Real order details: timeline comes only from recorded status history (no simulated tracking). */
export function OrderDetailView({ order, autoPay = false }: { order: CustomerOrderDetail; autoPay?: boolean }) {
  const router = useRouter();
  const { showToast } = useStore();
  const [busy, setBusy] = useState<'pay' | 'cancel' | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');

  const terminal = order.status === 'CANCELLED' || order.status === 'FAILED';
  const reached = new Map(order.history.map((h) => [h.status, h.at]));
  const currentIdx = FULFILMENT_STEPS.findIndex((s) => s.status === order.status);

  const pay = async () => {
    setBusy('pay');
    try {
      const params = await storeApi<CheckoutPaymentParams>(`/api/orders/${order.orderNumber}/pay`, { body: {} });
      const outcome = await payWithRazorpay(params);
      if (outcome === 'paid') router.replace(`/order-success?order=${order.orderNumber}`);
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Payment could not be completed');
      router.refresh();
    } finally {
      setBusy(null);
    }
  };
  React.useEffect(() => {
    if (autoPay && order.canPay) void pay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancel = async () => {
    setBusy('cancel');
    try {
      await storeApi(`/api/orders/${order.orderNumber}/cancel`, { body: { reason } });
      showToast('Order cancelled');
      setCancelOpen(false);
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not cancel the order');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Order</p>
          <h2 className="text-base sm:text-lg font-black text-gray-900">#{order.orderNumber}</h2>
          <p className="text-[11px] text-gray-500">Placed {fmtDate(order.createdAt)}</p>
        </div>
        <div className="text-right">
          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${terminal ? 'bg-red-50 text-red-700' : order.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-[#E66E00]'}`}>
            {order.statusLabel}
          </span>
          <p className="mt-1 text-[11px] text-gray-500">{PAYMENT_STATUS_LABEL[order.paymentStatus]}</p>
        </div>
      </div>

      {order.canPay && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-xs text-[#9E4B00]">
          <span>
            Payment pending. Items are held for you
            {order.reservationExpiresAt ? ` until ${new Date(order.reservationExpiresAt).toLocaleTimeString('en-IN', { timeStyle: 'short', timeZone: 'Asia/Kolkata' })}` : ''}.
          </span>
          <button type="button" onClick={pay} disabled={!!busy} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#FF7A00] px-3 font-bold text-white disabled:opacity-60">
            {busy === 'pay' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />} Pay {formatPaise(order.totalPaise)}
          </button>
        </div>
      )}

      {/* Timeline */}
      <section className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-xs">
        <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-gray-500">Order status</h3>
        {terminal ? (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-800">
            <XCircle className="h-4 w-4 shrink-0" />
            <div>
              <p className="font-bold">{order.statusLabel}</p>
              {order.cancelReason && <p className="mt-0.5">Reason: {order.cancelReason}</p>}
              {order.refunds.length > 0 && (
                <p className="mt-0.5">
                  Refund: {order.refunds.map((r) => `${formatPaise(r.amountPaise)} (${r.status === 'PROCESSED' ? 'completed' : 'in progress'})`).join(', ')}
                </p>
              )}
            </div>
          </div>
        ) : (
          <ol className="relative space-y-3 pl-6">
            <span className="absolute left-[9px] top-1 bottom-1 w-0.5 bg-gray-100" aria-hidden="true" />
            {FULFILMENT_STEPS.map((s, i) => {
              const done = reached.has(s.status) || i <= currentIdx;
              const at = reached.get(s.status);
              return (
                <li key={s.status} className="relative">
                  <span className={`absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 ${done ? 'border-[#0B5D3B] bg-[#0B5D3B] text-white' : 'border-gray-200 bg-white'}`}>
                    {done && <Check className="h-3 w-3" />}
                  </span>
                  <p className={`text-xs font-bold ${done ? 'text-gray-900' : 'text-gray-400'}`}>{s.label}</p>
                  {at && <p className="text-[10px] text-gray-500">{fmtDate(at)}</p>}
                </li>
              );
            })}
          </ol>
        )}
        {!terminal && order.status !== 'DELIVERED' && order.deliveryEstimate && (
          <p className="mt-3 rounded-lg bg-emerald-50 p-2 text-[11px] font-semibold text-emerald-800">{order.deliveryEstimate}</p>
        )}
      </section>

      {/* Items */}
      <section className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-xs">
        <h3 className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">
          <Package className="h-3.5 w-3.5" /> Items
        </h3>
        <ul className="divide-y divide-gray-100">
          {order.items.map((it) => (
            <li key={it.id} className="flex items-center gap-3 py-2">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                {it.productImage ? <Image src={resolveImageSrc(it.productImage)} alt="" fill sizes="48px" className="object-contain p-0.5" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                {it.product?.slug ? (
                  <Link href={`/product/${it.product.slug}`} className="block truncate text-xs font-bold text-gray-900 hover:text-[#0B5D3B]">
                    {it.productName}
                  </Link>
                ) : (
                  <p className="truncate text-xs font-bold text-gray-900">{it.productName}</p>
                )}
                <p className="text-[11px] text-gray-500">
                  {it.variantName ? `${it.variantName} · ` : ''}
                  {it.quantity} × {formatPaise(it.unitPricePaise)}
                </p>
              </div>
              <span className="text-xs font-black text-gray-900">{formatPaise(it.totalPricePaise)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-2 space-y-1 border-t border-gray-100 pt-2 text-xs">
          <div className="flex justify-between">
            <dt className="text-gray-500">Subtotal</dt>
            <dd>{formatPaise(order.subtotalPaise)}</dd>
          </div>
          {order.discountPaise > 0 && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Coupon{order.couponCode ? ` ${order.couponCode}` : ''}</dt>
              <dd className="font-semibold text-emerald-700">−{formatPaise(order.discountPaise)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-gray-500">Delivery</dt>
            <dd>{order.deliveryChargePaise ? formatPaise(order.deliveryChargePaise) : 'Free'}</dd>
          </div>
          <div className="flex justify-between text-sm font-black text-gray-900">
            <dt>Total</dt>
            <dd>{formatPaise(order.totalPaise)}</dd>
          </div>
          <p className="text-[10px] text-gray-400">{order.paymentMethod === 'CASH_ON_DELIVERY' ? 'Cash on delivery' : 'Paid online'}</p>
        </dl>
      </section>

      {/* Address */}
      <section className="rounded-2xl border border-gray-100 bg-white p-3.5 text-xs shadow-xs">
        <h3 className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">
          <MapPin className="h-3.5 w-3.5" /> Delivery address
        </h3>
        <p className="font-bold text-gray-900">{order.shipName}</p>
        <p className="text-gray-600">
          {order.shipLine1}
          {order.shipLine2 ? `, ${order.shipLine2}` : ''}
          {order.shipLandmark ? `, near ${order.shipLandmark}` : ''}, {order.shipCity}, {order.shipState} – {order.shipPincode}
        </p>
        <p className="text-gray-500">+91 {order.shipPhone}</p>
      </section>

      {order.canCancel && (
        <section className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-xs">
          {cancelOpen ? (
            <div className="space-y-2">
              <label htmlFor="cancel-reason" className="block text-xs font-bold text-gray-700">
                Why are you cancelling?
              </label>
              <select
                id="cancel-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm"
              >
                <option value="">Select a reason</option>
                <option>Ordered by mistake</option>
                <option>Found a better price</option>
                <option>Delivery time is too long</option>
                <option>Need to change items or address</option>
                <option>Other</option>
              </select>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCancelOpen(false)} className="h-9 rounded-xl px-3 text-xs font-semibold text-gray-600">
                  Keep order
                </button>
                <button type="button" disabled={!reason || !!busy} onClick={cancel} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-red-600 px-4 text-xs font-bold text-white disabled:opacity-50">
                  {busy === 'cancel' && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Cancel order
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setCancelOpen(true)} className="text-xs font-bold text-red-600 hover:underline">
              Cancel this order
            </button>
          )}
        </section>
      )}
    </div>
  );
}
