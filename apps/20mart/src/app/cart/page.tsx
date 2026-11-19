'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Breadcrumb, resolveImageSrc } from '@20mart/ui';
import { formatPaise, type CartLine } from '@20mart/shared';
import { AlertTriangle, ArrowRight, Loader2, MapPin, Minus, Plus, ShieldCheck, ShoppingBag, Trash2, Truck } from 'lucide-react';
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

/** Where this cart is being checked for; availability below is for this location. */
function CartLocation() {
  const { ready, pincode, serviceability, label, openPicker } = useLocation();
  if (!ready) return null;
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5 min-w-0 text-gray-600">
          <MapPin className="h-4 w-4 shrink-0 text-[#FF7A00]" />
          {pincode ? (
            <span className="truncate">
              Delivering to <b className="text-gray-900">{label}</b>
            </span>
          ) : (
            <span>Select your delivery location to check availability</span>
          )}
        </span>
        <button type="button" onClick={openPicker} className="shrink-0 font-bold text-[#C25D00] hover:underline">
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
      <div className="max-w-7xl mx-auto px-4 py-20 flex items-center justify-center text-xs text-gray-400" aria-busy="true">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading your cart…
      </div>
    );
  }

  if (!cart.lines.length) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-[#FF7A00]">
          <ShoppingBag className="h-8 w-8" />
        </div>
        <h1 className="text-lg font-black text-gray-900">Your cart is empty</h1>
        <p className="mt-1 text-xs text-gray-500">Everyday essentials from ₹20 are waiting for you.</p>
        <Link href="/shop" className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#FF7A00] px-5 text-sm font-bold text-white hover:bg-[#E66E00]">
          Start shopping <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const freeAt = info?.freeDeliveryThresholdPaise ?? 0;
  const toFree = Math.max(0, freeAt - cart.subtotalPaise);
  const belowMin = info ? cart.subtotalPaise < info.minOrderPaise : false;
  const progress = freeAt ? Math.min(100, Math.round((cart.subtotalPaise / freeAt) * 100)) : 100;
  const canCheckout = !cart.hasIssues && !belowMin && cart.subtotalPaise > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-2.5 pb-28 md:pb-10 sm:pt-3.5">
      <Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Cart' }]} className="mb-2" />
      <div className="flex items-end justify-between gap-2 mb-3">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-gray-900">Shopping Cart</h1>
          <p className="text-xs text-gray-500">
            {cart.totalQuantity} item{cart.totalQuantity === 1 ? '' : 's'} · prices are always checked against our latest catalog
          </p>
        </div>
        {confirmClear ? (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-500">Clear cart?</span>
            <button type="button" onClick={() => clearCart().then(() => setConfirmClear(false))} className="font-bold text-red-600">
              Yes
            </button>
            <button type="button" onClick={() => setConfirmClear(false)} className="font-semibold text-gray-500">
              No
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmClear(true)} className="text-xs font-semibold text-gray-500 hover:text-red-600">
            Clear cart
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-8 space-y-2.5">
          <CartLocation />
          {freeAt > 0 && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
                <Truck className="h-4 w-4 shrink-0" />
                {toFree > 0 ? (
                  <span>
                    Add <b>{formatPaise(toFree)}</b> more for free delivery
                  </span>
                ) : (
                  <span>You&apos;ve unlocked free delivery</span>
                )}
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-emerald-100" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-[#0B5D3B] transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          {cart.hasIssues && (
            <div role="alert" className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-px" />
              <span>Some items changed or are not available for your delivery location. Update or remove them, or change the location, to continue.</span>
            </div>
          )}
          <ul className={`space-y-2.5 ${cartBusy ? 'opacity-70' : ''}`}>
            {cart.lines.map((l) => (
              <CartRow key={l.id} line={l} busy={cartBusy} onQty={(q) => setLineQuantity(l.id, q)} onRemove={() => removeLine(l.id)} />
            ))}
          </ul>
          <Link href="/shop" className="inline-flex items-center gap-1 text-xs font-bold text-[#FF7A00] hover:underline">
            ← Continue shopping
          </Link>
        </div>

        <aside className="lg:col-span-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-xs space-y-3 lg:sticky lg:top-20">
          <h2 className="text-sm font-bold text-gray-900">Order summary</h2>
          <dl className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <dt className="text-gray-500">Subtotal</dt>
              <dd className="font-bold text-gray-900">{formatPaise(cart.subtotalPaise)}</dd>
            </div>
            {cart.discountPaise > 0 && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Coupon {cart.coupon?.code}</dt>
                <dd className="font-bold text-emerald-700">−{formatPaise(cart.discountPaise)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">Delivery</dt>
              <dd className="text-gray-700">
                {info && toFree === 0 ? <span className="font-semibold text-emerald-700">Free</span> : 'Calculated at checkout'}
              </dd>
            </div>
          </dl>
          <CouponBox />
          {belowMin && info && <p className="rounded-lg bg-orange-50 p-2 text-[11px] font-semibold text-[#C25D00]">Minimum order value is {formatPaise(info.minOrderPaise)}.</p>}
          <div className="flex justify-between border-t border-gray-100 pt-2.5 text-sm">
            <span className="font-bold text-gray-900">Estimated total</span>
            <span className="font-black text-gray-900">{formatPaise(cart.subtotalPaise - cart.discountPaise)}</span>
          </div>
          <CheckoutButton enabled={canCheckout} guest={authStatus !== 'authenticated'} />
          <p className="flex items-center gap-1.5 text-[10px] text-gray-400">
            <ShieldCheck className="h-3.5 w-3.5 text-[#0B5D3B]" /> Final prices and delivery charges are confirmed at checkout.
          </p>
        </aside>
      </div>

      {/* Mobile sticky checkout bar */}
      <div className="fixed inset-x-0 bottom-14 z-30 border-t border-gray-200 bg-white/95 px-4 py-2.5 backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase text-gray-400">{cart.discountPaise > 0 ? 'After coupon' : 'Subtotal'}</p>
            <p className="text-base font-black text-gray-900">{formatPaise(cart.subtotalPaise - cart.discountPaise)}</p>
          </div>
          <div className="flex-1 max-w-[200px]">
            <CheckoutButton enabled={canCheckout} guest={authStatus !== 'authenticated'} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckoutButton({ enabled, guest }: { enabled: boolean; guest: boolean }) {
  const href = guest ? '/auth?returnTo=/checkout' : '/checkout';
  const cls = 'flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-black transition-all';
  if (!enabled) {
    return (
      <span className={`${cls} cursor-not-allowed bg-gray-200 text-gray-500`} aria-disabled="true">
        Checkout
      </span>
    );
  }
  return (
    <Link href={href} className={`${cls} bg-gradient-to-r from-[#FF7A00] to-[#FF5500] text-white shadow-md hover:from-[#FF8A00] hover:to-[#FF6600]`}>
      {guest ? 'Sign in to checkout' : 'Proceed to checkout'} <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function CartRow({ line, busy, onQty, onRemove }: { line: CartLine; busy: boolean; onQty: (q: number) => void; onRemove: () => void }) {
  const blocked = line.state === 'unavailable' || line.state === 'out_of_stock';
  const warn = line.state !== 'ok' || line.priceChanged;
  return (
    <li className={`flex gap-3 rounded-2xl border bg-white p-2.5 sm:p-3 shadow-xs ${line.state !== 'ok' ? 'border-amber-200' : 'border-gray-100'}`}>
      <Link href={`/product/${line.slug}`} className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50 ${blocked ? 'opacity-50 grayscale' : ''}`}>
        {line.imageUrl ? <Image src={resolveImageSrc(line.imageUrl)} alt="" fill sizes="80px" className="object-contain p-1" /> : null}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {line.brandName && <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{line.brandName}</p>}
            <Link href={`/product/${line.slug}`} className="line-clamp-2 text-xs sm:text-sm font-bold text-gray-900 hover:text-[#0B5D3B]">
              {line.name}
            </Link>
            {line.variantName && <p className="text-[11px] text-gray-500">{line.variantName}</p>}
          </div>
          <button type="button" onClick={onRemove} disabled={busy} aria-label={`Remove ${line.name}`} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-black text-gray-900">{formatPaise(line.unitPricePaise)}</span>
            {line.mrpPaise > line.unitPricePaise && <span className="text-[10px] text-gray-400 line-through">{formatPaise(line.mrpPaise)}</span>}
          </div>
          {!blocked && (
            <div className="flex items-center rounded-xl border border-gray-200 bg-gray-50 p-0.5">
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={busy || line.quantity <= 1}
                onClick={() => onQty(line.quantity - 1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-600 hover:bg-white disabled:opacity-40"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-8 text-center text-xs font-bold text-gray-900" aria-live="polite">
                {line.quantity}
              </span>
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={busy || line.quantity >= line.maxQty}
                onClick={() => onQty(line.quantity + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-600 hover:bg-white disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
        {warn && line.message && (
          <p className={`mt-1 text-[11px] font-semibold ${line.state !== 'ok' ? 'text-amber-700' : 'text-blue-700'}`}>
            {line.message}
            {line.state === 'insufficient' && line.maxQty > 0 && (
              <button type="button" onClick={() => onQty(line.maxQty)} className="ml-1.5 underline">
                Set to {line.maxQty}
              </button>
            )}
          </p>
        )}
      </div>
    </li>
  );
}
