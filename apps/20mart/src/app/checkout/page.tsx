'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { resolveImageSrc } from '@20mart/ui';
import { useRouter } from 'next/navigation';
import { formatPaise, type CartView, type SavedAddress } from '@20mart/shared';
import { AlertTriangle, Banknote, CheckCircle2, CreditCard, Loader2, MapPin, Pencil, Plus, ShieldCheck, Truck } from 'lucide-react';
import { StoreApiError, storeApi, useStore } from '../../lib/store';
import { payWithRazorpay, type CheckoutPaymentParams } from '../../lib/razorpay';
import { AddressForm } from '../../components/AddressForm';
import { CouponBox } from '../../components/CouponBox';

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
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div role="alert" className="rounded-2xl border border-danger-line bg-danger-soft p-5">
          <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-danger" aria-hidden />
          <p className="text-sm font-semibold text-ink">{loadError}</p>
          <button
            type="button"
            onClick={() => load()}
            className="mt-3 inline-flex h-10 items-center rounded-xl border border-line-strong bg-surface px-4 text-sm font-semibold text-ink-700 hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (!summary) {
    return (
      <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-20 text-sm text-ink-500" aria-busy="true">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing checkout…
      </div>
    );
  }
  if (!summary.cart.lines.length) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-lg font-semibold text-ink">Your cart is empty</p>
        <p className="mt-1 text-sm text-ink-500">Add a few essentials before checking out.</p>
        <Link href="/shop" className="mt-4 inline-flex h-11 items-center rounded-xl bg-brand-orange px-5 text-sm font-semibold text-white shadow-sm hover:bg-brand-orange-600">
          Browse products
        </Link>
      </div>
    );
  }

  const { cart, delivery } = summary;
  const selected = summary.addresses.find((a) => a.id === addressId) ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-32 pt-4 sm:px-6 md:pb-10">
      <h1 className="text-lg font-semibold text-ink sm:text-xl">Checkout</h1>
      <p className="mb-4 mt-0.5 text-xs text-ink-500">All prices and charges are calculated securely on our server.</p>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12 lg:gap-6">
        <div className="space-y-3 lg:col-span-8">
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
              <button type="button" onClick={() => setEditing('new')} className="flex w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-line py-6 text-sm font-semibold text-brand-orange-700 hover:border-brand-orange/40 hover:bg-brand-orange-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50">
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
                        className={`relative h-full cursor-pointer rounded-xl border p-3 pr-11 text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 ${a.id === addressId ? 'border-brand-orange bg-brand-orange-50/60 ring-1 ring-brand-orange/30' : 'border-line hover:border-line-strong'}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-ink">{a.name}</span>
                          <span className="rounded bg-surface-muted px-1.5 py-0.5 text-2xs font-medium uppercase text-ink-500">{a.type}</span>
                          {a.isDefault && <span className="text-2xs font-semibold uppercase text-brand-green">Default</span>}
                        </div>
                        <p className="mt-1 leading-relaxed text-ink-600">
                          {a.addressLine1}
                          {a.addressLine2 ? `, ${a.addressLine2}` : ''}
                          {a.landmark ? `, near ${a.landmark}` : ''}, {a.city}, {a.state} – {a.pincode}
                        </p>
                        <p className="mt-0.5 tabular-nums text-ink-500">+91 {a.phone}</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditing(a);
                          }}
                          className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 hover:bg-surface hover:text-ink-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50"
                          aria-label={`Edit address for ${a.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => setEditing('new')} className="inline-flex h-9 items-center gap-1 rounded-lg text-sm font-semibold text-brand-orange-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50">
                  <Plus className="h-3.5 w-3.5" /> Add new address
                </button>
                {selected && delivery.serviceability && (
                  <p className={`flex items-start gap-1.5 rounded-lg px-3 py-2 text-xs font-medium ${delivery.serviceability.serviceable ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
                    <Truck className="h-3.5 w-3.5 shrink-0 mt-px" />
                    {delivery.serviceability.serviceable ? delivery.serviceability.estimateText : `${delivery.serviceability.reason}. Please choose another address.`}
                  </p>
                )}
              </div>
            )}
          </Section>

          {/* 2. Items */}
          <Section step={2} title={`Review items (${cart.totalQuantity})`} icon={<CheckCircle2 className="h-4 w-4" />}>
            <ul className="divide-y divide-line-subtle">
              {cart.lines.map((l) => (
                <li key={l.id} className="flex items-center gap-3 py-2">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-sunken">
                    {l.imageUrl ? <Image src={resolveImageSrc(l.imageUrl)} alt="" fill sizes="48px" className="object-contain p-1 mix-blend-multiply" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-800">{l.name}</p>
                    <p className="text-xs tabular-nums text-ink-500">
                      {l.variantName ? `${l.variantName} · ` : ''}Qty {l.quantity} × {formatPaise(l.unitPricePaise)}
                    </p>
                    {l.state !== 'ok' && <p className="text-xs font-medium text-warning">{l.message}</p>}
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-ink">{formatPaise(l.lineTotalPaise)}</span>
                </li>
              ))}
            </ul>
            {cart.hasIssues && (
              <Link href="/cart" className="mt-2 inline-flex text-sm font-semibold text-brand-orange-700 hover:underline">
                Fix items in cart →
              </Link>
            )}
          </Section>

          {/* 3. Payment */}
          <Section step={3} title="Payment method" icon={<CreditCard className="h-4 w-4" />}>
            {summary.paymentMethods.length === 0 ? (
              <p className="rounded-lg bg-surface-page p-3 text-sm text-ink-600">No payment method is available right now. Please try again later.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Payment method">
                {summary.paymentMethods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={method === m}
                    onClick={() => setMethod(m)}
                    className={`flex min-h-14 items-center gap-3 rounded-xl border p-3 text-left text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50 ${method === m ? 'border-brand-orange bg-brand-orange-50/60 ring-1 ring-brand-orange/30' : 'border-line hover:border-line-strong'}`}
                  >
                    {m === 'ONLINE' ? <CreditCard className="h-5 w-5 text-brand-green" /> : <Banknote className="h-5 w-5 text-brand-green" />}
                    <span>
                      <span className="block text-sm font-semibold text-ink">{m === 'ONLINE' ? 'Pay online' : 'Cash on delivery'}</span>
                      <span className="text-xs text-ink-500">{m === 'ONLINE' ? 'UPI, cards, net banking via Razorpay' : 'Pay when your order arrives'}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Summary */}
        <aside className="space-y-3 rounded-2xl border border-line-subtle bg-surface p-4 lg:sticky lg:top-24 lg:col-span-4" aria-labelledby="price-title">
          <h2 id="price-title" className="text-sm font-semibold text-ink">Price details</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-500">Items ({cart.totalQuantity})</dt>
              <dd className="font-medium tabular-nums text-ink">{formatPaise(cart.subtotalPaise)}</dd>
            </div>
            {cart.discountPaise > 0 && (
              <div className="flex justify-between">
                <dt className="text-ink-500">Coupon {cart.coupon?.code}</dt>
                <dd className="font-medium tabular-nums text-success">−{formatPaise(cart.discountPaise)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-ink-500">Delivery</dt>
              <dd className={delivery.deliveryChargePaise ? 'font-medium tabular-nums text-ink' : 'font-medium text-success'}>
                {delivery.deliveryChargePaise ? formatPaise(delivery.deliveryChargePaise) : 'Free'}
              </dd>
            </div>
            {delivery.amountToFreeDeliveryPaise > 0 && <p className="text-2xs text-ink-500">Add {formatPaise(delivery.amountToFreeDeliveryPaise)} more for free delivery.</p>}
          </dl>
          <CouponBox onChange={() => load(addressId)} />
          <div className="flex items-baseline justify-between border-t border-line-subtle pt-3">
            <span className="text-sm font-semibold text-ink">Total</span>
            <span className="text-lg font-bold tabular-nums text-ink">{formatPaise(summary.totalPaise)}</span>
          </div>
          {(summary.blockers.length > 0 || error) && (
            <div role="alert" className="space-y-1 rounded-xl border border-warning-line bg-warning-soft p-3 text-xs text-warning">
              {error && <p className="font-semibold">{error.message}</p>}
              {[...(error?.issues ?? []), ...summary.blockers.filter((b) => b !== error?.message)].map((b) => (
                <p key={b} className="flex gap-1.5">
                  <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden /> {b}
                </p>
              ))}
            </div>
          )}
          <div className="hidden md:block">
            <PlaceButton disabled={!summary.canPlaceOrder || !method || !addressId || !!editing} placing={placing} method={method} total={summary.totalPaise} onClick={placeOrder} />
          </div>
          <p className="flex items-start gap-1.5 text-2xs text-ink-500">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-green" aria-hidden /> Payments are verified with the provider before your order is confirmed.
          </p>
        </aside>
      </div>

      <div data-mobile-action-bar className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-surface/90 md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="leading-tight">
            <p className="text-2xs text-ink-500">Total</p>
            <p className="text-base font-bold tabular-nums text-ink">{formatPaise(summary.totalPaise)}</p>
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
    <section className="rounded-2xl border border-line-subtle bg-surface p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-green text-2xs font-semibold text-white" aria-hidden>{step}</span>
        <span className="text-ink-400" aria-hidden>{icon}</span>
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
      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-orange text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-ink-400 disabled:shadow-none"
    >
      {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {placing ? 'Placing order…' : method === 'ONLINE' ? `Pay ${formatPaise(total)}` : 'Place order'}
    </button>
  );
}
