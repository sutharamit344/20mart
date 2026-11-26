'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatPaise } from '@20mart/shared';
import { Modal } from '@20mart/ui';
import { AlertTriangle, Loader2, Tag, X } from 'lucide-react';
import { storeApi, useStore } from '../lib/store';

interface CustomerCouponItem {
  id: string;
  code: string;
  title: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  minOrderValuePaise: number;
  maxDiscountPaise: number | null;
  perCustomerLimit: number;
  startsAt: string;
  endsAt: string | null;
  state: 'AVAILABLE' | 'UPCOMING' | 'USED' | 'EXPIRED' | 'UNAVAILABLE';
}

const COUPON_STATE_STYLE: Record<string, { label: string; cls: string }> = {
  AVAILABLE: { label: 'Available', cls: 'bg-success-soft text-success' },
  UPCOMING: { label: 'Starts soon', cls: 'bg-sky-50 text-sky-700' },
  USED: { label: 'Used', cls: 'bg-surface-muted text-ink-500' },
  EXPIRED: { label: 'Expired', cls: 'bg-surface-muted text-ink-500' },
  UNAVAILABLE: { label: 'Not active yet', cls: 'bg-warning-soft text-warning' },
};

const STATE_ORDER = ['AVAILABLE', 'UPCOMING', 'UNAVAILABLE', 'USED', 'EXPIRED'];

const formatCouponDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' });

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
  const [couponsOpen, setCouponsOpen] = useState(false);
  const [coupons, setCoupons] = useState<CustomerCouponItem[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [couponsError, setCouponsError] = useState<string | null>(null);
  const [applyingCode, setApplyingCode] = useState<string | null>(null);

  useEffect(() => {
    if (!couponsOpen) return;
    let active = true;
    setLoadingCoupons(true);
    setCouponsError(null);
    storeApi<{ items: CustomerCouponItem[] }>('/api/account/coupons')
      .then((res) => {
        if (!active) return;
        const sorted = [...(res.items ?? [])].sort(
          (a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state)
        );
        setCoupons(sorted);
      })
      .catch((e) => {
        if (!active) return;
        setCouponsError(e instanceof Error ? e.message : 'Could not load coupons');
      })
      .finally(() => {
        if (active) setLoadingCoupons(false);
      });
    return () => {
      active = false;
    };
  }, [couponsOpen]);

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
      <button
        type="button"
        onClick={() => {
          setError(null);
          setCouponsOpen(true);
        }}
        className="inline-block cursor-pointer text-2xs font-semibold text-brand-green hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/50 rounded"
      >
        View my coupons
      </button>

      <Modal
        isOpen={couponsOpen}
        onClose={() => setCouponsOpen(false)}
        title="My coupons"
        maxWidth="lg"
      >
        {loadingCoupons ? (
          <div className="flex items-center justify-center py-10 text-xs text-ink-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading your coupons…
          </div>
        ) : couponsError ? (
          <p role="alert" className="rounded-xl bg-danger-soft p-3 text-xs font-medium text-danger">
            {couponsError}
          </p>
        ) : coupons.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line p-6 text-center">
            <Tag className="mx-auto h-6 w-6 text-ink-400" />
            <p className="mt-2 text-sm font-bold text-ink">No coupons right now</p>
            <p className="mt-0.5 text-xs text-ink-500">When you receive a coupon it will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {error && (
              <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">
                {error}
              </p>
            )}
            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {coupons.map((c) => {
                const s = COUPON_STATE_STYLE[c.state] ?? COUPON_STATE_STYLE.UNAVAILABLE;
                const off = c.discountType === 'FIXED' ? formatPaise(c.discountValue) : `${c.discountValue / 100}%`;
                const usable = c.state === 'AVAILABLE';
                const isApplyingThis = applyingCode === c.code;
                return (
                  <li
                    key={c.id}
                    className={`flex flex-col justify-between rounded-xl border bg-surface p-3 ${
                      usable ? 'border-success-line' : 'border-line-subtle opacity-75'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-base font-bold text-ink">{off} off</p>
                          <p className="text-xs font-semibold text-ink-700">{c.title}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-2xs font-bold ${s.cls}`}>
                          {s.label}
                        </span>
                      </div>
                      <p className="mt-2 inline-block rounded-lg border border-dashed border-brand-green/40 bg-brand-green/5 px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-brand-green">
                        {c.code}
                      </p>
                      <ul className="mt-2 space-y-0.5 text-2xs text-ink-500">
                        {c.minOrderValuePaise > 0 && <li>Min order: {formatPaise(c.minOrderValuePaise)}</li>}
                        {c.maxDiscountPaise != null && <li>Max discount: {formatPaise(c.maxDiscountPaise)}</li>}
                        {c.endsAt && (
                          <li>
                            {c.state === 'EXPIRED' ? 'Expired' : 'Valid until'} {formatCouponDate(c.endsAt)}
                          </li>
                        )}
                        {c.state === 'UPCOMING' && <li>Starts {formatCouponDate(c.startsAt)}</li>}
                        {c.description && <li>{c.description}</li>}
                      </ul>
                    </div>
                    {usable && (
                      <button
                        type="button"
                        disabled={isApplyingThis || cartBusy}
                        onClick={async () => {
                          setApplyingCode(c.code);
                          setError(null);
                          try {
                            const err = await applyCoupon(c.code);
                            if (err) {
                              setError(err);
                            } else {
                              setCode('');
                              setCouponsOpen(false);
                              onChange?.();
                            }
                          } finally {
                            setApplyingCode(null);
                          }
                        }}
                        className="mt-3 inline-flex h-8 w-full cursor-pointer items-center justify-center rounded-lg bg-brand-green px-3 text-xs font-bold text-white hover:bg-brand-green-hover disabled:opacity-50"
                      >
                        {isApplyingThis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Apply coupon'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Modal>
    </form>
  );
}
