'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { formatPaise, type CartView, type SavedAddress } from '@20mart/shared';
import { AlertTriangle, Banknote, CheckCircle2, CreditCard, Loader2, MapPin, Pencil, Plus, ShieldCheck, Truck } from 'lucide-react';
import { StoreApiError, storeApi, useStore } from '../../lib/store';
import { payWithRazorpay, type CheckoutPaymentParams } from '../../lib/razorpay';
import { AddressForm } from '../../components/AddressForm';

interface Summary {
  cart: CartView;
  addresses: SavedAddress[];
  selectedAddressId: string | null;
  delivery: {
    deliveryChargePaise: number;
    amountToFreeDeliveryPaise: number;
    blockers: string[];
    serviceability: { serviceable: boolean; estimateText: string | null; reason?: string } | null;
  };
  totalPaise: number;
  paymentMethods: ('ONLINE' | 'CASH_ON_DELIVERY')[];
  blockers: string[];
  canPlaceOrder: boolean;
}

interface PlaceOrderResult {
  orderNumber: string;
  paymentMethod: 'ONLINE' | 'CASH_ON_DELIVERY';
  payment: CheckoutPaymentParams | null;
  paymentError: string | null;
}

const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export default function CheckoutPage() {
  const router = useRouter();
  const { refreshCart, showToast } = useStore();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [editing, setEditing] = useState<SavedAddress | 'new' | null>(null);
  const [method, setMethod] = useState<'ONLINE' | 'CASH_ON_DELIVERY' | null>(null);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<{ message: string; issues: string[] } | null>(null);
  // One key per checkout attempt: double clicks / retries return the same order.
  const idemKey = useRef<string>(newKey());

  const load = useCallback(async (aid?: string | null) => {
    try {
      const qs = aid ? `?addressId=${aid}` : '';
      const s = await storeApi<Summary>(`/api/checkout/summary${qs}`);
      setSummary(s);
      setAddressId(s.selectedAddressId);
      setMethod((m) => (m && s.paymentMethods.includes(m) ? m : (s.paymentMethods[0] ?? null)));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load checkout');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const placeOrder = async () => {
    if (!summary || !addressId || !method || placing) return;
    setPlacing(true);
    setError(null);
    try {
      const res = await storeApi<PlaceOrderResult>('/api/orders', { body: { addressId, paymentMethod: method, idempotencyKey: idemKey.current } });
      await refreshCart();
      if (res.paymentMethod === 'CASH_ON_DELIVERY') {
        router.replace(`/order-success?order=${res.orderNumber}`);
        return;
      }
      if (!res.payment) {
        showToast(res.paymentError ?? 'Payment could not be started. You can retry from your order.');
        router.replace(`/account/orders/${res.orderNumber}`);
        return;
      }
      const outcome = await payWithRazorpay(res.payment).catch((e) => {
        showToast(e instanceof Error ? e.message : 'Payment could not be verified');
        return 'dismissed' as const;
      });
      router.replace(outcome === 'paid' ? `/order-success?order=${res.orderNumber}` : `/account/orders/${res.orderNumber}?pay=1`);
    } catch (e) {
      if (e instanceof StoreApiError) setError({ message: e.message, issues: e.issues });
      else setError({ message: 'Could not place your order. Please try again.', issues: [] });
      // A definitive rejection means nothing was created; a fresh key is safe for the next attempt.
      if (e instanceof StoreApiError && e.status >= 400 && e.status < 500) idemKey.current = newKey();
      await load(addressId);
    } finally {
      setPlacing(false);
    }
  };

  if (loadError) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-sm font-bold text-gray-900">{loadError}</p>
        <button type="button" onClick={() => load()} className="mt-3 text-xs font-bold text-[#FF7A00]">
          Try again
        </button>
      </div>
    );
  }
  if (!summary) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex items-center justify-center text-xs text-gray-400" aria-busy="true">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing checkout…
      </div>
    );
  }
  if (!summary.cart.lines.length) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-sm font-bold text-gray-900">Your cart is empty</p>
        <Link href="/shop" className="mt-3 inline-flex h-9 items-center rounded-xl bg-[#FF7A00] px-4 text-xs font-bold text-white">
          Browse products
        </Link>
      </div>
    );
  }

  const { cart, delivery } = summary;
  const selected = summary.addresses.find((a) => a.id === addressId) ?? null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-3 pb-28 md:pb-10">
      <h1 className="text-lg sm:text-xl font-black text-gray-900">Checkout</h1>
      <p className="mb-3 text-xs text-gray-500">All prices and charges are calculated securely on our server.</p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-8 space-y-3">
          {/* 1. Address */}
          <Section step={1} title="Delivery address" icon={<MapPin className="h-4 w-4" />}>
            {editing ? (
              <AddressForm
                address={editing === 'new' ? null : editing}
                onCancel={summary.addresses.length ? () => setEditing(null) : undefined}
                onSaved={(a) => {
                  setEditing(null);
                  void load(a.id);
                }}
              />
            ) : summary.addresses.length === 0 ? (
              <button type="button" onClick={() => setEditing('new')} className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 py-6 text-sm font-bold text-[#FF7A00]">
                <Plus className="h-4 w-4" /> Add a delivery address
              </button>
            ) : (
              <div className="space-y-2">
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Delivery address">
                  {summary.addresses.map((a) => (
                    <li key={a.id}>
                      <div
                        role="radio"
                        aria-checked={a.id === addressId}
                        tabIndex={0}
                        onClick={() => load(a.id)}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && load(a.id)}
                        className={`relative h-full cursor-pointer rounded-xl border p-3 text-xs transition-colors ${a.id === addressId ? 'border-[#FF7A00] bg-orange-50/50 ring-1 ring-[#FF7A00]/30' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-900">{a.name}</span>
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-gray-500">{a.type}</span>
                          {a.isDefault && <span className="text-[9px] font-bold uppercase text-[#0B5D3B]">Default</span>}
                        </div>
                        <p className="mt-1 text-gray-600 leading-relaxed">
                          {a.addressLine1}
                          {a.addressLine2 ? `, ${a.addressLine2}` : ''}
                          {a.landmark ? `, near ${a.landmark}` : ''}, {a.city}, {a.state} – {a.pincode}
                        </p>
                        <p className="mt-0.5 text-gray-500">+91 {a.phone}</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(a);
                          }}
                          className="absolute right-2 top-2 rounded p-1 text-gray-400 hover:bg-white hover:text-gray-700"
                          aria-label={`Edit address for ${a.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => setEditing('new')} className="inline-flex items-center gap-1 text-xs font-bold text-[#FF7A00]">
                  <Plus className="h-3.5 w-3.5" /> Add new address
                </button>
                {selected && delivery.serviceability && (
                  <p className={`flex items-start gap-1.5 rounded-lg p-2 text-[11px] font-semibold ${delivery.serviceability.serviceable ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
                    <Truck className="h-3.5 w-3.5 shrink-0 mt-px" />
                    {delivery.serviceability.serviceable ? delivery.serviceability.estimateText : `${delivery.serviceability.reason}. Please choose another address.`}
                  </p>
                )}
              </div>
            )}
          </Section>

          {/* 2. Items */}
          <Section step={2} title={`Review items (${cart.totalQuantity})`} icon={<CheckCircle2 className="h-4 w-4" />}>
            <ul className="divide-y divide-gray-100">
              {cart.lines.map((l) => (
                <li key={l.id} className="flex items-center gap-3 py-2">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                    {l.imageUrl ? <Image src={l.imageUrl} alt="" fill sizes="48px" className="object-contain p-0.5" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-gray-900">{l.name}</p>
                    <p className="text-[11px] text-gray-500">
                      {l.variantName ? `${l.variantName} · ` : ''}Qty {l.quantity} × {formatPaise(l.unitPricePaise)}
                    </p>
                    {l.state !== 'ok' && <p className="text-[11px] font-semibold text-amber-700">{l.message}</p>}
                  </div>
                  <span className="text-xs font-black text-gray-900">{formatPaise(l.lineTotalPaise)}</span>
                </li>
              ))}
            </ul>
            {cart.hasIssues && (
              <Link href="/cart" className="mt-1 inline-flex text-xs font-bold text-[#FF7A00]">
                Fix items in cart →
              </Link>
            )}
          </Section>

          {/* 3. Payment */}
          <Section step={3} title="Payment method" icon={<CreditCard className="h-4 w-4" />}>
            {summary.paymentMethods.length === 0 ? (
              <p className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">No payment method is available right now. Please try again later.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Payment method">
                {summary.paymentMethods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={method === m}
                    onClick={() => setMethod(m)}
                    className={`flex items-center gap-2.5 rounded-xl border p-3 text-left text-xs transition-colors ${method === m ? 'border-[#FF7A00] bg-orange-50/50 ring-1 ring-[#FF7A00]/30' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    {m === 'ONLINE' ? <CreditCard className="h-5 w-5 text-[#0B5D3B]" /> : <Banknote className="h-5 w-5 text-[#0B5D3B]" />}
                    <span>
                      <span className="block font-bold text-gray-900">{m === 'ONLINE' ? 'Pay online' : 'Cash on delivery'}</span>
                      <span className="text-[11px] text-gray-500">{m === 'ONLINE' ? 'UPI, cards, net banking via Razorpay' : 'Pay when your order arrives'}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Summary */}
        <aside className="lg:col-span-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-xs space-y-3 lg:sticky lg:top-20">
          <h2 className="text-sm font-bold text-gray-900">Price details</h2>
          <dl className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <dt className="text-gray-500">Items ({cart.totalQuantity})</dt>
              <dd className="font-semibold text-gray-900">{formatPaise(cart.subtotalPaise)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Delivery</dt>
              <dd className={delivery.deliveryChargePaise ? 'font-semibold text-gray-900' : 'font-semibold text-emerald-700'}>
                {delivery.deliveryChargePaise ? formatPaise(delivery.deliveryChargePaise) : 'Free'}
              </dd>
            </div>
            {delivery.amountToFreeDeliveryPaise > 0 && <p className="text-[10px] text-gray-400">Add {formatPaise(delivery.amountToFreeDeliveryPaise)} more for free delivery.</p>}
          </dl>
          <div className="flex justify-between border-t border-gray-100 pt-2.5">
            <span className="text-sm font-bold text-gray-900">Total</span>
            <span className="text-base font-black text-gray-900">{formatPaise(summary.totalPaise)}</span>
          </div>
          {(summary.blockers.length > 0 || error) && (
            <div role="alert" className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900">
              {error && <p className="font-bold">{error.message}</p>}
              {[...(error?.issues ?? []), ...summary.blockers.filter((b) => b !== error?.message)].map((b) => (
                <p key={b} className="flex gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {b}
                </p>
              ))}
            </div>
          )}
          <PlaceButton disabled={!summary.canPlaceOrder || !method || !addressId || !!editing} placing={placing} method={method} total={summary.totalPaise} onClick={placeOrder} />
          <p className="flex items-center gap-1.5 text-[10px] text-gray-400">
            <ShieldCheck className="h-3.5 w-3.5 text-[#0B5D3B]" /> Payments are verified with the provider before your order is confirmed.
          </p>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-14 z-30 border-t border-gray-200 bg-white/95 px-4 py-2.5 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase text-gray-400">Total</p>
            <p className="text-base font-black text-gray-900">{formatPaise(summary.totalPaise)}</p>
          </div>
          <div className="flex-1 max-w-[210px]">
            <PlaceButton disabled={!summary.canPlaceOrder || !method || !addressId || !!editing} placing={placing} method={method} total={summary.totalPaise} onClick={placeOrder} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ step, title, icon, children }: { step: number; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-3.5 sm:p-4 shadow-xs">
      <h2 className="mb-2.5 flex items-center gap-2 text-sm font-bold text-gray-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0B5D3B] text-[11px] font-black text-white">{step}</span>
        <span className="text-[#0B5D3B]">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function PlaceButton({ disabled, placing, method, total, onClick }: { disabled: boolean; placing: boolean; method: string | null; total: number; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled || placing}
      onClick={onClick}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7A00] to-[#FF5500] text-sm font-black text-white shadow-md transition-all hover:from-[#FF8A00] hover:to-[#FF6600] disabled:cursor-not-allowed disabled:from-gray-300 disabled:to-gray-300 disabled:shadow-none"
    >
      {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {placing ? 'Placing order…' : method === 'ONLINE' ? `Pay ${formatPaise(total)}` : 'Place order'}
    </button>
  );
}
