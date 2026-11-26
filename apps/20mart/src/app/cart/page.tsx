'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Breadcrumb, resolveImageSrc } from '@20mart/ui';
import { formatPaise, type CartLine } from '@20mart/shared';
import { AlertTriangle, ArrowLeft, ArrowRight, Loader2, MapPin, Minus, Plus, ShieldCheck, ShoppingBag, Trash2, Truck } from 'lucide-react';
import { storeApi, useStore } from '../../lib/store';
import { useLocation } from '../../lib/location';
import { ServiceabilityNote } from '../../components/LocationPicker';
import { CouponBox } from '../../components/CouponBox';
import { track } from '../../lib/analytics';

interface StoreInfo {
  deliveryEnabled: boolean;
  deliveryFeePaise: number;
  freeDeliveryThresholdPaise: number;
  minOrderPaise: number;
  paymentMethods: string[];
}

const panel = 'rounded-2xl border border-line-subtle bg-surface';

/** Where this cart is being checked for; availability below is for this location. */
function CartLocation() {
  const { ready, pincode, serviceability, label, openPicker } = useLocation();
  if (!ready) return null;
  return (
    <div className={`${panel} space-y-2 p-3`}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex min-w-0 items-center gap-2 text-ink-600">
          <MapPin className="h-4 w-4 shrink-0 text-brand-orange" aria-hidden />
          {pincode ? (
            <span className="truncate">
              Delivering to <b className="font-semibold text-ink">{label}</b>
            </span>
          ) : (
            <span>Select your delivery location to check availability</span>
          )}
        </span>
        <button
          type="button"
          onClick={openPicker}
          className="shrink-0 rounded-md text-sm font-semibold text-brand-orange-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50"
        >
          {pincode ? 'Change' : 'Select'}
        </button>
      </div>
      {serviceability && <ServiceabilityNote s={serviceability} compact />}
    </div>
  );
}

