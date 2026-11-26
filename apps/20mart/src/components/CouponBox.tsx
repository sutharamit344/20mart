'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { formatPaise } from '@20mart/shared';
import { AlertTriangle, Loader2, Tag, X } from 'lucide-react';
import { useStore } from '../lib/store';

/**
 * Apply / remove a coupon on the server cart. The discount shown is the server's number;
 * it is re-validated on every cart read and again when the order is placed.
 */
export function CouponBox({ onChange }: { onChange?: () => void }) {
  const { cart, cartBusy, applyCoupon, removeCoupon, authStatus } = useStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (authStatus !== 'authenticated') {
    return (
      <p className="flex items-center gap-1.5 rounded-lg bg-gray-50 p-2 text-[11px] text-gray-500">
        <Tag className="h-3.5 w-3.5 text-brand-green" />
        <span>
          <Link href="/auth?returnTo=/cart" className="font-bold text-brand-green underline">
            Sign in
          </Link>{' '}
          to use a coupon.
        </span>
      </p>
    );
  }

  if (cart.coupon) {
    const c = cart.coupon;
    return (
      <div className={`rounded-lg border p-2 text-[11px] ${c.valid ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5 font-bold text-gray-900">
            {c.valid ? <Tag className="h-3.5 w-3.5 shrink-0 text-emerald-700" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />}
            <span className="font-mono">{c.code}</span>
            {c.valid && <span className="truncate font-semibold text-emerald-800">−{formatPaise(c.discountPaise)}</span>}
          </p>
          <button
            type="button"
            disabled={cartBusy}
            onClick={async () => {
              await removeCoupon();
              onChange?.();
            }}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 font-bold text-gray-600 hover:bg-white disabled:opacity-50"
            aria-label={`Remove coupon ${c.code}`}
          >
            <X className="h-3.5 w-3.5" /> Remove
          </button>
        </div>
        {c.title && c.valid && <p className="mt-0.5 text-emerald-800">{c.title}</p>}
        {!c.valid && c.message && <p className="mt-0.5 font-semibold text-amber-800">{c.message}</p>}
      </div>
    );
  }

  return (
    <form
      className="space-y-1"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!code.trim()) return;
        const err = await applyCoupon(code.trim());
        setError(err);
        if (!err) {
          setCode('');
          onChange?.();
        }
      }}
    >
      <label htmlFor="coupon-code" className="text-[11px] font-bold text-gray-700">
        Coupon code
      </label>
      <div className="flex gap-1.5">
        <input
          id="coupon-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(null);
          }}
          maxLength={32}
          autoComplete="off"
          placeholder="e.g. WELCOME50"
          aria-invalid={!!error}
          aria-describedby={error ? 'coupon-error' : undefined}
          className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 px-2.5 font-mono text-xs uppercase outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/15"
        />
        <button type="submit" disabled={cartBusy || !code.trim()} className="inline-flex h-9 items-center rounded-lg bg-brand-green px-3 text-xs font-bold text-white hover:bg-brand-green-hover disabled:opacity-50">
          {cartBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Apply'}
        </button>
      </div>
      {error && (
        <p id="coupon-error" role="alert" className="text-[11px] font-semibold text-red-600">
          {error}
        </p>
      )}
      <Link href="/account/coupons" className="inline-block text-[10px] font-semibold text-brand-green hover:underline">
        View my coupons
      </Link>
    </form>
  );
}
