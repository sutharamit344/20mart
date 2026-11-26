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
  const [applying, setApplying] = useState(false);
  const [removing, setRemoving] = useState(false);

  if (authStatus !== 'authenticated') {
    return (
      <p className="flex items-center gap-1.5 rounded-lg bg-surface-page p-2 text-2xs text-ink-500">
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
      <div className={`rounded-lg border p-2 text-2xs ${c.valid ? 'border-success-line bg-success-soft' : 'border-warning-line bg-warning-soft'}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5 font-bold text-ink">
            {c.valid ? <Tag className="h-3.5 w-3.5 shrink-0 text-success" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />}
            <span className="font-mono">{c.code}</span>
            {c.valid && <span className="truncate font-semibold text-success">−{formatPaise(c.discountPaise)}</span>}
          </p>
          <button
            type="button"
            disabled={removing || cartBusy}
            onClick={async () => {
              setRemoving(true);
              try {
                await removeCoupon();
                onChange?.();
              } finally {
                setRemoving(false);
              }
            }}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 font-bold text-ink-600 hover:bg-surface disabled:opacity-50"
            aria-label={`Remove coupon ${c.code}`}
          >
            {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} Remove
          </button>
        </div>
        {c.title && c.valid && <p className="mt-0.5 text-success">{c.title}</p>}
        {!c.valid && c.message && <p className="mt-0.5 font-semibold text-warning">{c.message}</p>}
      </div>
    );
  }

  return (
    <form
      className="space-y-1"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!code.trim() || applying || cartBusy) return;
        setApplying(true);
        try {
          const err = await applyCoupon(code.trim());
          setError(err);
          if (!err) {
            setCode('');
            onChange?.();
          }
        } finally {
          setApplying(false);
        }
      }}
    >
      <label htmlFor="coupon-code" className="text-2xs font-bold text-ink-700">
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
          className="h-9 min-w-0 flex-1 rounded-lg border border-line px-2.5 font-mono text-xs uppercase outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/15"
        />
        <button type="submit" disabled={applying || cartBusy || !code.trim()} className="inline-flex h-9 items-center rounded-lg bg-brand-green px-3 text-xs font-bold text-white hover:bg-brand-green-hover disabled:opacity-50">
          {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Apply'}
        </button>
      </div>
      {error && (
        <p id="coupon-error" role="alert" className="text-2xs font-semibold text-danger">
          {error}
        </p>
      )}
      <Link href="/account/coupons" className="inline-block text-2xs font-semibold text-brand-green hover:underline">
        View my coupons
      </Link>
    </form>
  );
}