export default function CartPage() {
  const { cart, cartReady, cartBusy, setLineQuantity, removeLine, clearCart, authStatus } = useStore();
  const [info, setInfo] = useState<StoreInfo | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    storeApi<StoreInfo>('/api/store-info').then(setInfo).catch(() => undefined);
  }, []);

  // CART_VIEWED once per visit to this page, after the cart has loaded (a no-op without consent).
  const viewed = useRef(false);
  useEffect(() => {
    if (!cartReady || viewed.current) return;
    viewed.current = true;
    track('CART_VIEWED');
  }, [cartReady]);

  if (!cartReady) {
    return (
      <div className="mx-auto flex max-w-7xl items-center justify-center px-4 py-20 text-sm text-ink-500" aria-busy="true">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading your cart…
      </div>
    );
  }

  if (!cart.lines.length) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-orange-50 text-brand-orange">
          <ShoppingBag className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="text-lg font-semibold text-ink">Your cart is empty</h1>
        <p className="mt-1 text-sm text-ink-500">Everyday essentials from ₹20 are waiting for you.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            href="/shop"
            className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-brand-orange px-5 text-sm font-semibold text-white shadow-sm hover:bg-brand-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40 focus-visible:ring-offset-2"
          >
            Start shopping <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/deals"
            className="inline-flex h-11 items-center rounded-xl border border-line-strong bg-surface px-5 text-sm font-semibold text-ink-700 hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50"
          >
            Daily deals
          </Link>
        </div>
      </div>
    );
  }

  const freeAt = info?.freeDeliveryThresholdPaise ?? 0;
  const toFree = Math.max(0, freeAt - cart.subtotalPaise);
  const belowMin = info ? cart.subtotalPaise < info.minOrderPaise : false;
  const progress = freeAt ? Math.min(100, Math.round((cart.subtotalPaise / freeAt) * 100)) : 100;
  const canCheckout = !cart.hasIssues && !belowMin && cart.subtotalPaise > 0;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-32 pt-3 sm:px-6 sm:pt-4 md:pb-10">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Cart' }]} className="mb-3" />
      <div className="mb-4 flex items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-ink sm:text-xl">Shopping cart</h1>
          <p className="mt-0.5 text-xs text-ink-500">
            {cart.totalQuantity} item{cart.totalQuantity === 1 ? '' : 's'} · prices are always checked against our latest catalog
          </p>
        </div>
        {confirmClear ? (
          <div className="flex shrink-0 items-center gap-2 text-sm" role="group" aria-label="Confirm clearing the cart">
            <span className="text-ink-500">Clear cart?</span>
            <button
              type="button"
              onClick={() => clearCart().then(() => setConfirmClear(false))}
              className="h-8 rounded-lg bg-danger-soft px-2.5 font-semibold text-danger hover:bg-danger/10"
            >
              Yes, clear
            </button>
            <button type="button" onClick={() => setConfirmClear(false)} className="h-8 rounded-lg px-2.5 font-medium text-ink-600 hover:bg-surface-muted">
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="h-8 shrink-0 rounded-lg px-2.5 text-sm font-medium text-ink-500 hover:bg-surface-muted hover:text-danger"
          >
            Clear cart
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12 lg:gap-6">
        <div className="space-y-3 lg:col-span-8">
          <CartLocation />
          {freeAt > 0 && (
            <div className={`${panel} p-3`}>
              <div className="flex items-center gap-2 text-sm text-ink-700">
                <Truck className="h-4 w-4 shrink-0 text-brand-green" aria-hidden />
                {toFree > 0 ? (
                  <span>
                    Add <b className="font-semibold text-ink">{formatPaise(toFree)}</b> more for free delivery
                  </span>
                ) : (
                  <span className="font-semibold text-success">You&apos;ve unlocked free delivery</span>
                )}
              </div>
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted"
                role="progressbar"
                aria-label="Progress to free delivery"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="h-full rounded-full bg-brand-green transition-[width]" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          {cart.hasIssues && (
            <div role="alert" className="flex items-start gap-2 rounded-2xl border border-warning-line bg-warning-soft p-3 text-sm text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>Some items changed or are not available for your delivery location. Update or remove them, or change the location, to continue.</span>
            </div>
          )}
          <ul className={`${panel} divide-y divide-line-subtle ${cartBusy ? 'opacity-70' : ''}`} aria-busy={cartBusy}>
            {cart.lines.map((l) => (
              <CartRow key={l.id} line={l} busy={cartBusy} onQty={(q) => setLineQuantity(l.id, q)} onRemove={() => removeLine(l.id)} />
            ))}
          </ul>
          <Link
            href="/shop"
            className="inline-flex items-center gap-1 rounded-md text-sm font-semibold text-brand-orange-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Continue shopping
          </Link>
        </div>

        <aside className={`${panel} space-y-3 p-4 lg:sticky lg:top-24 lg:col-span-4`} aria-labelledby="summary-title">
          <h2 id="summary-title" className="text-sm font-semibold text-ink">
            Order summary
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-500">Subtotal</dt>
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
              <dd className="text-ink-700">{info && toFree === 0 ? <span className="font-medium text-success">Free</span> : 'Calculated at checkout'}</dd>
            </div>
          </dl>
          <CouponBox />
          {belowMin && info && (
            <p role="alert" className="rounded-lg bg-warning-soft px-3 py-2 text-xs font-medium text-warning">
              Minimum order value is {formatPaise(info.minOrderPaise)}.
            </p>
          )}
          <div className="flex items-baseline justify-between border-t border-line-subtle pt-3">
            <span className="text-sm font-semibold text-ink">Estimated total</span>
            <span className="text-lg font-bold tabular-nums text-ink">{formatPaise(cart.subtotalPaise - cart.discountPaise)}</span>
          </div>
          <div className="hidden md:block">
            <CheckoutButton enabled={canCheckout} guest={authStatus !== 'authenticated'} />
          </div>
          <p className="flex items-start gap-1.5 text-2xs text-ink-500">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-green" aria-hidden /> Final prices and delivery charges are confirmed at checkout.
          </p>
        </aside>
      </div>

      {/* Mobile sticky checkout bar (above the bottom navigation) */}
      <div data-mobile-action-bar className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-surface/90 md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div className="leading-tight">
            <p className="text-2xs text-ink-500">{cart.discountPaise > 0 ? 'After coupon' : 'Subtotal'}</p>
            <p className="text-base font-bold tabular-nums text-ink">{formatPaise(cart.subtotalPaise - cart.discountPaise)}</p>
          </div>
          <div className="max-w-[220px] flex-1">
            <CheckoutButton enabled={canCheckout} guest={authStatus !== 'authenticated'} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckoutButton({ enabled, guest }: { enabled: boolean; guest: boolean }) {
  const href = guest ? '/auth?returnTo=/checkout' : '/checkout';
  const cls = 'flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition-colors';
  if (!enabled) {
    return (
      <span className={`${cls} cursor-not-allowed bg-surface-muted text-ink-400`} aria-disabled="true">
        Checkout
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`${cls} bg-brand-orange text-white shadow-sm hover:bg-brand-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/40 focus-visible:ring-offset-2`}
    >
      {guest ? 'Sign in to checkout' : 'Proceed to checkout'} <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function CartRow({ line, busy, onQty, onRemove }: { line: CartLine; busy: boolean; onQty: (q: number) => void; onRemove: () => void }) {
  const blocked = line.state === 'unavailable' || line.state === 'out_of_stock';
  const warn = line.state !== 'ok' || line.priceChanged;
  const stepBtn =
    'flex h-full w-9 items-center justify-center text-ink-600 hover:bg-surface-muted disabled:opacity-40 disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-orange/50';
  return (
    <li className={`flex items-center gap-3 p-3 sm:p-4 ${line.state !== 'ok' ? 'bg-warning-soft/50' : ''}`}>
      <Link
        href={`/product/${line.slug}`}
        className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-sunken sm:h-20 sm:w-20 ${blocked ? 'opacity-50 grayscale' : ''}`}
        tabIndex={-1}
        aria-hidden
      >
        {line.imageUrl ? <Image src={resolveImageSrc(line.imageUrl)} alt="" fill sizes="80px" className="object-contain p-1.5 mix-blend-multiply" /> : null}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {line.brandName && <p className="text-2xs font-medium text-ink-500">{line.brandName}</p>}
            <Link
              href={`/product/${line.slug}`}
              className="line-clamp-2 rounded text-sm font-medium text-ink-800 hover:text-ink hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50"
            >
              {line.name}
            </Link>
            {line.variantName && <p className="text-xs text-ink-500">{line.variantName}</p>}
          </div>
          <button
            type="button"
            onClick={onRemove}
            disabled={busy}
            aria-label={`Remove ${line.name}`}
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-400 hover:bg-danger-soft hover:text-danger disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="leading-tight">
            <span className="block text-sm font-bold tabular-nums text-ink">{formatPaise(line.unitPricePaise)}</span>
            {line.mrpPaise > line.unitPricePaise && (
              <span className="block text-2xs tabular-nums text-ink-400">
                MRP <span className="line-through">{formatPaise(line.mrpPaise)}</span>
              </span>
            )}
          </div>
          {!blocked && (
            <div className="flex h-9 items-center overflow-hidden rounded-lg border border-line bg-surface">
              <button
                type="button"
                aria-label={`Decrease quantity of ${line.name}`}
                disabled={busy || line.quantity <= 1}
                onClick={() => onQty(line.quantity - 1)}
                className={stepBtn}
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-8 text-center text-sm font-semibold tabular-nums text-ink" aria-live="polite">
                {line.quantity}
              </span>
              <button
                type="button"
                aria-label={`Increase quantity of ${line.name}`}
                disabled={busy || line.quantity >= line.maxQty}
                onClick={() => onQty(line.quantity + 1)}
                className={stepBtn}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
        {warn && line.message && (
          <p className={`mt-1.5 text-xs font-medium ${line.state !== 'ok' ? 'text-warning' : 'text-info'}`}>
            {line.message}
            {line.state === 'insufficient' && line.maxQty > 0 && (
              <button type="button" onClick={() => onQty(line.maxQty)} className="ml-1.5 font-semibold underline">
                Set to {line.maxQty}
              </button>
            )}
          </p>
        )}
      </div>
    </li>
  );
}
